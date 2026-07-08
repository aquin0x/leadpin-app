import type { Client as WAClient, Message as WAMessage } from 'whatsapp-web.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { supabase } from '../utils/supabase';

type Client = WAClient;

let _waModule: typeof import('whatsapp-web.js') | null = null;
let _qrModule: typeof import('qrcode') | null = null;

async function loadWA() {
  if (!_waModule) _waModule = await import('whatsapp-web.js');
  return _waModule;
}

async function loadQR() {
  if (!_qrModule) _qrModule = await import('qrcode');
  return _qrModule;
}

export type SessionStatus =
  | 'disconnected'
  | 'initializing'
  | 'qr'
  | 'authenticated'
  | 'ready'
  | 'auth_failure';

export interface CampaignSettings {
  minDelaySec: number;
  maxDelaySec: number;
  coffeeBreakEvery: number;
  coffeeBreakMinutes: number;
  // Gönderim saat penceresi (sunucu yerel saati). start === end => sınırsız.
  sendStartHour: number;
  sendEndHour: number;
  // Günlük toplam gönderim limiti (0 => sınırsız). outreach_logs üzerinden sayılır.
  dailyLimit: number;
}

export interface CampaignState {
  id: string;
  userId: string;
  listId: string;
  lineIds: string[];
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  status: 'running' | 'paused' | 'completed' | 'stopped' | 'failed';
  currentLead?: string;
  startedAt: number;
  finishedAt?: number;
  lastError?: string;
}

export interface LineMeta {
  id: string;
  userId: string;
  label: string;
  phone?: string;
  createdAt: number;
}

interface Session {
  lineId: string;
  userId: string;
  label: string;
  phone?: string;
  client: Client;
  status: SessionStatus;
  qrDataUrl?: string;
  lastError?: string;
}

const SESSION_ROOT = path.resolve(process.cwd(), '.wwebjs_auth');
const LEGACY_LINES_FILE = path.join(SESSION_ROOT, '_lines.json');

// Keyed by lineId (UUID)
const sessions = new Map<string, Session>();
// One campaign per user
const campaigns = new Map<string, CampaignState & { stopRequested?: boolean }>();

function ensureRoot() {
  try { fs.mkdirSync(SESSION_ROOT, { recursive: true }); } catch {}
}

// === Hat metadata'sı artık Supabase'de (whatsapp_lines) ===

function rowToMeta(row: any): LineMeta {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    phone: row.phone || undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function getUserLines(userId: string): Promise<LineMeta[]> {
  const { data, error } = await supabase
    .from('whatsapp_lines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[WA] whatsapp_lines okunamadı:', error.message);
    return [];
  }
  return (data || []).map(rowToMeta);
}

async function getAllLines(): Promise<LineMeta[]> {
  const { data, error } = await supabase.from('whatsapp_lines').select('*');
  if (error) {
    console.error('[WA] whatsapp_lines okunamadı:', error.message);
    return [];
  }
  return (data || []).map(rowToMeta);
}

async function getLineMeta(userId: string, lineId: string): Promise<LineMeta | null> {
  const { data } = await supabase
    .from('whatsapp_lines')
    .select('*')
    .eq('id', lineId)
    .eq('user_id', userId)
    .maybeSingle();
  return data ? rowToMeta(data) : null;
}

async function upsertLine(meta: LineMeta): Promise<void> {
  const { error } = await supabase.from('whatsapp_lines').upsert({
    id: meta.id,
    user_id: meta.userId,
    label: meta.label,
    phone: meta.phone || null,
    created_at: new Date(meta.createdAt).toISOString(),
  });
  if (error) console.error('[WA] line upsert failed:', error.message);
}

async function deleteLineMeta(userId: string, lineId: string): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_lines')
    .delete()
    .eq('id', lineId)
    .eq('user_id', userId);
  if (error) console.error('[WA] line delete failed:', error.message);
}

// Eski dosya tabanlı kayıtları bir defalık DB'ye taşı.
async function migrateLegacyLinesFile(): Promise<void> {
  try {
    if (!fs.existsSync(LEGACY_LINES_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(LEGACY_LINES_FILE, 'utf8')) as Record<string, LineMeta[]>;
    for (const userId of Object.keys(raw || {})) {
      for (const meta of raw[userId] || []) {
        await upsertLine({ ...meta, userId });
      }
    }
    fs.renameSync(LEGACY_LINES_FILE, LEGACY_LINES_FILE + '.migrated');
    console.log('[WA] _lines.json kayıtları Supabase whatsapp_lines tablosuna taşındı.');
  } catch (e: any) {
    console.error('[WA] legacy lines migration failed:', e?.message);
  }
}

function buildPuppeteerArgs(): string[] {
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  const proxyHost = process.env.WHATSAPP_PROXY_HOST;
  const proxyPort = process.env.WHATSAPP_PROXY_PORT;
  if (proxyHost && proxyPort) {
    args.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
  }
  return args;
}

async function createClient(lineId: string): Promise<Client> {
  ensureRoot();
  const { Client, LocalAuth } = await loadWA();
  return new Client({
    authStrategy: new LocalAuth({ clientId: lineId, dataPath: SESSION_ROOT }),
    puppeteer: {
      headless: true,
      args: buildPuppeteerArgs(),
    },
  });
}

// === Gelen mesaj işleme: inbox kaydı + otomatik 'replied' + STOP opt-out ===

const OPT_OUT_RX = /^\s*(stop|dur|iptal|istemiyorum|listeden\s*[cç][ıi]kar|rahats[ıi]z\s*etme)\b/i;

async function handleIncomingMessage(session: Session, msg: WAMessage): Promise<void> {
  try {
    // Yalnızca birebir sohbetler (grup/status/broadcast hariç)
    if (!msg.from?.endsWith('@c.us') || msg.fromMe) return;
    const digits = msg.from.replace(/\D/g, '');
    if (!digits) return;
    const body = (msg.body || '').slice(0, 5000);

    // İşletmeyi normalize telefon üzerinden bul (son 10 hane ile eşleştir)
    const last10 = digits.slice(-10);
    const { data: biz } = await supabase
      .from('businesses')
      .select('id, name, status')
      .eq('user_id', session.userId)
      .like('phone_digits', `%${last10}`)
      .maybeSingle();

    await supabase.from('incoming_messages').insert({
      user_id: session.userId,
      line_id: session.lineId,
      business_id: biz?.id ?? null,
      from_phone: digits,
      body,
    });

    // Cevap geldi → lead'i otomatik 'replied' yap (dönüşmüş/reddedilmişse dokunma)
    if (biz && (biz.status === 'new' || biz.status === 'contacted')) {
      await supabase
        .from('businesses')
        .update({ status: 'replied' })
        .eq('id', biz.id);
      console.log(`[WA:${session.lineId}] ${biz.name} cevap verdi → replied`);
    }

    // Opt-out: STOP benzeri mesajlar karalisteye
    if (OPT_OUT_RX.test(body)) {
      await supabase.from('blacklist').upsert(
        { user_id: session.userId, phone: digits, reason: 'opt-out (gelen mesaj)' },
        { onConflict: 'user_id,phone' }
      );
      console.log(`[WA:${session.lineId}] ${digits} opt-out → karalisteye eklendi`);
    }
  } catch (e: any) {
    console.error(`[WA:${session.lineId}] incoming message handling failed:`, e?.message);
  }
}

async function createSession(meta: LineMeta): Promise<Session> {
  const client = await createClient(meta.id);
  const session: Session = {
    lineId: meta.id,
    userId: meta.userId,
    label: meta.label,
    phone: meta.phone,
    client,
    status: 'disconnected',
  };

  client.on('qr', async (qr) => {
    try {
      const QRCode = await loadQR();
      const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      session.qrDataUrl = dataUrl;
      session.status = 'qr';
      console.log(`[WA:${meta.id}] QR ready`);
    } catch (err: any) {
      console.error(`[WA:${meta.id}] QR generation failed:`, err.message);
    }
  });

  client.on('authenticated', () => {
    session.status = 'authenticated';
    session.qrDataUrl = undefined;
    console.log(`[WA:${meta.id}] authenticated`);
  });

  client.on('auth_failure', (msg) => {
    session.status = 'auth_failure';
    session.lastError = msg;
    console.error(`[WA:${meta.id}] auth_failure:`, msg);
  });

  client.on('ready', () => {
    session.status = 'ready';
    session.qrDataUrl = undefined;
    try {
      const wid = (client as any).info?.wid?.user;
      if (wid) {
        session.phone = String(wid);
        void upsertLine({
          id: meta.id,
          userId: meta.userId,
          label: session.label,
          phone: session.phone,
          createdAt: meta.createdAt,
        });
      }
    } catch {}
    console.log(`[WA:${meta.id}] ready`);
  });

  client.on('message', (msg) => {
    void handleIncomingMessage(session, msg);
  });

  client.on('disconnected', (reason) => {
    session.status = 'disconnected';
    session.lastError = String(reason);
    console.warn(`[WA:${meta.id}] disconnected:`, reason);
  });

  sessions.set(meta.id, session);
  return session;
}

async function getOrCreateSession(meta: LineMeta): Promise<Session> {
  const existing = sessions.get(meta.id);
  if (existing) return existing;
  return createSession(meta);
}

export async function initLine(userId: string, lineId: string): Promise<Session | null> {
  const meta = await getLineMeta(userId, lineId);
  if (!meta) return null;

  let session = await getOrCreateSession(meta);
  if (
    session.status === 'initializing' ||
    session.status === 'qr' ||
    session.status === 'authenticated' ||
    session.status === 'ready'
  ) {
    return session;
  }
  session.status = 'initializing';
  session.lastError = undefined;
  try {
    await session.client.initialize();
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`[WA:${lineId}] initialize failed:`, msg);

    if (/already running|userDataDir/i.test(msg)) {
      try { await session.client.destroy(); } catch {}
      sessions.delete(lineId);
      const profileDir = path.join(SESSION_ROOT, `session-${lineId}`);
      for (const lock of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
        try { fs.rmSync(path.join(profileDir, lock), { force: true }); } catch {}
      }
      session = await getOrCreateSession(meta);
      session.status = 'initializing';
      try {
        await session.client.initialize();
        return session;
      } catch (err2: any) {
        session.status = 'disconnected';
        session.lastError = err2.message;
        return session;
      }
    }

    session.status = 'disconnected';
    session.lastError = msg;
  }
  return session;
}

export async function addLine(userId: string, label?: string): Promise<Session> {
  const lineId = crypto.randomUUID();
  const existing = await getUserLines(userId);
  const meta: LineMeta = {
    id: lineId,
    userId,
    label: label?.trim() || `Hat ${existing.length + 1}`,
    createdAt: Date.now(),
  };
  await upsertLine(meta);
  const session = await createSession(meta);
  // Start initialize in background so caller can return fast
  initLine(userId, lineId).catch((e) =>
    console.error(`[WA:${lineId}] background init error:`, e?.message)
  );
  return session;
}

export async function removeLine(userId: string, lineId: string): Promise<boolean> {
  const meta = await getLineMeta(userId, lineId);
  if (!meta) return false;
  const session = sessions.get(lineId);
  if (session) {
    try { await session.client.logout(); } catch {}
    try { await session.client.destroy(); } catch {}
    sessions.delete(lineId);
  }
  await deleteLineMeta(userId, lineId);
  // Profil klasörünü sil
  try {
    fs.rmSync(path.join(SESSION_ROOT, `session-${lineId}`), { recursive: true, force: true });
  } catch {}
  return true;
}

export async function logoutLine(userId: string, lineId: string): Promise<boolean> {
  const session = sessions.get(lineId);
  if (!session || session.userId !== userId) return false;
  try { await session.client.logout(); } catch {}
  try { await session.client.destroy(); } catch {}
  sessions.delete(lineId);
  // Profil'i sil ki yeni QR alınabilsin
  try {
    fs.rmSync(path.join(SESSION_ROOT, `session-${lineId}`), { recursive: true, force: true });
  } catch {}
  return true;
}

export interface LineStatus {
  id: string;
  label: string;
  phone?: string;
  status: SessionStatus;
  qr: string | null;
  lastError?: string;
  createdAt: number;
}

export async function listLines(userId: string): Promise<LineStatus[]> {
  const metas = await getUserLines(userId);
  return metas
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((m) => {
      const s = sessions.get(m.id);
      return {
        id: m.id,
        label: m.label,
        phone: s?.phone ?? m.phone,
        status: s?.status ?? 'disconnected',
        qr: s?.qrDataUrl ?? null,
        lastError: s?.lastError,
        createdAt: m.createdAt,
      };
    });
}

export async function getLineStatus(userId: string, lineId: string): Promise<LineStatus | null> {
  const m = await getLineMeta(userId, lineId);
  if (!m) return null;
  const s = sessions.get(lineId);
  return {
    id: m.id,
    label: m.label,
    phone: s?.phone ?? m.phone,
    status: s?.status ?? 'disconnected',
    qr: s?.qrDataUrl ?? null,
    lastError: s?.lastError,
    createdAt: m.createdAt,
  };
}

function pickReadySession(userId: string): Session | null {
  for (const s of sessions.values()) {
    if (s.userId === userId && s.status === 'ready') return s;
  }
  return null;
}

// Bootstrap: backend başlarken kayıtlı tüm hatları otomatik başlat
export async function bootstrapLines(): Promise<void> {
  await migrateLegacyLinesFile();
  const all = await getAllLines();
  for (const meta of all) {
    try {
      await createSession(meta);
      initLine(meta.userId, meta.id).catch(() => {});
    } catch (e: any) {
      console.error(`[WA:${meta.id}] bootstrap error:`, e?.message);
    }
  }
}

// Restart'ta 'running' takılı kalan kampanyaları kapat
export async function recoverStaleCampaigns(): Promise<void> {
  const { error, count } = await supabase
    .from('whatsapp_campaigns')
    .update(
      { status: 'failed', last_error: 'Sunucu yeniden başlatıldı, kampanya yarıda kaldı', finished_at: new Date().toISOString() },
      { count: 'exact' }
    )
    .eq('status', 'running');
  if (error) throw new Error(error.message);
  if (count) console.log(`[WA] ${count} yarım kalmış kampanya 'failed' olarak işaretlendi.`);
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('90') && digits.length === 12) return digits;
  if (digits.length === 10 && digits.startsWith('5')) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith('05')) return `90${digits.slice(1)}`;
  return null;
}

function parseSpintax(input: string): string {
  let out = input;
  const rx = /\{([^{}]*\|[^{}]*)\}/;
  let guard = 0;
  while (rx.test(out) && guard++ < 100) {
    out = out.replace(rx, (_, body: string) => {
      const opts = body.split('|');
      return opts[Math.floor(Math.random() * opts.length)];
    });
  }
  return out;
}

function renderTemplate(tpl: string, vars: Record<string, string | number | boolean | null | undefined>): string {
  const spun = parseSpintax(tpl);
  return spun.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  }).replace(/\{işletmeAdi\}/g, () => String(vars.name ?? ''));
}

function pickGreeting(): string {
  const greetings = ['Merhaba', 'Selamlar', 'İyi günler', 'Merhabalar'];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface Business {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  short_id: string | null;
}

async function logOutreach(
  userId: string,
  businessId: string,
  status: 'sent' | 'failed' | 'skipped',
  message: string,
  detail?: string
) {
  await supabase.from('outreach_logs').insert({
    business_id: businessId,
    user_id: userId,
    type: 'whatsapp',
    message_content: detail ? `${message}\n\n[${detail}]` : message,
    status,
  });
  // Kampanya/tekil gönderim başarılıysa lead'i 'contacted' yap (yalnızca 'new' ise)
  if (status === 'sent') {
    await supabase
      .from('businesses')
      .update({ status: 'contacted' })
      .eq('id', businessId)
      .eq('user_id', userId)
      .eq('status', 'new');
  }
}

async function isBlacklisted(userId: string, phoneDigits: string): Promise<boolean> {
  const last10 = phoneDigits.slice(-10);
  const { data } = await supabase
    .from('blacklist')
    .select('id')
    .eq('user_id', userId)
    .like('phone', `%${last10}`)
    .limit(1);
  return !!(data && data.length > 0);
}

// Bugün (sunucu yerel günü) gönderilen whatsapp mesajı sayısı
async function sentTodayCount(userId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('outreach_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'whatsapp')
    .eq('status', 'sent')
    .gte('created_at', start.toISOString());
  return count || 0;
}

function withinSendWindow(startHour: number, endHour: number): boolean {
  if (startHour === endHour) return true; // sınırsız
  const h = new Date().getHours();
  if (startHour < endHour) return h >= startHour && h < endHour;
  // Gece yarısını aşan pencere (örn. 22-06)
  return h >= startHour || h < endHour;
}

export interface MediaAttachment {
  data: string;
  mimeType: string;
  filename: string;
}

export interface StartCampaignParams {
  userId: string;
  listId: string;
  // Rotasyon: birden çok hat verilirse mesajlar hatlar arasında sırayla dağıtılır.
  lineIds?: string[];
  messageTemplate: string;
  messageTemplateNoWebsite?: string;
  minDelaySec?: number;
  maxDelaySec?: number;
  coffeeBreakEvery?: number;
  coffeeBreakMinutes?: number;
  sendStartHour?: number;
  sendEndHour?: number;
  dailyLimit?: number;
  media?: MediaAttachment;
}

export type SingleSendResult =
  | { ok: true; lineId: string }
  | { ok: false; reason: 'no_line'; hint: string }
  | { ok: false; reason: 'not_ready'; lines: LineStatus[] }
  | { ok: false; reason: 'no_phone' | 'no_whatsapp' | 'send_failed' | 'blacklisted'; error?: string };

export async function sendSingleMessage(params: {
  userId: string;
  businessId: string;
  message: string;
  lineId?: string;
  media?: MediaAttachment;
}): Promise<SingleSendResult> {
  const { userId, businessId, message, lineId, media } = params;

  // Hat seç
  let session: Session | null = null;
  if (lineId) {
    const s = sessions.get(lineId);
    if (s && s.userId === userId && s.status === 'ready') session = s;
  } else {
    session = pickReadySession(userId);
  }

  if (!session) {
    const userLines = await listLines(userId);
    if (userLines.length === 0) {
      return { ok: false, reason: 'no_line', hint: 'Önce bir WhatsApp hattı ekleyin.' };
    }
    return { ok: false, reason: 'not_ready', lines: userLines };
  }

  const { data: biz, error } = await supabase
    .from('businesses')
    .select('id, name, phone, website, short_id')
    .eq('id', businessId)
    .eq('user_id', userId)
    .single();
  if (error || !biz) return { ok: false, reason: 'send_failed', error: 'İşletme bulunamadı' };

  const phone = biz.phone ? normalizePhone(biz.phone) : null;
  if (!phone) {
    await logOutreach(userId, biz.id, 'skipped', message, 'Geçersiz numara');
    return { ok: false, reason: 'no_phone' };
  }

  if (await isBlacklisted(userId, phone)) {
    await logOutreach(userId, biz.id, 'skipped', message, 'Karalistede (opt-out)');
    return { ok: false, reason: 'blacklisted', error: 'Numara karalistede' };
  }

  let mediaInstance: any = null;
  if (media?.data && media?.mimeType) {
    const { MessageMedia } = await loadWA();
    mediaInstance = new MessageMedia(media.mimeType, media.data, media.filename || 'attachment');
  }

  try {
    const chatId = `${phone}@c.us`;
    const numberId = await session.client.getNumberId(phone);
    if (!numberId) {
      await logOutreach(userId, biz.id, 'skipped', message, 'WhatsApp hesabı yok');
      return { ok: false, reason: 'no_whatsapp' };
    }
    if (mediaInstance) {
      await session.client.sendMessage(chatId, mediaInstance, { caption: message });
    } else {
      await session.client.sendMessage(chatId, message);
    }
    await logOutreach(userId, biz.id, 'sent', message);
    return { ok: true, lineId: session.lineId };
  } catch (err: any) {
    await logOutreach(userId, biz.id, 'failed', message, err.message);
    return { ok: false, reason: 'send_failed', error: err.message };
  }
}

// === Kampanya durumu DB senkronizasyonu ===

async function persistCampaign(campaign: CampaignState, settings?: CampaignSettings): Promise<void> {
  const { error } = await supabase.from('whatsapp_campaigns').upsert({
    id: campaign.id,
    user_id: campaign.userId,
    list_id: campaign.listId,
    line_ids: campaign.lineIds,
    total: campaign.total,
    processed: campaign.processed,
    sent: campaign.sent,
    failed: campaign.failed,
    skipped: campaign.skipped,
    status: campaign.status,
    current_lead: campaign.currentLead ?? null,
    last_error: campaign.lastError ?? null,
    settings: settings ?? undefined,
    started_at: new Date(campaign.startedAt).toISOString(),
    finished_at: campaign.finishedAt ? new Date(campaign.finishedAt).toISOString() : null,
  });
  if (error) console.error('[WA] campaign persist failed:', error.message);
}

export async function startCampaign(params: StartCampaignParams): Promise<CampaignState> {
  const {
    userId,
    listId,
    lineIds,
    messageTemplate,
    messageTemplateNoWebsite,
    minDelaySec = 60,
    maxDelaySec = 120,
    coffeeBreakEvery = 20,
    coffeeBreakMinutes = 15,
    sendStartHour = 0,
    sendEndHour = 0,
    dailyLimit = 0,
    media,
  } = params;

  const settings: CampaignSettings = {
    minDelaySec, maxDelaySec, coffeeBreakEvery, coffeeBreakMinutes,
    sendStartHour, sendEndHour, dailyLimit,
  };

  let mediaInstance: InstanceType<Awaited<ReturnType<typeof loadWA>>['MessageMedia']> | null = null;
  if (media?.data && media?.mimeType) {
    const { MessageMedia } = await loadWA();
    mediaInstance = new MessageMedia(media.mimeType, media.data, media.filename || 'attachment');
  }

  // Rotasyon havuzu: verilen hatlar ya da kullanıcının tüm hatları
  const requestedIds = (lineIds || []).filter(Boolean);
  const poolIds: string[] = [];
  if (requestedIds.length > 0) {
    for (const id of requestedIds) {
      const s = sessions.get(id);
      if (s && s.userId === userId) poolIds.push(id);
    }
  } else {
    for (const s of sessions.values()) {
      if (s.userId === userId) poolIds.push(s.lineId);
    }
  }

  const anyReady = poolIds.some((id) => sessions.get(id)?.status === 'ready');
  if (!anyReady) {
    throw new Error('Hazır bir WhatsApp hattı yok. Hesap > WhatsApp Hattı Ekle menüsünden QR okutun.');
  }

  const existing = campaigns.get(userId);
  if (existing && existing.status === 'running') {
    throw new Error('Zaten çalışan bir kampanya var.');
  }

  const { data: items, error } = await supabase
    .from('list_items')
    .select('business:businesses(id, name, phone, website, short_id)')
    .eq('list_id', listId);
  if (error) throw new Error(error.message);

  const businesses: Business[] = (items || [])
    .map((i: any) => i.business)
    .filter(Boolean);

  const campaign: CampaignState & { stopRequested?: boolean } = {
    id: crypto.randomUUID(),
    userId,
    listId,
    lineIds: poolIds,
    total: businesses.length,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    status: 'running',
    startedAt: Date.now(),
    stopRequested: false,
  };
  campaigns.set(userId, campaign);
  await persistCampaign(campaign, settings);

  // Round-robin hat seçimi: sıradaki 'ready' hattı döndürür
  let rotationIndex = 0;
  const nextReadySession = (): Session | null => {
    for (let i = 0; i < poolIds.length; i++) {
      const idx = (rotationIndex + i) % poolIds.length;
      const s = sessions.get(poolIds[idx]);
      if (s && s.status === 'ready') {
        rotationIndex = idx + 1;
        return s;
      }
    }
    return null;
  };

  (async () => {
    let dailySent = dailyLimit > 0 ? await sentTodayCount(userId) : 0;

    for (const biz of businesses) {
      const current = campaigns.get(userId);
      if (!current || current.stopRequested) {
        campaign.status = 'stopped';
        break;
      }

      // Günlük limit kontrolü
      if (dailyLimit > 0 && dailySent >= dailyLimit) {
        campaign.status = 'stopped';
        campaign.lastError = `Günlük gönderim limiti (${dailyLimit}) doldu`;
        break;
      }

      // Gönderim saat penceresi: pencere dışındaysak pencere açılana kadar bekle
      while (!withinSendWindow(sendStartHour, sendEndHour)) {
        const c = campaigns.get(userId);
        if (!c || c.stopRequested) break;
        campaign.currentLead = `Saat penceresi bekleniyor (${String(sendStartHour).padStart(2, '0')}:00-${String(sendEndHour).padStart(2, '0')}:00)`;
        await persistCampaign(campaign, settings);
        await sleep(60_000);
      }
      if (campaigns.get(userId)?.stopRequested) {
        campaign.status = 'stopped';
        break;
      }

      // Rotasyon: sıradaki hazır hat; hepsi koptuysa 5 dakikaya kadar bekle
      let live: Session | null = nextReadySession();
      if (!live) {
        for (let wait = 0; wait < 10 && !live; wait++) {
          await sleep(30_000);
          if (campaigns.get(userId)?.stopRequested) break;
          live = nextReadySession();
        }
      }
      if (!live) {
        campaign.status = 'failed';
        campaign.lastError = 'Hiçbir WhatsApp hattı hazır değil (bağlantı koptu)';
        break;
      }

      campaign.currentLead = biz.name;
      const phone = biz.phone ? normalizePhone(biz.phone) : null;
      if (!phone) {
        campaign.skipped++;
        campaign.processed++;
        await logOutreach(userId, biz.id, 'skipped', '', 'Geçersiz veya sabit hat numarası');
        await persistCampaign(campaign, settings);
        continue;
      }

      // Karaliste (kampanya sırasında gelen opt-out'lar da anında etkili olur)
      if (await isBlacklisted(userId, phone)) {
        campaign.skipped++;
        campaign.processed++;
        await logOutreach(userId, biz.id, 'skipped', '', 'Karalistede (opt-out)');
        await persistCampaign(campaign, settings);
        continue;
      }

      const hasWebsite = !!(biz.website && biz.website.trim());
      const template = !hasWebsite && messageTemplateNoWebsite
        ? messageTemplateNoWebsite
        : messageTemplate;
      const message = renderTemplate(template, {
        name: biz.name,
        greeting: pickGreeting(),
        hasWebsite,
        shortId: biz.short_id ?? '',
      });

      try {
        const chatId = `${phone}@c.us`;
        const numberId = await live.client.getNumberId(phone);
        if (!numberId) {
          campaign.skipped++;
          campaign.processed++;
          await logOutreach(userId, biz.id, 'skipped', message, 'WhatsApp hesabı yok');
          await persistCampaign(campaign, settings);
          continue;
        }

        const chat = await live.client.getChatById(chatId);
        await chat.sendStateTyping();
        await sleep(randomBetween(3000, 7000));
        if (mediaInstance) {
          await live.client.sendMessage(chatId, mediaInstance, { caption: message });
        } else {
          await live.client.sendMessage(chatId, message);
        }

        campaign.sent++;
        campaign.processed++;
        dailySent++;
        await logOutreach(userId, biz.id, 'sent', message);
        await persistCampaign(campaign, settings);

        const isLast = campaign.processed === campaign.total;
        if (!isLast) {
          if (coffeeBreakEvery > 0 && campaign.sent > 0 && campaign.sent % coffeeBreakEvery === 0) {
            console.log(`[WA:${live.lineId}] coffee break ${coffeeBreakMinutes}dk`);
            await sleep(coffeeBreakMinutes * 60 * 1000);
          } else {
            await sleep(randomBetween(minDelaySec * 1000, maxDelaySec * 1000));
          }
        }
      } catch (err: any) {
        campaign.failed++;
        campaign.processed++;
        campaign.lastError = err.message;
        await logOutreach(userId, biz.id, 'failed', message, err.message);
        await persistCampaign(campaign, settings);
        console.error(`[WA:${live.lineId}] send failed for ${biz.name}:`, err.message);
      }
    }

    if (campaign.status === 'running') campaign.status = 'completed';
    campaign.finishedAt = Date.now();
    campaign.currentLead = undefined;
    await persistCampaign(campaign, settings);
    console.log(`[WA:${userId}] campaign done:`, campaign);
  })().catch(async (err) => {
    campaign.status = 'failed';
    campaign.lastError = err.message;
    campaign.finishedAt = Date.now();
    await persistCampaign(campaign, settings);
    console.error(`[WA:${userId}] campaign crashed:`, err);
  });

  return campaign;
}

export function stopCampaign(userId: string): CampaignState | null {
  const campaign = campaigns.get(userId);
  if (!campaign) return null;
  campaign.stopRequested = true;
  return campaign;
}

export async function getCampaign(userId: string): Promise<CampaignState | null> {
  const inMemory = campaigns.get(userId);
  if (inMemory) return inMemory;

  // Restart sonrası: son kampanyayı DB'den göster
  const { data } = await supabase
    .from('whatsapp_campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    listId: data.list_id,
    lineIds: data.line_ids || [],
    total: data.total,
    processed: data.processed,
    sent: data.sent,
    failed: data.failed,
    skipped: data.skipped,
    status: data.status,
    currentLead: data.current_lead ?? undefined,
    startedAt: new Date(data.started_at).getTime(),
    finishedAt: data.finished_at ? new Date(data.finished_at).getTime() : undefined,
    lastError: data.last_error ?? undefined,
  };
}

// Kampanya geçmişi (UI'da liste olarak gösterilebilir)
export async function listCampaigns(userId: string, limit = 20): Promise<any[]> {
  const { data, error } = await supabase
    .from('whatsapp_campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

import type { Client as WAClient } from 'whatsapp-web.js';
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

export interface CampaignState {
  id: string;
  userId: string;
  listId: string;
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
const LINES_FILE = path.join(SESSION_ROOT, '_lines.json');

// Keyed by lineId (UUID)
const sessions = new Map<string, Session>();
// One campaign per user
const campaigns = new Map<string, CampaignState & { stopRequested?: boolean }>();

function ensureRoot() {
  try { fs.mkdirSync(SESSION_ROOT, { recursive: true }); } catch {}
}

function loadLines(): Record<string, LineMeta[]> {
  try {
    ensureRoot();
    if (!fs.existsSync(LINES_FILE)) return {};
    const raw = fs.readFileSync(LINES_FILE, 'utf8');
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveLines(all: Record<string, LineMeta[]>) {
  try {
    ensureRoot();
    fs.writeFileSync(LINES_FILE, JSON.stringify(all, null, 2), 'utf8');
  } catch (err: any) {
    console.error('[WA] lines save failed:', err.message);
  }
}

function getUserLines(userId: string): LineMeta[] {
  return loadLines()[userId] || [];
}

function upsertLine(meta: LineMeta) {
  const all = loadLines();
  const arr = all[meta.userId] || [];
  const idx = arr.findIndex((l) => l.id === meta.id);
  if (idx >= 0) arr[idx] = meta;
  else arr.push(meta);
  all[meta.userId] = arr;
  saveLines(all);
}

function deleteLineMeta(userId: string, lineId: string) {
  const all = loadLines();
  const arr = (all[userId] || []).filter((l) => l.id !== lineId);
  all[userId] = arr;
  saveLines(all);
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
  const { Client, LocalAuth } = await loadWA();
  return new Client({
    authStrategy: new LocalAuth({ clientId: lineId, dataPath: SESSION_ROOT }),
    puppeteer: {
      headless: true,
      args: buildPuppeteerArgs(),
    },
  });
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
        upsertLine({
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
  const metas = getUserLines(userId);
  const meta = metas.find((l) => l.id === lineId);
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
  const meta: LineMeta = {
    id: lineId,
    userId,
    label: label?.trim() || `Hat ${getUserLines(userId).length + 1}`,
    createdAt: Date.now(),
  };
  upsertLine(meta);
  const session = await createSession(meta);
  // Start initialize in background so caller can return fast
  initLine(userId, lineId).catch((e) =>
    console.error(`[WA:${lineId}] background init error:`, e?.message)
  );
  return session;
}

export async function removeLine(userId: string, lineId: string): Promise<boolean> {
  const metas = getUserLines(userId);
  const meta = metas.find((l) => l.id === lineId);
  if (!meta) return false;
  const session = sessions.get(lineId);
  if (session) {
    try { await session.client.logout(); } catch {}
    try { await session.client.destroy(); } catch {}
    sessions.delete(lineId);
  }
  deleteLineMeta(userId, lineId);
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

export function listLines(userId: string): LineStatus[] {
  const metas = getUserLines(userId);
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

export function getLineStatus(userId: string, lineId: string): LineStatus | null {
  const metas = getUserLines(userId);
  const m = metas.find((x) => x.id === lineId);
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
  const all = loadLines();
  for (const userId of Object.keys(all)) {
    for (const meta of all[userId]) {
      try {
        await createSession(meta);
        initLine(userId, meta.id).catch(() => {});
      } catch (e: any) {
        console.error(`[WA:${meta.id}] bootstrap error:`, e?.message);
      }
    }
  }
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
}

export interface MediaAttachment {
  data: string;
  mimeType: string;
  filename: string;
}

export interface StartCampaignParams {
  userId: string;
  listId: string;
  lineId?: string;
  messageTemplate: string;
  messageTemplateNoWebsite?: string;
  minDelaySec?: number;
  maxDelaySec?: number;
  coffeeBreakEvery?: number;
  coffeeBreakMinutes?: number;
  media?: MediaAttachment;
}

export type SingleSendResult =
  | { ok: true; lineId: string }
  | { ok: false; reason: 'no_line'; hint: string }
  | { ok: false; reason: 'not_ready'; lines: LineStatus[] }
  | { ok: false; reason: 'no_phone' | 'no_whatsapp' | 'send_failed'; error?: string };

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
    const userLines = listLines(userId);
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

export async function startCampaign(params: StartCampaignParams): Promise<CampaignState> {
  const {
    userId,
    listId,
    lineId,
    messageTemplate,
    messageTemplateNoWebsite,
    minDelaySec = 60,
    maxDelaySec = 120,
    coffeeBreakEvery = 20,
    coffeeBreakMinutes = 15,
    media,
  } = params;

  let mediaInstance: InstanceType<Awaited<ReturnType<typeof loadWA>>['MessageMedia']> | null = null;
  if (media?.data && media?.mimeType) {
    const { MessageMedia } = await loadWA();
    mediaInstance = new MessageMedia(media.mimeType, media.data, media.filename || 'attachment');
  }

  let session: Session | null = null;
  if (lineId) {
    const s = sessions.get(lineId);
    if (s && s.userId === userId && s.status === 'ready') session = s;
  } else {
    session = pickReadySession(userId);
  }
  if (!session) {
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
    id: `${listId}-${Date.now()}`,
    userId,
    listId,
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

  const chosenLineId = session.lineId;

  (async () => {
    for (const biz of businesses) {
      const current = campaigns.get(userId);
      if (!current || current.stopRequested) {
        campaign.status = 'stopped';
        break;
      }

      // Her iterasyonda session'ı yeniden kontrol et (bağlantı düşebilir)
      const live = sessions.get(chosenLineId);
      if (!live || live.status !== 'ready') {
        campaign.status = 'failed';
        campaign.lastError = 'WhatsApp bağlantısı koptu';
        break;
      }

      campaign.currentLead = biz.name;
      const phone = biz.phone ? normalizePhone(biz.phone) : null;
      if (!phone) {
        campaign.skipped++;
        campaign.processed++;
        await logOutreach(userId, biz.id, 'skipped', '', 'Geçersiz veya sabit hat numarası');
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
        await logOutreach(userId, biz.id, 'sent', message);

        const isLast = campaign.processed === campaign.total;
        if (!isLast) {
          if (coffeeBreakEvery > 0 && campaign.sent > 0 && campaign.sent % coffeeBreakEvery === 0) {
            console.log(`[WA:${chosenLineId}] coffee break ${coffeeBreakMinutes}dk`);
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
        console.error(`[WA:${chosenLineId}] send failed for ${biz.name}:`, err.message);
      }
    }

    if (campaign.status === 'running') campaign.status = 'completed';
    campaign.finishedAt = Date.now();
    campaign.currentLead = undefined;
    console.log(`[WA:${userId}] campaign done:`, campaign);
  })().catch((err) => {
    campaign.status = 'failed';
    campaign.lastError = err.message;
    campaign.finishedAt = Date.now();
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

export function getCampaign(userId: string): CampaignState | null {
  return campaigns.get(userId) ?? null;
}

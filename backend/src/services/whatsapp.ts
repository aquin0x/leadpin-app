import type { Client as WAClient } from 'whatsapp-web.js';
import path from 'path';
import { supabase } from '../utils/supabase';

type Client = WAClient;

// Lazy-loaded to avoid pulling puppeteer/whatsapp-web.js into memory until actually used
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

interface Session {
  userId: string;
  client: Client;
  status: SessionStatus;
  qrDataUrl?: string;
  lastError?: string;
  campaign?: CampaignState;
  stopRequested?: boolean;
}

const SESSION_ROOT = path.resolve(process.cwd(), '.wwebjs_auth');
const sessions = new Map<string, Session>();

function buildPuppeteerArgs(): string[] {
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  const proxyHost = process.env.WHATSAPP_PROXY_HOST;
  const proxyPort = process.env.WHATSAPP_PROXY_PORT;
  if (proxyHost && proxyPort) {
    args.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
  }
  return args;
}

async function createClient(userId: string): Promise<Client> {
  const { Client, LocalAuth } = await loadWA();
  return new Client({
    authStrategy: new LocalAuth({ clientId: userId, dataPath: SESSION_ROOT }),
    puppeteer: {
      headless: true,
      args: buildPuppeteerArgs(),
    },
  });
}

export function getSession(userId: string): Session | undefined {
  return sessions.get(userId);
}

export async function getOrCreateSession(userId: string): Promise<Session> {
  let session = sessions.get(userId);
  if (session) return session;

  const client = await createClient(userId);
  session = { userId, client, status: 'disconnected' };
  sessions.set(userId, session);

  client.on('qr', async (qr) => {
    try {
      const QRCode = await loadQR();
      const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      session!.qrDataUrl = dataUrl;
      session!.status = 'qr';
      console.log(`[WA:${userId}] QR ready`);
    } catch (err: any) {
      console.error(`[WA:${userId}] QR generation failed:`, err.message);
    }
  });

  client.on('authenticated', () => {
    session!.status = 'authenticated';
    session!.qrDataUrl = undefined;
    console.log(`[WA:${userId}] authenticated`);
  });

  client.on('auth_failure', (msg) => {
    session!.status = 'auth_failure';
    session!.lastError = msg;
    console.error(`[WA:${userId}] auth_failure:`, msg);
  });

  client.on('ready', () => {
    session!.status = 'ready';
    session!.qrDataUrl = undefined;
    console.log(`[WA:${userId}] ready`);
  });

  client.on('disconnected', (reason) => {
    session!.status = 'disconnected';
    session!.lastError = String(reason);
    console.warn(`[WA:${userId}] disconnected:`, reason);
  });

  return session;
}

export async function initSession(userId: string): Promise<Session> {
  const session = await getOrCreateSession(userId);
  if (session.status === 'initializing' || session.status === 'ready') {
    return session;
  }
  session.status = 'initializing';
  session.lastError = undefined;
  try {
    await session.client.initialize();
  } catch (err: any) {
    session.status = 'disconnected';
    session.lastError = err.message;
    console.error(`[WA:${userId}] initialize failed:`, err.message);
  }
  return session;
}

export async function logoutSession(userId: string): Promise<void> {
  const session = sessions.get(userId);
  if (!session) return;
  try {
    await session.client.logout();
  } catch (err: any) {
    console.warn(`[WA:${userId}] logout error:`, err.message);
  }
  try {
    await session.client.destroy();
  } catch {}
  sessions.delete(userId);
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('90') && digits.length === 12) return digits;
  if (digits.length === 10 && digits.startsWith('5')) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith('05')) return `90${digits.slice(1)}`;
  return null;
}

// Spintax: {a|b|c} picks one at random. Nested groups supported via innermost-first expansion.
// Runs BEFORE variable substitution so variables like {name} (no pipe) are left intact.
function parseSpintax(input: string): string {
  let out = input;
  // Only match groups with at least one '|' so single-token {name} placeholders are skipped.
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
    // Turkish alias: {işletmeAdi} -> name. JS regex \w doesn't match ş/İ, so this branch
    // fires only for ascii keys; non-ascii placeholders handled below.
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
  data: string; // base64 without data: prefix
  mimeType: string;
  filename: string;
}

export interface StartCampaignParams {
  userId: string;
  listId: string;
  messageTemplate: string;
  messageTemplateNoWebsite?: string;
  minDelaySec?: number;
  maxDelaySec?: number;
  coffeeBreakEvery?: number;
  coffeeBreakMinutes?: number;
  media?: MediaAttachment;
}

export async function startCampaign(params: StartCampaignParams): Promise<CampaignState> {
  const {
    userId,
    listId,
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

  const session = sessions.get(userId);
  if (!session || session.status !== 'ready') {
    throw new Error('WhatsApp oturumu hazır değil. Önce QR ile bağlan.');
  }
  if (session.campaign && session.campaign.status === 'running') {
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

  const campaign: CampaignState = {
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
  };
  session.campaign = campaign;
  session.stopRequested = false;

  (async () => {
    for (const biz of businesses) {
      if (session.stopRequested) {
        campaign.status = 'stopped';
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
        const numberId = await session.client.getNumberId(phone);
        if (!numberId) {
          campaign.skipped++;
          campaign.processed++;
          await logOutreach(userId, biz.id, 'skipped', message, 'WhatsApp hesabı yok');
          continue;
        }

        const chat = await session.client.getChatById(chatId);
        await chat.sendStateTyping();
        await sleep(randomBetween(3000, 7000));
        if (mediaInstance) {
          await session.client.sendMessage(chatId, mediaInstance, { caption: message });
        } else {
          await session.client.sendMessage(chatId, message);
        }

        campaign.sent++;
        campaign.processed++;
        await logOutreach(userId, biz.id, 'sent', message);

        const isLast = campaign.processed === campaign.total;
        if (!isLast) {
          if (coffeeBreakEvery > 0 && campaign.sent > 0 && campaign.sent % coffeeBreakEvery === 0) {
            console.log(`[WA:${userId}] coffee break ${coffeeBreakMinutes}dk`);
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
        console.error(`[WA:${userId}] send failed for ${biz.name}:`, err.message);
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
  const session = sessions.get(userId);
  if (!session || !session.campaign) return null;
  session.stopRequested = true;
  return session.campaign;
}

export function getCampaign(userId: string): CampaignState | null {
  return sessions.get(userId)?.campaign ?? null;
}

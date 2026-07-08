import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  getBusinesses, getBusiness, updateBusiness, getStats, startScrape, getScrapeJob,
  getScrapeJobs, deleteScrapeJob, stopScrapeJob, logOutreach, clearAllData,
} from './controllers/business.controller';
import { getLists, getListById, createList, addItemsToList, removeItemFromList, deleteList } from './controllers/list.controller';
import { authMiddleware } from './middleware/auth';
import { supabase } from './utils/supabase';
import whatsappRoutes from './routes/whatsapp.routes';
import { recoverStaleScrapeJobs } from './services/scraper';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// CORS origin'leri env'den (virgülle ayrılmış) + local geliştirme varsayılanları
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
];

app.use(helmet({
  // API-only servis; CSP frontend'in işi
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '25mb' }));

// Rate limit: public short-link için sıkı, API için genel
const shortLinkLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });
app.use('/r/', shortLinkLimiter);
app.use('/api/', apiLimiter);

// Public health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Public short-link redirect: ugra.io/{shortId} -> logs the click, then 302s to landing.
// Target URL comes from SHORT_LINK_REDIRECT_URL env (shortId appended as ?lead=).
app.get('/r/:shortId', async (req, res) => {
  const { shortId } = req.params;
  try {
    const { data: biz } = await supabase
      .from('businesses')
      .select('id, short_id_clicks')
      .eq('short_id', shortId)
      .maybeSingle();

    if (biz) {
      await supabase
        .from('businesses')
        .update({
          short_id_clicks: (biz.short_id_clicks || 0) + 1,
          short_id_last_click_at: new Date().toISOString(),
        })
        .eq('id', biz.id);
    }
  } catch (e) {
    console.error('short-link click log failed:', e);
  }

  const base = process.env.SHORT_LINK_REDIRECT_URL || 'https://ugra.io';
  const sep = base.includes('?') ? '&' : '?';
  return res.redirect(302, `${base}${sep}lead=${encodeURIComponent(shortId)}`);
});

// WhatsApp outreach feed (auth) — used by the "Gönderilen Mesajlar" panel.
app.get('/api/outreach/whatsapp', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { search, limit = 50, offset = 0 } = req.query;
  try {
    // Arama varsa inner join ile SQL tarafında filtrele (sayfalama bozulmasın)
    const businessSelect = 'business:businesses' + (search ? '!inner' : '') +
      '(id, name, phone, short_id, short_id_clicks, short_id_last_click_at)';
    let query = supabase
      .from('outreach_logs')
      .select(`id, status, message_content, created_at, ${businessSelect}`, { count: 'exact' })
      .eq('type', 'whatsapp')
      .eq('user_id', userId);

    if (search) {
      const q = String(search).replace(/[%_,()]/g, ' ').trim();
      if (q) {
        query = query.or(
          `name.ilike.%${q}%,phone.ilike.%${q}%,short_id.ilike.%${q}%`,
          { referencedTable: 'businesses' }
        );
      }
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) return res.status(400).json({ message: error.message });
    return res.json({ rows: data || [], total: count });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

// Gelen kutusu (incoming WhatsApp mesajları)
app.get('/api/inbox', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { limit = 50, offset = 0 } = req.query;
  const { data, error, count } = await supabase
    .from('incoming_messages')
    .select('id, from_phone, body, received_at, business:businesses(id, name, phone, status)', { count: 'exact' })
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ rows: data || [], total: count || 0 });
});

// Mesaj şablonları CRUD
app.get('/api/templates', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ message: error.message });
  return res.json(data);
});

app.post('/api/templates', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { name, template, template_no_website } = req.body || {};
  if (!name?.trim() || !template?.trim()) {
    return res.status(400).json({ message: 'name ve template zorunlu' });
  }
  const { data, error } = await supabase
    .from('message_templates')
    .insert({ user_id: userId, name: name.trim(), template, template_no_website: template_no_website || null })
    .select()
    .single();
  if (error) return res.status(500).json({ message: error.message });
  return res.status(201).json(data);
});

app.delete('/api/templates/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { error } = await supabase
    .from('message_templates')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', userId);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ message: 'Şablon silindi' });
});

// Karaliste
app.get('/api/blacklist', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { data, error } = await supabase
    .from('blacklist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ message: error.message });
  return res.json(data);
});

app.post('/api/blacklist', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { phone, reason } = req.body || {};
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return res.status(400).json({ message: 'Geçerli bir telefon numarası gerekli' });
  const { data, error } = await supabase
    .from('blacklist')
    .upsert({ user_id: userId, phone: digits, reason: reason || 'manuel' }, { onConflict: 'user_id,phone' })
    .select()
    .single();
  if (error) return res.status(500).json({ message: error.message });
  return res.status(201).json(data);
});

app.delete('/api/blacklist/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { error } = await supabase
    .from('blacklist')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', userId);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ message: 'Karalisteden çıkarıldı' });
});

// Auth protected routes
app.get('/api/stats', authMiddleware, getStats);
app.get('/api/businesses', authMiddleware, getBusinesses);
app.get('/api/businesses/:id', authMiddleware, getBusiness);
app.patch('/api/businesses/:id', authMiddleware, updateBusiness);
app.post('/api/scrape', authMiddleware, startScrape);
app.get('/api/scrape-jobs', authMiddleware, getScrapeJobs);
app.delete('/api/scrape/:id', authMiddleware, deleteScrapeJob);
app.post('/api/scrape/:id/stop', authMiddleware, stopScrapeJob);
app.get('/api/scrape/:id', authMiddleware, getScrapeJob);
app.get('/api/scrape/:id/status', authMiddleware, getScrapeJob);
app.post('/api/outreach/whatsapp-log', authMiddleware, logOutreach);
app.post('/api/admin/clear-data', authMiddleware, clearAllData);

// WhatsApp Campaign Routes
app.use('/api/whatsapp', whatsappRoutes);

// List Management Routes
app.get('/api/lists', authMiddleware, getLists);
app.get('/api/lists/:id', authMiddleware, getListById);
app.post('/api/lists', authMiddleware, createList);
app.post('/api/lists/:listId/items', authMiddleware, addItemsToList);
app.delete('/api/lists/:listId/items/:businessId', authMiddleware, removeItemFromList);
app.delete('/api/lists/:id', authMiddleware, deleteList);

// === SSE ===
// EventSource header gönderemediği için access token'ı query-string'e koymak yerine
// kısa ömürlü, tek kullanımlık ticket kullanıyoruz (token log'lara sızmasın).
const sseTickets = new Map<string, { userId: string; expires: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [t, v] of sseTickets) {
    if (v.expires < now) sseTickets.delete(t);
  }
}, 60_000).unref();

app.post('/api/sse-ticket', authMiddleware, (req, res) => {
  const ticket = crypto.randomUUID();
  sseTickets.set(ticket, { userId: (req as any).user.id, expires: Date.now() + 60_000 });
  return res.json({ ticket });
});

app.get('/api/scrape/:id/stream', async (req, res) => {
  const { id } = req.params;
  const ticket = String(req.query.ticket || '');
  const entry = sseTickets.get(ticket);
  if (!entry || entry.expires < Date.now()) {
    return res.status(401).json({ message: 'Geçersiz veya süresi dolmuş SSE ticket' });
  }
  sseTickets.delete(ticket); // tek kullanımlık

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Encoding', 'none');
  res.flushHeaders();

  console.log(`SSE Client connected for job: ${id}`);

  // İlk durum: subscribe öncesi olan güncellemeler kaçmasın diye mevcut satırı hemen gönder
  try {
    const { data: job } = await supabase
      .from('scrape_jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', entry.userId)
      .maybeSingle();
    if (job) res.write(`data: ${JSON.stringify(job)}\n\n`);
  } catch {}

  // Proxy timeout'larına karşı heartbeat
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 25_000);

  // Listen for real-time changes in Supabase for this specific job
  const subscription = supabase
    .channel(`job-status-${id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'scrape_jobs',
        filter: `id=eq.${id}`
      },
      (payload) => {
        res.write(`data: ${JSON.stringify(payload.new)}\n\n`);
      }
    )
    .subscribe();

  req.on('close', () => {
    console.log(`SSE Client disconnected for job: ${id}`);
    clearInterval(heartbeat);
    supabase.removeChannel(subscription);
  });
});

// Global error handler — route'lardan SONRA tanımlanmalı, yoksa hiçbir hatayı yakalamaz
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    message: err.message || 'Bir iç sunucu hatası oluştu',
    error: process.env.NODE_ENV === 'development' ? String(err) : {}
  });
});

app.listen(Number(port), '0.0.0.0', async () => {
  console.log(`🚀 LeadPin API runs on port ${port}`);

  // Restart'ta yarım kalan scrape job'ları temizle
  recoverStaleScrapeJobs().catch((e) => console.error('stale job recovery failed:', e?.message));

  import('./services/whatsapp').then(({ bootstrapLines, recoverStaleCampaigns }) => {
    recoverStaleCampaigns().catch((e) => console.error('stale campaign recovery failed:', e?.message));
    bootstrapLines().catch((e) => console.error('WA bootstrap failed:', e?.message));
  });
});

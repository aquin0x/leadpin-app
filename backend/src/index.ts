import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getBusinesses, getBusiness, getStats, startScrape, getScrapeJob, getScrapeJobs, deleteScrapeJob, stopScrapeJob, logOutreach } from './controllers/business.controller';
import { getLists, getListById, createList, addItemsToList, removeItemFromList, deleteList } from './controllers/list.controller';
import { authMiddleware } from './middleware/auth';
import { supabase } from './utils/supabase';
import whatsappRoutes from './routes/whatsapp.routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '25mb' }));

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Bir iç sunucu hatası oluştu',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Public health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Auth protected routes
app.get('/api/stats', authMiddleware, getStats);
app.get('/api/businesses', authMiddleware, getBusinesses);
app.get('/api/businesses/:id', authMiddleware, getBusiness);
app.post('/api/scrape', authMiddleware, startScrape);
app.get('/api/scrape-jobs', authMiddleware, getScrapeJobs);
app.delete('/api/scrape/:id', authMiddleware, deleteScrapeJob);
app.post('/api/scrape/:id/stop', authMiddleware, stopScrapeJob);
app.get('/api/scrape/:id', authMiddleware, getScrapeJob);
app.get('/api/scrape/:id/status', authMiddleware, getScrapeJob);
app.post('/api/outreach/whatsapp-log', authMiddleware, logOutreach);
app.post('/api/admin/clear-data', authMiddleware, (req, res) => {
  const { clearAllData } = require('./controllers/business.controller');
  return clearAllData(req, res);
});

// WhatsApp Campaign Routes
app.use('/api/whatsapp', whatsappRoutes);

// List Management Routes
app.get('/api/lists', authMiddleware, getLists);
app.get('/api/lists/:id', authMiddleware, getListById);
app.post('/api/lists', authMiddleware, createList);
app.post('/api/lists/:listId/items', authMiddleware, addItemsToList);
app.delete('/api/lists/:listId/items/:businessId', authMiddleware, removeItemFromList);
app.delete('/api/lists/:id', authMiddleware, deleteList);

// SSE for Scrape Status Updates (EventSource always uses GET)
app.get('/api/scrape/:id/stream', authMiddleware, (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Encoding', 'none'); 
  res.flushHeaders();

  console.log(`SSE Client connected for job: ${id}`);

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
    supabase.removeChannel(subscription);
  });
});

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`🚀 LeadPin API runs on port ${port}`);
});

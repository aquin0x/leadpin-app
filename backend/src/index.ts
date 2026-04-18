import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getBusinesses, getBusiness, getStats, startScrape, getScrapeJob, getScrapeJobs, deleteScrapeJob, stopScrapeJob, logOutreach } from './controllers/business.controller';
import { authMiddleware } from './middleware/auth';
import { supabase } from './utils/supabase';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

app.listen(Number(port), '127.0.0.1', () => {
  console.log(`🚀 Maps Lead Engine API runs on http://127.0.0.1:${port}`);
});

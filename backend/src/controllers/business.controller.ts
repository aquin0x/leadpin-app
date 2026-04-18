import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { ScraperService } from '../services/scraper';

export const getBusinesses = async (req: Request, res: Response) => {
  const { city, category, hasEmail, hasWebsite, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabase
    .from('businesses')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (city) query = query.ilike('city', `%${city}%`);
  if (category) query = query.ilike('category', `%${category}%`);
  if (hasEmail === 'true') query = query.not('email', 'is', null);
  if (hasWebsite === 'true') query = query.not('website', 'is', null);

  const { data, error, count } = await query.range(offset, offset + Number(limit) - 1);

  if (error) return res.status(500).json({ message: error.message });

  return res.json({
    data,
    meta: {
      total: count || 0,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil((count || 0) / Number(limit))
    }
  });
};

export const getStats = async (req: Request, res: Response) => {
  // Total businesses
  const { count: total } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true });

  // With website
  const { count: withWebsite } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .not('website', 'is', null)
    .neq('website', '');

  // With phone
  const { count: withPhone } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .not('phone', 'is', null)
    .neq('phone', '');

  // Added this month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count: thisMonth } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', firstOfMonth);

  return res.json({
    total: total || 0,
    withWebsite: withWebsite || 0,
    withPhone: withPhone || 0,
    thisMonth: thisMonth || 0,
  });
};

export const startScrape = async (req: Request, res: Response) => {
  const { category, city, district, neighborhood } = req.body;

  if (!category || !city) {
    return res.status(400).json({ message: 'Kategori ve şehir zorunludur' });
  }

  // Create a job record
  const { data, error } = await supabase
    .from('scrape_jobs')
    .insert({ category, city, district, neighborhood, status: 'pending' })
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });

  // Start scraper in background
  ScraperService.startScraping({
    jobId: data.id,
    category,
    city,
    district,
    neighborhood
  });

  return res.status(202).json({ jobId: data.id, message: 'Tarama başlatıldı' });
};

export const getScrapeJob = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('scrape_jobs').select('*').eq('id', id).single();

  if (error) return res.status(404).json({ message: 'İş bulunamadı' });

  return res.json(data);
};

export const getScrapeJobs = async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('scrape_jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: error.message });

  return res.json(data);
};

export const deleteScrapeJob = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { error } = await supabase.from('scrape_jobs').delete().eq('id', id);

  if (error) return res.status(500).json({ message: error.message });

  return res.json({ message: 'İş başarıyla silindi' });
};

export const stopScrapeJob = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('scrape_jobs')
    .update({ status: 'failed', error_message: 'Kullanıcı tarafından durduruldu' })
    .eq('id', id);

  if (error) return res.status(500).json({ message: error.message });

  return res.json({ message: 'İş durduruldu' });
};

export const logOutreach = async (req: Request, res: Response) => {
  const { businessId, type, message_content } = req.body;

  const { data, error } = await supabase
    .from('outreach_logs')
    .insert({ business_id: businessId, type, message_content, status: 'sent' })
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });

  // Update business status to contacted
  await supabase.from('businesses').update({ status: 'contacted' }).eq('id', businessId);

  return res.status(201).json(data);
};

export const clearAllData = async (req: Request, res: Response) => {
  try {
    // Delete in order due to foreign keys if any (though currently simple)
    await supabase.from('outreach_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('scrape_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('businesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    return res.json({ message: 'Tüm veriler başarıyla temizlendi' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

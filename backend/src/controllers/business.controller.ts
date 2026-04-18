import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { ScraperService } from '../services/scraper';

export const getBusinesses = async (req: Request, res: Response) => {
  const { 
    city, 
    district,
    neighborhood,
    category, 
    hasEmail, 
    hasWebsite, 
    hasPhone,
    minRating,
    maxRating,
    minReviews,
    sortBy = 'created_at',
    sortOrder = 'desc',
    page = 1, 
    limit = 20 
  } = req.query;
  
  const userId = (req as any).user.id;
  console.log(`[getBusinesses] Fetching for user: ${userId}`);
  const offset = (Number(page) - 1) * Number(limit);

  let query = supabase
    .from('businesses')
    .select('*', { count: 'exact' })
    .or(`user_id.eq.${userId},user_id.is.null`);

  // Filters
  if (city) query = query.ilike('city', `%${city}%`);
  if (district) query = query.ilike('district', `%${district}%`);
  if (neighborhood) query = query.ilike('neighborhood', `%${neighborhood}%`);
  if (category) {
    const cats = String(category).split(',').map(c => c.trim()).filter(Boolean);
    if (cats.length > 0) {
      query = query.ilike('category', `%${cats[0]}%`);
    }
  }
  
  if (hasEmail === 'true') query = query.not('email', 'is', null).neq('email', '');
  if (hasWebsite === 'true') query = query.not('website', 'is', null).neq('website', '');
  if (hasPhone === 'true') query = query.not('phone', 'is', null).neq('phone', '');
  
  if (minRating) query = query.gte('rating', Number(minRating));
  if (maxRating) query = query.lte('rating', Number(maxRating));
  if (minReviews) query = query.gte('reviews_count', Number(minReviews));

  // Sorting
  query = query.order(String(sortBy), { ascending: sortOrder === 'asc' });

  const { data, error, count } = await query.range(offset, offset + Number(limit) - 1);

  if (error) {
    console.error(`[getBusinesses] Supabase Error:`, error.message);
    return res.status(500).json({ message: error.message });
  }

  console.log(`[getBusinesses] Found ${count} businesses for user ${userId}`);

  return res.json({
    data,
    total: count || 0,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil((count || 0) / Number(limit))
  });
};

export const getBusiness = async (req: Request, res: Response) => {
  const { id } = req.params;
  console.log(`Fetching business data for ID: ${id}`);

  const userId = (req as any).user.id;

  try {
    // Önce ana işletme verisini alalım
    const { data: business, error: bError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (bError || !business) {
      console.error('Supabase Business Error:', bError);
      return res.status(404).json({ message: 'İşletme bulunamadı' });
    }

    // İlişkili verileri ayrı sorgularla çekelim (daha güvenli)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('business_id', id);

    const { data: outreach_logs } = await supabase
      .from('outreach_logs')
      .select('*')
      .eq('business_id', id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return res.json({
      ...business,
      contacts: contacts || [],
      outreach_logs: outreach_logs || []
    });
  } catch (error: any) {
    console.error('Unexpected Error in getBusiness:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const getStats = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  // Total businesses
  const { count: total } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .or(`user_id.eq.${userId},user_id.is.null`);

  // With website
  const { count: withWebsite } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .or(`user_id.eq.${userId},user_id.is.null`)
    .not('website', 'is', null)
    .neq('website', '');

  // With phone
  const { count: withPhone } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .or(`user_id.eq.${userId},user_id.is.null`)
    .not('phone', 'is', null)
    .neq('phone', '');

  // Added this month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count: thisMonth } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .or(`user_id.eq.${userId},user_id.is.null`)
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

  const userId = (req as any).user.id;

  // Create a job record
  const { data, error } = await supabase
    .from('scrape_jobs')
    .insert({ category, city, district, neighborhood, status: 'pending', user_id: userId })
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });

  // Start scraper in background
  ScraperService.startScraping({
    jobId: data.id,
    userId,
    category,
    city,
    district,
    neighborhood
  });

  return res.status(202).json({ jobId: data.id, message: 'Tarama başlatıldı' });
};

export const getScrapeJob = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user.id;
  const { data, error } = await supabase.from('scrape_jobs').select('*').eq('id', id).eq('user_id', userId).single();

  if (error) return res.status(404).json({ message: 'İş bulunamadı' });

  return res.json(data);
};

export const getScrapeJobs = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { data, error } = await supabase
    .from('scrape_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: error.message });

  return res.json(data);
};

export const deleteScrapeJob = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user.id;
  const { error } = await supabase.from('scrape_jobs').delete().eq('id', id).eq('user_id', userId);

  if (error) return res.status(500).json({ message: error.message });

  return res.json({ message: 'İş başarıyla silindi' });
};

export const stopScrapeJob = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user.id;
  const { error } = await supabase
    .from('scrape_jobs')
    .update({ status: 'failed', error_message: 'Kullanıcı tarafından durduruldu' })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ message: error.message });

  return res.json({ message: 'İş durduruldu' });
};

export const logOutreach = async (req: Request, res: Response) => {
  const { businessId, type, message_content } = req.body;
  const userId = (req as any).user.id;

  const { data, error } = await supabase
    .from('outreach_logs')
    .insert({ 
      business_id: businessId, 
      type: type || 'whatsapp', 
      message_content, 
      status: 'sent', 
      user_id: userId 
    })
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });

  // Get business phone for WA link
  const { data: business } = await supabase
    .from('businesses')
    .select('phone')
    .eq('id', businessId)
    .single();

  const waLink = business?.phone 
    ? `https://api.whatsapp.com/send?phone=${business.phone.replace(/\D/g, '')}&text=${encodeURIComponent(message_content)}`
    : null;

  return res.status(201).json({ ...data, waLink });
};

export const clearAllData = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  try {
    // Delete in order due to foreign keys if any (though currently simple)
    await supabase.from('outreach_logs').delete().eq('user_id', userId);
    await supabase.from('scrape_jobs').delete().eq('user_id', userId);
    await supabase.from('businesses').delete().eq('user_id', userId);

    return res.json({ message: 'Kendi verileriniz başarıyla temizlendi' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

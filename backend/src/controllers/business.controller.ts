import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../utils/supabase';
import { ScraperService } from '../services/scraper';

// sortBy doğrudan SQL order()'a gittiği için whitelist zorunlu
const SORTABLE_COLUMNS = ['created_at', 'updated_at', 'name', 'city', 'district', 'rating', 'reviews_count', 'status'] as const;
const BUSINESS_STATUSES = ['new', 'contacted', 'replied', 'converted', 'rejected'] as const;

const businessFiltersSchema = z.object({
  city: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  neighborhood: z.string().max(100).optional(),
  category: z.string().max(300).optional(),
  status: z.enum(BUSINESS_STATUSES).optional(),
  hasEmail: z.enum(['true', 'false']).optional(),
  hasWebsite: z.enum(['true', 'false']).optional(),
  hasPhone: z.enum(['true', 'false']).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxRating: z.coerce.number().min(0).max(5).optional(),
  minReviews: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(SORTABLE_COLUMNS).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});

// ilike kalıplarına girecek değerlerden PostgREST için sorunlu karakterleri ayıkla
function sanitizeLike(s: string): string {
  return s.replace(/[%_,()]/g, ' ').trim();
}

export const getBusinesses = async (req: Request, res: Response) => {
  const parsed = businessFiltersSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Geçersiz filtre parametreleri', issues: parsed.error.issues });
  }
  const {
    city, district, neighborhood, category, status,
    hasEmail, hasWebsite, hasPhone,
    minRating, maxRating, minReviews,
    sortBy, sortOrder, page, limit,
  } = parsed.data;

  const userId = (req as any).user.id;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('businesses')
    .select('*', { count: 'exact' })
    .or(`user_id.eq.${userId},user_id.is.null`);

  // Filters
  if (city) query = query.ilike('city', `%${sanitizeLike(city)}%`);
  if (district) query = query.ilike('district', `%${sanitizeLike(district)}%`);
  if (neighborhood) query = query.ilike('neighborhood', `%${sanitizeLike(neighborhood)}%`);
  if (status) query = query.eq('status', status);
  if (category) {
    const cats = category.split(',').map((c) => sanitizeLike(c)).filter(Boolean);
    if (cats.length === 1) {
      query = query.ilike('category', `%${cats[0]}%`);
    } else if (cats.length > 1) {
      // Çoklu kategori: herhangi biriyle eşleşen kayıtlar
      query = query.or(cats.map((c) => `category.ilike.%${c}%`).join(','));
    }
  }

  if (hasEmail === 'true') query = query.not('email', 'is', null).neq('email', '');
  if (hasWebsite === 'true') query = query.not('website', 'is', null).neq('website', '');
  if (hasPhone === 'true') query = query.not('phone', 'is', null).neq('phone', '');

  if (minRating != null) query = query.gte('rating', minRating);
  if (maxRating != null) query = query.lte('rating', maxRating);
  if (minReviews != null) query = query.gte('reviews_count', minReviews);

  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error(`[getBusinesses] Supabase Error:`, error.message);
    return res.status(500).json({ message: error.message });
  }

  return res.json({
    data,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  });
};

export const getBusiness = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user.id;

  try {
    const { data: business, error: bError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (bError || !business) {
      return res.status(404).json({ message: 'İşletme bulunamadı' });
    }

    const { data: outreach_logs } = await supabase
      .from('outreach_logs')
      .select('*')
      .eq('business_id', id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data: incoming } = await supabase
      .from('incoming_messages')
      .select('id, from_phone, body, received_at')
      .eq('business_id', id)
      .eq('user_id', userId)
      .order('received_at', { ascending: false });

    return res.json({
      ...business,
      outreach_logs: outreach_logs || [],
      incoming_messages: incoming || [],
    });
  } catch (error: any) {
    console.error('Unexpected Error in getBusiness:', error);
    return res.status(500).json({ message: error.message });
  }
};

const updateBusinessSchema = z.object({
  status: z.enum(BUSINESS_STATUSES).optional(),
  notes: z.string().max(5000).nullable().optional(),
}).refine((v) => v.status !== undefined || v.notes !== undefined, {
  message: 'status veya notes alanlarından en az biri gerekli',
});

export const updateBusiness = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user.id;

  const parsed = updateBusinessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Geçersiz alanlar', issues: parsed.error.issues });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

  const { data, error } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ message: error.message });
  if (!data) return res.status(404).json({ message: 'İşletme bulunamadı' });
  return res.json(data);
};

export const getStats = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const ownFilter = `user_id.eq.${userId},user_id.is.null`;

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const countBusinesses = (mod?: (q: any) => any) => {
    let q = supabase.from('businesses').select('*', { count: 'exact', head: true }).or(ownFilter);
    if (mod) q = mod(q);
    return q;
  };

  try {
    const [
      { count: total },
      { count: withWebsite },
      { count: withPhone },
      { count: thisMonth },
      { count: contacted },
      { count: replied },
      { count: converted },
      { count: messagesSent },
      { data: clickRows },
    ] = await Promise.all([
      countBusinesses(),
      countBusinesses((q) => q.not('website', 'is', null).neq('website', '')),
      countBusinesses((q) => q.not('phone', 'is', null).neq('phone', '')),
      countBusinesses((q) => q.gte('created_at', firstOfMonth)),
      countBusinesses((q) => q.in('status', ['contacted', 'replied', 'converted'])),
      countBusinesses((q) => q.in('status', ['replied', 'converted'])),
      countBusinesses((q) => q.eq('status', 'converted')),
      supabase
        .from('outreach_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'whatsapp')
        .eq('status', 'sent'),
      supabase
        .from('businesses')
        .select('short_id_clicks')
        .or(ownFilter)
        .gt('short_id_clicks', 0),
    ]);

    const totalClicks = (clickRows || []).reduce((acc: number, r: any) => acc + (r.short_id_clicks || 0), 0);

    return res.json({
      total: total || 0,
      withWebsite: withWebsite || 0,
      withPhone: withPhone || 0,
      thisMonth: thisMonth || 0,
      // Dönüşüm hunisi: gönderim → tıklama → cevap → dönüşüm
      funnel: {
        messagesSent: messagesSent || 0,
        linkClicks: totalClicks,
        contacted: contacted || 0,
        replied: replied || 0,
        converted: converted || 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

const startScrapeSchema = z.object({
  category: z.string().min(1).max(300),
  city: z.string().min(1).max(100),
  district: z.string().max(100).optional(),
  neighborhood: z.string().max(100).optional(),
});

export const startScrape = async (req: Request, res: Response) => {
  const parsed = startScrapeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Kategori ve şehir zorunludur', issues: parsed.error.issues });
  }
  const { category, city, district, neighborhood } = parsed.data;
  const userId = (req as any).user.id;

  // Create a job record
  const { data, error } = await supabase
    .from('scrape_jobs')
    .insert({ category, city, district, neighborhood, status: 'pending', user_id: userId })
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });

  // Kuyruğa ekle (aynı anda tek Chrome; sıradakiler bekler)
  const queuePosition = ScraperService.enqueue({
    jobId: data.id,
    userId,
    category,
    city,
    district,
    neighborhood
  });

  return res.status(202).json({
    jobId: data.id,
    queuePosition,
    message: queuePosition > 0 ? `Tarama kuyruğa alındı (sırada ${queuePosition} iş var)` : 'Tarama başlatıldı',
  });
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
    .update({ status: 'stopped', error_message: 'Kullanıcı tarafından durduruldu' })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ message: error.message });

  return res.json({ message: 'İş durduruldu' });
};

const logOutreachSchema = z.object({
  businessId: z.uuid(),
  type: z.enum(['whatsapp', 'email', 'instagram']).default('whatsapp'),
  message_content: z.string().max(10000).optional(),
});

export const logOutreach = async (req: Request, res: Response) => {
  const parsed = logOutreachSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Geçersiz istek', issues: parsed.error.issues });
  }
  const { businessId, type, message_content } = parsed.data;
  const userId = (req as any).user.id;

  const { data, error } = await supabase
    .from('outreach_logs')
    .insert({
      business_id: businessId,
      type,
      message_content,
      status: 'sent',
      user_id: userId
    })
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });

  // Manuel gönderimde lead'i otomatik 'contacted' yap (yalnızca 'new' ise)
  await supabase
    .from('businesses')
    .update({ status: 'contacted' })
    .eq('id', businessId)
    .eq('user_id', userId)
    .eq('status', 'new');

  // Get business phone for WA link
  const { data: business } = await supabase
    .from('businesses')
    .select('phone')
    .eq('id', businessId)
    .single();

  const waLink = business?.phone
    ? `https://api.whatsapp.com/send?phone=${business.phone.replace(/\D/g, '')}&text=${encodeURIComponent(message_content || '')}`
    : null;

  return res.status(201).json({ ...data, waLink });
};

export const clearAllData = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  // Geri dönüşü olmayan işlem: frontend'in açık onay metni göndermesi zorunlu
  if (req.body?.confirm !== 'SİL') {
    return res.status(400).json({ message: "Onay gerekli: body içinde { confirm: 'SİL' } gönderin" });
  }

  try {
    await supabase.from('incoming_messages').delete().eq('user_id', userId);
    await supabase.from('outreach_logs').delete().eq('user_id', userId);
    await supabase.from('scrape_jobs').delete().eq('user_id', userId);
    await supabase.from('businesses').delete().eq('user_id', userId);

    return res.json({ message: 'Kendi verileriniz başarıyla temizlendi' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

-- NOT: Bu dosya sıfırdan kurulum içindir. Mevcut veritabanları için migrations/ klasörünü
-- sırayla uygulayın (001, 002, ...). Yeni tablolar için migrations/002_whatsapp_infra.sql'e bakın.

-- Businesses Table
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(),
    name TEXT NOT NULL,
    category TEXT,
    city TEXT,
    district TEXT,
    neighborhood TEXT,
    address TEXT,
    phone TEXT,
    website TEXT,
    rating DECIMAL(3,2),
    reviews_count INTEGER DEFAULT 0,
    google_maps_url TEXT,
    short_id TEXT UNIQUE,
    short_id_clicks INTEGER NOT NULL DEFAULT 0,
    short_id_last_click_at TIMESTAMP WITH TIME ZONE,
    email TEXT,
    instagram TEXT,
    facebook TEXT,
    notes TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'converted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, google_maps_url)
);

-- Scrape Jobs (For progress tracking via SSE)
CREATE TABLE IF NOT EXISTS public.scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(),
    category TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT,
    neighborhood TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stopped')),
    total_leads INTEGER DEFAULT 0,
    current_lead INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Outreach Logs
CREATE TABLE IF NOT EXISTS public.outreach_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('whatsapp', 'email', 'instagram')),
    status TEXT DEFAULT 'sent',
    message_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Lists Table
CREATE TABLE IF NOT EXISTS public.lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid() NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- List Items Table (Junction table)
CREATE TABLE IF NOT EXISTS public.list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(list_id, business_id)
);

-- Row Level Security (RLS)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

-- Policies for Businesses (Publicly accessible but only via Auth)
CREATE POLICY "Allow authenticated read businesses" ON public.businesses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert businesses" ON public.businesses FOR INSERT TO authenticated WITH CHECK (true);

-- Policies for User-Specific Tables
CREATE POLICY "Users can only see their own jobs" ON public.scrape_jobs 
    FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own logs" ON public.outreach_logs 
    FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own lists" ON public.lists 
    FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can manage items in their lists" ON public.list_items
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.lists WHERE id = list_id AND user_id = auth.uid())
    );

-- Indexes & updated_at trigger (bkz. migrations/001_sync_schema.sql)
CREATE INDEX IF NOT EXISTS businesses_user_city_idx ON public.businesses (user_id, city);
CREATE INDEX IF NOT EXISTS businesses_user_status_idx ON public.businesses (user_id, status);
CREATE INDEX IF NOT EXISTS businesses_user_created_idx ON public.businesses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outreach_logs_user_type_idx ON public.outreach_logs (user_id, type, created_at DESC);
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS phone_digits TEXT
    GENERATED ALWAYS AS (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) STORED;
CREATE INDEX IF NOT EXISTS businesses_phone_digits_idx ON public.businesses (phone_digits);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS businesses_set_updated_at ON public.businesses;
CREATE TRIGGER businesses_set_updated_at
    BEFORE UPDATE ON public.businesses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WhatsApp altyapısı, şablonlar, karaliste, gelen kutusu: migrations/002_whatsapp_infra.sql
-- (sıfırdan kurulumda o dosyayı da çalıştırın)

-- Businesses Table
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    city TEXT,
    district TEXT,
    address TEXT,
    phone TEXT,
    website TEXT,
    rating DECIMAL(3,2),
    reviews_count INTEGER DEFAULT 0,
    google_maps_url TEXT UNIQUE,
    email TEXT,
    instagram TEXT,
    facebook TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'converted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Scrape Jobs (For progress tracking via SSE)
CREATE TABLE IF NOT EXISTS public.scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    total_leads INTEGER DEFAULT 0,
    current_lead INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Outreach Logs
CREATE TABLE IF NOT EXISTS public.outreach_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('whatsapp', 'email', 'instagram')),
    status TEXT DEFAULT 'sent',
    message_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security (RLS)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and write
CREATE POLICY "Allow authenticated access" ON public.businesses FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON public.scrape_jobs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON public.outreach_logs FOR ALL TO authenticated USING (true);

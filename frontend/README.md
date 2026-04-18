# Maps Lead Engine — Frontend

Google Haritalar üzerinden işletmeleri tarayın, iletişim bilgilerini toplayın ve otomatik mesajlarla iletişime geçin.

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** TailwindCSS + shadcn/ui (dark mode default)
- **State:** TanStack Query v5 (React Query)
- **Auth:** Supabase (@supabase/ssr)
- **Icons:** lucide-react
- **Notifications:** react-hot-toast
- **Date:** date-fns (Turkish locale)

## Kurulum

### 1. Bağımlılıkları yükleyin

```bash
cd frontend
npm install
```

### 2. Ortam değişkenlerini ayarlayın

```bash
cp .env.local.example .env.local
```

`.env.local` dosyasını düzenleyin:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Backend API'yi çalıştırın

Backend Express API'nin `http://localhost:4000` adresinde çalıştığından emin olun.

### 4. Geliştirme sunucusunu başlatın

```bash
npm run dev
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde açılacaktır.

## Proje Yapısı

```
/frontend/src
├── app/
│   ├── layout.tsx              # Root layout, QueryProvider, Toaster
│   ├── page.tsx                # → /dashboard redirect
│   ├── auth/page.tsx           # Giriş / Kayıt sayfası
│   ├── dashboard/
│   │   ├── page.tsx            # Ana lead tablosu
│   │   └── loading.tsx         # Skeleton
│   └── businesses/[id]/
│       ├── page.tsx            # İşletme detay
│       └── loading.tsx         # Skeleton
├── components/
│   ├── ui/                     # shadcn/ui bileşenleri
│   ├── dashboard/
│   │   ├── StatsBar.tsx        # İstatistik kartları
│   │   ├── FilterBar.tsx       # Filtre paneli
│   │   ├── LeadTable.tsx       # Veri tablosu
│   │   ├── ScrapeModal.tsx     # Tarama modal
│   │   └── StatusBadge.tsx     # Durum etiketi
│   └── business/
│       ├── BusinessInfoCard.tsx
│       ├── ContactSection.tsx
│       ├── OutreachPanel.tsx
│       └── OutreachHistory.tsx
├── hooks/
│   ├── useBusinesses.ts        # İşletme listesi
│   ├── useBusiness.ts          # Tek işletme
│   ├── useScrapeJob.ts         # SSE job takibi
│   └── useOutreach.ts          # WhatsApp mutation
├── lib/
│   ├── api-client.ts           # Backend API client
│   ├── supabase-client.ts      # Browser Supabase
│   ├── supabase-server.ts      # Server Supabase
│   ├── query-keys.ts           # Query key factories
│   ├── message-generator.ts    # Türkçe mesaj üreteci
│   └── utils.ts                # cn(), formatPhone(), formatRating()
├── providers/
│   └── QueryProvider.tsx
├── types/
│   └── index.ts
└── middleware.ts               # Route koruması
```

## API Endpoints

Frontend aşağıdaki backend endpointlerini kullanır:

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/businesses` | İşletme listesi (filtreleme + sayfalama) |
| GET | `/api/businesses/:id` | Tek işletme detayı |
| POST | `/api/scrape` | Yeni tarama başlat |
| GET | `/api/scrape/:jobId/status` | SSE - Tarama durumu |
| POST | `/api/outreach/whatsapp-log` | WhatsApp log kaydı |

## Özellikler

- 🔍 **Google Maps Tarama** — Kategori ve şehir bazlı işletme tarama
- 📊 **Dashboard** — İstatistikler, filtreleme, sayfalı tablo
- 💬 **WhatsApp Entegrasyonu** — Otomatik Türkçe mesaj üretimi
- 🔐 **Supabase Auth** — JWT tabanlı kimlik doğrulama
- 📱 **Responsive** — Mobil uyumlu tasarım
- 🌙 **Dark Mode** — Varsayılan koyu tema

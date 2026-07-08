# 🎯 LeadPin - AI Powered Google Maps Lead Generation

[English](#english) | [Türkçe](#türkçe)

---

## English

LeadPin is a high-performance, automated lead generation platform that extracts business data from Google Maps and manages outreach sequences. It streamlines the process of finding potential B2B clients by providing detailed contact information and categorization.

### 🚀 Key Features
- **WhatsApp Automation**: Seamlessly contact leads via WhatsApp with pre-filled messages and automatic outreach tracking.
- **Bulk Outreach Support**: Optimized workflow for efficient high-volume lead contact management.
- **Smart Scraper**: Automated Google Maps data extraction using optimized Puppeteer instances.
- **Lead Management**: Organize businesses into custom lists for targeted outreach.
- **Interactive Dashboard**: Real-time statistics, filtering by city, rating, and contact availability.
- **Supabase Backend**: Fast, secure data management with real-time updates.

### 🛠 Tech Stack
- **Frontend**: Next.js 14, Tailwind CSS, Lucide Icons, Shadcn UI.
- **Backend**: Node.js, Express.
- **Database**: Supabase (PostgreSQL) & Auth.
- **Automation**: Puppeteer (Memory-optimized).

### ⚙️ Quick Start
1. Clone the repo: `git clone <repo-url>`
2. Install dependencies for both `frontend` and `backend`: `npm install`
3. Configure `.env` files (Supabase URL/Key, Port).
4. Run dev servers: `npm run dev`

---

## Türkçe

LeadPin, Google Haritalar'dan işletme verilerini çeken ve erişim süreçlerini yöneten yüksek performanslı bir otomatik lead (potansiyel müşteri) bulma platformudur. Detaylı iletişim bilgileri ve kategorizasyon sağlayarak B2B müşteri bulma sürecini kolaylaştırır.

### 🚀 Öne Çıkan Özellikler
- **WhatsApp Otomasyonu**: Hazır mesaj şablonları ve otomatik erişim takibi ile işletmelere WhatsApp üzerinden sorunsuz bir şekilde ulaşın.
- **Seri Erişim Desteği**: Yüksek hacimli müşteri adayı yönetimi için optimize edilmiş hızlı iletişim akışı.
- **Akıllı Tarayıcı**: Optimize edilmiş Puppeteer örnekleri ile otomatik Google Haritalar veri çekme.
- **Lead Yönetimi**: İşletmeleri hedefli kampanyalar için özel listeler halinde organize edin.
- **İnteraktif Panel**: Gerçek zamanlı istatistikler; şehir, puan ve iletişim bilgisine göre filtreleme.
- **Supabase Altyapısı**: Gerçek zamanlı güncellemelerle hızlı ve güvenli veri yönetimi.

### 🛠 Teknoloji Yığını
- **Frontend**: Next.js 14, Tailwind CSS, Lucide Icons, Shadcn UI.
- **Backend**: Node.js, Express.
- **Veritabanı**: Supabase (PostgreSQL) & Auth.
- **Otomasyon**: Puppeteer (Hafıza optimize edilmiş).

### ⚙️ Hızlı Başlangıç
1. Projeyi klonlayın: `git clone <repo-url>`
2. `frontend` ve `backend` klasörlerinde bağımlılıkları yükleyin: `npm install`
3. `.env` dosyalarını yapılandırın (Supabase URL/Key, Port).
4. Veritabanını hazırlayın:
   - Sıfırdan kurulum: `schema.sql` + `migrations/002_whatsapp_infra.sql` dosyalarını Supabase SQL Editor'da çalıştırın.
   - Mevcut kurulum: `migrations/` klasöründeki dosyaları sırayla (001, 002, ...) çalıştırın.
5. Geliştirici sunucularını çalıştırın: `npm run dev`

### 📬 Ek Özellikler
- **Gelen Kutusu & Otomatik Takip**: Lead WhatsApp'tan cevap verdiğinde durumu otomatik "Cevap Verdi" olur; "STOP/İPTAL" yazanlar karalisteye alınır ve bir daha aranmaz.
- **Çoklu Hat Rotasyonu**: Kampanya mesajları seçilen hatlar arasında sırayla dağıtılır.
- **Saat Penceresi & Günlük Limit**: Mesajlar yalnızca belirlenen saat aralığında gönderilir, günlük limit dolunca kampanya durur.
- **Excel Export**: Filtrelenmiş lead listesini tek tıkla `.xlsx` olarak indirin.
- **Mini-CRM**: Lead durumu (Yeni → Ulaşıldı → Cevap Verdi → Dönüştü/Reddetti), not alanı ve dönüşüm hunisi istatistikleri.

---
*Developed by DeepMind Advanced Agentic Coding for the future of B2B Lead Gen.*

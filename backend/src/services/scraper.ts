import { supabase } from '../utils/supabase';

export interface ScrapeParams {
  jobId: string;
  userId: string;
  category: string;
  city: string;
  district?: string;
  neighborhood?: string;
}

// Turkish-aware text normalization for address / neighborhood matching.
// Strips Turkish diacritics, punctuation, mahalle suffixes; collapses whitespace.
function normalizeTR(s: string): string {
  return (s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o')
    .replace(/\b(mahallesi|mahalle|mah\.?|mh\.?|mhl\.?)\b/gi, ' ')
    .replace(/[.,/\\()\[\]'"`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Common Turkish ordinal-number / word equivalences seen in neighborhood names.
// Used to expand a query so "100. yıl" matches "yüzüncü yıl" and vice versa.
const NUMBER_WORD_PAIRS: Array<[string, string]> = [
  ['100', 'yuzuncu yil'],
  ['100 yil', 'yuzuncu yil'],
  ['50', 'ellinci yil'],
  ['75', 'yetmis besinci yil'],
  ['23 nisan', '23 nisan'],
  ['29 ekim', '29 ekim'],
  ['30 agustos', '30 agustos'],
];

function neighborhoodVariants(input: string): string[] {
  const base = normalizeTR(input);
  const variants = new Set<string>([base]);
  // Strip leading "100." style prefixes and trailing "yil" noise for loose match.
  variants.add(base.replace(/\s+/g, ''));
  for (const [a, b] of NUMBER_WORD_PAIRS) {
    if (base.includes(a)) variants.add(base.replace(a, b));
    if (base.includes(b)) variants.add(base.replace(b, a));
  }
  return Array.from(variants).filter((v) => v.length >= 2);
}

export function addressMatchesNeighborhood(address: string, neighborhood: string): boolean {
  if (!address || !neighborhood) return false;
  const addr = normalizeTR(address);
  const addrNoSpace = addr.replace(/\s+/g, '');
  for (const v of neighborhoodVariants(neighborhood)) {
    if (addr.includes(v)) return true;
    if (addrNoSpace.includes(v.replace(/\s+/g, ''))) return true;
  }
  return false;
}

// 4-char id from [a-z0-9], guaranteed to contain at least one letter AND one digit.
// Rejects all-letter or all-digit draws (~24% of raw 36^4) and retries.
function generateShortId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let attempt = 0; attempt < 10; attempt++) {
    let out = '';
    for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (/[a-z]/.test(out) && /[0-9]/.test(out)) return out;
  }
  return 'a1' + alphabet[Math.floor(Math.random() * alphabet.length)] + alphabet[Math.floor(Math.random() * alphabet.length)];
}

export class ScraperService {
  static async startScraping({ jobId, userId, category, city, district, neighborhood }: ScrapeParams) {
    const { default: puppeteer } = await import('puppeteer');
    const headless = process.env.PUPPETEER_HEADLESS !== 'false';
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
    ];
    // These args stabilize headless on low-memory hosts but break a visible UI.
    const headlessOnlyArgs = [
      '--disable-gpu',
      '--no-zygote',
      '--single-process',
      '--disable-accelerated-2d-canvas',
      '--font-render-hinting=none',
    ];
    const browser = await puppeteer.launch({
      headless,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: headless ? [...baseArgs, ...headlessOnlyArgs] : baseArgs,
      defaultViewport: headless ? { width: 1280, height: 800 } : null,
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      const categories = category.split(',').map(c => c.trim()).filter(Boolean);
      const allUniqueResults = new Map<string, { name: string, mapsUrl: string }>();

      console.log(`Starting multi-category scrape for: ${categories.join(', ')}`);

      for (const cat of categories) {
        const searchQuery = `${city} ${district || ''} ${neighborhood || ''} ${cat}`;
        const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

        console.log(`Searching for: ${searchQuery}`);

        let navigated = false;
        for (let attempt = 1; attempt <= 3 && !navigated; attempt++) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            navigated = true;
          } catch (err: any) {
            const msg = err?.message || '';
            console.warn(`goto attempt ${attempt} failed: ${msg}`);
            if (/detached|Target closed|Session closed/i.test(msg) && attempt < 3) {
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
            if (attempt === 3) throw err;
          }
        }

        // Handle cookie/consent redirect (consent.google.com) before waiting for feed
        try {
          if (page.url().includes('consent.')) {
            const consentBtn = await page.$('button[aria-label*="Kabul"], button[aria-label*="Accept"], form[action*="consent"] button');
            if (consentBtn) {
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
                consentBtn.click(),
              ]);
            }
          } else {
            const consentButton = await page.$('button[aria-label*="Kabul"], button[aria-label*="Accept"]');
            if (consentButton) await consentButton.click().catch(() => {});
          }
        } catch (e) {}

        // Wait for results container explicitly
        await page.waitForSelector('div[role="feed"]', { timeout: 15000 }).catch(() => {
          console.log("Feed selector not found, might be a direct hit or slow load.");
        });

        // Scroll with role="feed" targeting
        await page.evaluate(async () => {
          const distance = 100;
          const feed = document.querySelector('div[role="feed"]');
          if (!feed) return;
          
          for(let i=0; i<20; i++) { // Scroll a bit for each category
            feed.scrollBy(0, distance * 5);
            await new Promise(r => setTimeout(r, 400));
          }
        });

        const results = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('div[role="article"]'));
          return items.map(item => {
            const name = item.querySelector('.hfpxzc')?.getAttribute('aria-label') || '';
            const mapsUrl = item.querySelector('.hfpxzc')?.getAttribute('href') || '';
            return { name, mapsUrl };
          }).filter(item => item.name && item.mapsUrl);
        });

        for (const res of results) {
          if (!allUniqueResults.has(res.mapsUrl)) {
            allUniqueResults.set(res.mapsUrl, res);
          }
        }
      }

      const results = Array.from(allUniqueResults.values());
      console.log(`Found ${results.length} total unique potential leads.`);
      
      // Update Total Leads in DB immediately so panel doesn't show 0
      await supabase.from('scrape_jobs').update({
        total_leads: results.length,
        status: 'running'
      }).eq('id', jobId);

      let current = 0;
      for (const res of results) {
        current++;
        
        // Stop check: Verify if the job still exists and is still 'running'
        try {
          const { data: jobStatus, error: statusError } = await supabase
            .from('scrape_jobs')
            .select('status')
            .eq('id', jobId)
            .single();
          
          if (statusError || !jobStatus || jobStatus.status !== 'running') {
            console.log(`Job ${jobId} stopped or changed status. Terminating scraper.`);
            return;
          }
        } catch (e) {
          return;
        }

        console.log(`[${current}/${results.length}] Extracting details for: ${res.name}`);

        // Update current lead count in DB
        await supabase.from('scrape_jobs').update({ current_lead: current }).eq('id', jobId);

        let detailedData = { phone: '', website: '', address: '', category: '', rating: 0, reviews: 0 };

        try {
          const detailPage = await browser.newPage();
          // Increase timeout significantly for long-running scrapes (potential throttling or slow network)
          await detailPage.goto(res.mapsUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await detailPage.waitForSelector('div[role="main"] h1', { timeout: 20000 }).catch(() => {});

          // Wait for the rating block to render (Google loads it async after h1)
          await detailPage.waitForFunction(() => {
            const main = document.querySelector('div[role="main"]');
            if (!main) return false;
            // Either the F7nice class exists or an aria-label with stars appears
            return !!main.querySelector('.F7nice, [role="img"][aria-label*="yıldız"], [role="img"][aria-label*="star"]');
          }, { timeout: 8000 }).catch(() => {});

          // Small random delay to avoid bot detection during long runs
          await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

          detailedData = await detailPage.evaluate(() => {
            const address = (document.querySelector('button[data-item-id="address"]') as HTMLElement)?.innerText || '';
            const phone = (document.querySelector('button[data-item-id*="phone"]') as HTMLElement)?.innerText || '';
            const website = (document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement)?.href || '';

            // Category from the subtitle area
            const categoryEl = document.querySelector('button[jsaction*="category"]') as HTMLElement;
            const category = categoryEl?.textContent || '';

            // === RATING & REVIEWS ===
            // Scope the search to the main panel only (avoids footer/nav/phone noise).
            const main = document.querySelector('div[role="main"]') || document.body;
            let rating = 0;
            let reviews = 0;

            // Strategy 1: The F7nice compound block — "4,6(627)" / "4.6 (627)"
            // This is Google Maps' current canonical rating container next to the business title.
            const nice = main.querySelector('.F7nice') as HTMLElement | null;
            if (nice) {
              const text = (nice.innerText || nice.textContent || '').replace(/\s+/g, ' ').trim();
              const m = text.match(/([1-5](?:[,\.]\d)?)\s*[\(\[]\s*([\d\.,\s]+)\s*[\)\]]/);
              if (m) {
                rating = parseFloat(m[1].replace(',', '.'));
                reviews = parseInt(m[2].replace(/[^\d]/g, ''), 10) || 0;
              }
              // Also try the aria-label children within nice
              if (!rating || !reviews) {
                const labeled = Array.from(nice.querySelectorAll<HTMLElement>('[aria-label]'));
                for (const el of labeled) {
                  const label = el.getAttribute('aria-label') || '';
                  if (!rating) {
                    const r = label.match(/([1-5][,\.]\d)/);
                    if (r && /(y[ıi]ld[ıi]z|star|puan)/i.test(label)) {
                      rating = parseFloat(r[1].replace(',', '.'));
                    }
                  }
                  if (!reviews) {
                    const rv = label.match(/([\d\.,]+)\s*(yorum|de[ğg]erlendirme|review)/i);
                    if (rv) reviews = parseInt(rv[1].replace(/[^\d]/g, ''), 10) || 0;
                  }
                }
              }
            }

            // Strategy 2: aria-labels scoped to the header area only (near h1)
            if (!rating || !reviews) {
              const h1 = main.querySelector('h1');
              const header = h1?.parentElement?.parentElement || main;
              const labeled = Array.from(header.querySelectorAll<HTMLElement>('[aria-label]'));
              for (const el of labeled) {
                const label = el.getAttribute('aria-label') || '';
                if (!rating) {
                  const r = label.match(/([1-5][,\.]\d)\s*(y[ıi]ld[ıi]z|star|puan)/i);
                  if (r) rating = parseFloat(r[1].replace(',', '.'));
                }
                if (!reviews) {
                  const rv = label.match(/([\d\.,]+)\s*(yorum|de[ğg]erlendirme|review)/i);
                  if (rv) reviews = parseInt(rv[1].replace(/[^\d]/g, ''), 10) || 0;
                }
                if (rating && reviews) break;
              }
            }

            return { address, phone, website, category, rating, reviews };
          });
          await detailPage.close();
        } catch (e) {
          console.error(`Detail extraction failed for ${res.name}`);
        }

        // === NEIGHBORHOOD VERIFICATION ===
        // Google Maps often returns "nearby" results from adjacent neighborhoods.
        // If a neighborhood is selected, we verify it exists in the address.
        if (neighborhood) {
          if (!addressMatchesNeighborhood(detailedData.address, neighborhood)) {
            console.log(`  ⚠ Skipping: ${res.name} (Address "${detailedData.address}" doesn't match neighborhood ${neighborhood})`);
            continue;
          }
        }

        // Manual Upsert: First check if it exists
        const { data: existing } = await supabase
          .from('businesses')
          .select('id')
          .eq('google_maps_url', res.mapsUrl)
          .eq('user_id', userId)
          .maybeSingle();

        const businessData = {
          name: res.name,
          category: detailedData.category || category,
          city,
          district,
          neighborhood,
          address: detailedData.address,
          phone: detailedData.phone,
          website: detailedData.website,
          google_maps_url: res.mapsUrl,
          rating: detailedData.rating,
          reviews_count: detailedData.reviews,
          user_id: userId,
          status: 'new'
        };

        let dbError;
        if (existing) {
          // Update existing — don't overwrite short_id (preserve links already shared)
          const { error } = await supabase
            .from('businesses')
            .update(businessData)
            .eq('id', existing.id);
          dbError = error;
        } else {
          // Insert new — retry on short_id unique conflict (unlikely but possible)
          let lastErr: any = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            const { error } = await supabase
              .from('businesses')
              .insert({ ...businessData, short_id: generateShortId() });
            if (!error) { lastErr = null; break; }
            lastErr = error;
            // Only retry on short_id uniqueness; otherwise bail.
            if (!/short_id/i.test(error.message || '')) break;
          }
          dbError = lastErr;
        }

        if (dbError) {
          console.error(`  ✖ DB Error for ${res.name}:`, dbError.message);
        } else {
          console.log(`  ✓ [Rating: ${detailedData.rating} | Reviews: ${detailedData.reviews}] - ${res.name} (${existing ? 'Updated' : 'Created'})`);
        }
      }

      await supabase.from('scrape_jobs').update({ status: 'completed' }).eq('id', jobId);
      console.log('Scrape job completed successfully.');

    } catch (error: any) {
      console.error('Scraping error:', error.message);
      await supabase.from('scrape_jobs').update({ 
        status: 'failed', 
        error_message: error.message 
      }).eq('id', jobId);
    } finally {
      await browser.close();
    }
  }
}

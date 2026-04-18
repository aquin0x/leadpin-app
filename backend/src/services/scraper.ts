import puppeteer from 'puppeteer';
import { supabase } from '../utils/supabase';

export interface ScrapeParams {
  jobId: string;
  category: string;
  city: string;
  district?: string;
  neighborhood?: string;
}

export class ScraperService {
  static async startScraping({ jobId, category, city, district, neighborhood }: ScrapeParams) {
    const browser = await puppeteer.launch({
      headless: "new" as any,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
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
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Handle cookie consent if visible
        try {
          const consentButton = await page.$('button[aria-label*="Kabul"], button[aria-label*="Accept"]');
          if (consentButton) await consentButton.click();
        } catch (e) {}

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
          // Increase timeout slightly for long-running scrapes (potential throttling)
          await detailPage.goto(res.mapsUrl, { waitUntil: 'networkidle2', timeout: 20000 });
          await detailPage.waitForSelector('div[role="main"]', { timeout: 10000 }).catch(() => {});
          
          // Small random delay to avoid bot detection during long runs
          await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

          detailedData = await detailPage.evaluate(() => {
            const address = (document.querySelector('button[data-item-id="address"]') as HTMLElement)?.innerText || '';
            const phone = (document.querySelector('button[data-item-id*="phone"]') as HTMLElement)?.innerText || '';
            const website = (document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement)?.href || '';
            
            // Category from the subtitle area
            const categoryEl = document.querySelector('button[jsaction*="category"]') as HTMLElement;
            const category = categoryEl?.textContent || '';

            // === RATING EXTRACTION (multiple strategies) ===
            let rating = 0;

            // Strategy 1: Look for aria-label on any element containing star rating text
            const allAriaElements = document.querySelectorAll('[aria-label]');
            for (const el of allAriaElements) {
              const label = el.getAttribute('aria-label') || '';
              // Match "4,3 yıldız" or "4.3 stars" or "4.3/5"
              const starMatch = label.match(/([\d][,.][\d])\s*(yıldız|star|stars|étoile)/i) || label.match(/([\d][,.][\d])\/5/);
              if (starMatch) {
                rating = parseFloat(starMatch[1].replace(',', '.'));
                break;
              }
            }

            // Strategy 2: Look for role="img" with star rating
            if (!rating) {
              const imgEls = document.querySelectorAll('[role="img"]');
              for (const el of imgEls) {
                const label = el.getAttribute('aria-label') || '';
                const m = label.match(/([\d][,.][\d])/);
                if (m) {
                  rating = parseFloat(m[1].replace(',', '.'));
                  break;
                }
              }
            }

            // Strategy 3: Scan visible text for rating-like patterns
            if (!rating) {
              const mainContent = document.querySelector('div[role="main"]');
              if (mainContent) {
                const spans = mainContent.querySelectorAll('span');
                for (const span of spans) {
                  const text = (span.textContent || '').trim();
                  if (/^[1-5][,\.]\d$/.test(text)) {
                    rating = parseFloat(text.replace(',', '.'));
                    break;
                  }
                }
              }
            }

            // === REVIEWS COUNT EXTRACTION ===
            let reviews = 0;

            // Strategy 1: Find text containing "yorum" keyword or numbers in parentheses
            // e.g. "1.234 yorum", "(567)", "12 değerlendirme"
            const mainContent = document.querySelector('div[role="main"]');
            if (mainContent) {
              const allText = mainContent.querySelectorAll('span, button, a');
              for (const el of allText) {
                const text = el.textContent?.trim() || '';
                
                // Match "1.234 yorum" or "1.234 değerlendirme"
                const m = text.match(/([\d\.,]+)\s*(yorum|değerlendirme)/i);
                if (m) {
                  const numStr = m[1].replace(/[^\d]/g, '');
                  if (numStr) {
                    reviews = parseInt(numStr);
                    break;
                  }
                }

                // Match "(1.234)" - often used for review counts next to stars
                const m2 = text.match(/^\(([\d\.,]+)\)$/);
                if (m2) {
                  const numStr = m2[1].replace(/[^\d]/g, '');
                  if (numStr) {
                    reviews = parseInt(numStr);
                    break;
                  }
                }
              }
            }

            // Strategy 2: Check aria-labels for "yorum" or "değerlendirme"
            if (!reviews) {
              const ariaEls = document.querySelectorAll('[aria-label*="yorum"], [aria-label*="değerlendirme"]');
              for (const el of ariaEls) {
                const label = el.getAttribute('aria-label') || '';
                const m = label.match(/([\d\.,]+)\s*(yorum|değerlendirme)/i);
                if (m) {
                  const numStr = m[1].replace(/[^\d]/g, '');
                  if (numStr) {
                    reviews = parseInt(numStr);
                    break;
                  }
                }
              }
            }

            return { address, phone, website, category, rating, reviews };
          });
          await detailPage.close();
        } catch (e) {
          console.error(`Detail extraction failed for ${res.name}`);
        }

        // Insert into DB (skip duplicates)
        const { data: existing } = await supabase
          .from('businesses')
          .select('id')
          .eq('google_maps_url', res.mapsUrl)
          .maybeSingle();

        if (!existing) {
          await supabase.from('businesses').insert({
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
            status: 'new'
          });
          console.log(`  → Saved: ${res.name} | Rating: ${detailedData.rating} | Reviews: ${detailedData.reviews} | Phone: ${detailedData.phone ? 'Yes' : 'No'}`);
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

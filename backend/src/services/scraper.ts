import puppeteer from 'puppeteer';
import { supabase } from '../utils/supabase';

export interface ScrapeParams {
  jobId: string;
  userId: string;
  category: string;
  city: string;
  district?: string;
  neighborhood?: string;
}

export class ScraperService {
  static async startScraping({ jobId, userId, category, city, district, neighborhood }: ScrapeParams) {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
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
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait for results container explicitly
        await page.waitForSelector('div[role="feed"]', { timeout: 15000 }).catch(() => {
          console.log("Feed selector not found, might be a direct hit or slow load.");
        });

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
          // Increase timeout significantly for long-running scrapes (potential throttling or slow network)
          await detailPage.goto(res.mapsUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await detailPage.waitForSelector('div[role="main"]', { timeout: 20000 }).catch(() => {});
          
          // Small random delay to avoid bot detection during long runs
          await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

          detailedData = await detailPage.evaluate(() => {
            const address = (document.querySelector('button[data-item-id="address"]') as HTMLElement)?.innerText || '';
            const phone = (document.querySelector('button[data-item-id*="phone"]') as HTMLElement)?.innerText || '';
            const website = (document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement)?.href || '';
            
            // Category from the subtitle area
            const categoryEl = document.querySelector('button[jsaction*="category"]') as HTMLElement;
            const category = categoryEl?.textContent || '';

            // === RATING & REVIEWS (Back to Basics & Smarter) ===
            let rating = 0;
            let reviews = 0;

            // Strategy 1: Targeted Search for "Rating Area"
            // Usually Google puts everything in a rating button or specialized area
            const ratingElements = Array.from(document.querySelectorAll('[aria-label*="yıldız"], [aria-label*="star"], [aria-label*="yorum"], [aria-label*="review"]'));
            
            for (const el of ratingElements) {
              const label = el.getAttribute('aria-label') || '';
              
              // Find Rating: "4,6 yıldız"
              if (!rating) {
                const rMatch = label.match(/([1-5][,\.][0-9])\s*(yıldız|star)/i);
                if (rMatch) rating = parseFloat(rMatch[1].replace(',', '.'));
              }

              // Find Reviews: "627 yorum"
              if (!reviews) {
                const revMatch = label.match(/([\d\.,]+)\s*(yorum|değerlendirme|review|reviews)/i);
                if (revMatch) {
                  reviews = parseInt(revMatch[1].replace(/[^\d]/g, ''));
                }
              }
            }

            // Strategy 2: Fallback for Reviews (Parentheses Scan - BEWARE OF PHONE)
            if (!reviews) {
              const spans = Array.from(document.querySelectorAll('span, button'));
              for (const el of spans) {
                const text = el.textContent?.trim() || '';
                const m = text.match(/^\(([\d\.,]+)\)$/); // Match "(627)" exactly
                
                if (m) {
                  // If this element is inside a phone button or looks like a phone number, SKIP IT
                  const isPhone = el.closest('[data-item-id*="phone"]') || text.includes('+') || text.length > 8;
                  if (!isPhone) {
                    reviews = parseInt(m[1].replace(/[^\d]/g, ''));
                    if (reviews > 0) break;
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

        // === NEIGHBORHOOD VERIFICATION ===
        // Google Maps often returns "nearby" results from adjacent neighborhoods.
        // If a neighborhood is selected, we verify it exists in the address.
        if (neighborhood) {
          const addr = detailedData.address.toLowerCase();
          const target = neighborhood.toLowerCase();
          // Check for exact match or basic variations like "altayçeşme mah"
          const isMatch = addr.includes(target) || 
                          addr.includes(target.replace(' mahallesi', '')) ||
                          addr.includes(target.replace(' mah.', ''));
          
          if (!isMatch) {
            console.log(`  ⚠ Skipping: ${res.name} (Address doesn't match neighborhood ${neighborhood})`);
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
          // Update existing
          const { error } = await supabase
            .from('businesses')
            .update(businessData)
            .eq('id', existing.id);
          dbError = error;
        } else {
          // Insert new
          const { error } = await supabase
            .from('businesses')
            .insert(businessData);
          dbError = error;
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

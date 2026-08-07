/**
 * Website Scraping Service
 * Scrapes dealership websites to extract information for enhanced AI context
 */

import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { pool } from '../database/connection.js';

class WebsiteScrapingService {
  constructor() {
    this.userAgent = 'DealerIQ-Bot/1.0 (Knowledge Enhancement)';
    this.timeout = 30000; // 30 seconds
    this.delayBetweenRequests = 2000; // 2 seconds
  }

  /**
   * Main scraping function for a dealership website
   */
  async scrapeDealershipWebsite(dealerId, websiteUrl) {
    console.log(`🔍 Starting scrape for dealer ${dealerId}: ${websiteUrl}`);
    
    let browser;
    const results = {
      success: false,
      dealerId,
      websiteUrl,
      scrapedAt: new Date(),
      categoriesFound: [],
      entriesStored: 0,
      errors: []
    };

    try {
      // Validate URL
      if (!websiteUrl || !this.isValidUrl(websiteUrl)) {
        throw new Error('Invalid website URL');
      }

      // Launch browser with production-ready configuration
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      };

      // For production/Render: use system Chrome if available
      if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
        // Common Chrome/Chromium paths on Linux servers
        const chromePaths = [
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          process.env.CHROME_BIN,
          process.env.PUPPETEER_EXECUTABLE_PATH
        ].filter(Boolean);

        // Try to find Chrome
        for (const chromePath of chromePaths) {
          try {
            const fs = await import('fs');
            if (fs.existsSync(chromePath)) {
              launchOptions.executablePath = chromePath;
              console.log(`✅ Using Chrome at: ${chromePath}`);
              break;
            }
          } catch (err) {
            // Continue to next path
          }
        }

        // If no Chrome found, throw helpful error
        if (!launchOptions.executablePath) {
          throw new Error(
            'Chrome/Chromium not found. Please install Chrome or set PUPPETEER_EXECUTABLE_PATH environment variable. ' +
            'For Render: Add Chrome buildpack or use puppeteer-core with custom executable.'
          );
        }
      }

      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      await page.setUserAgent(this.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to homepage
      console.log(`📄 Loading homepage: ${websiteUrl}`);
      await page.goto(websiteUrl, { 
        waitUntil: 'networkidle2',
        timeout: this.timeout 
      });

      // Get page content
      const html = await page.content();
      const $ = cheerio.load(html);

      // Extract different categories of information
      await this.extractAboutInformation($, dealerId, websiteUrl, results);
      await this.extractContactInformation($, dealerId, websiteUrl, results);
      await this.extractServices($, dealerId, websiteUrl, results);
      await this.extractHours($, dealerId, websiteUrl, results);
      await this.extractPromotions($, dealerId, websiteUrl, results);
      await this.extractSpecialPrograms($, dealerId, websiteUrl, results);
      
      // Extract profile-specific data for dealer profile updates
      results.profileData = await this.extractProfileData($, dealerId, websiteUrl);

      // Try to scrape About page if exists
      const aboutLinks = this.findAboutPageLinks($);
      if (aboutLinks.length > 0) {
        await this.delay(this.delayBetweenRequests);
        await this.scrapeAboutPage(page, $, dealerId, websiteUrl, aboutLinks[0], results);
      }

      results.success = true;
      console.log(`✅ Scraping completed for dealer ${dealerId}: ${results.entriesStored} entries stored`);

    } catch (error) {
      console.error(`❌ Scraping failed for dealer ${dealerId}:`, error.message);
      results.errors.push(error.message);
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    // Log scraping activity
    await this.logScrapingActivity(results);

    return results;
  }

  /**
   * Extract "About Us" information
   */
  async extractAboutInformation($, dealerId, sourceUrl, results) {
    try {
      const selectors = [
        'section[class*="about"]',
        'div[class*="about"]',
        '[id*="about"]',
        '.about-section',
        '#about',
        'section:contains("About Us")',
        'section:contains("Our Story")',
        'div:contains("About")'
      ];

      for (const selector of selectors) {
        const aboutText = $(selector).first().text().trim();
        if (aboutText && aboutText.length > 50 && aboutText.length < 5000) {
          await this.storeKnowledge(dealerId, 'about', 'description', aboutText, sourceUrl);
          results.categoriesFound.push('about');
          results.entriesStored++;
          console.log(`  ✓ Found about information (${aboutText.length} chars)`);
          break;
        }
      }
    } catch (error) {
      console.error('Error extracting about info:', error.message);
    }
  }

  /**
   * Extract contact information
   */
  async extractContactInformation($, dealerId, sourceUrl, results) {
    try {
      // Extract address
      const addressSelectors = [
        '[itemprop="address"]',
        '.address',
        '[class*="address"]',
        'address'
      ];

      for (const selector of addressSelectors) {
        const address = $(selector).first().text().trim();
        if (address && address.length > 10 && address.length < 200) {
          await this.storeKnowledge(dealerId, 'contact', 'address', address, sourceUrl);
          results.entriesStored++;
          break;
        }
      }

      // Extract phone numbers
      const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const pageText = $('body').text();
      const phones = pageText.match(phonePattern);
      
      if (phones && phones.length > 0) {
        const uniquePhones = [...new Set(phones)].slice(0, 3);
        await this.storeKnowledge(dealerId, 'contact', 'phone_numbers', uniquePhones.join(', '), sourceUrl);
        results.entriesStored++;
      }

      results.categoriesFound.push('contact');
      console.log(`  ✓ Found contact information`);
    } catch (error) {
      console.error('Error extracting contact info:', error.message);
    }
  }

  /**
   * Extract services offered
   */
  async extractServices($, dealerId, sourceUrl, results) {
    try {
      const services = [];
      const serviceSelectors = [
        '.service-item',
        '[class*="service"]',
        '.services-list li',
        '[id*="service"] li'
      ];

      serviceSelectors.forEach(selector => {
        $(selector).each((i, elem) => {
          const service = $(elem).text().trim();
          if (service && service.length > 5 && service.length < 200) {
            services.push(service);
          }
        });
      });

      if (services.length > 0) {
        const uniqueServices = [...new Set(services)];
        uniqueServices.forEach(async (service, index) => {
          await this.storeKnowledge(dealerId, 'services', `service_${index}`, service, sourceUrl);
          results.entriesStored++;
        });
        results.categoriesFound.push('services');
        console.log(`  ✓ Found ${uniqueServices.length} services`);
      }
    } catch (error) {
      console.error('Error extracting services:', error.message);
    }
  }

  /**
   * Extract business hours
   */
  async extractHours($, dealerId, sourceUrl, results) {
    try {
      const hoursSelectors = [
        '[class*="hours"]',
        '[id*="hours"]',
        '.business-hours',
        '[itemprop="openingHours"]'
      ];

      for (const selector of hoursSelectors) {
        const hours = $(selector).first().text().trim();
        if (hours && hours.length > 10 && hours.length < 500) {
          await this.storeKnowledge(dealerId, 'hours', 'business_hours', hours, sourceUrl);
          results.categoriesFound.push('hours');
          results.entriesStored++;
          console.log(`  ✓ Found business hours`);
          break;
        }
      }
    } catch (error) {
      console.error('Error extracting hours:', error.message);
    }
  }

  /**
   * Extract promotions and specials
   */
  async extractPromotions($, dealerId, sourceUrl, results) {
    try {
      const promotions = [];
      const promoSelectors = [
        '.promotion',
        '.special',
        '[class*="promo"]',
        '[class*="special"]',
        '.deals li'
      ];

      promoSelectors.forEach(selector => {
        $(selector).each((i, elem) => {
          const promo = $(elem).text().trim();
          if (promo && promo.length > 10 && promo.length < 500) {
            promotions.push(promo);
          }
        });
      });

      if (promotions.length > 0) {
        const uniquePromos = [...new Set(promotions)].slice(0, 10);
        uniquePromos.forEach(async (promo, index) => {
          await this.storeKnowledge(dealerId, 'promotions', `promo_${index}`, promo, sourceUrl, 0.70);
          results.entriesStored++;
        });
        results.categoriesFound.push('promotions');
        console.log(`  ✓ Found ${uniquePromos.length} promotions`);
      }
    } catch (error) {
      console.error('Error extracting promotions:', error.message);
    }
  }

  /**
   * Extract special programs (military, student, first-time buyer)
   */
  async extractSpecialPrograms($, dealerId, sourceUrl, results) {
    try {
      const pageText = $('body').text().toLowerCase();
      const programs = [];

      const programKeywords = {
        military: ['military discount', 'military program', 'veteran discount', 'active duty'],
        student: ['student discount', 'college graduate', 'student program'],
        firstTimeBuyer: ['first-time buyer', 'first time buyer', 'new buyer program'],
        senior: ['senior discount', 'senior citizen'],
        loyalty: ['loyalty program', 'repeat customer', 'return customer']
      };

      Object.keys(programKeywords).forEach(programType => {
        const keywords = programKeywords[programType];
        const found = keywords.some(keyword => pageText.includes(keyword));
        if (found) {
          programs.push(programType);
        }
      });

      if (programs.length > 0) {
        await this.storeKnowledge(dealerId, 'programs', 'special_programs', programs.join(', '), sourceUrl);
        results.categoriesFound.push('programs');
        results.entriesStored++;
        console.log(`  ✓ Found ${programs.length} special programs`);
      }
    } catch (error) {
      console.error('Error extracting programs:', error.message);
    }
  }

  /**
   * Extract profile data for dealer profile updates
   * Returns structured data that can be used to update dealer profile
   */
  async extractProfileData($, dealerId, sourceUrl) {
    console.log('  📋 Extracting profile data for dealer profile...');
    
    const profileData = {
      description: null,
      established_year: null,
      suggestions: {
        description: null,
        established_year: null
      }
    };

    try {
      // Extract business description
      const descriptionSelectors = [
        'meta[name="description"]',
        'meta[property="og:description"]',
        'section[class*="about"] p',
        'div[class*="about"] p',
        '.about-section p',
        '[id*="about"] p'
      ];

      for (const selector of descriptionSelectors) {
        let description = '';
        
        if (selector.startsWith('meta')) {
          description = $(selector).attr('content') || '';
        } else {
          // Get first few paragraphs
          const paragraphs = $(selector).slice(0, 3).map((i, el) => $(el).text().trim()).get();
          description = paragraphs.join(' ');
        }

        if (description && description.length > 50 && description.length < 1000) {
          profileData.suggestions.description = description;
          console.log(`  ✓ Found description (${description.length} chars)`);
          break;
        }
      }

      // Extract established year
      const pageText = $('body').text();
      const yearPatterns = [
        /established (?:in )?(\d{4})/i,
        /since (\d{4})/i,
        /founded (?:in )?(\d{4})/i,
        /serving (?:since|for) (\d{4})/i,
        /in business since (\d{4})/i,
        /(\d{4})[\s-]+present/i,
        /over (\d{2})\+ years/i // e.g., "over 25+ years"
      ];

      for (const pattern of yearPatterns) {
        const match = pageText.match(pattern);
        if (match) {
          let year = parseInt(match[1]);
          
          // If it's a "X+ years" pattern, calculate the year
          if (pattern.toString().includes('years')) {
            year = new Date().getFullYear() - year;
          }
          
          // Validate year (must be between 1900 and current year)
          if (year >= 1900 && year <= new Date().getFullYear()) {
            profileData.suggestions.established_year = year;
            console.log(`  ✓ Found established year: ${year}`);
            break;
          }
        }
      }

      // Look for years in business (alternative pattern)
      if (!profileData.suggestions.established_year) {
        const yearsInBusinessMatch = pageText.match(/(\d{2,3})\+?\s*years?(?:\s+(?:in business|of service|of experience|serving))?/i);
        if (yearsInBusinessMatch) {
          const yearsInBusiness = parseInt(yearsInBusinessMatch[1]);
          if (yearsInBusiness > 0 && yearsInBusiness < 200) {
            const establishedYear = new Date().getFullYear() - yearsInBusiness;
            profileData.suggestions.established_year = establishedYear;
            console.log(`  ✓ Calculated established year from years in business: ${establishedYear}`);
          }
        }
      }

    } catch (error) {
      console.error('Error extracting profile data:', error.message);
    }

    return profileData;
  }

  /**
   * Find About page links
   */
  findAboutPageLinks($) {
    const aboutLinks = [];
    $('a[href*="about"]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        aboutLinks.push(href);
      }
    });
    return aboutLinks;
  }

  /**
   * Scrape dedicated About page
   */
  async scrapeAboutPage(page, $, dealerId, baseUrl, aboutLink, results) {
    try {
      const fullUrl = this.resolveUrl(baseUrl, aboutLink);
      console.log(`  📄 Loading About page: ${fullUrl}`);
      
      await page.goto(fullUrl, { 
        waitUntil: 'networkidle2',
        timeout: this.timeout 
      });

      const html = await page.content();
      const $about = cheerio.load(html);

      // Extract more detailed about information
      const aboutText = $about('main').text().trim() || $about('body').text().trim();
      if (aboutText && aboutText.length > 100 && aboutText.length < 10000) {
        await this.storeKnowledge(dealerId, 'about', 'detailed_description', aboutText, fullUrl, 0.90);
        results.entriesStored++;
        console.log(`  ✓ Scraped detailed about page`);
      }
    } catch (error) {
      console.error('Error scraping about page:', error.message);
    }
  }

  /**
   * Store knowledge in database
   */
  async storeKnowledge(dealerId, category, dataKey, dataValue, sourceUrl, confidenceScore = 0.80) {
    try {
      const query = `
        INSERT INTO dealer_knowledge_base 
          (dealer_id, category, data_key, data_value, source_url, confidence_score, scraped_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (dealer_id, category, data_key) 
        DO UPDATE SET 
          data_value = EXCLUDED.data_value,
          source_url = EXCLUDED.source_url,
          confidence_score = EXCLUDED.confidence_score,
          scraped_at = NOW(),
          updated_at = NOW()
      `;

      await pool.query(query, [dealerId, category, dataKey, dataValue, sourceUrl, confidenceScore]);
    } catch (error) {
      console.error(`Error storing knowledge (${category}/${dataKey}):`, error.message);
    }
  }

  /**
   * Log scraping activity
   */
  async logScrapingActivity(results) {
    try {
      const logQuery = `
        INSERT INTO system_logs (log_type, log_level, message, metadata, created_at)
        VALUES ('website_scraping', $1, $2, $3, NOW())
      `;

      const logLevel = results.success ? 'info' : 'error';
      const message = results.success 
        ? `Successfully scraped ${results.entriesStored} entries from ${results.websiteUrl}`
        : `Failed to scrape ${results.websiteUrl}: ${results.errors.join(', ')}`;

      await pool.query(logQuery, [logLevel, message, JSON.stringify(results)]);
    } catch (error) {
      console.error('Error logging scraping activity:', error.message);
    }
  }

  /**
   * Utility: Validate URL
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Utility: Resolve relative URLs
   */
  resolveUrl(baseUrl, relativeUrl) {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return relativeUrl;
    }
  }

  /**
   * Utility: Delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all knowledge for a dealer
   */
  async getDealerKnowledge(dealerId) {
    try {
      const query = `
        SELECT category, data_key, data_value, confidence_score, is_verified, scraped_at
        FROM dealer_knowledge_base
        WHERE dealer_id = $1
        AND updated_at > NOW() - INTERVAL '90 days'
        ORDER BY category, data_key
      `;

      const result = await pool.query(query, [dealerId]);

      // Organize by category
      const knowledge = {};
      result.rows.forEach(row => {
        if (!knowledge[row.category]) {
          knowledge[row.category] = {};
        }
        knowledge[row.category][row.data_key] = {
          value: row.data_value,
          confidence: row.confidence_score,
          verified: row.is_verified,
          scrapedAt: row.scraped_at
        };
      });

      return knowledge;
    } catch (error) {
      console.error('Error fetching dealer knowledge:', error.message);
      return {};
    }
  }

  /**
   * Delete old knowledge (cleanup)
   */
  async cleanupOldKnowledge(daysOld = 180) {
    try {
      const query = `
        DELETE FROM dealer_knowledge_base
        WHERE updated_at < NOW() - INTERVAL '${daysOld} days'
        AND is_verified = false
      `;

      const result = await pool.query(query);
      console.log(`🧹 Cleaned up ${result.rowCount} old knowledge entries`);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up old knowledge:', error.message);
      return 0;
    }
  }
}

export default new WebsiteScrapingService();

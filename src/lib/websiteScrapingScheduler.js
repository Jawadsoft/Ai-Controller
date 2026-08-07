/**
 * Website Scraping Scheduler
 * Automatically scrapes dealership websites on a regular schedule
 */

import schedule from 'node-schedule';
import websiteScrapingService from './websiteScrapingService.js';
import { pool } from '../database/connection.js';

class WebsiteScrapingScheduler {
  constructor() {
    this.jobs = {};
    this.isRunning = false;
  }

  /**
   * Start all scheduled scraping jobs
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Website scraping scheduler is already running');
      return;
    }

    console.log('🚀 Starting website scraping scheduler...');

    // Weekly scraping - Every Sunday at 2 AM
    this.jobs.weeklyScrape = schedule.scheduleJob('0 2 * * 0', async () => {
      console.log('📅 Running weekly website scraping job...');
      await this.scrapeAllDealerWebsites();
    });

    // Monthly cleanup - First day of month at 3 AM
    this.jobs.monthlyCleanup = schedule.scheduleJob('0 3 1 * *', async () => {
      console.log('🧹 Running monthly knowledge cleanup job...');
      await websiteScrapingService.cleanupOldKnowledge(180); // 6 months
    });

    this.isRunning = true;
    console.log('✅ Website scraping scheduler started');
    console.log('  - Weekly scraping: Every Sunday at 2:00 AM');
    console.log('  - Monthly cleanup: First day of month at 3:00 AM');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Website scraping scheduler is not running');
      return;
    }

    Object.values(this.jobs).forEach(job => {
      if (job) {
        job.cancel();
      }
    });

    this.jobs = {};
    this.isRunning = false;
    console.log('🛑 Website scraping scheduler stopped');
  }

  /**
   * Scrape all dealer websites that have URLs configured
   */
  async scrapeAllDealerWebsites() {
    try {
      // Get all dealers with websites
      const query = `
        SELECT 
          d.id, 
          d.business_name, 
          d.website,
          MAX(dk.scraped_at) as last_scraped
        FROM dealers d
        LEFT JOIN dealer_knowledge_base dk ON d.id = dk.dealer_id
        WHERE d.website IS NOT NULL 
        AND d.website != ''
        AND d.status = 'active'
        GROUP BY d.id, d.business_name, d.website
        ORDER BY last_scraped ASC NULLS FIRST
      `;

      const result = await pool.query(query);
      const dealers = result.rows;

      console.log(`📋 Found ${dealers.length} dealers with websites to scrape`);

      let successCount = 0;
      let failureCount = 0;

      for (const dealer of dealers) {
        try {
          // Check if needs scraping (not scraped in last 7 days)
          const needsScraping = !dealer.last_scraped || 
            (Date.now() - new Date(dealer.last_scraped).getTime()) > 7 * 24 * 60 * 60 * 1000;

          if (!needsScraping) {
            console.log(`⏭️  Skipping ${dealer.business_name}: recently scraped`);
            continue;
          }

          console.log(`\n🔍 Scraping ${dealer.business_name} (${dealer.id})...`);
          const scrapeResult = await websiteScrapingService.scrapeDealershipWebsite(
            dealer.id, 
            dealer.website
          );

          if (scrapeResult.success) {
            successCount++;
            console.log(`✅ Successfully scraped ${dealer.business_name}: ${scrapeResult.entriesStored} entries`);
          } else {
            failureCount++;
            console.error(`❌ Failed to scrape ${dealer.business_name}:`, scrapeResult.errors);
          }

          // Wait 5 seconds between dealers to be respectful
          await this.delay(5000);

        } catch (error) {
          failureCount++;
          console.error(`❌ Error scraping ${dealer.business_name}:`, error.message);
        }
      }

      console.log(`\n📊 Scraping Summary:`);
      console.log(`  - Total dealers: ${dealers.length}`);
      console.log(`  - Successful: ${successCount}`);
      console.log(`  - Failed: ${failureCount}`);
      console.log(`  - Skipped: ${dealers.length - successCount - failureCount}`);

      // Log summary to database
      await this.logScheduledScraping(dealers.length, successCount, failureCount);

    } catch (error) {
      console.error('❌ Error in scheduled scraping:', error);
    }
  }

  /**
   * Manually trigger scraping for specific dealer
   */
  async scrapeDealer(dealerId) {
    try {
      const query = 'SELECT id, business_name, website FROM dealers WHERE id = $1';
      const result = await pool.query(query, [dealerId]);

      if (result.rows.length === 0) {
        throw new Error('Dealer not found');
      }

      const dealer = result.rows[0];

      if (!dealer.website) {
        throw new Error('Dealer does not have a website configured');
      }

      console.log(`🔍 Manually scraping ${dealer.business_name}...`);
      const scrapeResult = await websiteScrapingService.scrapeDealershipWebsite(
        dealer.id,
        dealer.website
      );

      return scrapeResult;
    } catch (error) {
      console.error('Error in manual scraping:', error);
      throw error;
    }
  }

  /**
   * Log scheduled scraping activity
   */
  async logScheduledScraping(totalDealers, successCount, failureCount) {
    try {
      const query = `
        INSERT INTO system_logs (log_type, severity, message, details, created_at)
        VALUES ('scheduled_scraping', 'info', $1, $2, NOW())
      `;

      const message = `Scheduled scraping completed: ${successCount}/${totalDealers} successful`;
      const details = JSON.stringify({
        totalDealers,
        successCount,
        failureCount,
        skippedCount: totalDealers - successCount - failureCount
      });

      await pool.query(query, [message, details]);
    } catch (error) {
      console.error('Error logging scheduled scraping:', error);
    }
  }

  /**
   * Utility: Delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Object.keys(this.jobs).length,
      jobs: Object.keys(this.jobs).map(jobName => ({
        name: jobName,
        nextInvocation: this.jobs[jobName]?.nextInvocation()
      }))
    };
  }
}

// Create singleton instance
const scheduler = new WebsiteScrapingScheduler();

// Auto-start if in production
if (process.env.NODE_ENV === 'production') {
  scheduler.start();
}

export default scheduler;

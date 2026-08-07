/**
 * Website Scraping API Routes
 * Endpoints for managing dealership website scraping and knowledge base
 */

import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import websiteScrapingService from '../lib/websiteScrapingService.js';
import { pool } from '../database/connection.js';

const router = express.Router();

/**
 * POST /api/scraping/dealers/:dealerId/scrape
 * Trigger manual scraping of a dealer's website
 */
router.post('/dealers/:dealerId/scrape', authenticateToken, requirePermission('daive_settings_management'), async (req, res) => {
  try {
    const { dealerId } = req.params;
    const { forceRescrape } = req.body;

    // Get dealer information
    const dealerQuery = await pool.query(
      'SELECT id, business_name, website FROM dealers WHERE id = $1',
      [dealerId]
    );

    if (dealerQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dealer not found'
      });
    }

    const dealer = dealerQuery.rows[0];

    if (!dealer.website) {
      return res.status(400).json({
        success: false,
        error: 'Dealer does not have a website URL configured'
      });
    }

    // Check if recently scraped (unless force rescrape)
    if (!forceRescrape) {
      const recentScrapeQuery = await pool.query(
        `SELECT MAX(scraped_at) as last_scraped 
         FROM dealer_knowledge_base 
         WHERE dealer_id = $1`,
        [dealerId]
      );

      const lastScraped = recentScrapeQuery.rows[0]?.last_scraped;
      if (lastScraped) {
        const hoursSinceLastScrape = (Date.now() - new Date(lastScraped).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastScrape < 24) {
          return res.status(429).json({
            success: false,
            error: 'Website was scraped recently. Use forceRescrape=true to override.',
            lastScraped,
            nextAllowedScrape: new Date(new Date(lastScraped).getTime() + 24 * 60 * 60 * 1000)
          });
        }
      }
    }

    // Trigger scraping
    console.log(`🚀 Starting manual scrape for dealer: ${dealer.business_name} (${dealerId})`);
    const results = await websiteScrapingService.scrapeDealershipWebsite(dealerId, dealer.website);

    res.json({
      success: results.success,
      data: {
        dealerId: results.dealerId,
        dealerName: dealer.business_name,
        websiteUrl: results.websiteUrl,
        scrapedAt: results.scrapedAt,
        categoriesFound: results.categoriesFound,
        entriesStored: results.entriesStored,
        errors: results.errors
      }
    });

  } catch (error) {
    console.error('Error triggering scraping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape website',
      message: error.message
    });
  }
});

/**
 * GET /api/scraping/dealers/:dealerId/knowledge
 * Get all scraped knowledge for a dealer
 */
router.get('/dealers/:dealerId/knowledge', authenticateToken, async (req, res) => {
  try {
    const { dealerId } = req.params;
    const { category } = req.query;

    let query = `
      SELECT 
        id,
        category,
        data_key,
        data_value,
        source_url,
        confidence_score,
        is_verified,
        scraped_at,
        updated_at
      FROM dealer_knowledge_base
      WHERE dealer_id = $1
    `;

    const params = [dealerId];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }

    query += ' ORDER BY category, data_key';

    const result = await pool.query(query, params);

    // Organize by category
    const knowledgeByCategory = {};
    result.rows.forEach(row => {
      if (!knowledgeByCategory[row.category]) {
        knowledgeByCategory[row.category] = [];
      }
      knowledgeByCategory[row.category].push({
        id: row.id,
        key: row.data_key,
        value: row.data_value,
        sourceUrl: row.source_url,
        confidence: row.confidence_score,
        verified: row.is_verified,
        scrapedAt: row.scraped_at,
        updatedAt: row.updated_at
      });
    });

    res.json({
      success: true,
      data: {
        dealerId,
        totalEntries: result.rows.length,
        categories: Object.keys(knowledgeByCategory),
        knowledge: knowledgeByCategory
      }
    });

  } catch (error) {
    console.error('Error fetching dealer knowledge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch knowledge',
      message: error.message
    });
  }
});

/**
 * PUT /api/scraping/knowledge/:knowledgeId
 * Update a specific knowledge entry (e.g., verify or edit)
 */
router.put('/knowledge/:knowledgeId', authenticateToken, requirePermission('daive_settings_management'), async (req, res) => {
  try {
    const { knowledgeId } = req.params;
    const { dataValue, isVerified, confidenceScore } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (dataValue !== undefined) {
      updates.push(`data_value = $${paramIndex++}`);
      params.push(dataValue);
    }

    if (isVerified !== undefined) {
      updates.push(`is_verified = $${paramIndex++}`);
      params.push(isVerified);
    }

    if (confidenceScore !== undefined) {
      updates.push(`confidence_score = $${paramIndex++}`);
      params.push(confidenceScore);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    params.push(knowledgeId);

    const query = `
      UPDATE dealer_knowledge_base
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge entry not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating knowledge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update knowledge',
      message: error.message
    });
  }
});

/**
 * DELETE /api/scraping/knowledge/:knowledgeId
 * Delete a specific knowledge entry
 */
router.delete('/knowledge/:knowledgeId', authenticateToken, requirePermission('daive_settings_management'), async (req, res) => {
  try {
    const { knowledgeId } = req.params;

    const result = await pool.query(
      'DELETE FROM dealer_knowledge_base WHERE id = $1 RETURNING *',
      [knowledgeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge entry not found'
      });
    }

    res.json({
      success: true,
      message: 'Knowledge entry deleted successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting knowledge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete knowledge',
      message: error.message
    });
  }
});

/**
 * GET /api/scraping/dealers/:dealerId/summary
 * Get summary of scraped knowledge for a dealer
 */
router.get('/dealers/:dealerId/summary', authenticateToken, async (req, res) => {
  try {
    const { dealerId } = req.params;

    const query = `
      SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT category) as categories_count,
        MAX(scraped_at) as last_scraped,
        COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_entries,
        AVG(confidence_score) as avg_confidence
      FROM dealer_knowledge_base
      WHERE dealer_id = $1
    `;

    const result = await pool.query(query, [dealerId]);
    const summary = result.rows[0];

    // Get category breakdown
    const categoryQuery = `
      SELECT 
        category,
        COUNT(*) as entry_count
      FROM dealer_knowledge_base
      WHERE dealer_id = $1
      GROUP BY category
      ORDER BY entry_count DESC
    `;

    const categoryResult = await pool.query(categoryQuery, [dealerId]);

    res.json({
      success: true,
      data: {
        dealerId,
        summary: {
          totalEntries: parseInt(summary.total_entries),
          categoriesCount: parseInt(summary.categories_count),
          lastScraped: summary.last_scraped,
          verifiedEntries: parseInt(summary.verified_entries),
          avgConfidence: parseFloat(summary.avg_confidence).toFixed(2)
        },
        categoryBreakdown: categoryResult.rows
      }
    });

  } catch (error) {
    console.error('Error fetching knowledge summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch summary',
      message: error.message
    });
  }
});

/**
 * POST /api/scraping/cleanup
 * Clean up old scraped knowledge
 */
router.post('/cleanup', authenticateToken, requirePermission('daive_settings_management'), async (req, res) => {
  try {
    const { daysOld = 180 } = req.body;

    const deletedCount = await websiteScrapingService.cleanupOldKnowledge(daysOld);

    res.json({
      success: true,
      data: {
        deletedCount,
        daysOld
      }
    });

  } catch (error) {
    console.error('Error cleaning up knowledge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup knowledge',
      message: error.message
    });
  }
});

/**
 * POST /api/scraping/dealers/:dealerId/apply-profile-updates
 * Apply scraped profile data to dealer profile
 */
router.post('/dealers/:dealerId/apply-profile-updates', authenticateToken, requirePermission('daive_settings_management'), async (req, res) => {
  try {
    const { dealerId } = req.params;
    const { description, established_year } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (description !== undefined && description !== null) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (established_year !== undefined && established_year !== null) {
      updates.push(`established_year = $${paramIndex++}`);
      values.push(established_year);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(dealerId);

    const query = `
      UPDATE dealers
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, business_name, description, established_year
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dealer not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error applying profile updates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply profile updates',
      message: error.message
    });
  }
});

export default router;

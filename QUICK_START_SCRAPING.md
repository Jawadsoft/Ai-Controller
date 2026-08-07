# Quick Start: Website Scraping Setup

## 5-Minute Setup

### 1. Install Dependencies (1 min)
```bash
npm install puppeteer cheerio
```

### 2. Run Migration (1 min)
```bash
node run-knowledge-base-migration.js
```

### 3. Register Routes (2 min)

Add to `src/server.js`:

```javascript
// Import at top
import websiteScrapingRoutes from './routes/websiteScraping.js';
import websiteScrapingScheduler from './lib/websiteScrapingScheduler.js';

// Register routes (after other routes)
app.use('/api/scraping', websiteScrapingRoutes);

// Start scheduler (optional, for automatic scraping)
if (process.env.NODE_ENV === 'production') {
  websiteScrapingScheduler.start();
}
```

### 4. Test It (1 min)

**Scrape a dealer's website:**
```bash
curl -X POST http://localhost:5000/api/scraping/dealers/YOUR_DEALER_ID/scrape \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"forceRescrape": true}'
```

**View scraped knowledge:**
```bash
curl http://localhost:5000/api/scraping/dealers/YOUR_DEALER_ID/knowledge \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## What You Get

### AI Will Now Know:
- ✅ Dealership history and background
- ✅ Services offered (financing, service dept, etc.)
- ✅ Special programs (military, student, first-time buyer)
- ✅ Current promotions
- ✅ Business hours
- ✅ Additional contact information

### Example AI Response Before:
> "I can help you with vehicle information."

### Example AI Response After:
> "We've been serving the community for over 25 years! We offer financing with competitive rates, a full-service maintenance department, and special programs for military personnel and first-time buyers. Would you like to know more about any of these services?"

## Automatic Features

Once running, the system will:
- 🔄 Auto-scrape every Sunday at 2 AM
- 🧹 Auto-cleanup old data monthly
- 📊 Log all activity
- ⚡ Enhance every AI conversation

## Files Created

```
✅ Database:
   - dealer_knowledge_base table
   - dealer_knowledge_summary view

✅ Services:
   - src/lib/websiteScrapingService.js
   - src/lib/websiteScrapingScheduler.js

✅ API Routes:
   - src/routes/websiteScraping.js

✅ Integration:
   - Enhanced daivecrewai.js (getDealerKnowledgeBase method)

✅ Documentation:
   - WEBSITE_SCRAPING_SETUP.md (full guide)
   - QUICK_START_SCRAPING.md (this file)

✅ Scripts:
   - run-knowledge-base-migration.js
```

## Common Commands

```bash
# Manual scrape
POST /api/scraping/dealers/:id/scrape

# View knowledge
GET /api/scraping/dealers/:id/knowledge

# View summary
GET /api/scraping/dealers/:id/summary

# Update entry
PUT /api/scraping/knowledge/:id

# Delete entry
DELETE /api/scraping/knowledge/:id

# Cleanup old data
POST /api/scraping/cleanup
```

## Requirements

- ✅ Node.js 16+
- ✅ PostgreSQL database
- ✅ Valid dealership website URLs
- ✅ `daive_settings_management` permission for admins

## That's It!

Your AI is now enhanced with real dealership knowledge from websites. 🎉

For detailed information, see [WEBSITE_SCRAPING_SETUP.md](./WEBSITE_SCRAPING_SETUP.md)

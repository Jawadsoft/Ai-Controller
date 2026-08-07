# Dealership Website Scraping & Knowledge Base System

## Overview

This system automatically scrapes dealership websites to extract information and enhance DAIVE AI's contextual knowledge. The AI can now answer questions about dealership history, services, programs, and promotions based on real website data.

## Features

✅ **Automatic Website Scraping**
- Scrapes dealership websites for business information
- Extracts about/history, services, hours, promotions, and special programs
- Runs on a weekly schedule automatically

✅ **Knowledge Base Storage**
- Stores scraped information in organized categories
- Confidence scoring for data quality
- Manual verification support
- Automatic cleanup of outdated data

✅ **AI Integration**
- Seamlessly integrates with DAIVE conversation system
- Contextual knowledge available in all AI responses
- Natural language formatting

✅ **API Management**
- Manual scraping triggers
- Knowledge viewing and editing
- Summary statistics

## Installation

### 1. Install Dependencies

```bash
npm install puppeteer cheerio
```

### 2. Run Database Migration

```bash
node run-knowledge-base-migration.js
```

This creates:
- `dealer_knowledge_base` table
- `dealer_knowledge_summary` view
- Necessary indexes and triggers

### 3. Register API Routes

In `src/server.js`, add the website scraping routes:

```javascript
import websiteScrapingRoutes from './routes/websiteScraping.js';

// Add after other route registrations
app.use('/api/scraping', websiteScrapingRoutes);
```

### 4. Import Scraping Service (Optional)

If you want to use the scheduler, import it in `src/server.js`:

```javascript
import websiteScrapingScheduler from './lib/websiteScrapingScheduler.js';

// Start scheduler in production
if (process.env.NODE_ENV === 'production') {
  websiteScrapingScheduler.start();
}
```

## Usage

### Manual Scraping

**Trigger scraping for a specific dealer:**

```bash
POST /api/scraping/dealers/:dealerId/scrape
Authorization: Bearer <token>

{
  "forceRescrape": false  // Set to true to override 24-hour limit
}
```

Response:
```json
{
  "success": true,
  "data": {
    "dealerId": "uuid",
    "dealerName": "Example Motors",
    "websiteUrl": "https://example-motors.com",
    "scrapedAt": "2026-08-07T06:00:00Z",
    "categoriesFound": ["about", "services", "hours", "programs"],
    "entriesStored": 15,
    "errors": []
  }
}
```

### View Knowledge

**Get all knowledge for a dealer:**

```bash
GET /api/scraping/dealers/:dealerId/knowledge
Authorization: Bearer <token>
```

**Get knowledge by category:**

```bash
GET /api/scraping/dealers/:dealerId/knowledge?category=services
```

### View Summary

```bash
GET /api/scraping/dealers/:dealerId/summary
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "dealerId": "uuid",
    "summary": {
      "totalEntries": 15,
      "categoriesCount": 5,
      "lastScraped": "2026-08-07T02:00:00Z",
      "verifiedEntries": 3,
      "avgConfidence": "0.82"
    },
    "categoryBreakdown": [
      { "category": "services", "entry_count": 5 },
      { "category": "about", "entry_count": 2 },
      { "category": "hours", "entry_count": 1 },
      { "category": "programs", "entry_count": 1 },
      { "category": "promotions", "entry_count": 6 }
    ]
  }
}
```

### Update Knowledge Entry

```bash
PUT /api/scraping/knowledge/:knowledgeId
Authorization: Bearer <token>

{
  "dataValue": "Updated value",
  "isVerified": true,
  "confidenceScore": 1.0
}
```

### Delete Knowledge Entry

```bash
DELETE /api/scraping/knowledge/:knowledgeId
Authorization: Bearer <token>
```

## Automatic Scheduling

The scheduler runs automatically in production:

- **Weekly Scraping**: Every Sunday at 2:00 AM
  - Scrapes all dealer websites that haven't been updated in 7+ days
  - 5-second delay between dealers (respectful scraping)
  
- **Monthly Cleanup**: 1st day of each month at 3:00 AM
  - Removes unverified entries older than 180 days
  - Keeps verified entries indefinitely

### Manual Scheduler Control

```javascript
import websiteScrapingScheduler from './lib/websiteScrapingScheduler.js';

// Start scheduler
websiteScrapingScheduler.start();

// Stop scheduler
websiteScrapingScheduler.stop();

// Get status
const status = websiteScrapingScheduler.getStatus();
console.log(status);

// Manually scrape a specific dealer
await websiteScrapingScheduler.scrapeDealer(dealerId);
```

## How It Works

### 1. Website Scraping Process

```
1. Launch headless browser (Puppeteer)
2. Navigate to dealership website
3. Extract HTML content
4. Parse with Cheerio
5. Apply category-specific selectors
6. Store in database with confidence scores
7. Close browser
```

### 2. Information Extracted

| Category | Examples |
|----------|----------|
| **About** | History, mission, years in business |
| **Services** | Financing, service department, parts |
| **Programs** | Military, student, first-time buyer discounts |
| **Hours** | Business hours, service hours |
| **Promotions** | Current sales, special offers |
| **Contact** | Address, phone numbers |

### 3. AI Integration

When DAIVE builds a system prompt:
1. Fetches knowledge for the dealer
2. Formats into natural language
3. Appends to system prompt
4. AI uses knowledge in responses

Example prompt addition:
```
DEALERSHIP KNOWLEDGE BASE (from website):

ABOUT OUR DEALERSHIP:
We've been serving the community for over 25 years...

SERVICES WE OFFER:
- Financing with competitive rates
- Full-service maintenance department
- Parts and accessories
- Trade-in appraisals

SPECIAL PROGRAMS AVAILABLE:
- Military Discount Program
- College Graduate Program
- First Time Buyer Program

USE THIS KNOWLEDGE: When customers ask about our dealership...
```

## Database Schema

### dealer_knowledge_base Table

```sql
- id: UUID (Primary Key)
- dealer_id: UUID (Foreign Key -> dealers)
- category: VARCHAR(50) -- 'about', 'services', 'hours', etc.
- data_key: VARCHAR(100)
- data_value: TEXT
- scraped_at: TIMESTAMP
- source_url: TEXT
- confidence_score: DECIMAL(3,2) -- 0.00 to 1.00
- is_verified: BOOLEAN
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Indexes

- `idx_dealer_knowledge_dealer` on dealer_id
- `idx_dealer_knowledge_category` on (dealer_id, category)
- `idx_dealer_knowledge_updated` on updated_at
- Unique constraint on (dealer_id, category, data_key)

## Best Practices

### 1. Ethical Scraping
- ✅ Only scrape your client dealerships' websites
- ✅ Respect robots.txt
- ✅ Use 2-5 second delays between requests
- ✅ Identify your bot with User-Agent
- ✅ Scrape during off-peak hours (2-4 AM)

### 2. Data Quality
- ✅ Review scraped data before marking as verified
- ✅ Set confidence scores appropriately
- ✅ Update manually when website changes structure
- ✅ Clean up outdated promotions regularly

### 3. Performance
- ✅ Don't scrape more than once per 24 hours
- ✅ Use the force rescrape flag sparingly
- ✅ Monitor browser resource usage
- ✅ Keep scraped text under 5000 chars per entry

### 4. Monitoring
- ✅ Check system_logs for scraping activity
- ✅ Review error messages
- ✅ Verify AI is using the knowledge
- ✅ Update selectors if scraping fails

## Troubleshooting

### Issue: Puppeteer fails to launch

**Solution:**
```bash
# Install dependencies
npm install puppeteer

# On Linux, install Chrome dependencies:
sudo apt-get install -y chromium-browser
```

### Issue: No data scraped

**Possible causes:**
- Website structure doesn't match selectors
- Website requires JavaScript rendering
- Website blocks automated access
- Invalid website URL

**Solution:**
- Inspect the website manually
- Update selectors in `websiteScrapingService.js`
- Check browser console logs
- Verify URL in dealers table

### Issue: AI not using knowledge

**Check:**
1. Knowledge exists in database
2. `dealerId` is passed correctly
3. Knowledge is not older than 90 days
4. Confidence score >= 0.75
5. Check console logs for knowledge loading

### Issue: Scraping too slow

**Solutions:**
- Reduce timeout values
- Skip certain selectors
- Use faster CSS selectors
- Increase parallelization

## Configuration

### Environment Variables

```bash
# Optional: Custom timeout (default: 30000ms)
SCRAPING_TIMEOUT=30000

# Optional: Delay between requests (default: 2000ms)
SCRAPING_DELAY=2000

# Optional: Enable/disable scheduler
ENABLE_SCRAPING_SCHEDULER=true
```

### Customizing Selectors

Edit `src/lib/websiteScrapingService.js`:

```javascript
// Add your custom selectors
const customSelectors = [
  '.your-custom-class',
  '#your-custom-id',
  '[data-your-attribute]'
];
```

## Testing

### Test Single Dealer

```javascript
import websiteScrapingService from './src/lib/websiteScrapingService.js';

const result = await websiteScrapingService.scrapeDealershipWebsite(
  'dealer-uuid',
  'https://dealership-website.com'
);

console.log(result);
```

### Test Knowledge Retrieval

```javascript
import { db } from './src/database/db.js';

const query = 'SELECT * FROM dealer_knowledge_base WHERE dealer_id = $1';
const result = await db.query(query, ['dealer-uuid']);
console.log(result.rows);
```

## API Permissions

Required permissions:
- **Scraping trigger**: `daive_settings_management`
- **View knowledge**: Authenticated user
- **Edit knowledge**: `daive_settings_management`
- **Delete knowledge**: `daive_settings_management`

## Future Enhancements

- [ ] AI-powered content extraction (use LLM to parse unstructured text)
- [ ] Image extraction (logo, photos)
- [ ] Social media integration
- [ ] Customer review aggregation
- [ ] Competitive analysis
- [ ] Real-time inventory scraping
- [ ] Multi-language support
- [ ] Website change detection alerts

## Support

For issues or questions:
1. Check logs in `system_logs` table
2. Review scraping results in `dealer_knowledge_base`
3. Test selectors manually with Chrome DevTools
4. Adjust confidence thresholds if needed

## License

Internal use only - Part of DealerIQ system

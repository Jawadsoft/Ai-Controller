# Scraping Service - Required Database Migrations

## 📋 Migrations Needed

The scraping service requires **2 database migrations** to be run on your production server.

---

## Migration 1: Dealer Knowledge Base

### What it creates:
- ✅ `dealer_knowledge_base` table - Stores all scraped information
- ✅ `dealer_knowledge_summary` view - Aggregated statistics

### Files:
- **SQL**: `src/database/dealer-knowledge-base-migration.sql`
- **Runner**: `run-knowledge-base-migration.js`

### Run locally:
```bash
node run-knowledge-base-migration.js
```

### Run on Render:
```bash
# Option 1: Using Render Shell
node run-knowledge-base-migration.js

# Option 2: Using npm script (add to package.json first)
npm run migrate:knowledge
```

### What it does:
```sql
-- Creates table to store scraped data
CREATE TABLE dealer_knowledge_base (
  id SERIAL PRIMARY KEY,
  dealer_id UUID NOT NULL,
  category VARCHAR(50),        -- 'about', 'services', 'hours', etc.
  data_key VARCHAR(100),       -- Specific key within category
  data_value TEXT,             -- The actual scraped content
  scraped_at TIMESTAMP,
  source_url TEXT,
  confidence_score DECIMAL,
  is_verified BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Creates view for summary statistics
CREATE VIEW dealer_knowledge_summary AS
  SELECT 
    dealer_id,
    COUNT(*) as total_entries,
    COUNT(DISTINCT category) as categories_count,
    COUNT(*) FILTER (WHERE is_verified) as verified_entries,
    AVG(confidence_score) as avg_confidence,
    MAX(scraped_at) as last_scraped
  FROM dealer_knowledge_base
  GROUP BY dealer_id;
```

---

## Migration 2: System Logs

### What it creates:
- ✅ `system_logs` table - Logs scraping activity and errors

### Files:
- **SQL**: `src/database/migrations/create-system-logs.sql`
- **Runner**: `run-system-logs-migration.js`

### Run locally:
```bash
node run-system-logs-migration.js
```

### Run on Render:
```bash
# Option 1: Using Render Shell
node run-system-logs-migration.js

# Option 2: Using npm script (add to package.json first)
npm run migrate:system-logs
```

### What it does:
```sql
-- Creates table for logging
CREATE TABLE system_logs (
  id SERIAL PRIMARY KEY,
  log_type VARCHAR(50),        -- 'scraping', 'import', 'error'
  severity VARCHAR(20),        -- 'info', 'warning', 'error'
  message TEXT,
  details JSONB,
  user_id UUID,
  dealer_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP
);
```

---

## 🚀 Quick Run All Migrations

### On Local Development:
```bash
# Run both migrations
node run-knowledge-base-migration.js
node run-system-logs-migration.js
```

### On Render Production:

#### Option 1: Manual via Render Shell
1. Go to Render Dashboard
2. Click your service
3. Click **"Shell"** tab
4. Run:
```bash
cd /opt/render/project/src
node run-knowledge-base-migration.js
node run-system-logs-migration.js
```

#### Option 2: Add to package.json scripts
```json
{
  "scripts": {
    "migrate:all": "node run-knowledge-base-migration.js && node run-system-logs-migration.js",
    "migrate:knowledge": "node run-knowledge-base-migration.js",
    "migrate:system-logs": "node run-system-logs-migration.js"
  }
}
```

Then run:
```bash
npm run migrate:all
```

#### Option 3: Via database connection
```bash
# Connect to your Render database
psql $DATABASE_URL

# Run migrations manually
\i src/database/dealer-knowledge-base-migration.sql
\i src/database/migrations/create-system-logs.sql
```

---

## ✅ Verification

### Check if migrations ran successfully:

```sql
-- Check dealer_knowledge_base table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'dealer_knowledge_base'
);

-- Check dealer_knowledge_summary view exists
SELECT EXISTS (
  SELECT FROM information_schema.views 
  WHERE table_name = 'dealer_knowledge_summary'
);

-- Check system_logs table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'system_logs'
);

-- Should all return: true
```

### Or use the migration runners:
Both migration scripts automatically verify the tables after creation.

---

## 📊 Expected Output

### Migration 1 Output:
```
🚀 Starting Dealer Knowledge Base Migration...

✅ Dealer Knowledge Base Migration completed successfully!

📊 Table structure:
─────────────────────────────────────────
   id                   integer
   dealer_id            uuid
   category             character varying
   data_key             character varying
   data_value           text
   scraped_at           timestamp
   ...

📊 View created: dealer_knowledge_summary

🎉 Dealer Knowledge Base is ready!
```

### Migration 2 Output:
```
🚀 Starting system_logs table migration...

✅ system_logs table created successfully!

📊 Table structure:
─────────────────────────────────────────
   id                   integer
   log_type             character varying
   severity             character varying
   message              text
   details              jsonb
   ...

🎉 Migration completed successfully!
```

---

## 🔍 What Each Table Is Used For

### `dealer_knowledge_base`
Used to store all scraped information:
- Business descriptions
- Service offerings
- Operating hours
- Promotions and deals
- Special programs
- Contact information

**Example row**:
```json
{
  "dealer_id": "uuid",
  "category": "about",
  "data_key": "business_description",
  "data_value": "Family-owned dealership since 1995...",
  "scraped_at": "2026-08-07T10:00:00Z",
  "source_url": "https://example.com",
  "confidence_score": 0.95,
  "is_verified": false
}
```

### `dealer_knowledge_summary`
View for quick statistics:
```sql
SELECT * FROM dealer_knowledge_summary WHERE dealer_id = 'uuid';

-- Returns:
{
  "total_entries": 15,
  "categories_count": 5,
  "verified_entries": 10,
  "avg_confidence": 0.87,
  "last_scraped": "2026-08-07T10:00:00Z"
}
```

### `system_logs`
Logs all scraping activity:
- When scraping started
- Success/failure status
- Errors encountered
- Number of entries extracted
- Time taken

**Example row**:
```json
{
  "log_type": "scraping",
  "severity": "info",
  "message": "Successfully scraped dealer website",
  "details": {
    "dealer_id": "uuid",
    "entries_stored": 15,
    "duration_ms": 12500,
    "categories": ["about", "services"]
  },
  "created_at": "2026-08-07T10:00:00Z"
}
```

---

## ⚠️ Important Notes

### 1. Run Migrations Before Scraping
The scraping service **will fail** if these tables don't exist:
```
❌ relation "dealer_knowledge_base" does not exist
❌ relation "system_logs" does not exist
```

### 2. Safe to Re-run
Both migrations use `IF NOT EXISTS` clauses, so they're safe to run multiple times.

### 3. No Data Loss
If tables already exist, re-running migrations won't delete existing data.

### 4. Order Doesn't Matter
You can run these migrations in any order.

---

## 🐛 Troubleshooting

### Issue: Permission denied

**Solution**: Ensure your database user has CREATE TABLE permissions:
```sql
GRANT CREATE ON DATABASE your_database TO your_user;
```

### Issue: Connection refused

**Solution**: Check your DATABASE_URL environment variable:
```bash
echo $DATABASE_URL
# Should output: postgresql://user:pass@host:port/database
```

### Issue: Migration hangs

**Solution**: 
1. Check database connection
2. Verify no locks on tables
3. Try running SQL manually via psql

---

## 📝 Summary Checklist

Before scraping will work, ensure:

- [ ] `dealer_knowledge_base` table created
- [ ] `dealer_knowledge_summary` view created
- [ ] `system_logs` table created
- [ ] All indexes created
- [ ] Migrations verified with SELECT queries
- [ ] No errors in migration output

---

## 🚀 Quick Start Commands

### Complete setup in 3 commands:

```bash
# 1. Run migrations locally (for development)
node run-knowledge-base-migration.js
node run-system-logs-migration.js

# 2. Commit migration runners
git add run-*.js src/database/**/*.sql
git commit -m "Add scraping database migrations"
git push

# 3. Run on Render (in Render Shell or add to build script)
node run-knowledge-base-migration.js && node run-system-logs-migration.js
```

---

## ✅ Success Indicators

You'll know migrations succeeded when:

1. ✅ No database errors in scraping logs
2. ✅ Knowledge appears in DAIVE settings
3. ✅ Profile auto-updates work
4. ✅ Scraping endpoint returns success
5. ✅ System logs show activity

---

**Both migrations are required for the scraping service to work!**

Run them in any order, and you're ready to scrape! 🎉

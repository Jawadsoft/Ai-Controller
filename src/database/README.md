# Database Migrations for DealerIQ

This directory contains database migration files to set up the complete DealerIQ database schema.

## Migration Order

**IMPORTANT**: Run migrations in the correct order to avoid dependency issues.

### ⚠️ CRITICAL: Run These 3 Migrations in This Exact Order:

#### 1️⃣ Crew AI Schema (First - No Dependencies)
```bash
cd src/database
node run-crew-ai-migration.js
```
**File:** `src/database/crew-ai-schema.sql`  
**Runner:** `src/database/run-crew-ai-migration.js`

#### 2️⃣ Main Schema (Second - Requires Crew AI)
```bash
cd src/database
node run-main-schema-migration.js
```
**File:** `src/database/main-schema-migration.sql`  
**Runner:** `src/database/run-main-schema-migration.js`

#### 3️⃣ Finance Schema (Third - Requires Main Schema) ⭐ NEW
```bash
cd src/database
node run-finance-schema-migration.js
```
**File:** `src/database/finance-schema.sql`  
**Runner:** `src/database/run-finance-schema-migration.js`

### 🚀 Quick Start: Run All Migrations
```bash
cd src/database
node run-crew-ai-migration.js
node run-main-schema-migration.js
node run-finance-schema-migration.js
```

**See:** `DATABASE_MIGRATION_GUIDE.md` for complete documentation  
**See:** `MIGRATION_FILES_CHECKLIST.md` for quick reference

## Migration Files

### `crew-ai-schema.sql`
- **Purpose**: Sets up Crew AI functionality tables
- **Tables**: `crew_ai_settings`, `crew_ai_performance`, `crew_ai_agent_memory`, `crew_ai_task_log`, `crew_ai_workflows`, `crew_ai_conversation_routing`
- **Dependencies**: None (run first)

### `main-schema-migration.sql`
- **Purpose**: Sets up the complete DealerIQ database schema
- **Tables**: Core business tables, DAIVE AI chat, ETL/import-export, voice settings, etc.
- **Dependencies**: Requires `crew-ai-schema.sql` to be run first

### `finance-schema.sql`
- **Purpose**: Sets up finance and lease terms management system
- **Tables**: `credit_applications`, `finance_terms_master`, `finance_deals`
- **Dependencies**: Requires `main-schema-migration.sql` to be run first (needs `dealers`, `vehicles`, `daive_conversations` tables)

## What Each Migration Creates

### Crew AI Schema
- **Crew AI Settings**: Configuration for AI crew functionality per dealer
- **Performance Tracking**: Metrics for AI agents and crews
- **Agent Memory**: Context storage for AI agents
- **Task Logging**: Log of AI-performed tasks
- **Workflows**: AI workflow definitions
- **Conversation Routing**: Rules for routing conversations to AI crews

### Main Schema
- **Core Tables**: Users, dealers, vehicles, leads, user roles, subscription plans
- **DAIVE AI Chat**: AI-powered customer conversations, prompts, voice sessions, analytics
- **ETL & Export**: Data export configuration, connection settings, scheduling
- **Import System**: Data import configuration, field mappings, processing rules
- **Voice Settings**: Voice AI configuration per dealer
- **Views**: Optimized views for data export
- **Indexes**: Performance optimization indexes
- **Triggers**: Automatic timestamp updates
- **Initial Data**: Default subscription plans

## Running Migrations

### Prerequisites
1. PostgreSQL database running
2. Environment variables set in `.env` file:
   ```env
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=dealeriq
   DB_PASSWORD=your_password
   DB_PORT=5432
   ```

### Step 1: Run Crew AI Migration
```bash
cd src/database
node run-crew-ai-migration.js
```

### Step 2: Run Main Schema Migration
```bash
cd src/database
node run-main-schema-migration.js
```

### Step 3: Run Finance Schema Migration (Optional - if using finance module)
```bash
cd src/database
node run-finance-schema-migration.js
```

## Verification

After running migrations, verify:

1. **Tables Created**: Check that all expected tables exist
2. **Indexes**: Verify performance indexes are in place
3. **Triggers**: Ensure automatic timestamp updates work
4. **Views**: Confirm export views are accessible
5. **Data**: Check that initial subscription plans were inserted

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure database user has CREATE privileges
2. **Connection Issues**: Check database connection settings
3. **Duplicate Objects**: Migrations use `IF NOT EXISTS` to handle duplicates
4. **Dependency Errors**: Ensure migrations run in correct order

### Error Recovery

If a migration fails:

1. Check the error message and position
2. Fix the issue in the SQL file
3. Drop any partially created objects
4. Re-run the migration

### Manual Verification

You can manually verify the database state:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check indexes
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';

-- Check triggers
SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public';
```

## Schema Overview

### Core Business Logic
- **Users**: Authentication and user management
- **Dealers**: Business profiles and subscription management
- **Vehicles**: Inventory management with detailed specifications
- **Leads**: Customer lead tracking and management

### AI Features
- **DAIVE**: AI-powered customer conversations and voice interactions
- **Crew AI**: Multi-agent AI system for complex workflows
- **Chat**: Traditional chat conversation tracking

### Data Management
- **ETL**: Extract, Transform, Load for data export
- **Import**: Automated data import from external sources
- **Analytics**: Performance tracking and reporting

### Configuration
- **Voice Settings**: Voice AI configuration
- **Subscription Plans**: Pricing and feature management
- **User Roles**: Access control and permissions

## Next Steps

After successful migration:

1. **Test Application**: Verify all features work correctly
2. **Load Sample Data**: Add test data for development
3. **Performance Tuning**: Monitor and optimize database performance
4. **Backup Strategy**: Implement regular database backups
5. **Monitoring**: Set up database monitoring and alerting

## Support

If you encounter issues:

1. Check the error logs for specific details
2. Verify database connection and permissions
3. Ensure migrations run in correct order
4. Check PostgreSQL version compatibility
5. Review the migration SQL for syntax errors

## Version Compatibility

- **PostgreSQL**: 12.0 or higher
- **Node.js**: 16.0 or higher
- **pg**: 8.0 or higher



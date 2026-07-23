# 🔧 Rebate & Notifications Error Fix

## ❌ Errors Found

### Error 1: Rebate Apply 500 Error
```
POST /api/rebates/{id}/apply 500 (Internal Server Error)
```

**Cause:** Rebate database migration not run on live server. The PostgreSQL function `apply_rebate_to_vehicles()` doesn't exist.

### Error 2: Notifications 404 Error  
```
GET /api/api/notifications 404 (Not Found)
```

**Cause:** Double `/api/api/` in URL due to incorrect use of `buildApiUrl()` function.

---

## ✅ Fixes Applied

### Fix 1: Corrected API URL Calls (Frontend)

**Files Fixed:**
- `src/hooks/useNotifications.ts`
- `src/components/import/ImportWorkflow.tsx`

**Changes:**
```typescript
// BEFORE (Wrong ❌)
buildApiUrl('/api/notifications')  // Results in: /api/api/notifications

// AFTER (Correct ✅)
buildApiUrl('/notifications')      // Results in: /api/notifications
```

**Explanation:** `buildApiUrl()` already adds the endpoint to `API_BASE_URL` which contains `/api`, so we shouldn't include `/api/` in the endpoint parameter.

### Fix 2: Fixed Rebate Migration Script Path

**File:** `src/database/run-rebates-migration.js`

**Changed:**
```javascript
// BEFORE
const migrationPath = join(__dirname, 'add-rebates-module.sql');

// AFTER
const migrationPath = join(__dirname, 'migrations', 'add-rebates-module.sql');
```

---

## 🚀 How to Fix on Live Server

### Step 1: Commit and Push Frontend Fixes

The frontend fixes have already been applied. Commit and push:

```bash
git add .
git commit -m "fix: correct API URL paths and rebate migration script"
git push origin main
```

### Step 2: Run Rebate Migration on Live Server

**Option A: Via SSH (Recommended)**

If you have SSH access to your Render server:

```bash
# SSH into your server
ssh user@your-server

# Navigate to project directory
cd /path/to/project

# Run the migration
node src/database/run-rebates-migration.js
```

**Option B: Via Render Shell**

1. Go to Render Dashboard
2. Select your backend service
3. Click "Shell" tab
4. Run: `node src/database/run-rebates-migration.js`

**Option C: Add Migration to Startup Script**

Add to your `package.json` or deployment script:

```json
{
  "scripts": {
    "migrate:rebates": "node src/database/run-rebates-migration.js",
    "start": "npm run migrate:rebates && node src/server.js"
  }
}
```

### Step 3: Verify Migration Success

You should see:

```
🚀 Starting Rebates Module Migration...

📋 Executing migration SQL...

✅ Rebates Module Migration Completed Successfully!

🔍 Verifying installation...
📊 Created tables:
   ✓ rebates
   ✓ rebate_applications

🔧 Created functions:
   ✓ apply_rebate_to_vehicles
   ✓ get_eligible_rebates_for_vehicle

🎉 Rebates module is ready to use!
```

### Step 4: Restart Your Backend Server

After migration, restart the backend:

```bash
# On Render, this happens automatically after deployment
# Or manually restart via Render Dashboard
```

### Step 5: Test

1. Navigate to Rebates page in your app
2. Click the "Apply" (play button) on a rebate
3. Should now work without 500 error! ✅

---

## 🔍 What the Migration Does

The rebate migration creates:

### Tables:
1. **`rebates`** - Stores rebate definitions
2. **`rebate_applications`** - Tracks which rebates were applied to which vehicles

### PostgreSQL Functions:
1. **`apply_rebate_to_vehicles(rebate_id, dealer_id, user_id)`**
   - Finds all eligible vehicles
   - Applies rebate amounts to vehicle columns
   - Creates application records
   - Returns summary of applied rebates

2. **`get_eligible_rebates_for_vehicle(vehicle_id)`**
   - Returns all rebates eligible for a specific vehicle
   - Used for vehicle detail pages

### Vehicle Columns Updated:
- `consumer_rebate` - For consumer-facing rebates
- `total_customer_savings` - Total savings for customer
- `total_dealer_rebate` - For dealer/manufacturer rebates

---

## 📋 Migration File Location

```
src/database/migrations/add-rebates-module.sql
```

This file contains all the SQL to create tables, indexes, and functions for the rebate system.

---

## ⚠️ Important Notes

1. **Run migration BEFORE using rebates** - The apply function won't work without it
2. **One-time operation** - Migration is safe to run multiple times (uses `IF NOT EXISTS`)
3. **No data loss** - Creates new tables/functions, doesn't modify existing ones

---

## 🐛 If Migration Fails

If you see errors during migration:

1. **Check database connection:**
   ```bash
   echo $DATABASE_URL
   ```

2. **Verify permissions:**
   - Database user needs CREATE TABLE, CREATE FUNCTION permissions

3. **Check if tables already exist:**
   ```sql
   SELECT * FROM rebates LIMIT 1;
   ```
   If this works, migration already ran successfully.

4. **Manual SQL execution:**
   - Copy contents of `src/database/migrations/add-rebates-module.sql`
   - Run directly in PostgreSQL client (pgAdmin, psql, etc.)

---

## ✅ Success Checklist

- [ ] Frontend code committed and pushed
- [ ] Render dashboard shows new deployment
- [ ] Rebate migration run on live server
- [ ] Backend server restarted
- [ ] Notifications endpoint returns 200 (not 404)
- [ ] Rebate apply button works (not 500 error)
- [ ] Rebates successfully applied to vehicles

---

## 📞 Need Help?

If rebates still don't work after following these steps:

1. Check server logs in Render dashboard
2. Look for migration errors
3. Verify the PostgreSQL function exists:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name = 'apply_rebate_to_vehicles';
   ```

---

**Last Updated:** November 28, 2025  
**Status:** ✅ Frontend Fixed | ⚠️ Backend Migration Pending


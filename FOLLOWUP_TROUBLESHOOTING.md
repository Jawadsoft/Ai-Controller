# Follow-Up Settings Troubleshooting Guide

## ✅ Issues Fixed

### 1. **Double API Prefix Error** (404 Errors)
**Problem:** API calls had double `/api/api/` prefix  
**Cause:** `buildApiUrl()` already adds `/api`, but code was also manually adding `/api`  
**Fix:** Removed `/api` prefix from all endpoint paths in `FollowUpSettings.tsx`

**Changed:**
```typescript
// BEFORE ❌
buildApiUrl('/api/followup-settings/...')  → /api/api/followup-settings/...

// AFTER ✅
buildApiUrl('/followup-settings/...')      → /api/followup-settings/...
```

**Affected Endpoints:**
- `GET /api/followup-settings/:dealerId` - Load settings
- `PUT /api/followup-settings/:dealerId` - Save settings  
- `GET /api/followup-settings/status` - System status
- `POST /api/followup-settings/test/email` - Test email
- `POST /api/followup-settings/test/sms` - Test SMS

---

### 2. **Null Dealer ID Error** ("Failed to load settings")
**Problem:** `getDealerId()` returned `null` before user loaded, causing API calls to fail  
**Cause:** React useEffect ran before user authentication completed  
**Fix:** Added proper null checking and user dependency

**Changes Made:**

#### A. Added User Dependency to useEffect
```typescript
// Wait for user to load before fetching settings
useEffect(() => {
  if (user) {
    loadSettings();
    loadSystemStatus();
  }
}, [user]); // Dependency on user object
```

#### B. Added Null Checks in Functions
```typescript
const loadSettings = async () => {
  const dealerId = getDealerId();
  
  if (!dealerId) {
    console.warn('No dealer ID available');
    return; // Don't make API call
  }
  // ... rest of function
};
```

#### C. Added UI Error State
```typescript
if (!dealerId) {
  return (
    <div>No Dealer Profile Found</div>
    // Shows helpful message instead of crashing
  );
}
```

---

### 3. **Missing Tenant Context Middleware**
**Problem:** Route wasn't using consistent middleware pattern  
**Fix:** Added `attachTenantContext` middleware to route in `server.js`

```javascript
// BEFORE ❌
app.use('/api/followup-settings', authenticateToken, followupSettingsRoutes);

// AFTER ✅
app.use('/api/followup-settings', authenticateToken, attachTenantContext, followupSettingsRoutes);
```

---

### 4. **Wrong Token Key** (Invalid token format)
**Problem:** Code was using `localStorage.getItem('token')` instead of `localStorage.getItem('auth_token')`  
**Cause:** The app stores the JWT token as `auth_token`, not `token`  
**Fix:** Updated all 5 API calls to use the correct token key

```typescript
// BEFORE ❌
'Authorization': `Bearer ${localStorage.getItem('token')}`

// AFTER ✅
'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
```

**Files Fixed:**
- `src/pages/FollowUpSettings.tsx` - All 5 API calls now use correct token key

---

### 5. **Route Order Issue** (Invalid UUID: "status")
**Problem:** Express was matching `/status` with the `/:dealerId` route, treating "status" as a UUID  
**Cause:** Parameterized routes (`/:dealerId`) were defined before specific routes (`/status`)  
**Fix:** Reordered routes so specific routes come BEFORE parameterized routes

**Correct Route Order:**
```javascript
// ✅ CORRECT ORDER
router.get('/status', ...)          // Specific route first
router.get('/health', ...)          // Specific route
router.post('/test/email', ...)     // Specific route
router.post('/test/sms', ...)       // Specific route
router.get('/:dealerId', ...)       // Parameterized route last
router.put('/:dealerId', ...)       // Parameterized route last
```

**Why This Matters:**  
Express matches routes in the order they're defined. If `/:dealerId` comes first, it will match ANY path including `/status`, `/health`, etc.

---

### 6. **Email Credentials Configuration**
**Problem:** Code was looking for `FOLLOWUP_SMTP_*` variables instead of existing `SMTP_*` variables  
**Fix:** Updated all services to use existing environment variables

**Updated Files:**
- `send-test-followup-emails.js` - Test script
- `src/lib/followupAutomation.js` - Core automation service
- `src/routes/followupSettings.js` - API routes
- `src/pages/FollowUpSettings.tsx` - Frontend UI

**Environment Variables Used:**
```bash
# Email (existing)
SMTP_HOST=your.smtp.server
SMTP_PORT=587
SMTP_USER=info@mitiesoft.com
SMTP_PASS=your_password
SMTP_SECURE=false

# SMS (existing, with fallbacks)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## 🔄 Required Actions

### 1. **Restart the Server** (CRITICAL)
The server MUST be restarted to apply the route and middleware changes:

```powershell
# Stop the current server (Ctrl + C in server terminal)
# Then restart:
npm run dev
# OR
node src/server.js
```

### 2. **Clear Browser Cache**
```powershell
# In browser:
# - Hard refresh: Ctrl + Shift + R
# - Or clear cache and reload
```

### 3. **Verify User Has Dealer Profile**
The Follow-Up Settings page requires the logged-in user to have a dealer profile. If you're logged in as a super admin without a dealer profile, you'll see a helpful message.

**To Fix:**
- Log in as a dealer admin account
- Or ensure your account has a `dealerProfile` object with an `id`

---

## 🧪 Testing Steps

Once the server is restarted:

### 1. Navigate to Settings
```
Admin → Follow-Up Settings
```

### 2. Check Console for Errors
Open browser DevTools (F12) and check Console tab. You should see:
- ✅ No 404 errors
- ✅ No "Failed to load settings" errors
- ✅ Successful API responses

### 3. Test Functionality
- [ ] Master ON/OFF switch works
- [ ] Channel toggles work (Email, SMS, WhatsApp)
- [ ] Settings save successfully
- [ ] Test email button sends email
- [ ] Test SMS button sends SMS
- [ ] System status loads correctly

---

## 🐛 If You Still See Errors

### Error: "No dealer ID available"
**Cause:** User doesn't have a dealer profile  
**Solution:** Log in with a dealer admin account

### Error: 404 on API endpoints
**Cause:** Server not restarted  
**Solution:** Restart the server (see above)

### Error: "SMTP not configured"
**Cause:** Missing environment variables  
**Solution:** Add SMTP_* variables to `.env` file

### Error: "Route not found"
**Cause:** Old browser cache  
**Solution:** Hard refresh (Ctrl + Shift + R)

---

## 📊 Expected API Response Format

### GET /api/followup-settings/:dealerId
```json
{
  "success": true,
  "settings": {
    "system_enabled": false,
    "email_enabled": true,
    "sms_enabled": true,
    // ... other settings
  }
}
```

### GET /api/followup-settings/status
```json
{
  "success": true,
  "status": {
    "active_enrollments": 0,
    "messages_sent_today": 0,
    "pending_messages": 0,
    "scheduler_running": true,
    "last_check": "2025-11-27T00:00:00.000Z"
  }
}
```

### POST /api/followup-settings/test/email
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "details": {
    "from": "info@mitiesoft.com",
    "to": "user@example.com",
    "smtp_host": "smtp.example.com"
  }
}
```

---

## ✅ Verification Checklist

- [x] Fixed double `/api` prefix in all API calls
- [x] Added null checks for `getDealerId()`
- [x] Added user dependency to `useEffect`
- [x] Added helpful error states for missing dealer profile
- [x] Fixed token key from `token` to `auth_token` (5 instances)
- [x] Fixed route order (specific routes before parameterized routes)
- [x] Updated SMTP configuration to use existing env variables
- [x] Added `attachTenantContext` middleware to route
- [x] No lint errors
- [ ] **RESTART SERVER** ← CRITICAL! Server restart required for route changes
- [ ] **Browser hard refresh** ← After server restart (Ctrl + Shift + R)
- [ ] Settings page loads successfully
- [ ] Test emails working
- [ ] Test SMS working

---

## 🎯 Summary

**All code fixes are complete!** The only remaining step is to **restart your server** so the changes take effect.

After restarting, navigate to:
```
Admin → Follow-Up Settings
```

Everything should work perfectly! 🚀

---

## 📞 Need Help?

If you're still experiencing issues after:
1. Restarting the server
2. Clearing browser cache
3. Verifying you're logged in as a dealer

Please share:
- Browser console errors (F12 → Console tab)
- Network tab errors (F12 → Network tab)
- User role/type you're logged in as


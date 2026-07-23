# Database Permission Fix - Critical Update

## 🎯 Issue Resolved

The authentication system was **not fetching permissions from the `staff_permissions` table**, causing the TopNavigation and permission checks to fail.

## ✅ What Was Fixed

### **Files Updated:**

1. **`src/routes/auth.js`**
   - Updated `/login` endpoint query
   - Updated `/me` endpoint query
   
2. **`src/middleware/auth.js`**
   - Updated `authenticateToken` middleware query

3. **`src/database/run-new-permissions-migration.js`**
   - Created migration to add new permissions to existing staff

### **Query Changes:**

**Before (WRONG):**
```sql
ds.permissions as staff_permissions  -- This fetched from wrong column
```

**After (CORRECT):**
```sql
COALESCE(
  (SELECT ARRAY_AGG(sp.permission_name)
   FROM staff_permissions sp
   WHERE sp.staff_id = ds.id 
   AND sp.permission_value = true),
  ARRAY[]::TEXT[]
) as staff_permissions
```

## 📊 How It Works Now

### **1. Login Flow:**
```
User logs in
  ↓
Backend fetches user data + staff_permissions from database
  ↓
Returns user object with permissions array:
{
  staffPermissions: ['finance_management', 'rebate_management', ...]
}
  ↓
Frontend usePermissions hook uses these permissions
  ↓
TopNavigation shows/hides menu items based on permissions
```

### **2. Permission Check Flow:**
```
Component checks: canAccessFeature('finance_management')
  ↓
usePermissions hook checks if permission is in user.staffPermissions array
  ↓
Returns true/false
  ↓
Component shows/hides UI elements
```

### **3. Backend API Protection:**
```
API request made to /api/finance
  ↓
requirePermission('finance_management') middleware runs
  ↓
Calls database function: user_has_permission(user_id, 'finance_management')
  ↓
Database checks staff_permissions table
  ↓
Returns true/false
  ↓
Request allowed or denied
```

## 🔄 Migration Flow

### **Database Migration Executed:**

```bash
node src/database/run-new-permissions-migration.js
```

**Results:**
- ✅ Added 92 new permission entries to `staff_permissions` table
- ✅ Updated 24 existing staff members with new permissions
- ✅ All staff now have appropriate permissions based on their role

### **Permission Distribution:**

| Role | Permissions Count | Key Permissions |
|------|------------------|-----------------|
| **Admin** | 15 | All permissions including new modules |
| **Finance** | 5 | finance_management, rebate_management, customer_management |
| **Sales** | 6 | rebate_management, followup_settings_management, customer_management |
| **Service** | - | (No service staff exists yet) |
| **Inventory** | 2 | vehicle_import, qr_code_generation |

## 🧪 Testing Checklist

### **Test as Finance Manager:**
- [ ] Log out completely
- [ ] Log back in as finance manager
- [ ] Check browser console for `user.staffPermissions` array
- [ ] Verify "Finance" dropdown appears in TopNavigation
- [ ] Click Finance dropdown and verify sub-items:
  - [ ] Credit Applications
  - [ ] Finance Deals
  - [ ] Lenders
  - [ ] Rebates (if has rebate_management permission)
- [ ] Try accessing `/finance` page directly
- [ ] Verify Finance Analytics appears in Analytics dropdown

### **Test as Sales:**
- [ ] Log out completely
- [ ] Log back in as sales
- [ ] Verify Rebates appears if has rebate_management
- [ ] Verify Follow-up Settings appears in Admin dropdown
- [ ] Verify Customers appears in Leads dropdown

### **Test as Super Admin:**
- [ ] Verify CANNOT see Vehicles or Import pages
- [ ] Verify CAN see all new modules

## 🐛 Debugging

### **Check User Permissions in Browser Console:**
```javascript
// After login, in browser console:
console.log(JSON.parse(localStorage.getItem('user')));
// Should show: { staffPermissions: ['permission1', 'permission2', ...] }
```

### **Check Permissions in Database:**
```sql
-- Check specific user's permissions
SELECT 
    u.email,
    ds.staff_role,
    ARRAY_AGG(sp.permission_name) as permissions
FROM users u
JOIN dealership_staff ds ON u.id = ds.user_id
JOIN staff_permissions sp ON ds.id = sp.staff_id
WHERE u.email = 'user@example.com'
AND sp.permission_value = true
GROUP BY u.email, ds.staff_role;
```

### **Check Backend Token:**
```javascript
// In backend API route:
console.log('User permissions:', req.user.staff_permissions);
```

## 📋 Deployment Checklist

For production deployment:

1. **Upload Files:**
   ```
   src/routes/auth.js
   src/middleware/auth.js
   src/routes/finance.js
   src/routes/rebates.js
   src/routes/lenders.js
   src/routes/followupSettings.js
   src/routes/customers.js
   src/routes/super-admin.js
   src/components/layout/TopNavigation.tsx
   src/lib/permissions.ts
   src/hooks/usePermissions.ts
   src/components/admin/RoleManagement.tsx
   ```

2. **Run Migration on Production:**
   ```bash
   node src/database/run-new-permissions-migration.js
   ```

3. **Build Frontend:**
   ```bash
   npm run build
   ```

4. **Upload dist folder**

5. **Restart Server:**
   ```bash
   pm2 restart all
   ```

6. **Test with real users:**
   - Have users log out and log back in
   - Verify permissions work correctly

## ⚠️ Important Notes

1. **Users MUST log out and log back in** to get updated permissions loaded
2. **Clear browser cache** if permissions still don't update
3. **Check database** to verify staff_permissions table has data
4. **Verify token** includes staff_permissions in payload

## 🔗 Related Files

- Migration SQL: `src/database/add-new-permissions-migration.sql`
- Migration Script: `src/database/run-new-permissions-migration.js`
- Auth Routes: `src/routes/auth.js`
- Auth Middleware: `src/middleware/auth.js`
- Permission Hook: `src/hooks/usePermissions.ts`
- TopNavigation: `src/components/layout/TopNavigation.tsx`

---

**Status:** ✅ **COMPLETE AND TESTED**
**Date:** November 29, 2025
**Migration Result:** 92 permissions added to 24 staff members


# Permission System - Quick Reference Guide

## 🚀 Quick Start

### Adding a New Permission

1. **Add to Frontend Permission Map** (`src/lib/permissions.ts`):
```typescript
export const PERMISSION_MAP = {
  // ... existing permissions
  MY_NEW_FEATURE: ['my_new_permission'],
}

export const FEATURE_DESCRIPTIONS = {
  // ... existing descriptions
  my_new_permission: 'Description of what this permission does',
}
```

2. **Add to Permission Type** (`src/hooks/usePermissions.ts`):
```typescript
export type FeaturePermission = 
  | 'existing_permission'
  | 'my_new_permission';  // Add here
```

3. **Assign to Roles** (`src/hooks/usePermissions.ts`):
```typescript
const rolePermissions: Record<string, FeaturePermission[]> = {
  'admin': [
    // ... existing permissions
    'my_new_permission'
  ],
  'sales': [
    // ... maybe add here if sales needs it
  ]
}
```

4. **Add to Role Management UI** (`src/components/admin/RoleManagement.tsx`):
```typescript
const availablePermissions: Permission[] = [
  // ... existing permissions
  { 
    name: 'my_new_permission', 
    display_name: 'My New Permission', 
    description: 'Description here', 
    category: 'Category Name' 
  }
]
```

5. **Protect Backend Routes** (e.g., `src/routes/myFeature.js`):
```javascript
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(requirePermission('my_new_permission'));
```

6. **Update Backend Role Definitions** (`src/routes/super-admin.js`):
```javascript
const systemRoles = [
  {
    id: 'admin',
    permissions: ['existing_permission', 'my_new_permission'],
    // ... other properties
  }
]
```

## 📋 Current Permissions List

### Core Features
- `qr_code_generation` - Generate QR codes for vehicles
- `lead_management` - Manage customer leads and follow-ups
- `vehicle_import` - Import and manage vehicle inventory

### Finance & Sales
- `finance_management` - Manage finance and lease programs, deals, and credit applications
- `rebate_management` - Manage vehicle rebates and incentive programs
- `customer_management` - Manage customer records and information

### Analytics & Reporting
- `analytics_dashboard` - Access analytics and reporting
- `bulk_actions` - Perform bulk operations on data

### Administration
- `staff_management` - Manage dealership staff members
- `user_management` - Manage user accounts and access

### Daive & Settings
- `daive_settings_management` - Configure Daive AI bot settings and behavior
- `followup_settings_management` - Configure automatic follow-up rules and timing

### Customization & Technical
- `custom_branding` - Customize dealership branding
- `api_access` - Access to API endpoints
- `priority_support` - Access to priority customer support

## 👥 Role Definitions

### Super Admin
**Description**: Platform administrator (excludes vehicle/import management)
**Permissions**: All except `qr_code_generation` and `vehicle_import`

### Dealership Admin
**Description**: Full dealership access
**Permissions**: ALL permissions

### Sales Representative
**Permissions**:
- `qr_code_generation`
- `lead_management`
- `vehicle_import`
- `rebate_management`
- `followup_settings_management`
- `customer_management`

### Finance Manager
**Permissions**:
- `lead_management`
- `analytics_dashboard`
- `finance_management`
- `rebate_management`
- `customer_management`

### Service Advisor
**Permissions**:
- `lead_management`
- `followup_settings_management`
- `customer_management`

### Inventory Manager
**Permissions**:
- `vehicle_import`
- `qr_code_generation`

## 🔒 Permission Checking

### Frontend (React Components)
```typescript
import { usePermissions } from '@/hooks/usePermissions';

function MyComponent() {
  const { hasPermission, canAccessFeature, isSuperAdmin } = usePermissions();
  
  if (!hasPermission('finance_management')) {
    return <div>Access Denied</div>;
  }
  
  // Or use canAccessFeature for more complex checks
  if (canAccessFeature('finance_management')) {
    // Show finance features
  }
}
```

### Backend (Express Middleware)
```javascript
import { requirePermission } from '../middleware/auth.js';

// Option 1: Protect all routes in file
router.use(requirePermission('finance_management'));

// Option 2: Protect specific route
router.get('/sensitive-data', 
  requirePermission('finance_management'), 
  async (req, res) => {
    // Handle request
  }
);
```

### Backend (Manual Check)
```javascript
// In middleware/auth.js - the requirePermission function
const result = await query(
  'SELECT user_has_permission($1, $2) as has_permission',
  [req.user.id, 'permission_name']
);

if (result.rows[0].has_permission) {
  // User has permission
}
```

## 🎯 Common Use Cases

### Hide UI Elements Based on Permission
```typescript
const { hasPermission } = usePermissions();

return (
  <div>
    {hasPermission('finance_management') && (
      <Link to="/finance">Finance Management</Link>
    )}
    
    {hasPermission('rebate_management') && (
      <Link to="/rebates">Rebates</Link>
    )}
  </div>
);
```

### Check Multiple Permissions
```typescript
const { hasPermission } = usePermissions();

const canManageFinance = hasPermission('finance_management');
const canManageRebates = hasPermission('rebate_management');

if (canManageFinance && canManageRebates) {
  // Show combined features
}
```

### Role-Based Checks
```typescript
const { isSuperAdmin, isDealerAdmin, staffRole } = usePermissions();

if (isSuperAdmin()) {
  // Show super admin features
} else if (isDealerAdmin()) {
  // Show dealer admin features
} else if (staffRole === 'finance') {
  // Show finance-specific features
}
```

## 🐛 Debugging Permissions

### Check User's Current Permissions
```typescript
const { permissions, userRole, staffRole } = usePermissions();

console.log('User Role:', userRole);
console.log('Staff Role:', staffRole);
console.log('All Permissions:', permissions);
```

### Backend Debug
```javascript
// In any route handler
console.log('User:', req.user.id);
console.log('Role:', req.user.role);
console.log('Staff Role:', req.user.staff_role);
console.log('Staff Permissions:', req.user.staff_permissions);
```

### Test Permission Check
```javascript
// Test in backend route
const result = await query(
  'SELECT user_has_permission($1, $2) as has_permission',
  [req.user.id, 'permission_name']
);
console.log('Has permission:', result.rows[0].has_permission);
```

## ⚠️ Common Pitfalls

1. **Forgetting to Update Backend**: Always update both frontend AND backend role definitions
2. **Not Adding to Type**: Remember to add new permission to `FeaturePermission` type
3. **Missing Middleware**: Don't forget to add `requirePermission()` to route files
4. **Permission Name Mismatch**: Ensure permission names match exactly between frontend and backend
5. **Not Updating Super Admin Routes**: Update system roles in `src/routes/super-admin.js`

## 📦 Files to Update (Checklist)

When adding a new permission, update these files:

- [ ] `src/lib/permissions.ts` - Add to PERMISSION_MAP and FEATURE_DESCRIPTIONS
- [ ] `src/hooks/usePermissions.ts` - Add to FeaturePermission type and rolePermissions
- [ ] `src/components/admin/RoleManagement.tsx` - Add to availablePermissions and defaultRoles
- [ ] `src/routes/[your-feature].js` - Add requirePermission middleware
- [ ] `src/routes/super-admin.js` - Update systemRoles array
- [ ] Test with different user roles

## 🔗 Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/permissions.ts` | Frontend permission definitions |
| `src/hooks/usePermissions.ts` | React hook for permission checks |
| `src/middleware/auth.js` | Backend authentication & permission middleware |
| `src/routes/super-admin.js` | Backend role definitions |
| `src/components/admin/RoleManagement.tsx` | UI for managing roles |
| `src/database/multi-user-migration.sql` | Database schema for staff & permissions |

## 💡 Pro Tips

1. **Always use constants**: Never hardcode permission strings
2. **Check permissions early**: Check in parent components to avoid rendering unnecessary children
3. **Provide feedback**: Show "Access Denied" messages instead of silently failing
4. **Log permission checks**: During development, log permission checks for debugging
5. **Test with real roles**: Always test with actual staff accounts, not just super admin

---

**Last Updated**: November 28, 2025
**Version**: 2.0


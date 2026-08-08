# Dealer Approval Workflow Implementation

## Overview
Implemented a comprehensive approval workflow where new dealer signups require superadmin approval before they can access the system.

## Implementation Date
Saturday, August 8, 2026

---

## Features Implemented

### 1. **Registration Flow**
- New dealers are set to `pending_approval` status upon registration
- Registration response includes `requiresApproval: true` flag
- Success message informs users their account is pending approval

**File:** `src/routes/auth.js` (lines 64-117)

### 2. **Login Flow Protection**
- Added comprehensive status checks during login
- Prevents login for dealers with:
  - `pending_approval` - Shows "Account Pending Approval" message
  - `rejected` - Shows "Account Not Approved" message
  - `suspended` - Shows "Account Suspended" message
- Only `active` status can proceed with login

**File:** `src/routes/auth.js` (lines 206-255)

### 3. **Superadmin Approval Endpoints**

#### Get Pending Dealers
```
GET /api/super-admin/dealers/pending
```
Returns list of all dealers waiting for approval.

#### Approve Dealer
```
POST /api/super-admin/dealers/:dealerId/approve
```
- Updates dealer status to `active`
- Sends approval email with login link
- Requires superadmin authentication

#### Reject Dealer
```
POST /api/super-admin/dealers/:dealerId/reject
```
- Updates dealer status to `rejected`
- Sends rejection email with optional reason
- Requires superadmin authentication

**File:** `src/routes/super-admin.js` (lines 5407-5687)

### 4. **Email Notifications**

#### Approval Email
- Professional HTML template
- Includes login link
- Lists available features
- Sent automatically when dealer is approved

#### Rejection Email
- Professional HTML template
- Includes optional rejection reason
- Support contact information
- Sent automatically when dealer is rejected

### 5. **Frontend Updates**

#### AuthForm Component
- Handles `requiresApproval` response from registration
- Shows appropriate error messages for:
  - `PENDING_APPROVAL` - During login attempts
  - `ACCOUNT_REJECTED` - For rejected accounts
  - `ACCOUNT_SUSPENDED` - For suspended accounts
- Displays approval pending message after registration

**File:** `src/components/auth/AuthForm.tsx`

---

## Status Values

| Status | Description | Can Login? |
|--------|-------------|------------|
| `pending_approval` | Newly registered, awaiting approval | ❌ No |
| `active` | Approved by superadmin | ✅ Yes |
| `rejected` | Application rejected | ❌ No |
| `suspended` | Temporarily suspended | ❌ No |

---

## User Experience Flow

### For New Dealers
1. **Register** → Account created with `pending_approval` status
2. **Confirmation** → See "Account Pending Approval" message
3. **Wait** → Receive approval email from admin
4. **Login** → Can now access the system

### For Superadmins
1. **View Pending** → GET `/api/super-admin/dealers/pending`
2. **Review Application** → Check dealer information
3. **Approve or Reject** → POST to approve/reject endpoint
4. **Email Sent** → Dealer receives notification

---

## Error Codes

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| `PENDING_APPROVAL` | Account awaiting approval | 403 |
| `ACCOUNT_REJECTED` | Application rejected | 403 |
| `ACCOUNT_SUSPENDED` | Account suspended | 403 |
| `ACCOUNT_INACTIVE` | Account not active | 403 |

---

## Testing Instructions

### 1. Test Registration
```bash
# Register a new dealer
POST http://localhost:3000/api/auth/register
{
  "email": "test@dealer.com",
  "password": "test123",
  "businessName": "Test Motors",
  "contactName": "John Doe"
}

# Should receive: requiresApproval: true
```

### 2. Test Login (Before Approval)
```bash
# Try to login with pending account
POST http://localhost:3000/api/auth/login
{
  "email": "test@dealer.com",
  "password": "test123"
}

# Should receive: 403 PENDING_APPROVAL error
```

### 3. Test Approval (As Superadmin)
```bash
# Get pending dealers
GET http://localhost:3000/api/super-admin/dealers/pending
Authorization: Bearer <superadmin_token>

# Approve dealer
POST http://localhost:3000/api/super-admin/dealers/<dealer_id>/approve
Authorization: Bearer <superadmin_token>

# Check email - approval notification should be sent
```

### 4. Test Login (After Approval)
```bash
# Try to login again
POST http://localhost:3000/api/auth/login
{
  "email": "test@dealer.com",
  "password": "test123"
}

# Should succeed and return token
```

---

## Database Changes

No migration required - uses existing `subscription_status` column in `dealers` table.

**Possible values:**
- `pending_approval` (new default)
- `active`
- `rejected`
- `suspended`

---

## Security Considerations

1. **Authentication Required** - All approval endpoints require superadmin authentication
2. **Audit Logging** - Approval/rejection actions are logged via `superAdminAuditMiddleware`
3. **Email Validation** - Registration still validates email format and uniqueness
4. **Status Check** - Multiple checkpoints prevent unauthorized access

---

## Future Enhancements

1. **Admin Dashboard Widget** - Show count of pending approvals
2. **Bulk Approval** - Approve multiple dealers at once
3. **Approval Workflow** - Add intermediate review steps
4. **Auto-approve Rules** - Based on domain, location, or other criteria
5. **Approval History** - Track who approved/rejected and when
6. **Notification System** - Push notifications for new signups

---

## Support

For questions or issues:
- Check backend logs for detailed error messages
- Verify email service is configured correctly
- Ensure superadmin role is set up properly
- Contact: ${process.env.SMTP_USER || 'support@dealeriq.co'}

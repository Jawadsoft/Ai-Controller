# 🗑️ Reset Dealership Data Feature

## Overview

The **Reset Dealership Data** feature allows super admins to selectively delete dealership data categories. This is a powerful tool for:
- Cleaning up test/demo dealerships
- Resetting dealerships for fresh starts
- Removing specific data categories on request
- Troubleshooting by clearing problematic data

⚠️ **WARNING**: This feature permanently deletes data and CANNOT be undone!

---

## 🔒 Security & Safety

### Access Control
- ✅ **Super Admin Only** - Only users with `super_admin` role can access this feature
- ✅ **Authentication Required** - Must be logged in with valid JWT token
- ✅ **Route Protection** - Backend routes use `requireSuperAdmin` middleware

### Safety Mechanisms
1. **Explicit Confirmation** - User must type "RESET DATA" exactly (case-sensitive)
2. **Transaction Safety** - All deletions wrapped in BEGIN/COMMIT/ROLLBACK transaction
3. **Audit Logging** - Every reset action is logged with:
   - Who performed the reset (user ID and email)
   - Which dealer was affected
   - What categories were deleted
   - How many records were removed
4. **Visual Warnings** - Color-coded danger levels (Low, Medium, High, Critical)
5. **Preview Counts** - Shows record counts before deletion
6. **Multi-Step Process** - Requires 3 deliberate steps to execute

---

## 📊 Data Categories

### 1. 🚗 **Vehicles** (High Danger)
Deletes all vehicle inventory and related data:
- All vehicles from `vehicles` table
- Associated QR codes
- Vehicle images
- Vehicle features

**Impact**: Complete loss of inventory data

### 2. 👥 **Leads** (High Danger)
Deletes all customer leads:
- Lead records from `leads` table
- Lead assignments
- Lead status history
- Lead notes

**Impact**: Complete loss of sales leads

### 3. 💰 **Finance** (High Danger)
Deletes all finance-related data:
- Credit applications (`credit_applications`)
- Finance deals (`finance_deals`)
- Dealer-specific finance programs (`finance_programs`)
- Lender submissions (`lender_submissions`)
- Dealer-specific lenders (`lenders`)

**Impact**: Complete loss of finance and lending data

### 4. 💵 **Rebates** (Medium Danger)
Deletes rebate data:
- Rebates (`rebates`)
- Rebate applications (`rebate_applications`)

**Impact**: Loss of rebate tracking data

### 5. 💬 **AI Conversations** (Medium Danger)
Deletes DAIVE AI chat data:
- All conversations (`daive_conversations`)
- Chat history
- Voice sessions
- Customer interactions

**Impact**: Loss of AI conversation history

### 6. 👤 **Customers** (High Danger)
Deletes customer accounts:
- Customer profiles (`customers`)
- Customer authentication data
- Customer preferences

**Impact**: Customers will need to re-register

### 7. 👨‍💼 **Staff Members** (⚠️ CRITICAL DANGER)
Deletes dealership staff:
- Staff accounts (`dealership_staff`)
- Staff permissions (`staff_permissions`)
- Staff assignments

**Impact**: All staff will lose access! Use with extreme caution!

### 8. ⚙️ **Settings** (Medium Danger)
Resets settings to defaults:
- DAIVE settings (`daive_settings`)
- Follow-up settings (`followup_settings`)
- DAIVE prompts (`daive_prompts`)
- Voice settings (`voice_settings`)

**Impact**: Dealership will revert to default configuration

### 9. 📄 **Documents** (Low Danger)
Deletes generated documents:
- E-signatures (`e_signatures`)
- Deal sheets (`generated_deal_sheets`)
- Dealer-specific templates (`deal_sheet_templates`)

**Impact**: Loss of document history (regeneration possible)

### 10. 🔔 **Notifications** (Low Danger)
Deletes notifications:
- System notifications (`notifications`)

**Impact**: Minor, only clears notification history

### 11. 📊 **Analytics** (Low Danger)
Deletes analytics data:
- DAIVE analytics (`daive_analytics`)
- Usage statistics

**Impact**: Loss of historical analytics data

---

## 🎯 How to Use

### Step 1: Access the Feature
1. Login as **Super Admin**
2. Navigate to **Admin Panel** → **Super Admin**
3. Click on the **"Reset Data"** tab (🗑️ icon)

### Step 2: Select Dealer
1. Choose a dealer from the dropdown
2. View current data counts for the dealer:
   - Vehicles
   - Leads
   - Finance records
   - Rebates
   - Conversations

### Step 3: Select Categories
1. Click on the data categories you want to delete
2. Use **"Select All"** to select everything (not recommended)
3. Categories are color-coded by danger level:
   - 🔵 **Blue** - Low danger
   - 🟡 **Yellow** - Medium danger
   - 🟠 **Orange** - High danger
   - 🔴 **Red** - Critical danger

### Step 4: Confirm Action
1. Read the warning message carefully
2. Review the list of categories to be deleted
3. Type **`RESET DATA`** exactly (case-sensitive) in the confirmation field
4. Click **"Reset Selected Data"** button

### Step 5: Wait for Completion
- The system will show a loading spinner
- All deletions are wrapped in a database transaction
- If any error occurs, all changes are rolled back
- Success message shows exactly what was deleted

---

## 💻 API Endpoints

### GET `/api/super-admin/dealers-for-reset`
Fetches all dealers with data counts.

**Response:**
```json
{
  "dealers": [
    {
      "id": "uuid",
      "business_name": "Example Dealer",
      "contact_name": "John Doe",
      "email": "john@example.com",
      "city": "Dallas",
      "state": "TX",
      "vehicle_count": 150,
      "lead_count": 45,
      "finance_count": 12,
      "rebate_count": 8,
      "conversation_count": 234
    }
  ]
}
```

### POST `/api/super-admin/reset-dealership-data`
Deletes selected data categories for a dealer.

**Request:**
```json
{
  "dealerId": "uuid",
  "categories": ["vehicles", "leads", "finance"],
  "confirmationText": "RESET DATA"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Successfully reset data for Example Dealer",
  "dealer": {
    "id": "uuid",
    "business_name": "Example Dealer"
  },
  "deletedCounts": {
    "vehicles": 150,
    "leads": 45,
    "credit_applications": 12,
    "finance_deals": 8,
    "finance_programs": 3,
    "lenders": 5
  }
}
```

**Response (Error):**
```json
{
  "error": "Invalid confirmation text. Type \"RESET DATA\" exactly."
}
```

---

## 🔍 Audit Trail

Every reset action is logged to `audit_logs` table with:

```javascript
{
  userId: "uuid",              // Who performed the reset
  userEmail: "admin@example.com",
  userRole: "super_admin",
  tenantId: "dealer-uuid",     // Which dealer was affected
  actionType: "RESET_DEALERSHIP_DATA",
  resourceType: "dealer",
  resourceId: "dealer-uuid",
  description: "Reset dealership data for Example Dealer - Categories: vehicles, leads, finance",
  metadata: {
    categories: ["vehicles", "leads", "finance"],
    deletedCounts: { /* ... */ },
    dealerName: "Example Dealer"
  },
  success: true,
  created_at: "2025-11-29T..."
}
```

---

## 🚨 Important Notes

### Before Resetting Data:

1. **✅ Backup First** - Consider taking a database backup before major resets
2. **✅ Communicate** - Inform the dealership about the reset
3. **✅ Document Reason** - Keep notes on why the reset was necessary
4. **✅ Test First** - If possible, test on a demo/staging environment
5. **✅ Check Dependencies** - Some data may have foreign key relationships

### Data That Is NOT Deleted:

- ❌ Dealer account itself (`dealers` table)
- ❌ Dealer owner user account
- ❌ Global/system-level data (templates, roles)
- ❌ Audit logs (for compliance)
- ❌ Subscription/billing data

### Recovery Options:

- ⚠️ **None** - Once data is deleted, it's permanent
- ⚠️ **Database Backups** - Only way to recover is from backups
- ⚠️ **No Undo** - The feature does not have an undo function

---

## 🛠️ Technical Implementation

### Files Modified/Created:

1. **Backend Route**: `src/routes/super-admin.js`
   - Added `/dealers-for-reset` endpoint
   - Added `/reset-dealership-data` endpoint

2. **Frontend Component**: `src/components/admin/ResetDealershipData.tsx`
   - Complete UI for dealer selection
   - Category selection with visual indicators
   - Multi-step confirmation process

3. **Integration**: `src/pages/SuperAdmin.tsx`
   - Added new tab for Reset Data
   - Imported and integrated component

### Database Tables Affected:

- `vehicles`
- `leads`
- `credit_applications`
- `finance_deals`
- `finance_programs`
- `lender_submissions`
- `lenders`
- `rebates`
- `rebate_applications`
- `daive_conversations`
- `customers`
- `dealership_staff`
- `staff_permissions`
- `daive_settings`
- `followup_settings`
- `daive_prompts`
- `voice_settings`
- `e_signatures`
- `generated_deal_sheets`
- `deal_sheet_templates`
- `notifications`
- `daive_analytics`

---

## 🧪 Testing Checklist

- [ ] Super admin can access the feature
- [ ] Non-super admin users are blocked
- [ ] Dealer list loads correctly with counts
- [ ] Category selection works
- [ ] Confirmation validation works (rejects wrong text)
- [ ] Transaction rollback works on error
- [ ] Success message shows correct counts
- [ ] Audit log is created
- [ ] Database records are actually deleted
- [ ] Foreign key constraints are respected
- [ ] No orphaned records remain

---

## 📞 Support

For issues or questions about this feature:
1. Check audit logs for details
2. Review database backups if recovery is needed
3. Contact system administrator

---

**Last Updated**: 2025-11-29
**Version**: 1.0.0
**Status**: Production Ready ✅


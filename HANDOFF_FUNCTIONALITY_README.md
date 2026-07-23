# 🚀 D.A.I.V.E. Handoff Functionality

## Overview
The handoff functionality allows dealers to request and accept handoffs for conversations that require human intervention. This system provides a complete workflow for managing AI-to-human conversation transfers.

## ✨ Features

### 🔄 **Request Handoff**
- Dealers can request a handoff for any conversation
- Optional reason field for documenting why handoff is needed
- Automatic status tracking and timestamps

### ✅ **Accept Handoff**
- Dealers can accept pending handoff requests
- Automatic lead status update to "hot"
- Tracking of who accepted the handoff and when

### 📊 **Handoff Management Dashboard**
- Dedicated section showing all handoff-related conversations
- Filter by status: All, Requested, Pending, Accepted
- Real-time updates and status tracking

### 🎯 **Smart Button Logic**
- **Request Handoff**: Shows when no handoff is currently requested
- **Accept Handoff**: Shows when handoff is requested but not yet accepted
- **View/Update Status**: Always available for all conversations

## 🗄️ Database Schema

### New Columns Added
```sql
-- handoff_reason: TEXT - Reason for handoff request
-- handoff_requested_at: TIMESTAMP - When handoff was requested
-- handoff_accepted_at: TIMESTAMP - When handoff was accepted
-- handoff_accepted_by: UUID - Who accepted the handoff
-- updated_at: TIMESTAMP - Last modification timestamp
```

### Indexes Created
```sql
-- idx_daive_conversations_handoff_requested
-- idx_daive_conversations_handoff_requested_at
-- idx_daive_conversations_handoff_accepted_at
```

## 🔌 API Endpoints

### 1. Request Handoff
```
POST /api/daive/handoff/:id/request
Body: { "reason": "string" }
```
- Creates a handoff request for a conversation
- Sets `handoff_requested = true`
- Records timestamp and reason

### 2. Accept Handoff
```
POST /api/daive/handoff/:id
```
- Accepts a pending handoff request
- Sets `handoff_requested = false`
- Updates lead status to "hot"
- Records acceptance timestamp and dealer ID

### 3. Get Handoffs
```
GET /api/daive/handoffs?status=all&page=1&limit=10
```
- Retrieves handoff-related conversations
- Supports filtering by status
- Includes pagination

### 4. Update Conversation Status
```
PUT /api/daive/conversation/:id/status
Body: { "status": "new|hot|warm|cold" }
```
- Updates lead qualification status
- Refreshes conversation data

## 🎨 Frontend Components

### Actions Column
- **View Button**: Opens conversation details
- **Update Status Button**: Changes lead status
- **Request Handoff Button**: Requests human intervention
- **Accept Handoff Button**: Accepts pending handoffs

### Handoff Management Section
- Dedicated table for handoff-related conversations
- Status filtering and real-time updates
- Clear visual indicators for handoff states

## 🚀 Getting Started

### 1. Database Migration
```bash
# Run the SQL migration script
psql -d your_database -f add-handoff-columns.sql
```

### 2. Test the Functionality
```bash
# Run the test script
node test-handoff-functionality.js
```

### 3. Start the Server
```bash
node server.js
```

### 4. Navigate to Analytics
- Go to `http://localhost:8080/#/daive/analytics`
- Check the Actions column for handoff buttons
- View the new Handoff Management section

## 🔄 Workflow Examples

### Scenario 1: AI Needs Human Help
1. AI conversation reaches complexity limit
2. Dealer clicks "Request Handoff"
3. Enters reason: "Customer has complex financing questions"
4. Conversation marked for handoff
5. Human dealer can now see it in handoff queue

### Scenario 2: Dealer Accepts Handoff
1. Dealer sees pending handoff in queue
2. Clicks "Accept Handoff"
3. Lead status automatically updated to "hot"
4. Conversation removed from handoff queue
5. Dealer can now handle customer directly

### Scenario 3: Status Management
1. Dealer updates conversation status to "warm"
2. Lead qualification score updated
3. Conversation list refreshes automatically
4. Analytics reflect new status

## 🧪 Testing

### Manual Testing
1. **Request Handoff**: Click button, enter reason, verify status change
2. **Accept Handoff**: Accept pending handoff, verify acceptance
3. **Status Update**: Change lead status, verify persistence
4. **View Details**: Click view button, verify data loading

### API Testing
```bash
# Test handoff request
curl -X POST http://localhost:3000/api/daive/handoff/{id}/request \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Test handoff"}'

# Test handoff acceptance
curl -X POST http://localhost:3000/api/daive/handoff/{id} \
  -H "Authorization: Bearer {token}"

# Test status update
curl -X PUT http://localhost:3000/api/daive/conversation/{id}/status \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"status": "hot"}'
```

## 🔧 Configuration

### Environment Variables
No additional environment variables required. The system uses existing authentication and database configuration.

### Database Requirements
- PostgreSQL 12+ recommended
- UUID extension enabled
- Proper permissions for ALTER TABLE operations

## 📱 User Experience

### Visual Feedback
- Loading states during API calls
- Toast notifications for success/error
- Color-coded status badges
- Intuitive button icons

### Responsive Design
- Mobile-friendly button layouts
- Adaptive table structures
- Touch-friendly interactions

## 🚨 Error Handling

### Common Issues
1. **Database Connection**: Check PostgreSQL service status
2. **Authentication**: Verify JWT token validity
3. **Permissions**: Ensure dealer has access to conversation
4. **Data Validation**: Check status values and required fields

### Error Messages
- Clear, user-friendly error descriptions
- Console logging for debugging
- Toast notifications for user feedback

## 🔮 Future Enhancements

### Planned Features
- **Handoff Queue Management**: Priority-based queuing
- **Automated Notifications**: Email/SMS alerts for handoffs
- **Performance Metrics**: Handoff response time tracking
- **Integration**: CRM system integration for handoffs

### Customization Options
- Configurable handoff reasons
- Custom status workflows
- Role-based handoff permissions
- Automated handoff triggers

## 📞 Support

### Troubleshooting
1. Check browser console for JavaScript errors
2. Verify backend server logs
3. Test database connectivity
4. Validate API endpoint responses

### Common Solutions
- Refresh page to reload data
- Check authentication token expiration
- Verify database column existence
- Restart server after schema changes

---

**🎉 The handoff functionality is now fully integrated and ready to use!**

This system provides a seamless way for dealers to manage AI conversation handoffs, ensuring customers always get the human touch when needed.




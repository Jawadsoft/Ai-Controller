# 🧠 D.A.I.V.E. Testing Guide

## Overview
D.A.I.V.E. (Digital AI Voice Experience) is an AI-powered sales assistant integrated into your Dealer-iq system. This guide will help you test all the features.

## Prerequisites

### 1. Environment Setup
Create a `.env` file in your project root with the following variables:

```env
# Required for D.A.I.V.E.
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=1000

# Database (should already be set)
DATABASE_URL=postgresql://postgres:dealeriq@localhost:5432/vehicle_management

# Other existing variables...
```

### 2. Get an OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key to your `.env` file

## Testing Methods

### Method 1: Web Interface Testing (Recommended)

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Open the test page:**
   - Navigate to `http://localhost:3000/test-daive.html`
   - Or open the `test-daive.html` file directly in your browser

3. **Configure the test:**
   - Enter a valid Vehicle ID from your database
   - Set customer name and email
   - Click "Test Connection" to verify server connectivity

4. **Test conversations:**
   - Type messages like:
     - "Tell me about this vehicle"
     - "What's the price?"
     - "Can I schedule a test drive?"
     - "I want to speak to a human"

### Method 2: API Testing

1. **Test the chat endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/daive/chat \
     -H "Content-Type: application/json" \
     -d '{
       "vehicleId": "your-vehicle-id",
       "sessionId": "test-session-123",
       "message": "Tell me about this vehicle",
       "customerInfo": {
         "name": "Test Customer",
         "email": "test@example.com"
       }
     }'
   ```

2. **Test conversation history:**
   ```bash
   curl http://localhost:3000/api/daive/conversation/test-session-123
   ```

3. **Test health check:**
   ```bash
   curl http://localhost:3000/health
   ```

### Method 3: Node.js Script Testing

Run the automated test script:
```bash
node test-daive.js
```

## Test Scenarios

### 1. Basic Conversation Flow
- **Input:** "Hi, I'm interested in this car"
- **Expected:** D.A.I.V.E. should greet and ask how it can help
- **Lead Score:** Should be low (0-30%)

### 2. Vehicle Information Request
- **Input:** "Tell me about this vehicle's features"
- **Expected:** D.A.I.V.E. should provide vehicle details
- **Lead Score:** Should be medium (30-60%)

### 3. Pricing Inquiry
- **Input:** "What's the price and financing options?"
- **Expected:** D.A.I.V.E. should discuss pricing and financing
- **Lead Score:** Should be high (60-80%)

### 4. Test Drive Request
- **Input:** "I'd like to schedule a test drive"
- **Expected:** D.A.I.V.E. should offer to help schedule
- **Lead Score:** Should be very high (80-100%)

### 5. Human Handoff Request
- **Input:** "I want to speak to a salesperson"
- **Expected:** D.A.I.V.E. should offer handoff
- **Handoff:** Should be triggered

## Integration Testing

### 1. QR Code Integration
1. Generate a QR code for a vehicle
2. Scan the QR code
3. Verify it opens the D.A.I.V.E. chat interface
4. Test conversation with vehicle context

### 2. Lead Generation
1. Have a conversation that generates a lead
2. Check the leads table in your database
3. Verify lead qualification score is recorded
4. Test handoff functionality

### 3. Analytics Dashboard
1. Log in as a dealer
2. Navigate to D.A.I.V.E. Analytics
3. Verify conversation data is displayed
4. Test filtering and date ranges

## Troubleshooting

### Common Issues

1. **"OpenAI API key not found"**
   - Check your `.env` file
   - Verify the API key is valid
   - Ensure the server is restarted after adding the key

2. **"Vehicle not found"**
   - Verify the vehicle ID exists in your database
   - Check the vehicles table for valid IDs

3. **"Database connection failed"**
   - Ensure PostgreSQL is running
   - Check your DATABASE_URL in `.env`
   - Run the setup script: `node setup-daive-db.js`

4. **"CORS error"**
   - Check that the server is running on the correct port
   - Verify the frontend URL is allowed in CORS settings

### Debug Mode

Enable debug logging by adding to your `.env`:
```env
DEBUG=daive:*
```

## Performance Testing

### Load Testing
1. Send multiple concurrent requests
2. Monitor response times
3. Check OpenAI API rate limits
4. Verify database performance

### Memory Testing
1. Run extended conversations
2. Monitor memory usage
3. Check for memory leaks
4. Test conversation history limits

## Security Testing

1. **Input Validation**
   - Test with malicious input
   - Verify SQL injection protection
   - Check XSS prevention

2. **Authentication**
   - Test protected endpoints
   - Verify dealer access controls
   - Check session management

3. **API Security**
   - Test rate limiting
   - Verify CORS settings
   - Check input sanitization

## Expected Results

### Successful Test Outcomes
- ✅ AI responds appropriately to queries
- ✅ Lead scores are calculated correctly
- ✅ Conversations are saved to database
- ✅ Handoff requests work properly
- ✅ Analytics data is generated
- ✅ Voice features work (if configured)

### Performance Benchmarks
- Response time: < 3 seconds
- Lead qualification accuracy: > 80%
- Conversation retention: 100%
- API uptime: > 99%

## Next Steps After Testing

1. **Configure Production Settings**
   - Set up proper OpenAI API limits
   - Configure production database
   - Set up monitoring and logging

2. **Customize Prompts**
   - Modify AI responses for your dealership
   - Add brand-specific messaging
   - Configure handoff triggers

3. **Integrate with Existing Systems**
   - Connect to your CRM
   - Set up email notifications
   - Configure lead routing

4. **Deploy to Production**
   - Set up production environment
   - Configure SSL certificates
   - Set up backup systems

## Support

If you encounter issues:
1. Check the console logs
2. Review the database for errors
3. Verify API key permissions
4. Contact support with error details

---

**Happy Testing! 🚗🤖** 
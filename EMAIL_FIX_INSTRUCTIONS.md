# Email Verification Not Sending - Fix Instructions

## Problem Identified

The "resend verification email" feature says "email will be sent if account exists" but no email is being received. This is because the email service is not properly configured.

## Root Cause

Looking at your `.env` file, there are two email configurations, but both have issues:

### 1. Gmail Configuration (Currently Not Working)
```env
GMAIL_USER=mitiesoft@gmail.com
GMAIL_APP_PASSWORD=loitec2024@
```

**Problem**: The Gmail App Password `loitec2024@` is **invalid**. Gmail App Passwords must be:
- Exactly 16 characters
- Generated from Google Account Settings
- No special characters or spaces

### 2. Office365/SMTP Configuration (Currently Being Used)
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@dealeriq.co
SMTP_PASS=lhlccnxjfxwpbghf
```

**Status**: This configuration is being used by default (SMTP has priority over Gmail), but it may not be working if:
- The password is incorrect
- The account requires additional authentication
- Office365 is blocking the connection

## Solutions

Choose ONE of the following options:

### Option 1: Fix Gmail Configuration (Recommended for Testing)

1. **Generate a Gmail App Password**:
   - Go to https://myaccount.google.com/security
   - Enable 2-Factor Authentication if not already enabled
   - Go to "App passwords" under Security
   - Generate a new app password for "Mail"
   - You'll get a 16-character password like `abcd efgh ijkl mnop`

2. **Update .env file**:
   ```env
   GMAIL_USER=mitiesoft@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop    # Replace with your actual 16-char password (no spaces)
   ```

3. **Temporarily comment out SMTP to force Gmail**:
   ```env
   # SMTP_HOST=smtp.office365.com
   # SMTP_PORT=587
   # SMTP_SECURE=false
   # SMTP_USER=noreply@dealeriq.co
   # SMTP_PASS=lhlccnxjfxwpbghf
   ```

### Option 2: Fix Office365 Configuration (Recommended for Production)

1. **Verify Office365 credentials**:
   - Log into https://outlook.office365.com with `noreply@dealeriq.co`
   - Confirm the password works
   - Check if "Modern Authentication" is enabled

2. **Update password in .env if needed**:
   ```env
   SMTP_HOST=smtp.office365.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=noreply@dealeriq.co
   SMTP_PASS=YOUR_CORRECT_PASSWORD_HERE
   ```

3. **Alternative Office365 settings** (if the above doesn't work):
   ```env
   SMTP_HOST=smtp-mail.outlook.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=noreply@dealeriq.co
   SMTP_PASS=YOUR_PASSWORD
   ```

## Testing the Fix

After updating your `.env` file:

1. **Restart the development server**:
   ```bash
   # Press Ctrl+C to stop the current server
   ./start-dev
   ```

2. **Check the startup logs**:
   You should see:
   ```
   ✅ D.A.I.V.E. Email Service configured with SMTP (from .env)
      📧 Server: smtp.office365.com:587
      📧 Sender: noreply@dealeriq.co
   🔍 Testing email connection...
   ✅ Email connection verified successfully!
   ```

3. **If connection test fails**, you'll see:
   ```
   ❌ Email connection test failed: [error message]
      🔑 Authentication failed - check your email credentials
   ```

4. **Test sending verification email**:
   - Try the "Resend Verification Email" feature again
   - Check the terminal logs for detailed error messages

## What I Fixed in the Code

1. **Better logging** (`src/lib/daiveEmailService.js`):
   - Added connection testing on startup
   - Shows which email service is being used
   - Displays detailed error messages

2. **Connection verification** (`src/lib/daiveEmailService.js`):
   - Added `testConnection()` method that runs on startup
   - Tests the email connection before attempting to send
   - Provides specific error messages for common issues

3. **Enhanced error reporting** (`src/middleware/customerAuth.js`):
   - Better error logging when sending emails fails
   - Shows specific error codes (EAUTH, ETIMEDOUT, etc.)
   - Helps identify exactly what's wrong

## Quick Test Commands

After fixing the configuration, you can test if email is working:

```bash
# Check if the email service initialized correctly
# Look for "✅ Email connection verified successfully!" in the logs

# Try sending a verification email through the API
curl -X POST http://localhost:3000/api/customer-auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## Next Steps

1. Choose which email service to use (Gmail or Office365)
2. Update the `.env` file with correct credentials
3. Restart the server with `./start-dev`
4. Check the startup logs for "✅ Email connection verified successfully!"
5. Test the resend verification feature
6. Check your email inbox (and spam folder)

## Still Not Working?

If emails still aren't sending after fixing the credentials, check:

1. **Firewall/Network**: Your network might be blocking outbound SMTP connections
2. **Email provider security**: Gmail/Office365 might be blocking the connection for security reasons
3. **Spam folder**: Verification emails might be going to spam
4. **Email quotas**: You might have hit daily sending limits

Check the terminal logs for detailed error messages that will help identify the issue.

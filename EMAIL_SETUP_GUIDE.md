# 📧 D.A.I.V.E. Email Notifications Setup Guide

## 🎯 Overview
This guide will help you set up email notifications for D.A.I.V.E. handoffs and lead generation. Since your server doesn't allow .env file uploads, we use a separate configuration file.

## 📁 Files Created
- `src/config/emailConfig.js` - Email configuration file
- `setup-email-config.js` - Setup helper script
- `test-email-config.js` - Configuration test script

## 🔧 Step 1: Get Gmail App Password

1. **Go to Google Account Security**
   - Visit: https://myaccount.google.com/security
   - Sign in with your Gmail account

2. **Enable 2-Step Verification** (if not already enabled)
   - Click "2-Step Verification" under "Signing in to Google"
   - Follow the setup process

3. **Generate App Password**
   - Go back to Security page
   - Click "App passwords" under "Signing in to Google"
   - Select "Mail" as the app
   - Select "Other (custom name)" as the device
   - Enter "D.A.I.V.E. Notifications" as the name
   - Click "Generate"
   - **Copy the 16-character password** (you won't see it again!)

## 🔧 Step 2: Update Configuration File

1. **Open `src/config/emailConfig.js`**
2. **Find this line:**
   ```javascript
   appPassword: 'your-gmail-app-password',
   ```
3. **Replace with your actual app password:**
   ```javascript
   appPassword: 'abcd efgh ijkl mnop', // Your 16-character password
   ```
4. **Save the file**

## 🔧 Step 3: Upload to Server

Upload these files to your server:
- `src/config/emailConfig.js` ✅
- `src/lib/daiveEmailService.js` ✅ (already updated)
- All other D.A.I.V.E. files ✅

## 🧪 Step 4: Test Configuration

1. **Run the test script:**
   ```bash
   node test-email-config.js
   ```

2. **Expected output:**
   ```
   ✅ Gmail App Password is configured!
   ✅ Email transporter is ready!
   📧 D.A.I.V.E. will send notifications to: syedtradeleads@gmail.com
   ```

## 🎯 Step 5: Test Email Notifications

1. **Go to D.A.I.V.E. Analytics Dashboard**
2. **Request a handoff** for any conversation
3. **Check your email** (syedtradeleads@gmail.com) for the notification
4. **Create a lead** and check for lead generation notification

## 📧 What Notifications Will Be Sent

### Handoff Request Notification
- **When:** AI requests human assistance
- **To:** syedtradeleads@gmail.com (or custom notification email)
- **Includes:** Customer info, lead score, handoff reason, vehicle details

### Handoff Acceptance Notification
- **When:** Dealer accepts a handoff
- **To:** syedtradeleads@gmail.com (or custom notification email)
- **Includes:** Customer info, lead score, follow-up instructions

### Lead Generation Notification
- **When:** Qualified lead is automatically created
- **To:** syedtradeleads@gmail.com (or custom notification email)
- **Includes:** Lead details, customer info, interest level

## ⚙️ Custom Notification Email

To change the notification email address:

1. **Go to D.A.I.V.E. Settings → Lead Management**
2. **Set "Lead Notification Email"** to your desired email
3. **Save settings**
4. **All notifications will be sent to this email instead**

## 🔍 Troubleshooting

### Email Not Sending
- ✅ Check Gmail app password is correct
- ✅ Verify 2-Step Verification is enabled
- ✅ Check server logs for error messages
- ✅ Test with: `node test-email-config.js`

### Wrong Email Address
- ✅ Check Lead Management settings
- ✅ Verify `src/config/emailConfig.js` default email
- ✅ Check dealer-specific notification email settings

### Server Errors
- ✅ Ensure all files are uploaded correctly
- ✅ Check file permissions
- ✅ Verify Node.js modules are installed

## 📋 Configuration Summary

```javascript
// src/config/emailConfig.js
export const emailConfig = {
  gmail: {
    user: 'syedtradeleads@gmail.com',
    appPassword: 'your-actual-16-char-password', // ← Update this
    service: 'gmail'
  },
  defaultNotificationEmail: 'syedtradeleads@gmail.com'
};
```

## 🎉 Success!

Once configured, D.A.I.V.E. will automatically send email notifications for:
- ✅ Handoff requests
- ✅ Handoff acceptances  
- ✅ Lead generation
- ✅ All using your existing SMTP settings

The system is now ready for production use!

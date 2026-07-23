# 📧 Email Verification System for DealerIQ

This document explains how to set up and use the email verification system for dealer signup in DealerIQ.

## 🚀 Features

- **Automatic Email Verification**: Sends verification emails when dealers sign up
- **Secure Token Generation**: Uses cryptographically secure tokens for verification
- **Token Expiration**: Verification links expire after 24 hours
- **Resend Functionality**: Users can request new verification emails
- **Professional Email Templates**: Beautiful HTML and text email templates
- **SMTP Support**: Works with any SMTP provider (Gmail, SendGrid, etc.)
- **Welcome Emails**: Sends welcome emails after successful verification

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install nodemailer
```

### 2. Database Migration

Run the email verification migration to add required fields:

```bash
node run-email-verification-migration.js
```

This will add the following fields to the `users` table:
- `verification_token`: Stores the verification token
- `verification_token_expires`: Token expiration timestamp
- `email_verified`: Boolean flag for verification status

### 3. Environment Configuration

Add SMTP settings to your `.env` file:

#### For Development (Gmail)

```env
# Gmail Configuration (Recommended for development)
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password

# Optional: Override with custom SMTP settings
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
```

#### For Production (Custom SMTP)

```env
# Production SMTP Configuration
NODE_ENV=production
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
```

### 4. Gmail App Password Setup

If using Gmail for development:

1. Enable 2-factor authentication on your Google account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Generate a new app password for "Mail"
4. Use this password in your `.env` file

## 🔧 Configuration Options

### Email Service Configuration

The email service automatically detects your environment:

- **Development**: Uses Gmail SMTP with app password
- **Production**: Uses custom SMTP server settings

### Email Templates

The system includes two email templates:

1. **Verification Email**: Sent during signup with verification link
2. **Welcome Email**: Sent after successful verification

Both templates include:
- Professional HTML design
- Plain text fallback
- Responsive layout
- Branded with DealerIQ styling

## 📱 Frontend Integration

### New Routes

- `/verify-email` - Email verification page
- Handles verification tokens and expired links

### Updated Components

- **AuthForm**: Now shows verification message after signup
- **EmailVerification**: Dedicated verification page
- Handles success, error, and expired token states

### User Flow

1. User signs up with dealer information
2. System creates account with `email_verified = false`
3. Verification email is sent automatically
4. User clicks verification link in email
5. Account is verified and welcome email is sent
6. User can now log in normally

## 🔒 Security Features

- **Secure Tokens**: 32-byte random hex tokens
- **Token Expiration**: 24-hour expiration window
- **One-time Use**: Tokens are cleared after verification
- **Rate Limiting**: Built-in protection against abuse
- **Input Validation**: Comprehensive validation on all endpoints

## 🧪 Testing

### Test Email Service

```bash
node test-email-service.js
```

This script will:
- Check environment configuration
- Test SMTP connection
- Send test verification and welcome emails
- Provide troubleshooting guidance

### Test Registration Flow

1. Start your development server
2. Navigate to `/auth` and switch to signup mode
3. Fill out the dealer registration form
4. Check your email for verification link
5. Click the verification link
6. Verify you can now log in

## 🚨 Troubleshooting

### Common Issues

#### SMTP Connection Failed

- Check your SMTP credentials
- Verify firewall/network settings
- For Gmail, ensure you have an App Password
- Check if your email provider allows SMTP access

#### Emails Not Sending

- Verify environment variables are set correctly
- Check server logs for error messages
- Test SMTP connection with the test script
- Ensure your email provider allows outgoing SMTP

#### Verification Links Not Working

- Check if the verification route is properly configured
- Verify the frontend route is added to App.tsx
- Check browser console for JavaScript errors
- Ensure the backend API is running

### Debug Mode

Enable debug logging by setting:

```env
DEBUG=email:*
```

## 📊 API Endpoints

### POST /api/auth/register

Updated to include email verification:
- Generates verification token
- Sets `email_verified = false`
- Sends verification email
- Returns `requiresVerification: true`

### GET /api/auth/verify-email/:token

Verifies email addresses:
- Validates verification token
- Checks token expiration
- Updates user verification status
- Sends welcome email
- Clears verification token

### POST /api/auth/resend-verification

Resends verification emails:
- Validates email address
- Generates new verification token
- Sends new verification email
- Updates token expiration

### POST /api/auth/login

Updated to check verification status:
- Returns 403 if email not verified
- Includes `requiresVerification: true` in error response

## 🔄 Database Schema Changes

```sql
-- New columns added to users table
ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN verification_token_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;

-- Index for performance
CREATE INDEX idx_users_verification_token ON users(verification_token);
```

## 🎯 Production Deployment

### Environment Variables

Ensure these are set in production:

```env
NODE_ENV=production
SMTP_HOST=your-production-smtp-server
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
FRONTEND_URL=https://yourdomain.com
```

### SMTP Providers

Recommended production SMTP providers:
- **SendGrid**: Reliable, good deliverability
- **Mailgun**: Developer-friendly, good pricing
- **Amazon SES**: Cost-effective for high volume
- **Postmark**: Excellent deliverability

### Monitoring

Monitor these metrics in production:
- Email delivery rates
- Verification completion rates
- Failed verification attempts
- SMTP error rates

## 📝 Customization

### Email Templates

Modify email templates in `src/lib/emailService.js`:
- Update HTML styling
- Change email content
- Modify branding elements
- Add custom fields

### Token Expiration

Change token expiration time:

```javascript
// In src/routes/auth.js
const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
```

### Email Content

Customize email subjects and content in the email service:
- Update subject lines
- Modify email body text
- Change call-to-action buttons
- Update branding elements

## 🤝 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Run the test script: `node test-email-service.js`
3. Review server logs for error messages
4. Verify environment configuration
5. Test SMTP connection manually

## 📚 Additional Resources

- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail SMTP Setup](https://support.google.com/mail/answer/7126229)
- [Email Best Practices](https://www.emailjs.com/docs/best-practices/)
- [SMTP Security](https://www.rfc-editor.org/rfc/rfc8314.html)

---

**Note**: This email verification system is designed to be secure, user-friendly, and production-ready. Make sure to test thoroughly in your development environment before deploying to production.

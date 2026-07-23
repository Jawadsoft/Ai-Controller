# Email Configuration Guide

## Overview
All email services in DealerIQ now use a centralized `FROM_EMAIL` environment variable for the sender address.

## Environment Variable

Add this to your `.env` file:

```env
# Email From Address (Sender)
FROM_EMAIL=info@mitiesoft.com

# SMTP Configuration (Required)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password

# Frontend URL (for email links)
FRONTEND_URL=https://app.dealeriq.co
```

## Priority Order

The system will use the following priority when determining the "from" email address:

1. **`FROM_EMAIL`** (highest priority) - Use this for your custom sender address
2. **`SMTP_USER`** (fallback) - Uses SMTP username if FROM_EMAIL not set
3. **`GMAIL_USER`** (fallback) - Uses Gmail if neither above are set
4. **`info@mitiesoft.com`** (default fallback) - Hardcoded fallback

## Example Configuration

### Production (Recommended)
```env
FROM_EMAIL=info@mitiesoft.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info@mitiesoft.com
SMTP_PASS=your-app-password
FRONTEND_URL=https://app.dealeriq.co
```

### Development
```env
FROM_EMAIL=info@mitiesoft.com
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=test@example.com
SMTP_PASS=test123
FRONTEND_URL=http://localhost:8080
```

## Files Updated

All email services now use the `FROM_EMAIL` variable:

### Core Email Service
- ✅ `src/lib/emailService.js`
  - `sendVerificationEmail()`
  - `sendWelcomeEmail()`
  - `sendStaffInvitationEmail()`

### Specialized Services
- ✅ `src/lib/daiveEmailService.js`
  - Handoff request notifications
  - Handoff acceptance notifications
  - Lead generation notifications
  - Credit application emails

- ✅ `src/lib/followupAutomation.js`
  - Automatic follow-up emails

- ✅ `src/lib/financeNotificationService.js`
  - Finance deal notifications

- ✅ `src/lib/marketingScheduler.js`
  - Marketing campaign emails

## Testing

To verify the email configuration:

```bash
# Start the backend server
npm run dev

# Check the console for SMTP initialization message
# Should show: ✅ SMTP configured: smtp.example.com:587
```

### Send Test Email

You can use the existing test script:

```bash
node test-email-sending.js
```

Or create a test staff member to trigger the invitation email.

## Email Types Sent

### 1. **Verification Emails**
- Sent when: New user registers or staff member is created
- From: `"DealerIQ" <info@mitiesoft.com>`
- Purpose: Verify email address

### 2. **Staff Invitation Emails**
- Sent when: Admin adds new staff member
- From: `"DealerIQ" <info@mitiesoft.com>`
- Purpose: Send credentials and verification link

### 3. **Follow-up Emails**
- Sent when: Automated follow-up rules trigger
- From: `"DAIVE Follow-Up System" <info@mitiesoft.com>`
- Purpose: Engage with leads automatically

### 4. **Finance Notifications**
- Sent when: Finance deals are created/updated
- From: `"{Dealer Name}" <info@mitiesoft.com>`
- Purpose: Notify about finance activities

### 5. **DAIVE Notifications**
- Sent when: AI needs human intervention
- From: `"D.A.I.V.E." <info@mitiesoft.com>`
- Purpose: Handoff requests, lead generation

## Troubleshooting

### Emails not sending?

1. **Check SMTP configuration**
   ```bash
   # Verify environment variables are loaded
   echo $FROM_EMAIL
   echo $SMTP_HOST
   echo $SMTP_USER
   ```

2. **Check SMTP connection**
   - Ensure SMTP_HOST and SMTP_PORT are correct
   - Verify SMTP_USER and SMTP_PASS are valid
   - Check if your SMTP provider allows the FROM_EMAIL address

3. **Check firewall/security**
   - Some providers block port 587
   - Gmail requires "App Passwords" (not regular password)
   - Some providers require whitelisting sender addresses

4. **Check logs**
   ```bash
   # Backend logs will show:
   ✅ SMTP configured: smtp.gmail.com:587
   📧 Invitation email sent to user@example.com
   
   # Or errors:
   ❌ Error sending email: Authentication failed
   ```

### Common Issues

**Issue**: "Authentication failed"
- **Solution**: Check SMTP_USER and SMTP_PASS are correct
- For Gmail: Use App Password, not regular password

**Issue**: "Sender address rejected"
- **Solution**: Ensure FROM_EMAIL matches your SMTP provider's allowed senders
- Some providers only allow emails from their domain

**Issue**: "Connection timeout"
- **Solution**: Check SMTP_PORT (usually 587 for TLS, 465 for SSL)
- Verify firewall isn't blocking outbound SMTP

## Gmail Configuration

If using Gmail:

1. **Enable 2-Factor Authentication** on your Google account
2. **Create App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password
3. **Update .env**:
   ```env
   FROM_EMAIL=info@mitiesoft.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=info@mitiesoft.com
   SMTP_PASS=your-16-char-app-password
   ```

## Security Best Practices

1. ✅ Never commit `.env` file to version control
2. ✅ Use App Passwords instead of account passwords
3. ✅ Rotate SMTP credentials regularly
4. ✅ Monitor email sending for suspicious activity
5. ✅ Use SPF/DKIM records for your domain
6. ✅ Implement rate limiting for email sending

## Support

If you continue to have email issues:

1. Check the backend console logs
2. Verify all environment variables are set
3. Test SMTP connection with test script
4. Contact your SMTP provider for specific requirements
5. Review their documentation for sender restrictions

## Deployment Checklist

When deploying to production:

- [ ] Set `FROM_EMAIL=info@mitiesoft.com` in production `.env`
- [ ] Verify SMTP credentials are correct
- [ ] Test email sending after deployment
- [ ] Update DNS records (SPF, DKIM) if using custom domain
- [ ] Monitor email delivery rates
- [ ] Set up email bounce handling

---

**Last Updated**: December 2024
**Version**: 2.0


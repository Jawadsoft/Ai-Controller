# Social Authentication Setup Guide

This guide will help you set up social authentication (Google, Facebook, GitHub) for the DealerIQ application.

## 🚀 Quick Start

1. **Set up OAuth applications** for each provider you want to use
2. **Add environment variables** to your `.env` file
3. **Start the application** and test the social login

## 📋 Prerequisites

- Node.js and npm installed
- PostgreSQL database running
- Domain name (for production) or localhost (for development)

## 🔧 OAuth Provider Setup

### Google OAuth Setup

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Create a new project or select existing one

2. **Enable Google+ API**
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"

4. **Configure OAuth Consent Screen**
   - Add your application name
   - Add authorized domains
   - Add scopes: `email`, `profile`

5. **Set Authorized Redirect URIs**
   - For development: `http://localhost:3000/api/auth/google/callback`
   - For production: `https://yourdomain.com/api/auth/google/callback`

6. **Copy Credentials**
   - Copy the Client ID and Client Secret
   - Add them to your `.env` file

### Facebook OAuth Setup

1. **Go to Facebook Developers**
   - Visit: https://developers.facebook.com/
   - Create a new app or use existing one

2. **Add Facebook Login Product**
   - Go to "Add Product" > "Facebook Login"
   - Choose "Web" platform

3. **Configure Facebook Login**
   - Set Valid OAuth Redirect URIs:
     - Development: `http://localhost:3000/api/auth/facebook/callback`
     - Production: `https://yourdomain.com/api/auth/facebook/callback`

4. **Get App Credentials**
   - Copy App ID and App Secret
   - Add them to your `.env` file

### GitHub OAuth Setup

1. **Go to GitHub Settings**
   - Visit: https://github.com/settings/developers
   - Click "New OAuth App"

2. **Configure OAuth App**
   - Application name: "DealerIQ"
   - Homepage URL: Your application URL
   - Authorization callback URL:
     - Development: `http://localhost:3000/api/auth/github/callback`
     - Production: `https://yourdomain.com/api/auth/github/callback`

3. **Copy Credentials**
   - Copy Client ID and Client Secret
   - Add them to your `.env` file

## 🔐 Environment Variables

Add these variables to your `.env` file:

```env
# Social Authentication
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Session Secret (for OAuth)
SESSION_SECRET=your-session-secret-key-here

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

## 🗄️ Database Migration

The social authentication fields have been added to the database:

```sql
-- Added fields to users table:
- name (VARCHAR)
- google_id (VARCHAR, UNIQUE)
- facebook_id (VARCHAR, UNIQUE)
- github_id (VARCHAR, UNIQUE)
- email_verified (BOOLEAN)
```

Run the migration:
```bash
node migrate-social-auth.js
```

## 🎯 Features

### What's Included

✅ **Multiple OAuth Providers**
- Google OAuth 2.0
- Facebook OAuth
- GitHub OAuth

✅ **Automatic User Creation**
- Creates user account on first social login
- Automatically creates dealer profile
- Sets email as verified

✅ **Account Linking**
- Links multiple social accounts to same email
- Prevents duplicate accounts

✅ **Seamless Integration**
- Works alongside traditional email/password auth
- Automatic redirect after successful login
- JWT token generation

✅ **Frontend Components**
- Social login buttons
- Loading states
- Error handling
- Responsive design

### User Flow

1. **User clicks social login button**
2. **Redirected to OAuth provider** (Google/Facebook/GitHub)
3. **User authorizes the application**
4. **Redirected back with authorization code**
5. **Backend exchanges code for user info**
6. **User account created/linked if needed**
7. **JWT token generated and sent to frontend**
8. **User redirected to dashboard**

## 🧪 Testing

### Development Testing

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Visit the auth page:**
   ```
   http://localhost:5173/auth
   ```

3. **Test social login buttons**
   - Click on any enabled provider
   - Complete OAuth flow
   - Verify user creation and login

### Production Testing

1. **Update redirect URIs** in OAuth provider settings
2. **Set production environment variables**
3. **Test with real domain**

## 🔒 Security Considerations

### Best Practices

✅ **Environment Variables**
- Never commit OAuth secrets to version control
- Use different credentials for dev/prod

✅ **HTTPS in Production**
- OAuth providers require HTTPS in production
- Set up SSL certificates

✅ **Session Security**
- Use strong session secrets
- Set secure cookies in production

✅ **Error Handling**
- Don't expose sensitive information in errors
- Log authentication failures

### OAuth Scopes

- **Google**: `profile`, `email`
- **Facebook**: `email`
- **GitHub**: `user:email`

## 🐛 Troubleshooting

### Common Issues

**"Invalid redirect URI"**
- Check redirect URIs in OAuth provider settings
- Ensure exact match with callback URLs

**"Client ID not found"**
- Verify environment variables are set correctly
- Check for typos in client IDs

**"Database connection error"**
- Ensure PostgreSQL is running
- Check database connection string

**"Session not working"**
- Verify SESSION_SECRET is set
- Check cookie settings

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

## 📚 API Endpoints

### Authentication Endpoints

```
GET  /api/auth/providers     - Get available OAuth providers
GET  /api/auth/google        - Initiate Google OAuth
GET  /api/auth/facebook      - Initiate Facebook OAuth
GET  /api/auth/github        - Initiate GitHub OAuth
```

### Callback Endpoints

```
GET  /api/auth/google/callback   - Google OAuth callback
GET  /api/auth/facebook/callback - Facebook OAuth callback
GET  /api/auth/github/callback   - GitHub OAuth callback
```

## 🎨 Customization

### Styling Social Buttons

Edit `src/components/auth/SocialLogin.tsx` to customize:
- Button colors and styles
- Icons and branding
- Layout and spacing

### Adding New Providers

1. **Install passport strategy:**
   ```bash
   npm install passport-[provider]
   ```

2. **Add strategy to `src/lib/passport.js`**
3. **Add routes to `src/routes/auth.js`**
4. **Update frontend component**

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review OAuth provider documentation
3. Check application logs for errors

## 🚀 Deployment

### Production Checklist

- [ ] Set up HTTPS/SSL certificates
- [ ] Configure production OAuth apps
- [ ] Set production environment variables
- [ ] Update redirect URIs
- [ ] Test all OAuth flows
- [ ] Monitor authentication logs

---

**Note**: This social authentication system is designed to work alongside the existing email/password authentication. Users can use either method to access their accounts. 
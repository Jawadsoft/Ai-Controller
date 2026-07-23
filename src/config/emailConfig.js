/**
 * D.A.I.V.E. Email Configuration
 * 
 * This file contains email settings for D.A.I.V.E. notifications.
 * Since .env files cannot be uploaded to the server, we use this
 * configuration file instead.
 * 
 * IMPORTANT: Update the GMAIL_APP_PASSWORD with your actual Gmail app password
 * before deploying to production.
 */

export const emailConfig = {
  // Gmail SMTP Configuration
  gmail: {
    user: 'syedtradeleads@gmail.com',
    appPassword: 'your-gmail-app-password', // Replace with your actual Gmail app password
    service: 'gmail'
  },

  // Alternative SMTP Configuration (if not using Gmail)
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    user: 'syedtradeleads@gmail.com',
    password: 'your-gmail-app-password' // Replace with your actual Gmail app password
  },

  // Default notification email (fallback)
  defaultNotificationEmail: 'syedtradeleads@gmail.com',

  // Email templates configuration
  templates: {
    from: 'D.A.I.V.E. <syedtradeleads@gmail.com>',
    replyTo: 'syedtradeleads@gmail.com'
  }
};

export default emailConfig;


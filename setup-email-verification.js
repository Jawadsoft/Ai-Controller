import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📧 DealerIQ Email Verification Setup\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

if (!envExists) {
  console.log('❌ No .env file found. Creating one from .env.example...');
  
  const examplePath = path.join(__dirname, '.env.example');
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('✅ Created .env file from .env.example');
  } else {
    console.log('❌ No .env.example file found. Please create a .env file manually.');
    process.exit(1);
  }
}

console.log('\n🔧 Email Verification Configuration\n');

console.log('Choose your email provider:');
console.log('1. Gmail (Recommended for development)');
console.log('2. Custom SMTP Server (Production)');
console.log('3. Skip configuration\n');

// For now, just provide instructions
console.log('📋 Manual Configuration Required:\n');

console.log('For Gmail (Development):');
console.log('1. Enable 2-factor authentication on your Google account');
console.log('2. Go to: https://myaccount.google.com/apppasswords');
console.log('3. Generate an App Password for "Mail"');
console.log('4. Add these lines to your .env file:');
console.log('   GMAIL_USER=your-gmail@gmail.com');
console.log('   GMAIL_APP_PASSWORD=your-gmail-app-password\n');

console.log('For Custom SMTP (Production):');
console.log('1. Add these lines to your .env file:');
console.log('   NODE_ENV=production');
console.log('   SMTP_HOST=smtp.your-provider.com');
console.log('   SMTP_PORT=587');
console.log('   SMTP_SECURE=false');
console.log('   SMTP_USER=your-smtp-username');
console.log('   SMTP_PASS=your-smtp-password\n');

console.log('📝 Next Steps:');
console.log('1. Update your .env file with the SMTP settings above');
console.log('2. Test the email service: node test-email-service.js');
console.log('3. Start your development server and test the signup flow');
console.log('4. Check the EMAIL_VERIFICATION_README.md for detailed instructions\n');

console.log('🎯 Testing Your Setup:');
console.log('After configuring your .env file, run:');
console.log('   node test-email-service.js');
console.log('This will test your SMTP connection and send test emails.\n');

console.log('📚 Documentation:');
console.log('See EMAIL_VERIFICATION_README.md for complete setup and troubleshooting guide.');

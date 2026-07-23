/**
 * Send Test Follow-Up Emails to syedtradeleads
 * This will create sample scenarios and send actual emails
 */

import { pool } from './src/database/connection.js';
import nodemailer from 'nodemailer';

const TEST_EMAIL = 'syedtradeleads@gmail.com'; // Update if different
const TEST_DEALER_ID = '857310bf-94a6-4fbb-b08b-1b5fa5f82bfb';

async function sendTestEmails() {
  const client = await pool.connect();
  
  try {
    console.log('📧 Sending Test Follow-Up Emails to:', TEST_EMAIL);
    console.log('=' .repeat(60));

    // Check SMTP configuration (using existing SMTP_ variables)
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('\n⚠️  SMTP not configured in .env');
      console.log('\nTo send emails, add to .env:');
      console.log('SMTP_HOST=your.smtp.server');
      console.log('SMTP_PORT=587');
      console.log('SMTP_USER=info@mitiesoft.com');
      console.log('SMTP_PASS=your_password');
      console.log('\n📝 Showing preview instead...\n');
      
      await showEmailPreviews(client);
      return;
    }

    // Create SMTP transporter using existing config
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    console.log('\n✅ SMTP configured, sending emails...\n');

    // ============================================
    // EMAIL 1: Hot Lead First Contact
    // ============================================
    
    console.log('📨 Email 1: Hot Lead - Initial Follow-Up');
    
    const email1 = await transporter.sendMail({
      from: `"DAIVE Follow-Up System" <${process.env.SMTP_USER || 'info@mitiesoft.com'}>`,
      to: TEST_EMAIL,
      subject: '🚗 Your 2024 Honda CR-V is waiting!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Your Vehicle is Waiting! 🚗</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; color: #333; margin-top: 0;">Hi Syed,</p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #555;">
              Great news! The <strong>2024 Honda CR-V</strong> you inquired about is still available.
            </p>

            <div style="background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #667eea;">✨ What Makes It Special:</h3>
              <ul style="line-height: 1.8;">
                <li>✓ Advanced safety features</li>
                <li>✓ Excellent fuel economy (28 MPG city / 34 MPG highway)</li>
                <li>✓ Perfect for families</li>
                <li>✓ Available for immediate delivery</li>
              </ul>
            </div>

            <div style="background: #667eea; color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">🎁 Special Offer This Week:</h3>
              <ul style="line-height: 1.8; margin: 10px 0;">
                <li>→ 2.9% APR for qualified buyers</li>
                <li>→ $2,000 loyalty bonus if you trade in</li>
                <li>→ Free first oil change</li>
              </ul>
            </div>

            <p style="font-size: 16px; color: #555;">
              Can I answer any questions? I'm here to help!
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                Schedule Test Drive
              </a>
            </div>

            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Best regards,<br>
              <strong>DAIVE Follow-Up System</strong><br>
              Your Personal Auto Assistant
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              This is an automated follow-up message from your DAIVE system.<br>
              Reply STOP to unsubscribe from future messages.
            </p>
          </div>
        </div>
      `,
      text: `Hi Syed,

Great news! The 2024 Honda CR-V you inquired about is still available.

What Makes It Special:
✓ Advanced safety features
✓ Excellent fuel economy
✓ Perfect for families
✓ Available for immediate delivery

Special Offer This Week:
→ 2.9% APR for qualified buyers
→ $2,000 loyalty bonus if you trade in
→ Free first oil change

Can I answer any questions? I'm here to help!

Schedule your test drive: [Click here]

Best regards,
DAIVE Follow-Up System

---
Reply STOP to unsubscribe`
    });

    console.log('✅ Sent! Message ID:', email1.messageId);

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ============================================
    // EMAIL 2: Unsold Visit Recovery
    // ============================================
    
    console.log('\n📨 Email 2: Unsold Visit - Thank You');
    
    const email2 = await transporter.sendMail({
      from: `"DAIVE Follow-Up System" <${process.env.SMTP_USER || 'info@mitiesoft.com'}>`,
      to: TEST_EMAIL,
      subject: 'Great meeting you today!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #10b981; color: white; padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Thanks for Visiting! 🙏</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; color: #333; margin-top: 0;">Hi Syed,</p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #555;">
              It was wonderful meeting you today! Thanks for taking the time to visit us and test drive the <strong>2024 Ford F-150</strong>.
            </p>

            <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 16px; color: #0c4a6e;">
                💭 <strong>I know you mentioned wanting to think it over.</strong><br>
                That's completely understandable - it's a big decision!
              </p>
            </div>

            <p style="font-size: 16px; color: #555;">
              If any questions come up, I'm just a text or call away. No pressure at all!
            </p>

            <div style="background: white; padding: 20px; border: 2px solid #10b981; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #10b981;">📞 How to Reach Me:</h3>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="padding: 5px 0;">📱 Phone: (555) 123-4567</li>
                <li style="padding: 5px 0;">📧 Email: Reply to this email</li>
                <li style="padding: 5px 0;">💬 Text: Just reply to my earlier SMS</li>
              </ul>
            </div>

            <p style="font-size: 16px; color: #555;">
              Take your time with the decision. I'll check in with you in a couple of days.
            </p>

            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Best regards,<br>
              <strong>Your DAIVE Team</strong>
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              Automated follow-up from DAIVE | Reply STOP to unsubscribe
            </p>
          </div>
        </div>
      `,
      text: `Hi Syed,

It was wonderful meeting you today! Thanks for taking the time to visit us and test drive the 2024 Ford F-150.

I know you mentioned wanting to think it over. That's completely understandable - it's a big decision!

If any questions come up, I'm just a text or call away. No pressure at all!

How to Reach Me:
📱 Phone: (555) 123-4567
📧 Email: Reply to this email
💬 Text: Just reply to my earlier SMS

Take your time with the decision. I'll check in with you in a couple of days.

Best regards,
Your DAIVE Team

---
Reply STOP to unsubscribe`
    });

    console.log('✅ Sent! Message ID:', email2.messageId);

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ============================================
    // EMAIL 3: Post-Purchase Welcome
    // ============================================
    
    console.log('\n📨 Email 3: Post-Purchase - Welcome!');
    
    const email3 = await transporter.sendMail({
      from: `"DAIVE Follow-Up System" <${process.env.SMTP_USER || 'info@mitiesoft.com'}>`,
      to: TEST_EMAIL,
      subject: '🎉 Welcome to the family, Syed!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 32px;">🎉 Congratulations! 🎉</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Welcome to the Family!</p>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 18px; color: #333; margin-top: 0;">Dear Syed,</p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #555;">
              Congratulations on your new <strong>2024 Toyota Camry</strong>! We're thrilled to have you as part of our family.
            </p>

            <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="margin-top: 0; color: #f5576c;">📱 Here's What You Need to Know:</h3>
              <div style="line-height: 2;">
                <p style="margin: 10px 0;">
                  <strong>📱 Download Our App</strong><br>
                  <span style="color: #666;">Easy service scheduling, reminders, and more</span>
                </p>
                <p style="margin: 10px 0;">
                  <strong>🔧 Free First Oil Change</strong><br>
                  <span style="color: #666;">Valid within 5,000 miles or 6 months</span>
                </p>
                <p style="margin: 10px 0;">
                  <strong>⭐ VIP Rewards Program</strong><br>
                  <span style="color: #666;">Earn points on service, get exclusive offers</span>
                </p>
                <p style="margin: 10px 0;">
                  <strong>📞 24/7 Roadside Assistance</strong><br>
                  <span style="color: #666;">Call: 1-800-XXX-XXXX</span>
                </p>
              </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background: #f5576c; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block; margin: 10px;">
                📱 Download App
              </a>
              <a href="#" style="background: #4f46e5; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block; margin: 10px;">
                🎁 Join Rewards
              </a>
            </div>

            <div style="background: #fef3c7; padding: 20px; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>💡 Pro Tip:</strong> Schedule your first free oil change now to ensure the best care for your new vehicle!
              </p>
            </div>

            <p style="font-size: 16px; color: #555;">
              Enjoy your new ride! We're here if you need anything.
            </p>

            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Welcome to the family,<br>
              <strong>The Team at Your Dealership</strong>
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              Automated onboarding from DAIVE | Reply STOP to unsubscribe
            </p>
          </div>
        </div>
      `,
      text: `Dear Syed,

🎉 Congratulations on your new 2024 Toyota Camry! 🎉

We're thrilled to have you as part of our family.

Here's What You Need to Know:

📱 Download Our App
Easy service scheduling, reminders, and more

🔧 Free First Oil Change
Valid within 5,000 miles or 6 months

⭐ VIP Rewards Program
Earn points on service, get exclusive offers

📞 24/7 Roadside Assistance
Call: 1-800-XXX-XXXX

[Download App] [Join Rewards]

💡 Pro Tip: Schedule your first free oil change now to ensure the best care for your new vehicle!

Enjoy your new ride! We're here if you need anything.

Welcome to the family,
The Team at Your Dealership

---
Reply STOP to unsubscribe`
    });

    console.log('✅ Sent! Message ID:', email3.messageId);

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 SUCCESS! All 3 test emails sent to:', TEST_EMAIL);
    console.log('\n📬 Check your inbox for:');
    console.log('   1. Hot Lead - Vehicle inquiry follow-up');
    console.log('   2. Unsold Visit - Thank you after test drive');
    console.log('   3. Post-Purchase - Welcome to the family');
    console.log('\n💡 These show real examples of automated follow-ups!');

  } catch (error) {
    console.error('\n❌ Error sending emails:', error);
    console.error('Error details:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n⚠️  Authentication failed. Check your .env:');
      console.log('   - FOLLOWUP_SMTP_USER');
      console.log('   - FOLLOWUP_SMTP_PASS (use Gmail App Password, not regular password)');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function showEmailPreviews(client) {
  console.log('📄 EMAIL PREVIEWS (SMTP Not Configured)\n');
  
  // Get some sample steps
  const steps = await client.query(`
    SELECT 
      frt.name as template_name,
      fs.step_name,
      fs.channel,
      fs.subject_template,
      LEFT(fs.message_template, 150) as message_preview
    FROM followup_steps fs
    JOIN followup_rule_templates frt ON fs.rule_template_id = frt.id
    WHERE fs.channel = 'email'
    ORDER BY frt.category, fs.step_order
    LIMIT 5
  `);

  steps.rows.forEach((step, idx) => {
    console.log(`\n${idx + 1}. ${step.template_name} - ${step.step_name}`);
    console.log(`   Subject: ${step.subject_template || 'N/A'}`);
    console.log(`   Preview: ${step.message_preview}...`);
    console.log(`   Channel: ${step.channel.toUpperCase()}`);
  });

  console.log('\n\n💡 Configure SMTP in .env to send real emails!');
}

// Run
sendTestEmails()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });


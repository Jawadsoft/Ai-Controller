#!/usr/bin/env node

/**
 * SMTP Settings Database Insert Script
 * ====================================
 * 
 * This script inserts SMTP configuration data into the integration_settings table.
 * Run this script on your server to set up SMTP settings for email functionality.
 * 
 * Usage:
 *   node scripts/insert-smtp-settings.js
 * 
 * Environment Variables Required:
 *   - DATABASE_URL or individual DB connection variables
 *   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (optional)
 */

import { query } from '../src/database/connection.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// SMTP Configuration - Update these values for your SMTP server
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'send.one.com',
  port: process.env.SMTP_PORT || '587',
  secure: process.env.SMTP_SECURE || 'false', // 'true' for 465, 'false' for other ports
  user: process.env.SMTP_USER || 'info@mitiesoft.com',
  pass: process.env.SMTP_PASS || 'info@mitie@',
  from: process.env.SMTP_FROM || 'info@mitiesoft.com',
  from_name: process.env.SMTP_FROM_NAME || 'DealerIQ'
};

// SMTP Settings to insert
const SMTP_SETTINGS = [
  {
    provider: 'smtp',
    key: 'host',
    secret: SMTP_CONFIG.host,
    config: { description: 'SMTP server hostname' },
    is_active: true
  },
  {
    provider: 'smtp',
    key: 'port',
    secret: SMTP_CONFIG.port,
    config: { description: 'SMTP server port' },
    is_active: true
  },
  {
    provider: 'smtp',
    key: 'secure',
    secret: SMTP_CONFIG.secure,
    config: { description: 'Use SSL/TLS (true for port 465, false for others)' },
    is_active: true
  },
  {
    provider: 'smtp',
    key: 'user',
    secret: SMTP_CONFIG.user,
    config: { description: 'SMTP username/email' },
    is_active: true
  },
  {
    provider: 'smtp',
    key: 'pass',
    secret: SMTP_CONFIG.pass,
    config: { description: 'SMTP password/app password' },
    is_active: true
  },
  {
    provider: 'smtp',
    key: 'from',
    secret: SMTP_CONFIG.from,
    config: { 
      description: 'Default sender email address',
      from_name: SMTP_CONFIG.from_name
    },
    is_active: true
  }
];

async function insertSmtpSettings() {
  console.log('🚀 Starting SMTP Settings Insert Script...');
  console.log('📧 SMTP Configuration:');
  console.log(`   Host: ${SMTP_CONFIG.host}`);
  console.log(`   Port: ${SMTP_CONFIG.port}`);
  console.log(`   Secure: ${SMTP_CONFIG.secure}`);
  console.log(`   User: ${SMTP_CONFIG.user}`);
  console.log(`   From: ${SMTP_CONFIG.from}`);
  console.log('');

  try {
    // Test database connection
    console.log('🔍 Testing database connection...');
    await query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Check if SMTP settings already exist
    console.log('🔍 Checking for existing SMTP settings...');
    const existingSettings = await query(`
      SELECT provider, key FROM integration_settings 
      WHERE scope = 'global' AND provider = 'smtp'
    `);

    if (existingSettings.rows.length > 0) {
      console.log('⚠️  Existing SMTP settings found:');
      existingSettings.rows.forEach(row => {
        console.log(`   - ${row.provider}.${row.key}`);
      });
      
      console.log('');
      console.log('🔄 Updating existing settings...');
      
      // Update existing settings
      for (const setting of SMTP_SETTINGS) {
        const result = await query(`
          UPDATE integration_settings 
          SET secret = $1, config = $2, is_active = $3, updated_at = NOW()
          WHERE scope = 'global' AND provider = $4 AND key = $5
          RETURNING *
        `, [
          setting.secret,
          JSON.stringify(setting.config),
          setting.is_active,
          setting.provider,
          setting.key
        ]);

        if (result.rows.length > 0) {
          console.log(`   ✅ Updated: ${setting.provider}.${setting.key}`);
        } else {
          // Insert if doesn't exist
          await query(`
            INSERT INTO integration_settings (scope, provider, key, secret, config, is_active)
            VALUES ('global', $1, $2, $3, $4, $5)
          `, [
            setting.provider,
            setting.key,
            setting.secret,
            JSON.stringify(setting.config),
            setting.is_active
          ]);
          console.log(`   ✅ Inserted: ${setting.provider}.${setting.key}`);
        }
      }
    } else {
      console.log('📝 No existing SMTP settings found, inserting new ones...');
      
      // Insert new settings
      for (const setting of SMTP_SETTINGS) {
        await query(`
          INSERT INTO integration_settings (scope, provider, key, secret, config, is_active)
          VALUES ('global', $1, $2, $3, $4, $5)
        `, [
          setting.provider,
          setting.key,
          setting.secret,
          JSON.stringify(setting.config),
          setting.is_active
        ]);
        console.log(`   ✅ Inserted: ${setting.provider}.${setting.key}`);
      }
    }

    // Verify the settings were inserted correctly
    console.log('');
    console.log('🔍 Verifying SMTP settings...');
    const verifyResult = await query(`
      SELECT provider, key, secret, is_active, created_at, updated_at
      FROM integration_settings 
      WHERE scope = 'global' AND provider = 'smtp'
      ORDER BY key
    `);

    console.log('📊 Final SMTP Settings:');
    verifyResult.rows.forEach(row => {
      const secretDisplay = row.secret ? 
        (row.key === 'pass' ? '***hidden***' : row.secret) : 
        'Not set';
      console.log(`   ${row.provider}.${row.key}: ${secretDisplay} (active: ${row.is_active})`);
    });

    console.log('');
    console.log('✅ SMTP settings successfully configured!');
    console.log('');
    console.log('🔧 Next Steps:');
    console.log('   1. Test the SMTP connection using the Super Admin panel');
    console.log('   2. Send a test email to verify the configuration');
    console.log('   3. Update any additional SMTP settings as needed');
    console.log('');
    console.log('📚 API Endpoints Available:');
    console.log('   GET  /api/super-admin/settings/smtp/user');
    console.log('   PUT  /api/super-admin/settings/smtp/user');
    console.log('   POST /api/super-admin/settings/smtp/test');

  } catch (error) {
    console.error('❌ Error inserting SMTP settings:', error);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('   1. Check your database connection');
    console.error('   2. Verify the integration_settings table exists');
    console.error('   3. Ensure you have proper database permissions');
    console.error('   4. Check your environment variables');
    process.exit(1);
  }
}

// Run the script
insertSmtpSettings()
  .then(() => {
    console.log('🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });

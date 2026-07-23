#!/usr/bin/env node

/**
 * Database Setup Script for Render.com PostgreSQL
 * This script will create all required tables and insert sample data
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const { Pool } = pg;

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : true
});

console.log('🚀 Starting database setup for Render.com PostgreSQL...');

async function setupDatabase() {
  let client;
  
  try {
    // Connect to database
    client = await pool.connect();
    console.log('✅ Connected to Render.com PostgreSQL database');

    // Read schema file
    const schemaPath = path.join(__dirname, 'src', 'database', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📖 Reading database schema...');
    
    // Execute schema creation
    console.log('🔨 Creating database tables...');
    await client.query(schemaSQL);
    console.log('✅ Database tables created successfully');

    // Insert sample data
    console.log('📝 Inserting sample data...');
    
    // Insert sample subscription plans
    await client.query(`
      INSERT INTO subscription_plans (name, display_name, description, monthly_price, yearly_price, max_vehicles, max_leads, features) 
      VALUES 
        ('basic', 'Basic Plan', 'Essential features for small dealerships', 29.99, 299.99, 50, 100, ARRAY['vehicle_management', 'lead_tracking', 'basic_analytics']),
        ('premium', 'Premium Plan', 'Advanced features for growing dealerships', 79.99, 799.99, 200, 500, ARRAY['vehicle_management', 'lead_tracking', 'advanced_analytics', 'ai_features', 'priority_support']),
        ('enterprise', 'Enterprise Plan', 'Full-featured solution for large dealerships', 199.99, 1999.99, 1000, 2000, ARRAY['vehicle_management', 'lead_tracking', 'advanced_analytics', 'ai_features', 'priority_support', 'custom_integrations', 'dedicated_support'])
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('✅ Sample subscription plans inserted');

    // Insert sample dealer (you can modify this)
    const dealerResult = await client.query(`
      INSERT INTO dealers (business_name, contact_name, email, phone, address, city, state, zip_code, description, established_year, subscription_plan, subscription_status)
      VALUES ('Sample Dealership', 'John Doe', 'john@sampledealership.com', '555-0123', '123 Main St', 'Sample City', 'CA', '90210', 'A sample dealership for testing', 2020, 'premium', 'active')
      RETURNING id;
    `);
    console.log('✅ Sample dealer inserted');

    // Insert sample vehicles
    if (dealerResult.rows.length > 0) {
      const dealerId = dealerResult.rows[0].id;
      
      await client.query(`
        INSERT INTO vehicles (dealer_id, vin, make, model, year, trim, color, mileage, price, description, features, status)
        VALUES 
          ('${dealerId}', '1HGBH41JXMN109186', 'Honda', 'Civic', 2023, 'EX', 'Blue', 15000, 25000.00, 'Excellent condition Honda Civic', ARRAY['Bluetooth', 'Backup Camera', 'Apple CarPlay'], 'available'),
          ('${dealerId}', '5NPE34AF4FH012345', 'Hyundai', 'Tucson', 2022, 'Limited', 'Silver', 22000, 32000.00, 'Well-maintained Hyundai Tucson', ARRAY['AWD', 'Leather Seats', 'Navigation'], 'available'),
          ('${dealerId}', '1FADP3F22EL123456', 'Ford', 'Escape', 2021, 'SE', 'White', 35000, 28000.00, 'Reliable Ford Escape SUV', ARRAY['Bluetooth', 'Backup Camera', 'Cruise Control'], 'available')
        ON CONFLICT (vin) DO NOTHING;
      `);
      console.log('✅ Sample vehicles inserted');
    }

    // Insert sample prompts for AI features
    await client.query(`
      INSERT INTO dealer_prompts (dealer_id, prompt_type, prompt_text, is_active)
      VALUES 
        ('${dealerId}', 'greeting', 'Welcome to Sample Dealership! How can I help you find your perfect vehicle today?', true),
        ('${dealerId}', 'vehicle_inquiry', 'I''d be happy to help you with information about our vehicles. What specific details would you like to know?', true),
        ('${dealerId}', 'pricing_inquiry', 'Great question about pricing! Let me get you the most competitive rates and financing options available.', true)
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Sample AI prompts inserted');

    console.log('🎉 Database setup completed successfully!');
    console.log('📊 Database now contains:');
    console.log('   - Users and authentication tables');
    console.log('   - Dealers and vehicles tables');
    console.log('   - Subscription plans');
    console.log('   - Sample data for testing');
    console.log('   - AI prompt templates');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    console.log('✅ Database setup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database setup script failed:', error);
    process.exit(1);
  });

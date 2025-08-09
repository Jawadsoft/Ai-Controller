import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrations = [
  // Add DAIVE API Settings table
  `
    CREATE TABLE IF NOT EXISTS daive_api_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
      setting_type TEXT NOT NULL,
      setting_value TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(dealer_id, setting_type)
    );
  `,
  // Add indexes for API settings
  `
    CREATE INDEX IF NOT EXISTS idx_daive_api_settings_dealer_id ON daive_api_settings(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_daive_api_settings_setting_type ON daive_api_settings(setting_type);
  `,
  // Add trigger for API settings
  `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_daive_api_settings_updated_at') THEN
        CREATE TRIGGER update_daive_api_settings_updated_at BEFORE UPDATE ON daive_api_settings
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END $$;
  `
];

async function runMigrations() {
  try {
    console.log('Running migrations...');
    
    for (let i = 0; i < migrations.length; i++) {
      const migration = migrations[i];
      console.log(`Running migration ${i + 1}/${migrations.length}...`);
      
      await pool.query(migration);
      console.log(`Migration ${i + 1} completed successfully`);
    }
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations();
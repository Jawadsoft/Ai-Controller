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
  `,
  // Add voice_settings table
  `
    CREATE TABLE IF NOT EXISTS voice_settings (
      id SERIAL PRIMARY KEY,
      dealer_id UUID,
      enabled BOOLEAN DEFAULT true,
      language VARCHAR(10) DEFAULT 'en-US',
      voice_speed DECIMAL(3,2) DEFAULT 1.0,
      voice_pitch DECIMAL(3,2) DEFAULT 1.0,
      voice_provider VARCHAR(50) DEFAULT 'openai',
      speech_provider VARCHAR(50) DEFAULT 'whisper',
      tts_provider VARCHAR(50) DEFAULT 'openai',
      openai_voice VARCHAR(50) DEFAULT 'alloy',
      elevenlabs_voice VARCHAR(50) DEFAULT 'jessica',
      auto_voice_response BOOLEAN DEFAULT true,
      voice_quality VARCHAR(20) DEFAULT 'standard',
      voice_emotion VARCHAR(20) DEFAULT 'friendly',
      recording_quality VARCHAR(20) DEFAULT 'medium',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(dealer_id)
    );
  `,
  // Add indexes for voice settings
  `
    CREATE INDEX IF NOT EXISTS idx_voice_settings_dealer_id ON voice_settings(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_voice_settings_enabled ON voice_settings(enabled);
  `,
  // Insert default global voice settings
  `
    INSERT INTO voice_settings (dealer_id, enabled, language, voice_speed, voice_pitch, voice_provider, speech_provider, tts_provider, openai_voice, elevenlabs_voice, auto_voice_response, voice_quality, voice_emotion, recording_quality)
    VALUES (NULL, true, 'en-US', 1.0, 1.0, 'openai', 'whisper', 'openai', 'alloy', 'jessica', true, 'standard', 'friendly', 'medium')
    ON CONFLICT (dealer_id) DO NOTHING;
  `,
  // Add conversation_messages table
  `
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id SERIAL PRIMARY KEY,
      conversation_id UUID NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `,
  // Add indexes for conversation messages
  `
    CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversation_messages_role ON conversation_messages(role);
    CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at);
  `,
  // Add crew_ai_settings table
  `
    CREATE TABLE IF NOT EXISTS crew_ai_settings (
      id SERIAL PRIMARY KEY,
      dealer_id UUID,
      enabled BOOLEAN DEFAULT false,
      auto_routing BOOLEAN DEFAULT true,
      enable_sales_crew BOOLEAN DEFAULT true,
      enable_customer_service_crew BOOLEAN DEFAULT true,
      enable_inventory_crew BOOLEAN DEFAULT false,
      crew_collaboration BOOLEAN DEFAULT true,
      agent_memory BOOLEAN DEFAULT true,
      performance_tracking BOOLEAN DEFAULT true,
      fallback_to_traditional BOOLEAN DEFAULT true,
      crew_selection VARCHAR(20) DEFAULT 'auto' CHECK (crew_selection IN ('auto', 'manual', 'hybrid')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(dealer_id)
    );
  `,
  // Add indexes for crew AI settings
  `
    CREATE INDEX IF NOT EXISTS idx_crew_ai_settings_dealer_id ON crew_ai_settings(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_crew_ai_settings_enabled ON crew_ai_settings(enabled);
  `,
  // Insert default global crew AI settings
  `
    INSERT INTO crew_ai_settings (dealer_id, enabled, auto_routing, enable_sales_crew, enable_customer_service_crew, enable_inventory_crew, crew_collaboration, agent_memory, performance_tracking, fallback_to_traditional, crew_selection)
    VALUES (NULL, false, true, true, true, false, true, true, true, true, 'auto')
    ON CONFLICT (dealer_id) DO NOTHING;
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
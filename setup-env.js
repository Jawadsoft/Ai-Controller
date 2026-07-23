// Environment setup script that loads API keys from database
// Run this before testing: node setup-env.js

import { pool } from './src/database/connection.js';

// Set basic environment variables
process.env.DATABASE_URL = 'postgresql://postgres:dealeriq@localhost:5432/vehicle_management';
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.SESSION_SECRET = 'test-session-secret-key';
process.env.PORT = '3000';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.BACKEND_URL = 'http://localhost:3000';
process.env.QR_ENCRYPTION_KEY = 'test-qr-encryption-key';

// Function to load API keys from database
async function loadApiKeysFromDatabase() {
  try {
    console.log('🔍 Loading API keys from database...');
    
    // Load global API settings
    const globalSettingsQuery = `
      SELECT setting_type, setting_value, dealer_id 
      FROM daive_api_settings 
      WHERE dealer_id IS NULL 
      AND setting_type IN ('openai_key', 'deepgram_key', 'elevenlabs_key', 'azure_speech_key')
    `;
    
    const globalResult = await pool.query(globalSettingsQuery);
    const globalSettings = {};
    
    globalResult.rows.forEach(row => {
      globalSettings[row.setting_type] = row.setting_value;
      console.log(`📋 Loaded ${row.setting_type}: ${row.setting_value ? '✅ Set' : '❌ Not set'}`);
    });
    
    // Load dealer-specific settings (using a default dealer ID)
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f'; // Default dealer
    const dealerSettingsQuery = `
      SELECT setting_type, setting_value, dealer_id 
      FROM daive_api_settings 
      WHERE dealer_id = $1 
      AND setting_type IN ('openai_key', 'deepgram_key', 'elevenlabs_key', 'azure_speech_key')
    `;
    
    const dealerResult = await pool.query(dealerSettingsQuery, [dealerId]);
    const dealerSettings = {};
    
    dealerResult.rows.forEach(row => {
      dealerSettings[row.setting_type] = row.setting_value;
      console.log(`🏪 Dealer ${row.setting_type}: ${row.setting_value ? '✅ Set' : '❌ Not set'}`);
    });
    
    // Set environment variables (dealer-specific takes precedence)
    const finalSettings = { ...globalSettings, ...dealerSettings };
    
    // OpenAI Configuration
    if (finalSettings.openai_key) {
      process.env.OPENAI_API_KEY = finalSettings.openai_key;
      console.log('🤖 OpenAI API Key: ✅ Loaded from database');
    } else {
      console.log('❌ OpenAI API Key: Not found in database');
      console.log('💡 Add it to daive_api_settings table or set manually');
    }
    
    // Deepgram Configuration
    if (finalSettings.deepgram_key) {
      process.env.DEEPGRAM_API_KEY = finalSettings.deepgram_key;
      console.log('🎤 Deepgram API Key: ✅ Loaded from database');
    } else {
      console.log('⚠️ Deepgram API Key: Not found in database');
    }
    
    // ElevenLabs Configuration
    if (finalSettings.elevenlabs_key) {
      process.env.ELEVENLABS_API_KEY = finalSettings.elevenlabs_key;
      console.log('🔊 ElevenLabs API Key: ✅ Loaded from database');
    } else {
      console.log('⚠️ ElevenLabs API Key: Not found in database');
    }
    
    // Azure Speech Configuration
    if (finalSettings.azure_speech_key) {
      process.env.AZURE_SPEECH_KEY = finalSettings.azure_speech_key;
      console.log('🗣️ Azure Speech Key: ✅ Loaded from database');
    } else {
      console.log('⚠️ Azure Speech Key: Not found in database');
    }
    
    // Set default AI model settings
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
    process.env.OPENAI_MAX_TOKENS = '300';
    
    return finalSettings;
    
  } catch (error) {
    console.error('❌ Error loading API keys from database:', error.message);
    console.log('💡 Make sure your database is running and accessible');
    return {};
  }
}

// Function to check if required keys are set
function validateApiKeys() {
  const requiredKeys = ['OPENAI_API_KEY'];
  const missingKeys = [];
  
  requiredKeys.forEach(key => {
    if (!process.env[key]) {
      missingKeys.push(key);
    }
  });
  
  if (missingKeys.length > 0) {
    console.log('\n❌ Missing required API keys:', missingKeys.join(', '));
    console.log('💡 Please add them to your daive_api_settings table or set manually');
    return false;
  }
  
  console.log('\n✅ All required API keys are set!');
  return true;
}

// Main function
async function setupEnvironment() {
  console.log('🔧 Setting up environment variables...\n');
  
  try {
    // Load API keys from database
    const apiKeys = await loadApiKeysFromDatabase();
    
    console.log('\n📊 Environment Summary:');
    console.log('- Database:', process.env.DATABASE_URL);
    console.log('- OpenAI Model:', process.env.OPENAI_MODEL);
    console.log('- OpenAI API Key:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ NOT SET');
    console.log('- Deepgram API Key:', process.env.DEEPGRAM_API_KEY ? '✅ Set' : '❌ NOT SET');
    console.log('- ElevenLabs API Key:', process.env.ELEVENLABS_API_KEY ? '✅ Set' : '❌ NOT SET');
    console.log('- Port:', process.env.PORT);
    
    // Validate required keys
    const isValid = validateApiKeys();
    
    if (isValid) {
      console.log('\n🚀 Environment setup complete! You can now:');
      console.log('1. Start backend: node src/server.js');
      console.log('2. Test Crew AI: node test-crew-ai-simple.js');
    } else {
      console.log('\n⚠️ Environment setup incomplete. Please fix the missing keys above.');
    }
    
    // Close database connection
    await pool.end();
    
  } catch (error) {
    console.error('💥 Environment setup failed:', error.message);
    console.log('\n🔧 Manual setup instructions:');
    console.log('1. Add your API keys to the daive_api_settings table');
    console.log('2. Or set them manually in this script');
    console.log('3. Make sure your database is running');
  }
}

// Run the setup
setupEnvironment(); 
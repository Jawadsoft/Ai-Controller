import { pool } from './src/database/connection.js';

async function checkElevenLabsKey() {
  try {
    console.log('🔑 Checking ElevenLabs API key in database...\n');
    
    // Check for ElevenLabs API key
    const query = `
      SELECT setting_type, setting_value, dealer_id, is_active
      FROM daive_api_settings 
      WHERE setting_type = 'elevenlabs_key'
      ORDER BY dealer_id NULLS LAST
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('❌ No ElevenLabs API key found in database');
      console.log('💡 You need to add an ElevenLabs API key to use Liam voice');
      console.log('\n📝 To add the key, you can:');
      console.log('1. Use the DAIVE Settings page in the frontend');
      console.log('2. Or run a script to add it directly to the database');
      console.log('3. Or check your .env file for ELEVENLABS_API_KEY');
    } else {
      console.log('✅ ElevenLabs API keys found:');
      result.rows.forEach(row => {
        const dealer = row.dealer_id ? `Dealer ${row.dealer_id}` : 'Global';
        const status = row.is_active ? '✅ Active' : '❌ Inactive';
        const key = row.setting_value ? '🔑 Set' : '❌ Empty';
        console.log(`   ${dealer}: ${status} - ${key}`);
      });
    }
    
    // Check environment variable
    console.log('\n🌍 Environment Variable Check:');
    if (process.env.ELEVENLABS_API_KEY) {
      console.log('✅ ELEVENLABS_API_KEY found in environment');
    } else {
      console.log('❌ ELEVENLABS_API_KEY not found in environment');
    }
    
    // Check if we can connect to ElevenLabs API
    console.log('\n🧪 Testing ElevenLabs API connection...');
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY
          }
        });
        
        if (response.ok) {
          const voices = await response.json();
          console.log(`✅ ElevenLabs API connection successful! Found ${voices.voices?.length || 0} voices`);
        } else {
          console.log(`❌ ElevenLabs API connection failed: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.log('❌ ElevenLabs API connection error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking ElevenLabs key:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkElevenLabsKey();

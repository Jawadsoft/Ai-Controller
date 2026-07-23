import { pool } from './src/database/connection.js';

async function testDealerIdSetting() {
  try {
    console.log('🧪 Testing Dealer ID API Setting...\n');
    
    // Test inserting a dealer_id setting
    const testDealerId = 'MY_DEALER_123';
    
    const query = `
      INSERT INTO daive_api_settings (dealer_id, setting_type, setting_value)
      VALUES (NULL, 'dealer_id', $1)
      ON CONFLICT (dealer_id, setting_type) 
      DO UPDATE SET setting_value = $1, updated_at = NOW()
      RETURNING *
    `;
    
    const result = await pool.query(query, [testDealerId]);
    
    if (result.rows.length > 0) {
      console.log('✅ Dealer ID setting saved successfully!');
      console.log(`   Value: ${result.rows[0].setting_value}`);
      console.log(`   Active: ${result.rows[0].is_active}`);
    }
    
    // Test retrieving the setting
    const getQuery = `
      SELECT setting_value FROM daive_api_settings 
      WHERE dealer_id IS NULL AND setting_type = 'dealer_id'
    `;
    
    const getResult = await pool.query(getQuery);
    
    if (getResult.rows.length > 0) {
      console.log('✅ Dealer ID setting retrieved successfully!');
      console.log(`   Retrieved Value: ${getResult.rows[0].setting_value}`);
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testDealerIdSetting();
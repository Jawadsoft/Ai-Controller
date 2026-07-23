import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function checkVehicleStatus() {
  console.log('🔍 Checking Vehicle Status...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Check all vehicles with their status
    console.log('📊 All Vehicles Status:');
    const allVehicles = await pool.query(`
      SELECT v.id, v.make, v.model, v.year, v.price, v.status, v.dealer_id, d.business_name
      FROM vehicles v
      LEFT JOIN dealers d ON v.dealer_id = d.id
      ORDER BY v.status, v.created_at DESC
    `);
    
    if (allVehicles.rows.length > 0) {
      allVehicles.rows.forEach((vehicle, index) => {
        const statusIcon = vehicle.status === 'available' ? '✅' : '❌';
        console.log(`${statusIcon} ${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price} (${vehicle.business_name || 'No dealer'}) - Status: ${vehicle.status}`);
      });
    } else {
      console.log('⚠️ No vehicles found in database');
    }
    
    // Check status distribution
    console.log('\n📈 Status Distribution:');
    const statusCount = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM vehicles
      GROUP BY status
      ORDER BY count DESC
    `);
    
    statusCount.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} vehicles`);
    });
    
    // Check dealer distribution
    console.log('\n🏢 Dealer Distribution:');
    const dealerCount = await pool.query(`
      SELECT d.business_name, COUNT(v.id) as vehicle_count,
             COUNT(CASE WHEN v.status = 'available' THEN 1 END) as available_count
      FROM dealers d
      LEFT JOIN vehicles v ON d.id = v.dealer_id
      GROUP BY d.id, d.business_name
      ORDER BY vehicle_count DESC
    `);
    
    dealerCount.rows.forEach(row => {
      console.log(`   ${row.business_name}: ${row.vehicle_count} total, ${row.available_count} available`);
    });
    
    // Check if there are any vehicles that could be made available
    console.log('\n🔧 Potential Issues:');
    const potentialIssues = await pool.query(`
      SELECT v.id, v.make, v.model, v.year, v.status, v.dealer_id,
             CASE 
               WHEN v.dealer_id IS NULL THEN 'No dealer assigned'
               WHEN v.price IS NULL OR v.price <= 0 THEN 'No valid price'
               WHEN v.make IS NULL OR v.make = '' THEN 'No make specified'
               WHEN v.model IS NULL OR v.model = '' THEN 'No model specified'
               ELSE 'Other issue'
             END as issue
      FROM vehicles v
      WHERE v.status != 'available'
      OR v.dealer_id IS NULL
      OR v.price IS NULL OR v.price <= 0
      OR v.make IS NULL OR v.make = ''
      OR v.model IS NULL OR v.model = ''
    `);
    
    if (potentialIssues.rows.length > 0) {
      console.log('   Found vehicles with potential issues:');
      potentialIssues.rows.forEach(row => {
        console.log(`   ❌ ${row.year} ${row.make} ${row.model} - Issue: ${row.issue}`);
      });
    } else {
      console.log('   ✅ All vehicles appear to have valid data');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the check
checkVehicleStatus().catch(console.error); 
import { pool } from './src/database/connection.js';

async function checkDealerInventory() {
  try {
    console.log('🔍 Checking dealer inventory...\n');
    
    // Get all vehicles with their dealer info
    const query = `
      SELECT v.id, v.make, v.model, v.year, v.trim, v.color, v.price, v.status, 
             d.business_name, d.id as dealer_id
      FROM vehicles v
      JOIN dealers d ON v.dealer_id = d.id
      ORDER BY d.business_name, v.make, v.model
    `;
    
    const result = await pool.query(query);
    
    console.log(`Found ${result.rows.length} vehicles in total\n`);
    
    // Group by dealer
    const dealerInventory = {};
    result.rows.forEach(vehicle => {
      const dealerName = vehicle.business_name || 'Unknown Dealer';
      if (!dealerInventory[dealerName]) {
        dealerInventory[dealerName] = [];
      }
      dealerInventory[dealerName].push(vehicle);
    });
    
    // Display inventory by dealer
    for (const [dealerName, vehicles] of Object.entries(dealerInventory)) {
      console.log(`🏢 ${dealerName} (${vehicles.length} vehicles):`);
      vehicles.forEach(vehicle => {
        console.log(`   • ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''} - ${vehicle.color || 'Color N/A'} - ${vehicle.price ? `$${vehicle.price.toLocaleString()}` : 'Price N/A'} (${vehicle.status})`);
      });
      console.log('');
    }
    
    // Test alternative vehicles for specific vehicles
    console.log('🧪 Testing alternative vehicles for specific vehicles...\n');
    
    const testVehicles = [
      {
        id: 'fe21b82a-5e3b-46e4-a51d-0f6806a46cc5',
        name: 'Toyota Corolla 2025'
      },
      {
        id: '1f06a092-3eed-43d5-be13-763753e447ce',
        name: 'Suzuki Cultus 2025'
      },
      {
        id: '112f619c-9742-42b9-b48c-447b95f8f3cc',
        name: 'Honda City 2024'
      }
    ];
    
    for (const testVehicle of testVehicles) {
      console.log(`\n🚗 Testing alternatives for: ${testVehicle.name}`);
      
      // Get the vehicle's dealer
      const vehicleQuery = `
        SELECT v.dealer_id, d.business_name
        FROM vehicles v
        JOIN dealers d ON v.dealer_id = d.id
        WHERE v.id = $1
      `;
      
      const vehicleResult = await pool.query(vehicleQuery, [testVehicle.id]);
      
      if (vehicleResult.rows.length > 0) {
        const vehicle = vehicleResult.rows[0];
        console.log(`   Dealer: ${vehicle.business_name}`);
        
        // Get alternatives from same dealer
        const alternativesQuery = `
          SELECT v.id, v.make, v.model, v.year, v.trim, v.color, v.price, v.status
          FROM vehicles v
          WHERE v.dealer_id = $1 AND v.id != $2 AND v.status = 'available'
          ORDER BY v.created_at DESC
        `;
        
        const alternativesResult = await pool.query(alternativesQuery, [vehicle.dealer_id, testVehicle.id]);
        
        if (alternativesResult.rows.length > 0) {
          console.log(`   ✅ Found ${alternativesResult.rows.length} alternative(s):`);
          alternativesResult.rows.forEach(alt => {
            console.log(`      • ${alt.year} ${alt.make} ${alt.model}${alt.trim ? ` ${alt.trim}` : ''} - ${alt.color || 'Color N/A'} - ${alt.price ? `$${alt.price.toLocaleString()}` : 'Price N/A'}`);
          });
        } else {
          console.log(`   ❌ No alternatives found from same dealer`);
        }
      } else {
        console.log(`   ❌ Vehicle not found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDealerInventory();
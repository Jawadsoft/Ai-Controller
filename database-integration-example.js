// Database Integration Example
// Shows how to search actual database fields based on collected preferences

import { pool } from './src/database/connection.js';

class DatabaseIntegration {
  constructor() {
    this.pool = pool;
  }

  // Search vehicles based on collected preferences
  async searchVehiclesByPreferences(preferences, limit = 10) {
    try {
             let query = `
         SELECT 
           v.id,
           v.make,
           v.model,
           v.year,
           v.body_style,
           v.color,
           v.odometer,
           v.price,
           v.features,
           v.engine_type,
           v.transmission,
           v.new_used,
           v.photo_url_list
         FROM vehicles v
         WHERE 1=1
       `;
      
      const queryParams = [];
      let paramCount = 0;

      // Add filters based on preferences
      if (preferences.body_style) {
        paramCount++;
        query += ` AND v.body_style ILIKE $${paramCount}`;
        queryParams.push(`%${preferences.body_style}%`);
      }

      if (preferences.price_range && preferences.price_range.max) {
        paramCount++;
        query += ` AND v.price <= $${paramCount}`;
        queryParams.push(preferences.price_range.max);
      }

             if (preferences.color) {
         paramCount++;
         query += ` AND v.color ILIKE $${paramCount}`;
         queryParams.push(`%${preferences.color}%`);
       }

      if (preferences.mileage && preferences.mileage.max) {
        paramCount++;
        query += ` AND v.odometer <= $${paramCount}`;
        queryParams.push(preferences.mileage.max);
      }

             if (preferences.fuel_type) {
         paramCount++;
         query += ` AND v.engine_type ILIKE $${paramCount}`;
         queryParams.push(`%${preferences.fuel_type}%`);
       }

             // Search in features field for specific features (features is ARRAY type)
       if (preferences.features && preferences.features.length > 0) {
         // Map feature categories to actual database features
         const featureMapping = {
           'safety': ['Dual front impact airbags', 'ABS brakes', 'Brake assist', 'Dual front side impact airbags'],
           'seating': ['7 seat', '8 seat', 'seating'],
           'luxury': ['leather', 'premium', 'heated'],
           'technology': ['bluetooth', 'navigation', 'apple carplay', 'android auto']
         };
         
         const actualFeatures = [];
         preferences.features.forEach(category => {
           if (featureMapping[category]) {
             actualFeatures.push(...featureMapping[category]);
           }
         });
         
         if (actualFeatures.length > 0) {
           const featureConditions = actualFeatures.map((feature, index) => {
             paramCount++;
             return `$${paramCount} = ANY(v.features)`;
           });
           query += ` AND (${featureConditions.join(' OR ')})`;
           
           // Add feature parameters
           actualFeatures.forEach(feature => {
             queryParams.push(feature);
           });
         }
       }

      // Add ordering and limit
      query += ` ORDER BY v.price ASC LIMIT $${paramCount + 1}`;
      queryParams.push(limit);

      console.log('🔍 Executing query:', query);
      console.log('📝 Parameters:', queryParams);

      const result = await this.pool.query(query, queryParams);
      
      return {
        success: true,
        count: result.rows.length,
        vehicles: result.rows,
        query: query,
        parameters: queryParams
      };

    } catch (error) {
      console.error('❌ Database search error:', error);
      return {
        success: false,
        error: error.message,
        count: 0,
        vehicles: []
      };
    }
  }

  // Search for specific features in the features field
  async searchByFeatures(features, limit = 10) {
    try {
      const featureConditions = features.map((_, index) => `features ILIKE $${index + 1}`);
      const query = `
        SELECT id, make, model, year, features, price, exterior_color
        FROM vehicles 
        WHERE (${featureConditions.join(' OR ')})
        ORDER BY price ASC 
        LIMIT $${features.length + 1}
      `;
      
      const params = [...features.map(f => `%${f}%`), limit];
      
      const result = await this.pool.query(query, params);
      
      return {
        success: true,
        count: result.rows.length,
        vehicles: result.rows
      };

    } catch (error) {
      console.error('❌ Feature search error:', error);
      return {
        success: false,
        error: error.message,
        count: 0,
        vehicles: []
      };
    }
  }

     // Search by color preference
   async searchByColor(color, limit = 10) {
     try {
       const query = `
         SELECT id, make, model, year, color, price, body_style
         FROM vehicles 
         WHERE color ILIKE $1
         ORDER BY price ASC 
         LIMIT $2
       `;
       
       const result = await this.pool.query(query, [`%${color}%`, limit]);
       
       return {
         success: true,
         count: result.rows.length,
         vehicles: result.rows
       };
 
     } catch (error) {
       console.error('❌ Color search error:', error);
       return {
         success: false,
         error: error.message,
         count: 0,
         vehicles: []
       };
     }
   }

  // Search by mileage range
  async searchByMileage(maxMileage, limit = 10) {
    try {
      const query = `
        SELECT id, make, model, year, odometer, price, body_style
        FROM vehicles 
        WHERE odometer <= $1
        ORDER BY odometer ASC 
        LIMIT $2
      `;
      
      const result = await this.pool.query(query, [maxMileage, limit]);
      
      return {
        success: true,
        count: result.rows.length,
        vehicles: result.rows
      };

    } catch (error) {
      console.error('❌ Mileage search error:', error);
      return {
        success: false,
        error: error.message,
        count: 0,
        vehicles: []
      };
    }
  }

     // Get available colors in inventory
   async getAvailableColors() {
     try {
       const query = `
         SELECT DISTINCT color, COUNT(*) as count
         FROM vehicles 
         WHERE color IS NOT NULL AND color != ''
         GROUP BY color
         ORDER BY count DESC
       `;
       
       const result = await this.pool.query(query);
       
       return {
         success: true,
         colors: result.rows
       };
 
     } catch (error) {
       console.error('❌ Color availability error:', error);
       return {
         success: false,
         error: error.message,
         colors: []
       };
     }
   }

     // Get available features in inventory
   async getAvailableFeatures() {
     try {
       const query = `
         SELECT DISTINCT unnest(features) as feature, COUNT(*) as count
         FROM vehicles 
         WHERE features IS NOT NULL AND array_length(features, 1) > 0
         GROUP BY feature
         ORDER BY count DESC
         LIMIT 20
       `;
       
       const result = await this.pool.query(query);
       
       return {
         success: true,
         features: result.rows
       };
 
     } catch (error) {
       console.error('❌ Feature availability error:', error);
       return {
         success: false,
         error: error.message,
         features: []
       };
     }
   }

  // Get price ranges in inventory
  async getPriceRanges() {
    try {
      const query = `
        SELECT 
          MIN(price) as min_price,
          MAX(price) as max_price,
          AVG(price) as avg_price,
          COUNT(*) as total_vehicles
        FROM vehicles 
        WHERE price IS NOT NULL AND price > 0
      `;
      
      const result = await this.pool.query(query);
      
      return {
        success: true,
        priceInfo: result.rows[0]
      };

    } catch (error) {
      console.error('❌ Price range error:', error);
      return {
        success: false,
        error: error.message,
        priceInfo: null
      };
    }
  }
}

// Test the database integration
async function testDatabaseIntegration() {
  console.log('🚀 Testing Database Integration');
  console.log('================================\n');

  try {
    const dbIntegration = new DatabaseIntegration();
    
    // Test 1: Get available colors
    console.log('1️⃣ Testing available colors...');
    const colors = await dbIntegration.getAvailableColors();
    if (colors.success) {
      console.log(`   ✅ Found ${colors.colors.length} colors`);
      colors.colors.slice(0, 5).forEach(color => {
        console.log(`      • ${color.exterior_color}: ${color.count} vehicles`);
      });
    }
    console.log('');

    // Test 2: Get available features
    console.log('2️⃣ Testing available features...');
    const features = await dbIntegration.getAvailableFeatures();
    if (features.success) {
      console.log(`   ✅ Found ${features.features.length} features`);
      features.features.slice(0, 5).forEach(feature => {
        console.log(`      • ${feature.feature}: ${feature.count} vehicles`);
      });
    }
    console.log('');

    // Test 3: Get price ranges
    console.log('3️⃣ Testing price ranges...');
    const priceInfo = await dbIntegration.getPriceRanges();
    if (priceInfo.success) {
      const info = priceInfo.priceInfo;
      console.log(`   ✅ Price Range: $${info.min_price?.toLocaleString()} - $${info.max_price?.toLocaleString()}`);
      console.log(`   ✅ Average Price: $${info.avg_price?.toLocaleString()}`);
      console.log(`   ✅ Total Vehicles: ${info.total_vehicles}`);
    }
    console.log('');

    // Test 4: Search by preferences
    console.log('4️⃣ Testing preference-based search...');
    const testPreferences = {
      body_style: 'SUV',
      price_range: { max: 40000 },
      color: 'black',
      features: ['safety', 'leather']
    };
    
    const searchResult = await dbIntegration.searchVehiclesByPreferences(testPreferences, 5);
    if (searchResult.success) {
      console.log(`   ✅ Found ${searchResult.count} vehicles matching preferences`);
      searchResult.vehicles.forEach(vehicle => {
        console.log(`      • ${vehicle.year} ${vehicle.make} ${vehicle.model} - $${vehicle.price?.toLocaleString()}`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Export for use in other modules
export { DatabaseIntegration };

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDatabaseIntegration().then(() => {
    console.log('\n🎉 Database integration test completed!');
  }).catch(error => {
    console.error('\n💥 Test failed with error:', error);
  });
}

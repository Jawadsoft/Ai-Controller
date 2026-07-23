import { query } from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateToMultiUser() {
  try {
    console.log('🚀 Starting multi-user migration...');
    
    // Read migration SQL
    const migrationPath = path.join(__dirname, 'multi-user-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    console.log('📋 Executing database migration...');
    await query(migrationSQL);
    
    console.log('✅ Multi-user migration completed successfully');
    
    // Migrate existing dealers to have admin staff
    console.log('🔄 Migrating existing dealers to admin staff...');
    
    const dealers = await query('SELECT * FROM dealers');
    
    for (const dealer of dealers.rows) {
      // Check if admin already exists
      const existingAdmin = await query(
        'SELECT id FROM dealership_staff WHERE dealer_id = $1 AND staff_role = $2',
        [dealer.id, 'admin']
      );
      
      if (existingAdmin.rows.length === 0) {
        // Create admin staff for existing dealer
        await query(
          `INSERT INTO dealership_staff (
            dealer_id, 
            user_id, 
            staff_role, 
            permissions, 
            created_by
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            dealer.id,
            dealer.user_id,
            'admin',
            ['all'],
            dealer.user_id
          ]
        );
        
        console.log(`✅ Created admin staff for dealer: ${dealer.business_name}`);
      } else {
        console.log(`ℹ️  Admin already exists for dealer: ${dealer.business_name}`);
      }
    }
    
    // Verify migration
    console.log('🔍 Verifying migration...');
    
    const staffCount = await query('SELECT COUNT(*) as count FROM dealership_staff');
    const dealersCount = await query('SELECT COUNT(*) as count FROM dealers');
    
    console.log(`📊 Migration Summary:`);
    console.log(`   - Dealers: ${dealersCount.rows[0].count}`);
    console.log(`   - Staff Members: ${staffCount.rows[0].count}`);
    
    // Test the new functions
    console.log('🧪 Testing new functions...');
    
    const testUser = await query('SELECT id FROM users LIMIT 1');
    if (testUser.rows.length > 0) {
      const userId = testUser.rows[0].id;
      
      // Test get_user_dealer_access function
      const dealerAccess = await query('SELECT * FROM get_user_dealer_access($1)', [userId]);
      console.log(`✅ get_user_dealer_access function working: ${dealerAccess.rows.length} results`);
      
      // Test user_has_permission function
      const hasPermission = await query('SELECT user_has_permission($1, $2) as has_permission', [userId, 'qr_code_generation']);
      console.log(`✅ user_has_permission function working: ${hasPermission.rows[0].has_permission}`);
    }
    
    console.log('🎉 Multi-user migration completed successfully!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Update your main app.js to include the staff routes:');
    console.log('   import staffRoutes from "./routes/staff.js";');
    console.log('   app.use("/api/staff", staffRoutes);');
    console.log('');
    console.log('2. Test the system by creating staff members through the API');
    console.log('3. Update your frontend to use the new user structure');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToMultiUser()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export default migrateToMultiUser;

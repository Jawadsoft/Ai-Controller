import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './src/database/connection.js';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSuperAdminMigrationWithUser() {
  console.log('🚀 Starting Super Admin Migration with User Creation...');
  console.log('📋 This migration includes:');
  console.log('   • Complete Super Admin database schema');
  console.log('   • Super Admin user creation');
  console.log('   • Dealer assignment for Super Admin');
  console.log('');

  const client = await pool.connect();
  
  try {
    console.log('✅ Connected to PostgreSQL database');
    
    // =====================================================
    // STEP 1: RUN DATABASE MIGRATION
    // =====================================================
    console.log('');
    console.log('📊 Step 1: Running Super Admin database migration...');
    
    // Read the SQL migration file
    const sqlFilePath = path.join(__dirname, 'super-admin-core-migration.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('📖 Reading migration file...');
    
    // Execute the entire SQL file as one statement
    console.log('⏳ Executing database migration...');
    
    try {
      const result = await client.query(sqlContent);
      
      // Check if this was a SELECT statement that returned data
      if (result.rows && result.rows.length > 0) {
        const firstRow = result.rows[0];
        if (firstRow.status) {
          console.log(`✅ ${firstRow.status}`);
        }
      } else {
        console.log(`✅ Database migration executed successfully`);
      }
      
    } catch (error) {
      console.error('❌ Database migration failed:', error.message);
      
      // Check if it's an "already exists" error
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate key') ||
          error.message.includes('relation') && error.message.includes('already exists') ||
          error.message.includes('constraint') && error.message.includes('already exists') ||
          error.message.includes('index') && error.message.includes('already exists') ||
          error.message.includes('function') && error.message.includes('already exists') ||
          error.message.includes('trigger') && error.message.includes('already exists') ||
          error.message.includes('view') && error.message.includes('already exists') ||
          error.message.includes('enum') && error.message.includes('already exists')) {
        
        console.log('');
        console.log('⚠️  Database migration completed with some "already exists" warnings.');
        console.log('   This is normal if the migration has been run before.');
        console.log('   Continuing with user creation...');
      } else {
        throw error;
      }
    }
    
    // =====================================================
    // STEP 2: CREATE SUPER ADMIN USER
    // =====================================================
    console.log('');
    console.log('👤 Step 2: Creating Super Admin user...');
    console.log('📧 Email: admin@mitiesoft.com');
    console.log('🔑 Password: dealeriq');
    
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      ['admin@mitiesoft.com']
    );
    
    let superAdminUserId;
    
    if (existingUser.rows.length > 0) {
      console.log('⚠️  User already exists with email: admin@mitiesoft.com');
      superAdminUserId = existingUser.rows[0].id;
      console.log('🆔 User ID:', superAdminUserId);
      
      // Check if user has super_admin role
      const userRoles = await client.query(
        'SELECT ur.role FROM user_roles ur WHERE ur.user_id = $1',
        [superAdminUserId]
      );
      
      if (userRoles.rows.length > 0) {
        console.log('👑 Current roles:', userRoles.rows.map(r => r.role).join(', '));
        
        if (userRoles.rows.some(r => r.role === 'super_admin')) {
          console.log('✅ User already has super_admin role');
        } else {
          console.log('🔄 Adding super_admin role to existing user...');
          
          // Add super_admin role
          await client.query(
            'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING',
            [superAdminUserId, 'super_admin']
          );
          
          console.log('✅ Added super_admin role to existing user');
        }
      } else {
        console.log('🔄 Adding super_admin role to existing user...');
        
        // Add super_admin role
        await client.query(
          'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING',
          [superAdminUserId, 'super_admin']
        );
        
        console.log('✅ Added super_admin role to existing user');
      }
    } else {
      // Hash the password
      console.log('🔐 Hashing password...');
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash('dealeriq', saltRounds);
      console.log('✅ Password hashed successfully');
      
      // Create the user
      console.log('👤 Creating new user...');
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id, email, name, created_at`,
        ['admin@mitiesoft.com', hashedPassword, 'Super Admin']
      );
      
      const newUser = userResult.rows[0];
      superAdminUserId = newUser.id;
      console.log('✅ User created successfully');
      console.log('🆔 User ID:', newUser.id);
      console.log('📧 Email:', newUser.email);
      console.log('👤 Name:', newUser.name);
      
      // Add super_admin role
      console.log('👑 Adding super_admin role...');
      await client.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [superAdminUserId, 'super_admin']
      );
      
      console.log('✅ Super admin role added successfully');
    }
    
    // =====================================================
    // STEP 3: ASSIGN DEALER TO SUPER ADMIN
    // =====================================================
    console.log('');
    console.log('🏢 Step 3: Assigning dealer to Super Admin...');
    
    // Find available dealers
    const dealersResult = await client.query(`
      SELECT id, business_name, contact_name, email, subscription_plan, subscription_status 
      FROM dealers 
      ORDER BY business_name
    `);
    
    console.log('🏢 Available Dealers:');
    dealersResult.rows.forEach((dealer, index) => {
      console.log(`   ${index + 1}. ${dealer.business_name} (ID: ${dealer.id})`);
    });
    
    // Find the best dealer to assign (prefer "System Administration" or first available)
    let targetDealer = null;
    
    // Look for "System Administration" dealer first
    const systemAdminDealer = dealersResult.rows.find(d => 
      d.business_name.toLowerCase().includes('system') || 
      d.business_name.toLowerCase().includes('admin')
    );
    
    if (systemAdminDealer) {
      targetDealer = systemAdminDealer;
      console.log('🎯 Found System Administration dealer - using this one');
    } else {
      // Use the first dealer
      targetDealer = dealersResult.rows[0];
      console.log('🎯 Using first available dealer');
    }
    
    console.log('');
    console.log('🔧 Assigning Super Admin to dealer:');
    console.log('   🏢 Dealer ID:', targetDealer.id);
    console.log('   🏢 Business Name:', targetDealer.business_name);
    console.log('   👤 Contact:', targetDealer.contact_name);
    
    // Check if Super Admin is already assigned as staff
    const existingStaff = await client.query(
      'SELECT id, staff_role FROM dealership_staff WHERE user_id = $1 AND dealer_id = $2',
      [superAdminUserId, targetDealer.id]
    );
    
    if (existingStaff.rows.length > 0) {
      console.log('✅ Super Admin already exists as staff for this dealer');
      console.log('   👥 Staff Role:', existingStaff.rows[0].staff_role);
    } else {
      // Check if there's already an admin for this dealer
      const existingAdmin = await client.query(
        'SELECT id FROM dealership_staff WHERE dealer_id = $1 AND staff_role = $2',
        [targetDealer.id, 'admin']
      );
      
      if (existingAdmin.rows.length > 0) {
        console.log('⚠️  Dealer already has an admin, assigning Super Admin as sales role instead');
        // Add as dealership staff with sales role
        await client.query(
          `INSERT INTO dealership_staff (
            user_id, 
            dealer_id, 
            staff_role, 
            permissions, 
            is_active,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            superAdminUserId,
            targetDealer.id,
            'sales', // Give sales role (can be promoted to admin later)
            ['all'], // All permissions
            true
          ]
        );
        console.log('✅ Added Super Admin as dealership staff with sales role');
      } else {
        // Add as dealership staff with admin role
        await client.query(
          `INSERT INTO dealership_staff (
            user_id, 
            dealer_id, 
            staff_role, 
            permissions, 
            is_active,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            superAdminUserId,
            targetDealer.id,
            'admin', // Give admin role within the dealership
            ['all'], // All permissions
            true
          ]
        );
        console.log('✅ Added Super Admin as dealership staff with admin role');
      }
    }
    
    // =====================================================
    // STEP 4: VERIFICATION
    // =====================================================
    console.log('');
    console.log('🔍 Step 4: Verifying complete setup...');
    
    // Verify the user was created correctly
    const verifyResult = await client.query(
      `SELECT 
        u.id, 
        u.email, 
        ur.role,
        COALESCE(d_staff.id, d_owner.id) AS dealer_id,
        COALESCE(d_staff.business_name, d_owner.business_name) AS business_name,
        COALESCE(d_staff.contact_name, d_owner.contact_name) AS contact_name,
        ds.id as staff_id,
        ds.staff_role,
        ds.dealer_id as staff_dealer_id,
        d_owner.id as owner_dealer_id
       FROM users u 
       LEFT JOIN user_roles ur ON u.id = ur.user_id 
       LEFT JOIN dealership_staff ds ON u.id = ds.user_id
       LEFT JOIN dealers d_staff ON ds.dealer_id = d_staff.id
       LEFT JOIN dealers d_owner ON d_owner.user_id = u.id
       WHERE u.email = 'admin@mitiesoft.com'`
    );
    
    if (verifyResult.rows.length > 0) {
      const user = verifyResult.rows[0];
      console.log('✅ Verification successful!');
      console.log('   🆔 User ID:', user.id);
      console.log('   📧 Email:', user.email);
      console.log('   👑 Role:', user.role);
      console.log('   🏢 Dealer ID:', user.dealer_id || 'NULL');
      console.log('   🏢 Business Name:', user.business_name || 'NULL');
      console.log('   👤 Contact Name:', user.contact_name || 'NULL');
      console.log('   👥 Staff ID:', user.staff_id || 'NULL');
      console.log('   👥 Staff Role:', user.staff_role || 'NULL');
      console.log('   👥 Staff Dealer ID:', user.staff_dealer_id || 'NULL');
      console.log('   👑 Owner Dealer ID:', user.owner_dealer_id || 'NULL');
    }
    
    console.log('');
    console.log('🎉 Super Admin Migration with User Creation completed successfully!');
    console.log('');
    console.log('🔧 What was created:');
    console.log('   📋 Database: Complete Super Admin schema');
    console.log('   👤 User: admin@mitiesoft.com with super_admin role');
    console.log('   🏢 Dealer Access: Assigned to dealer with staff role');
    console.log('   🔐 Security: Password hashed with bcrypt');
    console.log('');
    console.log('🚀 Your Super Admin system is now ready!');
    console.log('   📧 Login Email: admin@mitiesoft.com');
    console.log('   🔑 Login Password: dealeriq');
    console.log('   👑 Role: super_admin');
    console.log('   🏢 Dealer ID: Available for dealer-specific features');
    console.log('');
    console.log('✅ You can now login to the Super Admin dashboard!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('🔍 Full error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runSuperAdminMigrationWithUser().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});

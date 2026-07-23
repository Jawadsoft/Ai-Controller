import { pool } from './src/database/connection.js';

async function createRolesTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting roles table migration...');
    
    // Create roles table
    console.log('📋 Creating roles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        description TEXT,
        permissions JSONB DEFAULT '[]',
        is_system_role BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Roles table created successfully');

    // Insert default system roles
    console.log('📋 Inserting default system roles...');
    await client.query(`
      INSERT INTO roles (name, display_name, description, permissions, is_system_role) VALUES
      ('super_admin', 'Super Admin', 'Full platform access with all permissions', '["qr_code_generation", "lead_management", "vehicle_import", "analytics_dashboard", "bulk_actions", "staff_management", "user_management", "custom_branding", "api_access", "priority_support"]', true),
      ('admin', 'Dealership Admin', 'Full dealership access with staff management', '["qr_code_generation", "lead_management", "vehicle_import", "analytics_dashboard", "bulk_actions", "staff_management", "user_management", "custom_branding", "api_access", "priority_support"]', true),
      ('sales', 'Sales Representative', 'Sales-focused access for lead management and vehicle operations', '["qr_code_generation", "lead_management", "vehicle_import"]', true),
      ('finance', 'Finance Manager', 'Finance-focused access for lead management and analytics', '["lead_management", "analytics_dashboard"]', true),
      ('service', 'Service Advisor', 'Service-focused access for lead management', '["lead_management"]', true),
      ('inventory', 'Inventory Manager', 'Inventory-focused access for vehicle management', '["vehicle_import", "qr_code_generation"]', true)
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Default system roles inserted successfully');

    // Create indexes for better performance
    console.log('📋 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roles_system_role ON roles(is_system_role)
    `);
    console.log('✅ Indexes created successfully');

    // Add table comment
    await client.query(`
      COMMENT ON TABLE roles IS 'Dynamic role management table with permissions'
    `);
    await client.query(`
      COMMENT ON COLUMN roles.permissions IS 'JSON array of permission names'
    `);
    await client.query(`
      COMMENT ON COLUMN roles.is_system_role IS 'Whether this is a system-defined role that cannot be deleted'
    `);
    console.log('✅ Table comments added');

    // Verify the migration
    console.log('📋 Verifying migration...');
    const result = await client.query('SELECT COUNT(*) FROM roles');
    console.log(`📊 Total roles in database: ${result.rows[0].count}`);
    
    const systemRoles = await client.query('SELECT name, display_name FROM roles WHERE is_system_role = true ORDER BY name');
    console.log('📋 System roles created:');
    systemRoles.rows.forEach(role => {
      console.log(`   - ${role.display_name} (${role.name})`);
    });

    console.log('🎉 Roles table migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
createRolesTable()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

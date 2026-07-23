/**
 * Staff Users and Leads Database Migration
 * 
 * This file contains all the database changes implemented during the staff management
 * and lead assignment system development. It includes:
 * 
 * 1. Lead Assignment System
 * 2. Staff Role Management
 * 3. Foreign Key Constraints
 * 4. Indexes for Performance
 * 
 * Run this file to apply all database changes at once.
 */

import { query } from './src/database/connection.js';

async function runStaffLeadsMigration() {
  console.log('🚀 Starting Staff Users and Leads Database Migration...');
  
  try {
    // 1. Lead Assignment System
    console.log('📝 Adding lead assignment fields to leads table...');
    
    await query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES dealership_staff(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL
    `);
    
    console.log('✅ Lead assignment fields added successfully');
    
    // 2. Create indexes for performance
    console.log('📊 Creating indexes for lead assignment...');
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_leads_assigned_by ON leads(assigned_by)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_leads_dealer_id ON leads(dealer_id)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at)
    `);
    
    console.log('✅ Indexes created successfully');
    
    // 3. Add comments for documentation
    console.log('📚 Adding column comments...');
    
    await query(`
      COMMENT ON COLUMN leads.assigned_to IS 'Sales agent assigned to this lead'
    `);
    
    await query(`
      COMMENT ON COLUMN leads.assigned_at IS 'When the lead was assigned'
    `);
    
    await query(`
      COMMENT ON COLUMN leads.assigned_by IS 'Who assigned the lead (admin user)'
    `);
    
    console.log('✅ Column comments added successfully');
    
    // 4. Ensure dealership_staff table has proper structure
    console.log('👥 Verifying dealership_staff table structure...');
    
    // Check if dealership_staff table exists and has required columns
    const staffTableCheck = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'dealership_staff'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Current dealership_staff table structure:');
    staffTableCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // 5. Verify foreign key constraints
    console.log('🔗 Checking foreign key constraints...');
    
    const fkConstraints = await query(`
      SELECT 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'leads'
        AND kcu.column_name IN ('assigned_to', 'assigned_by')
    `);
    
    console.log('🔗 Foreign key constraints for leads table:');
    fkConstraints.rows.forEach(row => {
      console.log(`  - ${row.constraint_name}: ${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
    });
    
    // 6. Create a view for lead assignment summary
    console.log('👁️ Creating lead assignment summary view...');
    
    await query(`
      CREATE OR REPLACE VIEW lead_assignment_summary AS
      SELECT 
        l.id as lead_id,
        l.customer_name,
        l.customer_email,
        l.status as lead_status,
        l.created_at as lead_created_at,
        l.assigned_at,
        l.assigned_by,
        -- Assigned agent info
        u_assigned.name as assigned_agent_name,
        u_assigned.email as assigned_agent_email,
        ds_assigned.staff_role as assigned_agent_role,
        -- Assigned by info
        u_assigner.name as assigned_by_name,
        u_assigner.email as assigned_by_email,
        -- Dealer info
        d.business_name as dealer_name,
        -- Vehicle info
        v.make,
        v.model,
        v.year,
        v.vin
      FROM leads l
      LEFT JOIN dealership_staff ds_assigned ON l.assigned_to = ds_assigned.id
      LEFT JOIN users u_assigned ON ds_assigned.user_id = u_assigned.id
      LEFT JOIN users u_assigner ON l.assigned_by = u_assigner.id
      LEFT JOIN dealers d ON l.dealer_id = d.id
      LEFT JOIN vehicles v ON l.vehicle_id = v.id
      ORDER BY l.created_at DESC
    `);
    
    console.log('✅ Lead assignment summary view created successfully');
    
    // 7. Create a function to get staff permissions
    console.log('⚙️ Creating staff permissions function...');
    
    await query(`
      CREATE OR REPLACE FUNCTION get_staff_permissions(staff_id UUID)
      RETURNS TABLE (
        can_manage_staff BOOLEAN,
        can_assign_leads BOOLEAN,
        can_view_all_leads BOOLEAN,
        can_manage_vehicles BOOLEAN,
        can_access_analytics BOOLEAN
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          CASE 
            WHEN ds.staff_role = 'admin' THEN TRUE
            ELSE FALSE
          END as can_manage_staff,
          CASE 
            WHEN ds.staff_role = 'admin' THEN TRUE
            ELSE FALSE
          END as can_assign_leads,
          CASE 
            WHEN ds.staff_role IN ('admin', 'sales') THEN TRUE
            ELSE FALSE
          END as can_view_all_leads,
          CASE 
            WHEN ds.staff_role IN ('admin', 'inventory') THEN TRUE
            ELSE FALSE
          END as can_manage_vehicles,
          CASE 
            WHEN ds.staff_role = 'admin' THEN TRUE
            ELSE FALSE
          END as can_access_analytics
        FROM dealership_staff ds
        WHERE ds.id = staff_id AND ds.is_active = TRUE;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Staff permissions function created successfully');
    
    // 8. Create a trigger to update assigned_at timestamp
    console.log('⏰ Creating assignment timestamp trigger...');
    
    await query(`
      CREATE OR REPLACE FUNCTION update_assigned_at()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Update assigned_at when assigned_to changes
        IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
          IF NEW.assigned_to IS NOT NULL THEN
            NEW.assigned_at = NOW();
          ELSE
            NEW.assigned_at = NULL;
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await query(`
      DROP TRIGGER IF EXISTS trigger_update_assigned_at ON leads;
      CREATE TRIGGER trigger_update_assigned_at
        BEFORE UPDATE ON leads
        FOR EACH ROW
        EXECUTE FUNCTION update_assigned_at();
    `);
    
    console.log('✅ Assignment timestamp trigger created successfully');
    
    // 9. Insert sample data for testing (optional)
    console.log('🧪 Checking for sample data...');
    
    const leadCount = await query('SELECT COUNT(*) as count FROM leads');
    const staffCount = await query('SELECT COUNT(*) as count FROM dealership_staff');
    
    console.log(`📊 Current data: ${leadCount.rows[0].count} leads, ${staffCount.rows[0].count} staff members`);
    
    // 10. Create a comprehensive report
    console.log('📈 Generating migration report...');
    
    const report = await query(`
      SELECT 
        'leads' as table_name,
        COUNT(*) as total_records,
        COUNT(assigned_to) as assigned_leads,
        COUNT(*) - COUNT(assigned_to) as unassigned_leads,
        ROUND((COUNT(assigned_to)::DECIMAL / COUNT(*)) * 100, 2) as assignment_percentage
      FROM leads
      UNION ALL
      SELECT 
        'dealership_staff' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN staff_role = 'sales' THEN 1 END) as sales_agents,
        COUNT(CASE WHEN staff_role = 'admin' THEN 1 END) as admins,
        NULL as assignment_percentage
      FROM dealership_staff
      WHERE is_active = TRUE
    `);
    
    console.log('📈 Migration Report:');
    report.rows.forEach(row => {
      console.log(`  ${row.table_name}:`);
      console.log(`    - Total records: ${row.total_records}`);
      if (row.table_name === 'leads') {
        console.log(`    - Assigned leads: ${row.assigned_leads}`);
        console.log(`    - Unassigned leads: ${row.unassigned_leads}`);
        console.log(`    - Assignment rate: ${row.assignment_percentage}%`);
      } else {
        console.log(`    - Sales agents: ${row.sales_agents}`);
        console.log(`    - Admins: ${row.admins}`);
      }
    });
    
    console.log('🎉 Staff Users and Leads Database Migration completed successfully!');
    console.log('');
    console.log('📋 Summary of changes:');
    console.log('  ✅ Added lead assignment fields (assigned_to, assigned_at, assigned_by)');
    console.log('  ✅ Created performance indexes');
    console.log('  ✅ Added column documentation');
    console.log('  ✅ Created lead assignment summary view');
    console.log('  ✅ Created staff permissions function');
    console.log('  ✅ Added assignment timestamp trigger');
    console.log('  ✅ Verified foreign key constraints');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('  1. Test lead assignment functionality');
    console.log('  2. Verify staff role permissions');
    console.log('  3. Check analytics integration');
    console.log('  4. Monitor performance with new indexes');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Rollback function (if needed)
async function rollbackStaffLeadsMigration() {
  console.log('🔄 Rolling back Staff Users and Leads Database Migration...');
  
  try {
    // Remove trigger
    await query('DROP TRIGGER IF EXISTS trigger_update_assigned_at ON leads');
    await query('DROP FUNCTION IF EXISTS update_assigned_at()');
    
    // Remove function
    await query('DROP FUNCTION IF EXISTS get_staff_permissions(UUID)');
    
    // Remove view
    await query('DROP VIEW IF EXISTS lead_assignment_summary');
    
    // Remove indexes
    await query('DROP INDEX IF EXISTS idx_leads_assigned_to');
    await query('DROP INDEX IF EXISTS idx_leads_assigned_by');
    await query('DROP INDEX IF EXISTS idx_leads_dealer_id');
    await query('DROP INDEX IF EXISTS idx_leads_status');
    await query('DROP INDEX IF EXISTS idx_leads_created_at');
    
    // Remove columns (be careful with this!)
    // await query('ALTER TABLE leads DROP COLUMN IF EXISTS assigned_to');
    // await query('ALTER TABLE leads DROP COLUMN IF EXISTS assigned_at');
    // await query('ALTER TABLE leads DROP COLUMN IF EXISTS assigned_by');
    
    console.log('✅ Rollback completed successfully');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// Export functions for use
export { runStaffLeadsMigration, rollbackStaffLeadsMigration };

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runStaffLeadsMigration()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

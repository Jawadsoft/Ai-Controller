#!/usr/bin/env node

/**
 * Simplified Leads Table Migration
 * 
 * This migration only adds the essential fields needed for the lead assignment system:
 * - assigned_to: References dealership_staff(id) for sales agent assignment
 * - assigned_at: Timestamp when the lead was assigned
 * - assigned_by: References users(id) for who assigned the lead
 * 
 * Plus basic indexes for performance.
 */

import { query } from './src/database/connection.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runSimpleLeadsMigration() {
  console.log('📝 Starting Simple Leads Table Migration...');
  console.log('============================================');
  console.log('');

  try {
    // 1. Add lead assignment fields
    console.log('🔗 Adding lead assignment fields...');
    
    await query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES dealership_staff(id) ON DELETE SET NULL
    `);
    
    await query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE
    `);
    
    await query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL
    `);
    
    console.log('✅ Lead assignment fields added successfully');
    console.log('  - assigned_to: References dealership_staff(id)');
    console.log('  - assigned_at: Timestamp when assigned');
    console.log('  - assigned_by: User who assigned the lead');
    console.log('');

    // 2. Create basic indexes for performance
    console.log('📊 Creating performance indexes...');
    
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
    
    console.log('✅ Performance indexes created successfully');
    console.log('');

    // 3. Add column comments for documentation
    console.log('📚 Adding column documentation...');
    
    await query(`
      COMMENT ON COLUMN leads.assigned_to IS 'Sales agent assigned to this lead'
    `);
    
    await query(`
      COMMENT ON COLUMN leads.assigned_at IS 'When the lead was assigned to a sales agent'
    `);
    
    await query(`
      COMMENT ON COLUMN leads.assigned_by IS 'User who assigned the lead (admin user)'
    `);
    
    console.log('✅ Column documentation added');
    console.log('');

    // 4. Generate simple migration report
    console.log('📈 Generating migration report...');
    
    const report = await query(`
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) as assigned_leads,
        COUNT(CASE WHEN assigned_to IS NULL THEN 1 END) as unassigned_leads
      FROM leads
    `);
    
    console.log('📊 Migration Report:');
    console.log(`  Total leads: ${report.rows[0].total_leads}`);
    console.log(`  Assigned leads: ${report.rows[0].assigned_leads}`);
    console.log(`  Unassigned leads: ${report.rows[0].unassigned_leads}`);
    console.log('');

    console.log('🎉 Simple Leads Table Migration completed successfully!');
    console.log('');
    console.log('📋 Summary of changes:');
    console.log('  ✅ Added lead assignment fields (assigned_to, assigned_at, assigned_by)');
    console.log('  ✅ Created performance indexes');
    console.log('  ✅ Added column documentation');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('  1. Test lead assignment functionality');
    console.log('  2. Verify staff can only see assigned leads');
    console.log('  3. Test admin lead assignment features');
    
  } catch (error) {
    console.error('❌ Simple leads migration failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Export function
export { runSimpleLeadsMigration };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSimpleLeadsMigration()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

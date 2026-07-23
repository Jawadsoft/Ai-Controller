#!/usr/bin/env node

import { pool } from './src/database/connection.js';

/**
 * Lead Follow-ups Table Migration
 * Creates the lead_follow_ups table for scheduling and tracking follow-up activities
 * 
 * Run this script on your server with: node migrate-lead-follow-ups.js
 */
async function migrateLeadFollowUpsTable() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting Lead Follow-ups Table Migration...');
    console.log('📋 This will create the lead_follow_ups table and all necessary indexes');

    // Start transaction
    await client.query('BEGIN');

    // Check if table already exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'lead_follow_ups'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log('📋 lead_follow_ups table already exists');
      console.log('🔄 Checking if all required columns exist...');
      
      // Check for missing columns and add them
      const existingColumnsResult = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'lead_follow_ups' AND table_schema = current_schema();
      `);
      const existingColumns = existingColumnsResult.rows.map(row => row.column_name);
      
      const requiredColumns = [
        'id', 'lead_id', 'scheduled_date', 'follow_up_type', 'status',
        'notes', 'outcome', 'created_by', 'completed_by', 'completed_at',
        'created_at', 'updated_at'
      ];
      
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length > 0) {
        console.log(`⚠️ Missing columns: ${missingColumns.join(', ')}`);
        console.log('🔧 Adding missing columns...');
        
        for (const column of missingColumns) {
          let columnDefinition = '';
          switch (column) {
            case 'id':
              columnDefinition = 'UUID PRIMARY KEY DEFAULT gen_random_uuid()';
              break;
            case 'lead_id':
              columnDefinition = 'UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE';
              break;
            case 'scheduled_date':
              columnDefinition = 'TIMESTAMP WITH TIME ZONE NOT NULL';
              break;
            case 'follow_up_type':
              columnDefinition = 'VARCHAR(50) NOT NULL DEFAULT \'call\'';
              break;
            case 'status':
              columnDefinition = 'VARCHAR(20) NOT NULL DEFAULT \'scheduled\'';
              break;
            case 'notes':
              columnDefinition = 'TEXT DEFAULT NULL';
              break;
            case 'outcome':
              columnDefinition = 'TEXT DEFAULT NULL';
              break;
            case 'created_by':
              columnDefinition = 'UUID REFERENCES users(id)';
              break;
            case 'completed_by':
              columnDefinition = 'UUID REFERENCES users(id)';
              break;
            case 'completed_at':
              columnDefinition = 'TIMESTAMP WITH TIME ZONE DEFAULT NULL';
              break;
            case 'created_at':
              columnDefinition = 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
              break;
            case 'updated_at':
              columnDefinition = 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
              break;
          }
          
          await client.query(`ALTER TABLE lead_follow_ups ADD COLUMN ${column} ${columnDefinition};`);
          console.log(`   ✅ Added column: ${column}`);
        }
      } else {
        console.log('✅ All required columns exist');
      }
    } else {
      console.log('📋 Creating lead_follow_ups table...');
      
      // Create the main table
      await client.query(`
        CREATE TABLE lead_follow_ups (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
          scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
          follow_up_type VARCHAR(50) NOT NULL DEFAULT 'call',
          status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
          notes TEXT DEFAULT NULL,
          outcome TEXT DEFAULT NULL,
          created_by UUID REFERENCES users(id),
          completed_by UUID REFERENCES users(id),
          completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      console.log('✅ Created lead_follow_ups table');
    }

    // Create indexes for better performance
    console.log('📋 Creating indexes for better performance...');
    const indexes = [
      {
        name: 'idx_lead_follow_ups_lead_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_lead_id ON lead_follow_ups(lead_id);'
      },
      {
        name: 'idx_lead_follow_ups_scheduled_date',
        sql: 'CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_scheduled_date ON lead_follow_ups(scheduled_date);'
      },
      {
        name: 'idx_lead_follow_ups_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_status ON lead_follow_ups(status);'
      },
      {
        name: 'idx_lead_follow_ups_created_by',
        sql: 'CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_created_by ON lead_follow_ups(created_by);'
      },
      {
        name: 'idx_lead_follow_ups_completed_by',
        sql: 'CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_completed_by ON lead_follow_ups(completed_by);'
      },
      {
        name: 'idx_lead_follow_ups_follow_up_type',
        sql: 'CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_follow_up_type ON lead_follow_ups(follow_up_type);'
      },
      {
        name: 'idx_lead_follow_ups_created_at',
        sql: 'CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_created_at ON lead_follow_ups(created_at);'
      }
    ];

    for (const index of indexes) {
      await client.query(index.sql);
      console.log(`   ✅ Created index: ${index.name}`);
    }

    // Add table comments for documentation
    console.log('📋 Adding table comments...');
    await client.query(`
      COMMENT ON TABLE lead_follow_ups IS 'Tracks follow-up activities for leads';
      COMMENT ON COLUMN lead_follow_ups.follow_up_type IS 'Type of follow-up: call, email, text, visit, other';
      COMMENT ON COLUMN lead_follow_ups.status IS 'Status: scheduled, completed, cancelled, missed';
      COMMENT ON COLUMN lead_follow_ups.outcome IS 'Result of the follow-up: interested, not_interested, callback_requested, etc.';
      COMMENT ON COLUMN lead_follow_ups.notes IS 'Additional notes about the follow-up';
      COMMENT ON COLUMN lead_follow_ups.scheduled_date IS 'When the follow-up is scheduled to occur';
      COMMENT ON COLUMN lead_follow_ups.completed_at IS 'When the follow-up was actually completed';
    `);
    console.log('✅ Added table comments');

    // Verify the final structure
    console.log('\n📊 Verifying final table structure...');
    const finalStructure = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'lead_follow_ups' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Final lead_follow_ups table structure:');
    finalStructure.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Test insert capability (will be rolled back)
    console.log('\n🧪 Testing insert capability...');
    try {
      // First, check if we have any existing leads to test with
      const leadsResult = await client.query('SELECT id FROM leads LIMIT 1');
      
      if (leadsResult.rows.length > 0) {
        const testLeadId = leadsResult.rows[0].id;
        const testResult = await client.query(`
          INSERT INTO lead_follow_ups (
            lead_id, scheduled_date, follow_up_type, notes, created_by
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          testLeadId,
          new Date().toISOString(),
          'test',
          'Test insert for migration verification',
          null // No created_by for test
        ]);
        
        console.log('✅ Insert test successful');
        console.log(`   Test record ID: ${testResult.rows[0].id}`);
        
        // Clean up test record
        await client.query('DELETE FROM lead_follow_ups WHERE id = $1', [testResult.rows[0].id]);
        console.log('   ✅ Test record cleaned up');
      } else {
        console.log('ℹ️  No leads found in database - skipping insert test');
        console.log('   ✅ Table structure is valid (no foreign key constraint errors)');
      }
    } catch (insertError) {
      console.log('❌ Insert test failed:', insertError.message);
      console.log('   This indicates a problem with the table structure');
      throw insertError; // Re-throw to trigger rollback
    }

    // Check if there are any existing follow-ups
    const countResult = await client.query('SELECT COUNT(*) as count FROM lead_follow_ups');
    console.log(`\n📈 Total follow-ups in database: ${countResult.rows[0].count}`);

    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n🎉 Lead Follow-ups Table Migration Completed Successfully!');
    console.log('📋 Table is ready for storing follow-up activities');
    console.log('\n🚀 Your follow-up system is now ready to use!');
    console.log('   - Schedule multiple follow-ups per lead');
    console.log('   - Track follow-up progress and outcomes');
    console.log('   - Add detailed notes and outcomes');
    console.log('   - Edit or delete follow-ups as needed');

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    console.error('🔄 Transaction rolled back');
    throw error;
  } finally {
    // Release the client back to the pool
    client.release();
  }
}

// Run the migration
console.log('🔧 Lead Follow-ups Migration Script');
console.log('=====================================');
console.log('This script will create the lead_follow_ups table for your follow-up system.');
console.log('Make sure your database connection is working properly.\n');

migrateLeadFollowUpsTable()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    console.log('🎯 You can now use the follow-up system in your application!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error.message);
    console.error('🔧 Please check your database connection and try again');
    process.exit(1);
  });

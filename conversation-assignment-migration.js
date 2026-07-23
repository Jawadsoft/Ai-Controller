import { pool } from './src/database/connection.js';

async function addConversationAssignmentColumns() {
  try {
    console.log('🔄 Adding assignment columns to daive_conversations table...');

    // First, check what staff table exists
    const checkStaffTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('staff', 'dealership_staff')
      AND table_schema = 'public'
    `;
    
    const staffTables = await pool.query(checkStaffTablesQuery);
    const staffTableNames = staffTables.rows.map(row => row.table_name);
    
    console.log('📋 Available staff tables:', staffTableNames);
    
    // Determine which staff table to use
    const staffTable = staffTableNames.includes('dealership_staff') ? 'dealership_staff' : 'staff';
    console.log('🎯 Using staff table:', staffTable);

    // Check if columns already exist
    const checkColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'daive_conversations' 
      AND column_name IN ('assigned_to', 'assigned_at', 'assigned_by', 'assigned_staff_id')
    `;
    
    const existingColumns = await pool.query(checkColumnsQuery);
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);
    
    console.log('📋 Existing assignment columns:', existingColumnNames);

    // Add assigned_to column if it doesn't exist
    if (!existingColumnNames.includes('assigned_to')) {
      console.log('➕ Adding assigned_to column...');
      await pool.query(`
        ALTER TABLE daive_conversations 
        ADD COLUMN assigned_to UUID REFERENCES ${staffTable}(id) ON DELETE SET NULL
      `);
      console.log('✅ assigned_to column added');
    } else {
      console.log('⏭️ assigned_to column already exists');
    }

    // Add assigned_staff_id column if it doesn't exist (for compatibility)
    if (!existingColumnNames.includes('assigned_staff_id')) {
      console.log('➕ Adding assigned_staff_id column...');
      await pool.query(`
        ALTER TABLE daive_conversations 
        ADD COLUMN assigned_staff_id UUID REFERENCES ${staffTable}(id) ON DELETE SET NULL
      `);
      console.log('✅ assigned_staff_id column added');
    } else {
      console.log('⏭️ assigned_staff_id column already exists');
    }

    // Add assigned_at column if it doesn't exist
    if (!existingColumnNames.includes('assigned_at')) {
      console.log('➕ Adding assigned_at column...');
      await pool.query(`
        ALTER TABLE daive_conversations 
        ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE
      `);
      console.log('✅ assigned_at column added');
    } else {
      console.log('⏭️ assigned_at column already exists');
    }

    // Add assigned_by column if it doesn't exist
    if (!existingColumnNames.includes('assigned_by')) {
      console.log('➕ Adding assigned_by column...');
      await pool.query(`
        ALTER TABLE daive_conversations 
        ADD COLUMN assigned_by UUID REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('✅ assigned_by column added');
    } else {
      console.log('⏭️ assigned_by column already exists');
    }

    // Add indexes for better performance
    console.log('🔍 Checking for indexes...');
    
    const checkIndexesQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'daive_conversations' 
      AND indexname IN ('idx_daive_conversations_assigned_to', 'idx_daive_conversations_assigned_at', 'idx_daive_conversations_assigned_staff_id')
    `;
    
    const existingIndexes = await pool.query(checkIndexesQuery);
    const existingIndexNames = existingIndexes.rows.map(row => row.indexname);

    // Add index on assigned_to if it doesn't exist
    if (!existingIndexNames.includes('idx_daive_conversations_assigned_to')) {
      console.log('➕ Adding index on assigned_to...');
      await pool.query(`
        CREATE INDEX idx_daive_conversations_assigned_to 
        ON daive_conversations(assigned_to)
      `);
      console.log('✅ Index on assigned_to added');
    } else {
      console.log('⏭️ Index on assigned_to already exists');
    }

    // Add index on assigned_staff_id if it doesn't exist
    if (!existingIndexNames.includes('idx_daive_conversations_assigned_staff_id')) {
      console.log('➕ Adding index on assigned_staff_id...');
      await pool.query(`
        CREATE INDEX idx_daive_conversations_assigned_staff_id 
        ON daive_conversations(assigned_staff_id)
      `);
      console.log('✅ Index on assigned_staff_id added');
    } else {
      console.log('⏭️ Index on assigned_staff_id already exists');
    }

    // Add index on assigned_at if it doesn't exist
    if (!existingIndexNames.includes('idx_daive_conversations_assigned_at')) {
      console.log('➕ Adding index on assigned_at...');
      await pool.query(`
        CREATE INDEX idx_daive_conversations_assigned_at 
        ON daive_conversations(assigned_at)
      `);
      console.log('✅ Index on assigned_at added');
    } else {
      console.log('⏭️ Index on assigned_at already exists');
    }

    console.log('🎉 Conversation assignment migration completed successfully!');
    
    // Verify the changes
    const verifyQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'daive_conversations' 
      AND column_name IN ('assigned_to', 'assigned_at', 'assigned_by', 'assigned_staff_id')
      ORDER BY column_name
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    console.log('📊 Verification - Assignment columns:');
    verifyResult.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Show table structure
    const tableStructureQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'daive_conversations' 
      ORDER BY ordinal_position
    `;
    
    const tableStructure = await pool.query(tableStructureQuery);
    console.log('\n📋 Complete daive_conversations table structure:');
    tableStructure.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}) ${row.column_default ? `default: ${row.column_default}` : ''}`);
    });

  } catch (error) {
    console.error('❌ Error adding conversation assignment columns:', error);
    throw error;
  }
}

// Run the migration
addConversationAssignmentColumns()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

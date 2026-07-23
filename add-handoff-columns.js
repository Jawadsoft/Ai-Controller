import { pool } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function addHandoffColumns() {
  try {
    console.log('🔧 Adding handoff columns to daive_conversations table...\n');

    // 1. Add handoff_reason column
    console.log('1️⃣ Adding handoff_reason column...');
    try {
      await pool.query(`
        ALTER TABLE daive_conversations 
        ADD COLUMN handoff_reason TEXT
      `);
      console.log('   ✅ handoff_reason column added');
    } catch (error) {
      if (error.code === '42701') {
        console.log('   ℹ️  handoff_reason column already exists');
      } else {
        throw error;
      }
    }

    // 2. Add handoff_requested_at column
    console.log('\n2️⃣ Adding handoff_requested_at column...');
    try {
      await pool.query(`
        ALTER TABLE daive_conversations 
        ADD COLUMN handoff_requested_at TIMESTAMP
      `);
      console.log('   ✅ handoff_requested_at column added');
    } catch (error) {
      if (error.code === '42701') {
        console.log('   ℹ️  handoff_requested_at column already exists');
      } else {
        throw error;
      }
    }

    // 3. Add handoff_accepted_at column
    console.log('\n3️⃣ Adding handoff_accepted_at column...');
    try {
      await pool.query(`
        ALTER TABLE daive_conversations 
        ADD COLUMN handoff_accepted_at TIMESTAMP
      `);
      console.log('   ✅ handoff_accepted_at column added');
    } catch (error) {
      if (error.code === '42701') {
        console.log('   ℹ️  handoff_accepted_at column already exists');
      } else {
        throw error;
      }
    }

    // 4. Add handoff_accepted_by column
    console.log('\n4️⃣ Adding handoff_accepted_by column...');
    try {
      await pool.query(`
        ALTER TABLE daive_conversations 
        ADD COLUMN handoff_accepted_by UUID
      `);
      console.log('   ✅ handoff_accepted_by column added');
    } catch (error) {
      if (error.code === '42701') {
        console.log('   ℹ️  handoff_accepted_by column already exists');
      } else {
        throw error;
      }
    }

    // 5. Add updated_at column if it doesn't exist
    console.log('\n5️⃣ Adding updated_at column...');
    try {
      await pool.query(`
        ALTER TABLE daive_conversations 
        ADD COLUMN updated_at TIMESTAMP DEFAULT NOW()
      `);
      console.log('   ✅ updated_at column added');
    } catch (error) {
      if (error.code === '42701') {
        console.log('   ℹ️  updated_at column already exists');
      } else {
        throw error;
      }
    }

    // 6. Create indexes for better performance
    console.log('\n6️⃣ Creating indexes...');
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_daive_conversations_handoff_requested 
        ON daive_conversations(handoff_requested)
      `);
      console.log('   ✅ handoff_requested index created');
    } catch (error) {
      console.log('   ℹ️  Index creation error (may already exist):', error.message);
    }

    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_daive_conversations_handoff_requested_at 
        ON daive_conversations(handoff_requested_at)
      `);
      console.log('   ✅ handoff_requested_at index created');
    } catch (error) {
      console.log('   ℹ️  Index creation error (may already exist):', error.message);
    }

    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_daive_conversations_handoff_accepted_at 
        ON daive_conversations(handoff_accepted_at)
      `);
      console.log('   ✅ handoff_accepted_at index created');
    } catch (error) {
      console.log('   ℹ️  Index creation error (may already exist):', error.message);
    }

    // 7. Update existing records to set updated_at to created_at if it's NULL
    console.log('\n7️⃣ Updating existing records...');
    try {
      const updateResult = await pool.query(`
        UPDATE daive_conversations 
        SET updated_at = created_at 
        WHERE updated_at IS NULL
      `);
      console.log(`   ✅ Updated ${updateResult.rowCount} records`);
    } catch (error) {
      console.log('   ℹ️  Update error:', error.message);
    }

    // 8. Display the final table structure
    console.log('\n8️⃣ Final table structure:');
    const columnsResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'daive_conversations' 
      ORDER BY ordinal_position
    `);

    columnsResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    console.log('\n🎉 Handoff columns added successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Test the functionality: node test-handoff-functionality.js');
    console.log('   2. Start your server: node server.js');
    console.log('   3. Navigate to D.A.I.V.E. Analytics page');
    console.log('   4. Test the handoff buttons in the Actions column');

  } catch (error) {
    console.error('❌ Error adding handoff columns:', error);
  } finally {
    await pool.end();
  }
}

addHandoffColumns();




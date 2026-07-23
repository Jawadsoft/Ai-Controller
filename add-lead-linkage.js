import { pool } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function addLeadLinkage() {
  try {
    console.log('🔗 Adding lead linkage to daive_conversations table...\n');

    // 1. Add lead_id column if it doesn't exist
    console.log('1️⃣ Adding lead_id column...');
    try {
      await pool.query(`
        ALTER TABLE daive_conversations 
        ADD COLUMN lead_id UUID REFERENCES leads(id)
      `);
      console.log('   ✅ lead_id column added successfully');
    } catch (error) {
      if (error.code === '42701') {
        console.log('   ℹ️  lead_id column already exists');
      } else {
        throw error;
      }
    }

    // 2. Create index on lead_id for better performance
    console.log('\n2️⃣ Creating index on lead_id...');
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_daive_conversations_lead_id 
        ON daive_conversations(lead_id)
      `);
      console.log('   ✅ lead_id index created');
    } catch (error) {
      console.log('   ℹ️  Index creation error (may already exist):', error.message);
    }

    // 3. Display the updated table structure
    console.log('\n3️⃣ Updated table structure:');
    const columnsResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'daive_conversations' 
      AND column_name IN ('lead_id', 'handoff_requested', 'handoff_accepted_at', 'handoff_accepted_by')
      ORDER BY column_name
    `);

    columnsResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    // 4. Test the leads table structure
    console.log('\n4️⃣ Leads table structure:');
    const leadsColumnsResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'leads' 
      ORDER BY ordinal_position
    `);

    leadsColumnsResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    console.log('\n🎉 Lead linkage setup completed successfully!');
    console.log('\n📋 What this enables:');
    console.log('   - When handoff is accepted, a lead is automatically created');
    console.log('   - Lead status is set to "hot" (high priority)');
    console.log('   - Interest level is calculated from qualification score');
    console.log('   - Lead includes handoff reason and conversation context');
    console.log('   - Conversations can be linked to leads via lead_id');

  } catch (error) {
    console.error('❌ Error setting up lead linkage:', error);
  } finally {
    await pool.end();
  }
}

addLeadLinkage();




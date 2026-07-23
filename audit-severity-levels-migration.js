import { pool } from './src/database/connection.js';

async function runAuditSeverityLevelsMigration() {
  console.log('🚀 Starting Audit Severity Levels Migration...');
  console.log('📋 This migration creates the audit_severity_levels table with default data');
  console.log('');

  const client = await pool.connect();
  
  try {
    console.log('✅ Connected to PostgreSQL database');
    
    // =====================================================
    // STEP 1: CREATE AUDIT_SEVERITY_LEVELS TABLE
    // =====================================================
    console.log('');
    console.log('📊 Step 1: Creating audit_severity_levels table...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS audit_severity_levels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        level INTEGER NOT NULL UNIQUE, -- 1=low, 2=medium, 3=high, 4=critical
        color TEXT DEFAULT '#3B82F6',
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    try {
      await client.query(createTableSQL);
      console.log('✅ audit_severity_levels table created successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  audit_severity_levels table already exists - continuing...');
      } else {
        throw error;
      }
    }
    
    // =====================================================
    // STEP 2: CREATE INDEXES
    // =====================================================
    console.log('');
    console.log('📊 Step 2: Creating indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_audit_severity_levels_name ON audit_severity_levels(name)',
      'CREATE INDEX IF NOT EXISTS idx_audit_severity_levels_level ON audit_severity_levels(level)'
    ];
    
    for (const indexSQL of indexes) {
      try {
        await client.query(indexSQL);
        console.log('✅ Index created successfully');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⚠️  Index already exists - skipping...');
        } else {
          console.log('⚠️  Index creation warning:', error.message);
        }
      }
    }
    
    // =====================================================
    // STEP 3: INSERT DEFAULT SEVERITY LEVELS
    // =====================================================
    console.log('');
    console.log('📊 Step 3: Inserting default severity levels...');
    
    const defaultSeverityLevels = [
      {
        name: 'Low',
        level: 1,
        color: '#10B981',
        description: 'Informational events'
      },
      {
        name: 'Medium',
        level: 2,
        color: '#F59E0B',
        description: 'Important events requiring attention'
      },
      {
        name: 'High',
        level: 3,
        color: '#EF4444',
        description: 'Critical events requiring immediate action'
      },
      {
        name: 'Critical',
        level: 4,
        color: '#DC2626',
        description: 'Emergency events requiring immediate response'
      }
    ];
    
    for (const severityLevel of defaultSeverityLevels) {
      try {
        await client.query(
          `INSERT INTO audit_severity_levels (name, level, color, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (name) DO UPDATE SET
             level = EXCLUDED.level,
             color = EXCLUDED.color,
             description = EXCLUDED.description`,
          [severityLevel.name, severityLevel.level, severityLevel.color, severityLevel.description]
        );
        console.log(`✅ Inserted/Updated severity level: ${severityLevel.name} (Level ${severityLevel.level})`);
      } catch (error) {
        console.log(`⚠️  Error inserting ${severityLevel.name}:`, error.message);
      }
    }
    
    // =====================================================
    // STEP 4: VERIFY DATA
    // =====================================================
    console.log('');
    console.log('📊 Step 4: Verifying inserted data...');
    
    const verifyResult = await client.query(
      'SELECT id, name, level, color, description, created_at FROM audit_severity_levels ORDER BY level'
    );
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful! Found severity levels:');
      verifyResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.name} (Level ${row.level}) - ${row.color}`);
        console.log(`      Description: ${row.description}`);
        console.log(`      ID: ${row.id}`);
        console.log('');
      });
    } else {
      console.log('❌ No severity levels found - verification failed');
    }
    
    // =====================================================
    // STEP 5: ADD COMMENTS
    // =====================================================
    console.log('');
    console.log('📊 Step 5: Adding table and column comments...');
    
    const comments = [
      "COMMENT ON TABLE audit_severity_levels IS 'Severity levels for audit log categorization and prioritization'",
      "COMMENT ON COLUMN audit_severity_levels.name IS 'Human-readable name of the severity level'",
      "COMMENT ON COLUMN audit_severity_levels.level IS 'Numeric level (1=low, 2=medium, 3=high, 4=critical)'",
      "COMMENT ON COLUMN audit_severity_levels.color IS 'Hex color code for UI display'",
      "COMMENT ON COLUMN audit_severity_levels.description IS 'Detailed description of when this level is used'"
    ];
    
    for (const commentSQL of comments) {
      try {
        await client.query(commentSQL);
        console.log('✅ Comment added successfully');
      } catch (error) {
        console.log('⚠️  Comment warning:', error.message);
      }
    }
    
    console.log('');
    console.log('🎉 Audit Severity Levels Migration completed successfully!');
    console.log('');
    console.log('🔧 What was created:');
    console.log('   📋 Table: audit_severity_levels');
    console.log('   🔗 Indexes: name and level indexes');
    console.log('   📊 Data: 4 default severity levels (Low, Medium, High, Critical)');
    console.log('   📝 Comments: Table and column documentation');
    console.log('');
    console.log('📊 Severity Levels:');
    console.log('   🟢 Low (1) - Informational events');
    console.log('   🟡 Medium (2) - Important events requiring attention');
    console.log('   🔴 High (3) - Critical events requiring immediate action');
    console.log('   🚨 Critical (4) - Emergency events requiring immediate response');
    console.log('');
    console.log('✅ The audit_severity_levels table is now ready for use!');
    
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
runAuditSeverityLevelsMigration().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});

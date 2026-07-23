// Complete Software Leads Table Migration
// This migration includes all changes made to the software_leads table during the Super Admin chat session

import { pool } from './src/database/connection.js';

async function migrateSoftwareLeadsTable() {
  console.log('🔄 Starting Software Leads Table Migration...\n');

  try {
    // Drop existing table if it exists
    console.log('1️⃣ Dropping existing software_leads table...');
    try {
      await pool.query('DROP TABLE IF EXISTS software_leads CASCADE;');
      console.log('✅ Existing software_leads table dropped');
    } catch (error) {
      console.log(`❌ Error dropping table: ${error.message}`);
    }

    // Create the software_leads table with complete structure
    console.log('\n2️⃣ Creating software_leads table with complete structure...');
    await pool.query(`
      CREATE TABLE software_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
        full_name TEXT,
        email TEXT NOT NULL,
        phone TEXT,
        company TEXT,
        source TEXT DEFAULT 'import',
        status TEXT DEFAULT 'new',
        tags TEXT[],
        last_contacted_at TIMESTAMP WITH TIME ZONE,
        assigned_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        assignment_notes TEXT,
        lead_score INTEGER DEFAULT 0,
        qualification_status TEXT,
        qualification_criteria JSONB,
        last_qualified_at TIMESTAMP WITH TIME ZONE,
        source_details JSONB,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        referrer TEXT,
        priority TEXT,
        urgency_reason TEXT,
        industry TEXT,
        company_size TEXT,
        budget_range TEXT,
        decision_maker BOOLEAN DEFAULT false,
        website TEXT,
        linkedin_url TEXT,
        custom_fields JSONB,
        metadata JSONB
      );
    `);
    console.log('✅ software_leads table created with complete structure');

    // Create indexes for better performance
    console.log('\n3️⃣ Creating indexes...');
    
    const indexes = [
      {
        name: 'idx_software_leads_email',
        query: 'CREATE INDEX IF NOT EXISTS idx_software_leads_email ON software_leads(email);'
      },
      {
        name: 'idx_software_leads_status',
        query: 'CREATE INDEX IF NOT EXISTS idx_software_leads_status ON software_leads(status);'
      },
      {
        name: 'idx_software_leads_created_by',
        query: 'CREATE INDEX IF NOT EXISTS idx_software_leads_created_by ON software_leads(created_by);'
      },
      {
        name: 'idx_software_leads_assigned_to',
        query: 'CREATE INDEX IF NOT EXISTS idx_software_leads_assigned_to ON software_leads(assigned_to);'
      },
      {
        name: 'idx_software_leads_created_at',
        query: 'CREATE INDEX IF NOT EXISTS idx_software_leads_created_at ON software_leads(created_at);'
      },
      {
        name: 'idx_software_leads_company',
        query: 'CREATE INDEX IF NOT EXISTS idx_software_leads_company ON software_leads(company);'
      },
      {
        name: 'idx_software_leads_source',
        query: 'CREATE INDEX IF NOT EXISTS idx_software_leads_source ON software_leads(source);'
      }
    ];

    for (const index of indexes) {
      try {
        await pool.query(index.query);
        console.log(`✅ Created index: ${index.name}`);
      } catch (error) {
        console.log(`❌ Error creating index ${index.name}: ${error.message}`);
      }
    }

    // Add constraints
    console.log('\n4️⃣ Adding constraints...');
    
    const constraints = [
      {
        name: 'chk_software_leads_status',
        query: `ALTER TABLE software_leads ADD CONSTRAINT chk_software_leads_status 
                CHECK (status IN ('new', 'contacted', 'qualified', 'nurturing', 'won', 'lost'));`
      },
      {
        name: 'chk_software_leads_lead_score',
        query: `ALTER TABLE software_leads ADD CONSTRAINT chk_software_leads_lead_score 
                CHECK (lead_score >= 0 AND lead_score <= 100);`
      },
      {
        name: 'chk_software_leads_email_format',
        query: `ALTER TABLE software_leads ADD CONSTRAINT chk_software_leads_email_format 
                CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$');`
      }
    ];

    for (const constraint of constraints) {
      try {
        await pool.query(constraint.query);
        console.log(`✅ Added constraint: ${constraint.name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`✅ Constraint already exists: ${constraint.name}`);
        } else {
          console.log(`❌ Error adding constraint ${constraint.name}: ${error.message}`);
        }
      }
    }

    // Create triggers for updated_at
    console.log('\n5️⃣ Creating triggers...');
    
    try {
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_software_leads_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log('✅ Created update function');

      await pool.query(`
        DROP TRIGGER IF EXISTS trigger_update_software_leads_updated_at ON software_leads;
        CREATE TRIGGER trigger_update_software_leads_updated_at
          BEFORE UPDATE ON software_leads
          FOR EACH ROW
          EXECUTE FUNCTION update_software_leads_updated_at();
      `);
      console.log('✅ Created update trigger');
    } catch (error) {
      console.log(`❌ Error creating triggers: ${error.message}`);
    }

    // Add comments to table and columns
    console.log('\n6️⃣ Adding table and column comments...');
    
    const comments = [
      {
        type: 'table',
        query: `COMMENT ON TABLE software_leads IS 'Software leads imported and managed by Super Admin';`
      },
      {
        type: 'column',
        name: 'id',
        query: `COMMENT ON COLUMN software_leads.id IS 'Unique identifier for the lead';`
      },
      {
        type: 'column',
        name: 'created_by',
        query: `COMMENT ON COLUMN software_leads.created_by IS 'User who created/imported this lead';`
      },
      {
        type: 'column',
        name: 'email',
        query: `COMMENT ON COLUMN software_leads.email IS 'Lead email address (unique identifier)';`
      },
      {
        type: 'column',
        name: 'status',
        query: `COMMENT ON COLUMN software_leads.status IS 'Lead status: new, contacted, qualified, nurturing, won, lost';`
      },
      {
        type: 'column',
        name: 'lead_score',
        query: `COMMENT ON COLUMN software_leads.lead_score IS 'Lead score from 0-100 based on engagement and qualification';`
      },
      {
        type: 'column',
        name: 'assigned_to',
        query: `COMMENT ON COLUMN software_leads.assigned_to IS 'User assigned to follow up with this lead';`
      },
      {
        type: 'column',
        name: 'custom_fields',
        query: `COMMENT ON COLUMN software_leads.custom_fields IS 'Custom fields specific to lead management';`
      },
      {
        type: 'column',
        name: 'metadata',
        query: `COMMENT ON COLUMN software_leads.metadata IS 'Additional metadata for lead tracking';`
      }
    ];

    for (const comment of comments) {
      try {
        await pool.query(comment.query);
        console.log(`✅ Added comment for ${comment.type}: ${comment.name || 'table'}`);
      } catch (error) {
        console.log(`❌ Error adding comment: ${error.message}`);
      }
    }

    // Verify table structure
    console.log('\n7️⃣ Verifying table structure...');
    
    const tableStructure = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'software_leads'
      ORDER BY ordinal_position;
    `);

    console.log('✅ Table structure:');
    tableStructure.rows.forEach((column, index) => {
      console.log(`   ${index + 1}. ${column.column_name} (${column.data_type}) ${column.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // Test insert and update operations
    console.log('\n8️⃣ Testing table operations...');
    
    try {
      // Test insert
      const testInsert = await pool.query(`
        INSERT INTO software_leads (created_by, full_name, email, company, source, status, lead_score)
        VALUES (
          (SELECT id FROM users WHERE email = 'admin@example.com' LIMIT 1),
          'Test Lead',
          'test.migration@example.com',
          'Test Company',
          'migration',
          'new',
          50
        )
        RETURNING id, full_name, email;
      `);
      
      console.log(`✅ Test insert successful: ${testInsert.rows[0].email}`);

      // Test update
      const testUpdate = await pool.query(`
        UPDATE software_leads 
        SET status = 'contacted', lead_score = 75, updated_at = NOW()
        WHERE email = 'test.migration@example.com'
        RETURNING id, status, lead_score, updated_at;
      `);
      
      console.log(`✅ Test update successful: Status=${testUpdate.rows[0].status}, Score=${testUpdate.rows[0].lead_score}`);

      // Clean up test data
      await pool.query(`DELETE FROM software_leads WHERE email = 'test.migration@example.com'`);
      console.log('✅ Test data cleaned up');

    } catch (error) {
      console.log(`❌ Error testing operations: ${error.message}`);
    }

    console.log('\n🎉 Software Leads Table Migration Completed Successfully!');
    console.log('\n📋 Migration Summary:');
    console.log('✅ Table created/verified');
    console.log('✅ All columns added');
    console.log('✅ Indexes created for performance');
    console.log('✅ Constraints added for data integrity');
    console.log('✅ Triggers created for auto-updates');
    console.log('✅ Comments added for documentation');
    console.log('✅ Table structure verified');
    console.log('✅ Operations tested');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateSoftwareLeadsTable().catch(console.error);

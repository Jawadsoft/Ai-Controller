import express from 'express';
import pg from 'pg';

// Database administration routes for Render.com deployment

const router = express.Router();
const { Pool } = pg;

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : true
});

// GET /api/database-admin/inspect - Inspect database structure
router.get('/inspect', async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    
    // Get database info
    const dbInfo = await client.query('SELECT current_database() as db_name, current_user as username, version() as db_version');
    
    // Get all tables
    const tablesResult = await client.query(`
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    // Get table details
    const tableDetails = [];
    for (const table of tablesResult.rows) {
      if (table.table_type === 'BASE TABLE') {
        const columnsResult = await client.query(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position;
        `, [table.table_name]);
        
        const countResult = await client.query(`SELECT COUNT(*) as row_count FROM "${table.table_name}"`);
        
        tableDetails.push({
          table_name: table.table_name,
          columns: columnsResult.rows,
          row_count: parseInt(countResult.rows[0].row_count)
        });
      }
    }
    
    res.json({
      success: true,
      database_info: {
        name: dbInfo.rows[0].db_name,
        username: dbInfo.rows[0].username,
        version: dbInfo.rows[0].db_version.split('\n')[0]
      },
      tables: tableDetails,
      total_tables: tablesResult.rows.length
    });
    
  } catch (error) {
    console.error('Database inspection failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// POST /api/database-admin/setup - Set up database schema
router.post('/setup', async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    
    // Read and execute schema
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema creation
    await client.query(schemaSQL);
    
    // Insert sample data
    await client.query(`
      INSERT INTO subscription_plans (name, display_name, description, monthly_price, yearly_price, max_vehicles, max_leads, features) 
      VALUES 
        ('basic', 'Basic Plan', 'Essential features for small dealerships', 29.99, 299.99, 50, 100, ARRAY['vehicle_management', 'lead_tracking', 'basic_analytics']),
        ('premium', 'Premium Plan', 'Advanced features for growing dealerships', 79.99, 799.99, 200, 500, ARRAY['vehicle_management', 'lead_tracking', 'advanced_analytics', 'ai_features', 'priority_support']),
        ('enterprise', 'Enterprise Plan', 'Full-featured solution for large dealerships', 199.99, 1999.99, 1000, 2000, ARRAY['vehicle_management', 'lead_tracking', 'advanced_analytics', 'ai_features', 'priority_support', 'custom_integrations', 'dedicated_support'])
      ON CONFLICT (name) DO NOTHING;
    `);
    
    res.json({
      success: true,
      message: 'Database setup completed successfully',
      tables_created: true,
      sample_data_inserted: true
    });
    
  } catch (error) {
    console.error('Database setup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// POST /api/database-admin/delete-all-tables - Delete all tables (DANGEROUS!)
router.post('/delete-all-tables', async (req, res) => {
  const { force = false } = req.body; // Add force option for aggressive cleanup
  let client;
  
  try {
    client = await pool.connect();
    
    // Get all table names with dependency information
    const tablesResult = await client.query(`
      SELECT 
        t.table_name,
        COUNT(fk.constraint_name) as dependency_count
      FROM information_schema.tables t
      LEFT JOIN information_schema.table_constraints fk 
        ON t.table_name = fk.table_name 
        AND fk.constraint_type = 'FOREIGN KEY'
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY dependency_count DESC, t.table_name;
    `);
    
    if (tablesResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No tables to delete',
        tables_deleted: 0
      });
    }
    
    // Drop all tables with CASCADE to handle dependencies
    let deletedCount = 0;
    let failedTables = [];
    
    for (const table of tablesResult.rows) {
      try {
        // Use CASCADE to automatically handle foreign key constraints
        await client.query(`DROP TABLE IF EXISTS "${table.table_name}" CASCADE`);
        deletedCount++;
        console.log(`✅ Dropped table: ${table.table_name} (${table.dependency_count} dependencies)`);
      } catch (error) {
        console.error(`❌ Error dropping table ${table.table_name}:`, error.message);
        failedTables.push({ table: table.table_name, error: error.message });
        
        // Try without CASCADE as fallback
        try {
          await client.query(`DROP TABLE IF EXISTS "${table.table_name}"`);
          deletedCount++;
          console.log(`✅ Dropped table (fallback): ${table.table_name}`);
        } catch (fallbackError) {
          console.error(`❌ Fallback failed for ${table.table_name}:`, fallbackError.message);
          failedTables.push({ table: table.table_name, error: fallbackError.message });
        }
      }
    }
    
    // If force mode is enabled and there are failed tables, try aggressive cleanup
    if (force && failedTables.length > 0) {
      console.log(`🔄 Force mode enabled. Attempting aggressive cleanup for ${failedTables.length} failed tables...`);
      
      // Get remaining tables
      const remainingTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);
      
      if (remainingTables.rows.length > 0) {
        console.log(`🔄 Found ${remainingTables.rows.length} remaining tables, attempting force drop...`);
        
        for (const table of remainingTables.rows) {
          try {
            // Try to drop without CASCADE first
            await client.query(`DROP TABLE IF EXISTS "${table.table_name}"`);
            deletedCount++;
            console.log(`✅ Force dropped table: ${table.table_name}`);
          } catch (forceError) {
            console.error(`❌ Force drop failed for ${table.table_name}:`, forceError.message);
            failedTables.push({ table: table.table_name, error: `Force drop failed: ${forceError.message}` });
          }
        }
      }
    }
    
    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} tables`,
      tables_deleted: deletedCount,
      total_tables: tablesResult.rows.length,
      failed_tables: failedTables,
      has_failures: failedTables.length > 0
    });
    
  } catch (error) {
    console.error('Delete all tables failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// POST /api/database-admin/execute-sql - Execute custom SQL commands
router.post('/execute-sql', async (req, res) => {
  let client;
  
  try {
    const { sql, source } = req.body;
    
    if (!sql || !sql.trim()) {
      return res.status(400).json({
        success: false,
        error: 'SQL commands are required'
      });
    }
    
    client = await pool.connect();
    
    // Split SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim());
    const results = [];
    
    for (const statement of statements) {
      const trimmedStmt = statement.trim();
      if (!trimmedStmt) continue;
      
      try {
        const result = await client.query(trimmedStmt);
        
        if (result.command === 'SELECT') {
          results.push({
            type: 'SELECT',
            rowCount: result.rowCount,
            rows: result.rows.slice(0, 10), // Limit to first 10 rows
            truncated: result.rowCount > 10
          });
        } else {
          results.push({
            type: result.command,
            rowCount: result.rowCount,
            message: `${result.command} completed successfully`
          });
        }
      } catch (stmtError) {
        results.push({
          type: 'ERROR',
          error: stmtError.message,
          statement: trimmedStmt
        });
      }
    }
    
    res.json({
      success: true,
      message: `SQL execution completed from ${source}`,
      results: formatResults(results),
      totalStatements: statements.length
    });
    
  } catch (error) {
    console.error('SQL execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// GET /api/database-admin/sample-data/:tableName - Get sample data from a table
router.get('/sample-data/:tableName', async (req, res) => {
  let client;
  
  try {
    const { tableName } = req.params;
    
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid table name'
      });
    }
    
    client = await pool.connect();
    
    // Get sample data (limit to 10 rows for performance)
    const result = await client.query(`SELECT * FROM "${tableName}" LIMIT 10`);
    
    res.json({
      success: true,
      table_name: tableName,
      data: result.rows,
      row_count: result.rows.length,
      total_rows: result.rowCount
    });
    
  } catch (error) {
    console.error(`Sample data retrieval failed for table ${req.params.tableName}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

  // GET /api/database-admin/export-table/:tableName - Export all data from a table
router.get('/export-table/:tableName', async (req, res) => {
  let client;
  
  try {
    const { tableName } = req.params;
    
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid table name'
      });
    }
    
    client = await pool.connect();
    
    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    
    if (!tableExists.rows[0].exists) {
      return res.status(404).json({
        success: false,
        error: `Table '${tableName}' not found`
      });
    }
    
    // Get all data from the table
    const result = await client.query(`SELECT * FROM "${tableName}" ORDER BY 1`);
    
    res.json({
      success: true,
      table_name: tableName,
      data: result.rows,
      row_count: result.rows.length,
      exported_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`Export failed for table ${req.params.tableName}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// POST /api/database-admin/import-json-data - Import JSON data into a table
router.post('/import-json-data', async (req, res) => {
  let client;
  
  try {
    const { tableName, data, options = {} } = req.body;
    
    if (!tableName || !data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'tableName and data array are required'
      });
    }
    
    // Validate table name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid table name'
      });
    }
    
    client = await pool.connect();
    
    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    
    if (!tableExists.rows[0].exists) {
      return res.status(404).json({
        success: false,
        error: `Table '${tableName}' not found`
      });
    }
    
    // Get table columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [tableName]);
    
    const columns = columnsResult.rows;
    console.log(`📊 Table ${tableName} has columns:`, columns.map(c => c.column_name));
    
    await client.query('BEGIN');
    
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const [index, record] of data.entries()) {
      try {
        // Build dynamic INSERT/UPDATE query based on table structure
        const recordColumns = Object.keys(record);
        const validColumns = recordColumns.filter(col => 
          columns.some(c => c.column_name === col)
        );
        
        if (validColumns.length === 0) {
          throw new Error('No valid columns found in record');
        }
        
        // Check if record exists (assuming first column is primary key)
        const primaryKeyColumn = columns[0].column_name;
        const primaryKeyValue = record[primaryKeyColumn];
        
        if (!primaryKeyValue) {
          throw new Error(`Primary key value missing for column ${primaryKeyColumn}`);
        }
        
        const existingRecord = await client.query(
          `SELECT ${primaryKeyColumn} FROM "${tableName}" WHERE ${primaryKeyColumn} = $1`,
          [primaryKeyValue]
        );
        
        if (existingRecord.rows.length > 0) {
          // Update existing record
          const setClause = validColumns
            .filter(col => col !== primaryKeyColumn)
            .map((col, i) => `${col} = $${i + 2}`)
            .join(', ');
          
          const values = [primaryKeyValue, ...validColumns
            .filter(col => col !== primaryKeyColumn)
            .map(col => record[col] || null)];
          
          await client.query(
            `UPDATE "${tableName}" SET ${setClause}, updated_at = NOW() WHERE ${primaryKeyColumn} = $1`,
            values
          );
          updatedCount++;
        } else {
          // Insert new record
          const insertColumns = validColumns.join(', ');
          const placeholders = validColumns.map((_, i) => `$${i + 1}`).join(', ');
          const values = validColumns.map(col => record[col] || null);
          
          await client.query(
            `INSERT INTO "${tableName}" (${insertColumns}) VALUES (${placeholders})`,
            values
          );
          insertedCount++;
        }
        
      } catch (recordError) {
        console.error(`Error processing record ${index + 1}:`, recordError.message);
        errors.push({
          index: index + 1,
          error: recordError.message,
          record: record
        });
        errorCount++;
      }
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `Import completed for table ${tableName}`,
      summary: {
        total_records: data.length,
        inserted: insertedCount,
        updated: updatedCount,
        errors: errorCount
      },
      errors: errors.slice(0, 10), // Limit error details to first 10
      imported_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Import failed:', error);
    
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// GET /api/database-admin/health - Check database health
router.get('/health', async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    
    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    
    res.json({
      success: true,
      database: 'connected',
      current_time: result.rows[0].current_time,
      version: result.rows[0].db_version.split('\n')[0],
      table_count: parseInt(tablesResult.rows[0].table_count)
    });
    
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({
      success: false,
      database: 'error',
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// GET /api/database-admin/current-user - Get current user info (for debugging)
router.get('/current-user', async (req, res) => {
  try {
    // This endpoint is for debugging - in production, you'd get this from authentication
    res.json({
      success: true,
      message: 'This endpoint is for debugging dealer ID issues',
      note: 'In production, dealer_id comes from req.user.dealer_id in authenticated routes',
      suggestion: 'Check your authentication middleware and ensure req.user.dealer_id is set correctly'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// GET /api/database-admin/check-dealers - Check what dealers exist
router.get('/check-dealers', async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT id, business_name, contact_name, email, subscription_status, created_at 
      FROM dealers 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    
    res.json({
      success: true,
      dealers: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Check dealers failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// POST /api/database-admin/create-test-dealer - Create a test dealer
router.post('/create-test-dealer', async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    
    const testDealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    // Check if dealer already exists
    const existingDealer = await client.query(
      'SELECT id FROM dealers WHERE id = $1',
      [testDealerId]
    );
    
    if (existingDealer.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Test dealer already exists',
        dealer_id: testDealerId
      });
    }
    
    // Create test dealer
    await client.query(`
      INSERT INTO dealers (
        id, business_name, contact_name, email, phone, address, city, state, zip_code, 
        website, subscription_status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      )
    `, [
      testDealerId,
      'Test Dealer Business',
      'Test Contact',
      'test@dealer.com',
      '555-123-4567',
      '123 Test Street',
      'Test City',
      'TX',
      '12345',
      'https://testdealer.com',
      'active'
    ]);
    
    res.json({
      success: true,
      message: 'Test dealer created successfully',
      dealer_id: testDealerId
    });
    
  } catch (error) {
    console.error('Create test dealer failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// POST /api/database-admin/deploy-import-function - Deploy the import_vehicle_from_csv function
router.post('/deploy-import-function', async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    
    // First, check what functions exist
    const existingFunctions = await client.query(`
      SELECT proname, pronargs, pg_get_function_result(oid) as return_type
      FROM pg_proc 
      WHERE proname LIKE '%import_vehicle%'
    `);
    
    console.log('Existing import functions:', existingFunctions.rows);
    
    // Drop ALL existing import_vehicle_from_csv functions (any signature)
    await client.query(`
      DROP FUNCTION IF EXISTS import_vehicle_from_csv CASCADE
    `);
    
    // Create the function
    const functionSQL = `
      CREATE OR REPLACE FUNCTION import_vehicle_from_csv(
        p_dealer_id UUID,
        p_vin TEXT,
        p_make TEXT,
        p_model TEXT,
        p_series TEXT DEFAULT NULL,
        p_stock_number TEXT DEFAULT NULL,
        p_new_used TEXT DEFAULT 'used',
        p_body_style TEXT DEFAULT NULL,
        p_vehicle_type TEXT DEFAULT NULL,
        p_certified BOOLEAN DEFAULT false,
        p_color TEXT DEFAULT NULL,
        p_interior_color TEXT DEFAULT NULL,
        p_engine_type TEXT DEFAULT NULL,
        p_displacement TEXT DEFAULT NULL,
        p_features TEXT DEFAULT NULL,
        p_odometer INTEGER DEFAULT NULL,
        p_price NUMERIC DEFAULT NULL,
        p_other_price NUMERIC DEFAULT NULL,
        p_transmission TEXT DEFAULT NULL,
        p_msrp NUMERIC DEFAULT NULL,
        p_dealer_discount NUMERIC DEFAULT NULL,
        p_consumer_rebate NUMERIC DEFAULT NULL,
        p_dealer_accessories NUMERIC DEFAULT NULL,
        p_total_customer_savings NUMERIC DEFAULT NULL,
        p_total_dealer_rebate NUMERIC DEFAULT NULL,
        p_photo_url_list TEXT DEFAULT NULL,
        p_year INTEGER DEFAULT NULL,
        p_reference_dealer_id TEXT DEFAULT NULL
      ) RETURNS UUID AS '
      DECLARE
        v_vehicle_id UUID;
        v_dealer_exists BOOLEAN;
      BEGIN
        -- Check if dealer exists first
        SELECT EXISTS(SELECT 1 FROM dealers WHERE id = p_dealer_id) INTO v_dealer_exists;
        
        IF NOT v_dealer_exists THEN
          RAISE EXCEPTION 'Dealer with ID % does not exist', p_dealer_id;
        END IF;
        
        SELECT id INTO v_vehicle_id FROM vehicles WHERE vin = p_vin AND dealer_id = p_dealer_id;
        
        IF v_vehicle_id IS NOT NULL THEN
          UPDATE vehicles SET
            make = p_make,
            model = p_model,
            year = COALESCE(p_year, year),
            trim = COALESCE(p_series, trim),
            color = COALESCE(p_color, color),
            mileage = COALESCE(p_odometer, mileage),
            price = COALESCE(p_price, price),
            features = CASE WHEN p_features IS NOT NULL AND p_features != '''' THEN string_to_array(trim(both ''{}'' from p_features), '','') ELSE features END,
            images = CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '''' THEN string_to_array(trim(both ''{}'' from p_photo_url_list), '','') ELSE images END,
            status = ''available'',
            stock_number = COALESCE(p_stock_number, stock_number),
            body_style = COALESCE(p_body_style, body_style),
            certified = COALESCE(p_certified, certified),
            interior_color = COALESCE(p_interior_color, interior_color),
            engine_type = COALESCE(p_engine_type, engine_type),
            displacement = COALESCE(p_displacement, displacement),
            transmission = COALESCE(p_transmission, transmission),
            msrp = COALESCE(p_msrp, msrp),
            dealer_discount = COALESCE(p_dealer_discount, dealer_discount),
            consumer_rebate = COALESCE(p_consumer_rebate, consumer_rebate),
            dealer_accessories = COALESCE(p_dealer_accessories, dealer_accessories),
            total_customer_savings = COALESCE(p_total_customer_savings, total_customer_savings),
            total_dealer_rebate = COALESCE(p_total_dealer_rebate, total_dealer_rebate),
            other_price = COALESCE(p_other_price, other_price),
            photo_url_list = CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '''' THEN string_to_array(trim(both ''{}'' from p_photo_url_list), '','') ELSE photo_url_list END,
            odometer = COALESCE(p_odometer, odometer),
            import_source = ''csv'',
            import_date = NOW(),
            reference_dealer_id = COALESCE(p_reference_dealer_id, reference_dealer_id),
            updated_at = NOW()
          WHERE id = v_vehicle_id;
        ELSE
          INSERT INTO vehicles (
            dealer_id, vin, make, model, year, trim, color, mileage, price,
            features, images, status, stock_number, body_style, certified,
            interior_color, engine_type, displacement, transmission, msrp,
            dealer_discount, consumer_rebate, dealer_accessories,
            total_customer_savings, total_dealer_rebate, other_price,
            photo_url_list, odometer, import_source, import_date,
            reference_dealer_id, created_at, updated_at
          ) VALUES (
            p_dealer_id, p_vin, p_make, p_model, p_year, p_series, p_color, p_odometer, p_price,
            CASE WHEN p_features IS NOT NULL AND p_features != '''' THEN string_to_array(trim(both ''{}'' from p_features), '','') ELSE NULL END,
            CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '''' THEN string_to_array(trim(both ''{}'' from p_photo_url_list), '','') ELSE NULL END,
            ''available'', p_stock_number, p_body_style, p_certified,
            p_interior_color, p_engine_type, p_displacement, p_transmission, p_msrp,
            p_dealer_discount, p_consumer_rebate, p_dealer_accessories,
            p_total_customer_savings, p_total_dealer_rebate, p_other_price,
            CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '''' THEN string_to_array(trim(both ''{}'' from p_photo_url_list), '','') ELSE NULL END,
            p_odometer, ''csv'', NOW(),
            p_reference_dealer_id, NOW(), NOW()
          ) RETURNING id INTO v_vehicle_id;
        END IF;
        
        RETURN v_vehicle_id;
      END;
      ' LANGUAGE plpgsql;
    `;
    
    console.log('Creating function with SQL:', functionSQL.substring(0, 200) + '...');
    
    await client.query(functionSQL);
    
    // Verify the function was created
    const verifyResult = await client.query(`
      SELECT proname, pronargs, pg_get_function_result(oid) as return_type
      FROM pg_proc 
      WHERE proname = 'import_vehicle_from_csv'
    `);
    
    console.log('Function verification result:', verifyResult.rows);
    
    res.json({ 
      success: true, 
      message: 'Import function deployed successfully',
      function_info: verifyResult.rows[0],
      existing_functions_before: existingFunctions.rows
    });
    
  } catch (error) {
    console.error('Import function deployment failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: error.code,
      hint: error.hint
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// GET /api/database-admin/verify-import-function - Verify the import function exists
router.get('/verify-import-function', async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        proname as function_name,
        pronargs as argument_count,
        pg_get_function_result(oid) as return_type
      FROM pg_proc 
      WHERE proname = 'import_vehicle_from_csv'
    `);
    
    if (result.rows.length > 0) {
      res.json({
        success: true,
        function_name: result.rows[0].function_name,
        argument_count: result.rows[0].argument_count,
        return_type: result.rows[0].return_type
      });
    } else {
      res.status(404).json({ 
        success: false,
        error: 'Function not found' 
      });
    }
    
  } catch (error) {
    console.error('Function verification failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: error.code
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// POST /api/database-admin/test-import-function - Test the import function
router.post('/test-import-function', async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    
    // Get the first available dealer ID from the database
    const dealerResult = await client.query(`
      SELECT id FROM dealers 
      WHERE status = 'active' 
      ORDER BY created_at ASC 
      LIMIT 1
    `);
    
    if (dealerResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active dealers found. Please create a dealer first.'
      });
    }
    
    const testDealerId = dealerResult.rows[0].id;
    const testVin = `TEST${Date.now()}VIN`;
    
    // Test the function with sample data using the actual dealer ID
    const result = await client.query(`
      SELECT import_vehicle_from_csv(
        $1::uuid,
        $2,
        'Toyota',
        'Camry',
        'LE',
        'TEST001',
        'used',
        'Sedan',
        NULL,
        false,
        'Blue',
        'Gray',
        '2.5L I4',
        NULL,
        '{"Navigation","Bluetooth","Backup Camera"}',
        50000,
        25000.00,
        NULL,
        'Automatic',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        '{"http://example.com/image1.jpg","http://example.com/image2.jpg"}',
        2020,
        'TEST_DEALER_REF'
      ) as vehicle_id
    `, [testDealerId, testVin]);
    
    // Clean up test data
    await client.query(`
      DELETE FROM vehicles 
      WHERE vin = $1 AND dealer_id = $2
    `, [testVin, testDealerId]);
    
    res.json({
      success: true,
      vehicle_id: result.rows[0].vehicle_id,
      dealer_id: testDealerId,
      message: 'Function test successful and test data cleaned up'
    });
    
  } catch (error) {
    console.error('Function test failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      code: error.code,
      hint: error.hint
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Helper function to format SQL execution results
function formatResults(results) {
  let formatted = '';
  
  results.forEach((result, index) => {
    formatted += `<strong>Statement ${index + 1}:</strong><br>`;
    
    if (result.type === 'SELECT') {
      formatted += `✅ SELECT completed - ${result.rowCount} rows returned<br>`;
      if (result.rows && result.rows.length > 0) {
        formatted += `<div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; font-family: monospace; font-size: 0.9rem;">`;
        formatted += `<strong>Sample Data:</strong><br>`;
        result.rows.forEach((row, rowIndex) => {
          formatted += `Row ${rowIndex + 1}: ${JSON.stringify(row)}<br>`;
        });
        if (result.truncated) {
          formatted += `<em>... and ${result.rowCount - 10} more rows</em><br>`;
        }
        formatted += `</div>`;
      }
    } else if (result.type === 'ERROR') {
      formatted += `❌ Error: ${result.error}<br>`;
      formatted += `<em>Statement: ${result.statement}</em><br>`;
    } else {
      formatted += `✅ ${result.message}<br>`;
    }
    formatted += '<br>';
  });
  
  return formatted;
}

export default router;

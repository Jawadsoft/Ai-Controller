import { Pool } from 'pg';

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING || 'postgresql://postgres:password@localhost:5432/vehicle_management',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixFieldTypeConstraint() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing import field mappings field type constraint...');
    
    // Check current constraint
    console.log('\n📋 Checking current field type constraint...');
    const constraintResult = await client.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'import_field_mappings_field_type_check'
    `);
    
    if (constraintResult.rows.length > 0) {
      console.log('✅ Current constraint found:');
      console.log(`  - Name: ${constraintResult.rows[0].constraint_name}`);
      console.log(`  - Check: ${constraintResult.rows[0].check_clause}`);
    }
    
    // Check for invalid field types
    console.log('\n📋 Checking for invalid field types...');
    const invalidTypesResult = await client.query(`
      SELECT DISTINCT field_type, COUNT(*) as count
      FROM import_field_mappings
      WHERE field_type NOT IN ('text', 'number', 'date', 'boolean', 'array')
      GROUP BY field_type
    `);
    
    if (invalidTypesResult.rows.length > 0) {
      console.log('❌ Found invalid field types:');
      invalidTypesResult.rows.forEach(row => {
        console.log(`  - ${row.field_type}: ${row.count} records`);
      });
      
      // Fix invalid field types
      console.log('\n🔧 Fixing invalid field types...');
      
      const fieldTypeMappings = {
        'string': 'text',
        'str': 'text',
        'varchar': 'text',
        'char': 'text',
        'integer': 'number',
        'int': 'number',
        'float': 'number',
        'decimal': 'number',
        'numeric': 'number',
        'timestamp': 'date',
        'datetime': 'date',
        'bool': 'boolean',
        'json': 'text',
        'jsonb': 'text'
      };
      
      for (const invalidType of invalidTypesResult.rows) {
        const newType = fieldTypeMappings[invalidType.field_type] || 'text';
        console.log(`  🔄 Updating ${invalidType.field_type} → ${newType}`);
        
        await client.query(
          'UPDATE import_field_mappings SET field_type = $1 WHERE field_type = $2',
          [newType, invalidType.field_type]
        );
        
        console.log(`  ✅ Updated ${invalidType.count} records`);
      }
    } else {
      console.log('✅ No invalid field types found');
    }
    
    // Drop existing constraint
    console.log('\n📋 Dropping existing field type constraint...');
    try {
      await client.query('ALTER TABLE import_field_mappings DROP CONSTRAINT IF EXISTS import_field_mappings_field_type_check');
      console.log('✅ Dropped existing field type constraint');
    } catch (error) {
      console.log('⚠️ Constraint drop warning:', error.message);
    }
    
    // Add new constraint with all valid types
    console.log('\n📋 Adding new field type constraint...');
    await client.query(`
      ALTER TABLE import_field_mappings 
      ADD CONSTRAINT import_field_mappings_field_type_check 
      CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'array'))
    `);
    console.log('✅ Added new field type constraint');
    
    // Verify the constraint
    console.log('\n🔍 Verifying the constraint...');
    const newConstraintResult = await client.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'import_field_mappings_field_type_check'
    `);
    
    if (newConstraintResult.rows.length > 0) {
      console.log('✅ New constraint verified:');
      console.log(`  - Name: ${newConstraintResult.rows[0].constraint_name}`);
      console.log(`  - Check: ${newConstraintResult.rows[0].check_clause}`);
    }
    
    // Test inserting with valid field types
    console.log('\n🧪 Testing field type insertion...');
    try {
      // Get an existing import config ID
      const configResult = await client.query('SELECT id FROM import_configs LIMIT 1');
      
      if (configResult.rows.length > 0) {
        const configId = configResult.rows[0].id;
        
        // Test each valid field type
        const validTypes = ['text', 'number', 'date', 'boolean', 'array'];
        
        for (const fieldType of validTypes) {
          await client.query(`
            INSERT INTO import_field_mappings (
              import_config_id, source_field, target_field, field_type, 
              is_required, field_order
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [configId, `test_${fieldType}`, `test_${fieldType}_target`, fieldType, false, 999]);
          
          console.log(`  ✅ ${fieldType} field type test successful`);
          
          // Clean up test record
          await client.query('DELETE FROM import_field_mappings WHERE source_field = $1', [`test_${fieldType}`]);
        }
        
        console.log('✅ All field type tests passed');
      } else {
        console.log('⚠️ No import configs found to test with');
      }
    } catch (error) {
      console.log('❌ Field type test failed:', error.message);
    }
    
    // Show current field types in use
    console.log('\n📊 Current field types in use:');
    const currentTypesResult = await client.query(`
      SELECT field_type, COUNT(*) as count
      FROM import_field_mappings
      GROUP BY field_type
      ORDER BY count DESC
    `);
    
    currentTypesResult.rows.forEach(row => {
      console.log(`  - ${row.field_type}: ${row.count} mappings`);
    });
    
    console.log('\n🎉 Field type constraint fix completed!');
    
  } catch (error) {
    console.error('💥 Field type constraint fix failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixFieldTypeConstraint().catch(console.error);

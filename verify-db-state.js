import { pool } from './src/database/connection.js';

async function verifyDatabaseState() {
  console.log('🔍 Verifying Database State...\n');

  try {
    // Check recent conversations with customer_id
    console.log('1️⃣ Recent conversations with customer_id:');
    const conversations = await pool.query(`
      SELECT 
        id, 
        customer_id, 
        customer_name, 
        customer_email, 
        session_id, 
        created_at 
      FROM daive_conversations 
      WHERE customer_id IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    console.log(`Found ${conversations.rows.length} conversations with customer_id:`);
    conversations.rows.forEach((conv, index) => {
      console.log(`   ${index + 1}. ID: ${conv.id}`);
      console.log(`      Customer ID: ${conv.customer_id}`);
      console.log(`      Name: ${conv.customer_name || 'N/A'}`);
      console.log(`      Email: ${conv.customer_email || 'N/A'}`);
      console.log(`      Session: ${conv.session_id}`);
      console.log(`      Created: ${conv.created_at}`);
      console.log('');
    });

    // Check customer table
    console.log('2️⃣ Customers in database:');
    const customers = await pool.query(`
      SELECT 
        id, 
        email, 
        first_name, 
        last_name, 
        status,
        created_at 
      FROM customers 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    console.log(`Found ${customers.rows.length} customers:`);
    customers.rows.forEach((customer, index) => {
      console.log(`   ${index + 1}. ID: ${customer.id}`);
      console.log(`      Email: ${customer.email}`);
      console.log(`      Name: ${customer.first_name} ${customer.last_name}`);
      console.log(`      Status: ${customer.status}`);
      console.log(`      Created: ${customer.created_at}`);
      console.log('');
    });

    // Check conversation statistics
    console.log('3️⃣ Conversation statistics:');
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(customer_id) as conversations_with_customer_id,
        COUNT(*) - COUNT(customer_id) as conversations_without_customer_id
      FROM daive_conversations
    `);

    console.log('Conversation Statistics:');
    console.log(`   Total conversations: ${stats.rows[0].total_conversations}`);
    console.log(`   With customer_id: ${stats.rows[0].conversations_with_customer_id}`);
    console.log(`   Without customer_id: ${stats.rows[0].conversations_without_customer_id}`);

    // Check foreign key relationship
    console.log('\n4️⃣ Foreign key relationship test:');
    const fkTest = await pool.query(`
      SELECT 
        dc.id as conversation_id,
        dc.customer_id,
        c.email as customer_email,
        c.first_name,
        c.last_name
      FROM daive_conversations dc
      JOIN customers c ON dc.customer_id = c.id
      WHERE dc.customer_id IS NOT NULL
      LIMIT 3
    `);

    console.log(`Foreign key joins working: ${fkTest.rows.length} conversations linked to customers`);
    fkTest.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. Conversation ${row.conversation_id} -> Customer ${row.customer_email} (${row.first_name} ${row.last_name})`);
    });

    console.log('\n✅ Database verification completed successfully!');

  } catch (error) {
    console.error('❌ Database verification failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyDatabaseState()
  .then(() => {
    console.log('\n🎉 All database checks passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Database verification failed:', error);
    process.exit(1);
  });

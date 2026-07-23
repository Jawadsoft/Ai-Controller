import { pool } from '../connection.js';

export async function up() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_dealer_id ON notifications(dealer_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
    `);

    await client.query('COMMIT');
    console.log('✅ Notifications table created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating notifications table:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    await client.query(`
      DROP TABLE IF EXISTS notifications CASCADE;
    `);
    
    await client.query('COMMIT');
    console.log('✅ Notifications table dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error dropping notifications table:', error);
    throw error;
  } finally {
    client.release();
  }
}


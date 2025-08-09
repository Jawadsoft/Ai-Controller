import { pool } from './src/database/connection.js';

async function setupDAIVEDatabase() {
  console.log('🔧 Setting up D.A.I.V.E. database...\n');

  try {
    // Create D.A.I.V.E. specific tables
    const createTables = `
      -- D.A.I.V.E. AI Conversations table
      CREATE TABLE IF NOT EXISTS daive_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dealer_id UUID,
          vehicle_id UUID,
          session_id TEXT NOT NULL,
          customer_name TEXT,
          customer_email TEXT,
          customer_phone TEXT,
          conversation_type TEXT DEFAULT 'text',
          messages JSONB DEFAULT '[]',
          ai_context JSONB DEFAULT '{}',
          lead_qualification_score INTEGER DEFAULT 0,
          lead_status TEXT DEFAULT 'new',
          handoff_requested BOOLEAN DEFAULT false,
          handoff_to_user_id UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- D.A.I.V.E. Voice Sessions table
      CREATE TABLE IF NOT EXISTS daive_voice_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID,
          audio_file_url TEXT,
          transcription TEXT,
          ai_response TEXT,
          audio_response_url TEXT,
          processing_status TEXT DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- D.A.I.V.E. AI Prompts table
      CREATE TABLE IF NOT EXISTS daive_prompts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dealer_id UUID,
          prompt_type TEXT NOT NULL,
          prompt_text TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- D.A.I.V.E. Analytics table
      CREATE TABLE IF NOT EXISTS daive_analytics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          dealer_id UUID,
          date DATE NOT NULL,
          total_conversations INTEGER DEFAULT 0,
          total_voice_sessions INTEGER DEFAULT 0,
          total_leads_generated INTEGER DEFAULT 0,
          average_conversation_duration INTEGER DEFAULT 0,
          handoff_rate DECIMAL(5,2) DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await pool.query(createTables);
    console.log('✅ D.A.I.V.E. tables created successfully');

    // Insert default prompts
    const insertPrompts = `
      INSERT INTO daive_prompts (dealer_id, prompt_type, prompt_text) VALUES
      (NULL, 'greeting', 'Hi, I''m D.A.I.V.E., your AI sales assistant. How can I help you today?'),
      (NULL, 'vehicle_info', 'This vehicle has excellent features including {features}. The price is {price} and it has {mileage} miles. Would you like to know more about financing options?'),
      (NULL, 'financing', 'I can help you with financing options. We offer competitive rates starting at {rate}% APR. Would you like to calculate your monthly payment?'),
      (NULL, 'test_drive', 'Great choice! I can help you schedule a test drive. What day and time works best for you?'),
      (NULL, 'handoff', 'I''d be happy to connect you with one of our sales representatives who can provide more detailed assistance. Let me transfer you now.')
      ON CONFLICT DO NOTHING;
    `;

    await pool.query(insertPrompts);
    console.log('✅ Default prompts inserted');

    // Create indexes
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_daive_conversations_dealer_id ON daive_conversations(dealer_id);
      CREATE INDEX IF NOT EXISTS idx_daive_conversations_vehicle_id ON daive_conversations(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_daive_conversations_session_id ON daive_conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_daive_voice_sessions_conversation_id ON daive_voice_sessions(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_daive_prompts_dealer_id ON daive_prompts(dealer_id);
      CREATE INDEX IF NOT EXISTS idx_daive_analytics_dealer_id ON daive_analytics(dealer_id);
      CREATE INDEX IF NOT EXISTS idx_daive_analytics_date ON daive_analytics(date);
    `;

    await pool.query(createIndexes);
    console.log('✅ Indexes created');

    // Insert sample analytics data
    const insertAnalytics = `
      INSERT INTO daive_analytics (dealer_id, date, total_conversations, total_voice_sessions, total_leads_generated, average_conversation_duration, handoff_rate) VALUES
      (NULL, CURRENT_DATE - INTERVAL '1 day', 15, 3, 8, 180, 12.5),
      (NULL, CURRENT_DATE - INTERVAL '2 days', 12, 2, 6, 165, 8.3),
      (NULL, CURRENT_DATE - INTERVAL '3 days', 18, 5, 10, 195, 15.2)
      ON CONFLICT DO NOTHING;
    `;

    await pool.query(insertAnalytics);
    console.log('✅ Sample analytics data inserted');

    console.log('\n🎉 D.A.I.V.E. database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Set your OPENAI_API_KEY in the .env file');
    console.log('2. Start the server: npm run dev');
    console.log('3. Open test-daive.html in your browser');
    console.log('4. Test the chat functionality');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
  } finally {
    await pool.end();
  }
}

setupDAIVEDatabase(); 
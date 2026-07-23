# Database Tables Documentation

## 📊 Main Tables Used for Chat Conversations and Leads

### 🤖 D.A.I.V.E. AI System Tables

#### 1. `daive_conversations` (Primary AI Chat Table)
- **Purpose**: Stores all AI-powered chat conversations
- **Key Fields**:
  - `id`: UUID primary key
  - `dealer_id`: References dealers table
  - `vehicle_id`: References vehicles table (optional)
  - `session_id`: Unique session identifier
  - `customer_name`, `customer_email`, `customer_phone`: Customer info
  - `conversation_type`: 'text', 'voice', or 'mixed'
  - `messages`: JSONB array of all messages
  - `ai_context`: JSONB object with AI context data
  - `lead_qualification_score`: 0-100 score
  - `lead_status`: 'new', 'warm', 'hot', 'cold'
  - `handoff_requested`: Boolean for human handoff
  - `lead_id`: References leads table

#### 2. `daive_voice_sessions`
- **Purpose**: Stores voice chat sessions and audio data
- **Key Fields**:
  - `conversation_id`: References daive_conversations
  - `audio_file_url`: Path to uploaded audio
  - `transcription`: Text transcription
  - `ai_response`: AI's text response
  - `audio_response_url`: Path to AI's audio response
  - `processing_status`: 'pending', 'processing', 'completed', 'failed'

#### 3. `daive_user_interests`
- **Purpose**: Tracks user interests in specific vehicles
- **Key Fields**:
  - `conversation_id`: References daive_conversations
  - `vehicle_id`: References vehicles table
  - `interest_type`: Type of interest
  - `user_message`: Original user message
  - `interest_level`: 1-5 scale

#### 4. `daive_analytics`
- **Purpose**: Daily analytics and metrics
- **Key Fields**:
  - `dealer_id`: References dealers table
  - `date`: Date of analytics
  - `total_conversations`: Count of conversations
  - `total_voice_sessions`: Count of voice sessions
  - `total_leads_generated`: Count of leads created
  - `average_conversation_duration`: Average duration in seconds
  - `handoff_rate`: Percentage of handoffs

### 💬 Legacy Chat System Tables

#### 5. `chat_conversations`
- **Purpose**: Legacy chat system (before D.A.I.V.E.)
- **Key Fields**:
  - `id`: UUID primary key
  - `vehicle_id`: References vehicles table
  - `session_id`: Session identifier
  - `customer_name`, `customer_email`: Customer info
  - `messages`: JSONB array of messages

#### 6. `conversation_messages`
- **Purpose**: Individual chat messages (legacy system)
- **Key Fields**:
  - `conversation_id`: References chat_conversations
  - `role`: 'user', 'assistant', or 'system'
  - `content`: Message content
  - `created_at`: Timestamp

### 🎯 Leads Tables

#### 7. `leads` (Primary Leads Table)
- **Purpose**: Main leads table for all lead generation
- **Key Fields**:
  - `id`: UUID primary key
  - `dealer_id`: References dealers table
  - `vehicle_id`: References vehicles table
  - `customer_name`, `customer_email`, `customer_phone`: Customer info
  - `message`: Lead message/notes
  - `status`: 'new', 'contacted', 'qualified', 'converted', 'lost'
  - `interest_level`: 'low', 'medium', 'high', 'hot'

#### 8. `customer_leads`
- **Purpose**: Alternative leads table for customer sessions
- **Key Fields**:
  - `id`: UUID primary key
  - `session_id`: References customer_sessions
  - `customer_name`, `customer_email`, `customer_phone`: Customer info
  - `vehicle_id`: References vehicles table
  - `dealer_id`: References dealers table
  - `lead_source`: 'qr_code', 'website', 'referral', 'walk_in'
  - `interest_level`: 'low', 'medium', 'high', 'hot'

### ⚙️ Configuration Tables (Preserved in Resets)

#### 9. `daive_prompts`
- **Purpose**: Custom AI prompts per dealer
- **Preserved**: Contains dealer-specific AI customizations

#### 10. `daive_api_settings`
- **Purpose**: API settings and configurations per dealer
- **Preserved**: Contains dealer API keys and settings

#### 11. `daive_scenario_flows`
- **Purpose**: Custom conversation flows per dealer
- **Preserved**: Contains dealer-specific conversation logic

## 🗑️ Reset Scripts

### Full Reset (All Data)
```sql
-- File: production_reset_script.sql
-- Resets ALL conversation and lead data
-- Use with caution in production
```

### Targeted Reset (Conversations & Leads Only)
```sql
-- File: targeted_reset_script.sql
-- Resets only conversation and lead data
-- Preserves dealer configurations
```

## 📈 Table Relationships

```
dealers
├── daive_conversations (1:many)
│   ├── daive_voice_sessions (1:many)
│   ├── daive_user_interests (1:many)
│   └── leads (1:1 via lead_id)
├── leads (1:many)
├── chat_conversations (1:many)
│   └── conversation_messages (1:many)
└── daive_analytics (1:many)

vehicles
├── daive_conversations (1:many)
├── leads (1:many)
└── chat_conversations (1:many)
```

## ⚠️ Important Notes

1. **Primary Tables**: `daive_conversations` and `leads` are the main tables
2. **Data Preservation**: Configuration tables are typically preserved during resets
3. **Cascading Deletes**: Most tables have CASCADE DELETE relationships
4. **Sequences**: Auto-increment sequences are reset to start from 1
5. **Backup**: Always backup important data before running reset scripts

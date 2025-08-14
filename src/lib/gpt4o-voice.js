import OpenAI from 'openai';
import { pool } from '../database/connection.js';

class GPT4oVoiceService {
  constructor() {
    this.openai = null;
    this.initializeOpenAI();
  }

  async initializeOpenAI() {
    try {
      // Get OpenAI API key from database
      const query = `
        SELECT setting_value
        FROM daive_api_settings
        WHERE dealer_id IS NULL AND setting_type = 'openai_key'
        LIMIT 1
      `;
      const result = await pool.query(query);
      
      if (result.rows.length > 0) {
        const apiKey = result.rows[0].setting_value;
        this.openai = new OpenAI({ apiKey });
        console.log('✅ GPT-4o Voice Service initialized');
      } else {
        console.error('❌ No OpenAI API key found');
      }
    } catch (error) {
      console.error('❌ Error initializing GPT-4o Voice Service:', error);
    }
  }

  // Real-time voice conversation with GPT-4o
  async realtimeVoiceConversation(audioInput, conversationContext = {}) {
    try {
      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      console.log('🎤 Starting GPT-4o real-time voice conversation...');

      // Step 1: Transcribe audio to text using Whisper
      const transcription = await this.transcribeAudio(audioInput);
      console.log('📝 Transcription:', transcription);

      // Step 2: Process with GPT-4o
      const response = await this.processWithGPT4o(transcription, conversationContext);
      console.log('🤖 GPT-4o Response:', response);

      // Step 3: Generate speech response
      const audioResponse = await this.generateSpeech(response);
      console.log('🔊 Audio response generated');

      return {
        success: true,
        transcription,
        response,
        audioResponse,
        model: 'gpt-4o'
      };

    } catch (error) {
      console.error('❌ Error in real-time voice conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Transcribe audio using Whisper
  async transcribeAudio(audioBuffer) {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioBuffer,
        model: 'whisper-1',
        response_format: 'text'
      });
      return transcription;
    } catch (error) {
      console.error('❌ Transcription error:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  // Process with GPT-4o
  async processWithGPT4o(userMessage, context = {}) {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 200,
        temperature: 0.7,
        stream: false
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('❌ GPT-4o processing error:', error);
      throw new Error('Failed to process with GPT-4o');
    }
  }

  // Generate speech using OpenAI TTS
  async generateSpeech(text) {
    try {
      const speech = await this.openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: 'nova',
        input: text,
        response_format: 'mp3',
        speed: 1.0
      });

      return speech;
    } catch (error) {
      console.error('❌ Speech generation error:', error);
      throw new Error('Failed to generate speech');
    }
  }

  // Build system prompt for car dealership context
  buildSystemPrompt(context = {}) {
    const { vehicleInfo, dealerInfo } = context;
    
    let prompt = `You are D.A.I.V.E., an AI sales assistant for a car dealership. 
    You help customers with vehicle information, pricing, test drives, and sales inquiries.
    Be friendly, professional, and knowledgeable about cars.`;

    if (vehicleInfo) {
      prompt += `\n\nCurrent vehicle: ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`;
      if (vehicleInfo.price) {
        prompt += `\nPrice: $${vehicleInfo.price}`;
      }
    }

    if (dealerInfo) {
      prompt += `\n\nDealer: ${dealerInfo.business_name}`;
      if (dealerInfo.contact_name) {
        prompt += `\nContact: ${dealerInfo.contact_name}`;
      }
    }

    prompt += `\n\nKeep responses conversational and helpful. If a customer seems interested, 
    offer to schedule a test drive or connect them with a sales representative.`;

    return prompt;
  }

  // Stream real-time conversation (for WebSocket implementation)
  async streamRealtimeConversation(audioChunk, conversationId) {
    try {
      // This would be implemented for real-time streaming
      // For now, we'll use the batch processing approach
      console.log('🔄 Real-time streaming not yet implemented');
      return null;
    } catch (error) {
      console.error('❌ Streaming error:', error);
      throw error;
    }
  }

  // Get voice settings
  async getVoiceSettings() {
    try {
      const query = `
        SELECT setting_type, setting_value
        FROM daive_api_settings
        WHERE dealer_id IS NULL AND setting_type LIKE 'voice_%'
      `;
      
      const result = await pool.query(query);
      const settings = {};
      
      result.rows.forEach(row => {
        settings[row.setting_type] = row.setting_value;
      });

      return settings;
    } catch (error) {
      console.error('❌ Error getting voice settings:', error);
      return {};
    }
  }
}

export default GPT4oVoiceService; 
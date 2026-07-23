import fs from 'fs';
import fetch from 'node-fetch';

class DeepgramTTSService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.deepgram.com/v1/speak';
  }

  async synthesizeSpeech(text, options = {}) {
    try {
      console.log('🎤 Starting Deepgram TTS synthesis...');
      
      // Default options
      const defaultOptions = {
        model: 'aura-asteria',
        voice: 'asteria',
        encoding: 'mp3',
        container: 'mp3',
        sample_rate: 24000
      };

      const synthesisOptions = { ...defaultOptions, ...options };
      
      console.log('📝 Text to synthesize:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      console.log('⚙️ Synthesis options:', synthesisOptions);
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text
        })
      });
      
      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Deepgram TTS synthesis successful');
        return {
          success: true,
          audioBuffer: Buffer.from(audioBuffer),
          format: synthesisOptions.encoding,
          sampleRate: synthesisOptions.sample_rate
        };
      } else {
        const errorText = await response.text();
        console.error('❌ Deepgram TTS API error:', response.status, errorText);
        return {
          success: false,
          error: `Deepgram TTS API error: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('❌ Deepgram TTS synthesis error:', error);
      return {
        success: false,
        error: 'Failed to synthesize speech',
        details: error.message
      };
    }
  }

  async testConnection() {
    try {
      console.log('🔗 Testing Deepgram TTS API connection...');
      
      // Test with a simple text
      const testText = 'Hello, this is a test of Deepgram text-to-speech.';
      
      const result = await this.synthesizeSpeech(testText);
      
      if (result.success) {
        console.log('✅ Deepgram TTS API connection successful');
        return {
          success: true,
          message: 'Deepgram TTS API connection successful'
        };
      } else {
        console.log('❌ Deepgram TTS API connection failed:', result.error);
        return {
          success: false,
          error: result.error,
          details: result.details
        };
      }
    } catch (error) {
      console.error('❌ Deepgram TTS connection test error:', error);
      return {
        success: false,
        error: 'Failed to test Deepgram TTS connection',
        details: error.message
      };
    }
  }

  async getAvailableVoices() {
    try {
      console.log('🎭 Fetching Deepgram TTS available voices...');
      
      const response = await fetch('https://api.deepgram.com/v1/speak/voices', {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Available Deepgram TTS voices:', data.voices);
        return {
          success: true,
          voices: data.voices
        };
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch Deepgram TTS voices:', response.status, errorText);
        return {
          success: false,
          error: `Failed to fetch voices: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('❌ Error fetching Deepgram TTS voices:', error);
      return {
        success: false,
        error: 'Failed to fetch available voices',
        details: error.message
      };
    }
  }

  async getAvailableModels() {
    try {
      console.log('🤖 Fetching Deepgram TTS available models...');
      
      const response = await fetch('https://api.deepgram.com/v1/speak/models', {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Available Deepgram TTS models:', data.models);
        return {
          success: true,
          models: data.models
        };
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch Deepgram TTS models:', response.status, errorText);
        return {
          success: false,
          error: `Failed to fetch models: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('❌ Error fetching Deepgram TTS models:', error);
      return {
        success: false,
        error: 'Failed to fetch available models',
        details: error.message
      };
    }
  }

  // Save audio to file
  async saveToFile(audioBuffer, filePath) {
    try {
      fs.writeFileSync(filePath, audioBuffer);
      console.log('✅ Audio saved to file:', filePath);
      return true;
    } catch (error) {
      console.error('❌ Error saving audio to file:', error);
      return false;
    }
  }
}

export default DeepgramTTSService; 
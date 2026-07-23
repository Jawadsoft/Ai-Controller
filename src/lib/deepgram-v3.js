import fs from 'fs';
import fetch from 'node-fetch';

class DeepgramServiceV3 {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.deepgram.com/v1/listen';
  }

  async transcribeAudio(audioFilePath) {
    try {
      console.log('Starting Deepgram v3 transcription...');
      
      // Read the audio file
      const audioBuffer = fs.readFileSync(audioFilePath);
      
      console.log('Sending to Deepgram v3 API...');
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'audio/wav'
        },
        body: audioBuffer
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Deepgram v3 transcription successful:', data.results?.channels[0]?.alternatives[0]?.transcript);
        return {
          success: true,
          text: data.results?.channels[0]?.alternatives[0]?.transcript || '',
          language: data.results?.channels[0]?.alternatives[0]?.language || 'en',
          confidence: data.results?.channels[0]?.alternatives[0]?.confidence || 0
        };
      } else {
        const errorText = await response.text();
        console.error('Deepgram v3 API error:', response.status, errorText);
        return {
          success: false,
          error: `Deepgram v3 API error: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('Deepgram v3 transcription error:', error);
      return {
        success: false,
        error: 'Failed to transcribe audio',
        details: error.message
      };
    }
  }

  async transcribeAudioWithOptions(audioFilePath, options = {}) {
    try {
      console.log('Starting Deepgram v3 transcription with options...');
      
      // Read the audio file
      const audioBuffer = fs.readFileSync(audioFilePath);
      
      // Build query parameters for v3
      const params = new URLSearchParams();
      
      // Model options - v3 supports new models
      if (options.model) {
        params.append('model', options.model);
      } else {
        params.append('model', 'nova-2'); // Default to Nova-2 model (v3 compatible)
      }
      
      // Language options
      if (options.language) {
        params.append('language', options.language);
      }
      
      // Smart format for better results
      params.append('smart_format', 'true');
      
      // Punctuate for better readability
      params.append('punctuate', 'true');
      
      // Diarize if specified
      if (options.diarize) {
        params.append('diarize', 'true');
      }
      
      // Utterances for better segmentation
      params.append('utterances', 'true');
      
      // v3 specific options
      if (options.filler_words) {
        params.append('filler_words', 'true');
      }
      
      if (options.profanity_filter) {
        params.append('profanity_filter', 'true');
      }
      
      if (options.redact) {
        params.append('redact', 'true');
      }
      
      if (options.search) {
        params.append('search', options.search);
      }
      
      if (options.replace) {
        params.append('replace', options.replace);
      }
      
      console.log('Sending to Deepgram v3 API with options:', options);
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'audio/wav'
        },
        body: audioBuffer
      });
      
      if (response.ok) {
        const data = await response.json();
        const transcript = data.results?.channels[0]?.alternatives[0]?.transcript || '';
        console.log('Deepgram v3 transcription successful:', transcript);
        return {
          success: true,
          text: transcript,
          language: data.results?.channels[0]?.alternatives[0]?.language || 'en',
          confidence: data.results?.channels[0]?.alternatives[0]?.confidence || 0,
          duration: data.metadata?.duration || 0,
          // v3 specific fields
          words: data.results?.channels[0]?.alternatives[0]?.words || [],
          paragraphs: data.results?.channels[0]?.alternatives[0]?.paragraphs || [],
          sentences: data.results?.channels[0]?.alternatives[0]?.sentences || []
        };
      } else {
        const errorText = await response.text();
        console.error('Deepgram v3 API error:', response.status, errorText);
        return {
          success: false,
          error: `Deepgram v3 API error: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('Deepgram v3 transcription error:', error);
      return {
        success: false,
        error: 'Failed to transcribe audio',
        details: error.message
      };
    }
  }

  // Test the API connection with v3
  async testConnection() {
    try {
      console.log('Testing Deepgram v3 API connection...');
      
      // Create a simple test audio file (1 second of silence)
      const sampleRate = 16000;
      const duration = 1;
      const numSamples = sampleRate * duration;
      
      const header = Buffer.alloc(44);
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + numSamples * 2, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(1, 22);
      header.writeUInt32LE(sampleRate, 24);
      header.writeUInt32LE(sampleRate * 2, 28);
      header.writeUInt16LE(2, 32);
      header.writeUInt16LE(16, 34);
      header.write('data', 36);
      header.writeUInt32LE(numSamples * 2, 40);
      
      const audioData = Buffer.alloc(numSamples * 2);
      const wavFile = Buffer.concat([header, audioData]);
      
      // Test with v3 specific options
      const params = new URLSearchParams();
      params.append('model', 'nova-2');
      params.append('smart_format', 'true');
      params.append('punctuate', 'true');
      
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'audio/wav'
        },
        body: wavFile
      });
      
      if (response.ok) {
        console.log('✅ Deepgram v3 API connection successful');
        return {
          success: true,
          message: 'Deepgram v3 API connection successful'
        };
      } else {
        const errorText = await response.text();
        console.error('❌ Deepgram v3 API connection failed:', response.status, errorText);
        return {
          success: false,
          error: `Deepgram v3 API connection failed: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('❌ Deepgram v3 API connection error:', error);
      return {
        success: false,
        error: 'Failed to connect to Deepgram v3 API',
        details: error.message
      };
    }
  }

  // Get available models for v3
  async getAvailableModels() {
    try {
      console.log('Fetching Deepgram v3 available models...');
      
      const response = await fetch('https://api.deepgram.com/v1/models', {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Available Deepgram v3 models:', data.models);
        return {
          success: true,
          models: data.models
        };
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch Deepgram v3 models:', response.status, errorText);
        return {
          success: false,
          error: `Failed to fetch models: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('❌ Error fetching Deepgram v3 models:', error);
      return {
        success: false,
        error: 'Failed to fetch available models',
        details: error.message
      };
    }
  }

  // Get usage information for v3
  async getUsage() {
    try {
      console.log('Fetching Deepgram v3 usage information...');
      
      const response = await fetch('https://api.deepgram.com/v1/usage', {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Deepgram v3 usage information:', data);
        return {
          success: true,
          usage: data
        };
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch Deepgram v3 usage:', response.status, errorText);
        return {
          success: false,
          error: `Failed to fetch usage: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('❌ Error fetching Deepgram v3 usage:', error);
      return {
        success: false,
        error: 'Failed to fetch usage information',
        details: error.message
      };
    }
  }
}

export default DeepgramServiceV3; 
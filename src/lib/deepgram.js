import fs from 'fs';
import fetch from 'node-fetch';

class DeepgramService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.deepgram.com/v1/listen';
  }

  async transcribeAudio(audioFilePath) {
    try {
      console.log('Starting Deepgram transcription...');
      
      // Read the audio file
      const audioBuffer = fs.readFileSync(audioFilePath);
      
      console.log('Sending to Deepgram API...');
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
        console.log('Deepgram transcription successful:', data.results?.channels[0]?.alternatives[0]?.transcript);
        return {
          success: true,
          text: data.results?.channels[0]?.alternatives[0]?.transcript || '',
          language: data.results?.channels[0]?.alternatives[0]?.language || 'en',
          confidence: data.results?.channels[0]?.alternatives[0]?.confidence || 0
        };
      } else {
        const errorText = await response.text();
        console.error('Deepgram API error:', response.status, errorText);
        return {
          success: false,
          error: `Deepgram API error: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('Deepgram transcription error:', error);
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
      
      console.log('Sending to Deepgram API with options:', options);
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
        console.log('Deepgram transcription successful:', transcript);
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
        console.error('Deepgram API error:', response.status, errorText);
        return {
          success: false,
          error: `Deepgram API error: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('Deepgram transcription error:', error);
      return {
        success: false,
        error: 'Failed to transcribe audio',
        details: error.message
      };
    }
  }

  // Test the API connection
  async testConnection() {
    try {
      console.log('Testing Deepgram API connection...');
      
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
      
      const response = await fetch(`${this.baseUrl}?model=nova-2&smart_format=true&punctuate=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'audio/wav'
        },
        body: wavFile
      });
      
      if (response.ok) {
        console.log('✅ Deepgram API connection successful');
        return {
          success: true,
          message: 'Deepgram API connection successful'
        };
      } else {
        const errorText = await response.text();
        console.error('❌ Deepgram API connection failed:', response.status, errorText);
        return {
          success: false,
          error: `Deepgram API connection failed: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('❌ Deepgram API connection error:', error);
      return {
        success: false,
        error: 'Failed to connect to Deepgram API',
        details: error.message
      };
    }
  }
}

export default DeepgramService; 
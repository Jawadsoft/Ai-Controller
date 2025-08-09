import fs from 'fs';
import fetch from 'node-fetch';

class WhisperService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1/audio/transcriptions';
  }

  async transcribeAudio(audioFilePath) {
    try {
      console.log('Starting Whisper transcription...');
      
      // Use proper FormData library
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      
      // Add the audio file
      formData.append('file', fs.createReadStream(audioFilePath), {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      
      // Add model
      formData.append('model', 'whisper-1');
      
      // Add language (optional, but helps with accuracy)
      formData.append('language', 'en');
      
      // Add response format
      formData.append('response_format', 'json');
      
      console.log('Sending to OpenAI Whisper API...');
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Whisper transcription successful:', data.text);
        return {
          success: true,
          text: data.text,
          language: data.language
        };
      } else {
        const errorText = await response.text();
        console.error('Whisper API error:', response.status, errorText);
        return {
          success: false,
          error: `Whisper API error: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('Whisper transcription error:', error);
      return {
        success: false,
        error: 'Failed to transcribe audio',
        details: error.message
      };
    }
  }

  async transcribeAudioWithOptions(audioFilePath, options = {}) {
    try {
      console.log('Starting Whisper transcription with options...');
      
      // Use proper FormData library
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      
      // Add the audio file
      formData.append('file', fs.createReadStream(audioFilePath), {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      
      // Add model
      formData.append('model', options.model || 'whisper-1');
      
      // Add language if specified
      if (options.language) {
        formData.append('language', options.language);
      }
      
      // Add response format
      formData.append('response_format', 'json');
      
      // Add temperature if specified
      if (options.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
      }
      
      console.log('Sending to OpenAI Whisper API with options:', options);
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Whisper transcription successful:', data.text);
        return {
          success: true,
          text: data.text,
          language: data.language,
          duration: data.duration
        };
      } else {
        const errorText = await response.text();
        console.error('Whisper API error:', response.status, errorText);
        return {
          success: false,
          error: `Whisper API error: ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      console.error('Whisper transcription error:', error);
      return {
        success: false,
        error: 'Failed to transcribe audio',
        details: error.message
      };
    }
  }
}

export default WhisperService; 
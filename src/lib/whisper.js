import fs from 'fs';
import fetch from 'node-fetch';

class WhisperService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1/audio/transcriptions';
    this.maxRetries = 2; // Add retry mechanism
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
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🔄 Whisper transcription attempt ${attempt}/${this.maxRetries}...`);
        
        // Check if audio file exists and get file info
        if (!fs.existsSync(audioFilePath)) {
          throw new Error(`Audio file not found: ${audioFilePath}`);
        }
        
        const stats = fs.statSync(audioFilePath);
        console.log(`📁 Audio file size: ${(stats.size / 1024).toFixed(2)} KB`);
        
        // Validate audio file size (Whisper has limits)
        if (stats.size > 25 * 1024 * 1024) { // 25MB limit
          throw new Error('Audio file too large for Whisper API (max 25MB)');
        }
        
        if (stats.size < 1024) { // Less than 1KB
          throw new Error('Audio file too small, may be corrupted');
        }
        
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
        
        // Add language if specified (improved language detection)
        if (options.language) {
          formData.append('language', options.language);
        }
        
        // Add response format
        formData.append('response_format', 'json');
        
        // Add temperature if specified (improved for better accuracy)
        if (options.temperature !== undefined) {
          formData.append('temperature', options.temperature.toString());
        }
        
        // Add prompt for better context understanding (NEW)
        if (options.prompt) {
          formData.append('prompt', options.prompt);
        }
        
        console.log('📤 Sending to OpenAI Whisper API with options:', options);
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
          console.log('✅ Whisper transcription successful:', data.text);
          console.log(`📊 Transcription confidence: ${data.text ? 'High' : 'Low'}`);
          return {
            success: true,
            text: data.text,
            language: data.language,
            duration: data.duration
          };
        } else {
          const errorText = await response.text();
          console.error(`❌ Whisper API error (attempt ${attempt}):`, response.status, errorText);
          
          // If it's a rate limit or temporary error, retry
          if (response.status === 429 || response.status >= 500) {
            lastError = new Error(`Whisper API error: ${response.status} - ${errorText}`);
            if (attempt < this.maxRetries) {
              console.log(`⏳ Retrying in ${attempt * 1000}ms...`);
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
              continue;
            }
          }
          
          console.error('🔍 Audio file details:', {
            path: audioFilePath,
            size: stats ? `${(stats.size / 1024).toFixed(2)} KB` : 'Unknown',
            exists: fs.existsSync(audioFilePath)
          });
          
          return {
            success: false,
            error: `Whisper API error: ${response.status}`,
            details: errorText
          };
        }
      } catch (error) {
        console.error(`❌ Whisper transcription error (attempt ${attempt}):`, error.message);
        lastError = error;
        
        // If it's a network error, retry
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          if (attempt < this.maxRetries) {
            console.log(`⏳ Retrying in ${attempt * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            continue;
          }
        }
        
        // For other errors, don't retry
        break;
      }
    }
    
    // If all retries failed
    console.error('❌ All Whisper transcription attempts failed');
    return {
      success: false,
      error: 'Failed to transcribe audio after all retries',
      details: lastError ? lastError.message : 'Unknown error'
    };
  }
}

export default WhisperService; 
/**
 * Voice Utilities for React Frontend
 * Handles proper voice recording and sending with FormData
 */

export interface VoiceSubmissionData {
  vehicleId: string;
  sessionId: string;
  customerInfo?: {
    name?: string;
    email?: string;
    dealerId?: string;
  };
}

/**
 * Send voice audio blob to the backend using FormData
 * @param audioBlob - The recorded audio blob
 * @param data - Additional data to send with the voice
 * @param endpoint - The API endpoint (defaults to voice endpoint)
 * @returns Promise with the response data
 */
export const sendVoiceToBackend = async (
  audioBlob: Blob,
  data: VoiceSubmissionData,
  endpoint: string = 'http://localhost:3000/api/daive/voice'
): Promise<any> => {
  try {
    // Create FormData with proper structure
    const formData = new FormData();
    
    // Add audio file with proper filename and MIME type
    const fileName = `voice-${Date.now()}.${getAudioExtension(audioBlob.type)}`;
    formData.append('audio', audioBlob, fileName);
    
    // Add additional data
    formData.append('vehicleId', data.vehicleId);
    formData.append('sessionId', data.sessionId);
    
    if (data.customerInfo) {
      formData.append('customerInfo', JSON.stringify(data.customerInfo));
    }

    console.log('Sending voice data:', {
      fileName,
      mimeType: audioBlob.type,
      size: audioBlob.size,
      vehicleId: data.vehicleId,
      sessionId: data.sessionId
    });

    // Send to backend - DON'T manually set Content-Type header
    // Let the browser handle it for FormData
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      // No headers needed - browser sets Content-Type automatically
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voice API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    return responseData;

  } catch (error) {
    console.error('Error sending voice to backend:', error);
    throw error;
  }
};

/**
 * Get the appropriate file extension based on MIME type
 * @param mimeType - The MIME type of the audio blob
 * @returns The file extension
 */
export const getAudioExtension = (mimeType: string): string => {
  switch (mimeType) {
    case 'audio/webm':
      return 'webm';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/wav':
    default:
      return 'wav';
  }
};

/**
 * Create a proper audio blob with optimal settings for Whisper API
 * @param audioChunks - Array of audio chunks from MediaRecorder
 * @param mimeType - The MIME type to use
 * @returns Audio blob optimized for transcription
 */
export const createOptimizedAudioBlob = (
  audioChunks: Blob[],
  mimeType: string = 'audio/webm'
): Blob => {
  // Use webm if supported, otherwise fallback to wav
  const finalMimeType = MediaRecorder.isTypeSupported('audio/webm') 
    ? 'audio/webm' 
    : 'audio/wav';
  
  return new Blob(audioChunks, { type: finalMimeType });
};

/**
 * Validate audio blob before sending
 * @param audioBlob - The audio blob to validate
 * @returns Object with validation result and any errors
 */
export const validateAudioBlob = (audioBlob: Blob): {
  isValid: boolean;
  errors: string[];
  size: number;
  duration?: number;
} => {
  const errors: string[] = [];
  const maxSize = 25 * 1024 * 1024; // 25MB limit
  const minSize = 1024; // 1KB minimum

  // Check file size
  if (audioBlob.size > maxSize) {
    errors.push(`Audio file too large (${(audioBlob.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 25MB.`);
  }

  if (audioBlob.size < minSize) {
    errors.push('Audio file too small. Please record a longer message.');
  }

  // Check MIME type
  const supportedTypes = ['audio/webm', 'audio/wav', 'audio/mp4', 'audio/ogg'];
  if (!supportedTypes.includes(audioBlob.type)) {
    errors.push(`Unsupported audio format: ${audioBlob.type}. Supported formats: ${supportedTypes.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    size: audioBlob.size
  };
};

/**
 * Get optimal MediaRecorder settings for voice recording
 * @returns MediaRecorder options optimized for voice transcription
 */
export const getOptimalMediaRecorderOptions = (): MediaRecorderOptions => {
  // Try to use webm with opus codec for best quality/size ratio
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return { mimeType: 'audio/webm;codecs=opus' };
  }
  
  // Fallback to webm
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return { mimeType: 'audio/webm' };
  }
  
  // Final fallback to wav
  return { mimeType: 'audio/wav' };
};

/**
 * Get optimal audio constraints for voice recording
 * @returns Audio constraints optimized for voice transcription
 */
export const getOptimalAudioConstraints = (): MediaTrackConstraints => {
  return {
    sampleRate: 16000, // Optimal for Whisper API
    channelCount: 1,   // Mono for better transcription
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  };
};

/**
 * Format file size for display
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Calculate approximate audio duration from blob size
 * @param blob - The audio blob
 * @param sampleRate - Sample rate in Hz (default: 16000)
 * @param channels - Number of channels (default: 1)
 * @param bitsPerSample - Bits per sample (default: 16)
 * @returns Approximate duration in seconds
 */
export const estimateAudioDuration = (
  blob: Blob,
  sampleRate: number = 16000,
  channels: number = 1,
  bitsPerSample: number = 16
): number => {
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerSecond = sampleRate * channels * bytesPerSample;
  return blob.size / bytesPerSecond;
}; 
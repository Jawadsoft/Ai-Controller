# Voice Recording Fixes for AIBotPage

## Issues Fixed

### 1. **MediaRecorder State Management**
- Added state checking before starting new recordings
- Prevent multiple simultaneous recordings
- Added proper cleanup between recordings

### 2. **Audio Chunk Handling**
- Improved audio chunk array management
- Added null checks for audioChunksRef
- Enhanced logging for debugging

### 3. **Recording Lifecycle**
- Added `startRecordingInternal()` for cleaner state management
- Added `resetMediaRecorder()` for cleanup
- Improved error handling and user feedback

## Key Changes Made

### Frontend (AIBotPage.tsx)

```typescript
// Enhanced startRecording with state checking
const startRecording = () => {
  if (!mediaRecorderRef.current) {
    toast.error('Microphone not initialized. Please refresh the page.');
    return;
  }

  try {
    // Reset all audio state completely
    setAudioChunks([]);
    setAudioBlob(null);
    audioChunksRef.current = [];
    
    // Ensure MediaRecorder is in a clean state
    if (mediaRecorderRef.current.state === 'recording') {
      console.log('🔄 Stopping existing recording before starting new one...');
      mediaRecorderRef.current.stop();
      setTimeout(() => {
        startRecordingInternal();
      }, 100);
      return;
    }
    
    startRecordingInternal();
  } catch (error) {
    console.error('Error starting recording:', error);
    toast.error('Failed to start recording. Please try again.');
  }
};

// Internal recording function with state validation
const startRecordingInternal = () => {
  try {
    if (mediaRecorderRef.current.state !== 'inactive') {
      console.log('⚠️ MediaRecorder not in inactive state, resetting...');
      mediaRecorderRef.current = null;
      toast.error('MediaRecorder error. Please refresh the page.');
      return;
    }
    
    mediaRecorderRef.current.start();
    setIsRecording(true);
    
    console.log('🎤 Recording started successfully');
    console.log('🔍 MediaRecorder state:', mediaRecorderRef.current.state);
    console.log('🔍 Audio chunks ref length:', audioChunksRef.current.length);
    toast.success('🎤 Recording started. Speak clearly into your microphone.');
  } catch (error) {
    console.error('Error in startRecordingInternal:', error);
    toast.error('Failed to start recording. Please try again.');
  }
};

// Enhanced audio chunk handling
recorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    // Ensure we're working with a fresh array
    if (!audioChunksRef.current) {
      audioChunksRef.current = [];
    }
    
    audioChunksRef.current.push(event.data);
    setAudioChunks(prev => [...prev, event.data]);
    console.log(`📦 Audio chunk received: ${event.data.size} bytes`);
    console.log(`📊 Total chunks: ${audioChunksRef.current.length}`);
  }
};

// Enhanced onstop handler with better logging
recorder.onstop = () => {
  console.log('🛑 Recording stopped, processing audio chunks...');
  console.log('🔍 Audio chunks ref length:', audioChunksRef.current?.length || 0);
  console.log('🔍 Audio chunks state length:', audioChunks.length);
  
  if (audioChunksRef.current && audioChunksRef.current.length > 0) {
    const mimeType = recorder.mimeType || 'audio/wav';
    const blob = new Blob(audioChunksRef.current, { type: mimeType });
    setAudioBlob(blob);
    console.log(`🛑 Recording stopped. Audio size: ${(blob.size / 1024).toFixed(2)} KB`);
    console.log('🎵 Audio blob created:', { size: blob.size, type: blob.type });
    console.log('🎵 Audio chunks used:', audioChunksRef.current.length);
    handleVoiceSubmission(blob);
  } else {
    console.log('❌ No audio chunks received');
    console.log('🔍 Audio chunks ref:', audioChunksRef.current);
    console.log('🔍 Audio chunks state:', audioChunks);
    toast.error('No audio recorded. Please try again.');
  }
};

// MediaRecorder reset function
const resetMediaRecorder = () => {
  try {
    if (mediaRecorderRef.current) {
      console.log('🔄 Resetting MediaRecorder state...');
      console.log('🔍 Current state before reset:', mediaRecorderRef.current.state);
      
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      mediaRecorderRef.current = null;
      console.log('🔄 MediaRecorder reset, will re-initialize on next use');
    }
  } catch (error) {
    console.error('Error resetting MediaRecorder:', error);
  }
};
```

## Expected Results

After these fixes:

1. **First voice message**: Should work as before ✅
2. **Second voice message**: Should now work reliably ✅
3. **Subsequent messages**: Should continue working ✅
4. **Better error handling**: Clear messages when issues occur ✅
5. **Improved logging**: Better debugging information ✅

## Testing

To test the fixes:

1. Send a voice message
2. Wait for response
3. Send another voice message immediately
4. Verify both work correctly
5. Check console logs for detailed information

## Backend Considerations

The backend Whisper service should now receive:
- Properly formatted audio blobs
- Consistent audio chunk data
- Better error handling from frontend

If issues persist, check:
- Whisper API key validity
- Audio file format compatibility
- Backend error logs

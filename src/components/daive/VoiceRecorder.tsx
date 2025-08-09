import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useToast } from '../ui/use-toast';

interface VoiceRecorderProps {
  onVoiceSubmit: (audioBlob: Blob) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onVoiceSubmit, 
  disabled = false,
  className = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  // Initialize media recorder when component mounts
  useEffect(() => {
    const initializeMediaRecorder = async () => {
      try {
        console.log('🔧 Initializing VoiceRecorder media recorder...');
        
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        streamRef.current = stream;
        
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/wav';
        
        const recorder = new MediaRecorder(stream, {
          mimeType: mimeType
        });
        
        console.log(`✅ MediaRecorder initialized with MIME type: ${mimeType}`);
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current = [...audioChunksRef.current, event.data];
            setAudioChunks(prev => [...prev, event.data]);
            console.log(`📦 Audio chunk received: ${event.data.size} bytes`);
          }
        };
        
        recorder.onstop = () => {
          if (audioChunksRef.current.length > 0) {
            const mimeType = recorder.mimeType || 'audio/wav';
            const blob = new Blob(audioChunksRef.current, { type: mimeType });
            setAudioBlob(blob);
            
            console.log(`🛑 Recording stopped. Audio size: ${formatFileSize(blob.size)}`);
            console.log('🎵 Audio blob created:', {
              size: formatFileSize(blob.size),
              type: blob.type
            });
            
            // Process the voice submission
            handleVoiceSubmission(blob);
          } else {
            console.log('❌ No audio chunks received');
            toast({
              title: "Recording Error",
              description: "No audio recorded. Please try again.",
              variant: "destructive",
            });
          }
        };
        
        recorder.onerror = (event) => {
          console.error('❌ MediaRecorder error:', event);
          toast({
            title: "Recording Error",
            description: "Failed to record audio. Please try again.",
            variant: "destructive",
          });
          setIsRecording(false);
        };
        
        mediaRecorderRef.current = recorder;
        console.log('✅ VoiceRecorder media recorder initialized successfully');
        
      } catch (error) {
        console.error('❌ Error accessing microphone:', error);
        toast({
          title: "Microphone Access",
          description: "Please allow microphone access to use voice features.",
          variant: "destructive",
        });
      }
    };

    initializeMediaRecorder();

    // Cleanup function
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log('🎤 Requesting microphone access...');
      
      if (!mediaRecorderRef.current || disabled) {
        console.log('❌ Media recorder not initialized or disabled');
        toast({
          title: "Recording Error",
          description: "Media recorder not ready. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }

      setAudioChunks([]);
      setAudioBlob(null);
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      console.log('🎤 VoiceRecorder recording started successfully');
      toast({
        title: "🎤 Recording Started",
        description: "Speak clearly into your microphone. Click again to stop.",
      });
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      console.log('🛑 VoiceRecorder recording stopped by user');
      toast({
        title: "🔄 Processing Audio",
        description: "Converting your voice to text...",
      });
    } else {
      console.log('❌ No active recording to stop');
    }
  };

  const handleVoiceSubmission = async (audioBlob: Blob) => {
    console.log('🎵 Processing VoiceRecorder voice submission:', {
      size: formatFileSize(audioBlob.size),
      type: audioBlob.type
    });

    setIsProcessing(true);
    
    try {
      // Call the parent's voice submission handler
      await onVoiceSubmit(audioBlob);
      
      // Clear audio chunks after successful submission
      setAudioChunks([]);
      setAudioBlob(null);
      audioChunksRef.current = [];
      
      console.log('✅ VoiceRecorder voice submission completed successfully');
      
    } catch (error) {
      console.error('❌ Error processing voice in VoiceRecorder:', error);
      toast({
        title: "Voice Processing Error",
        description: "Failed to process your voice message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isProcessing}
      variant={isRecording ? "destructive" : "outline"}
      size="icon"
      className={`relative ${className}`}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      
      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
      )}
    </Button>
  );
};

export default VoiceRecorder; 
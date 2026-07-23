// Streaming Voice Recorder - Frontend streaming pipeline
// Target: ≤80ms voice capture, ≤300ms first partial transcript
// Features: Chunked recording, WebSocket streaming, real-time feedback

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';
import { Mic, MicOff, Square, Loader2, Volume2, VolumeX } from 'lucide-react';
import { buildWebSocketUrl } from '../../lib/config';

interface StreamingVoiceRecorderProps {
  onVoiceSubmit?: (transcript: string, audioBlob?: Blob) => void;
  onPartialTranscript?: (transcript: string) => void;
  onIntentDetected?: (intent: string, confidence: number) => void;
  onAudioReady?: (audioChunk: ArrayBuffer, isComplete: boolean) => void;
  disabled?: boolean;
  className?: string;
  dealerId?: string;
  vehicleId?: string;
  sessionId?: string;
}

const StreamingVoiceRecorder: React.FC<StreamingVoiceRecorderProps> = ({
  onVoiceSubmit,
  onPartialTranscript,
  onIntentDetected,
  onAudioReady,
  disabled = false,
  className = '',
  dealerId,
  vehicleId,
  sessionId
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [detectedIntent, setDetectedIntent] = useState<string | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<Record<string, number>>({});
  const [audioQueue, setAudioQueue] = useState<ArrayBuffer[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const performanceStartRef = useRef<number>(0);
  
  const { toast } = useToast();

  // Performance targets
  const targets = {
    voiceCapture: 80,      // ms
    sttFirstPartial: 300,  // ms
    intentDetection: 120,   // ms
    llmFirstToken: 700,     // ms
    ttsFirstAudio: 600,     // ms
    audioPlayStart: 120,    // ms
    totalResponse: 4000     // ms
  };

  // Initialize WebSocket connection
  useEffect(() => {
    if (!dealerId) return;

    const connectWebSocket = () => {
      try {
        const wsUrl = `${buildWebSocketUrl('streaming-voice')}?dealerId=${dealerId}&vehicleId=${vehicleId || ''}&sessionId=${sessionId || ''}`;
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('🔌 WebSocket connected to streaming voice service');
          setIsConnected(true);
          
          // Send connection info
          ws.send(JSON.stringify({
            type: 'connection_info',
            dealerId,
            vehicleId,
            sessionId
          }));
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          
          // Attempt to reconnect after 2 seconds
          setTimeout(connectWebSocket, 2000);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };
        
        wsRef.current = ws;
        
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        setIsConnected(false);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [dealerId, vehicleId, sessionId]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    const { type, ...payload } = data;
    
    switch (type) {
      case 'partial_transcript':
        setCurrentTranscript(payload.transcript);
        onPartialTranscript?.(payload.transcript);
        trackPerformance('stt_first_partial', performance.now() - performanceStartRef.current);
        break;
        
      case 'final_transcript':
        setCurrentTranscript(payload.transcript);
        onPartialTranscript?.(payload.transcript);
        trackPerformance('stt_complete', performance.now() - performanceStartRef.current);
        break;
        
      case 'intent_detected':
        setDetectedIntent(payload.intent);
        onIntentDetected?.(payload.intent, payload.confidence);
        trackPerformance('intent_detection', performance.now() - performanceStartRef.current);
        break;
        
      case 'partial_response':
        // Handle partial AI response
        break;
        
      case 'final_response':
        // Handle final AI response
        break;
        
      case 'audio_chunk':
        handleAudioChunk(payload.audio, payload.format);
        break;
        
      case 'tts_complete':
        setIsProcessing(false);
        trackPerformance('total_response', performance.now() - performanceStartRef.current);
        break;
        
      case 'error':
        console.error('Streaming service error:', payload.error);
        toast({
          title: "Streaming Error",
          description: payload.error,
          variant: "destructive",
        });
        setIsProcessing(false);
        break;
        
      default:
        console.log('Unknown WebSocket message type:', type);
    }
  }, [onPartialTranscript, onIntentDetected, toast]);

  // Handle incoming audio chunk
  const handleAudioChunk = useCallback((base64Audio: string, format: string) => {
    try {
      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioBuffer = bytes.buffer;
      
      // Add to audio queue
      audioQueueRef.current.push(audioBuffer);
      setAudioQueue(prev => [...prev, audioBuffer]);
      
      // Start playing if not already playing
      if (!isPlayingAudio) {
        playNextAudioChunk();
      }
      
      // Track TTS performance
      if (audioQueueRef.current.length === 1) {
        trackPerformance('tts_first_audio', performance.now() - performanceStartRef.current);
      }
      
    } catch (error) {
      console.error('Error handling audio chunk:', error);
    }
  }, [isPlayingAudio]);

  // Play next audio chunk in queue
  const playNextAudioChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || isPlayingAudio) return;
    
    setIsPlayingAudio(true);
    const audioChunk = audioQueueRef.current.shift()!;
    
    try {
      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Decode and play audio
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioChunk);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsPlayingAudio(false);
        // Play next chunk if available
        if (audioQueueRef.current.length > 0) {
          setTimeout(playNextAudioChunk, 50); // Small delay between chunks
        }
      };
      
      source.start(0);
      
      // Track audio playback performance
      trackPerformance('audio_play_start', performance.now() - performanceStartRef.current);
      
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      setIsPlayingAudio(false);
      
      // Try next chunk
      if (audioQueueRef.current.length > 0) {
        setTimeout(playNextAudioChunk, 100);
      }
    }
  }, [isPlayingAudio]);

  // Initialize media recorder
  useEffect(() => {
    const initializeMediaRecorder = async () => {
      try {
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
        
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/wav';
        
        const recorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 128000
        });
        
        // Set up chunked recording
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
            // Send audio chunk to WebSocket
            const reader = new FileReader();
            reader.onload = () => {
              const arrayBuffer = reader.result as ArrayBuffer;
              wsRef.current?.send(JSON.stringify({
                type: 'audio_chunk',
                data: arrayBuffer,
                timestamp: Date.now()
              }));
            };
            reader.readAsArrayBuffer(event.data);
          }
        };
        
        recorder.onstop = () => {
          // Send stop recording signal
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'stop_recording',
              timestamp: Date.now()
            }));
          }
        };
        
        mediaRecorderRef.current = recorder;
        console.log('✅ Streaming media recorder initialized');
        
      } catch (error) {
        console.error('Error initializing media recorder:', error);
        toast({
          title: "Microphone Access",
          description: "Please allow microphone access to use voice features.",
          variant: "destructive",
        });
      }
    };
    
    initializeMediaRecorder();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

  // Start recording with chunked streaming
  const startRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !isConnected) {
      toast({
        title: "Recording Error",
        description: "Media recorder not ready or WebSocket not connected.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Reset state
      setCurrentTranscript('');
      setDetectedIntent(null);
      setAudioQueue([]);
      audioQueueRef.current = [];
      setIsProcessing(false);
      
      // Start performance tracking
      performanceStartRef.current = performance.now();
      
      // Start recording with 100ms chunks for real-time streaming
      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      
      // Send start recording signal
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'start_recording',
          timestamp: Date.now()
        }));
      }
      
      console.log('🎤 Streaming recording started');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive",
      });
    }
  }, [isConnected, toast]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    
    try {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      
      console.log('🛑 Streaming recording stopped');
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
    }
  }, []);

  // Track performance metrics
  const trackPerformance = useCallback((metric: string, value: number) => {
    setPerformanceMetrics(prev => ({
      ...prev,
      [metric]: value
    }));
    
    // Log performance data
    console.log(`📊 ${metric}: ${value.toFixed(2)}ms`);
    
    // Check against targets
    const target = targets[metric as keyof typeof targets] || 1000;
    if (value > target) {
      console.warn(`⚠️ ${metric} exceeded target: ${value.toFixed(2)}ms > ${target}ms`);
    }
  }, []);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const summary: Record<string, { value: number; target: number; status: string }> = {};
    
    Object.entries(performanceMetrics).forEach(([metric, value]) => {
      const target = targets[metric as keyof typeof targets] || 1000;
      const status = value <= target ? '✅' : '⚠️';
      
      summary[metric] = {
        value,
        target,
        status
      };
    });
    
    return summary;
  }, [performanceMetrics]);

  // Clear performance metrics
  const clearPerformanceMetrics = useCallback(() => {
    setPerformanceMetrics({});
  }, []);

  // Handle text message submission (fallback)
  const handleTextMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "Connection Error",
        description: "WebSocket not connected. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    // Send text message for processing
    wsRef.current.send(JSON.stringify({
      type: 'text_message',
      data: text,
      timestamp: Date.now()
    }));
    
    setIsProcessing(true);
    performanceStartRef.current = performance.now();
  }, [toast]);

  return (
    <div className={`streaming-voice-recorder ${className}`}>
      {/* Connection Status */}
      <div className="mb-4 p-3 rounded-lg bg-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {isConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (wsRef.current) {
                  wsRef.current.close();
                }
              }}
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {/* Recording Controls */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            disabled={disabled || !isConnected}
            className="bg-red-500 hover:bg-red-600 text-white"
            size="lg"
          >
            <Mic className="w-5 h-5 mr-2" />
            Start Recording
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            className="bg-gray-500 hover:bg-gray-600 text-white"
            size="lg"
          >
            <Square className="w-5 h-5 mr-2" />
            Stop Recording
          </Button>
        )}
        
        {/* Audio Playback Status */}
        {isPlayingAudio && (
          <div className="flex items-center space-x-2 text-primary">
            <Volume2 className="w-4 h-4 animate-pulse" />
            <span className="text-sm">Playing Audio...</span>
          </div>
        )}
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-primary">
              Processing voice input...
            </span>
          </div>
        </div>
      )}

      {/* Current Transcript */}
      {currentTranscript && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Current Transcript:</h4>
          <p className="text-gray-900">{currentTranscript}</p>
        </div>
      )}

      {/* Detected Intent */}
      {detectedIntent && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <h4 className="text-sm font-medium text-green-700 mb-2">Detected Intent:</h4>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
              {detectedIntent}
            </span>
            <span className="text-sm text-green-600">(85% confidence)</span>
          </div>
        </div>
      )}

      {/* Audio Queue Status */}
      {audioQueue.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-purple-50 border border-purple-200">
          <h4 className="text-sm font-medium text-purple-700 mb-2">Audio Queue:</h4>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-purple-800">
              {audioQueue.length} audio chunk{audioQueue.length !== 1 ? 's' : ''} ready
            </span>
            {isPlayingAudio && (
              <span className="text-xs text-purple-600">(Playing...)</span>
            )}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {Object.keys(performanceMetrics).length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-yellow-700">Performance Metrics:</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={clearPerformanceMetrics}
            >
              Clear
            </Button>
          </div>
          
          <div className="space-y-1">
            {Object.entries(getPerformanceSummary()).map(([metric, data]) => (
              <div key={metric} className="flex items-center justify-between text-xs">
                <span className="text-yellow-800">{metric}:</span>
                <div className="flex items-center space-x-2">
                  <span className={`font-medium ${data.status === '✅' ? 'text-green-600' : 'text-red-600'}`}>
                    {data.value.toFixed(0)}ms
                  </span>
                  <span className="text-yellow-600">/ {data.target}ms</span>
                  <span>{data.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text Input Fallback */}
      <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Text Input (Fallback):</h4>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const target = e.target as HTMLInputElement;
                if (target.value.trim()) {
                  handleTextMessage(target.value.trim());
                  target.value = '';
                }
              }
            }}
          />
          <Button
            onClick={() => {
              const input = document.querySelector('input[type="text"]') as HTMLInputElement;
              if (input?.value.trim()) {
                handleTextMessage(input.value.trim());
                input.value = '';
              }
            }}
            size="sm"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StreamingVoiceRecorder;

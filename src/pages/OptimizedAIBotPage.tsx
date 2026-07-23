import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Mic, 
  MicOff, 
  Send, 
  Volume2, 
  VolumeX, 
  Settings, 
  BarChart3, 
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  MessageSquare
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../hooks/useAuth';
import PerformanceDashboard from '../components/daive/PerformanceDashboard';
import { buildWebSocketUrl, buildApiUrl } from '../lib/config';
import { useCustomer, useQRCodeAccess } from '../contexts/CustomerContext';
import QuickAuthModal from '../components/customer/QuickAuthModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  transcription?: string;
  audioUrl?: string;
  performanceMetrics?: {
    t_first_partial?: number;
    t_first_token?: number;
    t_first_audio?: number;
    t_play_start?: number;
    t_end?: number;
  };
}

interface QuickAction {
  label: string;
  message: string;
  icon?: string;
}

interface OptimizedAIBotPageProps {
  vehicleId?: string;
  dealerId?: string;
  vehicleInfo?: {
    make: string;
    model: string;
    year: number;
    price?: number;
  };
  onLeadGenerated?: (leadData: any) => void;
}

const OptimizedAIBotPage: React.FC<OptimizedAIBotPageProps> = ({ 
  vehicleId,
  dealerId: propDealerId,
  vehicleInfo,
  onLeadGenerated
}) => {
  const [searchParams] = useSearchParams();
  const { hash } = useParams();
  
  // Get dealerId from auth context, props, or URL parameters
  const { getDealerId, isAuthenticated, loading: authLoading } = useAuth();
  const { customer, login, hasValidSession, clearPreviousSessions, createRestrictedSession } = useCustomer();
  const { isQRAccess, isCustomerAuthenticated } = useQRCodeAccess();
  const urlDealerId = searchParams.get('dealer');
  const urlDealerName = searchParams.get('dealerName');
  const urlStockNumber = searchParams.get('stock');
  
  const dealerId = propDealerId || urlDealerId || getDealerId();
  
  // Debug logging
  console.log('OptimizedAIBotPage render:', {
    propDealerId,
    urlDealerId,
    urlDealerName,
    urlStockNumber,
    dealerId,
    isAuthenticated,
    authLoading
  });
  
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [dealerInfo, setDealerInfo] = useState<{id: string, business_name: string} | null>(null);
  const [loadingDealer, setLoadingDealer] = useState(false);
  const [showQuickAuth, setShowQuickAuth] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [performanceMode, setPerformanceMode] = useState(true);
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [performanceMetrics, setPerformanceMetrics] = useState({
    totalSessions: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    lastResponseTime: 0
  });

  // Development mode - set to true to disable AI Bot functionality
  const [isDevelopmentMode] = useState(true);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const websocketRef = useRef<WebSocket | null>(null);
  const performanceTimerRef = useRef<{ [key: string]: number }>({});
  const { toast } = useToast();

  // Quick auth handlers
  const handleQuickAuthClose = () => {
    setShowQuickAuth(false);
  };

  const handleQuickAuthSuccess = (sessionData: any) => {
    login(sessionData);
    setShowQuickAuth(false);
    toast({
      title: "Welcome!",
      description: "You're now logged in and can access all features",
    });
  };

  // Fetch dealer information from hash
  const fetchDealerFromHash = async (hash: string, stockNumber?: string) => {
    try {
      setLoadingDealer(true);
      let endpoint;
      
      // Check if hash is actually a UUID (contains hyphens) - if so, treat it as dealer ID
      if (hash.includes('-') && hash.length === 36) {
        console.log('🔍 Hash appears to be a UUID, treating as dealer ID:', hash);
        endpoint = buildApiUrl(`dealers/public/${hash}`);
      } else {
        console.log('🔍 Hash appears to be a QR hash, using QR endpoint:', hash);
        endpoint = buildApiUrl(`dealers/public/qr/${hash}`);
      }
      
      console.log('📡 Fetching dealer from:', endpoint);
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dealer: ${response.status}`);
      }
      
      const data = await response.json();
      setDealerInfo(data);
      
      // Create a restricted session for QR code access
      createRestrictedSession(data.id, stockNumber);
      
      // Add welcome message
      const welcomeMessage: Message = {
        role: 'assistant',
        content: `Welcome to ${data.business_name}! I'm D.A.I.V.E, your AI assistant. I'm here to help you with any questions about our vehicles, financing, or services. How can I assist you today?${stockNumber ? `\n\nI see you're interested in stock #${stockNumber}. I can provide detailed information about this vehicle and help you with the next steps.` : ''}`,
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
      
      return data;
    } catch (error: any) {
      console.error("Error fetching dealer from hash:", error);
      toast({
        title: "Error",
        description: "Failed to load dealer information",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoadingDealer(false);
    }
  };

  // Performance tracking
  const startPerformanceTimer = useCallback((metric: string) => {
    performanceTimerRef.current[metric] = performance.now();
  }, []);

  const endPerformanceTimer = useCallback((metric: string) => {
    if (performanceTimerRef.current[metric]) {
      const duration = performance.now() - performanceTimerRef.current[metric];
      setPerformanceMetrics(prev => ({
        ...prev,
        lastResponseTime: duration
      }));
      console.log(`⏱️ ${metric}: ${duration.toFixed(2)}ms`);
    }
  }, []);

  // WebSocket connection for streaming
  const initializeWebSocket = useCallback(() => {
    if (!dealerId) return;

    // Clean up any existing connection first
    if (websocketRef.current) {
      console.log('🧹 Cleaning up existing WebSocket connection...');
      websocketRef.current.close();
      websocketRef.current = null;
    }

    setConnectionStatus('connecting');
    console.log('🔌 Initializing WebSocket connection...');

    // Try to detect the backend port dynamically
    const backendPort = import.meta.env.VITE_BACKEND_PORT || '3000';
    
    // Use the same URL format as the working StreamingVoiceRecorder
    const wsUrl = `${buildWebSocketUrl('streaming-voice')}?dealerId=${dealerId}&vehicleId=${vehicleId || ''}`;
    
    console.log('🔌 Attempting WebSocket connection to:', wsUrl);
    console.log('🔌 Dealer ID:', dealerId);
    console.log('🔌 Backend Port:', backendPort);
    
    try {
      websocketRef.current = new WebSocket(wsUrl);
      
      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (websocketRef.current?.readyState === WebSocket.CONNECTING) {
          console.error('WebSocket connection timeout after 10 seconds');
          websocketRef.current.close();
          setConnectionStatus('disconnected');
          toast({
            title: "Connection Timeout",
            description: "WebSocket connection timed out. Please check server status.",
            variant: "destructive"
          });
        }
      }, 10000); // 10 second timeout
      
      websocketRef.current.onopen = () => {
        clearTimeout(connectionTimeout); // Clear the connection timeout
        console.log('🚀 WebSocket onopen event fired');
        console.log('🚀 WebSocket readyState:', websocketRef.current?.readyState);
        
        // Wait a moment to ensure WebSocket is fully ready
        setTimeout(() => {
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            setConnectionStatus('connected');
            console.log('🚀 WebSocket connected for streaming voice');
            
            // Send initialization message
            try {
              const currentDealerId = dealerInfo?.id || dealerId;
              websocketRef.current.send(JSON.stringify({
                type: 'initialize',
                dealerId: currentDealerId,
                vehicleId,
                performanceMode: true
              }));
              console.log('✅ Initialization message sent successfully');
            } catch (error) {
              console.error('Error sending initialization message:', error);
              setConnectionStatus('disconnected');
            }
          } else {
            console.warn('WebSocket not ready after delay, readyState:', websocketRef.current?.readyState);
            setConnectionStatus('disconnected');
          }
        }, 100); // Small delay to ensure WebSocket is fully ready
      };

      websocketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        console.error('WebSocket readyState:', websocketRef.current?.readyState);
        console.error('WebSocket URL attempted:', wsUrl);
        
        // Log more detailed error information
        if (error.target && 'url' in error.target) {
          const wsTarget = error.target as WebSocket;
          console.error('Error target URL:', wsTarget.url);
          console.error('Error target readyState:', wsTarget.readyState);
          console.error('Error target protocol:', wsTarget.protocol);
        }
        
        // Log error type and details
        console.error('Error type:', error.type);
        console.error('Error isTrusted:', error.isTrusted);
        console.error('Error eventPhase:', error.eventPhase);
        
        // Don't set disconnected status here, let onclose handle it
        // This prevents race conditions
      };

      websocketRef.current.onclose = (event) => {
        clearTimeout(connectionTimeout); // Clear the connection timeout
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus('disconnected');
        
        // Simple reconnection logic like StreamingVoiceRecorder
        if (event.code !== 1000) {
          console.log('🔄 WebSocket disconnected unexpectedly, attempting to reconnect...');
          setTimeout(() => {
            if (dealerId) {
              initializeWebSocket();
            }
          }, 2000); // Wait 2 seconds before reconnecting
        }
      };
      
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionStatus('disconnected');
      toast({
        title: "Connection Error",
        description: "Failed to create WebSocket connection. Please refresh the page.",
        variant: "destructive"
      });
    }
  }, [dealerId, vehicleId, toast]);

  // Simple reconnection function (no complex fallback logic)
  const reconnectWebSocket = useCallback(() => {
    if (connectionStatus === 'connected') return;
    console.log('🔄 Manual reconnection requested');
    initializeWebSocket();
  }, [connectionStatus, initializeWebSocket]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'partial_transcript':
        handlePartialTranscript(data.transcript, data.sessionId);
        endPerformanceTimer('t_first_partial');
        break;
      
      case 'intent_detected':
        console.log('🧠 Intent detected:', data.intent);
        endPerformanceTimer('t_intent_detection');
        break;
      
      case 'llm_first_token':
        handleLLMFirstToken(data.token, data.sessionId);
        endPerformanceTimer('t_first_token');
        break;
      
      case 'tts_first_audio':
        handleTTSFirstAudio(data.audioChunk, data.sessionId);
        endPerformanceTimer('t_first_audio');
        break;
      
      case 'audio_chunk':
        handleAudioChunk(data.audioChunk, data.isComplete, data.sessionId);
        break;
      
      case 'performance_metrics':
        setPerformanceMetrics(data.metrics);
        break;
      
      case 'ai_response':
        // Handle AI response
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.content,
          timestamp: new Date().toISOString()
        }]);
        setIsProcessing(false);
        endPerformanceTimer('t_end');
        console.log('🤖 AI Response received:', data.content);
        break;
      
      case 'processing':
        console.log('⏳ Processing message received:', data.message);
        break;
      
      case 'error':
        handleError(data.error || data.message);
        break;
      
      default:
        console.log('Unknown message type:', data.type);
    }
  }, [endPerformanceTimer]);

  // Handle partial transcript (streaming STT)
  const handlePartialTranscript = useCallback((transcript: string, sessionId: string) => {
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === 'user' && !lastMessage.transcription) {
        // Update existing message with partial transcript
        return prev.map((msg, index) => 
          index === prev.length - 1 
            ? { ...msg, transcription: transcript, content: transcript }
            : msg
        );
      } else {
        // Create new message with partial transcript
        return [...prev, {
          role: 'user',
          content: transcript,
          transcription: transcript,
          timestamp: new Date().toISOString()
        }];
      }
    });
  }, []);

  // Handle LLM first token (streaming response)
  const handleLLMFirstToken = useCallback((token: string, sessionId: string) => {
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        // Update existing assistant message
        return prev.map((msg, index) => 
          index === prev.length - 1 
            ? { ...msg, content: msg.content + token }
            : msg
        );
      } else {
        // Create new assistant message
        return [...prev, {
          role: 'assistant',
          content: token,
          timestamp: new Date().toISOString()
        }];
      }
    });
  }, []);

  // Handle TTS first audio chunk
  const handleTTSFirstAudio = useCallback((audioChunk: ArrayBuffer, sessionId: string) => {
    endPerformanceTimer('t_first_audio');
    console.log('🎵 First TTS audio received');
  }, [endPerformanceTimer]);

  // Handle streaming audio chunks
  const handleAudioChunk = useCallback((audioChunk: ArrayBuffer, isComplete: boolean, sessionId: string) => {
    if (isComplete) {
      // Play complete audio response
      const audioBlob = new Blob([audioChunk], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          return prev.map((msg, index) => 
            index === prev.length - 1 
              ? { ...msg, audioUrl }
              : msg
          );
        }
        return prev;
      });

      // Auto-play audio
      playAudio(audioUrl);
      endPerformanceTimer('t_end');
    }
  }, [endPerformanceTimer]);

  // Initialize optimized voice recording
  const initializeOptimizedMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Stream audio chunks in real-time
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Send audio chunk immediately via WebSocket
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({
              type: 'audio_chunk',
              audioData: event.data,
              timestamp: Date.now()
            }));
          }
        }
      };

      mediaRecorder.onstop = () => {
        // Final processing
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        handleVoiceSubmission(audioBlob);
      };

      console.log('🎤 Optimized MediaRecorder initialized');
      return true;
    } catch (error) {
      console.error('Error initializing MediaRecorder:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
      return false;
    }
  }, [toast]);

  // Start optimized recording
  const startOptimizedRecording = useCallback(async () => {
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready for recording. State:', websocketRef.current?.readyState);
      toast({
        title: "Connection Error",
        description: "WebSocket not connected. Please wait for connection or refresh the page.",
        variant: "destructive"
      });
      return;
    }

    const success = await initializeOptimizedMediaRecorder();
    if (!success) return;

    setIsRecording(true);
    setMessages(prev => [...prev, {
      role: 'user',
      content: '',
      transcription: '',
      timestamp: new Date().toISOString()
    }]);

    // Start performance timer
    startPerformanceTimer('t_start');
    
    // Start streaming recording
    mediaRecorderRef.current?.start(100); // 100ms chunks for real-time streaming
    
    try {
      // Send start recording signal
      websocketRef.current.send(JSON.stringify({
        type: 'start_recording',
        timestamp: Date.now()
      }));

      console.log('🎤 Started optimized voice recording');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive"
      });
      setIsRecording(false);
    }
  }, [initializeOptimizedMediaRecorder, startPerformanceTimer, toast]);

  // Stop optimized recording
  const stopOptimizedRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      try {
        // Send stop recording signal
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({
            type: 'stop_recording',
            timestamp: Date.now()
          }));
        }

        console.log('⏹️ Stopped optimized voice recording');
      } catch (error) {
        console.error('Error stopping recording:', error);
        // Don't show error toast for stop recording as it's not critical
      }
    }
  }, [isRecording]);

  // Handle voice submission with streaming
  const handleVoiceSubmission = useCallback(async (audioBlob: Blob) => {
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "Connection Error",
        description: "WebSocket not connected. Please wait for connection or refresh the page.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Send audio for processing
      websocketRef.current.send(JSON.stringify({
        type: 'process_voice',
        audioBlob: await blobToBase64(audioBlob),
        timestamp: Date.now()
      }));

      console.log('🚀 Voice submitted for streaming processing');
    } catch (error) {
      console.error('Error sending voice:', error);
      toast({
        title: "Send Error",
        description: "Failed to send voice message. Please try again.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  }, [toast]);

  // Send text message with streaming
  const sendOptimizedTextMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    // Check WebSocket connection state
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready for text message. State:', websocketRef.current?.readyState);
      toast({
        title: "Connection Error",
        description: "WebSocket not connected. Please wait for connection or refresh the page.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    startPerformanceTimer('t_start');

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    try {
      // Send text for processing
      websocketRef.current.send(JSON.stringify({
        type: 'process_text',
        text: message,
        timestamp: Date.now()
      }));

      console.log('📝 Text message sent for streaming processing');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Send Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  }, [startPerformanceTimer, toast]);

  // Audio playback with performance tracking
  const playAudio = useCallback((audioUrl: string) => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const audio = new Audio(audioUrl);
    audio.onplay = () => {
      setIsPlaying(true);
      setCurrentAudio(audio);
      startPerformanceTimer('t_play_start');
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentAudio(null);
      endPerformanceTimer('t_play_start');
    };

    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      toast({
        title: "Audio Playback Error",
        description: "Could not play audio response.",
        variant: "destructive"
      });
    });
  }, [currentAudio, startPerformanceTimer, endPerformanceTimer, toast]);

  // Stop audio
  const stopAudio = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
      setCurrentAudio(null);
    }
  }, [currentAudio]);

  // Error handling
  const handleError = useCallback((error: string) => {
    console.error('Streaming voice error:', error);
    toast({
      title: "Processing Error",
      description: error,
      variant: "destructive"
    });
    setIsProcessing(false);
  }, [toast]);

  // Utility function
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Quick actions for testing
  const quickActions: QuickAction[] = [
    { label: "Inventory Query", message: "What cars do you have in stock?" },
    { label: "Pricing Info", message: "What are your current prices?" },
    { label: "Financing", message: "Do you offer financing options?" },
    { label: "Test Drive", message: "Can I schedule a test drive?" }
  ];

  const handleQuickAction = useCallback((action: QuickAction) => {
    sendOptimizedTextMessage(action.message);
  }, [sendOptimizedTextMessage]);

  // Performance mode toggle
  const togglePerformanceMode = useCallback(() => {
    setPerformanceMode(!performanceMode);
    toast({
      title: "Performance Mode",
      description: `Performance mode ${!performanceMode ? 'enabled' : 'disabled'}`,
    });
  }, [performanceMode, toast]);

  // Initialize on mount
  useEffect(() => {
    // If we have a hash parameter, fetch dealer info from it
    if (hash) {
      // Clear any previous sessions when accessing via QR code
      clearPreviousSessions();
      
      const stockNumber = searchParams.get('stk');
      fetchDealerFromHash(hash, stockNumber || undefined).then((dealerData) => {
        if (dealerData) {
          // Create a restricted session for QR code access
          createRestrictedSession(dealerData.id, stockNumber || undefined);
          initializeWebSocket();
        }
      });
    } else if (dealerId) {
      initializeWebSocket();
      
      // Add welcome message for QR code access via URL params
      if (urlDealerId && urlDealerName) {
        const welcomeMessage: Message = {
          role: 'assistant',
          content: `Welcome to ${urlDealerName}! I'm D.A.I.V.E, your AI assistant. I'm here to help you with any questions about our vehicles, financing, or services. How can I assist you today?${urlStockNumber ? `\n\nI see you're interested in stock #${urlStockNumber}. I can provide detailed information about this vehicle and help you with the next steps.` : ''}`,
          timestamp: new Date().toISOString()
        };
        setMessages([welcomeMessage]);
      }
    }

    return () => {
      if (websocketRef.current) {
        console.log('🧹 Cleaning up WebSocket on component unmount');
        websocketRef.current.close();
        websocketRef.current = null;
      }
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, [dealerId, initializeWebSocket, currentAudio, urlDealerId, urlDealerName, urlStockNumber, hash, searchParams]);

  // Show quick auth modal for QR code access without valid session
  useEffect(() => {
    if (hash && !hash.includes('-') && !hasValidSession && !loadingDealer) {
      setShowQuickAuth(true);
    } else if (hasValidSession || isCustomerAuthenticated) {
      // Hide modal if user becomes authenticated
      setShowQuickAuth(false);
    }
  }, [hash, hasValidSession, loadingDealer, isCustomerAuthenticated]);

  // Force close modal when user becomes authenticated
  useEffect(() => {
    if ((hasValidSession || isCustomerAuthenticated) && showQuickAuth) {
      setShowQuickAuth(false);
    }
  }, [hasValidSession, isCustomerAuthenticated, showQuickAuth]);

  // Auto-scroll to bottom
  useEffect(() => {
    const messagesEnd = document.getElementById('messages-end');
    messagesEnd?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-muted p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Loading...</h2>
        </div>
      </div>
    );
  }

  // Show authentication required message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-muted p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">Authentication Required</strong>
            <br />
            <span className="text-sm">Please log in to access the Optimized AIBot</span>
          </div>
          <a 
            href="/auth" 
            className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-4 rounded"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // Show dealer ID required message if no dealer ID
  if (!dealerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-muted p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">Dealer Profile Required</strong>
            <br />
            <span className="text-sm">Please complete your dealer profile to access the Optimized AIBot</span>
          </div>
          <a 
            href="/profile" 
            className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-4 rounded"
          >
            Complete Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-muted p-4">
      <div className="max-w-6xl mx-auto">
        {/* Development Mode Banner */}
        {isDevelopmentMode && (
          <Card className="mb-6 bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <Settings className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-orange-800">Under Development</h3>
                    <p className="text-sm text-orange-700">
                      D.A.I.V.E AI Bot is currently in development phase. 
                      <br />
                      <span className="font-medium">Coming Soon!</span> Full functionality will be available shortly.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header with Performance Mode */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Zap className="h-8 w-8 text-yellow-500" />
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Optimized AI Voice Bot
              </CardTitle>
              <Zap className="h-8 w-8 text-yellow-500" />
            </div>
            <CardDescription className="text-lg">
              Ultra-fast streaming voice pipeline • Target: 2-4 second response
            </CardDescription>
            
            {/* Performance Controls */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <Button
                onClick={togglePerformanceMode}
                variant={performanceMode ? "default" : "secondary"}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                {performanceMode ? "Performance Mode ON" : "Performance Mode OFF"}
              </Button>
              
              <Button
                onClick={() => setShowPerformanceDashboard(!showPerformanceDashboard)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Performance Dashboard
              </Button>
            </div>

                         {/* Connection Status */}
             <div className="flex items-center justify-center gap-2 mt-2">
               <div className={`w-3 h-3 rounded-full ${
                 connectionStatus === 'connected' ? 'bg-green-500' :
                 connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
               }`} />
               <span className={`text-sm ${
                 connectionStatus === 'connected' ? 'text-green-600' :
                 connectionStatus === 'connecting' ? 'text-yellow-600' : 'text-red-600'
               } font-medium`}>
                 {connectionStatus === 'connected' ? '🚀 Streaming Connected' :
                  connectionStatus === 'connecting' ? '⏳ Connecting...' : '❌ Disconnected'}
               </span>
             </div>
             
             {/* Connection Details */}
             <div className="text-xs text-gray-500 text-center mt-1">
               Port: {import.meta.env.VITE_BACKEND_PORT || '3000'} | 
               Protocol: {window.location.protocol === 'https:' ? 'WSS' : 'WS'}
             </div>
             
             {/* Connection Warning */}
             {connectionStatus !== 'connected' && (
               <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                 <p className="text-xs text-yellow-700 text-center mb-2">
                   {connectionStatus === 'connecting' 
                     ? 'Please wait for WebSocket connection to establish...' 
                     : 'WebSocket disconnected. Please refresh the page to reconnect.'}
                 </p>
                                   {connectionStatus === 'disconnected' && (
                    <div className="flex justify-center gap-2">
                                             <Button
                         onClick={reconnectWebSocket}
                         size="sm"
                         variant="outline"
                         className="text-xs"
                       >
                         🔄 Reconnect
                       </Button>
                                             <Button
                         onClick={reconnectWebSocket}
                         size="sm"
                         variant="outline"
                         className="text-xs"
                       >
                         🔄 Reconnect
                       </Button>
                      <Button
                        onClick={async () => {
                          try {
                            const backendPort = import.meta.env.VITE_BACKEND_PORT || '3000';
                            const response = await fetch(`http://localhost:${backendPort}/websocket-status`);
                            const status = await response.json();
                            console.log('Server Status:', status);
                            toast({
                              title: "Server Status",
                              description: `WebSocket: ${status.websocket?.streamingVoice || 'unknown'}`,
                            });
                          } catch (error) {
                            console.error('Server status check failed:', error);
                            toast({
                              title: "Server Unreachable",
                              description: `Cannot connect to server on port ${import.meta.env.VITE_BACKEND_PORT || '3000'}`,
                              variant: "destructive"
                            });
                          }
                        }}
                        size="sm"
                        variant="outline"
                        className="text-xs"
                      >
                        🔍 Check Server
                      </Button>
                    </div>
                  )}
               </div>
             )}
            
            {/* Dealer ID Display */}
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-xs text-gray-500">Dealer ID:</span>
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                {dealerId}
              </span>
            </div>
          </CardHeader>
        </Card>

        {/* Performance Dashboard */}
        {showPerformanceDashboard && (
          <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Real-time Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceDashboard dealerId={dealerId} />
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        {!isDevelopmentMode && (
        <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Test the optimized pipeline with common queries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickActions.map((action, index) => (
                                 <Button
                   key={index}
                   onClick={() => handleQuickAction(action)}
                   variant="outline"
                   className="h-auto p-3 flex flex-col items-center gap-2 text-sm"
                   disabled={isProcessing || connectionStatus !== 'connected'}
                 >
                   <span>{action.label}</span>
                 </Button>
              ))}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Chat Interface */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Streaming Voice Chat
            </CardTitle>
            <CardDescription>
              Real-time streaming with performance tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Messages */}
            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <div className="text-sm">{message.content}</div>
                    {message.transcription && message.transcription !== message.content && (
                      <div className="text-xs opacity-75 mt-1">
                        Heard: "{message.transcription}"
                      </div>
                    )}
                    {message.performanceMetrics && (
                      <div className="text-xs opacity-75 mt-1">
                        Response: {message.performanceMetrics.t_end}ms
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div id="messages-end" />
            </div>

                         {/* Input Controls */}
             {isDevelopmentMode ? (
               <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                 <div className="text-center">
                   <Settings className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                   <p className="text-sm text-gray-500 font-medium">Input disabled during development</p>
                   <p className="text-xs text-gray-400">Full functionality coming soon!</p>
                 </div>
               </div>
             ) : (
             <div className="flex gap-3">
               <Input
                 value={inputMessage}
                 onChange={(e) => setInputMessage(e.target.value)}
                 placeholder={connectionStatus === 'connected' ? "Type your message..." : "Waiting for connection..."}
                 onKeyPress={(e) => e.key === 'Enter' && sendOptimizedTextMessage(inputMessage)}
                 disabled={isProcessing || connectionStatus !== 'connected'}
                 className="flex-1"
               />
               
               <Button
                 onClick={() => sendOptimizedTextMessage(inputMessage)}
                 disabled={!inputMessage.trim() || isProcessing || connectionStatus !== 'connected'}
                 className="px-6"
               >
                 <Send className="h-4 w-4" />
               </Button>
               
               <Button
                 onClick={isRecording ? stopOptimizedRecording : startOptimizedRecording}
                 variant={isRecording ? "destructive" : "default"}
                 disabled={isProcessing || connectionStatus !== 'connected'}
                 className="px-6"
               >
                 {isRecording ? (
                   <>
                     <MicOff className="h-4 w-4" />
                     Stop
                   </>
                 ) : (
                   <>
                     <Mic className="h-4 w-4" />
                     Record
                   </>
                 )}
               </Button>
             </div>
             )}

            {/* Status Indicators */}
            <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-600">
              {isRecording && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Recording...
                </div>
              )}
              {isProcessing && (
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              )}
              {isPlaying && (
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Playing audio...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics Summary */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {performanceMetrics.lastResponseTime}ms
                </div>
                <div className="text-sm text-gray-600">Last Response</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {performanceMetrics.totalSessions}
                </div>
                <div className="text-sm text-gray-600">Total Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {performanceMetrics.averageResponseTime}ms
                </div>
                <div className="text-sm text-gray-600">Avg Response</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {performanceMetrics.cacheHitRate}%
                </div>
                <div className="text-sm text-gray-600">Cache Hit Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Auth Modal for QR Code Access */}
      {!hasValidSession && !isCustomerAuthenticated && (
        <QuickAuthModal
          isOpen={showQuickAuth}
          onClose={handleQuickAuthClose}
          onSuccess={handleQuickAuthSuccess}
          dealerData={dealerInfo ? {
            id: dealerInfo.id,
            business_name: dealerInfo.business_name,
            contact_name: dealerInfo.business_name
          } : undefined}
          qrHash={hash}
        />
      )}
    </div>
  );
};

export default OptimizedAIBotPage;

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Mic, MicOff, Loader2, Send, Volume2, VolumeX, Play, Square } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  transcription?: string;
  audioUrl?: string;
}

interface QuickAction {
  label: string;
  message: string;
  icon?: string;
}

interface AIBotPageProps {
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

const AIBotPage: React.FC<AIBotPageProps> = ({ 
  vehicleId,
  dealerId,
  vehicleInfo,
  onLeadGenerated
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Quick action buttons for common questions
  const quickActions: QuickAction[] = vehicleId ? [
    { label: 'Family Features', message: 'I want an ideal car for my family' },
    { label: 'Safety Info', message: 'What safety features does this vehicle have?' },
    { label: 'Pricing', message: 'What is the price and financing options?' },
    { label: 'Test Drive', message: 'Can I schedule a test drive?' },
    { label: 'Fuel Economy', message: 'What are the fuel efficiency ratings?' },
    { label: 'Cargo Space', message: 'How much cargo space does it have?' },
    { label: 'Similar Options', message: 'Show me similar vehicles' }
  ] : [
    { label: 'Show Inventory', message: 'What vehicles do you have available?' },
    { label: 'Family Cars', message: 'I need a family-friendly vehicle' },
    { label: 'Financing', message: 'What financing options do you offer?' },
    { label: 'Test Drive', message: 'Can I schedule a test drive?' },
    { label: 'SUV Options', message: 'Show me your SUV selection' },
    { label: 'Sedan Options', message: 'Show me your sedan selection' },
    { label: 'New Arrivals', message: 'What new vehicles just arrived?' }
  ];

  const handleQuickAction = (action: QuickAction) => {
    sendTextMessage(action.message);
    setShowQuickActions(false); // Hide quick actions after first use
  };

  // Generate session ID on component mount
  useEffect(() => {
    if (!dealerId) {
      console.error('❌ No dealer ID provided to AIBotPage');
      return;
    }

    const newSessionId = `aibot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    
    // Send initial greeting
    sendInitialGreeting();
  }, [dealerId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendInitialGreeting = async () => {
    let greeting;
    if (vehicleInfo && vehicleId) {
      greeting = `Hi, I'm D.A.I.V.E.! This ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model} is a great choice. What would you like to know?`;
    } else {
      // Fetch dealer inventory to provide more specific greeting
      try {
        const inventoryResponse = await fetch(`http://localhost:3000/api/vehicles?dealerId=${dealerId}&limit=5`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || 'public'}`
          }
        });
        
        if (inventoryResponse.ok) {
          const inventoryData = await inventoryResponse.json();
          const vehicles = inventoryData.data || [];
          
          if (vehicles.length > 0) {
            const vehicleTypes = [...new Set(vehicles.map(v => v.make))];
            const vehicleCount = vehicles.length;
            
            if (vehicleTypes.length === 1) {
              greeting = `Hi, I'm D.A.I.V.E.! I can help you find the perfect ${vehicleTypes[0]} from our inventory of ${vehicleCount} vehicles. What are you looking for today?`;
            } else {
              greeting = `Hi, I'm D.A.I.V.E.! I can help you find the perfect vehicle from our inventory of ${vehicleCount} vehicles including ${vehicleTypes.slice(0, 3).join(', ')}. What are you looking for today?`;
            }
          } else {
            greeting = `Hi, I'm D.A.I.V.E.! I can help you find the perfect vehicle from our inventory. What are you looking for today?`;
          }
        } else {
          greeting = `Hi, I'm D.A.I.V.E.! I can help you find the perfect vehicle from our inventory. What are you looking for today?`;
        }
      } catch (error) {
        console.log('Could not fetch inventory for greeting:', error);
        greeting = `Hi, I'm D.A.I.V.E.! I can help you find the perfect vehicle from our inventory. What are you looking for today?`;
      }
    }
    
    setMessages([{
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString()
    }]);
  };

  // Check API settings on component mount
  useEffect(() => {
    const checkApiSettings = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/daive/api-settings?dealerId=${dealerId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || 'public'}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const settings = data.data;
          
          // Check if speech provider is configured
          const speechProvider = settings.speech_provider?.value;
          const hasOpenAI = settings.openai_key?.value;
          const hasDeepgram = settings.deepgram_key?.value;
          
          if (speechProvider === 'deepgram' && !hasDeepgram) {
            toast.warning('Deepgram API key not configured. Voice recognition may not work.');
          } else if (speechProvider === 'whisper' && !hasOpenAI) {
            toast.warning('OpenAI API key not configured. Voice recognition may not work.');
          } else if (!speechProvider) {
            toast.info('Speech provider not configured. Using default settings.');
          }
        }
      } catch (error) {
        console.log('Could not check API settings:', error);
      }
    };

    checkApiSettings();
  }, [dealerId]);

  // Initialize media recorder when component mounts
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
        
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm') 
            ? 'audio/webm' 
            : 'audio/wav'
        });
        
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
            console.log(`🛑 Recording stopped. Audio size: ${(blob.size / 1024).toFixed(2)} KB`);
            console.log('🎵 Audio blob created:', { size: blob.size, type: blob.type });
            handleVoiceSubmission(blob);
          } else {
            console.log('❌ No audio chunks received');
            toast.error('No audio recorded. Please try again.');
          }
        };
        
        recorder.onerror = (event) => {
          console.error('MediaRecorder error:', event);
          toast.error('Failed to record audio. Please try again.');
          setIsRecording(false);
        };
        
        mediaRecorderRef.current = recorder;
      } catch (error) {
        console.error('Error accessing microphone:', error);
        toast.error('Please allow microphone access to use voice features.');
      }
    };

    initializeMediaRecorder();

    // Make handleVehicleAction available globally for HTML button onclick handlers
    (window as any).handleVehicleAction = handleVehicleAction;

    // Cleanup function
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Clean up global function
      delete (window as any).handleVehicleAction;
    };
  }, []);

  const startRecording = () => {
    if (!mediaRecorderRef.current) {
      toast.error('Microphone not initialized. Please refresh the page.');
      return;
    }

    try {
      setAudioChunks([]);
      setAudioBlob(null);
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      console.log('🎤 Recording started');
      toast.success('🎤 Recording started. Speak clearly into your microphone.');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    try {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      console.log('🛑 Recording stopped, processing audio...');
      toast.info('🔄 Processing audio...');
    } catch (error) {
      console.error('Error stopping recording:', error);
      toast.error('Failed to stop recording. Please try again.');
    }
  };

  const handleVoiceSubmission = async (audioBlob: Blob) => {
    console.log('🎵 Processing voice submission:', {
      size: (audioBlob.size / 1024).toFixed(2) + ' KB',
      type: audioBlob.type
    });
    
    setIsProcessing(true);
    
    try {
      // Send to backend
      await sendVoiceToBackend(audioBlob);
      
      // Clear audio chunks after successful submission
      setAudioChunks([]);
      setAudioBlob(null);
      audioChunksRef.current = [];
      
    } catch (error) {
      console.error('Error processing voice:', error);
      toast.error('Failed to process your voice message. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const sendVoiceToBackend = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-test.wav');
      formData.append('vehicleId', vehicleId || '');
      formData.append('sessionId', sessionId);
      formData.append('customerInfo', JSON.stringify({
        name: 'Customer',
        email: 'customer@dealership.com',
        dealerId: dealerId
      }));

      console.log('📤 Sending voice data to backend:', {
        size: (audioBlob.size / 1024).toFixed(2) + ' KB',
        vehicleId: vehicleId || 'null',
        sessionId,
        dealerId,
        url: 'http://localhost:3000/api/daive/voice'
      });

      const response = await fetch('http://localhost:3000/api/daive/voice', {
        method: 'POST',
        body: formData
      });

      console.log('📥 Voice response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        
        // Handle specific error cases
        if (response.status === 400) {
          toast.error('Voice recognition not configured. Please check API settings.');
          return;
        } else if (response.status === 401) {
          toast.error('Authentication required. Please log in.');
          return;
        } else if (response.status === 403) {
          toast.error('Access denied. Please check permissions.');
          return;
        } else if (response.status === 500) {
          toast.error('Server error. Please try again later.');
          return;
        }
        
        throw new Error(`Voice API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📥 Voice response data:', data);
      
      if (data.success) {
        const transcription = data.data?.transcription || '';
        const aiResponse = data.data?.response || '';
        const leadScore = data.data?.leadScore || 0;
        const audioResponseUrl = data.data?.audioResponseUrl;

        console.log('✅ Voice API response received successfully');
        console.log('📝 Transcription:', transcription);
        console.log('🤖 AI Response:', aiResponse.substring(0, 100) + '...');
        console.log('📊 Lead Score:', leadScore);
        console.log('🔊 Audio Response:', audioResponseUrl ? 'Generated' : 'None');

        // Check if transcription was successful
        if (transcription && 
            transcription !== "Sorry, I couldn't understand your voice. Please try again.") {
          
          // Add user message (transcription)
          const userMessage: Message = {
            role: 'user',
            content: transcription,
            transcription: transcription,
            timestamp: new Date().toISOString()
          };

          // Add assistant response
          const assistantMessage: Message = {
            role: 'assistant',
            content: aiResponse,
            audioUrl: audioResponseUrl,
            timestamp: new Date().toISOString()
          };

          setMessages(prev => [...prev, userMessage, assistantMessage]);

          // Play audio response if available
          if (audioResponseUrl) {
            try {
              const audio = new Audio(`http://localhost:3000${audioResponseUrl}`);
              audio.crossOrigin = 'anonymous'; // Enable CORS for audio
              audio.preload = 'auto';
              
              audio.addEventListener('canplaythrough', () => {
                console.log('🎵 Audio loaded successfully, playing...');
                audio.play().catch(err => {
                  console.log('Could not play audio response:', err);
                });
              });
              
              audio.addEventListener('error', (e) => {
                console.error('❌ Audio loading error:', e);
              });
              
              audio.load(); // Start loading the audio
            } catch (err) {
              console.log('Could not create audio element:', err);
            }
          }

          // Check if lead was generated
          if (leadScore > 50) {
            onLeadGenerated?.(data.data);
            toast.success(`Lead generated! Score: ${leadScore}%`);
          }

          // Check if handoff is needed
          if (data.data?.shouldHandoff) {
            toast.info('Connecting you to a human sales representative...');
          }

          toast.success('Voice message processed successfully!');
          console.log('🎉 Voice recognition successful!');
        } else {
          console.warn('⚠️ Voice recognition failed - try speaking more clearly');
          toast.warning('I couldn\'t understand your voice. Please try speaking more clearly or use text input.');
        }
      } else {
        throw new Error(data.error || 'Failed to process voice message');
      }
    } catch (error) {
      console.error('Error sending voice to backend:', error);
      toast.error('Failed to process voice message. Please try again.');
    }
  };

  const sendTextMessage = async (message: string) => {
    if (!message.trim()) return;

    console.log('📝 Sending text message:', message);

    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsProcessing(true);

    try {
      const payload = {
        vehicleId: vehicleId || null,
        sessionId,
        message,
        customerInfo: {
          name: 'Customer',
          email: 'customer@dealership.com',
          dealerId: dealerId
        }
      };

      console.log('📤 Sending text request to backend:', {
        vehicleId: vehicleId || 'null',
        sessionId,
        message: message.substring(0, 50) + '...',
        dealerId: dealerId || 'NOT PROVIDED'
      });

      const response = await fetch('http://localhost:3000/api/daive/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        
        // Handle specific error cases for text messages
        if (response.status === 400) {
          toast.error('Invalid request. Please check your message.');
          return;
        } else if (response.status === 401) {
          toast.error('Authentication required. Please log in.');
          return;
        } else if (response.status === 403) {
          toast.error('Access denied. Please check permissions.');
          return;
        } else if (response.status === 500) {
          toast.error('Server error. Please try again later.');
          return;
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('📥 Response data:', data);

      if (data.success) {
        console.log('✅ Text chat successful');
        console.log('🤖 AI Response:', data.data.response?.substring(0, 100) + '...');
        console.log('📊 Lead Score:', data.data.leadScore);
        console.log('🔄 Should Handoff:', data.data.shouldHandoff);

        const assistantMessage: Message = {
          role: 'assistant',
          content: data.data.response,
          audioUrl: data.data.audioResponseUrl,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Check if lead was generated
        if (data.data.leadScore > 50) {
          onLeadGenerated?.(data.data);
          toast.success(`Lead generated! Score: ${data.data.leadScore}%`);
        }

        // Check if handoff is needed
        if (data.data.shouldHandoff) {
          toast.info('Connecting you to a human sales representative...');
        }

        // Show lead score in console for debugging
        console.log(`Lead Score: ${data.data.leadScore}%, Handoff: ${data.data.shouldHandoff}`);
      } else {
        console.error('❌ Text chat failed:', data.error);
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
      
      // Remove the user message if it failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProcessing && inputMessage.trim()) {
      sendTextMessage(inputMessage);
    }
  };

  const toggleVoiceMode = () => {
    setIsVoiceEnabled(!isVoiceEnabled);
    if (!isVoiceEnabled) {
      toast.info('Voice mode enabled. Click the microphone to record.');
    }
  };

  const playAudio = (audioUrl: string) => {
    if (audioRef.current) {
      try {
        audioRef.current.crossOrigin = 'anonymous'; // Enable CORS for audio
        audioRef.current.preload = 'auto';
        audioRef.current.src = `http://localhost:3000${audioUrl}`;
        
        audioRef.current.addEventListener('canplaythrough', () => {
          console.log('🎵 Audio loaded successfully, playing...');
          audioRef.current?.play().catch(err => {
            console.log('Could not play audio:', err);
          });
        });
        
        audioRef.current.addEventListener('error', (e) => {
          console.error('❌ Audio loading error:', e);
          setIsPlaying(false);
        });
        
        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
        });
        
        audioRef.current.addEventListener('play', () => {
          setIsPlaying(true);
        });
        
        audioRef.current.load(); // Start loading the audio
      } catch (err) {
        console.log('Could not create audio element:', err);
      }
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleVehicleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const vehicleItem = target.closest('.vehicle-compact-card');
    
    if (vehicleItem) {
      const vehicleId = vehicleItem.getAttribute('data-vehicle-id');
      const vehicleName = vehicleItem.querySelector('.vehicle-compact-name')?.textContent?.replace('🚗 ', '') || 'this vehicle';
      
      if (vehicleId) {
        // Send a message asking for more details about the clicked vehicle
        const message = `Tell me more about the ${vehicleName}`;
        sendTextMessage(message);
        
        // Show a toast to indicate the action
        toast.success(`Getting details about the ${vehicleName}...`);
      }
    }
  };

  // Handle vehicle action buttons (test drive, contact sales)
  const handleVehicleAction = (vehicleId: string, action: string) => {
    // Find the vehicle name from the DOM
    const vehicleCard = document.querySelector(`[data-vehicle-id="${vehicleId}"]`);
    const vehicleName = vehicleCard?.querySelector('.vehicle-compact-name')?.textContent?.replace('🚗 ', '') || 'this vehicle';
    
    let message = '';
    let toastMessage = '';
    
    if (action === 'test-drive') {
      message = `I would like to schedule a test drive for the ${vehicleName}. What times are available?`;
      toastMessage = `Scheduling test drive for ${vehicleName}...`;
    } else if (action === 'contact-sales') {
      message = `I would like to speak with a sales representative about the ${vehicleName}. Can you help me get in touch?`;
      toastMessage = `Connecting you with sales about ${vehicleName}...`;
    }
    
    if (message) {
      sendTextMessage(message);
      toast.success(toastMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="w-full h-[80vh] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">D</span>
              </div>
              D.A.I.V.E. AI Bot
                             <Badge variant="secondary" className="ml-auto">
                 {vehicleInfo ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}` : 'Dealer Inventory'}
               </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {message.content.includes('<div class="inventory-grid">') || message.content.includes('<ul class="inventory-list">') ? (
                        <div 
                          className="text-sm max-w-full"
                          dangerouslySetInnerHTML={{ __html: message.content }}
                          onClick={(e) => handleVehicleClick(e)}
                        />
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                      {message.transcription && (
                        <p className="text-xs opacity-70 mt-1">
                          <em>Transcribed: "{message.transcription}"</em>
                        </p>
                      )}
                      {message.audioUrl && (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => isPlaying ? stopAudio() : playAudio(message.audioUrl!)}
                            className="h-6 px-2"
                          >
                            {isPlaying ? (
                              <Square className="h-3 w-3" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                            <span className="ml-1 text-xs">
                              {isPlaying ? 'Stop' : 'Play'} Audio
                            </span>
                          </Button>
                        </div>
                      )}
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-3 py-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Quick Action Buttons */}
            {showQuickActions && messages.length <= 1 && (
              <div className="p-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Quick questions:</p>
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickAction(action)}
                      className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
                      disabled={isProcessing}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  disabled={isProcessing}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={toggleVoiceMode}
                  className={isVoiceEnabled ? 'bg-blue-50 border-blue-200' : ''}
                  disabled={isProcessing}
                >
                  {isVoiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                {isVoiceEnabled && (
                  <Button
                    type="button"
                    onClick={handleClick}
                    disabled={isProcessing}
                    variant={isRecording ? "destructive" : "outline"}
                    size="icon"
                    className="relative"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isRecording ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                    {isRecording && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </Button>
                )}
                <Button
                  type="submit"
                  size="icon"
                  disabled={isProcessing || !inputMessage.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Hidden audio element for playing responses */}
        <audio ref={audioRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default AIBotPage; 
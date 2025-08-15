import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Mic, MicOff, Loader2, Send, Volume2, VolumeX, Play, Square, Users, Database } from 'lucide-react';
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
  
  // Helper function to validate and sanitize messages
  const validateMessage = (message: Message): Message => {
    return {
      role: message.role || 'assistant',
      content: message.content || 'No content available',
      timestamp: message.timestamp || new Date().toISOString(),
      transcription: message.transcription,
      audioUrl: message.audioUrl
    };
  };
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [useCrewAI, setUseCrewAI] = useState(false);
  const [crewAIEnabled, setCrewAIEnabled] = useState(false);
  const [crewType, setCrewType] = useState<string>('N/A');
  const [backendStatus, setBackendStatus] = useState<string>('Unknown');
  const [isInventoryQuerying, setIsInventoryQuerying] = useState(false);
  const [lastQueryTime, setLastQueryTime] = useState<number | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Quick action buttons for common questions
  // ENHANCED: These messages are now more conversational and detailed to trigger CrewAI responses
  // instead of simple inventory queries. CrewAI can provide comprehensive, helpful answers.
  const quickActions: QuickAction[] = vehicleId ? [
    { label: 'Family Features', message: 'I\'m considering this vehicle for my family. Can you tell me about the safety features, seating capacity, cargo space, and any family-friendly features that make this a good choice for families with children?' },
    { label: 'Safety Info', message: 'Safety is my top priority. What safety features, ratings, and technologies does this vehicle have? I\'d like to know about airbags, collision prevention, backup cameras, and any advanced safety systems.' },
    { label: 'Pricing', message: 'I\'d like to understand the complete pricing picture for this vehicle. What\'s the base price, what options are available, what financing terms do you offer, and are there any current promotions or incentives I should know about?' },
    { label: 'Test Drive', message: 'I\'m very interested in this vehicle and would like to schedule a test drive. What\'s the process, what documents do I need to bring, how long does it take, and what should I focus on during the test drive to make the best decision?' },
    { label: 'Fuel Economy', message: 'Fuel efficiency is important to me. What are the EPA ratings for city and highway driving, what\'s the real-world fuel economy like, and are there any eco-friendly features or driving modes that can help improve efficiency?' },
    { label: 'Cargo Space', message: 'I need to know about the cargo and storage capacity. How much space is there behind the rear seats, what\'s the total cargo volume, are the seats foldable, and how does this compare to other vehicles in the same class?' },
    { label: 'Similar Options', message: 'I\'d like to see what other similar vehicles you have available. Can you show me alternatives that might be a better fit, what makes each one different, and help me compare features and pricing across your inventory?' }
  ] : [
    { label: 'Show Inventory', message: 'I\'m interested in seeing what vehicles you have available. Can you tell me about your current inventory and help me find something that fits my needs?' },
    { label: 'Family Cars', message: 'I\'m looking for a family-friendly vehicle that\'s safe, spacious, and reliable. What would you recommend from your inventory for a family with children?' },
    { label: 'Financing', message: 'I\'d like to learn more about your financing options. What kind of payment plans, interest rates, and down payment requirements do you offer for vehicle purchases?' },
    { label: 'Test Drive', message: 'I\'m interested in scheduling a test drive. What\'s the process like, what documents do I need, and what times are typically available for test drives?' },
    { label: 'SUV Options', message: 'I\'m considering an SUV for better visibility and cargo space. Can you tell me about the different SUV models you carry, their features, and what makes each one special?' },
    { label: 'Sedan Options', message: 'I\'m looking for a sedan that\'s comfortable for daily commuting and has good fuel efficiency. What sedan models do you recommend and what are their key features?' },
    { label: 'New Arrivals', message: 'I\'d love to hear about any new vehicles that just arrived at your dealership. What\'s new, what makes them special, and are there any special offers on these new arrivals?' }
  ];

  const handleQuickAction = (action: QuickAction) => {
    // Always use the regular text message flow to let the backend decide
    // whether to use inventory-aware responses or CrewAI
    console.log('🚀 Using regular message flow for quick action:', action.label);
    sendTextMessage(action.message);
    setShowQuickActions(false); // Hide quick actions after first use
  };

  const refreshGreeting = () => {
    console.log('🔄 Refreshing greeting...');
    sendInitialGreeting();
  };

  const clearCacheAndRefresh = async () => {
    console.log('🧹 Clearing cache and refreshing...');
    
    try {
      // Call backend cache clearing endpoint
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        const response = await fetch('http://localhost:3000/api/daive/clear-cache', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Backend cache cleared:', result);
        } else {
          console.log('⚠️ Could not clear backend cache');
        }
      }
      
      // Clear any stored session data
      setSessionId(`daive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      
      // Clear messages and restart
      setMessages([]);
      
      // Force refresh by calling sendInitialGreeting
      setTimeout(() => {
        sendInitialGreeting();
      }, 100);
      
      toast.success('Cache cleared and refreshed!');
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Failed to clear cache');
    }
  };

  const checkCurrentDealerContext = () => {
    console.log('🔍 Current Dealer Context Check:');
    console.log('  - dealerId prop:', dealerId);
    console.log('  - dealerId type:', typeof dealerId);
    console.log('  - dealerId length:', dealerId?.length);
    console.log('  - sessionId:', sessionId);
    console.log('  - messages count:', messages.length);
    
    // Check localStorage for any cached dealer info
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      try {
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        console.log('  - JWT payload:', payload);
        console.log('  - JWT dealer_id:', payload.dealer_id);
        console.log('  - JWT dealerId:', payload.dealerId);
      } catch (error) {
        console.log('  - Could not parse JWT token');
      }
    }
    
    toast.info('Dealer context logged to console');
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
  
  // Debug messages
  useEffect(() => {
    console.log('🔍 Current messages:', messages);
    if (messages.some(msg => !msg.content)) {
      console.warn('⚠️ Found message without content:', messages.filter(msg => !msg.content));
    }
  }, [messages]);

  const sendInitialGreeting = async () => {
    let greeting;
    let dealerInfo = null;
    
    try {
      // First, get dealer info to replace placeholders
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        try {
          const dealerResponse = await fetch('http://localhost:3000/api/dealers/profile', {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          
          if (dealerResponse.ok) {
            dealerInfo = await dealerResponse.json();
            console.log('✅ Dealer info loaded for greeting:', dealerInfo);
          }
        } catch (error) {
          console.log('⚠️ Could not fetch dealer info:', error);
        }
      }
      
      // Then, try to get centralized database prompts
      let prompts: Record<string, string> = {};
      
      // Try public prompts first
      try {
        const promptsResponse = await fetch(`http://localhost:3000/api/daive/prompts/public?dealerId=${dealerId}`);
        
        if (promptsResponse.ok) {
          const promptsData = await promptsResponse.json();
          prompts = promptsData.data || {};
          
          console.log('🔍 Public prompts response:', promptsData);
          console.log('🔍 Available prompts:', Object.keys(prompts));
          console.log('🔍 Greeting prompt:', prompts.greeting);
        }
      } catch (error) {
        console.log('⚠️ Could not fetch public prompts:', error);
      }
      
      // If no greeting from public prompts, try authenticated prompts
      if (!prompts.greeting && authToken) {
        try {
          console.log('🔄 Trying authenticated prompts endpoint...');
          const authPromptsResponse = await fetch('http://localhost:3000/api/daive/prompts', {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          
          if (authPromptsResponse.ok) {
            const authPromptsData = await authPromptsResponse.json();
            if (authPromptsData.success && authPromptsData.data.greeting?.text) {
              prompts.greeting = authPromptsData.data.greeting.text;
              console.log('✅ Got greeting from authenticated endpoint:', prompts.greeting);
            }
          }
        } catch (error) {
          console.log('⚠️ Could not fetch authenticated prompts:', error);
        }
      }
      
      // Use database greeting prompt if available
      if (prompts.greeting) {
        console.log('✅ Using database greeting prompt');
        greeting = prompts.greeting;
        
        // Replace placeholders in the greeting
        if (dealerInfo) {
          const dealershipName = dealerInfo.business_name || dealerInfo.name || 'our dealership';
          greeting = greeting
            .replace('{dealership_name}', dealershipName)
            .replace('{vehicle_year}', vehicleInfo?.year?.toString() || '')
            .replace('{vehicle_make}', vehicleInfo?.make || '')
            .replace('{vehicle_model}', vehicleInfo?.model || '');
          
          console.log('✅ Greeting with placeholders replaced:', {
            original: prompts.greeting,
            processed: greeting,
            dealershipName
          });
        }
      } else if (prompts.master_prompt) {
        // Extract greeting from master prompt if specific greeting not available
        console.log('✅ Using greeting from master prompt');
        const masterPrompt = prompts.master_prompt;
        if (masterPrompt.includes('GREETING:')) {
          const greetingMatch = masterPrompt.match(/GREETING:\s*"([^"]+)"/);
          if (greetingMatch) {
            greeting = greetingMatch[1];
            
            // Replace placeholders in the master prompt greeting too
            if (dealerInfo) {
              const dealershipName = dealerInfo.business_name || dealerInfo.name || 'our dealership';
              greeting = greeting
                .replace('{dealership_name}', dealershipName)
                .replace('{vehicle_year}', vehicleInfo?.year?.toString() || '')
                .replace('{vehicle_make}', vehicleInfo?.make || '')
                .replace('{vehicle_model}', vehicleInfo?.model || '');
            }
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Could not fetch centralized prompts:', error);
    }
    
    // If no database prompt found, use fallback logic
    if (!greeting) {
      if (vehicleInfo && vehicleId) {
        greeting = `Hi, I'm D.A.I.V.E.! This ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model} is a great choice. What would you like to know?`;
      } else {
        // Fetch dealer inventory to provide more specific greeting
        try {
          const authToken = localStorage.getItem('auth_token');
          if (authToken) {
            const inventoryResponse = await fetch(`http://localhost:3000/api/vehicles?dealerId=${dealerId}&limit=5`, {
              headers: {
                'Authorization': `Bearer ${authToken}`
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
              console.log('⚠️ Inventory API returned error:', inventoryResponse.status);
              greeting = `Hi, I'm D.A.I.V.E.! I can help you find the perfect vehicle from our inventory. What are you looking for today?`;
            }
          } else {
            console.log('⚠️ No auth token for inventory greeting');
            greeting = `Hi, I'm D.A.I.V.E.! I can help you find the perfect vehicle from our inventory. What are you looking for today?`;
          }
        } catch (error) {
          console.log('Could not fetch inventory for greeting:', error);
          greeting = `Hi, I'm D.A.I.V.E.! I can help you find the perfect vehicle from our inventory. What are you looking for today?`;
        }
      }
    }
    
    setMessages([validateMessage({
      role: 'assistant',
      content: greeting || 'Hello! How can I help you today?',
      timestamp: new Date().toISOString()
    })]);
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

  // Check Crew AI settings
  useEffect(() => {
        const checkCrewAISettings = async () => {
      try {
        console.log('🔍 Checking Crew AI settings for dealer:', dealerId);
        const response = await fetch(`http://localhost:3000/api/daive/crew-ai-settings?dealerId=${dealerId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || 'public'}`
          }
        });

        console.log('📥 Crew AI settings response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('📋 Crew AI settings response data:', data);
          
          if (data.success && data.data.enabled) {
            setCrewAIEnabled(true);
            setUseCrewAI(true); // Enable Crew AI by default when available
            console.log('✅ Crew AI is enabled and activated');
          } else {
            setCrewAIEnabled(false);
            setUseCrewAI(false);
            console.log('❌ Crew AI is disabled');
          }
        } else {
          console.log('❌ Crew AI settings response not OK');
          setCrewAIEnabled(false);
          setUseCrewAI(false);
        }
      } catch (error) {
        console.log('❌ Could not check Crew AI settings:', error);
        setCrewAIEnabled(false);
        setUseCrewAI(false);
      }
    };

    checkCrewAISettings();
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
          content: aiResponse || 'No response available',
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
      content: message || 'Empty message',
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
      
      // Debug: Log the exact dealer ID being sent
      console.log('🔍 DEBUG - Dealer ID details:', {
        dealerId,
        dealerIdType: typeof dealerId,
        dealerIdLength: dealerId?.length,
        isDealerIdValid: dealerId && dealerId.length > 0
      });

      // The backend is smart enough to route between inventory-aware and CrewAI responses
      // Always use the main chat endpoint and let the backend handle the routing
      const endpoint = '/api/daive/chat';
      
      console.log('🚀 Using main chat endpoint for smart routing');
      console.log(`   Message: "${message}"`);
      console.log(`   Backend will automatically choose: Inventory-Aware AI or CrewAI`);
      console.log(`   Crew AI Status: ${crewAIEnabled ? 'Available' : 'Not available'}`);
      console.log(`   User Preference: ${useCrewAI ? 'Enabled' : 'Disabled'}`);
      
      // Get authentication token for the request
      const authToken = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if token exists
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('🔐 Adding authentication header to request');
        console.log('🔐 Token preview:', authToken.substring(0, 20) + '...');
      } else {
        console.warn('⚠️ No authentication token found - request may fail');
        console.warn('⚠️ This will cause 401 Unauthorized errors on protected endpoints');
      }
      
      console.log('📤 Request headers:', headers);
      
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers,
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
      console.log('🔍 Response structure:', {
        success: data.success,
        hasData: !!data.data,
        dataKeys: data.data ? Object.keys(data.data) : 'No data',
        response: data.data?.response,
        responseType: typeof data.data?.response,
        responseLength: data.data?.response?.length
      });

      if (data.success) {
        console.log('✅ Text chat successful');
        console.log('🤖 AI Response:', data.data?.response?.substring(0, 100) + '...');
        console.log('📋 Full response data:', data.data);
        
        // Update crew type if Crew AI was used
        if (data.data?.crewUsed && data.data?.crewType) {
          setCrewType(data.data.crewType);
          console.log('🚀 Crew AI used:', data.data.crewType);
          
          // Log Crew AI response details
          console.log('📋 CREW AI RESPONSE DETAILS:');
          console.log(`   Intent: ${data.data?.intent || 'Unknown'}`);
          console.log(`   Lead Score: ${data.data?.leadScore || 'N/A'}`);
          console.log(`   Should Handoff: ${data.data?.shouldHandoff || 'N/A'}`);
          console.log(`   Response Length: ${data.data?.response?.length || 0} characters`);
        } else {
          console.log('📊 Lead Score:', data.data?.leadScore);
          console.log('🔄 Should Handoff:', data.data?.shouldHandoff);
        }

        // Check if we have a valid response (try both response and message fields)
        const responseContent = data.data?.response || data.data?.message;
        console.log('🔍 Response content found:', responseContent);
        console.log('🔍 Response content length:', responseContent?.length);
        console.log('🔍 Response content type:', typeof responseContent);
        console.log('🔍 Full data structure:', data.data);
        
        if (!responseContent) {
          console.error('❌ No response content in data:', data.data);
          
          // Provide a fallback response instead of failing
          const fallbackResponse = "I apologize, but I'm having trouble generating a response right now. This could be due to a temporary issue with the AI service. Please try again in a moment, or contact support if the problem persists.";
          
          const fallbackMessage: Message = {
            role: 'assistant',
            content: fallbackResponse,
            timestamp: new Date().toISOString()
          };
          
          setMessages(prev => [...prev, fallbackMessage]);
          toast.warning('AI response was empty, showing fallback message');
          return;
        }

        const assistantMessage: Message = {
          role: 'assistant',
          content: responseContent,
          audioUrl: data.data.audioResponseUrl,
          timestamp: new Date().toISOString()
        };

        console.log('📝 Creating assistant message:', assistantMessage);
        console.log('📝 Message content length:', assistantMessage.content?.length);

        setMessages(prev => {
          const newMessages = [...prev, assistantMessage];
          console.log('📝 Updated messages array:', newMessages.length, 'messages');
          console.log('📝 Last message content:', newMessages[newMessages.length - 1]?.content);
          return newMessages;
        });

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
      // Check authentication before sending message
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        toast.error('Please log in to send messages. Authentication is required.');
        return;
      }
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
        // Check authentication before sending message
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          toast.error('Please log in to get vehicle details. Authentication is required.');
          return;
        }
        
        // Send a more specific message to focus on the selected vehicle
        const message = `I want to know more about this specific ${vehicleName}. What are its features, pricing, and availability?`;
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

  // Test backend connection
  const testBackendConnection = async () => {
    try {
      setBackendStatus('Testing...');
      const response = await fetch('http://localhost:3000/api/daive/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vehicleId: null,
          sessionId: 'test-session',
          message: 'Hello, this is a test message',
          customerInfo: {
            name: 'Test User',
            email: 'test@example.com',
            dealerId: dealerId
          }
        }),
      });
      
      const data = await response.json();
      console.log('🧪 Backend test response:', data);
      
      if (data.success && data.data?.response) {
        setBackendStatus('✅ Working');
        toast.success('Backend is working! Response: ' + data.data.response.substring(0, 50) + '...');
      } else {
        setBackendStatus('❌ No Response');
        toast.error('Backend responded but no AI response generated');
      }
    } catch (error) {
      console.error('❌ Backend test failed:', error);
      setBackendStatus('❌ Failed');
      toast.error('Backend connection failed: ' + error);
    }
  };

  // Check user authentication and role
  const checkUserAuthStatus = async () => {
    try {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        console.log('🔐 No authentication token found');
        return { authenticated: false, role: null, userId: null };
      }

      // Decode JWT token to get user info (without verification)
      try {
        const tokenParts = authToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('🔐 JWT Payload:', payload);
          return { 
            authenticated: true, 
            role: payload.role || 'unknown', 
            userId: payload.userId || payload.sub || 'unknown' 
          };
        }
      } catch (decodeError) {
        console.log('❌ Could not decode JWT token:', decodeError);
      }

      // Try to verify token with backend
      try {
        const response = await fetch('http://localhost:3000/api/daive/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            vehicleId: null,
            sessionId: 'auth-test-session',
            message: 'Test authentication',
            customerInfo: {
              name: 'Test User',
              email: 'test@example.com',
              dealerId: dealerId
            }
          }),
        });
        
        if (response.ok) {
          console.log('✅ Authentication token is valid');
          return { authenticated: true, role: 'verified', userId: 'verified' };
        } else {
          console.log('❌ Authentication token validation failed:', response.status);
          return { authenticated: false, role: 'invalid', userId: null };
        }
      } catch (error) {
        console.log('❌ Could not validate token with backend:', error);
        return { authenticated: false, role: 'error', userId: null };
      }
    } catch (error) {
      console.error('❌ Error checking authentication status:', error);
      return { authenticated: false, role: 'error', userId: null };
    }
  };

  // Query database for inventory details - ULTRA-FAST VERSION
  const queryInventoryDatabase = async () => {
    if (isInventoryQuerying) return; // Prevent multiple simultaneous queries
    
    try {
      setIsInventoryQuerying(true);
      console.log('🚀 ULTRA-FAST inventory query starting...');
      console.log('📍 Dealer ID:', dealerId);
      
      // Check authentication status
      const authToken = localStorage.getItem('auth_token');
      console.log('🔐 Auth Token:', authToken ? 'Present' : 'Missing');
      
      if (!dealerId) {
        console.error('❌ No dealer ID available for inventory query');
        toast.error('No dealer ID available');
        return;
      }

      if (!authToken) {
        console.warn('⚠️ User not authenticated - some queries may fail');
        toast.warning('User not authenticated - some queries may fail');
      }

      // ULTRA-FAST DIRECT QUERY: Bypass AI processing completely
      console.log('\n🚀 ULTRA-FAST QUERY: Direct Database Access');
      try {
        const startTime = Date.now();
        
        // Use the new fast inventory endpoint
        const fastInventoryResponse = await fetch(`http://localhost:3000/api/daive/fast-inventory?dealerId=${dealerId}&limit=20`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${authToken || 'public'}`
          }
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        if (fastInventoryResponse.ok) {
          const inventoryData = await fastInventoryResponse.json();
          console.log(`✅ ULTRA-FAST Inventory Response (${responseTime}ms):`, inventoryData);
          
          if (inventoryData.success && inventoryData.data?.vehicles) {
            const vehicles = inventoryData.data.vehicles;
            console.log(`🚗 Found ${vehicles.length} vehicles in ${responseTime}ms`);
            
            // Display inventory in chat
            const inventoryMessage = `🚗 **INVENTORY QUERY COMPLETED IN ${responseTime}ms**\n\nHere's what we have available:\n\n${vehicles.map(vehicle => {
              const price = vehicle.price ? `$${parseFloat(vehicle.price).toLocaleString()}` : 'Price available upon request';
              const mileage = vehicle.mileage ? ` • ${vehicle.mileage.toLocaleString()} miles` : '';
              const features = vehicle.features ? `\nFeatures: ${Array.isArray(vehicle.features) ? vehicle.features.join(', ') : vehicle.features}` : '';
              
              return `**${vehicle.year} ${vehicle.make} ${vehicle.model}**\n` +
                     `• Price: ${price}\n` +
                     `• Status: ${vehicle.status}\n` +
                     `• Mileage: ${mileage || 'N/A'}${features}\n`;
            }).join('\n---\n')}\n\n*Query completed in ${responseTime}ms - ${vehicles.length} vehicles found*`;
            
            // Add inventory response to chat
            const inventoryResponseMessage: Message = {
              role: 'assistant',
              content: inventoryMessage,
              timestamp: new Date().toISOString()
            };
            
            setMessages(prev => [...prev, inventoryResponseMessage]);
            
            toast.success(`Inventory query completed in ${responseTime}ms! Found ${vehicles.length} vehicles.`);
            console.log('✅ Inventory displayed in chat successfully');
            
            // Store performance metrics for comparison
            setLastQueryTime(responseTime);
            
            // Show performance improvement message
            if (lastQueryTime && responseTime < lastQueryTime) {
              const improvement = Math.round(((lastQueryTime - responseTime) / lastQueryTime) * 100);
              toast.success(`🚀 Performance improved by ${improvement}%!`);
            }
          } else {
            console.log('❌ No vehicles found in fast inventory response');
            toast.warning('No vehicles found in inventory');
          }
        } else {
          console.log('❌ Fast inventory query failed:', fastInventoryResponse.status);
          const errorText = await fastInventoryResponse.text();
          console.log('❌ Error details:', errorText);
          toast.error(`Fast inventory query failed: ${fastInventoryResponse.status}`);
        }
      } catch (error) {
        console.log('❌ Fast inventory query error:', error);
        toast.error('Fast inventory query error: ' + error);
      }

      console.log('\n✅ ULTRA-FAST inventory query completed!');
      
    } catch (error) {
      console.error('❌ Inventory query failed:', error);
      toast.error('Inventory query failed: ' + error);
    } finally {
      setIsInventoryQuerying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="w-full flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">D</span>
              </div>
              D.A.I.V.E. AI Bot
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="secondary">
                  {vehicleInfo ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}` : 'Dealer Inventory'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={testBackendConnection}
                  className="h-6 px-2 text-xs"
                >
                  Test Backend
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={queryInventoryDatabase}
                  className="h-6 px-2 text-xs bg-green-50 border-green-200 hover:bg-green-100"
                  title="Query database for inventory details"
                  disabled={isInventoryQuerying}
                >
                  {isInventoryQuerying ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Database className="h-3 w-3" />
                  )}
                  <span className="ml-1 text-xs">
                    {isInventoryQuerying ? 'Querying...' : 'Query Inventory'}
                  </span>
                </Button>
                {isInventoryQuerying && (
                  <div className="text-xs text-green-600 animate-pulse">
                    Fetching inventory data...
                  </div>
                )}
                {lastQueryTime && (
                  <div className="text-xs text-blue-600">
                    Last query: {lastQueryTime}ms
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={checkUserAuthStatus}
                  className="h-6 px-2 text-xs bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                  title="Check user authentication status"
                >
                  Check Auth
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={checkCurrentDealerContext}
                  className="h-6 px-2 text-xs bg-purple-50 border-purple-200 hover:bg-purple-100"
                  title="Check current dealer context and cache"
                >
                  Check Dealer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearCacheAndRefresh}
                  className="h-6 px-2 text-xs bg-red-50 border-red-200 hover:bg-red-100"
                  title="Clear cache and refresh dealer context"
                >
                  Clear Cache
                </Button>
                <span className="text-xs text-gray-500">
                  {backendStatus}
                </span>
                <div className="flex items-center gap-2">
                  {localStorage.getItem('auth_token') ? (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      🔐 Authenticated
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                      ⚠️ Not Authenticated
                    </Badge>
                  )}
                </div>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.filter(message => message && message.content).map((message, index) => {
                  console.log(`🎨 Rendering message ${index}:`, {
                    role: message.role,
                    contentLength: message.content?.length,
                    contentPreview: message.content?.substring(0, 50) + '...'
                  });
                  
                  return (
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
                      {message.content && (message.content.includes('<div class="inventory-grid">') || message.content.includes('<ul class="inventory-list">')) ? (
                        <div 
                          className="text-sm max-w-full"
                          dangerouslySetInnerHTML={{ __html: message.content }}
                          onClick={(e) => handleVehicleClick(e)}
                        />
                      ) : (
                        <p className="text-sm">{message.content || 'No content available'}</p>
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
                );
                })}
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

            {/* Crew AI Status */}
            {crewAIEnabled && (
              <div className="p-2 border-t border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Crew AI</span>
                    <Badge variant="secondary" className="text-xs">
                      {useCrewAI ? 'Active' : 'Standby'}
                    </Badge>
                  </div>
                  {crewType !== 'N/A' && (
                    <span className="text-xs text-green-600">
                      Using: {crewType}
                    </span>
                  )}
                </div>
              </div>
            )}

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
                  title="Toggle Voice Mode"
                >
                  {isVoiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setUseCrewAI(!useCrewAI)}
                  className={useCrewAI ? 'bg-green-50 border-green-200' : ''}
                  disabled={isProcessing || !crewAIEnabled}
                  title={crewAIEnabled ? 'Toggle Crew AI' : 'Crew AI not available'}
                >
                  <Users className="h-4 w-4" />
                  {useCrewAI && crewAIEnabled && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  )}
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
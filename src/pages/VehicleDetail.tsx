import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Car, Calendar, MapPin, DollarSign, MessageSquare, Phone, Mail, ArrowLeft, Brain, X, Send, Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  trim?: string;
  color?: string;
  mileage?: number | string; // Can be decimal from database
  price?: number | string; // Can be decimal from database
  description?: string;
  features?: string[];
  photo_url_list?: string[]; // Now properly TEXT[] type in database
  status: string;
  dealer_id?: string;
  dealer_name?: string;
  created_at: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audioUrl?: string; // For voice responses
}

interface QuickAction {
  label: string;
  message: string;
}

const VehicleDetail = () => {
  const { id, vin, hash } = useParams<{ id?: string; vin?: string; hash?: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    enabled: false,
    language: 'en-US',
    voiceSpeed: 1.0,
    voicePitch: 1.0,
    voiceProvider: 'elevenlabs'
  });
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Helper function to parse photo_url_list (now properly an array)
  const parsePhotoUrlList = (photoUrlList: string[] | null | undefined): string[] => {
    if (!photoUrlList || !Array.isArray(photoUrlList)) return [];
    return photoUrlList.filter(url => url && typeof url === 'string');
  };

  // Quick action buttons for common questions
  const quickActions: QuickAction[] = [
    { label: 'Family Features', message: 'I want an ideal car for my family' },
    { label: 'Safety Info', message: 'What safety features does this vehicle have?' },
    { label: 'Pricing', message: 'What is the price and financing options?' },
    { label: 'Test Drive', message: 'Can I schedule a test drive?' },
    { label: 'Fuel Economy', message: 'What are the fuel efficiency ratings?' },
    { label: 'Cargo Space', message: 'How much cargo space does it have?' },
    { label: 'More Options', message: 'Show me other vehicles from this dealer' }
  ];

  useEffect(() => {
    if (id || vin || hash) {
      fetchVehicle();
    }
  }, [id, vin, hash]);

  // Initialize chat when opened
  useEffect(() => {
    if (showChat && vehicle) {
      const newSessionId = `daive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      
      // Send initial greeting
      const greeting: ChatMessage = {
        role: 'assistant',
        content: `Hi, I'm D.A.I.V.E.! This ${vehicle.year} ${vehicle.make} ${vehicle.model} is a great choice. What would you like to know?`,
        timestamp: new Date().toISOString()
      };
      setMessages([greeting]);
      setShowQuickActions(true);
    }
  }, [showChat, vehicle]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchVehicle = async () => {
    try {
      let endpoint;
      if (hash) {
        endpoint = `http://localhost:3000/api/vehicles/public/qr/${hash}`;
      } else if (vin) {
        endpoint = `http://localhost:3000/api/vehicles/public/vin/${vin}`;
      } else if (id) {
        endpoint = `http://localhost:3000/api/vehicles/public/${id}`;
      } else {
        throw new Error('No vehicle identifier provided');
      }
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Vehicle not found');
      }
      const data = await response.json();
      setVehicle(data);
    } catch (error: any) {
      console.error("Error fetching vehicle:", error);
      toast({
        title: "Error",
        description: "Vehicle not found or no longer available",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price?: number | string) => {
    if (!price) return "Price not set";
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return "Price not set";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(numPrice);
  };

  const formatMileage = (mileage?: number | string) => {
    if (!mileage) return "Mileage not specified";
    const numMileage = typeof mileage === 'string' ? parseFloat(mileage) : mileage;
    if (isNaN(numMileage)) return "Mileage not specified";
    return new Intl.NumberFormat("en-US").format(numMileage) + " miles";
  };

  const handleContactDealer = () => {
    // This would open a chat interface or contact form
    toast({
      title: "Contact Dealer",
      description: "Contact feature will be implemented soon",
    });
  };

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.message);
    setShowQuickActions(false);
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || !vehicle) return;

    console.log('📝 Sending text message:', message);

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const payload = {
        vehicleId: vehicle.id,
        sessionId,
        message,
        customerInfo: {
          name: 'Vehicle Detail Customer',
          email: 'customer@example.com',
          dealerId: vehicle.dealer_id || '0aa94346-ed1d-420e-8823-bcd97bf6456f'
        }
      };

      console.log('📤 Sending text request to backend:', {
        vehicleId: vehicle.id,
        sessionId,
        message: message.substring(0, 50) + '...',
        dealerId: vehicle.dealer_id
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
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('📥 Response data:', data);

      if (data.success) {
        console.log('✅ Text chat successful');
        console.log('🤖 AI Response:', data.data.response?.substring(0, 100) + '...');
        console.log('📊 Lead Score:', data.data.leadScore);
        console.log('🔄 Should Handoff:', data.data.shouldHandoff);

        // Use audio response from backend if available, otherwise generate locally
        let audioUrl: string | null = null;
        if (data.data.audioResponseUrl) {
          // Use the audio response from the backend
          audioUrl = data.data.audioResponseUrl;
          console.log('🔊 Using backend audio response:', audioUrl);
        } else if (voiceEnabled) {
          // Fallback to local speech generation
          audioUrl = await generateSpeech(data.data.response);
          console.log('🔊 Generated local audio response:', audioUrl);
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.data.response,
          timestamp: new Date().toISOString(),
          audioUrl: audioUrl || undefined
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Play audio if generated
        if (audioUrl) {
          playAudio(audioUrl);
        }

        // Check if lead was generated
        if (data.data.leadScore > 50) {
          toast({
            title: "Lead Generated!",
            description: `Lead score: ${data.data.leadScore}%`,
          });
        }

        // Check if handoff is needed
        if (data.data.shouldHandoff) {
          toast({
            title: "Connecting to Human",
            description: "Connecting you to a human sales representative...",
          });
        }

        // Show lead score in console for debugging
        console.log(`Lead Score: ${data.data.leadScore}%, Handoff: ${data.data.shouldHandoff}`);
      } else {
        console.error('❌ Text chat failed:', data.error);
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      
      // Remove the user message if it failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch voice settings when chat opens
  const fetchVoiceSettings = async () => {
    try {
      // Get dealer ID from vehicle or use default
      const dealerId = vehicle?.dealer_id || '0aa94346-ed1d-420e-8823-bcd97bf6456f';
      
      const response = await fetch(`http://localhost:3000/api/daive/voice-settings?dealerId=${dealerId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || 'public'}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVoiceSettings(data.data);
          setVoiceEnabled(data.data.enabled);
        }
      } else {
        console.log('Voice settings not available, using defaults');
        // Use default voice settings
        setVoiceSettings({
          enabled: true,
          language: 'en-US',
          voiceSpeed: 1.0,
          voicePitch: 1.0,
          voiceProvider: 'elevenlabs'
        });
        setVoiceEnabled(true);
      }
    } catch (error) {
      console.error('Error fetching voice settings:', error);
      // Use default voice settings on error
      setVoiceSettings({
        enabled: true,
        language: 'en-US',
        voiceSpeed: 1.0,
        voicePitch: 1.0,
        voiceProvider: 'elevenlabs'
      });
      setVoiceEnabled(true);
    }
  };

  // Generate speech from text using ElevenLabs
  const generateSpeech = async (text: string): Promise<string | null> => {
    if (!voiceSettings.enabled) {
      return null;
    }

    try {
      // Get dealer ID from vehicle or use default
      const dealerId = vehicle?.dealer_id || '0aa94346-ed1d-420e-8823-bcd97bf6456f';
      
      // Get the API settings from the dealer's settings
      const apiResponse = await fetch(`http://localhost:3000/api/daive/api-settings?dealerId=${dealerId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || 'public'}`
        }
      });

      if (!apiResponse.ok) {
        console.log('No API settings found, skipping voice generation');
        return null;
      }

      const apiData = await apiResponse.json();
      const voiceProvider = voiceSettings.voiceProvider || 'elevenlabs';

      if (voiceProvider === 'deepgram') {
        // Use Deepgram TTS
        const deepgramKey = apiData.data?.deepgram_key?.value;
        
        if (!deepgramKey) {
          console.log('No Deepgram API key found, skipping voice generation');
          return null;
        }

        console.log('🎤 Using Deepgram TTS for speech generation...');
        
        const speechResponse = await fetch('https://api.deepgram.com/v1/speak', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text
          })
        });

        if (speechResponse.ok) {
          const audioBuffer = await speechResponse.arrayBuffer();
          const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(audioBlob);
          console.log('✅ Deepgram TTS successful');
          return audioUrl;
        } else {
          const errorText = await speechResponse.text();
          console.error('Deepgram TTS failed:', speechResponse.status, errorText);
          return null;
        }
      } else {
        // Use ElevenLabs TTS (default)
        const elevenLabsKey = apiData.data?.elevenlabs_key?.value;

        if (!elevenLabsKey) {
          console.log('No ElevenLabs API key found, skipping voice generation');
          return null;
        }

        // Use Rachel voice (21m00Tcm4TlvDq8ikWAM) for consistent experience
        const voiceId = "21m00Tcm4TlvDq8ikWAM";
        
        const speechResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5
            }
          })
        });

        if (speechResponse.ok) {
          const audioBlob = await speechResponse.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          return audioUrl;
        } else {
          console.error('Speech generation failed:', speechResponse.status);
          return null;
        }
      }
    } catch (error) {
      console.error('Error generating speech:', error);
      return null;
    }
  };

  // Play audio function
  const playAudio = (audioUrl: string) => {
    const audio = new Audio(audioUrl);
    setIsPlayingAudio(true);
    
    audio.onended = () => {
      setIsPlayingAudio(false);
    };
    
    audio.onerror = () => {
      setIsPlayingAudio(false);
      console.error('Error playing audio');
    };
    
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      setIsPlayingAudio(false);
    });
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
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
          console.log(`🛑 Recording stopped. Audio size: ${(blob.size / 1024).toFixed(2)} KB`);
          console.log('🎵 Audio blob created:', { size: blob.size, type: blob.type });
          processVoiceInput(blob);
          setAudioChunks([]);
          audioChunksRef.current = [];
          stream.getTracks().forEach(track => track.stop());
        } else {
          console.log('❌ No audio chunks received');
          toast({
            title: "Recording Error",
            description: "No audio recorded. Please try again.",
            variant: "destructive",
          });
        }
      };
      
      setMediaRecorder(recorder);
      setAudioChunks([]);
      audioChunksRef.current = [];
      recorder.start();
      setIsRecording(true);
      
      console.log('🎤 Recording started');
      toast({
        title: "Recording",
        description: "Listening for your question...",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  // Stop recording audio
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  // Process voice input and convert to text
  const processVoiceInput = async (audioBlob: Blob) => {
    console.log('🎵 Processing voice input:', {
      size: (audioBlob.size / 1024).toFixed(2) + ' KB',
      type: audioBlob.type
    });

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-input.wav');
      formData.append('vehicleId', vehicle?.id || '');
      formData.append('sessionId', sessionId);
      formData.append('customerInfo', JSON.stringify({
        name: 'Vehicle Detail Customer',
        email: 'customer@example.com',
        dealerId: vehicle?.dealer_id || '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      }));

      console.log('📤 Sending voice data to backend:', {
        size: (audioBlob.size / 1024).toFixed(2) + ' KB',
        vehicleId: vehicle?.id,
        sessionId,
        dealerId: vehicle?.dealer_id,
        url: 'http://localhost:3000/api/daive/voice'
      });

      // Send to voice endpoint for processing
      const response = await fetch('http://localhost:3000/api/daive/voice', {
        method: 'POST',
        body: formData
      });

      console.log('📥 Voice response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
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
          
          // Add user message with transcribed text
          const userMessage: ChatMessage = {
            role: 'user',
            content: transcription,
            timestamp: new Date().toISOString()
          };

          setMessages(prev => [...prev, userMessage]);
          setInputMessage('');

          // Process the response
          if (aiResponse) {
            // Use audio response from backend if available, otherwise generate locally
            let audioUrl: string | null = null;
            if (audioResponseUrl) {
              // Use the audio response from the backend
              audioUrl = audioResponseUrl;
              console.log('🔊 Using backend audio response for voice input:', audioUrl);
            } else if (voiceEnabled) {
              // Fallback to local speech generation
              audioUrl = await generateSpeech(aiResponse);
              console.log('🔊 Generated local audio response for voice input:', audioUrl);
            }

            const assistantMessage: ChatMessage = {
              role: 'assistant',
              content: aiResponse,
              timestamp: new Date().toISOString(),
              audioUrl: audioUrl || undefined
            };

            setMessages(prev => [...prev, assistantMessage]);

            // Play audio if generated
            if (audioUrl) {
              playAudio(audioUrl);
            }
          }

          // Check if lead was generated
          if (leadScore > 50) {
            toast({
              title: "Lead Generated!",
              description: `Lead score: ${leadScore}%`,
            });
          }

          // Check if handoff is needed
          if (data.data?.shouldHandoff) {
            toast({
              title: "Connecting to Human",
              description: "Connecting you to a human sales representative...",
            });
          }

          toast({
            title: "Voice Message",
            description: `Transcribed: "${transcription}"`,
          });
          console.log('🎉 Voice recognition successful!');
        } else {
          console.warn('⚠️ Voice recognition failed - try speaking more clearly');
          toast({
            title: "Voice Recognition Failed",
            description: "I couldn't understand your voice. Please try speaking more clearly or use text input.",
            variant: "destructive",
          });
        }
      } else {
        throw new Error(data.error || 'Failed to process voice input');
      }
    } catch (error) {
      console.error('❌ Error processing voice input:', error);
      toast({
        title: "Error",
        description: "Failed to process voice input. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDAIVEChat = () => {
    setShowChat(true);
    fetchVoiceSettings(); // Fetch voice settings when chat opens
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading vehicle details...</p>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Vehicle Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This vehicle may have been removed or is no longer available.
          </p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/")}
            className="mb-3"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to Home
          </Button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <Car className="h-4 w-4 text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold">DealerIQ</h1>
              <span className="text-muted-foreground text-sm">/ Vehicle Details</span>
            </div>
            
            {vehicle?.dealer_name && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Dealer</p>
                <p className="font-semibold text-primary text-sm">{vehicle.dealer_name}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vehicle Images */}
          <div className="space-y-4">
            {(() => {
              const images = parsePhotoUrlList(vehicle.photo_url_list);
              return (
                <>
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                    {images.length > 0 ? (
                      <img
                        src={images[selectedImage]}
                        alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Car className="h-24 w-24 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  {/* Image Thumbnails */}
                  {images.length > 1 && (
                    <div className="flex space-x-2 overflow-x-auto">
                      {images.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImage(index)}
                          className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                            selectedImage === index ? 'border-primary' : 'border-border'
                          }`}
                        >
                          <img
                            src={image}
                            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} - Image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Vehicle Details */}
          <div className="space-y-4">
            {/* Vehicle Title */}
            <div>
              <h1 className="text-2xl font-bold mb-1">
                {vehicle.year} {vehicle.make} {vehicle.model}
                {vehicle.trim && ` ${vehicle.trim}`}
              </h1>
              <p className="text-sm text-muted-foreground">
                VIN: {vehicle.vin}
              </p>
              
              {/* QR Code Info */}
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  📱 <strong>Scanned from QR Code:</strong> This vehicle information was accessed by scanning the QR code sticker on the vehicle window.
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <div>
              <Badge 
                variant={vehicle.status === 'available' ? 'default' : 'secondary'}
                className="text-sm"
              >
                {vehicle.status === 'available' ? 'Available' : vehicle.status}
              </Badge>
            </div>

            {/* Price */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">
                    {formatPrice(vehicle.price)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Key Details */}
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{vehicle.year}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatMileage(vehicle.mileage)}</span>
                  </div>
                </div>
                
                {vehicle.color && (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                    <span className="text-sm">{vehicle.color}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            {vehicle.description && (
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {vehicle.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Features */}
            {vehicle.features && vehicle.features.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {vehicle.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dealer Info */}
            {vehicle.dealer_name && (
              <Card>
                <CardHeader>
                  <CardTitle>Dealer Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium mb-2">{vehicle.dealer_name}</p>
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={handleContactDealer}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Chat with Dealer
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call Dealer
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email Dealer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact Actions */}
            <div className="space-y-3">
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleDAIVEChat}
              >
                <Brain className="h-4 w-4 mr-2" />
                Chat with D.A.I.V.E. AI Assistant
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleContactDealer}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Human Dealer
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.print()}
              >
                Print Vehicle Details
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* D.A.I.V.E. Chat Modal */}
      {showChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md h-[600px] flex flex-col">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">D</span>
                </div>
                <div>
                  <h3 className="font-semibold">D.A.I.V.E. Assistant</h3>
                  <p className="text-xs text-gray-500">
                    {vehicle?.year} {vehicle?.make} {vehicle?.model}
                  </p>
                  <p className="text-xs text-gray-400">
                    Vehicle ID: {vehicle?.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {/* Voice Toggle Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`${voiceEnabled ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}
                  title={voiceEnabled ? 'Voice Enabled' : 'Voice Disabled'}
                >
                  {voiceEnabled ? (
                    <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                  ) : (
                    <div className="w-4 h-4 border-2 border-gray-400 rounded-full"></div>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChat(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                      {/* Audio Playback for Assistant Messages */}
                      {message.role === 'assistant' && message.audioUrl && (
                        <button
                          onClick={() => playAudio(message.audioUrl!)}
                          disabled={isPlayingAudio}
                          className="ml-2 p-1 rounded-full bg-blue-100 hover:bg-blue-200 disabled:opacity-50"
                          title="Play Voice"
                        >
                          {isPlayingAudio ? (
                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                          ) : (
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
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
              <div ref={chatEndRef} />
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
                      disabled={isLoading}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Input */}
            <div className="p-4 border-t">
              {/* Voice Status */}
              {voiceEnabled && (
                <div className="mb-2 flex items-center space-x-2 text-xs text-blue-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span>Voice responses enabled</span>
                </div>
              )}
              {isRecording && (
                <div className="mb-2 flex items-center space-x-2 text-xs text-red-600">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span>Recording your voice...</span>
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isLoading && inputMessage.trim()) {
                    sendMessage(inputMessage);
                  }
                }}
                className="flex gap-2"
              >
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  disabled={isLoading || isRecording}
                  className="flex-1"
                />
                {/* Voice Recording Button */}
                <Button
                  type="button"
                  size="icon"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  className={`${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                  title={isRecording ? 'Stop Recording' : 'Start Voice Recording'}
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4 text-white" />
                  ) : (
                    <Mic className="h-4 w-4 text-white" />
                  )}
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  disabled={isLoading || !inputMessage.trim() || isRecording}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleDetail; 
/**
 * AIBotPage - Main AI Bot Interface
 * 
 * DEVELOPMENT FEATURE: Journey Tracker Display
 * - Shows 16-step client journey progress during conversations
 * - Can be easily hidden when going live by setting localStorage 'daive_show_journey_tracker' to 'false'
 * - Or by clicking the "Hide Tracker" button in the header
 * - The journey tracker helps developers monitor conversation flow and step progression
 */
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Mic, MicOff, Loader2, Send, Volume2, VolumeX, Play, Square, Users, Database, Trash2, Eye, EyeOff, Bug, Settings, BarChart3, Check, Calendar, FileText, ExternalLink, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { buildApiUrl, buildAssetUrl, buildBackendAssetUrl } from '../lib/config';
import JourneyTrackerDisplay from '../components/JourneyTrackerDisplay';
import { useCustomer, useQRCodeAccess } from '../contexts/CustomerContext';
import QuickAuthModal from '../components/customer/QuickAuthModal';

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
  vehicleId: propVehicleId,
  dealerId: propDealerId,
  vehicleInfo: propVehicleInfo,
  onLeadGenerated
}) => {
  const [searchParams] = useSearchParams();
  const { hash } = useParams();
  const location = useLocation();
  
  // Get vehicle data from navigation state or props
  const vehicleId = location.state?.vehicleId || propVehicleId;
  const dealerId = location.state?.dealerId || propDealerId;
  const vehicleInfo = location.state?.vehicleInfo || propVehicleInfo;
  
  // Debug logging for vehicle data
  useEffect(() => {
    console.log('🚗 AIBotPage - Vehicle data received:', {
      vehicleId,
      dealerId,
      vehicleInfo,
      locationState: location.state,
      props: { propVehicleId, propDealerId, propVehicleInfo }
    });
  }, [vehicleId, dealerId, vehicleInfo, location.state]);

  
  // Customer context for quick auth
  const { customer, login, hasValidSession } = useCustomer();
  const { isQRAccess, isCustomerAuthenticated } = useQRCodeAccess();
  
  // Debug logging for customer and QR access
  useEffect(() => {
    console.log('🔍 Customer Context Debug:', {
      customer,
      hasValidSession,
      isQRAccess,
      isCustomerAuthenticated,
      currentUrl: window.location.href,
      hash: window.location.hash
    });
  }, [customer, hasValidSession, isQRAccess, isCustomerAuthenticated]);
  
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
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showDaivestepsActions, setShowDaivestepsActions] = useState(false);
  const [useCrewAI, setUseCrewAI] = useState(false);
  const [crewAIEnabled, setCrewAIEnabled] = useState(false);
  const [crewType, setCrewType] = useState<string>('N/A');
  const [showQuickAuth, setShowQuickAuth] = useState(false);
  const [dealerInfo, setDealerInfo] = useState<{id: string, business_name: string} | null>(null);
  const [loadingDealer, setLoadingDealer] = useState(false);
  
  // ✅ NEW: Vehicle inventory state management
  const [currentVehicleDetails, setCurrentVehicleDetails] = useState<any[]>([]);
  const [showVehicleCards, setShowVehicleCards] = useState(false);
  
  // ✅ NEW: Vehicle overview text state (separate from messages to prevent re-rendering)
  const [vehicleOverviewText, setVehicleOverviewText] = useState('');
  
  // ✅ NEW: Test drive explanation text state (separate from messages to prevent re-rendering)
  const [testDriveExplanationText, setTestDriveExplanationText] = useState('');
  
  // ✅ NEW: Vehicle pagination state
  const [currentVehiclePage, setCurrentVehiclePage] = useState(0);
  const [vehiclesPerPage] = useState(3); // Show 3 vehicles per page

  // ✅ NEW: Track selected vehicles to send with chat as data array
  const [selectedVehicles, setSelectedVehicles] = useState<any[]>([]);
  
  // ✅ NEW: Vehicle voice-over state management
  const [isVehicleCardVoicePlaying, setIsVehicleCardVoicePlaying] = useState(false);
  const [vehicleGroupVoicePlayed, setVehicleGroupVoicePlayed] = useState<string>('');
  const [isProcessingVehicleCards, setIsProcessingVehicleCards] = useState(false);
    const [currentVehicleAudio, setCurrentVehicleAudio] = useState<HTMLAudioElement | null>(null);

  // ✅ NEW: CarFax modal state management
  const [showCarfaxModal, setShowCarfaxModal] = useState(false);
  const [carfaxData, setCarfaxData] = useState<any>(null);
  const [loadingCarfax, setLoadingCarfax] = useState(false);
  const [selectedCarfaxVehicle, setSelectedCarfaxVehicle] = useState<any>(null);

  // ✅ NEW: Vehicle pagination helpers
  const getCurrentPageVehicles = () => {
    const startIndex = currentVehiclePage * vehiclesPerPage;
    const endIndex = startIndex + vehiclesPerPage;
    return currentVehicleDetails.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(currentVehicleDetails.length / vehiclesPerPage);
  };

  const goToNextPage = () => {
    const totalPages = getTotalPages();
    if (currentVehiclePage < totalPages - 1) {
      setCurrentVehiclePage(currentVehiclePage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentVehiclePage > 0) {
      setCurrentVehiclePage(currentVehiclePage - 1);
    }
  };

  const goToPage = (page: number) => {
    const totalPages = getTotalPages();
    if (page >= 0 && page < totalPages) {
      setCurrentVehiclePage(page);
    }
  };

  // ✅ ENHANCED: Handle vehicle selection with vehicle ID and details
  const handleVehicleSelection = async (selectedVehicle: any) => {
    console.log('🚗 Vehicle selected:', selectedVehicle);
    
    // ✅ NEW: Send vehicle ID and details instead of text message
    const vehicleSelectionData = {
      vehicleId: selectedVehicle.id,
      vehicleDetails: {
        id: selectedVehicle.id,
        year: selectedVehicle.year,
        make: selectedVehicle.make,
        model: selectedVehicle.model,
        price: selectedVehicle.price,
        stock_number: selectedVehicle.stockNumber,
        color: selectedVehicle.color,
        mileage: selectedVehicle.mileage,
        trim: selectedVehicle.trim,
        vehicle_type: selectedVehicle.vehicle_type || 'SUV'
      },
      action: "vehicle_selection"
    };
    
    // Add user message for display purposes (shows what user selected)
    const userMessage: Message = {
      role: 'user',
      content: `I'm interested in the ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} - ${selectedVehicle.price} (Stock #${selectedVehicle.stockNumber})`,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // ✅ NEW: Stop vehicle group voice-over when vehicle is selected
    stopVehicleGroupVoiceOver();
    
    // ✅ Track the selected vehicle locally for subsequent chat requests
    setSelectedVehicles(prev => [...prev, vehicleSelectionData.vehicleDetails]);
    
    // ✅ ENHANCED: Send vehicle selection with ID and details to backend
    try {
      const response = await fetch(buildApiUrl('daive/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: vehicleSelectionData.vehicleId, // Send vehicle ID as message
          vehicleDetails: vehicleSelectionData.vehicleDetails, // Send vehicle details
          action: vehicleSelectionData.action, // Send action type
          // ✅ Provide a combined data array for backend consumption
          dataArray: [
            { type: 'userMessage', content: userMessage.content },
            { type: 'selectedVehicle', details: vehicleSelectionData.vehicleDetails }
          ],
          sessionId,
          dealerId: effectiveDealerId,
          vehicleId,
          useCrewAI,
          conversationContext: conversationContext
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data?.response) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.data.response,
          audioUrl: data.data.audioResponseUrl,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Hide vehicle cards after selection since customer has chosen a vehicle
        console.log('✅ Vehicle selected - hiding vehicle cards');
        setShowVehicleCards(false);
        setCurrentVehicleDetails([]);
        
        // Start typewriter effect
        setTimeout(() => {
          startTypewriterEffect(assistantMessage);
        }, 50);
      }
    } catch (error) {
      console.error('Error sending vehicle selection:', error);
      toast.error('Failed to process vehicle selection. Please try again.');
    }
  };

  // ✅ NEW: Handle showing more vehicle options - ALWAYS LOAD FRESH FROM BACKEND
  const handleShowMoreOptions = async () => {
    console.log('🔍 User requested more vehicle options');
    
    // Add user message for more options
    const userMessage: Message = {
      role: 'user',
      content: 'Can you show me more vehicle options?',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // ✅ Clear any existing vehicle details before requesting more options
    setCurrentVehicleDetails([]);
    setShowVehicleCards(false);
    
    // Send request for more options to backend
    try {
      const response = await fetch(buildApiUrl('daive/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId,
          dealerId: effectiveDealerId,
          vehicleId,
          useCrewAI,
          conversationContext: conversationContext,
          intent: 'more_options_request',
          // ✅ Provide selected vehicles context to backend
          dataArray: [
            { type: 'userMessage', content: userMessage.content },
            { type: 'selectedVehicles', items: selectedVehicles }
          ]
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data?.response) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.data.response,
          audioUrl: data.data.audioResponseUrl,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Start typewriter effect
        setTimeout(() => {
          startTypewriterEffect(assistantMessage);
        }, 50);
      }
    } catch (error) {
      console.error('Error requesting more options:', error);
      toast.error('Failed to load more options. Please try again.');
    }
  };

  // ✅ NEW: Handle test drive interest
  const handleTestDriveInterest = async (selectedVehicle: any) => {
    console.log('🚗 Test drive interest:', selectedVehicle);
    
    // Add user message for test drive interest
    const userMessage: Message = {
      role: 'user',
      content: `I'm interested in scheduling a test drive for the ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} - ${selectedVehicle.price}`,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // ✅ NEW: Stop vehicle group voice-over before playing test drive voice-over
    stopVehicleGroupVoiceOver();
    
      // DISABLED: Test drive voice-over explanation
      // await playTestDriveVoiceOver(selectedVehicle);
    
    // Send test drive interest to backend with same dataArray structure as vehicle selection
    // Test drive is treated as vehicle selection since it's another way to select a vehicle
    console.log('🚗 Sending test drive as vehicle selection with unified dataArray structure');
    try {
      const testDriveData = {
        vehicleId: selectedVehicle.id,
        vehicleDetails: {
          id: selectedVehicle.id,
          year: selectedVehicle.year,
          make: selectedVehicle.make,
          model: selectedVehicle.model,
          price: selectedVehicle.price,
          stock_number: selectedVehicle.stockNumber,
          color: selectedVehicle.color,
          mileage: selectedVehicle.mileage,
          trim: selectedVehicle.trim,
          vehicle_type: selectedVehicle.vehicle_type || 'SUV'
        },
        action: "test_drive_request"
      };
      
      const response = await fetch(buildApiUrl('daive/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testDriveData.vehicleId, // Send vehicle ID as message
          vehicleDetails: testDriveData.vehicleDetails, // Send vehicle details
          action: testDriveData.action, // Send action type
          // ✅ Provide a combined data array for backend consumption (same structure as vehicle selection)
          dataArray: [
            { type: 'userMessage', content: userMessage.content },
            { type: 'selectedVehicle', details: testDriveData.vehicleDetails }
          ],
          sessionId,
          dealerId: effectiveDealerId,
          vehicleId ,
          useCrewAI,
          conversationContext: conversationContext
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data?.response) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.data.response,
          audioUrl: data.data.audioResponseUrl,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Hide vehicle cards after test drive interest since customer is moving to next stage
        console.log('✅ Test drive interest expressed - hiding vehicle cards');
        setShowVehicleCards(false);
        setCurrentVehicleDetails([]);
        
        // Start typewriter effect
        setTimeout(() => {
          startTypewriterEffect(assistantMessage);
        }, 50);
      }
    } catch (error) {
      console.error('Error sending test drive interest:', error);
      toast.error('Failed to process test drive request. Please try again.');
    }
  };
  
  // State to track the effective dealer ID (from props or URL)
  const [effectiveDealerId, setEffectiveDealerId] = useState<string | undefined>(dealerId);
  
  // Update effectiveDealerId when dealerId changes from navigation state
  useEffect(() => {
    if (dealerId && dealerId !== effectiveDealerId) {
      console.log('🔄 Updating effectiveDealerId from navigation state:', {
        oldEffectiveDealerId: effectiveDealerId,
        newDealerId: dealerId,
        source: 'navigation_state'
      });
      setEffectiveDealerId(dealerId);
    }
  }, [dealerId, effectiveDealerId]);
  const [backendStatus, setBackendStatus] = useState<string>('Checking...');
  const [isInventoryQuerying, setIsInventoryQuerying] = useState(false);
  const [lastQueryTime, setLastQueryTime] = useState<number | null>(null);
  const [greetingAudioPlayed, setGreetingAudioPlayed] = useState(false);
  // DISABLED: Follow-up functionality
  // const [followUpSent, setFollowUpSent] = useState(false);
  const [isGreetingAudioPlaying, setIsGreetingAudioPlaying] = useState(false);
  const [qrVehicleDetails, setQrVehicleDetails] = useState<any>(null);
  // DISABLED: Use ref to track follow-up state across all async operations
  // const followUpSentRef = useRef(false);
  const lastInventoryUpdateRef = useRef<string | null>(null);
  
  // Image gallery states
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [currentVehicleInfo, setCurrentVehicleInfo] = useState<{id: string, title: string} | null>(null);
  const [autoplayEnabled, setAutoplayEnabled] = useState(() => {
    // Load user preference from localStorage, default to true
    const saved = localStorage.getItem('daive_autoplay_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  
  // NEW: State for Crew AI toggle thinking indicator
  const [isCrewAIToggling, setIsCrewAIToggling] = useState(false);
  
  // NEW: Typewriter effect states
  const [typewriterText, setTypewriterText] = useState<string>('');
  const [isTypewriting, setIsTypewriting] = useState(false);
  const [currentTypewriterMessage, setCurrentTypewriterMessage] = useState<Message | null>(null);

  // Quick auth handlers
  const handleQuickAuthClose = () => {
    setShowQuickAuth(false);
  };

  const handleQuickAuthSuccess = (sessionData: any) => {
    login(sessionData);
    setShowQuickAuth(false);
    toast.success("Welcome! You're now logged in and can access all features");
    
    // Play greeting audio after successful login for QR code access
    if (hash && messages.length > 0) {
      const welcomeMessage = messages.find(msg => msg.role === 'assistant');
      if (welcomeMessage) {
        console.log('🎵 Playing greeting audio after successful login');
        setTimeout(() => {
          playGreetingAudio(welcomeMessage.content);
        }, 1000); // Small delay to ensure login is complete
      }
    }
  };

  // Fetch dealer information by ID
  const fetchDealerById = async (dealerId: string) => {
    try {
      setLoadingDealer(true);
      console.log('🔍 Fetching dealer by ID:', dealerId);
      
      const endpoint = buildApiUrl(`dealers/public/${dealerId}`);
      console.log('📡 Fetching dealer from:', endpoint);
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dealer: ${response.status}`);
      }
      
      const data = await response.json();
      setDealerInfo(data);
      
      // Set the effective dealer ID for D.A.I.V.E settings
      setEffectiveDealerId(data.id);
      console.log('✅ Set effective dealer ID from URL:', data.id);
      
      return data;
    } catch (error: any) {
      console.error("Error fetching dealer by ID:", error);
      toast.error("Failed to load dealer information");
      return null;
    } finally {
      setLoadingDealer(false);
    }
  };

  // Fetch dealer information from hash
  const fetchDealerFromHash = async (hash: string, vehicleIdentifier?: string) => {
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
      
      // Set the effective dealer ID for D.A.I.V.E settings
      setEffectiveDealerId(data.id);
      console.log('✅ Set effective dealer ID from URL:', data.id);
      
      // Fetch vehicle details if vehicle identifier is provided
      let vehicleDetails = null;
      if (vehicleIdentifier) {
        try {
          // Determine if it's a vehicleId or stockNumber based on format
          const isVehicleId = vehicleIdentifier.includes('-') && vehicleIdentifier.length === 36; // UUID format
          const isStockNumber = /^[A-Z0-9]+$/i.test(vehicleIdentifier); // Alphanumeric stock number
          
          console.log('🔍 Vehicle Identifier Analysis:', {
            vehicleIdentifier,
            length: vehicleIdentifier.length,
            hasHyphens: vehicleIdentifier.includes('-'),
            isAlphanumeric: /^[A-Z0-9]+$/i.test(vehicleIdentifier),
            isVehicleId,
            isStockNumber
          });
          
          console.log('🚗 Fetching vehicle details for:', {
            vehicleIdentifier,
            isVehicleId,
            isStockNumber,
            dealerId: data.id
          });
          
          let vehicleResponse;
          if (isVehicleId) {
            console.log('🔍 Using vehicleId endpoint');
            console.log('🔍 API URL:', buildApiUrl(`vehicles/public/${vehicleIdentifier}?dealerId=${data.id}`));
            vehicleResponse = await fetch(buildApiUrl(`vehicles/public/${vehicleIdentifier}?dealerId=${data.id}`));
          } else if (isStockNumber) {
            console.log('🔍 Using stockNumber endpoint');
            console.log('🔍 API URL:', buildApiUrl(`vehicles/public/by-stock/${vehicleIdentifier}?dealerId=${data.id}`));
            vehicleResponse = await fetch(buildApiUrl(`vehicles/public/by-stock/${vehicleIdentifier}?dealerId=${data.id}`));
          } else {
            console.log('⚠️ Unknown vehicle identifier format:', vehicleIdentifier);
            vehicleResponse = null;
          }
          
          if (vehicleResponse && vehicleResponse.ok) {
            const vehicleData = await vehicleResponse.json();
            console.log('🔍 Raw API Response:', vehicleData);
            vehicleDetails = vehicleData.data || vehicleData;
            console.log('✅ Vehicle details processed:', vehicleDetails);
            
            // Store QR vehicle details for image display and quick actions
            if (vehicleDetails) {
              setQrVehicleDetails(vehicleDetails);
            }
          } else {
            console.log('⚠️ Could not fetch vehicle details for:', vehicleIdentifier);
            if (vehicleResponse) {
              console.log('⚠️ Response status:', vehicleResponse.status);
            }
          }
        } catch (error) {
          console.log('⚠️ Error fetching vehicle details:', error);
        }
      }
      
      // Add welcome message with customer name if available
      const customerName = customer?.name && customer.name !== 'Guest User' ? customer.name : '';
      const firstName = customerName ? customerName.split(' ')[0] : '';
      
      // Create enhanced greeting with vehicle details
      let personalizedGreeting;
      console.log('🔍 Greeting Logic Debug:', {
        hasVehicleDetails: !!vehicleDetails,
        vehicleIdentifier,
        firstName,
        vehicleDetails: vehicleDetails ? {
          year: vehicleDetails.year,
          make: vehicleDetails.make,
          model: vehicleDetails.model,
          price: vehicleDetails.price,
          stock_number: vehicleDetails.stock_number
        } : null
      });
      
      if (vehicleDetails) {
        console.log('✅ Using ENHANCED QR greeting with vehicle details');
        const vehiclePrice = vehicleDetails.price ? `$${vehicleDetails.price.toLocaleString()}` : 'Price available upon request';
        const vehicleMileage = vehicleDetails.mileage ? `${vehicleDetails.mileage.toLocaleString()} miles` : 'Low mileage';
        const vehicleColor = vehicleDetails.color || 'Beautiful color';
        
        const stockNumber = vehicleDetails.stock_number || vehicleIdentifier;
        
        // QR Scan mode greeting - acknowledges the QR scan action
        personalizedGreeting = firstName 
          ? `Hello ${firstName}! Welcome to ${data.business_name}!\n\nThanks for scanning the vehicle QR code during your walkthrough — you're checking out the **${vehicleDetails.year} ${vehicleDetails.make} ${vehicleDetails.model}**, an excellent choice for comfort and performance!\n\n<button class="carfax-btn" data-vehicle-id="${vehicleDetails.id}" data-vehicle-year="${vehicleDetails.year}" data-vehicle-make="${vehicleDetails.make}" data-vehicle-model="${vehicleDetails.model}">View CARFAX</button>\n\nWould you like me to share more details about this ${vehicleDetails.model}, schedule a quick test drive, or go over financing options while you're here at the dealership?`
          : `Hello! Welcome to ${data.business_name}!\n\nThanks for scanning the vehicle QR code during your walkthrough — you're checking out the **${vehicleDetails.year} ${vehicleDetails.make} ${vehicleDetails.model}**, an excellent choice for comfort and performance!\n\n<button class="carfax-btn" data-vehicle-id="${vehicleDetails.id}" data-vehicle-year="${vehicleDetails.year}" data-vehicle-make="${vehicleDetails.make}" data-vehicle-model="${vehicleDetails.model}">View CARFAX</button>\n\nWould you like me to share more details about this ${vehicleDetails.model}, schedule a quick test drive, or go over financing options while you're here at the dealership?`;
      } else {
        console.log('⚠️ Using FALLBACK greeting - no vehicle details available');
        personalizedGreeting = firstName 
          ? `Welcome to ${data.business_name}, ${firstName}! I'm D.A.I.V.E, your AI assistant. I'm here to help you with any questions about our vehicles, financing, or services. How can I assist you today?`
          : `Welcome to ${data.business_name}! I'm D.A.I.V.E, your AI assistant. I'm here to help you with any questions about our vehicles, financing, or services. How can I assist you today?`;
      }
      
      // Debug fetchDealerFromHash greeting
      console.log('🏢 fetchDealerFromHash Greeting Debug:', {
        customerName,
        firstName,
        customer,
        isQRAccess,
        personalizedGreeting,
        vehicleDetails,
        vehicleIdentifier
      });
      
      const welcomeMessage: Message = {
        role: 'assistant',
        content: personalizedGreeting,
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
      
      // Mark that greeting audio will be played (prevents duplicate in sendInitialGreeting)
      greetingAudioPlayedRef.current = true;
      
      // Note: Greeting audio will be played after successful login in handleQuickAuthSuccess
      // This prevents audio from playing before authentication for QR code access
      
      return data;
    } catch (error: any) {
      console.error("Error fetching dealer from hash:", error);
      toast.error("Failed to load dealer information");
      return null;
    } finally {
      setLoadingDealer(false);
    }
  };
  const [typewriterEnabled, setTypewriterEnabled] = useState(() => {
    // Load user preference from localStorage, default to false (disabled)
    const saved = localStorage.getItem('daive_typewriter_enabled');
    return saved !== null ? saved === 'true' : false;
  });
  const [typewriterSpeed, setTypewriterSpeed] = useState(() => {
    // Load user preference from localStorage, default to 30ms
    const saved = localStorage.getItem('daive_typewriter_speed');
    return saved !== null ? parseInt(saved) : 30;
  });
  
  // NEW: Image gallery states
  const [currentGalleryImages, setCurrentGalleryImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Debug tab states
  const [activeTab, setActiveTab] = useState<'chat' | 'debug'>('chat');
  const [debugData, setDebugData] = useState<any>(null);
  const [lastIntentResult, setLastIntentResult] = useState<any>(null);
  const [lastSlotData, setLastSlotData] = useState<any>(null);
  const [conversationContext, setConversationContext] = useState<any>(null);
  const [journeyStages, setJourneyStages] = useState<any>(null);
  
  // NEW: Journey tracker visibility state (can be hidden when going live)
  const [showJourneyTracker, setShowJourneyTracker] = useState(() => {
    // Load user preference from localStorage, default to false (hidden) for production
    const saved = localStorage.getItem('daive_show_journey_tracker');
    return saved !== null ? saved === 'true' : false;
  });

  // Production mode flag - set to true to hide development controls
  const [isProductionMode, setIsProductionMode] = useState(() => {
    // Always default to production mode for safety
    const saved = localStorage.getItem('daive_production_mode');
    // Only allow dev mode if explicitly set to 'false'
    return saved === 'false' ? false : true; // Default to production mode
  });

  // NEW: Function to toggle journey tracker and save preference
  const toggleJourneyTracker = () => {
    const newValue = !showJourneyTracker;
    setShowJourneyTracker(newValue);
    localStorage.setItem('daive_show_journey_tracker', newValue.toString());
  };

  // Function to toggle production mode
  const toggleProductionMode = () => {
    const newValue = !isProductionMode;
    setIsProductionMode(newValue);
    localStorage.setItem('daive_production_mode', newValue.toString());
    console.log('🔄 Production mode toggled:', newValue ? 'enabled' : 'disabled');
    toast.success(newValue ? 'Production mode enabled - dev controls hidden' : 'Development mode enabled - dev controls shown');
  };

  // ✅ NEW: CarFax Modal Functions
  const fetchCarfaxData = async (vehicleId: string) => {
    setLoadingCarfax(true);
    try {
      // Get authentication tokens - check multiple sources
      const authToken = localStorage.getItem('auth_token');
      const customerToken = localStorage.getItem('customerToken');
      const tokenToUse = authToken || customerToken;
      
      console.log('🔐 CarFax Auth Check:', {
        hasAuthToken: !!authToken,
        hasCustomerToken: !!customerToken,
        usingToken: !!tokenToUse
      });
      
      const apiUrl = buildApiUrl(`vehicles/${vehicleId}/carfax/latest`);
      console.log('🚗 Fetching CarFax data from:', apiUrl);
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      // Add authorization header if token exists
      if (tokenToUse) {
        headers['Authorization'] = `Bearer ${tokenToUse}`;
        console.log('🔐 Adding authentication header to CarFax request');
      } else {
        console.warn('⚠️ No authentication token found for CarFax request');
      }
      
      const response = await fetch(apiUrl, {
        headers
      });
      
      const data = await response.json();
      console.log('📊 CarFax response:', data);
      
      if (data.success && data.report) {
        setCarfaxData(data.report);
        setShowCarfaxModal(true);
        toast.success('CarFax report loaded successfully');
      } else {
        toast.error('No CARFAX report available for this vehicle.');
      }
    } catch (error: any) {
      console.error('❌ Error fetching CARFAX data:', error);
      if (error.message?.includes('token')) {
        toast.error('Authentication required. Please log in to view CARFAX reports.');
      } else {
        toast.error('Failed to load CARFAX report. Please try again.');
      }
    } finally {
      setLoadingCarfax(false);
    }
  };

  const handleCarfaxClick = (vehicle: any) => {
    console.log('🔍 CarFax clicked for vehicle:', vehicle);
    setSelectedCarfaxVehicle(vehicle);
    fetchCarfaxData(vehicle.id);
  };

  const closeCarfaxModal = () => {
    setShowCarfaxModal(false);
    setCarfaxData(null);
    setSelectedCarfaxVehicle(null);
  };

  // Voice Activity Detection (VAD) state
  const [isVADEnabled, setIsVADEnabled] = useState(false);
  const [vadSensitivity, setVadSensitivity] = useState(0.5); // 0.1 to 1.0
  const vadRef = useRef<any>(null);
  const vadAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadDataArrayRef = useRef<Uint8Array | null>(null);
  const vadAnimationRef = useRef<number | null>(null);
  const vadThresholdRef = useRef(0.5);
  const vadSilenceCounterRef = useRef(0);
  const vadSilenceThresholdRef = useRef(10); // frames of silence before considering speech ended

  // Continuous voice mode state
  const [isContinuousVoiceMode, setIsContinuousVoiceMode] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const continuousVoiceModeRef = useRef(false);

  // Auto-stop recording on silence detection
  const recordingSilenceDetectionRef = useRef<number | null>(null);
  const recordingAnalyserRef = useRef<AnalyserNode | null>(null);
  const recordingSilenceCounterRef = useRef(0);
  const recordingSilenceThresholdRef = useRef(60); // frames of silence (~2 seconds at 60fps)
  const recordingVolumeThresholdRef = useRef(0.08); // Threshold to detect actual silence vs ambient noise
  const hasSpeechDetectedRef = useRef(false); // Track if actual speech has been detected

  // Speech synthesis user interaction state
  const [speechSynthesisEnabled, setSpeechSynthesisEnabled] = useState(false);
  
  // Flag to prevent duplicate greeting audio in QR mode
  const greetingAudioPlayedRef = useRef(false);
  
  // Function to create auth token from customer session
  const createAuthTokenFromCustomerSession = () => {
    try {
      const customerToken = localStorage.getItem('customerToken');
      const customerSession = localStorage.getItem('customerSession');
      
      console.log('🔍 Customer Session Debug:', {
        hasToken: !!customerToken,
        hasSession: !!customerSession,
        sessionData: customerSession ? JSON.parse(customerSession) : null
      });
      
      if (customerToken && customerSession) {
        const sessionData = JSON.parse(customerSession);
        
        console.log('🔍 Parsed Session Data:', sessionData);
        
        // Create a temporary auth token for TTS requests
        const authPayload = {
          type: 'customer',
          customer_id: sessionData.customer_id,
          dealer_id: effectiveDealerId,
          session_id: sessionData.id,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
        };
        
        // For now, let's try using the customer token directly but with additional headers
        console.log('🔐 Creating auth context from customer session:', {
          customerId: sessionData.customer_id,
          dealerId: effectiveDealerId,
          sessionId: sessionData.id,
          sessionDataKeys: Object.keys(sessionData)
        });
        
        return {
          token: customerToken,
          customerId: sessionData.customer_id,
          dealerId: effectiveDealerId,
          sessionId: sessionData.id
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error creating auth token from customer session:', error);
      return null;
    }
  };

  // Flag to track if greeting audio should be played on next user interaction
  const [shouldPlayGreetingOnInteraction, setShouldPlayGreetingOnInteraction] = useState(false);

  // Function to pause audio when user wants to interact
  const pauseAudioForUserInteraction = () => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
      setPlayingMessageId(null);
      console.log('🔇 Audio paused for user interaction');
    }
  };

  // Initialize Voice Activity Detection
  const initializeVAD = async () => {
    console.log('🔍 initializeVAD called, isVADEnabled:', isVADEnabled);
    
    if (!isVADEnabled) {
      console.log('🔍 VAD not enabled, skipping initialization');
      return;
    }

    try {
      console.log('🔍 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('🔍 Microphone access granted, creating audio context...');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      
      vadAnalyserRef.current = analyser;
      vadDataArrayRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array;
      vadRef.current = stream;
      
      console.log('🎤 Voice Activity Detection initialized successfully');
      console.log('🔍 VAD refs set:', {
        analyser: !!vadAnalyserRef.current,
        dataArray: !!vadDataArrayRef.current,
        stream: !!vadRef.current
      });
      
      startVADMonitoring();
      
    } catch (error) {
      console.error('❌ Failed to initialize VAD:', error);
      console.error('❌ Error details:', error.message);
      setIsVADEnabled(false);
      toast.error('Failed to initialize voice interruption detection. Please check microphone permissions.');
    }
  };

  // Start monitoring for voice activity
  const startVADMonitoring = () => {
    console.log('🔍 startVADMonitoring called');
    console.log('🔍 VAD refs check:', {
      analyser: !!vadAnalyserRef.current,
      dataArray: !!vadDataArrayRef.current
    });
    
    if (!vadAnalyserRef.current || !vadDataArrayRef.current) {
      console.log('❌ VAD refs not available, cannot start monitoring');
      return;
    }

    console.log('🔍 Starting VAD monitoring loop...');

    const checkVoiceActivity = () => {
      if (!vadAnalyserRef.current || !vadDataArrayRef.current) return;

      const dataArray = vadDataArrayRef.current;
      if (dataArray && vadAnalyserRef.current) {
        const newArray = new Uint8Array(vadAnalyserRef.current.frequencyBinCount);
        vadAnalyserRef.current.getByteFrequencyData(newArray);
        vadDataArrayRef.current = newArray;
      }
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < vadDataArrayRef.current.length; i++) {
        sum += vadDataArrayRef.current[i];
      }
      const averageVolume = sum / vadDataArrayRef.current.length;
      
      // Normalize volume (0-255 to 0-1)
      const normalizedVolume = averageVolume / 255;
      
      // Debug: Log volume every 30 frames (about once per second)
      if (Math.random() < 0.03) { // 3% chance = roughly once per second
        console.log('🔍 VAD Volume Check:', {
          volume: normalizedVolume.toFixed(4),
          threshold: vadThresholdRef.current,
          isPlaying,
          isRecording,
          willTrigger: normalizedVolume > vadThresholdRef.current && isPlaying && !isRecording
        });
      }
      
      // Check if volume exceeds threshold
      if (normalizedVolume > vadThresholdRef.current) {
        vadSilenceCounterRef.current = 0;
        
        // If AI is speaking and user starts talking, interrupt
        if (isPlaying && !isRecording) {
          console.log('🎤 Voice activity detected - interrupting AI audio');
          console.log('🔍 Volume:', normalizedVolume.toFixed(4), 'Threshold:', vadThresholdRef.current);
          pauseAudioForUserInteraction();
          // Optionally start recording automatically
          if (!isRecording) {
            startRecording();
          }
        }
      } else {
        vadSilenceCounterRef.current++;
      }
      
      vadAnimationRef.current = requestAnimationFrame(checkVoiceActivity);
    };
    
    checkVoiceActivity();
  };

  // Stop VAD monitoring
  const stopVADMonitoring = () => {
    if (vadAnimationRef.current) {
      cancelAnimationFrame(vadAnimationRef.current);
      vadAnimationRef.current = null;
    }
    
    if (vadRef.current) {
      vadRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      vadRef.current = null;
    }
    
    vadAnalyserRef.current = null;
    vadDataArrayRef.current = null;
    console.log('🎤 Voice Activity Detection stopped');
  };

  // Update VAD sensitivity
  const updateVADSensitivity = (sensitivity: number) => {
    setVadSensitivity(sensitivity);
    vadThresholdRef.current = sensitivity;
    console.log(`🎤 VAD sensitivity updated to: ${sensitivity}`);
  };

  // Toggle VAD on/off
  const toggleVAD = async () => {
    const newValue = !isVADEnabled;
    setIsVADEnabled(newValue);
    
    if (newValue) {
      await initializeVAD();
    } else {
      stopVADMonitoring();
    }
    
    localStorage.setItem('daive_vad_enabled', newValue.toString());
    console.log('🎤 VAD toggled:', newValue ? 'enabled' : 'disabled');
    toast.success(newValue ? 'Voice interruption detection enabled' : 'Voice interruption detection disabled');
  };
  // Initialize VAD on component mount
  useEffect(() => {
    console.log('🔍 VAD useEffect - Component mount');
    
    const savedVADEnabled = localStorage.getItem('daive_vad_enabled');
    console.log('🔍 Saved VAD enabled:', savedVADEnabled);
    
    // Set VAD enabled state based on localStorage or default to false
    const vadEnabled = savedVADEnabled !== null ? savedVADEnabled === 'true' : false;
    console.log('🔍 Setting VAD enabled to:', vadEnabled);
    setIsVADEnabled(vadEnabled);
    
    const savedSensitivity = localStorage.getItem('daive_vad_sensitivity');
    if (savedSensitivity !== null) {
      const sensitivity = parseFloat(savedSensitivity);
      setVadSensitivity(sensitivity);
      vadThresholdRef.current = sensitivity;
      console.log('🔍 VAD sensitivity loaded:', sensitivity);
    }
    
    // Initialize VAD after a short delay to ensure state is set
    setTimeout(() => {
      console.log('🔍 Attempting to initialize VAD, vadEnabled:', vadEnabled);
      if (vadEnabled) {
        initializeVAD();
      }
    }, 100);
    
    return () => {
      stopVADMonitoring();
      // Cleanup recording duration timer
      if (recordingDurationRef.current) {
        clearInterval(recordingDurationRef.current);
        recordingDurationRef.current = null;
      }
    };
  }, []);

  // Handle user interaction for speech synthesis
  useEffect(() => {
    const handleUserInteraction = () => {
      if (!speechSynthesisEnabled) {
        console.log('🎤 User interaction detected - enabling speech synthesis');
        setSpeechSynthesisEnabled(true);
        
        // Remove the event listeners after first interaction
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
      }
    };

    // Add event listeners for user interaction
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    // Cleanup function
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [speechSynthesisEnabled]);

  // Manual VAD test function (for debugging)
  const testVAD = async () => {
    console.log('🧪 Manual VAD test started');
    
    // Stop any playing audio before testing
    pauseAllAudio();
    
    console.log('🔍 Current VAD state:', {
      isVADEnabled,
      vadSensitivity,
      vadThreshold: vadThresholdRef.current,
      analyser: !!vadAnalyserRef.current,
      dataArray: !!vadDataArrayRef.current,
      stream: !!vadRef.current,
      isPlaying,
      isRecording
    });
    
    if (!isVADEnabled) {
      console.log('❌ VAD is disabled, enabling...');
      setIsVADEnabled(true);
      localStorage.setItem('daive_vad_enabled', 'true');
      await initializeVAD();
    } else if (!vadAnalyserRef.current) {
      console.log('❌ VAD refs missing, reinitializing...');
      await initializeVAD();
    } else {
      console.log('✅ VAD appears to be initialized');
      
      // Test volume detection
      if (vadAnalyserRef.current && vadDataArrayRef.current) {
        const testArray = new Uint8Array(vadAnalyserRef.current.frequencyBinCount);
        vadAnalyserRef.current.getByteFrequencyData(testArray);
        
        let sum = 0;
        for (let i = 0; i < testArray.length; i++) {
          sum += testArray[i];
        }
        const avgVolume = sum / testArray.length;
        const normalizedVolume = avgVolume / 255;
        
        console.log('🔍 Current volume test:', {
          rawVolume: avgVolume,
          normalizedVolume: normalizedVolume.toFixed(4),
          threshold: vadThresholdRef.current,
          aboveThreshold: normalizedVolume > vadThresholdRef.current
        });
      }
    }
  };

  // Force VAD to work (debugging function)
  const forceVAD = () => {
    console.log('🔧 Force VAD activation');
    
    // Stop any playing audio before forcing VAD
    pauseAllAudio();
    
    setIsVADEnabled(true);
    localStorage.setItem('daive_vad_enabled', 'true');
    localStorage.setItem('daive_vad_sensitivity', '0.2'); // Set to very sensitive
    setVadSensitivity(0.2);
    vadThresholdRef.current = 0.2;
    initializeVAD();
  };

  // Expose test function to window for console access
  useEffect(() => {
    (window as any).testVAD = testVAD;
    (window as any).forceVAD = forceVAD;
    console.log('🧪 VAD test functions available:');
    console.log('  - window.testVAD() - Test current VAD state');
    console.log('  - window.forceVAD() - Force VAD to work with high sensitivity');
  }, [isVADEnabled, vadSensitivity]);
  
  // Re-initialize VAD when enabled state changes
  useEffect(() => {
    console.log('🔍 VAD state changed useEffect, isVADEnabled:', isVADEnabled);
    if (isVADEnabled) {
      initializeVAD();
    } else {
      stopVADMonitoring();
    }
  }, [isVADEnabled]);
  
  // Continuous voice mode - auto-restart listening after AI response
  useEffect(() => {
    if (!isContinuousVoiceMode || !continuousVoiceModeRef.current) return;

    // When processing completes and we're not playing audio, start listening again
    if (!isProcessing && !isPlaying && !isRecording) {
      console.log('🔄 Continuous voice mode: Starting next listening cycle');
      
      // Small delay to ensure audio has fully stopped
      const timer = setTimeout(() => {
        if (continuousVoiceModeRef.current && !isRecording && !isProcessing) {
          console.log('🎤 Auto-starting recording for continuous conversation');
          startRecording();
        }
      }, 1000); // 1 second delay after AI finishes speaking

      return () => clearTimeout(timer);
    }
  }, [isProcessing, isPlaying, isRecording, isContinuousVoiceMode]);
  
  // NEW: Function to check if audio already exists for a specific greeting
  const hasGreetingAudio = (greetingText: string): boolean => {
    const cleanText = greetingText
      .replace(/\*\*/g, '')           // Remove double asterisks
      .replace(/\*/g, '')             // Remove single asterisks
      .replace(/`/g, '')              // Remove backticks
      .replace(/#{1,6}\s/g, '')      // Remove markdown headers
      .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')           // Normalize spaces
      .trim();
    
    const simpleHash = cleanText.split('').reduce((hash, char) => {
      return ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff;
    }, 0);
    
    // Check for audio with any voice type (since we don't know the current voice setting here)
    // This is a fallback check - the main audio generation will use the correct voice
    const keys = Object.keys(localStorage);
    const greetingKeys = keys.filter(key => key.startsWith('greeting_') && key.includes(simpleHash.toString(36)));
    
    return greetingKeys.length > 0;
  };
  
  // Function to clear audio cache
  const clearAudioCache = () => {
    const keys = Object.keys(localStorage);
    const audioKeys = keys.filter(key => key.startsWith('greeting_'));
    audioKeys.forEach(key => localStorage.removeItem(key));
    console.log('🗑️ Audio cache cleared:', audioKeys.length, 'files removed');
    
    // Also clear any old 'liam' cached files specifically
    const liamKeys = keys.filter(key => key.includes('greeting_liam_'));
    if (liamKeys.length > 0) {
      liamKeys.forEach(key => localStorage.removeItem(key));
      console.log('🗑️ Old Liam voice cache cleared:', liamKeys.length, 'files removed');
    }
  };
  
  // NEW: Function to clear cache for a specific voice
  const clearVoiceCache = (voiceName: string) => {
    const keys = Object.keys(localStorage);
    const voiceKeys = keys.filter(key => key.includes(`greeting_${voiceName}_`));
    voiceKeys.forEach(key => localStorage.removeItem(key));
    console.log(`🗑️ ${voiceName} voice cache cleared:`, voiceKeys.length, 'files removed');
  };
  
  // NEW: Function to force audio generation for testing
  const forceGreetingAudioGeneration = async () => {
    console.log('🔄 Force generating greeting audio...');
    
    // Clear any existing greeting text to force new generation
    localStorage.removeItem('daive_last_greeting_text');
    
    // Clear audio cache
    clearAudioCache();
    
    // Reset greeting audio state
    setGreetingAudioPlayed(false);
    setIsGreetingAudioPlaying(false);
    
    // Get the current greeting message
    const currentGreeting = messages.find(msg => msg.role === 'assistant')?.content;
    
    if (currentGreeting) {
      console.log('🎵 Force generating audio for current greeting:', currentGreeting.substring(0, 100) + '...');
      await playGreetingAudio(currentGreeting);
    } else {
      console.log('❌ No current greeting message found');
    }
  };
  
  // NEW: Function to check if greeting text has changed
  const hasGreetingChanged = (newGreeting: string): boolean => {
    const lastGreeting = localStorage.getItem('daive_last_greeting_text');
    if (!lastGreeting) {
      // First time, store the greeting
      localStorage.setItem('daive_last_greeting_text', newGreeting);
      return true;
    }
    
    // Check if greeting has changed
    if (lastGreeting !== newGreeting) {
      // Greeting changed, update stored version
      localStorage.setItem('daive_last_greeting_text', newGreeting);
      return true;
    }
    
    // Greeting hasn't changed
    return false;
  };
  
  // NEW: Function to show greeting audio cache status
  const showGreetingCacheStatus = () => {
    const keys = Object.keys(localStorage);
    const greetingKeys = keys.filter(key => key.startsWith('greeting_'));
    const lastGreeting = localStorage.getItem('daive_last_greeting_text');
    
    console.log('🔍 Greeting Audio Cache Status:');
    console.log('  - Last greeting text:', lastGreeting?.substring(0, 100) + '...');
    console.log('  - Cached audio files:', greetingKeys.length);
    greetingKeys.forEach(key => {
      const url = localStorage.getItem(key);
      console.log(`    ${key}: ${url?.substring(0, 50)}...`);
    });
    
    toast.info(`Greeting cache: ${greetingKeys.length} files, check console for details`);
  };
  
  // NEW: Function to clear only outdated greeting audio
  const clearOutdatedGreetingAudio = (newGreeting: string) => {
    const lastGreeting = localStorage.getItem('daive_last_greeting_text');
    if (lastGreeting && lastGreeting !== newGreeting) {
      // Only clear cache if greeting text has actually changed
      console.log('🔄 Greeting text changed, clearing outdated audio cache...');
      clearAudioCache();
    } else {
      console.log('✅ Greeting text unchanged, keeping existing audio cache');
    }
  };
  
  // Function to clear all caches and force fresh start
  const clearAllCaches = () => {
    // Clear audio cache
    clearAudioCache();
    
    // Clear autoplay preference
    localStorage.removeItem('daive_autoplay_enabled');
    
    // Clear last greeting text to force new audio generation
    localStorage.removeItem('daive_last_greeting_text');
    
    // Reset state
    setGreetingAudioPlayed(false);
    // DISABLED: Follow-up functionality
    // setFollowUpSent(false);
    // followUpSentRef.current = false;
    setIsGreetingAudioPlaying(false);
    setAutoplayEnabled(true);
    
    console.log('🗑️ All caches cleared, fresh start ready');
  };
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // DAIVESTEPS CREW PROCESS QUICK ACTIONS
  // These actions correspond to the 11-step daivesteps journey process
  const daivestepsQuickActions: QuickAction[] = [
    { 
      label: '1. Inquiry', 
      message: 'Hi! I\'m interested in your vehicles. How can you help me?',
      icon: '👋'
    },
    { 
      label: '2. Lead Capture', 
      message: 'I\'d like to provide my contact information.',
      icon: '📝'
    },
    { 
      label: '3. Vehicle Selection', 
      message: 'I\'m looking for a specific vehicle type. Can you help me find the right one?',
      icon: '🚗'
    },
    { 
      label: '4. Test Drive', 
      message: 'I\'d like to schedule a test drive.',
      icon: '🛣️'
    },
    { 
      label: '5. Trade Evaluation', 
      message: 'I have a vehicle to trade in. What\'s it worth?',
      icon: '💰'
    },
    { 
      label: '6. Qualification', 
      message: 'I\'d like to discuss financing and get pre-qualified.',
      icon: '📊'
    },
    { 
      label: '7. Purchase Commitment', 
      message: 'I\'m ready to buy this vehicle. What\'s next?',
      icon: '✅'
    },
    { 
      label: '8. Vehicle Preparation', 
      message: 'Tell me about vehicle preparation and services.',
      icon: '🔧'
    },
    { 
      label: '9. Finance Manager', 
      message: 'I\'m ready to finalize financing and paperwork.',
      icon: '📋'
    },
    { 
      label: '10. Delivery', 
      message: 'When can I take delivery of my vehicle?',
      icon: '🎉'
    },
    { 
      label: '11. CSI Follow-up', 
      message: 'I\'d like to provide feedback about my experience.',
      icon: '⭐'
    }
  ];

  // Quick action buttons for common questions
  // ENHANCED: These messages are now more conversational and detailed to trigger CrewAI responses
  // instead of simple inventory queries. CrewAI can provide comprehensive, helpful answers.
  const quickActions: QuickAction[] = (() => {
    // QR-scanned vehicle specific actions
    if (qrVehicleDetails && qrVehicleDetails.stock_number) {
      return [
        { label: '📋 Full Details', message: `Tell me everything about this ${qrVehicleDetails.year} ${qrVehicleDetails.make} ${qrVehicleDetails.model} including features, specifications, and history.` },
        { label: '🚗 Test Drive', message: `I want to test drive this ${qrVehicleDetails.year} ${qrVehicleDetails.make} ${qrVehicleDetails.model}. How do I schedule it?` },
        { label: '💰 Financing', message: `What financing options are available for this ${qrVehicleDetails.year} ${qrVehicleDetails.make} ${qrVehicleDetails.model}? What are the rates and terms?` },
        { label: '📸 More Photos', message: `Show me more photos and angles of this ${qrVehicleDetails.year} ${qrVehicleDetails.make} ${qrVehicleDetails.model}.` },
        { label: '🔍 Vehicle History', message: `What's the history of this vehicle? Any accidents, service records, or previous owners?` },
        { label: '⚖️ Trade-in Value', message: `What's my current vehicle worth as a trade-in for this ${qrVehicleDetails.year} ${qrVehicleDetails.make} ${qrVehicleDetails.model}?` },
        { label: '🛡️ Warranty', message: `What warranty coverage comes with this ${qrVehicleDetails.year} ${qrVehicleDetails.make} ${qrVehicleDetails.model}?` }
      ];
    }
    
    // Regular vehicle-specific actions
    if (vehicleId) {
      return [
        { label: 'Family Features', message: 'Tell me about safety features, seating, and cargo space for families.' },
        { label: 'Safety Info', message: 'What safety features, ratings, and technologies does this vehicle have?' },
        { label: 'Pricing', message: 'What\'s the pricing, options, financing terms, and any promotions?' },
        { label: 'Test Drive', message: 'I\'d like to schedule a test drive. What\'s the process?' },
        { label: 'Fuel Economy', message: 'What are the EPA ratings and real-world fuel economy?' },
        { label: 'Cargo Space', message: 'How much cargo space and storage capacity does this have?' },
        { label: 'Similar Options', message: 'Show me similar vehicles and help me compare features and pricing.' }
      ];
    }
    
    // General inventory actions
    return [
      { label: 'Show Inventory', message: 'What vehicles do you have available that fit my needs?' },
      { label: 'Family Cars', message: 'What family-friendly vehicles do you recommend?' },
      { label: 'Financing', message: 'What financing options, rates, and payment plans do you offer?' },
      { label: 'Test Drive', message: 'How do I schedule a test drive? What documents do I need?' },
      { label: 'SUV Options', message: 'What SUV models do you carry and what makes them special?' },
      { label: 'Sedan Options', message: 'What sedan models do you recommend for daily commuting?' },
      { label: 'New Arrivals', message: 'What new vehicles just arrived? Any special offers?' }
    ];
  })();

  const handleQuickAction = async (action: QuickAction) => {
    console.log('🚀 Quick action triggered:', action.label);
    console.log('🎤 Generating TTS audio for quick action without adding to chat');
    
    // Hide quick actions after use
    setShowQuickActions(false);
    setShowDaivestepsActions(false);
    setIsProcessing(true);
    
    // Reset inactivity timer when user takes a quick action
    resetInactivityTimer();
    
    try {
      const payload = {
        vehicleId: vehicleId || null,
        sessionId,
        message: action.message,
        customerInfo: {
          name: 'Customer',
          email: 'customer@dealership.com',
          dealerId: effectiveDealerId,
          sessionId: sessionId
        },
        // Include QR vehicle details if available
        ...(qrVehicleDetails && {
          vehicleDetails: qrVehicleDetails,
          stockNumber: qrVehicleDetails.stock_number
        })
      };

      console.log('📤 Sending quick action request to backend for TTS generation:', {
        vehicleId: vehicleId || 'null',
        sessionId,
        message: action.message.substring(0, 50) + '...',
        dealerId: effectiveDealerId || 'NOT PROVIDED'
      });

      // Use the main chat endpoint to get TTS audio
      const endpoint = buildApiUrl('daive/chat');
      
      // Get authentication token for the request
      const authToken = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if token exists
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('🔐 Adding authentication header to request');
      } else {
        console.warn('⚠️ No authentication token found - request may fail');
      }
      
      const response = await fetch(buildApiUrl('daive/chat'), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Quick action TTS generation failed:', response.status, errorText);
        toast.error('Failed to generate audio response. Please try again.');
        return;
      }

      const data = await response.json();
      console.log('📥 Quick action TTS response:', data);

      const responseText = data?.data?.response || data?.data?.message || '';
      console.log('📝 Extracted response text:', responseText);

      // Add the user's quick action text to chat first
      const userQuickActionMessage: Message = {
        role: 'user',
        content: action.message,
        timestamp: new Date().toISOString()
      };
      console.log('👤 Adding user quick action to chat:', userQuickActionMessage);
      
      setMessages(prev => {
        const newMessages = [...prev, userQuickActionMessage];
        console.log('📊 Updated messages array with user action, new count:', newMessages.length);
        return newMessages;
      });

      // If we got a text response from backend, add the assistant message to chat
      if (responseText) {
        console.log('✅ Adding assistant message to chat...');
        const assistantMessage: Message = {
          role: 'assistant',
          content: responseText,
          audioUrl: data.data?.audioResponseUrl || undefined,
          timestamp: new Date().toISOString()
        };
        console.log('📨 Created assistant message:', assistantMessage);
        
        setMessages(prev => {
          const newMessages = [...prev, assistantMessage];
          console.log('📊 Updated messages array with assistant response, new count:', newMessages.length);
          console.log('📋 All messages:', newMessages);
          return newMessages;
        });
        
        // Start typewriter effect for better UX
        console.log('⌨️ Starting typewriter effect...');
        setTimeout(() => {
          console.log('⏰ Typewriter effect timeout triggered');
          startTypewriterEffect(assistantMessage);
        }, 50);
      } else {
        console.log('⚠️ No response text found in data');
        console.log('🔍 Data structure:', JSON.stringify(data, null, 2));
      }

        // DISABLED: Frontend TTS generation for quick actions
        console.log('🎤 Quick action TTS DISABLED - only backend audio will play');
        console.log('🔍 Response that would have been processed:', responseText.substring(0, 100) + '...');

    } catch (error) {
      console.error('❌ Error generating TTS for quick action:', error);
      toast.error('Failed to generate audio response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to show quick actions again
  const showQuickActionsAgain = () => {
    setShowQuickActions(true);
    setShowDaivestepsActions(false);
    toast.info('Quick actions are now available again');
  };

  // Function to toggle to daivesteps actions
  const showDaivestepsActionsToggle = () => {
    setShowDaivestepsActions(true);
    setShowQuickActions(false);
    toast.info('DAIVESTEPS journey actions are now available');
  };

  // Function to toggle to regular actions
  const showRegularActionsToggle = () => {
    setShowQuickActions(true);
    setShowDaivestepsActions(false);
    toast.info('Regular quick actions are now available');
  };

  const refreshGreeting = () => {
    console.log('🔄 Refreshing greeting...');
    // Don't call sendInitialGreeting if we're in QR mode (hash exists) jawad
    // QR mode handles its own greeting via fetchDealerFromHash
    if (!hash) {
     sendInitialGreeting();
    } else {
      console.log('🔇 Skipping sendInitialGreeting in QR mode - greeting handled by fetchDealerFromHash');
    }
  };

  const clearCacheAndRefresh = async (silent: boolean = false) => {
    if (!silent) {
      console.log('🧹 Clearing cache and refreshing...');
    }
    
    try {
      // Call backend cache clearing endpoint
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        const response = await fetch(buildApiUrl('daive/clear-cache'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          if (!silent) console.log('✅ Backend cache cleared:', result);
        } else {
          if (!silent) console.log('⚠️ Could not clear backend cache');
        }
      }
      
      // Clear any stored session data
      setSessionId(`daive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      
      // Clear messages and restart
      setMessages([]);
      
      // Reset audio states
      setGreetingAudioPlayed(false);
      // DISABLED: Follow-up functionality
      // setFollowUpSent(false);
      // followUpSentRef.current = false;
      setIsGreetingAudioPlaying(false);
      
      // Force refresh by calling sendInitialGreeting (only if not in QR mode)
      setTimeout(() => {
        // Don't call sendInitialGreeting if we're in QR mode (hash exists)
        // QR mode handles its own greeting via fetchDealerFromHash
        if (!hash) {
          sendInitialGreeting();
        } else {
          console.log('🔇 Skipping sendInitialGreeting in QR mode - greeting handled by fetchDealerFromHash');
        }
      }, 100);
      
      if (!silent) {
        toast.success('Cache cleared and refreshed!');
      }
    } catch (error) {
      if (!silent) {
        console.error('Error clearing cache:', error);
        toast.error('Failed to clear cache');
      }
    }
  };

  const checkCurrentDealerContext = () => {
    console.log('🔍 Current Dealer Context Check:');
    console.log('  - dealerId prop:', dealerId);
    console.log('  - effectiveDealerId:', effectiveDealerId);
    console.log('  - dealerId type:', typeof dealerId);
    console.log('  - effectiveDealerId type:', typeof effectiveDealerId);
    console.log('  - dealerId length:', dealerId?.length);
    console.log('  - effectiveDealerId length:', effectiveDealerId?.length);
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
    // Priority 1: If we have a hash parameter (QR scan mode), use it first
    if (hash) {
      // Check if hash contains dealer ID (format: "dealerId:originalHash")
      const hashParts = hash.split(':');
      let actualHash = hash;
      let extractedDealerId = null;
      
      if (hashParts.length >= 2) {
        // Take the first part as dealer ID, join the rest as the original hash
        extractedDealerId = hashParts[0];
        actualHash = hashParts.slice(1).join(':');
        console.log('🔍 Extracted dealer ID from hash:', extractedDealerId);
        console.log('🔍 Original hash:', actualHash);
      }
      
      const stockNumber = searchParams.get('stk');
      // Extract vehicleId from the route if it's in the path
      const pathParts = window.location.hash.split('/');
      const vehicleIdFromRoute = pathParts[pathParts.length - 1]; // Last part of the path
      
      console.log('🔍 QR Debug - URL Parameters:', {
        hash,
        extractedDealerId,
        actualHash,
        stockNumber,
        vehicleIdFromRoute,
        pathParts,
        searchParams: Object.fromEntries(searchParams.entries()),
        fullUrl: window.location.href
      });
      
      // Use vehicleId from route if available, otherwise use stockNumber
      const vehicleIdentifier = vehicleIdFromRoute !== 'qr' ? vehicleIdFromRoute : stockNumber;
      
      if (extractedDealerId) {
        // Use extracted dealer ID
        console.log('🔍 Using extracted dealer ID:', extractedDealerId);
        fetchDealerById(extractedDealerId).then((dealerData) => {
          if (dealerData) {
            const newSessionId = `aibot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            setSessionId(newSessionId);
            
            // Send initial greeting AFTER dealer data is loaded and effectiveDealerId is set
            console.log('🔍 Dealer data loaded, effectiveDealerId should now be available:', effectiveDealerId);
            
            // Pass dealer ID directly to avoid timing issues
            console.log('🔍 About to call sendInitialGreeting with dealer ID:', dealerData.id);
            sendInitialGreeting(dealerData.id);
            
            // Start inactivity timer after greeting
            setTimeout(() => {
              resetInactivityTimer();
            }, 1000); // Start timer 1 second after greeting
          }
        });
      } else {
        // Fallback to original hash-based fetching
        console.log('🔍 Using original hash-based fetching');
        fetchDealerFromHash(actualHash, vehicleIdentifier || undefined).then((dealerData) => {
          if (dealerData) {
            const newSessionId = `aibot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            setSessionId(newSessionId);
            
            // fetchDealerFromHash already handles the greeting message
            // No need to call sendInitialGreeting() here
            
            // Start inactivity timer after greeting
            setTimeout(() => {
              resetInactivityTimer();
            }, 1000); // Start timer 1 second after greeting
          }
        });
      }
    } 
    // Priority 2: If we have dealerId (from props/navigation state) but no hash, use it directly
    else if (dealerId) {
      const newSessionId = `aibot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      setEffectiveDealerId(dealerId);
      
      console.log('✅ Using dealerId from props/navigation:', dealerId);
      
      // Send initial greeting (will include vehicle details if available)
      sendInitialGreeting();
      
      // Start inactivity timer after greeting
      setTimeout(() => {
        resetInactivityTimer();
      }, 1000); // Start timer 1 second after greeting
    } else {
      console.error('❌ No dealer ID or hash provided to AIBotPage');
      return;
    }
  }, [dealerId, hash, searchParams]);

  // NEW: Keyboard shortcut for skipping typewriter effect and user activity tracking
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Secret keyboard shortcut to toggle dev mode: Ctrl+Shift+D
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        toggleProductionMode();
        return;
      }
      
      if (event.code === 'Space' && isTypewriting) {
        event.preventDefault(); // Prevent page scroll
        skipTypewriterEffect();
        toast.info('⏭️ Typewriter effect skipped');
      }
      
      // Reset inactivity timer on any key press
      resetInactivityTimer();
    };

    const handleMouseMove = () => {
      // Reset inactivity timer on mouse movement
      resetInactivityTimer();
    };

    const handleClick = () => {
      // Reset inactivity timer on any click
      resetInactivityTimer();
    };

    const handleScroll = () => {
      // Reset inactivity timer on scroll
      resetInactivityTimer();
    };

    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll);
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [isTypewriting]);
  
  // NEW: Keyboard navigation for image gallery
  useEffect(() => {
    const handleGalleryKeyPress = (event: KeyboardEvent) => {
      if (!showImageGallery) return;
      
      switch (event.key) {
        case 'Escape':
          closeImageGallery();
          break;
        case 'ArrowLeft':
          prevImage();
          break;
        case 'ArrowRight':
          nextImage();
          break;
      }
    };

    if (showImageGallery) {
      document.addEventListener('keydown', handleGalleryKeyPress);
    }
    
    return () => {
      document.removeEventListener('keydown', handleGalleryKeyPress);
    };
  }, [showImageGallery]);

  // ✅ NEW: Handle CarFax button clicks using event delegation
  useEffect(() => {
    const handleCarfaxButtonClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if the clicked element is a carfax button or inside one
      const carfaxBtn = target.closest('.carfax-btn') as HTMLButtonElement;
      
      if (carfaxBtn) {
        event.preventDefault();
        event.stopPropagation();
        
        const vehicleId = carfaxBtn.getAttribute('data-vehicle-id');
        const vehicleYear = carfaxBtn.getAttribute('data-vehicle-year');
        const vehicleMake = carfaxBtn.getAttribute('data-vehicle-make');
        const vehicleModel = carfaxBtn.getAttribute('data-vehicle-model');
        
        if (vehicleId) {
          console.log('🚗 CarFax button clicked for vehicle:', { vehicleId, vehicleYear, vehicleMake, vehicleModel });
          
          // Create vehicle object for the modal
          const vehicle = {
            id: vehicleId,
            year: vehicleYear,
            make: vehicleMake,
            model: vehicleModel
          };
          
          handleCarfaxClick(vehicle);
        } else {
          console.warn('⚠️ CarFax button missing vehicle ID');
        }
      }
    };

    // Add click listener to document for event delegation
    document.addEventListener('click', handleCarfaxButtonClick);
    
    return () => {
      document.removeEventListener('click', handleCarfaxButtonClick);
    };
  }, [messages]); // Re-attach when messages change

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show quick auth modal for QR code access without valid session
  useEffect(() => {
    console.log('🔍 Quick Auth Check:', {
      hash,
      hasValidSession,
      loadingDealer,
      isCustomerAuthenticated,
      shouldShowModal: hash && !hasValidSession && !loadingDealer
    });
    
    // Check if user has proper authentication tokens
    const authToken = localStorage.getItem('auth_token');
    const customerToken = localStorage.getItem('customerToken');
    const hasProperAuth = authToken || customerToken;
    
    if (hash && !hasProperAuth && !loadingDealer) {
      console.log('✅ Showing quick auth modal - no proper authentication');
      setShowQuickAuth(true);
    } else if (hasProperAuth) {
      console.log('❌ Hiding modal - user has proper authentication');
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
  
  // DISABLED: Real-time inactivity timer countdown
  // useEffect(() => {
  //   if (!followUpSent && messages.length > 0) {
  //     const interval = setInterval(() => {
  //       // Force re-render to update countdown display
  //       setLastUserActivity(prev => prev);
  //     }, 1000);
      
  //     return () => clearInterval(interval);
  //   }
  // }, [followUpSent, messages.length]);
  
  // Debug messages
  useEffect(() => {
    console.log('🔍 Current messages:', messages);
    if (messages.some(msg => !msg.content)) {
      console.warn('⚠️ Found message without content:', messages.filter(msg => !msg.content));
    }
  }, [messages]);

  // Auto-fetch conversation data when session ID changes
  useEffect(() => {
    if (sessionId) {
      fetchConversationData();
    }
  }, [sessionId]);

  // Function to fetch conversation context and journey stages
  const fetchConversationData = async () => {
    if (!sessionId) return;
    
    try {
      // Fetch conversation history which includes context
      const response = await fetch(buildApiUrl(`daive/conversation/${sessionId}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setConversationContext(data.data);
          
          // Extract journey stages from conversation context
          if (data.data.context) {
            setJourneyStages({
              currentStage: data.data.context.stage,
              journeyStep: data.data.context.journeyStep,
              slots: data.data.context.slots,
              preferences: data.data.context.preferences,
              vehicleHistory: data.data.context.vehicle_history,
              lastUpdated: data.data.updated_at
            });
          }
        }
      } else if (response.status === 404) {
        // 404 is expected for new conversations (especially QR access)
        // Only log in development mode to reduce console noise
        if (import.meta.env.MODE === 'development') {
          console.log('ℹ️ No existing conversation found - this is normal for new sessions');
        }
      } else {
        console.warn('⚠️ Unexpected response status:', response.status);
      }
    } catch (error) {
      // Only log errors in development mode to reduce console noise
      if (import.meta.env.MODE === 'development') {
        console.error('Error fetching conversation data:', error);
      }
    }
  };

  // Auto-check backend status on component mount
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        setBackendStatus('Checking...');
        const response = await fetch(buildApiUrl('health'), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          setBackendStatus('✅ Online');
        } else {
          setBackendStatus('❌ Error');
        }
      } catch (error) {
        console.error('❌ Backend health check failed:', error);
        setBackendStatus('❌ Offline');
      }
    };

    // Check backend status after a short delay to allow component to mount
    const timeoutId = setTimeout(checkBackendStatus, 1000);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Automatic daily cache clearing to apply new changes
  useEffect(() => {
    const checkAndClearCache = async () => {
      const lastCacheCleared = localStorage.getItem('daive_last_cache_cleared');
      const now = Date.now();
      const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (!lastCacheCleared || now - parseInt(lastCacheCleared) > oneDayInMs) {
        // Clear cache silently once per day
        console.log('🔄 Auto-clearing cache (daily refresh)...');
      //  await clearCacheAndRefresh(true);
        localStorage.setItem('daive_last_cache_cleared', now.toString());
      }
    };
    
    // Check after 2 seconds to allow component to fully mount
    const timeoutId = setTimeout(checkAndClearCache, 2000);
    
    return () => clearTimeout(timeoutId);
  }, []);

  const sendInitialGreeting = async (dealerIdOverride?: string) => {
    // DISABLED: Reset follow-up state for fresh greeting
    // setFollowUpSent(false);
    // followUpSentRef.current = false;
    
    // Debug: Check if we're in QR mode with vehicle data
    console.log('🎯 sendInitialGreeting - Mode detection:', {
      isQRAccess,
      hasVehicleId: !!vehicleId,
      hasVehicleInfo: !!vehicleInfo,
      pathIncludesQR: location.pathname.includes('/qr/'),
      vehicleInfo,
      pathname: location.pathname
    });
    
    let greeting;
    let dealerInfo = null;
    
    try {
      // First, get dealer info to replace placeholders
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        try {
          const dealerResponse = await fetch(buildApiUrl('dealers/profile'), {
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
      
      // Try public prompts first (only if we have a dealer ID)
      if (effectiveDealerId) {
        try {
          const promptsResponse = await fetch(buildApiUrl(`daive/prompts/public?dealerId=${effectiveDealerId}`));
        
        if (promptsResponse.ok) {
          const promptsData = await promptsResponse.json();
          prompts = promptsData.data || {};
          
          console.log('🔍 Public prompts response:', promptsData);
          console.log('🔍 Available prompts:', Object.keys(prompts).join(', '));
          console.log('🔍 Greeting prompt:', prompts.greeting);
        }
        } catch (error) {
          console.log('⚠️ Could not fetch public prompts:', error);
        }
      }
      
      // If no greeting from public prompts, try authenticated prompts
      if (!prompts.greeting && authToken) {
        try {
          console.log('🔄 Trying authenticated prompts endpoint...');
          const authPromptsResponse = await fetch(buildApiUrl('daive/prompts'), {
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
        
        // ENHANCEMENT: If we have vehicle info and it's QR access mode, replace generic greeting with vehicle details
        if (vehicleInfo && vehicleId && (isQRAccess || location.pathname.includes('/qr/'))) {
          console.log('✅ Replacing database greeting with QR vehicle-specific greeting');
          const vehiclePrice = vehicleInfo.price ? `$${vehicleInfo.price.toLocaleString()}` : 'Price available upon request';
          const vehicleMileage = vehicleInfo.mileage ? `${vehicleInfo.mileage.toLocaleString()} miles` : 'Low mileage';
          const vehicleColor = vehicleInfo.color || 'Beautiful color';
          const stockNumber = vehicleInfo.stock_number || vehicleInfo.stockNumber || '';
          
          // Get customer name and dealership info
          const dealershipName = dealerInfo?.business_name || dealerInfo?.name || 'our dealership';
          const customerName = customer?.name && customer.name !== 'Guest User' ? customer.name : '';
          const firstName = customerName ? customerName.split(' ')[0] : '';
          
          // Build complete QR scan greeting with personalization
          greeting = firstName 
            ? `Hello ${firstName}! Welcome to ${dealershipName}!\n\nThanks for scanning the vehicle QR code during your walkthrough — you're checking out the **${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}**, an excellent choice for comfort and performance!`
            : `Hello! Welcome to ${dealershipName}!\n\nThanks for scanning the vehicle QR code during your walkthrough — you're checking out the **${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}**, an excellent choice for comfort and performance!`;
          
          // if (vehicleInfo.price) greeting += `\n• Price: ${vehiclePrice}`;
          // if (vehicleMileage) greeting += `\n• Mileage: ${vehicleMileage}`;
          // if (vehicleColor) greeting += `\n• Color: ${vehicleColor}`;
          // if (stockNumber) greeting += `\n• Stock #: ${stockNumber}`;
          
          greeting += `\n\n<button class="carfax-btn" data-vehicle-id="${vehicleId}" data-vehicle-year="${vehicleInfo.year}" data-vehicle-make="${vehicleInfo.make}" data-vehicle-model="${vehicleInfo.model}">View CARFAX</button>\n\nWould you like me to share more details about this ${vehicleInfo.model}, schedule a quick test drive, or go over financing options while you're here at the dealership?`;
          
          console.log('✅ Replaced greeting with vehicle-specific QR greeting:', greeting.substring(0, 150));
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
            
            // ENHANCEMENT: If we have vehicle info and it's QR access mode, replace generic greeting with vehicle details
            if (vehicleInfo && vehicleId && (isQRAccess || location.pathname.includes('/qr/'))) {
              console.log('✅ Replacing master prompt greeting with QR vehicle-specific greeting');
              const vehiclePrice = vehicleInfo.price ? `$${vehicleInfo.price.toLocaleString()}` : 'Price available upon request';
              const vehicleMileage = vehicleInfo.mileage ? `${vehicleInfo.mileage.toLocaleString()} miles` : 'Low mileage';
              const vehicleColor = vehicleInfo.color || 'Beautiful color';
              const stockNumber = vehicleInfo.stock_number || vehicleInfo.stockNumber || '';
              
              // Get customer name and dealership info
              const dealershipName = dealerInfo?.business_name || dealerInfo?.name || 'our dealership';
              const customerName = customer?.name && customer.name !== 'Guest User' ? customer.name : '';
              const firstName = customerName ? customerName.split(' ')[0] : '';
              
              // Build complete QR scan greeting with personalization
              greeting = firstName 
                ? `Hello ${firstName}! Welcome to ${dealershipName}!\n\nThanks for scanning the vehicle QR code during your walkthrough — you're checking out the **${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}**, an excellent choice for comfort and performance!`
                : `Hello! Welcome to ${dealershipName}!\n\nThanks for scanning the vehicle QR code during your walkthrough — you're checking out the **${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}**, an excellent choice for comfort and performance!`;
              
              // if (vehicleInfo.price) greeting += `\n• Price: ${vehiclePrice}`;
              // if (vehicleMileage) greeting += `\n• Mileage: ${vehicleMileage}`;
              // if (vehicleColor) greeting += `\n• Color: ${vehicleColor}`;
              // if (stockNumber) greeting += `\n• Stock #: ${stockNumber}`;
              
              greeting += `\n\n<button class="carfax-btn" data-vehicle-id="${vehicleId}" data-vehicle-year="${vehicleInfo.year}" data-vehicle-make="${vehicleInfo.make}" data-vehicle-model="${vehicleInfo.model}">View CARFAX</button>\n\nWould you like me to share more details about this ${vehicleInfo.model}, schedule a quick test drive, or go over financing options while you're here at the dealership?`;
              
              console.log('✅ Replaced master prompt greeting with vehicle-specific QR greeting');
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
        console.log('✅ Using NORMAL MODE greeting with vehicle details:', vehicleInfo);
        // Enhanced greeting with vehicle details - QR scan style
        const vehiclePrice = vehicleInfo.price ? `$${vehicleInfo.price.toLocaleString()}` : 'Price available upon request';
        const vehicleMileage = vehicleInfo.mileage ? `${vehicleInfo.mileage.toLocaleString()} miles` : 'Low mileage';
        const vehicleColor = vehicleInfo.color || 'Beautiful color';
        const stockNumber = vehicleInfo.stock_number || vehicleInfo.stockNumber || '';
        
        // Get customer name and dealership info
        const dealershipName = dealerInfo?.business_name || dealerInfo?.name || 'our dealership';
        const customerName = customer?.name && customer.name !== 'Guest User' ? customer.name : '';
        const firstName = customerName ? customerName.split(' ')[0] : '';
        
        // Build QR scan greeting with personalization
        greeting = firstName 
          ? `Hello ${firstName}! Welcome to ${dealershipName}!\n\nThanks for scanning the vehicle QR code during your walkthrough — you're checking out the **${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}**, an excellent choice for comfort and performance!`
          : `Hello! Welcome to ${dealershipName}!\n\nThanks for scanning the vehicle QR code during your walkthrough — you're checking out the **${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}**, an excellent choice for comfort and performance!`;
        
        // if (vehicleInfo.price) greeting += `\n• Price: ${vehiclePrice}`;
        // if (vehicleMileage) greeting += `\n• Mileage: ${vehicleMileage}`;
        // if (vehicleColor) greeting += `\n• Color: ${vehicleColor}`;
        // if (stockNumber) greeting += `\n• Stock #: ${stockNumber}`;
        
        greeting += `\n\n<button class="carfax-btn" data-vehicle-id="${vehicleId}" data-vehicle-year="${vehicleInfo.year}" data-vehicle-make="${vehicleInfo.make}" data-vehicle-model="${vehicleInfo.model}">View CARFAX</button>\n\nWould you like me to share more details about this ${vehicleInfo.model}, schedule a quick test drive, or go over financing options while you're here at the dealership?`;
      } else {
        console.log('⚠️ Using NORMAL MODE greeting without vehicle details');
        // Fetch dealer inventory to provide more specific greeting
        try {
          const authToken = localStorage.getItem('auth_token');
          if (authToken) {
            const inventoryResponse = await fetch(buildApiUrl(`vehicles?dealerId=${effectiveDealerId}&limit=5`), {
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
                  greeting = `Hi there! 👋 I'm **D.A.I.V.E.**, your AI assistant! I can help you find the perfect ${vehicleTypes[0]} from our inventory of **${vehicleCount} vehicles**. 🚗 What are you looking for today?`;
                } else {
                  greeting = `Hi there! 👋 I'm **D.A.I.V.E.**, your AI assistant! I can help you find the perfect vehicle from our inventory of **${vehicleCount} vehicles** including **${vehicleTypes.slice(0, 3).join(', ')}**. 🚗 What are you looking for today?`;
                }
              } else {
                greeting = `Hi there! 👋 I'm **D.A.I.V.E.**, your AI assistant! I can help you find the perfect vehicle from our inventory. 🚗 What are you looking for today?`;
              }
            } else {
              console.log('⚠️ Inventory API returned error:', inventoryResponse.status);
              greeting = `Hi there! 👋 I'm **D.A.I.V.E.**, your AI assistant! I can help you find the perfect vehicle from our inventory. 🚗 What are you looking for today?`;
            }
          } else {
            console.log('⚠️ No auth token for inventory greeting');
            greeting = `Hi there! 👋 I'm **D.A.I.V.E.**, your AI assistant! I can help you find the perfect vehicle from our inventory. 🚗 What are you looking for today?`;
          }
        } catch (error) {
          console.log('Could not fetch inventory for greeting:', error);
          greeting = `Hi there! 👋 I'm **D.A.I.V.E.**, your AI assistant! I can help you find the perfect vehicle from our inventory. 🚗 What are you looking for today?`;
        }
      }
    }
    
    // Add customer name to greeting if available
    const customerName = customer?.name && customer.name !== 'Guest User' ? customer.name : '';
    const firstName = customerName ? customerName.split(' ')[0] : '';
    let personalizedGreeting = greeting || 'WELCOME to **Clay Cooley Hyundai**! How can I help you today? I\'m here to help you find the **perfect vehicle**. What type of car are you looking for today? 🚗';
    
    // Debug greeting personalization
    console.log('🎯 Greeting Personalization Debug:', {
      customerName,
      firstName,
      isQRAccess,
      customer,
      originalGreeting: greeting,
      personalizedGreeting: personalizedGreeting
    });
    
    // If we have a customer name and this is a QR code access, personalize the greeting
    // BUT skip if the greeting already contains the customer's first name (to avoid duplication)
    if (firstName && isQRAccess && !personalizedGreeting.includes(firstName)) {
      console.log('✅ Personalizing greeting for customer:', firstName);
      // Try to insert customer name into the greeting naturally
      if (personalizedGreeting.includes('Hi there!')) {
        personalizedGreeting = personalizedGreeting.replace('Hi there!', `Hi ${firstName}!`);
      } else if (personalizedGreeting.includes('WELCOME')) {
        personalizedGreeting = personalizedGreeting.replace('WELCOME', `Welcome ${firstName}`);
      } else if (personalizedGreeting.includes('I\'m **D.A.I.V.E.**')) {
        personalizedGreeting = personalizedGreeting.replace('I\'m **D.A.I.V.E.**', `Hi ${firstName}! I'm **D.A.I.V.E.**`);
      } else if (personalizedGreeting.includes('Hello!')) {
        personalizedGreeting = personalizedGreeting.replace('Hello!', `Hi ${firstName}!`);
      } else {
        // Fallback: prepend personalized greeting
        personalizedGreeting = `Hi ${firstName}! ${personalizedGreeting}`;
      }
      console.log('✅ Personalized greeting:', personalizedGreeting);
    } else {
      console.log('❌ Not personalizing greeting. Reasons:', {
        hasFirstName: !!firstName,
        isQRAccess,
        alreadyPersonalized: personalizedGreeting.includes(firstName),
        firstName
      });
    }

    const greetingMessage = validateMessage({
      role: 'assistant',
      content: personalizedGreeting,
      timestamp: new Date().toISOString()
    });
    
    setMessages([greetingMessage]);
    
    // Auto-play audio for the greeting message (only if not already played in QR mode)
    console.log('🔍 Greeting Audio Check:', {
      greetingAudioPlayedRef: greetingAudioPlayedRef.current,
      hasValidSession,
      isCustomerAuthenticated,
      authToken: !!localStorage.getItem('auth_token'),
      customerToken: !!localStorage.getItem('customerToken')
    });
    
    if (!greetingAudioPlayedRef.current) {
      try {
        // Check if we already have audio for this greeting
        if (hasGreetingAudio(greetingMessage.content)) {
          console.log('✅ Greeting audio already exists, using cached version');
          // Clear any old cached audio for the previous greeting text
          clearOutdatedGreetingAudio(greetingMessage.content);
        } else {
          console.log('🆕 New greeting text detected, will generate audio');
          // Clear any old cached audio for the previous greeting text
          clearOutdatedGreetingAudio(greetingMessage.content);
        }
        
        await playGreetingAudio(greetingMessage.content, dealerIdOverride);
      } catch (error) {
        console.log('⚠️ Error playing greeting audio:', error);
      }
    } else {
      console.log('🔇 Skipping greeting audio - already played in QR mode');
      // Reset the flag for future greetings
      greetingAudioPlayedRef.current = false;
    }
    
      // The follow-up message will now be sent automatically when the greeting audio finishes
    // This prevents duplicate messages and ensures proper sequencing
    console.log('🎵 Greeting sent, waiting for audio completion to send follow-up...');
  };
  
  // ENABLED: Frontend TTS generation for greeting messages only
  const playGreetingAudio = async (text: string, dealerIdOverride?: string) => {
    console.log('🎵 playGreetingAudio called for greeting message:', text.substring(0, 100) + '...');
    console.log('🔍 Current state check:', {
      autoplayEnabled,
      greetingAudioPlayed,
      isGreetingAudioPlaying,
      textLength: text.length,
      hasValidSession,
      isCustomerAuthenticated
    });
    
    // Determine which dealer ID to use
    const dealerIdToUse = dealerIdOverride || effectiveDealerId;
    console.log('🔍 Dealer ID to use:', dealerIdToUse, '(override:', dealerIdOverride, ', effective:', effectiveDealerId, ')');
    
    // Check if autoplay is enabled by user
    if (!autoplayEnabled) {
      console.log('🎵 Autoplay disabled by user, skipping greeting audio...');
      return;
    }
    
    // ENHANCED: Only check greetingAudioPlayed for the FIRST greeting, not follow-ups
    const isFirstGreeting = text === messages[0]?.content;
    console.log('🔍 Is this the first greeting?', isFirstGreeting);
    
    if (isFirstGreeting && greetingAudioPlayed) {
      console.log('🎵 First greeting audio already played this session, skipping...');
      return;
    }
    
    // Prevent multiple audio from playing simultaneously
    if (isGreetingAudioPlaying) {
      console.log('🎵 Greeting audio already playing, skipping...');
      return;
    }
    
    try {
      // ✅ PRIORITY: Stop any vehicle card audio when backend audio is playing
      if (isVehicleCardVoicePlaying) {
        console.log('🔇 Stopping vehicle card audio for greeting audio priority...');
        stopVehicleCardAudio();
      }
      
      // Set flag to prevent multiple audio from playing
      setIsGreetingAudioPlaying(true);
      console.log('🎵 Set isGreetingAudioPlaying to true');
      
      // ✅ ENHANCED: Clean and enhance the text for TTS with emotional markers
      let cleanText = text
        .replace(/<button[^>]*>.*?<\/button>/gi, '')  // ✅ Remove all HTML button tags
        .replace(/<[^>]+>/g, '')        // Remove any remaining HTML tags
        .replace(/\*\*/g, '')           // Remove double asterisks
        .replace(/\*/g, '')             // Remove single asterisks
        .replace(/`/g, '')              // Remove backticks
        .replace(/#{1,6}\s/g, '')      // Remove markdown headers
        .replace(/\s+/g, ' ')           // Normalize spaces
        .trim();
      
      console.log('🧹 Stripped HTML buttons from TTS text');
      
      // 🎭 ADD EMOTIONAL ENHANCEMENTS for more human-like speech
      if (cleanText.includes('welcome') || cleanText.includes('help')) {
        // Add emotional markers for welcoming tone
        cleanText = cleanText.replace(/\./g, '!');  // Make periods into exclamations for enthusiasm
        cleanText = cleanText.replace(/\?/g, '?');  // Keep questions as questions
        
        // Add emphasis markers for key words
        cleanText = cleanText.replace(/(\b\w+\b)/g, (match, word) => {
          const keyWords = ['welcome', 'help', 'perfect', 'fantastic', 'amazing', 'great'];
          if (keyWords.some(key => word.toLowerCase().includes(key))) {
            return `*${word}*`; // Add emphasis markers
          }
          return word;
        });
      }
      
      // 🎵 ENHANCE EXCITEMENT for emoji and exclamation content
      if (text.includes('🚗') || text.includes('👋') || text.includes('!')) {
        // Add emotional variations for excitement
        cleanText = cleanText.replace(/\./g, '!');  // Convert periods to exclamations
        cleanText = cleanText.replace(/(\b\w+\b)/g, (match, word) => {
          const excitingWords = ['car', 'vehicle', 'dealership', 'inventory', 'help'];
          if (excitingWords.some(key => word.toLowerCase().includes(key))) {
            return `**${word}**`; // Add strong emphasis
          }
          return word;
        });
      }
      
      console.log('🧹 Text cleaned for TTS:', {
        original: text.substring(0, 100) + '...',
        cleaned: cleanText.substring(0, 100) + '...'
      });
      
      // FIXED: Get voice setting from database instead of hardcoded 'liam'
      let voiceSetting = 'mark'; // Default fallback to Mark voice
      try {
        const authToken = localStorage.getItem('auth_token');
        const customerToken = localStorage.getItem('customerToken');
        
        // Try to get voice settings with available token
        const dealerIdToUse = dealerIdOverride || effectiveDealerId;
        if ((authToken || customerToken) && dealerIdToUse) {
          const tokenToUse = authToken || customerToken;
          console.log('🎵 Attempting to load voice settings with token:', tokenToUse ? 'available' : 'none');
          console.log('🎵 Using dealer ID:', dealerIdToUse);
          
          const voiceResponse = await fetch(buildApiUrl(`daive/voice-settings?dealerId=${dealerIdToUse}`), {
            headers: {
              'Authorization': `Bearer ${tokenToUse}`
            }
          });
          
          console.log('🎵 Voice settings response status:', voiceResponse.status);
          
          if (voiceResponse.ok) {
            const voiceData = await voiceResponse.json();
            console.log('🎵 Voice settings response:', voiceData);
            if (voiceData.success && voiceData.data?.voice) {
              voiceSetting = voiceData.data.voice;
              console.log('🎵 Using voice setting from database:', voiceSetting);
            } else {
              console.log('⚠️ No voice setting in database response, using default:', voiceSetting);
            }
          } else {
            console.log('⚠️ Could not fetch voice settings (status:', voiceResponse.status, '), using default:', voiceSetting);
          }
        } else {
          console.log('⚠️ No auth token/customer token or dealer ID available, using default voice:', voiceSetting);
          console.log('🔍 Debug info:', {
            hasAuthToken: !!authToken,
            hasCustomerToken: !!customerToken,
            dealerIdToUse: dealerIdToUse,
            effectiveDealerId: effectiveDealerId,
            dealerIdOverride: dealerIdOverride
          });
        }
      } catch (error) {
        console.log('⚠️ Error fetching voice settings, using default:', voiceSetting, error);
      }
      
      // Check if we already have cached audio for this text (using database voice setting)
      const simpleHash = cleanText.split('').reduce((hash, char) => {
        return ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff;
      }, 0);
      const audioCacheKey = `greeting_${voiceSetting}_${simpleHash.toString(36)}`;
      const cachedAudioUrl = localStorage.getItem(audioCacheKey);
      
      // ENHANCED DEBUG: Log whether we're generating new audio or using cache
      if (cachedAudioUrl) {
        console.log('🎵 AUDIO CACHE HIT: Using existing audio file');
        console.log('  Cache key:', audioCacheKey);
        console.log('  Voice setting:', voiceSetting);
        console.log('🎵 Cached URL:', cachedAudioUrl);
      } else {
        console.log('🎵 AUDIO CACHE MISS: Generating new audio file');
        console.log('  Cache key:', audioCacheKey);
        console.log('  Voice setting:', voiceSetting);
        console.log('  Greeting text hash:', simpleHash.toString(36));
        console.log('🎵 Clean text length:', cleanText.length);
        console.log('  Clean text preview:', cleanText.substring(0, 100) + '...');
      }
      
      if (cachedAudioUrl) {
        console.log('🎵 Using cached audio for greeting (hash:', simpleHash.toString(36), ')');
        console.log('🎵 Cache key:', audioCacheKey);
        console.log('🎵 Voice setting:', voiceSetting);
        console.log('🎵 Cached URL:', cachedAudioUrl);
        await playCachedAudio(cachedAudioUrl, text);
        return;
      }
      
      console.log('🎤 Generating new audio for greeting message (hash:', simpleHash.toString(36), ')...');
      console.log('🎤 Cache key:', audioCacheKey);
      console.log('🎤 Voice setting:', voiceSetting);
      console.log('🎤 Clean text length:', cleanText.length);
      
      // Check if we have authentication for TTS
      const authToken = localStorage.getItem('auth_token');
      const customerToken = localStorage.getItem('customerToken');
      
      console.log('🔍 TTS Authentication Check:', {
        hasAuthToken: !!authToken,
        hasCustomerToken: !!customerToken,
        authTokenPreview: authToken ? authToken.substring(0, 20) + '...' : 'none',
        customerTokenPreview: customerToken ? customerToken.substring(0, 20) + '...' : 'none',
        hasValidSession,
        isCustomerAuthenticated
      });
      
      if (!authToken && !customerToken) {
        console.log('⚠️ No authentication for TTS - QR code access mode detected');
        console.log('⚠️ Browser speech synthesis requires user interaction, skipping audio for now');
        console.log('ℹ️ Audio will be available after user interaction (typing, clicking, etc.)');
        
        // Set a flag to indicate audio should be played on next user interaction
        setGreetingAudioPlayed(false); // Allow audio to play on next interaction
        setShouldPlayGreetingOnInteraction(true); // Mark that greeting should play on interaction
        setIsGreetingAudioPlaying(false);
        return;
      }
      
      // Use database settings from settingsManager.js - let backend choose the best TTS provider
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add authentication headers if available
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('🔐 Adding auth token to TTS request');
      } else if (customerToken) {
        headers['Authorization'] = `Bearer ${customerToken}`;
        console.log('🔐 Adding customer token to TTS request');
        
        // Note: Removed custom headers to avoid CORS issues
        // Customer context will be included in request body instead
      }
      
      console.log('📤 TTS Request Details:', {
        url: buildApiUrl('daive/tts'),
        headers,
        body: {
          text: cleanText.substring(0, 100) + '...',
          dealerId: dealerIdToUse || 'global',
          sessionId: sessionId,
          voice: voiceSetting,
          model: 'tts-1',
          saveToUploads: true
        }
      });
      
      const response = await fetch(buildApiUrl('daive/tts'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: cleanText, // Use cleaned text for TTS
          dealerId: dealerIdToUse || 'global',
          sessionId: sessionId,
          voice: voiceSetting,        // 🎯 USE DATABASE VOICE SETTING (not hardcoded 'liam')
          model: 'tts-1',       // Use the faster model
          saveToUploads: true,  // Flag to save to uploads folder
          // 🎯 NO HARDCODED PROVIDER - let backend use database settings from settingsManager.js
          
          // Add customer context if available
          ...(customerToken ? (() => {
            const authContext = createAuthTokenFromCustomerSession();
            return authContext ? {
              customerId: authContext.customerId,
              customerSessionId: authContext.sessionId
            } : {};
          })() : {}),
          
          // Backend will automatically:
          // 1. Get TTS provider from settingsManager.getTTSSettings(effectiveDealerId)
          // 2. Get API keys from settingsManager.getAPIKeys(effectiveDealerId)
          // 3. Choose the best working TTS provider
          // 4. Map voice names appropriately for each provider
        })
      });
      
      if (response.ok) {
        const audioData = await response.json();
        
        if (audioData.success && audioData.audioUrl) {
          console.log('✅ Greeting audio generated successfully with voice:', voiceSetting);
          
          // Cache the audio URL for future use (using database voice setting)
          localStorage.setItem(audioCacheKey, audioData.audioUrl);
          console.log('💾 Audio cached for future use with voice:', voiceSetting);
          
          // Play the audio
          await playCachedAudio(audioData.audioUrl, text);
          
        } else {
          console.log('⚠️ No audio URL in response:', audioData);
          console.log('⚠️ Full response:', audioData);
          
          // Fallback: Try browser speech synthesis
          console.log('🔄 Trying browser speech synthesis as fallback...');
          await playBrowserSpeech(cleanText);
        }
      } else {
        console.log('⚠️ Failed to generate greeting audio:', response.status);
        const errorText = await response.text();
        console.log('⚠️ Error response:', errorText);
        
        // Note: Public TTS endpoint doesn't exist, skipping fallback
        
        // Fallback: Try browser speech synthesis
        console.log('🔄 Trying browser speech synthesis as fallback...');
        console.log('ℹ️ Note: TTS backend is not working for customer sessions. This is a backend configuration issue.');
        await playBrowserSpeech(cleanText);
      }
    } catch (error) {
      console.log('⚠️ Error generating greeting audio:', error);
      
      // Fallback: Try browser speech synthesis
      console.log('🔄 Trying browser speech synthesis as fallback...');
      try {
        await playBrowserSpeech(text);
      } catch (fallbackError) {
        console.error('❌ Browser speech synthesis also failed:', fallbackError);
        // At this point, we've exhausted all audio options
        console.log('ℹ️ All audio options failed, continuing without audio');
      }
    } finally {
      // Always reset the playing flag
      setIsGreetingAudioPlaying(false);
      console.log('🎵 Reset isGreetingAudioPlaying to false');
    }
  };
  
  // NEW: Function to delete previous greeting audio files from uploads folder
  const deletePreviousGreetingAudioFiles = async () => {
    try {
      console.log('🗑️ Deleting previous greeting audio files from uploads...');
      
      // Call backend endpoint to delete old greeting audio files
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        const response = await fetch(buildApiUrl('daive/clear-greeting-audio'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dealerId: dealerId || 'global',
            sessionId: sessionId
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Previous greeting audio files deleted:', result);
          toast.success('🗑️ Previous greeting audio files cleaned up');
        } else {
          console.log('⚠️ Could not delete greeting audio files:', response.status);
          toast.warning('⚠️ Could not clean up previous audio files');
        }
      } else {
        console.log('⚠️ No auth token for deleting greeting audio files');
      }
    } catch (error) {
      console.log('⚠️ Error deleting greeting audio files:', error);
    }
  };
  
  // Play cached audio
  const playCachedAudio = async (audioUrl: string, originalText: string) => {
    try {
      // Create audio element and play automatically
      const fullAudioUrl = buildBackendAssetUrl(audioUrl);
      console.log('🎵 playCachedAudio - Original URL:', audioUrl);
      console.log('🎵 playCachedAudio - Full backend URL:', fullAudioUrl);
      
      const audio = new Audio(fullAudioUrl);
      audio.crossOrigin = 'anonymous'; // Enable CORS for cross-origin audio
      audio.preload = 'auto';
      audio.volume = 0.8; // Set reasonable volume for autoplay
      
      // Add error event listener for debugging
      audio.addEventListener('error', (e) => {
        console.error('❌ Greeting audio loading error:', e);
        console.error('🔍 Audio error details:', {
          error: audio.error,
          networkState: audio.networkState,
          readyState: audio.readyState,
          src: audio.src
        });
        
        // Try fallback to browser speech synthesis
        console.log('🔄 Attempting fallback to browser speech synthesis...');
        playBrowserSpeech(originalText);
      });
      
              // Play the audio
        try {
          await audio.play();
          console.log('🎵 Greeting audio playing automatically');
          
          // Mark that greeting audio has been played
          setGreetingAudioPlayed(true);
          
          // Update the greeting message to include the audio URL
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.role === 'assistant' && msg.content === originalText
                ? { ...msg, audioUrl: audioUrl }
                : msg
            )
          );
          
                                // DISABLED: Wait for this audio to finish and start inactivity timer
      // audio.addEventListener('ended', () => {
      //   console.log('🎵 Greeting audio finished, starting inactivity timer...');
      //   // Reset the playing flag
      //   setIsGreetingAudioPlaying(false);
      //   // Start inactivity timer for contextual follow-up
      //   resetInactivityTimer();
      // });
          
        } catch (playError) {
          console.log('⚠️ Could not autoplay greeting audio (browser policy):', playError);
          console.log('🔍 Play error details:', {
            name: playError.name,
            message: playError.message,
            code: playError.code
          });
          // Reset the playing flag
          setIsGreetingAudioPlaying(false);
          // Still update the message with audio URL for manual play
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.role === 'assistant' && msg.content === originalText
                ? { ...msg, audioUrl: audioUrl }
                : msg
            )
          );
          
                   // DISABLED: If autoplay fails, start inactivity timer
         // if (!followUpSentRef.current) {
         //   resetInactivityTimer();
         // }
       }
     } catch (error) {
       console.log('⚠️ Error playing cached audio:', error);
       
       // DISABLED: If there's an error, start inactivity timer
       // if (!followUpSentRef.current) {
       //   resetInactivityTimer();
       // }
     }
  };
  
  // Fallback: Use browser's built-in speech synthesis
  const playBrowserSpeech = async (text: string) => {
    try {
      if ('speechSynthesis' in window) {
        console.log('🎤 Using browser speech synthesis...');
        
        // Clean the text for speech synthesis too
        const cleanText = text
          .replace(/\*\*/g, '')           // Remove double asterisks
          .replace(/\*/g, '')             // Remove single asterisks
          .replace(/`/g, '')              // Remove backticks
          .replace(/#{1,6}\s/g, '')      // Remove markdown headers
          .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special characters
          .replace(/\s+/g, ' ')           // Normalize spaces
          .trim();
        
        console.log('🧹 Text cleaned for browser speech:', cleanText);
        
        // Check if speech synthesis is allowed (user interaction required)
        if (speechSynthesis.speaking) {
          console.log('⚠️ Speech synthesis already in progress, stopping current speech...');
          speechSynthesis.cancel();
        }
        
        // ENHANCED: Create speech synthesis utterance with human-like emotions
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // 🎭 EMOTIONAL VOICE SETTINGS for greeting
        utterance.rate = 0.85;        // Slightly slower for warmth and clarity
        utterance.pitch = 1.15;       // Slightly higher pitch for enthusiasm and friendliness
        utterance.volume = 0.9;       // Clear volume for welcoming tone
        
        // 🎵 ADD EMOTIONAL VARIATIONS based on greeting content
        if (cleanText.includes('!') || cleanText.includes('🚗') || cleanText.includes('👋')) {
          // Excited greeting - more enthusiasm
          utterance.pitch = 1.25;     // Higher pitch for excitement
          utterance.rate = 0.8;       // Slightly slower to emphasize excitement
        } else if (cleanText.includes('welcome') || cleanText.includes('help')) {
          // Welcoming tone - warm and friendly
          utterance.pitch = 1.1;      // Slightly higher for warmth
          utterance.rate = 0.9;       // Natural pace for friendliness
        }
        
        // ENHANCED: Try to use the most expressive and human-like voice available
        const voices = speechSynthesis.getVoices();
        
        // 🎭 PRIORITIZE EXPRESSIVE VOICES for better emotions
        const preferredVoice = voices.find(voice => 
          voice.name.includes('Samantha') ||      // Very expressive, warm
          voice.name.includes('Alex') ||          // Natural, friendly
          voice.name.includes('Victoria') ||      // Clear, engaging
          voice.name.includes('Daniel') ||        // Warm, welcoming
          voice.name.includes('Google') ||        // Good quality
          voice.name.includes('Microsoft')        // Reliable fallback
        );
        
        // 🎵 SELECT VOICE BASED ON GREETING TYPE
        let selectedVoice = preferredVoice;
        
        if (cleanText.includes('!') || cleanText.includes('🚗')) {
          // Excited greeting - prefer higher-pitched, energetic voices
          const energeticVoice = voices.find(voice => 
            voice.name.includes('Samantha') || 
            voice.name.includes('Victoria') ||
            voice.name.includes('Google')
          );
          if (energeticVoice) selectedVoice = energeticVoice;
        } else if (cleanText.includes('welcome') || cleanText.includes('help')) {
          // Welcoming greeting - prefer warm, friendly voices
          const warmVoice = voices.find(voice => 
            voice.name.includes('Alex') || 
            voice.name.includes('Daniel') ||
            voice.name.includes('Microsoft')
          );
          if (warmVoice) selectedVoice = warmVoice;
        }
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          console.log('🎤 Using enhanced voice:', selectedVoice.name);
          console.log('🎭 Voice settings:', {
            rate: utterance.rate,
            pitch: utterance.pitch,
            volume: utterance.volume,
            emotion: cleanText.includes('!') ? 'excited' : 'welcoming'
          });
        }
        
        // Add event listener for when speech ends
        utterance.onend = () => {
          console.log('🎤 Browser speech synthesis finished, starting inactivity timer...');
          // Start inactivity timer for contextual follow-up
          resetInactivityTimer();
        };
        
        // Add event listener for speech errors
        utterance.onerror = (event) => {
          console.error('❌ Browser speech synthesis error:', event);
          console.error('🔍 Speech error details:', {
            error: event.error,
            type: event.type,
            charIndex: event.charIndex,
            elapsedTime: event.elapsedTime,
            name: event.name
          });
          
          // Handle specific error types
          if (event.error === 'not-allowed') {
            console.log('🔒 Speech synthesis blocked by browser policy - user interaction required');
            console.log('ℹ️ This is normal behavior. Speech will work after user interaction.');
            
            // Show a subtle notification to the user
            toast.info('🔊 Click anywhere to enable voice responses', {
              duration: 3000,
              position: 'top-center'
            });
            
            // Set up a one-time click listener to enable speech
            const enableSpeechOnClick = () => {
              console.log('🎤 User interaction detected, speech synthesis should now work');
              document.removeEventListener('click', enableSpeechOnClick);
              document.removeEventListener('touchstart', enableSpeechOnClick);
            };
            
            document.addEventListener('click', enableSpeechOnClick, { once: true });
            document.addEventListener('touchstart', enableSpeechOnClick, { once: true });
          }
          
          // If speech fails, start inactivity timer
          resetInactivityTimer();
        };
        
        // Try to play the speech
        try {
          // Check if user interaction is required
          if (!speechSynthesisEnabled) {
            console.log('🔒 Speech synthesis requires user interaction - showing notification');
            toast.info('🔊 Click anywhere to enable voice responses', {
              duration: 3000,
              position: 'top-center'
            });
            
            // Don't attempt to speak yet, wait for user interaction
            return;
          }
          
          speechSynthesis.speak(utterance);
          console.log('🎵 Browser speech synthesis playing');
          
          // Mark that greeting audio has been played
          setGreetingAudioPlayed(true);
        } catch (speakError) {
          console.error('❌ Failed to start speech synthesis:', speakError);
          
          if (speakError instanceof Error && speakError.message.includes('not-allowed')) {
            console.log('🔒 Speech synthesis blocked - user interaction required');
            toast.info('🔊 Click anywhere to enable voice responses', {
              duration: 3000,
              position: 'top-center'
            });
          }
          
          // Start inactivity timer since speech failed
          resetInactivityTimer();
        }
        
      } else {
        console.log('⚠️ Browser speech synthesis not available');
        // DISABLED: If speech synthesis is not available, start inactivity timer
        // if (!followUpSent) {
        //   resetInactivityTimer();
        // }
      }
    } catch (error) {
      console.error('❌ Error with browser speech synthesis:', error);
      console.error('🔍 Speech synthesis error details:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // DISABLED: If there's an error, start inactivity timer
      // if (!followUpSent) {
      //   resetInactivityTimer();
      // }
    }
  };

  // DISABLED: Inactivity timer for context-aware follow-up messages
  // const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);
  // const [lastUserActivity, setLastUserActivity] = useState<number>(Date.now());
  
  // Function to reset inactivity timer (DISABLED)
  const resetInactivityTimer = () => {
    // Follow-up functionality is currently disabled
    // setLastUserActivity(Date.now());
    
    // Clear existing timer
    // if (inactivityTimer) {
    //   clearTimeout(inactivityTimer);
    // }
    
    // Set new 30-second timer
    // const timer = setTimeout(() => {
    //   sendContextualFollowUp();
    // }, 30000); // 30 seconds
    
    // setInactivityTimer(timer);
  };
  
  // Function to send context-aware follow-up message after 30 seconds of inactivity (DISABLED)
  const sendContextualFollowUp = async () => {
    // Follow-up functionality is currently disabled
    console.log('🔄 Follow-up functionality is currently disabled');
    return;
    
    // DISABLED CODE BELOW:
    // // Only send if we have at least one message and no follow-up has been sent
    // if (messages.length === 0 || followUpSentRef.current || followUpSent) {
    //   console.log('🔄 Follow-up already sent or no messages, skipping...');
    //   return;
    // }
    
    // // Check if user has been inactive for at least 30 seconds
    // const timeSinceLastActivity = Date.now() - lastUserActivity;
    // if (timeSinceLastActivity < 30000) {
    //   console.log('⏰ User activity detected recently, skipping follow-up...');
    //   return;
    // }
    
    // // Set both state and ref flags to prevent multiple follow-ups
    // setFollowUpSent(true);
    // followUpSentRef.current = true;
    // console.log('🚀 Sending contextual follow-up message after 30s inactivity...');
    
    // let followUpMessage = '';
    
    // // Analyze chat context to generate relevant follow-up
    // const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    // const lastAssistantMessage = messages.filter(msg => msg.role === 'assistant').pop();
    
    // if (lastUserMessage && lastAssistantMessage) {
    //   // Generate context-aware follow-up based on the conversation
    //   const userContent = lastUserMessage.content.toLowerCase();
    //   const assistantContent = lastAssistantMessage.content.toLowerCase();
      
    //   if (userContent.includes('test drive') || userContent.includes('schedule')) {
    //     followUpMessage = `I noticed you mentioned test drives! 🚗 Would you like me to help you **schedule a test drive** or provide more details about the process?`;
    //   } else if (userContent.includes('price') || userContent.includes('cost') || userContent.includes('financing')) {
    //     followUpMessage = `I see you're interested in pricing and financing! 💰 Would you like me to explain our **financing options**, **payment plans**, or help you **calculate monthly payments**?`;
    //   } else if (userContent.includes('inventory') || userContent.includes('available') || userContent.includes('show')) {
    //     followUpMessage = `I can see you're looking at our inventory! 🔍 Would you like me to show you **similar vehicles**, **new arrivals**, or help you **filter by specific criteria** like price or features?`;
    //   } else if (userContent.includes('features') || userContent.includes('specs') || userContent.includes('technology')) {
    //     followUpMessage = `Great question about features! ✨ Would you like me to explain the **safety features**, **technology package**, or **performance specifications** in more detail?`;
    //   } else if (vehicleInfo && vehicleId) {
    //     // Vehicle-specific contextual follow-up
    //     followUpMessage = `I'd love to tell you more about this **${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}**! 🚗 What interests you most - the **features**, **pricing**, or would you like to **schedule a test drive**?`;
    //   } else {
    //     // General contextual follow-up based on conversation flow
    //     followUpMessage = `I'm here to help you find the perfect vehicle! 🎯 Based on our conversation, would you like me to **show you more options**, **explain anything in detail**, or help you **take the next step**?`;
    //   }
    // } else if (vehicleInfo && vehicleId) {
    //   // Fallback to vehicle-specific follow-up if no conversation context
    //   followUpMessage = `I'd love to tell you more about this **${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}**! 🚗 What interests you most - the **features**, **pricing**, or would you like to **schedule a test drive**?`;
    // } else {
    //   // General dealership follow-up
    //   const followUpOptions = [
    //     "I can show you our **current inventory**, help with **financing questions**, or **schedule a test drive**. What would you like to start with?",
    //     "I'm excited to help you find your **next vehicle**! 🎯 Are you looking for something specific, or would you like me to show you what we have available?",
    //     "I'd love to get to know what you're looking for! 💡 Are you interested in a particular **brand**, **type of vehicle**, or **price range**?",
    //     "I'm here to make your car shopping experience **easy and fun**! ✨ What brings you in today?",
    //     "Let me know what interests you most - **inventory**, **financing**, **test drives**, or **specific features** you're looking for!"
    //   ];
      
    //   followUpMessage = followUpOptions[Math.floor(Math.random() * followUpOptions.length)];
    // }
    
    // // Add the follow-up message
    // const followUpMessageObj = validateMessage({
    //   role: 'assistant',
    //   content: followUpMessage,
    //   timestamp: new Date().toISOString()
    // });
    
    // setMessages(prevMessages => [...prevMessages, followUpMessageObj]);
    
    // // Start typewriter effect for the follow-up message
    // setTimeout(() => {
    //   startTypewriterEffect(followUpMessageObj);
    // }, 100); // Small delay to ensure message is rendered
    
    // // Auto-scroll to show the new message
    // setTimeout(() => {
    //   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    //   }, 100);
    
    // console.log('✅ Contextual follow-up sent:', followUpMessage.substring(0, 100) + '...');
  };

  // Check API settings on component mount
  useEffect(() => {
    const checkApiSettings = async () => {
      try {
        // Only check API settings if we have authentication
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          console.log('⚠️ No auth token - skipping API settings check for public access');
          return;
        }
        
        const response = await fetch(buildApiUrl(`daive/api-settings?dealerId=${effectiveDealerId}`), {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const settings = data.data;
          
          // Check if speech provider is configured
          const speechProvider = settings.voice_speech_provider?.value || settings.voice_speech_provider;
          const hasOpenAI = settings.openai_key?.value;
          const hasDeepgram = settings.deepgram_key?.value;
          
          console.log('🔍 Speech provider configuration check:');
          console.log('   speechProvider:', speechProvider);
          console.log('   hasOpenAI:', !!hasOpenAI);
          console.log('   hasDeepgram:', !!hasDeepgram);
          
          if (speechProvider === 'deepgram' && !hasDeepgram) {
            toast.warning('Deepgram API key not configured. Voice recognition may not work.');
          } else if (speechProvider === 'whisper' && !hasOpenAI) {
            toast.warning('OpenAI API key not configured. Voice recognition may not work.');
          } else if (!speechProvider) {
            console.log('⚠️ No speech provider found in settings');
            toast.info('Speech provider not configured. Using default settings.');
          } else {
            console.log('✅ Speech provider configured:', speechProvider);
          }
        } else {
          console.log('⚠️ Could not check API settings:', response.status);
        }
      } catch (error) {
        console.log('⚠️ Could not check API settings:', error);
      }
    };

    if (effectiveDealerId) {
      checkApiSettings();
    }
  }, [effectiveDealerId]);

  // Check Crew AI settings
  useEffect(() => {
        const checkCrewAISettings = async () => {
      try {
        console.log('🔍 Checking Crew AI settings for dealer:', effectiveDealerId);
        
        // Only check Crew AI settings if we have authentication
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          console.log('⚠️ No auth token - skipping Crew AI settings check for public access');
          setCrewAIEnabled(false);
          setUseCrewAI(false);
          return;
        }
        
        const response = await fetch(buildApiUrl(`daive/crew-ai-settings?dealerId=${effectiveDealerId}`), {
          headers: {
            'Authorization': `Bearer ${authToken}`
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

    if (effectiveDealerId) {
      checkCrewAISettings();
    }
  }, [effectiveDealerId]);

  // Initialize MediaRecorder function - called when needed
  const initializeMediaRecorder = async () => {
    try {
      console.log('🎤 Initializing MediaRecorder...');
      
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
          // Ensure we're working with a fresh array
          if (!audioChunksRef.current) {
            audioChunksRef.current = [];
          }
          
          // Only add chunks if we're actually recording
          if (recorder.state === 'recording' || recorder.state === 'inactive') {
            audioChunksRef.current.push(event.data);
            console.log(`📦 Audio chunk received: ${event.data.size} bytes`);
            console.log(`📊 Total chunks: ${audioChunksRef.current.length}`);
          } else {
            console.log('⚠️ Ignoring chunk - recorder not in valid state:', recorder.state);
          }
        }
      };
      
      recorder.onstop = () => {
        console.log('🛑 Recording stopped event fired, processing audio chunks...');
        console.log('🔍 Audio chunks ref length:', audioChunksRef.current?.length || 0);
        
        // Stop all tracks to release the microphone
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop();
            console.log('🎤 Audio track stopped');
          });
        }
        
        if (audioChunksRef.current && audioChunksRef.current.length > 0) {
          const mimeType = recorder.mimeType || 'audio/wav';
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          setAudioBlob(blob);
          console.log(`✅ Audio blob created: ${(blob.size / 1024).toFixed(2)} KB`);
          console.log('🎵 Processing with ${audioChunksRef.current.length} chunks');
          
          // Process the audio
          handleVoiceSubmission(blob);
          
          // Clear chunks after processing to prevent re-use
          audioChunksRef.current = [];
          setAudioChunks([]);
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
      console.log('✅ MediaRecorder initialized successfully');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Please allow microphone access to use voice features.');
    }
  };

  // Initialize media recorder when component mounts
  useEffect(() => {
    // Don't auto-initialize - wait for user interaction
    console.log('🎤 MediaRecorder useEffect - waiting for user interaction');
    
    // Make handleVehicleAction available globally for HTML button onclick handlers
    (window as any).handleVehicleAction = handleVehicleAction;
    
    // Make openImageGallery available globally for AI responses
    (window as any).openImageGallery = openImageGallery;
    
    // Make openVehicleImages available globally for AI response buttons
    (window as any).openVehicleImages = openVehicleImages;

    // Cleanup function
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Clean up global functions
      delete (window as any).handleVehicleAction;
      delete (window as any).openImageGallery;
      delete (window as any).openVehicleImages;
      
      // DISABLED: Clean up inactivity timer
      // if (inactivityTimer) {
      //   clearTimeout(inactivityTimer);
      // }
    };
  }, []);

  const startRecording = () => {
    // Pause any running audio when starting voice recording
    pauseAllAudio();
    
    if (!mediaRecorderRef.current) {
      console.log('⚠️ MediaRecorder not initialized, initializing now...');
      // Initialize MediaRecorder when first needed
      initializeMediaRecorder().then(() => {
        if (mediaRecorderRef.current) {
          console.log('✅ MediaRecorder initialized, starting recording...');
          startRecording();
        } else {
          toast.error('Failed to initialize microphone. Please try again.');
        }
      }).catch((error) => {
        console.error('Failed to initialize MediaRecorder:', error);
        toast.error('Microphone access denied. Please allow microphone access and try again.');
      });
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
        // Wait a bit for the stop event to complete
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

  const startRecordingInternal = () => {
    try {
      // Double-check state before starting
      if (mediaRecorderRef.current.state !== 'inactive') {
        console.log('⚠️ MediaRecorder not in inactive state, resetting...');
        // Instead of calling initializeMediaRecorder, just reset the ref
        mediaRecorderRef.current = null;
        toast.error('MediaRecorder error. Please refresh the page.');
        return;
      }
      
      // Start with timeslice to collect chunks periodically (every 100ms)
      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      
      console.log('🎤 Recording started successfully with 100ms timeslice');
      console.log('🔍 MediaRecorder state:', mediaRecorderRef.current.state);
      console.log('🔍 Audio chunks ref length:', audioChunksRef.current.length);
      
      // Start silence detection for auto-stop (always enabled for better UX)
      setTimeout(() => {
        console.log('🔍 Attempting to start silence detection...');
        console.log('🔍 isContinuousVoiceMode:', isContinuousVoiceMode);
        startRecordingSilenceDetection();
      }, 1000); // 1 second delay to let recording stabilize and capture initial speech
      
      toast.success('🎤 Recording started. Auto-stop enabled.');
    } catch (error) {
      console.error('Error in startRecordingInternal:', error);
      toast.error('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) {
      console.log('⚠️ No mediaRecorderRef available');
      return;
    }
    
    const currentState = mediaRecorderRef.current.state;
    console.log('🔍 stopRecording called, current state:', currentState);
    
    // Only stop if actually recording
    if (currentState !== 'recording') {
      console.log('⚠️ Not in recording state, ignoring stop request');
      return;
    }
    
    if (!isRecording) {
      console.log('⚠️ isRecording flag is false');
      return;
    }

    try {
      console.log('🛑 Stopping recording...');
      
      // Stop silence detection first
      stopRecordingSilenceDetection();
      
      // Set flag immediately to prevent re-entry
      setIsRecording(false);
      
      // Request any pending data before stopping
      try {
        mediaRecorderRef.current.requestData();
        console.log('📦 Requested final data chunk');
      } catch (e) {
        console.log('⚠️ Could not request data:', e);
      }
      
      // Stop the recorder (this will trigger onstop event)
      mediaRecorderRef.current.stop();
      
      // Reset recording duration
      setRecordingDuration(0);
      setRecordingStartTime(null);
      
      console.log('✅ Stop command sent, waiting for onstop event...');
      toast.info('🔄 Processing audio...');
      
      // Resume VAD monitoring after recording stops
      if (isVADEnabled && !vadAnimationRef.current) {
        setTimeout(() => {
          startVADMonitoring();
          console.log('🎤 VAD monitoring resumed after recording');
        }, 500); // Small delay to ensure recording cleanup is complete
      }
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      toast.error('Failed to stop recording. Please try again.');
      setIsRecording(false);
    }
  };

  // Start silence detection for auto-stopping recording
  const startRecordingSilenceDetection = async () => {
    try {
      console.log('🔍 Starting recording silence detection...');
      
      if (!streamRef.current) {
        console.log('⚠️ No audio stream available for silence detection');
        return;
      }

      // Create audio context and analyser for recording
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(streamRef.current);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512; // Increased for better accuracy
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      recordingAnalyserRef.current = analyser;
      recordingSilenceCounterRef.current = 0;
      hasSpeechDetectedRef.current = false; // Reset speech detection flag

      console.log('✅ Recording silence detection started successfully');
      console.log('🔍 Silence threshold:', recordingSilenceThresholdRef.current, 'frames (~2 seconds)');
      console.log('🔍 Volume threshold:', recordingVolumeThresholdRef.current);

      const detectSilence = () => {
        if (!recordingAnalyserRef.current) {
          console.log('⚠️ Analyser ref lost, stopping detection');
          return;
        }

        const dataArray = new Uint8Array(recordingAnalyserRef.current.frequencyBinCount);
        recordingAnalyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const averageVolume = sum / dataArray.length;
        const normalizedVolume = averageVolume / 255;

        // Log every 30 frames (~0.5 seconds)
        if (Math.random() < 0.05) {
          console.log('🔊 Volume:', normalizedVolume.toFixed(4), 'Silence count:', recordingSilenceCounterRef.current, 'Speech detected:', hasSpeechDetectedRef.current);
        }

        // First, check if actual speech has been detected (volume significantly above threshold)
        if (!hasSpeechDetectedRef.current && normalizedVolume > recordingVolumeThresholdRef.current * 1.5) {
          hasSpeechDetectedRef.current = true;
          console.log('🗣️ Initial speech detected! Starting silence countdown...');
        }

        // Only count silence AFTER speech has been detected
        if (hasSpeechDetectedRef.current) {
          if (normalizedVolume < recordingVolumeThresholdRef.current) {
            recordingSilenceCounterRef.current++;
            
            // If silence detected for threshold duration, auto-stop recording
            if (recordingSilenceCounterRef.current >= recordingSilenceThresholdRef.current) {
              console.log('🔇 Silence detected - auto-stopping recording');
              console.log('🔍 Final silence count:', recordingSilenceCounterRef.current);
              stopRecordingSilenceDetection();
              
              // Use setTimeout to avoid recursion issues
              setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  stopRecording();
                }
              }, 100);
              return;
            }
          } else {
            // Reset counter if user is still speaking
            if (recordingSilenceCounterRef.current > 0) {
              console.log('🗣️ Speech detected, resetting silence counter');
            }
            recordingSilenceCounterRef.current = 0;
          }
        }

        recordingSilenceDetectionRef.current = requestAnimationFrame(detectSilence);
      };

      detectSilence();
    } catch (error) {
      console.error('❌ Error starting recording silence detection:', error);
      toast.error('Auto-stop feature failed to initialize');
    }
  };

  // Stop silence detection
  const stopRecordingSilenceDetection = () => {
    if (recordingSilenceDetectionRef.current) {
      cancelAnimationFrame(recordingSilenceDetectionRef.current);
      recordingSilenceDetectionRef.current = null;
    }
    recordingAnalyserRef.current = null;
    recordingSilenceCounterRef.current = 0;
    hasSpeechDetectedRef.current = false;
    console.log('🔇 Recording silence detection stopped');
  };

  // Reset MediaRecorder state for next recording
  const resetMediaRecorder = () => {
    try {
      if (mediaRecorderRef.current) {
        console.log('🔄 Resetting MediaRecorder state...');
        console.log('🔍 Current state before reset:', mediaRecorderRef.current.state);
        
        // If still recording, stop it
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        
        // Reset the ref to force re-initialization
        mediaRecorderRef.current = null;
        
        // Note: MediaRecorder will be re-initialized on next use
        console.log('🔄 MediaRecorder reset, will re-initialize on next use');
      }
    } catch (error) {
      console.error('Error resetting MediaRecorder:', error);
    }
  };

  // Voice message validation functions
  const validateVoiceMessage = async (audioBlob: Blob): Promise<{ isValid: boolean; reason?: string; duration?: number }> => {
    // DISABLED: Validation bypassed - always return valid
    console.log('🔍 Voice validation disabled - skipping checks');
    return {
      isValid: true
    };
    
    /* ORIGINAL VALIDATION CODE - DISABLED
    try {
      // Check minimum duration (at least 0.5 seconds)
      const audioDuration = await getAudioDuration(audioBlob);
      const minDuration = 0.5; // 500ms minimum
      
      if (audioDuration < minDuration) {
        return {
          isValid: false,
          reason: `Recording too short (${audioDuration.toFixed(1)}s). Please record for at least ${minDuration}s.`,
          duration: audioDuration
        };
      }
      
      // Check maximum duration (prevent extremely long recordings)
      const maxDuration = 300; // 5 minutes maximum
      if (audioDuration > maxDuration) {
        return {
          isValid: false,
          reason: `Recording too long (${audioDuration.toFixed(1)}s). Please keep recordings under ${maxDuration}s.`,
          duration: audioDuration
        };
      }
      
      // Check audio file size (prevent empty or corrupted files)
      const minSize = 1000; // 1KB minimum
      const maxSize = 50 * 1024 * 1024; // 50MB maximum
      
      if (audioBlob.size < minSize) {
        return {
          isValid: false,
          reason: 'Audio file too small. Please try recording again.',
          duration: audioDuration
        };
      }
      
      if (audioBlob.size > maxSize) {
        return {
          isValid: false,
          reason: 'Audio file too large. Please try a shorter recording.',
          duration: audioDuration
        };
      }
      
      // Check for actual audio content (basic analysis)
      const hasAudioContent = await analyzeAudioContent(audioBlob);
      if (!hasAudioContent) {
        return {
          isValid: false,
          reason: 'No speech detected. Please speak clearly into your microphone.',
          duration: audioDuration
        };
      }
      
      return {
        isValid: true,
        duration: audioDuration
      };
      
    } catch (error) {
      console.error('Error validating voice message:', error);
      return {
        isValid: false,
        reason: 'Error analyzing audio. Please try recording again.'
      };
    }
    */
  };

  // Get audio duration from blob
  const getAudioDuration = (audioBlob: Blob): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(audioBlob);
      
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load audio metadata'));
      };
      
      audio.src = url;
    });
  };

  // Analyze audio content for speech detection
  const analyzeAudioContent = async (audioBlob: Blob): Promise<boolean> => {
    try {
      // Create audio context for analysis
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get audio data
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;
      
      // Calculate RMS (Root Mean Square) to detect audio content
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sum / channelData.length);
      
      // Threshold for detecting speech (adjust based on testing)
      const speechThreshold = 0.01; // Minimum RMS value to consider as speech
      
      // Clean up
      audioContext.close();
      
      console.log('🎵 Audio analysis:', {
        duration: duration.toFixed(2) + 's',
        rms: rms.toFixed(4),
        threshold: speechThreshold,
        hasContent: rms > speechThreshold
      });
      
      return rms > speechThreshold;
      
    } catch (error) {
      console.error('Error analyzing audio content:', error);
      // If analysis fails, assume it's valid to avoid blocking legitimate messages
      return true;
    }
  };

  const handleVoiceSubmission = async (audioBlob: Blob) => {
    console.log('🎵 Processing voice submission:', {
      size: (audioBlob.size / 1024).toFixed(2) + ' KB',
      type: audioBlob.type
    });
    
    setIsProcessing(true);
    
    // Reset inactivity timer when user submits voice
    resetInactivityTimer();
    
    try {
      // Validate voice message before processing
      console.log('🔍 Validating voice message...');
      const validation = await validateVoiceMessage(audioBlob);
      
      if (!validation.isValid) {
        console.log('❌ Voice message validation failed:', validation.reason);
        toast.error(validation.reason || 'Invalid voice message. Please try again.');
        
        // Clear audio chunks after failed validation
        setAudioChunks([]);
        setAudioBlob(null);
        audioChunksRef.current = [];
        
        // Reset MediaRecorder for next recording
        resetMediaRecorder();
        return;
      }
      
      console.log('✅ Voice message validation passed:', {
        duration: validation.duration?.toFixed(2) + 's',
        size: (audioBlob.size / 1024).toFixed(2) + ' KB'
      });
      
      // Send to backend
      await sendVoiceToBackend(audioBlob);
      
      // Clear audio chunks after successful submission
      setAudioChunks([]);
      setAudioBlob(null);
      audioChunksRef.current = [];
      
      // Reset MediaRecorder for next recording
      resetMediaRecorder();
      
    } catch (error) {
      console.error('Error processing voice:', error);
      toast.error('Failed to process your voice message. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const sendVoiceToBackend = async (audioBlob: Blob) => {
    // Check if user is authenticated for sending voice messages
    const authToken = localStorage.getItem('auth_token');
    const customerToken = localStorage.getItem('customerToken');
    
    if (!authToken && !customerToken && hash) {
      console.log('🔐 User not authenticated for voice - showing quick auth modal');
      setShowQuickAuth(true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-test.wav');
      formData.append('vehicleId', vehicleId || '');
      formData.append('sessionId', sessionId);
      formData.append('dealerId', effectiveDealerId);
      formData.append('useCrewAI', String(useCrewAI));
      formData.append('conversationContext', JSON.stringify(conversationContext));
      formData.append('customerInfo', JSON.stringify({
        name: 'Customer',
        email: 'customer@dealership.com',
        dealerId: effectiveDealerId
      }));

      console.log('📤 Sending voice data to backend:', {
        size: (audioBlob.size / 1024).toFixed(2) + ' KB',
        vehicleId: vehicleId || 'null',
        sessionId,
        dealerId: effectiveDealerId,
        url: buildApiUrl('daive/voice')
      });

      const response = await fetch(buildApiUrl('daive/voice'), {
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

          // 🔍 Detect inventory results for voice flow and show vehicle cards
          try {
            // Check if vehicle has already been selected in conversation context
            const hasSelectedVehicle = data.data?.conversationContext?.Daivesteps?.[3]?.slots?.VehicleSelection?.hasSelectedVehicle ||
              data.data?.conversationContext?.slots?.VehicleSelection?.hasSelectedVehicle ||
              data.data?.conversationContext?.vehicle_selected ||
              data.data?.context?.Daivesteps?.[3]?.slots?.VehicleSelection?.hasSelectedVehicle ||
              data.data?.context?.slots?.VehicleSelection?.hasSelectedVehicle ||
              data.data?.context?.vehicle_selected;

            // Gather vehicle lists from both top-level and context
            const topLevelVehicles = data.data?.vehicleDetails || [];
            const contextVehicles = data.data?.conversationContext?.vehicleDetails || [];
            const lastInventoryUpdate = data.data?.conversationContext?.lastInventoryUpdate || null;
            
            // ✅ FIX: Deduplicate vehicles by stock number to prevent showing same vehicle twice
            const combinedVehicles = [...topLevelVehicles, ...contextVehicles];
            const uniqueVehicles = combinedVehicles.filter((vehicle, index, self) => 
              index === self.findIndex(v => 
                v.stockNumber === vehicle.stockNumber || 
                (v.id && v.id === vehicle.id) ||
                (v.year === vehicle.year && v.make === vehicle.make && v.model === vehicle.model && v.price === vehicle.price)
              )
            );
            const allVehicles = uniqueVehicles;
            
            // ✅ DEBUG: Log deduplication results
            if (combinedVehicles.length !== uniqueVehicles.length) {
              console.log(`🔧 VOICE DEDUPLICATION: Removed ${combinedVehicles.length - uniqueVehicles.length} duplicate vehicles`);
              console.log(`📊 Voice Before: ${combinedVehicles.length} vehicles, After: ${uniqueVehicles.length} vehicles`);
            }

            // ✅ FIXED: Check if this is a refinement search (exploring colors/options of selected vehicle)
            const isRefinementSearch = data.data?.isRefinementSearch === true;
            
            console.log('🔍 Voice backend: Vehicle display check:', {
              hasVehicles: allVehicles.length > 0,
              hasSelectedVehicle,
              isRefinementSearch,
              shouldShowCards: allVehicles.length > 0 && (!hasSelectedVehicle || isRefinementSearch)
            });

            // ✅ FIXED: Show vehicle cards when:
            // 1. No vehicle selected yet (initial search), OR
            // 2. Refinement search (exploring colors/options of selected vehicle)
            if (allVehicles.length > 0 && (!hasSelectedVehicle || isRefinementSearch)) {
              console.log(isRefinementSearch 
                ? '🎨 Voice backend: REFINEMENT MODE - Showing color/variant options for selected vehicle'
                : '🆕 Voice backend: INITIAL SEARCH - Showing vehicle options');
              
              // Prevent duplicate processing if already processing vehicle cards
              if (isProcessingVehicleCards) {
                console.log('🚫 Voice backend: Already processing vehicle cards - skipping duplicate processing');
                return;
              }
              
              setIsProcessingVehicleCards(true);
              
              // ✅ ALWAYS LOAD FRESH FROM DATA ARRAY - NO CACHE LOGIC FOR VOICE TOO
              // Clear any existing vehicle details first
              setCurrentVehicleDetails([]);
              
              // Always replace with fresh data from backend response
              console.log('🔄 Voice backend: Loading fresh inventory from data array - no cache');
              setCurrentVehicleDetails(allVehicles);
              setShowVehicleCards(true);
              setCurrentVehiclePage(0);
              clearVehicleCardVoiceState(); // Clear voice-over state for new vehicles
              
              // Reset processing flag after a short delay to allow voice-over to complete
              setTimeout(() => {
                setIsProcessingVehicleCards(false);
                console.log('✅ Voice backend: Vehicle card processing completed');
              }, 2000);
            } else if (hasSelectedVehicle && !isRefinementSearch) {
              // ✅ FIXED: Only hide cards if vehicle selected AND NOT in refinement mode
              console.log('✅ Voice backend: Vehicle already selected (not refinement) - hiding vehicle cards');
              setShowVehicleCards(false);
              setCurrentVehicleDetails([]);
            } else {
              // ✅ NO INVENTORY IN DATA ARRAY - CLEAR EXISTING CACHE FOR VOICE TOO
              console.log('🚫 Voice backend: No vehicle details found in data array - clearing any cached inventory');
              setShowVehicleCards(false);
              setCurrentVehicleDetails([]);
            }
          } catch (invErr) {
            console.log('⚠️ Inventory detection (voice) error:', invErr);
          }

          setMessages(prev => [...prev, userMessage, assistantMessage]);

          // Start typewriter effect for the AI response
          setTimeout(() => {
            startTypewriterEffect(assistantMessage);
          }, 100); // Small delay to ensure message is rendered

          // Play audio response if available
          if (audioResponseUrl) {
            try {
              const audio = new Audio(buildBackendAssetUrl(audioResponseUrl));
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

    // Check if user is authenticated for sending messages
    const authToken = localStorage.getItem('auth_token');
    const customerToken = localStorage.getItem('customerToken');
    
    if (!authToken && !customerToken && hash) {
      console.log('🔐 User not authenticated - showing quick auth modal');
      setShowQuickAuth(true);
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: message || 'Empty message',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsProcessing(true);
    console.log('🔄 Processing state set to TRUE - thinking indicator should show');
    
    // Reset inactivity timer when user sends a message
    resetInactivityTimer();

    try {
      // ✅ FIX: Use logged-in customer's email if available
      const customerEmail = customer?.email || null;
      const customerName = customer?.name || 'Customer';
      const customerId = (customer as any)?.id || null;
      
      console.log('👤 Customer info for DAIVE:', {
        hasCustomer: !!customer,
        customerId,
        customerName,
        customerEmail,
        hasValidSession
      });

      const payload = {
        vehicleId: vehicleId || null,
        sessionId,
        message,
        dealerId: effectiveDealerId,
        useCrewAI,
        conversationContext: conversationContext,
        customerInfo: {
          customerId: customerId,
          name: customerName,
          email: customerEmail, // ✅ Will be null if customer not logged in
          dealerId: effectiveDealerId,
          sessionId: sessionId
        },
        // ✅ Always include a data array that the backend can consume directly
        dataArray: [
          { type: 'userMessage', content: message },
          { type: 'selectedVehicles', items: selectedVehicles }
        ]
      };

      console.log('📤 Sending text request to backend:', {
        vehicleId: vehicleId || 'null',
        vehicleIdType: typeof vehicleId,
        vehicleIdLength: vehicleId?.length || 'N/A',
        sessionId,
        message: message.substring(0, 50) + '...',
        dealerId: effectiveDealerId || 'NOT PROVIDED',
        payloadVehicleId: payload.vehicleId,
        source: 'AIBotPage_sendTextMessage'
      });
      
      // Debug: Log the exact dealer ID being sent
      console.log('🔍 DEBUG - Dealer ID details:', {
        effectiveDealerId,
        dealerIdType: typeof effectiveDealerId,
        dealerIdLength: effectiveDealerId?.length,
        isDealerIdValid: effectiveDealerId && effectiveDealerId.length > 0
      });

      // The backend is smart enough to route between inventory-aware and CrewAI responses
      // Always use the main chat endpoint and let the backend handle the routing
      const endpoint = buildApiUrl('daive/chat');
      
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
      
      const response = await fetch(buildApiUrl('daive/chat'), {
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

        // Capture debug data for debug tab
        if (data.data) {
          // Capture intent result
          if (data.data.intent || data.data.intentResult) {
            setLastIntentResult({
              intent: data.data.intent || data.data.intentResult?.intent,
              confidence: data.data.intentResult?.confidence,
              method: data.data.intentResult?.method,
              responseTime: data.data.intentResult?.responseTime,
              timestamp: new Date().toISOString()
            });
          }

          // Capture slot data
          if (data.data.slots || data.data.slotData) {
            setLastSlotData({
              slots: data.data.slots || data.data.slotData,
              stage: data.data.stage,
              journeyStep: data.data.journeyStep,
              timestamp: new Date().toISOString()
            });
          }

          // Update general debug data
          setDebugData({
            timestamp: new Date().toISOString(),
            sessionId,
            dealerId: effectiveDealerId,
            vehicleId,
            messagesCount: messages.length + 1, // +1 for the message we just added
            lastMessage: message,
            responseData: {
              success: data.success,
              crewUsed: data.data?.crewUsed,
              crewType: data.data?.crewType,
              intent: data.data?.intent,
              leadScore: data.data?.leadScore,
              shouldHandoff: data.data?.shouldHandoff,
              responseLength: data.data?.response?.length
            },
            conversationContext: data.data?.context,
            preferences: {
              autoplayEnabled,
              typewriterEnabled,
              typewriterSpeed,
              isVoiceEnabled,
              useCrewAI,
              crewAIEnabled
            }
          });

          // Update conversation context and journey stages from response
          if (data.data?.context) {
            setConversationContext(data.data.context);
            setJourneyStages({
              currentStage: data.data.context.stage,
              journeyStep: data.data.context.journeyStep,
              slots: data.data.context.slots,
              preferences: data.data.context.preferences,
              vehicleHistory: data.data.context.vehicle_history,
              lastUpdated: new Date().toISOString()
            });
            
            // Check if conversation has moved beyond vehicle selection stage
            const currentStage = data.data.context.stage;
            const conversationStage = data.data.context.conversation?.conversation_stage;
            
            if (currentStage === 'test_drive' || 
                currentStage === 'finance' || 
                currentStage === 'trade_in' ||
                conversationStage === 'presentation' ||
                conversationStage === 'negotiation' ||
                conversationStage === 'closing') {
              console.log(`✅ Conversation moved to ${currentStage}/${conversationStage} stage - hiding vehicle cards`);
              setShowVehicleCards(false);
              setCurrentVehicleDetails([]);
            }
          }
        }

        // Check if we have a valid response (try both response and message fields)
        const responseContent = data.data?.response || data.data?.message;
        console.log('🔍 Response content found:', responseContent);
        console.log('🔍 Response content length:', responseContent?.length);
        console.log('🔍 Response content type:', typeof responseContent);
        console.log('🔍 Full data structure:', data.data);
        
        // ✅ NEW: Check if vehicle has been selected in conversation context (early check)
        const hasSelectedVehicle = data.data?.conversationContext?.Daivesteps?.[3]?.slots?.VehicleSelection?.hasSelectedVehicle ||
                                 data.data?.conversationContext?.slots?.VehicleSelection?.hasSelectedVehicle ||
                                 data.data?.conversationContext?.vehicle_selected ||
                                 data.data?.context?.Daivesteps?.[3]?.slots?.VehicleSelection?.hasSelectedVehicle ||
                                 data.data?.context?.slots?.VehicleSelection?.hasSelectedVehicle ||
                                 data.data?.context?.vehicle_selected;
        
        console.log('🔍 Early hasSelectedVehicle check:', hasSelectedVehicle);
        
        // ✅ NEW: Check for inventory response with vehicleDetails - ALWAYS LOAD FRESH FROM DATA ARRAY
        // Check both top-level vehicleDetails and conversationContext.vehicleDetails
        const topLevelVehicles = data.data?.vehicleDetails || [];
        const contextVehicles = data.data?.conversationContext?.vehicleDetails || [];
        const lastInventoryUpdate = data.data?.conversationContext?.lastInventoryUpdate || null;
        
        // ✅ FIX: Deduplicate vehicles by stock number to prevent showing same vehicle twice
        const combinedVehicles = [...topLevelVehicles, ...contextVehicles];
        const uniqueVehicles = combinedVehicles.filter((vehicle, index, self) => 
          index === self.findIndex(v => 
            v.stockNumber === vehicle.stockNumber || 
            (v.id && v.id === vehicle.id) ||
            (v.year === vehicle.year && v.make === vehicle.make && v.model === vehicle.model && v.price === vehicle.price)
          )
        );
        const allVehicles = uniqueVehicles;
        
        // ✅ DEBUG: Log deduplication results
        if (combinedVehicles.length !== uniqueVehicles.length) {
          console.log(`🔧 DEDUPLICATION: Removed ${combinedVehicles.length - uniqueVehicles.length} duplicate vehicles`);
          console.log(`📊 Before: ${combinedVehicles.length} vehicles, After: ${uniqueVehicles.length} vehicles`);
        }
        
        // ✅ FIXED: Check if this is a refinement search (exploring colors/options of selected vehicle)
        const isRefinementSearch = data.data?.isRefinementSearch === true;
        
        console.log('🔍 Vehicle display check:', {
          hasVehicles: allVehicles.length > 0,
          hasSelectedVehicle,
          isRefinementSearch,
          shouldShowCards: allVehicles.length > 0 && (!hasSelectedVehicle || isRefinementSearch)
        });
        
        // ✅ FIXED: Show vehicle cards when:
        // 1. No vehicle selected yet (initial search), OR
        // 2. Refinement search (exploring colors/options of selected vehicle)
        if (allVehicles.length > 0 && (!hasSelectedVehicle || isRefinementSearch)) {
          console.log('🚗 INVENTORY RESPONSE DETECTED - Setting vehicle details for display');
          console.log(isRefinementSearch 
            ? '🎨 REFINEMENT MODE: Showing color/variant options for selected vehicle'
            : '🆕 INITIAL SEARCH: Showing vehicle options');
          console.log(`📋 Vehicle Details Count: ${allVehicles.length}`);
          console.log(`🚗 First Vehicle: ${allVehicles[0]?.year} ${allVehicles[0]?.make} ${allVehicles[0]?.model} - ${allVehicles[0]?.price}`);
          console.log('🔍 Top-level vehicles:', topLevelVehicles.length);
          console.log('🔍 Context vehicles:', contextVehicles.length);
          
          // Prevent duplicate processing if already processing vehicle cards
          if (isProcessingVehicleCards) {
            console.log('🚫 Already processing vehicle cards - skipping duplicate processing');
            return;
          }
          
          setIsProcessingVehicleCards(true);
          
          // ✅ ALWAYS LOAD FRESH FROM DATA ARRAY - NO CACHE LOGIC
          // Clear any existing vehicle details first
          setCurrentVehicleDetails([]);
          
          // Always replace with fresh data from backend response
          console.log('🔄 Loading fresh inventory from data array - no cache');
          setCurrentVehicleDetails(allVehicles);
          setShowVehicleCards(true);
          setCurrentVehiclePage(0);
          clearVehicleCardVoiceState(); // Clear voice-over state for new vehicles
          
          // Reset processing flag after a short delay to allow voice-over to complete
          setTimeout(() => {
            setIsProcessingVehicleCards(false);
            console.log('✅ Vehicle card processing completed');
          }, 2000);
        } else if (hasSelectedVehicle && !isRefinementSearch) {
          // ✅ FIXED: Only hide cards if vehicle selected AND NOT in refinement mode
          console.log('✅ Vehicle already selected (not refinement) - hiding vehicle cards');
          setShowVehicleCards(false);
          setCurrentVehicleDetails([]);
        } else {
          // ✅ NO INVENTORY IN DATA ARRAY - CLEAR EXISTING CACHE
          console.log('🚫 No vehicle details found in data array - clearing any cached inventory');
          setShowVehicleCards(false);
          setCurrentVehicleDetails([]);
          console.log('🔍 hasSelectedVehicle:', hasSelectedVehicle);
          console.log('🔍 No inventory in response - cleared cached vehicles');
        }
        
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

        // Check if this response contains vehicle cards or test drive - if so, skip TTS to avoid conflict with explanation audio
        const hasVehicleCards = data.data?.vehicleDetails && data.data.vehicleDetails.length > 0;
        const isTestDriveRequest = data.data?.intent === 'test_drive_request' || responseContent.toLowerCase().includes('test drive');
        
        if (hasVehicleCards) {
          console.log('🚗 Vehicle cards detected - skipping TTS to avoid conflict with explanation audio');
        }
        
        if (isTestDriveRequest) {
          console.log('🚗 Test drive request detected - skipping TTS to avoid conflict with explanation audio');
        }
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: responseContent,
          audioUrl: (hasVehicleCards || isTestDriveRequest) ? undefined : data.data.audioResponseUrl, // Skip TTS for vehicle/test drive responses
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

          // ✅ PRIORITY: Stop vehicle card audio when backend audio is received
          if (assistantMessage.audioUrl && isVehicleCardVoicePlaying) {
            console.log('🔇 Backend audio received - stopping vehicle card audio for priority...');
            stopVehicleCardAudio();
          }

        // Start typewriter effect for the new AI response
        setTimeout(() => {
          startTypewriterEffect(assistantMessage);
        }, 100); // Small delay to ensure message is rendered

          // DISABLED: Enhanced system response TTS generation
        if (data.data?.crewType === 'EnhancedGoNext' && data.data?.shouldAutoplay && autoplayEnabled && !hasVehicleCards && !isTestDriveRequest) {
            console.log('🎵 Enhanced system response detected, but TTS DISABLED - only backend audio will play');
            console.log('🔍 Response that would have been processed:', responseContent.substring(0, 100) + '...');
        }

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
      console.log('✅ Processing state set to FALSE - thinking indicator should hide');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProcessing && inputMessage.trim()) {
      // Check authentication before sending message
      const authToken = localStorage.getItem('auth_token');
      const customerToken = localStorage.getItem('customerToken');
      
      if (!authToken && !customerToken && hash) {
        console.log('🔐 User not authenticated - showing quick auth modal');
        setShowQuickAuth(true);
        return;
      }
      
      sendTextMessage(inputMessage);
    }
  };

  const toggleVoiceMode = () => {
    const newVoiceEnabled = !isVoiceEnabled;
    setIsVoiceEnabled(newVoiceEnabled);
    
    if (newVoiceEnabled) {
      // Initialize MediaRecorder when voice mode is enabled
      if (!mediaRecorderRef.current) {
        console.log('🎤 Voice mode enabled, initializing MediaRecorder...');
        initializeMediaRecorder().then(() => {
          toast.success('🎤 Voice mode enabled. Click the microphone to record.');
        }).catch((error) => {
          console.error('Failed to initialize MediaRecorder:', error);
          setIsVoiceEnabled(false); // Revert the toggle
          toast.error('Failed to enable voice mode. Please check microphone permissions.');
        });
      } else {
        toast.success('🎤 Voice mode enabled. Click the microphone to record.');
      }
    } else {
      toast.info('🎤 Voice mode disabled.');
    }
  };

  // NEW: Enhanced Crew AI toggle with thinking indicator
  const handleCrewAIToggle = async () => {
    if (!crewAIEnabled) return;
    
    setIsCrewAIToggling(true);
    console.log('🔄 Toggling Crew AI mode...');
    
    // Add a brief system message to show the toggle action
    const toggleMessage: Message = {
      role: 'assistant',
      content: `🔄 **Switching Crew AI mode...** ${!useCrewAI ? 'Activating enhanced responses...' : 'Switching to standard mode...'}`,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, toggleMessage]);
    
    // Simulate a brief processing delay for visual feedback
    setTimeout(() => {
      const newValue = !useCrewAI;
      setUseCrewAI(newValue);
      setIsCrewAIToggling(false);
      
      // Update the toggle message with the result
      setMessages(prev => prev.map(msg => 
        msg.content.includes('🔄 **Switching Crew AI mode...**') 
          ? { ...msg, content: `✅ **Crew AI ${newValue ? 'Activated' : 'Deactivated'}** ${newValue ? 'Enhanced responses are now enabled!' : 'Using standard response mode.'}` }
          : msg
      ));
      
      if (newValue) {
        toast.success('🚀 Crew AI activated! Enhanced responses enabled.');
        console.log('✅ Crew AI enabled');
      } else {
        toast.info('📊 Crew AI deactivated. Using standard responses.');
        console.log('ℹ️ Crew AI disabled');
      }
    }, 800); // 800ms delay for visual feedback
  };

    const playAudio = (audioUrl: string, messageId?: string) => {
    if (audioRef.current) {
      try {
          // First, stop any currently playing audio and clear states
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
          setPlayingMessageId(null);
          
          // Clear the audio element completely to prevent event listener conflicts
          audioRef.current.src = '';
          audioRef.current.load();
          
          // Set new audio source
        audioRef.current.crossOrigin = 'anonymous'; // Enable CORS for audio
        audioRef.current.preload = 'auto';
        audioRef.current.src = buildBackendAssetUrl(audioUrl);
        
          // Set playing state for specific message
          if (messageId) {
            setPlayingMessageId(messageId);
          }
          
          // Add event listeners (using once to prevent multiple triggers)
        audioRef.current.addEventListener('canplaythrough', () => {
          console.log('🎵 Audio loaded successfully, playing...');
          audioRef.current?.play().catch(err => {
            console.log('Could not play audio:', err);
              setIsPlaying(false);
              setPlayingMessageId(null);
          });
          }, { once: true });
        
        audioRef.current.addEventListener('error', (e) => {
          console.error('❌ Audio loading error:', e);
          setIsPlaying(false);
            setPlayingMessageId(null);
          }, { once: true });
        
        audioRef.current.addEventListener('ended', () => {
            console.log('🏁 Audio playback ended');
          setIsPlaying(false);
            setPlayingMessageId(null);
          }, { once: true });
        
        audioRef.current.addEventListener('play', () => {
            console.log('▶️ Audio playback started');
          setIsPlaying(true);
          }, { once: true });
        
        audioRef.current.load(); // Start loading the audio
      } catch (err) {
        console.log('Could not create audio element:', err);
          setIsPlaying(false);
          setPlayingMessageId(null);
      }
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
        setPlayingMessageId(null);
    }
  };

  // Function to pause all running audio when voice recording starts
  const pauseAllAudio = () => {
    console.log('🔇 Pausing all audio for voice recording...');
    
    // Pause main audio player
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
        setPlayingMessageId(null);
      console.log('🔇 Main audio player paused');
    }
    
    // Pause any other audio elements that might be playing
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach((audio, index) => {
      if (!audio.paused) {
        audio.pause();
        console.log(`🔇 Audio element ${index} paused`);
      }
    });
    
    // Reset voice-over playing state
    setIsVehicleCardVoicePlaying(false);
    setIsGreetingAudioPlaying(false);
    
    // Temporarily stop VAD monitoring during recording to avoid conflicts
    if (isVADEnabled && vadAnimationRef.current) {
      cancelAnimationFrame(vadAnimationRef.current);
      vadAnimationRef.current = null;
      console.log('🎤 VAD monitoring paused during recording');
    }
    
    console.log('🔇 All audio paused for voice recording');
  };

  // Function to stop vehicle group voice-over specifically
  const stopVehicleGroupVoiceOver = () => {
    console.log('🔇 Stopping vehicle group voice-over...');
    
    // Pause all audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach((audio, index) => {
      if (!audio.paused) {
        audio.pause();
        console.log(`🔇 Audio element ${index} paused`);
      }
    });
    
    // Reset vehicle group voice-over state
    setIsVehicleCardVoicePlaying(false);
    
    console.log('🔇 Vehicle group voice-over stopped');
  };

  // WhatsApp-style voice recording state
  const [isPressingVoiceButton, setIsPressingVoiceButton] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingDurationRef = useRef<NodeJS.Timeout | null>(null);
  const recordingInProgressRef = useRef<boolean>(false); // Prevent multiple clicks

  // Handle voice button press (start recording)
  const handleVoiceButtonPress = () => {
    // Prevent multiple clicks - if already processing or recording, ignore
    if (isProcessing || isRecording || recordingInProgressRef.current || isPressingVoiceButton) {
      console.log('⚠️ Recording already in progress, ignoring duplicate press');
      return;
    }
    
    // Set flag to prevent duplicate clicks
    recordingInProgressRef.current = true;
    
    console.log('🎤 Voice button pressed - starting recording...');
    setIsPressingVoiceButton(true);
    setRecordingStartTime(Date.now());
    setRecordingDuration(0);
    
    // Pause all audio before starting voice recording
    pauseAllAudio();
    
    // Ensure MediaRecorder is initialized before starting
    if (!mediaRecorderRef.current) {
      console.log('🎤 Initializing MediaRecorder...');
      initializeMediaRecorder().then(() => {
        console.log('✅ MediaRecorder ready, starting recording...');
        startRecording();
        startRecordingDurationTimer();
      }).catch((error) => {
        console.error('Failed to initialize MediaRecorder:', error);
        toast.error('Microphone access denied. Please allow microphone access and try again.');
        setIsPressingVoiceButton(false);
        recordingInProgressRef.current = false; // Reset flag on error
      });
    } else {
      startRecording();
      startRecordingDurationTimer();
    }
  };

  // Handle voice button release (stop recording)
  const handleVoiceButtonRelease = () => {
    if (!isPressingVoiceButton && !isRecording) return;
    
    console.log('🎤 Voice button released - stopping recording...');
    setIsPressingVoiceButton(false);
    setRecordingStartTime(null);
    
    // Stop recording duration timer
    if (recordingDurationRef.current) {
      clearInterval(recordingDurationRef.current);
      recordingDurationRef.current = null;
    }
    
    // Check minimum recording duration before stopping
    const minRecordingDuration = 0.5; // 500ms minimum
    if (recordingDuration < minRecordingDuration) {
      console.log('⚠️ Recording too short, continuing for minimum duration...');
      toast.warning(`Recording too short. Please hold for at least ${minRecordingDuration}s.`);
      
      // Continue recording for minimum duration
      setTimeout(() => {
        stopRecording();
        recordingInProgressRef.current = false; // Reset flag after stopping
      }, (minRecordingDuration - recordingDuration) * 1000);
    } else {
      // Stop recording immediately if duration is sufficient
      stopRecording();
      recordingInProgressRef.current = false; // Reset flag after stopping
    }
  };

  // Start recording duration timer
  const startRecordingDurationTimer = () => {
    recordingDurationRef.current = setInterval(() => {
      if (recordingStartTime) {
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        setRecordingDuration(duration);
      }
    }, 1000);
  };

  // Handle voice button click (fallback for non-touch devices)
  const handleVoiceButtonClick = () => {
    // Prevent multiple rapid clicks
    if (recordingInProgressRef.current) {
      console.log('⚠️ Recording operation in progress, ignoring click');
      return;
    }
    
    if (isRecording) {
      handleVoiceButtonRelease();
    } else {
      handleVoiceButtonPress();
    }
  };

  const handleClick = () => {
    // Prevent multiple rapid clicks
    if (recordingInProgressRef.current || isProcessing) {
      console.log('⚠️ Recording operation in progress, ignoring click');
      return;
    }
    
    if (isRecording) {
      stopRecording();
      recordingInProgressRef.current = false;
    } else {
      recordingInProgressRef.current = true;
      
      // Pause all audio before starting voice recording
      pauseAllAudio();
      
      // Ensure MediaRecorder is initialized before starting
      if (!mediaRecorderRef.current) {
        console.log('🎤 Voice button clicked, initializing MediaRecorder...');
        initializeMediaRecorder().then(() => {
          console.log('✅ MediaRecorder ready, starting recording...');
          startRecording();
        }).catch((error) => {
          console.error('Failed to initialize MediaRecorder:', error);
          toast.error('Failed to start recording. Please check microphone permissions.');
          recordingInProgressRef.current = false; // Reset flag on error
        });
      } else {
        startRecording();
      }
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
        const customerToken = localStorage.getItem('customerToken');
        
        if (!authToken && !customerToken && hash) {
          console.log('🔐 User not authenticated - showing quick auth modal');
          setShowQuickAuth(true);
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
      const response = await fetch(buildApiUrl('daive/chat'), {
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
        const response = await fetch(buildApiUrl('daive/chat'), {
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
        const fastInventoryResponse = await fetch(buildApiUrl(`daive/fast-inventory?dealerId=${effectiveDealerId}&limit=20`), {
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

  // NEW: Function to detect vehicles in AI responses and add image buttons
  const enhanceVehicleResponses = (content: string) => {
    try {
      // Ensure content is a string
      if (typeof content !== 'string') {
        console.warn('enhanceVehicleResponses: content is not a string:', typeof content);
        return content;
      }
      
      // Backend now generates complete, clickable buttons - no frontend enhancement needed
      console.log('🔍 Backend generates complete buttons - no frontend enhancement needed');
      return content;
    } catch (error) {
      console.error('Error in enhanceVehicleResponses:', error);
      return content; // Return original content on error
    }
  };

  // Helper function to clean text for TTS - removes formatting and improves number pronunciation
  const cleanTextForTTS = (text: string): string => {
    return text
      // Remove markdown formatting
      .replace(/\*\*/g, '')           // Remove bold markers
      .replace(/\*/g, '')             // Remove italic markers
      .replace(/`/g, '')              // Remove code markers
      .replace(/#{1,6}\s/g, '')      // Remove headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to just text
      
      // Clean up QR greeting formatting for better TTS
      .replace(/\*\*Vehicle Details:\*\*/g, 'Vehicle Details:')
      .replace(/\*\*Price:\*\*/g, 'Price:')
      .replace(/\*\*Mileage:\*\*/g, 'Mileage:')
      .replace(/\*\*Color:\*\*/g, 'Color:')
      .replace(/\*\*Stock #:\*\*/g, 'Stock number:')
      .replace(/•\s*/g, '')          // Remove bullet points
      .replace(/\n\n/g, '. ')        // Convert double newlines to periods
      .replace(/\n/g, ' ')           // Convert single newlines to spaces
      
      // Clean up punctuation for better TTS flow
      .replace(/\.{2,}/g, '.')        // Replace multiple dots with single dot
      .replace(/\?{2,}/g, '?')        // Replace multiple question marks
      .replace(/!{2,}/g, '!')         // Replace multiple exclamation marks
      
      // Improve number pronunciation
      .replace(/\$(\d{1,3}(?:,\d{3})*)/g, (match, number) => {
        const num = parseInt(number.replace(/,/g, ''));
        if (num >= 1000) {
          const thousands = Math.floor(num / 1000);
          const remainder = num % 1000;
          if (remainder === 0) {
            return `${thousands} thousand dollars`;
          } else if (remainder < 100) {
            return `${thousands} thousand ${remainder} dollars`;
          } else {
            const hundreds = Math.floor(remainder / 100);
            const tens = remainder % 100;
            if (tens === 0) {
              return `${thousands} thousand ${hundreds} hundred dollars`;
            } else {
              return `${thousands} thousand ${hundreds} hundred ${tens} dollars`;
            }
          }
        } else {
          return `${num} dollars`;
        }
      })
      
      // Clean up mileage numbers
      .replace(/(\d{1,3}(?:,\d{3})*)\s*miles?/gi, (match, number) => {
        const num = parseInt(number.replace(/,/g, ''));
        if (num >= 1000) {
          const thousands = Math.floor(num / 1000);
          const remainder = num % 1000;
          if (remainder === 0) {
            return `${thousands} thousand miles`;
          } else {
            return `${thousands} thousand ${remainder} miles`;
          }
        } else {
          return `${num} miles`;
        }
      })
      
      // Clean up year numbers
      .replace(/\b(19|20)(\d{2})\b/g, (match, century, year) => {
        return `${century}${year}`;
      })
      
      // Remove extra whitespace and normalize
      .replace(/\s+/g, ' ')           // Normalize spaces
      .replace(/\s*([,.!?;:])\s*/g, '$1 ') // Clean up punctuation spacing
      .trim();
  };

  // Function to clear voice-over state when new vehicles are loaded
  const clearVehicleCardVoiceState = () => {
      console.log('🧹 Clearing vehicle card voice state...');
    setIsVehicleCardVoicePlaying(false);
    setVehicleGroupVoicePlayed('');
    setVehicleOverviewText(''); // Clear overview text for new vehicles
    setTestDriveExplanationText(''); // Clear test drive explanation text for new vehicles
      
      // Stop any currently playing vehicle audio
      if (currentVehicleAudio) {
        console.log('🔇 Stopping current vehicle audio...');
        currentVehicleAudio.pause();
        currentVehicleAudio.currentTime = 0;
        setCurrentVehicleAudio(null);
      }
      
      console.log('✅ Vehicle card voice state cleared');
    console.log('🧹 Vehicle cards will re-render for new vehicle data, but not for text changes');
  };

    // ✅ NEW: Function to stop vehicle card audio specifically
    const stopVehicleCardAudio = () => {
      console.log('🔇 Stopping vehicle card audio...');
      
      if (currentVehicleAudio) {
        currentVehicleAudio.pause();
        currentVehicleAudio.currentTime = 0;
        setCurrentVehicleAudio(null);
      }
      
      setIsVehicleCardVoicePlaying(false);
      console.log('✅ Vehicle card audio stopped');
  };

  // Add useEffect to trigger group voice-over when vehicle cards are displayed (prevent re-triggering)
  React.useEffect(() => {
    if (showVehicleCards && currentVehicleDetails.length > 0) {
      // Create a unique key for the current vehicle set to prevent duplicate voice-overs
      const vehicleSetKey = currentVehicleDetails.map(v => v.id).sort().join('-');
      
      // Only play voice-over if this is a new vehicle set and not already playing
      if (vehicleGroupVoicePlayed !== vehicleSetKey && !isVehicleCardVoicePlaying) {
        console.log('🎤 Triggering vehicle group voice-over for new vehicle set:', vehicleSetKey);
        
        // Set the voice played flag immediately to prevent duplicate processing
        setVehicleGroupVoicePlayed(vehicleSetKey);
        
          // DISABLED: Vehicle group voice-over explanation
          // const timer = setTimeout(() => {
          //   playVehicleGroupVoiceOver(getCurrentPageVehicles());
          // }, 1000); // 1 second delay after cards are displayed
          // 
          // return () => clearTimeout(timer);
      } else {
        console.log('🎤 Skipping vehicle group voice-over - already played or playing:', {
          vehicleSetKey,
          alreadyPlayed: vehicleGroupVoicePlayed,
          isPlaying: isVehicleCardVoicePlaying
        });
      }
    }
  }, [showVehicleCards, currentVehiclePage]); // Removed currentVehicleDetails.length to prevent re-triggering

  // Add this function to play voice-over for test drive interest
  const playTestDriveVoiceOver = async (vehicle: any) => {
    console.log('🎤 Playing test drive voice-over for:', vehicle.make, vehicle.model);
    
    // Create a unique key for this test drive voice-over
    const testDriveKey = `testdrive-${vehicle.id}-${vehicle.year}-${vehicle.make}-${vehicle.model}`;
    
    // Only play if autoplay is enabled
    if (!autoplayEnabled) {
      console.log('🎤 Autoplay disabled, skipping test drive voice-over');
      return;
    }
    
    // Prevent if already played for this exact vehicle test drive
    if (vehicleGroupVoicePlayed === testDriveKey) {
      console.log('🎤 Test drive voice-over already played for this vehicle, skipping');
      return;
    }
    
    // Prevent if other audio is playing
    if (isVehicleCardVoicePlaying || isGreetingAudioPlaying) {
      console.log('🎤 Other audio is playing, skipping test drive voice-over');
      return;
    }
    
    // Create simple test drive greeting text with formatting and legal requirements
    const mileage = vehicle.mileage ? vehicle.mileage.toString().replace(/\s*miles?\s*/gi, '').trim() : '0';
    
    let explanationText = `Great choice! You're interested in test driving the **${vehicle.year} ${vehicle.make} ${vehicle.model}**. `;
    // explanationText += `This vehicle comes in **${vehicle.color}** with **${mileage} miles** and is priced at **${vehicle.price}**. `;
    explanationText += `\n\n**Legal Requirements:**\n`;
    explanationText += `• Valid driver's license required ,`;
    explanationText += `Proof of insurance required,`;
    explanationText += `Must be 18 years or older.`;
    explanationText += `I'll help you with the test drive process and answer any questions you haveLets get through the process.`;

    // Create clean voice-over text for TTS (simple greeting with legal requirements)
    let voiceOverText = `Great choice! You're interested in test driving the ${vehicle.year} ${vehicle.make} ${vehicle.model}. `;
    voiceOverText += `This vehicle comes in ${vehicle.color} with ${mileage} miles and is priced at ${vehicle.price}. `;
    voiceOverText += `Please note that a valid driver's license and proof of insurance are required for test driving, and you must be 18 years or older. `;
    voiceOverText += `I'll help you with the test drive process and answer any questions you have.`;

    // Clean the voice-over text for better TTS pronunciation
    const cleanedVoiceOverText = cleanTextForTTS(voiceOverText);
    console.log('🧹 Cleaned test drive TTS text for better pronunciation:', cleanedVoiceOverText.substring(0, 100) + '...');

      // DISABLED: Test drive explanation text
      // setTestDriveExplanationText(explanationText);
      console.log('🧩 Test drive explanation disabled - skipping text update');
    
    try {
      // Set playing state
      setIsVehicleCardVoicePlaying(true);
      setVehicleGroupVoicePlayed(testDriveKey);
        
        // ✅ NEW: Check if backend audio is playing and wait for it to finish
        if (isGreetingAudioPlaying) {
          console.log('🎵 Backend audio is playing, waiting for it to finish before playing test drive voice-over...');
          // Wait for backend audio to finish (check every 500ms)
          const waitForBackendAudio = () => {
            return new Promise<void>((resolve) => {
              const checkInterval = setInterval(() => {
                if (!isGreetingAudioPlaying) {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 500);
              
              // Timeout after 30 seconds to prevent infinite waiting
              setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
              }, 30000);
            });
          };
          
          await waitForBackendAudio();
          console.log('✅ Backend audio finished, proceeding with test drive voice-over');
        }
      
      // Use clean voice-over text directly for fastest TTS conversion
      await playGreetingAudio(cleanedVoiceOverText);
      
      console.log('✅ Test drive voice-over played successfully');
    } catch (error) {
      console.error('Error playing test drive voice-over:', error);
    } finally {
      // Reset playing state after a delay
      setTimeout(() => {
        setIsVehicleCardVoicePlaying(false);
      }, 5000); // 5 second delay to prevent immediate re-triggering
    }
  };

  // Add this function to play voice-over for all vehicles as a group
  const playVehicleGroupVoiceOver = async (vehicles: any[]) => {
    console.log('🎤 Playing group voice-over for vehicles:', vehicles.length);
    
    // Create a unique key for this vehicle group
    const vehicleGroupKey = vehicles.map(v => `${v.id}-${v.year}-${v.make}-${v.model}`).join('|');
    
    // Only play if autoplay is enabled
    if (!autoplayEnabled) {
      console.log('🎤 Autoplay disabled, skipping vehicle group voice-over');
      return;
    }
    
    // Prevent if already played for this exact vehicle group
    if (vehicleGroupVoicePlayed === vehicleGroupKey) {
      console.log('🎤 Voice-over already played for this vehicle group, skipping');
      return;
    }
    
    // Prevent if other audio is playing
    if (isVehicleCardVoicePlaying || isGreetingAudioPlaying) {
      console.log('🎤 Other audio is playing, skipping vehicle group voice-over');
      return;
    }
    
    // Create comprehensive explanation text for all vehicles with natural pacing and formatting
    let explanationText = `I'm showing you **${vehicles.length} vehicles** today.\n\n`;
    
    vehicles.forEach((vehicle, index) => {
      const vehicleNumber = index + 1;
      // Fix the "miles miles" repetition by cleaning the mileage data
      const mileage = vehicle.mileage ? vehicle.mileage.toString().replace(/\s*miles?\s*/gi, '').trim() : '0';
      
      // Add natural pauses and slower pacing with formatting
      if (index === 0) {
        explanationText += `Let's start with the ${vehicle.year} ${vehicle.make} ${vehicle.model}. `;
        explanationText += `It features a ${vehicle.color} exterior, has ${mileage} miles on it, and is priced at ${vehicle.price}. `;
      } else if (index === vehicles.length - 1) {
        explanationText += `\n\nFinally, take a look at the ${vehicle.year} ${vehicle.make} ${vehicle.model}. `;
        explanationText += `This one also comes in ${vehicle.color}, showing ${mileage} miles, and is listed at ${vehicle.price}. `;
      } else {
        explanationText += `\n\nNext up is the ${vehicle.year} ${vehicle.make} ${vehicle.model}, `;
        explanationText += `finished in ${vehicle.color} with ${mileage} miles, priced at ${vehicle.price}. `;
      }
      });
    
      explanationText += `\n\nAll of these vehicles have been thoroughly inspected and come with our quality assurance guarantee. `;
      explanationText += `Take a moment to explore the options below — each card includes detailed photos and specifications. `;
      explanationText += `You can tap **‘Select’** to choose your favorite or **‘Test Drive’** to schedule a visit. `;
      explanationText += `For complete ownership and service details, click **‘Carfax Details’** on the right.`;

    // Create clean voice-over text optimized for fast TTS conversion (no formatting)
    let voiceOverText = `I'm showing you ${vehicles.length} vehicles today. `;
    
    vehicles.forEach((vehicle, index) => {
      const mileage = vehicle.mileage ? vehicle.mileage.toString().replace(/\s*miles?\s*/gi, '').trim() : '0';
      
      if (index === 0) {
        voiceOverText += `First, we have a ${vehicle.year} ${vehicle.make} ${vehicle.model}. `;
        voiceOverText += `It comes in ${vehicle.color} with ${mileage} miles, priced at ${vehicle.price}. `;
      } else if (index === vehicles.length - 1) {
        voiceOverText += `And finally, we have a ${vehicle.year} ${vehicle.make} ${vehicle.model}. `;
        voiceOverText += `This one is also in ${vehicle.color} with ${mileage} miles, priced at ${vehicle.price}. `;
      } else {
        voiceOverText += `Next, we have a ${vehicle.year} ${vehicle.make} ${vehicle.model}. `;
        voiceOverText += `This vehicle is in ${vehicle.color} with ${mileage} miles, and it's priced at ${vehicle.price}. `;
      }
    });
    
    voiceOverText += `All vehicles have been carefully inspected and come with our quality guarantee. `;
    voiceOverText += `Please take a look at the options below.`;

    // Clean the voice-over text for better TTS pronunciation
    const cleanedVoiceOverText = cleanTextForTTS(voiceOverText);
    console.log('🧹 Cleaned TTS text for better pronunciation:', cleanedVoiceOverText.substring(0, 100) + '...');

      // DISABLED: Vehicle overview explanation text
      // setVehicleOverviewText(explanationText);
      console.log('🧩 Vehicle overview explanation disabled - skipping text update');
    
    try {
      // Set playing state
      setIsVehicleCardVoicePlaying(true);
      setVehicleGroupVoicePlayed(vehicleGroupKey);
        
        // ✅ NEW: Check if backend audio is playing and wait for it to finish
        if (isGreetingAudioPlaying) {
          console.log('🎵 Backend audio is playing, waiting for it to finish before playing vehicle group voice-over...');
          // Wait for backend audio to finish (check every 500ms)
          const waitForBackendAudio = () => {
            return new Promise<void>((resolve) => {
              const checkInterval = setInterval(() => {
                if (!isGreetingAudioPlaying) {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 500);
              
              // Timeout after 30 seconds to prevent infinite waiting
              setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
              }, 30000);
            });
          };
          
          await waitForBackendAudio();
          console.log('✅ Backend audio finished, proceeding with vehicle group voice-over');
        }
      
      // Use clean voice-over text directly for fastest TTS conversion
      await playGreetingAudio(cleanedVoiceOverText);
      
      console.log('✅ Vehicle group voice-over played successfully');
    } catch (error) {
      console.error('Error playing vehicle group voice-over:', error);
    } finally {
      // Reset playing state after a delay
      setTimeout(() => {
        setIsVehicleCardVoicePlaying(false);
      }, 5000); // 5 second delay to prevent immediate re-triggering
    }
  };

  // ✅ NEW: VehicleCard component for displaying vehicle details
  const VehicleCard: React.FC<{ 
    vehicle: any; 
    onSelect: (vehicle: any) => void; 
    onTestDrive: (vehicle: any) => void;
  }> = ({ vehicle, onSelect, onTestDrive }) => {
    return (
      <div 
        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300"
        onClick={() => onSelect(vehicle)}
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg text-gray-900">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h3>
          <span className="text-lg font-bold text-blue-600">{vehicle.price}</span>
        </div>
        
        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex items-center">
            <span className="w-16 text-gray-500">Color:</span>
            <span className="font-medium">{vehicle.color}</span>
          </div>
          <div className="flex items-center">
            <span className="w-16 text-gray-500">Mileage:</span>
            <span className="font-medium">{vehicle.mileage}</span>
          </div>
          {vehicle.trim && (
            <div className="flex items-center">
              <span className="w-16 text-gray-500">Trim:</span>
              <span className="font-medium">{vehicle.trim}</span>
            </div>
          )}
          {vehicle.stockNumber && (
            <div className="flex items-center">
              <span className="w-16 text-gray-500">Stock:</span>
              <span className="font-medium text-xs">{vehicle.stockNumber}</span>
            </div>
          )}
        </div>

        {/* Main Features Section */}
        {((vehicle.vehicle_type || vehicle.new_used || (vehicle.features && vehicle.features.length > 0))) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Key Features</h4>
            <div className="flex flex-wrap gap-1.5">
              {vehicle.new_used && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  vehicle.new_used.toLowerCase() === 'new' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {vehicle.new_used}
                </span>
              )}
              {vehicle.vehicle_type && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  {vehicle.vehicle_type}
                </span>
              )}
              {vehicle.features && vehicle.features.slice(0, 4).map((feature, index) => (
                <span 
                  key={index}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                  title={feature}
                >
                  {feature.length > 20 ? `${feature.substring(0, 20)}...` : feature}
                </span>
              ))}
              {vehicle.features && vehicle.features.length > 4 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                  +{vehicle.features.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
        
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {/* Compact icon button: Select vehicle */}
            <button
              aria-label="Select This Vehicle"
              title="Select This Vehicle"
              className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(vehicle);
              }}
            >
              <Check className="w-4 h-4" />
            </button>

            {/* Compact icon button: Test drive */}
            <button
              aria-label="Test Drive Interested"
              title="Test Drive Interested"
              className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onTestDrive(vehicle);
              }}
            >
              <Calendar className="w-4 h-4" />
            </button>

            {/* Compact icon button: CARFAX (opens modal with carfax_reports data) */}
            <button
              aria-label="View CARFAX"
              title={vehicle.id ? 'View CARFAX Report' : 'CARFAX not available'}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
                vehicle.id 
                  ? 'bg-gray-800 text-white hover:bg-gray-900' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              } ${loadingCarfax ? 'opacity-50 cursor-wait' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!vehicle.id || loadingCarfax) return;
                handleCarfaxClick(vehicle);
              }}
              disabled={!vehicle.id || loadingCarfax}
            >
              {loadingCarfax ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            </button>

              {/* DISABLED: Audio stop button - no vehicle audio playing
              {isVehicleCardVoicePlaying && (
                <button
                  aria-label="Stop Audio"
                  title="Stop Vehicle Audio"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    stopVehicleCardAudio();
                  }}
                >
                  <Square className="w-4 h-4" />
                </button>
              )}
              */}
          </div>
        </div>
      </div>
    );
  };

  // Voice Panel Component - Shows alongside chat for continuous voice mode
  const VoicePanel: React.FC = () => {
    if (!showVoicePanel) return null;

    return (
      <div className="fixed right-2 sm:right-4 top-20 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-purple-200 z-40 overflow-hidden max-h-[calc(100vh-100px)] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              <h3 className="font-semibold">Voice Mode Active</h3>
            </div>
            <button
              onClick={() => {
                setIsContinuousVoiceMode(false);
                continuousVoiceModeRef.current = false;
                setShowVoicePanel(false);
                stopRecording();
                toast.info('Voice mode deactivated');
              }}
              className="hover:bg-white/20 rounded-full p-1 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Voice Visualization */}
        <div className="p-4 sm:p-6">
          {/* Animated Voice Orb */}
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-3">
            {isRecording ? (
              <>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-400 to-pink-600 opacity-50 animate-pulse"></div>
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-red-500 to-pink-700 opacity-60 animate-ping"></div>
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-red-300 to-pink-500 opacity-70 flex items-center justify-center">
                  <Mic className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                </div>
              </>
            ) : isPlaying ? (
              <>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 opacity-50 animate-pulse"></div>
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-400 to-blue-600 opacity-60" style={{animation: 'spin 2s linear infinite'}}></div>
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-300 to-purple-500 opacity-70 flex items-center justify-center">
                  <Volume2 className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 opacity-30 animate-pulse"></div>
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  <Mic className="h-8 w-8 sm:h-10 sm:w-10 text-gray-500" />
                </div>
              </>
            )}
          </div>

          {/* Status */}
          <div className="text-center mb-3">
            <p className="text-base sm:text-lg font-semibold text-gray-800">
              {isRecording ? '🎤 Listening...' : isPlaying ? '🔊 AI Speaking...' : isProcessing ? '⏳ Processing...' : '⏸️ Waiting...'}
            </p>
            {isRecording && recordingDuration > 0 && (
              <p className="text-sm text-gray-600 mt-1">{recordingDuration}s</p>
            )}
          </div>

          {/* Action Buttons */}
          {isRecording && (
            <div className="mb-3">
              <Button
                onClick={() => stopRecording()}
                className="w-full bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Speaking
              </Button>
            </div>
          )}

          {/* Info */}
          <div className="bg-purple-50 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm text-gray-700">
            <p className="mb-1.5 sm:mb-2 font-medium">💡 Continuous mode</p>
            <ul className="text-xs space-y-0.5 sm:space-y-1 ml-3 sm:ml-4">
              <li>• Speak to continue conversation</li>
              <li>• Auto-stops when you finish speaking</li>
              <li>• Auto-listens after AI responds</li>
              <li>• Interrupt by speaking anytime</li>
            </ul>
          </div>

          {/* Status Indicators */}
          <div className="mt-3 space-y-2">
            {isVADEnabled && (
              <div className="flex items-center justify-center gap-2 text-xs text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Interruption Detection Active</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-xs text-blue-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>{isRecording ? 'Detecting silence...' : 'Auto-stop ready'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ✅ NEW: CarFax Modal Component
  const CarfaxModal: React.FC = () => {
    if (!showCarfaxModal || !carfaxData) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-gray-800 text-white p-4 flex justify-between items-center rounded-t-lg">
            <div>
              <h2 className="text-xl font-bold">CARFAX Vehicle History Report</h2>
              {selectedCarfaxVehicle && (
                <p className="text-sm text-gray-300 mt-1">
                  {selectedCarfaxVehicle.year} {selectedCarfaxVehicle.make} {selectedCarfaxVehicle.model}
                </p>
              )}
            </div>
            <button
              onClick={closeCarfaxModal}
              className="text-white hover:text-gray-300 text-2xl font-bold"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Key Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="text-3xl font-bold text-blue-600">{carfaxData.owners || 0}</div>
                <div className="text-sm text-gray-600">Owner{carfaxData.owners !== 1 ? 's' : ''}</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-3xl font-bold text-green-600">{carfaxData.service_records || 0}</div>
                <div className="text-sm text-gray-600">Service Records</div>
              </div>
              <div className={`p-4 rounded-lg border ${carfaxData.accident_count > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className={`text-3xl font-bold ${carfaxData.accident_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {carfaxData.accident_count || 0}
                </div>
                <div className="text-sm text-gray-600">Accident{carfaxData.accident_count !== 1 ? 's' : ''} Reported</div>
              </div>
            </div>

            {/* Critical Issues */}
            {(carfaxData.title_issues || carfaxData.flood_damage || carfaxData.structural_damage || 
              carfaxData.airbag_deployment || carfaxData.odometer_rollback || carfaxData.lemon_title) && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-red-800 mb-3 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Critical Issues Found
                </h3>
                <div className="space-y-2">
                  {carfaxData.title_issues && (
                    <div className="flex items-center text-red-700">
                      <X className="w-4 h-4 mr-2" />
                      Title Issues Detected
                    </div>
                  )}
                  {carfaxData.flood_damage && (
                    <div className="flex items-center text-red-700">
                      <X className="w-4 h-4 mr-2" />
                      Flood Damage Reported
                    </div>
                  )}
                  {carfaxData.structural_damage && (
                    <div className="flex items-center text-red-700">
                      <X className="w-4 h-4 mr-2" />
                      Structural Damage
                    </div>
                  )}
                  {carfaxData.airbag_deployment && (
                    <div className="flex items-center text-red-700">
                      <X className="w-4 h-4 mr-2" />
                      Airbag Deployment History
                    </div>
                  )}
                  {carfaxData.odometer_rollback && (
                    <div className="flex items-center text-red-700">
                      <X className="w-4 h-4 mr-2" />
                      Odometer Rollback Detected
                    </div>
                  )}
                  {carfaxData.lemon_title && (
                    <div className="flex items-center text-red-700">
                      <X className="w-4 h-4 mr-2" />
                      Lemon Title
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Previous Usage */}
            {(carfaxData.previous_rental || carfaxData.previous_taxi || carfaxData.previous_police || 
              carfaxData.previous_fleet || carfaxData.previous_lease) && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-3">Previous Usage</h3>
                <div className="grid grid-cols-2 gap-2">
                  {carfaxData.previous_rental && <div className="text-yellow-700">• Rental Vehicle</div>}
                  {carfaxData.previous_taxi && <div className="text-yellow-700">• Taxi/Rideshare</div>}
                  {carfaxData.previous_police && <div className="text-yellow-700">• Police Vehicle</div>}
                  {carfaxData.previous_fleet && <div className="text-yellow-700">• Fleet Vehicle</div>}
                  {carfaxData.previous_lease && <div className="text-yellow-700">• Leased Vehicle</div>}
                  {carfaxData.previous_corporate && <div className="text-yellow-700">• Corporate Use</div>}
                  {carfaxData.previous_government && <div className="text-yellow-700">• Government Use</div>}
                </div>
              </div>
            )}

            {/* Vehicle Attributes */}
            {carfaxData.certified_pre_owned && (
              <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-green-800 mb-2 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Certified Pre-Owned Vehicle
                </h3>
                <p className="text-sm text-gray-600">This vehicle meets manufacturer certification standards</p>
              </div>
            )}

            {/* Additional Details */}
            {(carfaxData.manufacturer_recall || carfaxData.previous_salvage || carfaxData.previous_fire || 
              carfaxData.previous_hail || carfaxData.previous_theft) && (
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Additional History</h3>
                <div className="space-y-2 text-sm">
                  {carfaxData.manufacturer_recall && (
                    <div className="text-gray-700">⚠️ Manufacturer Recall Reported</div>
                  )}
                  {carfaxData.previous_salvage && (
                    <div className="text-gray-700">• Salvage Title History</div>
                  )}
                  {carfaxData.previous_fire && (
                    <div className="text-gray-700">• Fire Damage History</div>
                  )}
                  {carfaxData.previous_hail && (
                    <div className="text-gray-700">• Hail Damage History</div>
                  )}
                  {carfaxData.previous_theft && (
                    <div className="text-gray-700">• Theft History</div>
                  )}
                  {carfaxData.previous_vandalism && (
                    <div className="text-gray-700">• Vandalism History</div>
                  )}
                  {carfaxData.previous_water && (
                    <div className="text-gray-700">• Water Damage History</div>
                  )}
                </div>
              </div>
            )}

            {/* Summary */}
            {carfaxData.summary && (
              <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Summary</h3>
                <p className="text-gray-700 text-sm">{carfaxData.summary}</p>
              </div>
            )}

            {/* Notes */}
            {carfaxData.notes && (
              <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Notes</h3>
                <p className="text-gray-700 text-sm">{carfaxData.notes}</p>
              </div>
            )}

            {/* Report Info */}
            <div className="text-xs text-gray-500 border-t pt-4">
              <p>Report Date: {new Date(carfaxData.report_date || carfaxData.uploaded_at).toLocaleDateString()}</p>
              {carfaxData.uploaded_by_name && (
                <p>Uploaded by: {carfaxData.uploaded_by_name}</p>
              )}
              {carfaxData.report_url && (
                <a 
                  href={buildBackendAssetUrl(carfaxData.report_url)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline mt-2 inline-block"
                >
                  View Full PDF Report →
                </a>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-100 p-4 rounded-b-lg flex justify-end">
            <button
              onClick={closeCarfaxModal}
              className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // NEW: Enhanced message formatting component for better readability
  const FormattedMessage: React.FC<{ content: string; role: string }> = ({ content, role }) => {
    if (role === 'user') {
      return <p className="text-sm leading-relaxed">{content}</p>;
    }

    // Check if this is a QR greeting with vehicle details
    const isQRGreetingWithVehicle = role === 'assistant' && qrVehicleDetails && content.includes('Vehicle Details:');

    // Format AI responses for better readability
    const formatAIResponse = (text: string) => {
      console.log('🔍 formatAIResponse called with text:', text.substring(0, 100) + '...');
      console.log('🔍 Full text received:', text);
      console.log('🔍 Text contains \\n\\n:', text.includes('\n\n'));
      console.log('🔍 Text contains \\n:', text.includes('\n'));
      
      // Backend generates complete buttons - no frontend enhancement needed
      console.log('🔍 Backend generates complete buttons - no frontend enhancement needed');
      
      // Split into paragraphs
      const paragraphs = text.split('\n\n').filter(p => p.trim());
      console.log('🔍 Paragraphs found:', paragraphs.length);
      
      return (
        <div className="space-y-4">
          {paragraphs.map((paragraph, index) => {
            const trimmedParagraph = paragraph.trim();
            
            // Check if it's a numbered list
            if (/^\d+\./.test(trimmedParagraph)) {
              console.log('🔍 Processing numbered list paragraph:', trimmedParagraph);
              const listItems = trimmedParagraph.split('\n').filter(item => item.trim());
              
              return (
                <div key={index} className="space-y-3">
                  {listItems.map((item, itemIndex) => {
                    const match = item.match(/^(\d+)\.\s*(.+)/);
                    if (match) {
                      const itemContent = match[2];
                      console.log('🔍 Processing list item:', itemContent);
                      
                      // Check if this item contains HTML buttons from backend
                      if (itemContent.includes('<button class="view-images-btn"')) {
                        console.log('🔍 List item contains view-images buttons from backend');
                        
                        return (
                          <div key={itemIndex} className="flex items-start gap-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                            <span className="flex-shrink-0 w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {match[1]}
                            </span>
                            <div 
                              className="text-sm leading-relaxed text-gray-800 font-medium flex-1"
                              dangerouslySetInnerHTML={{ __html: itemContent }}
                            />
                          </div>
                        );
                      }
                      
                      // Regular list item without markers
                      return (
                        <div key={itemIndex} className="flex items-start gap-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                          <span className="flex-shrink-0 w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {match[1]}
                          </span>
                          <span className="text-sm leading-relaxed text-gray-800 font-medium">{itemContent}</span>
                        </div>
                      );
                    }
                    return <span key={itemIndex} className="text-sm leading-relaxed text-gray-600">{item}</span>;
                  })}
                </div>
              );
            }
            
            // ✅ Check for CarFax button FIRST (before other formatting)
            if (trimmedParagraph.includes('<button class="carfax-btn"')) {
              console.log('🔍 Paragraph contains CarFax button');
              
              return (
                <div 
                  key={index} 
                  className="text-sm leading-relaxed text-gray-800 leading-6"
                  dangerouslySetInnerHTML={{ __html: trimmedParagraph }}
                />
              );
            }
            
            // Check if it's a bullet list
            if (trimmedParagraph.includes('•') || trimmedParagraph.includes('-')) {
              const listItems = trimmedParagraph.split('\n').filter(item => item.trim());
              return (
                <div key={index} className="space-y-2">
                  {listItems.map((item, itemIndex) => {
                    const cleanItem = item.replace(/^[•\-]\s*/, '').trim();
                    if (cleanItem) {
                      return (
                        <div key={itemIndex} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                          <span className="flex-shrink-0 w-2.5 h-2.5 bg-blue-500 rounded-full mt-2"></span>
                          <span className="text-sm leading-relaxed text-gray-800">{cleanItem}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            }
            
                                     // Check if it contains vehicle information (special formatting)
             if (trimmedParagraph.includes('🚗') || trimmedParagraph.includes('**') || trimmedParagraph.includes('💰')) {
               // Format vehicle information with better structure
               let formattedParagraph = trimmedParagraph
                 .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 bg-yellow-100 px-1 py-0.5 rounded">$1</strong>')
                 .replace(/🚗/g, '<span class="inline-block w-5 h-5 mr-1">🚗</span>')
                 .replace(/💰/g, '<span class="inline-block w-5 h-5 mr-1">💰</span>')
                 .replace(/🎨/g, '<span class="inline-block w-5 h-5 mr-1">🎨</span>')
                 .replace(/💡/g, '<span class="inline-block w-5 h-5 mr-1">💡</span>')
                 .replace(/🎯/g, '<span class="inline-block w-5 h-5 mr-1">🎯</span>')
                 .replace(/🔄/g, '<span class="inline-block w-5 h-5 mr-1">🔄</span>')
                 .replace(/💬/g, '<span class="inline-block w-5 h-5 mr-1">💬</span>')
                 .replace(/🎉/g, '<span class="inline-block w-5 h-5 mr-1">🎉</span>')
                 .replace(/✨/g, '<span class="inline-block w-5 h-5 mr-1">✨</span>');
               
               // Note: [View Images] buttons are now generated by the backend
               // and rendered directly as HTML buttons
               
               return (
                 <div 
                   key={index} 
                   className="text-sm leading-relaxed p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100"
                   dangerouslySetInnerHTML={{ __html: formattedParagraph }}
                 />
               );
             }
            
            // Check if it's a call-to-action or important information
            if (trimmedParagraph.includes('**Next Steps') || trimmedParagraph.includes('**What interests you') || trimmedParagraph.includes('**How Can I Help')) {
              return (
                <div key={index} className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <p className="text-sm leading-relaxed text-gray-800 font-medium">
                    {trimmedParagraph}
                  </p>
                </div>
              );
            }
            
            // Check if it's a question
            if (trimmedParagraph.includes('?') && trimmedParagraph.length < 100) {
              return (
                <div key={index} className="p-3 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-200">
                  <p className="text-sm leading-relaxed text-gray-800 font-medium">
                    {trimmedParagraph}
                  </p>
                </div>
              );
            }
            
                                                  // Backend generates complete HTML buttons - no frontend processing needed
             if (trimmedParagraph.includes('<button class="view-images-btn"')) {
               console.log('🔍 Paragraph contains view-images buttons from backend');
               
               return (
                 <div 
                   key={index} 
                   className="text-sm leading-relaxed text-gray-800 leading-6"
                   dangerouslySetInnerHTML={{ __html: trimmedParagraph }}
                 />
               );
             }
             
             // Regular paragraph with enhanced typography
             return (
               <p key={index} className="text-sm leading-relaxed text-gray-800 leading-6">
                 {trimmedParagraph}
               </p>
             );
          })}
        </div>
      );
    };

    // If this is a QR greeting with vehicle details, add vehicle image
    if (isQRGreetingWithVehicle && qrVehicleDetails) {
      const vehicleImageUrl = qrVehicleDetails.images && qrVehicleDetails.images.length > 0 
        ? buildAssetUrl(qrVehicleDetails.images[0]) 
        : null;
      
      return (
        <div className="space-y-4">
          {/* Vehicle Image */}
          {vehicleImageUrl && (
            <div className="flex justify-center mb-4">
              <div className="relative w-full max-w-md">
                <img 
                  src={vehicleImageUrl} 
                  alt={`${qrVehicleDetails.year} ${qrVehicleDetails.make} ${qrVehicleDetails.model}`}
                  className="w-full h-48 object-cover rounded-lg shadow-lg border border-gray-200"
                  onError={(e) => {
                    console.log('Vehicle image failed to load:', vehicleImageUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs font-medium">
                  Stock #{qrVehicleDetails.stock_number || 'N/A'}
                </div>
              </div>
            </div>
          )}
          
          {/* Formatted Message Content */}
          {formatAIResponse(content)}
        </div>
      );
    }

    return formatAIResponse(content);
  };

  // NEW: Typewriter effect function
  const startTypewriterEffect = (message: Message) => {
    if (!typewriterEnabled || isTypewriting) return; // Check if typewriter is enabled and not already running
    
    setIsTypewriting(true);
    setCurrentTypewriterMessage(message);
    setTypewriterText('');
    
    const fullText = message.content || '';
    let currentIndex = 0;
    
    const typeNextChar = () => {
      if (currentIndex < fullText.length) {
        setTypewriterText(fullText.substring(0, currentIndex + 1));
        currentIndex++;
        
        // Continue typing
        setTimeout(typeNextChar, typewriterSpeed);
      } else {
        // Finished typing
        setIsTypewriting(false);
        setCurrentTypewriterMessage(null);
        
        // Update the message with the full text
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg === message ? { ...msg, content: fullText } : msg
          )
        );
      }
    };
    
    // Start the typewriter effect
    typeNextChar();
  };
  
  // NEW: Function to stop typewriter effect and show full text immediately
  const skipTypewriterEffect = () => {
    if (currentTypewriterMessage) {
      setIsTypewriting(false);
      setCurrentTypewriterMessage(null);
      
      // Show the full message immediately
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg === currentTypewriterMessage ? { ...msg, content: currentTypewriterMessage.content } : msg
        )
      );
    }
  };
  

  
  // NEW: Function to fetch vehicle images and open gallery
  const openVehicleImages = async (vehicleId: string) => {
    try {
      console.log(`🖼️ Fetching images for vehicle: ${vehicleId}`);
      
      // Fetch vehicle data including photo_url_list
      const authToken = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(buildApiUrl(`vehicles/${vehicleId}`), {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch vehicle: ${response.status}`);
      }
      
      const vehicle = await response.json();
      
      // Extract images from vehicle data
      let images: string[] = [];
      if (vehicle.photo_url_list) {
        // Handle both array and string formats
        if (Array.isArray(vehicle.photo_url_list)) {
          images = vehicle.photo_url_list.filter(url => url && typeof url === 'string');
        } else if (typeof vehicle.photo_url_list === 'string') {
          // Handle PostgreSQL array string format: {"url1","url2","url3"}
          if (vehicle.photo_url_list.startsWith('{') && vehicle.photo_url_list.endsWith('}')) {
            const content = vehicle.photo_url_list.slice(1, -1); // Remove { and }
            images = content.split(',').map(url => url.trim().replace(/"/g, '')).filter(url => url);
          } else if (vehicle.photo_url_list.includes('http')) {
            // If it's a string, parse comma-separated URLs
            images = vehicle.photo_url_list.split(',').map(url => url.trim()).filter(url => url.startsWith('http'));
          }
        }
      }
      
      console.log(`🖼️ Found ${images.length} images for vehicle ${vehicleId}:`, images);
      
      if (images.length === 0) {
        toast.warning('No images available for this vehicle');
        return;
      }
      
      // Create vehicle title for display
      const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`;
      
      // Open the image gallery
      openImageGallery(vehicleId, vehicleTitle);
      
    } catch (error) {
      console.error('Error fetching vehicle images:', error);
      toast.error('Failed to load vehicle images. Please try again.');
    }
  };

  // NEW: Image gallery functions
  const openImageGallery = async (vehicleId: string, vehicleTitle: string) => {
    try {
      console.log(`🖼️ Opening image gallery for vehicle: ${vehicleId}`);
      
      // Handle demo vehicles (for testing purposes)
      if (vehicleId === 'demo-vehicle') {
        // Use sample images for demo
        const demoImages = [
          'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=600&fit=crop',
          'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop',
          'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&h=600&fit=crop'
        ];
        
        setCurrentGalleryImages(demoImages);
        setCurrentImageIndex(0);
        setCurrentVehicleInfo({ id: vehicleId, title: vehicleTitle });
        setShowImageGallery(true);
        
        console.log(`✅ Demo image gallery opened with ${demoImages.length} sample images`);
        return;
      }
      
      // Fetch vehicle data including photo_url_list from the vehicles table
      const authToken = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(buildApiUrl(`vehicles/${vehicleId}`), {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch vehicle: ${response.status}`);
      }
      
      const data = await response.json();
      const vehicle = data.vehicle || data.data;
      
      if (!vehicle) {
        throw new Error('Vehicle not found');
      }
      
      // Parse the photo_url_list field from the vehicle
      let images: string[] = [];
      if (vehicle.photo_url_list) {
        // Handle both array and string formats
        if (Array.isArray(vehicle.photo_url_list)) {
          images = vehicle.photo_url_list.filter(url => url && typeof url === 'string');
        } else if (typeof vehicle.photo_url_list === 'string') {
          // Handle PostgreSQL array string format: {"url1","url2","url3"}
          if (vehicle.photo_url_list.startsWith('{') && vehicle.photo_url_list.endsWith('}')) {
            const content = vehicle.photo_url_list.slice(1, -1); // Remove { and }
            images = content.split(',').map(url => url.trim().replace(/"/g, '')).filter(url => url);
          } else if (vehicle.photo_url_list.includes('http')) {
            // If it's a string, parse comma-separated URLs
            images = vehicle.photo_url_list.split(',').map(url => url.trim()).filter(url => url.startsWith('http'));
          }
        }
      }
      
      console.log(`🖼️ Found ${images.length} images in photo_url_list for vehicle ${vehicleId}:`, images);
      
      if (images.length === 0) {
        toast.warning('No images available for this vehicle');
        return;
      }
      
      // Set gallery state
      setCurrentGalleryImages(images);
      setCurrentImageIndex(0);
      setCurrentVehicleInfo({ id: vehicleId, title: vehicleTitle });
      setShowImageGallery(true);
      
      console.log(`✅ Image gallery opened with ${images.length} images from photo_url_list`);
      
    } catch (error) {
      console.error('❌ Error opening image gallery:', error);
      toast.error('Failed to load images. Please try again.');
    }
  };
  
  const closeImageGallery = () => {
    setShowImageGallery(false);
    setCurrentGalleryImages([]);
    setCurrentImageIndex(0);
    setCurrentVehicleInfo(null);
  };
  
  const nextImage = () => {
    if (currentGalleryImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % currentGalleryImages.length);
    }
  };
  
  const prevImage = () => {
    if (currentGalleryImages.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + currentGalleryImages.length) % currentGalleryImages.length);
    }
  };
  
  const goToImage = (index: number) => {
    if (index >= 0 && index < currentGalleryImages.length) {
      setCurrentImageIndex(index);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-2 sm:p-4">
      {/* ✅ CarFax Button Styling */}
      <style>{`
        .carfax-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08);
          margin: 0.25rem 0;
          letter-spacing: 0.01em;
        }
        
        .carfax-btn:hover {
          background: linear-gradient(135deg, #334155 0%, #475569 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }
        
        .carfax-btn:active {
          transform: translateY(0);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .carfax-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        
        /* Icon styling within button */
        .carfax-btn::before {
          content: '📋';
          font-size: 0.875rem;
          line-height: 1;
        }
      `}</style>
      
      <div className="max-w-4xl mx-auto">
        <Card className="w-full flex flex-col">
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">D</span>
              </div>
              <span className="text-lg sm:text-xl">D.A.I.V.E. AI Bot</span>
              <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                <Badge variant="secondary" className="text-xs">
                  {vehicleInfo ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}` : 'Dealer Inventory'}
                </Badge>
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {!isProductionMode && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={testBackendConnection}
                        className="h-6 px-2 text-xs text-xs"
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
                        <span className="ml-1 text-xs hidden sm:inline">
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
                        onClick={() => clearCacheAndRefresh(false)}
                        className="h-6 px-2 text-xs bg-red-50 border-red-200 hover:bg-red-100"
                        title="Clear cache and refresh dealer context"
                      >
                        Clear Cache
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={toggleJourneyTracker}
                        className={`h-6 px-2 text-xs ${
                          showJourneyTracker 
                            ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                            : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                        }`}
                        title={showJourneyTracker ? 'Hide journey tracker' : 'Show journey tracker'}
                      >
                        {showJourneyTracker ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span className="ml-1 text-xs hidden sm:inline">
                          {showJourneyTracker ? 'Hide Tracker' : 'Show Tracker'}
                        </span>
                      </Button>
                    </>
                  )}
                  {!isProductionMode && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={toggleProductionMode}
                      className={`h-6 px-2 text-xs ${
                        isProductionMode 
                          ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                          : 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                      }`}
                      title={isProductionMode ? 'Switch to Production Mode (or use Ctrl+Shift+D)' : 'Switch to Development Mode (or use Ctrl+Shift+D)'}
                    >
                      {isProductionMode ? '🔒 Prod' : '🔧 Dev'}
                    </Button>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {backendStatus}
                </span>
                {!isProductionMode && (
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
                )}
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'chat' | 'debug')} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mx-4 mt-4">
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="debug" className="flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Debug
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
                {/* Journey Tracker Display - Development Only */}
                {showJourneyTracker && !isProductionMode && (
                  <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Journey Tracker (Dev Mode)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={toggleJourneyTracker}
                          className="h-6 px-2 text-xs bg-red-50 border-red-200 hover:bg-red-100"
                          title="Hide journey tracker (will be hidden in production)"
                        >
                          <EyeOff className="w-3 h-3 mr-1" />
                          Hide
                        </Button>
                      </div>
                    </div>
                    <div className="px-3 pb-3">
                      <JourneyTrackerDisplay sessionId={sessionId} />
                    </div>
                  </div>
                )}
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-2 sm:px-4 pb-4 bg-gradient-to-b from-gray-50 to-white" ref={scrollAreaRef}>
              <div className="space-y-4 py-2">
                {messages.filter(message => message && message.content).map((message, index) => {
                  // console.log(`🎨 Rendering message ${index}:`, {
                  //   role: message.role,
                  //   contentLength: message.content?.length,
                  //   contentPreview: message.content?.substring(0, 50) + '...'
                  // });
                  
                  // Check if this message is currently being typewritten
                  const isCurrentlyTypewriting = currentTypewriterMessage === message && isTypewriting;
                  const displayText = isCurrentlyTypewriting ? typewriterText : message.content;
                  
                  return (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in-0 slide-in-from-bottom-2 duration-300`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm message-bubble ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-900'
                      }`}
                    >
                      {displayText && (displayText.includes('<div class="inventory-grid">') || displayText.includes('<ul class="inventory-list">')) ? (
                        <div 
                          className="text-sm max-w-full"
                          dangerouslySetInnerHTML={{ __html: displayText }}
                          onClick={(e) => handleVehicleClick(e)}
                        />
                      ) : (
                        <FormattedMessage content={displayText || 'No content available'} role={message.role} />
                      )}
                      
                      {/* Audio availability indicator for QR greeting */}
                      {message.role === 'assistant' && shouldPlayGreetingOnInteraction && index === 0 && (
                        <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                          🔊 Audio will be available after you start typing or click in the chat
                        </div>
                      )}
                      
                      {/* ✅ NEW: Display vehicle cards for inventory responses */}
                      {message.role === 'assistant' && showVehicleCards && currentVehicleDetails.length > 0 && index === messages.length - 1 && (
                        <div className="mt-4">
                          {/* Vehicle Cards Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 transition-all duration-300 ease-in-out">
                            {getCurrentPageVehicles().map((vehicle, vehicleIndex) => (
                              <VehicleCard 
                                key={`${currentVehiclePage}-${vehicleIndex}`} 
                                vehicle={vehicle} 
                                onSelect={handleVehicleSelection}
                                onTestDrive={handleTestDriveInterest}
                              />
                            ))}
                          </div>
                          
                          
                          {/* Pagination Controls - Contained within vehicle area */}
                          {getTotalPages() > 1 && (
                            <div className="flex items-center justify-center mt-4 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                              {/* Previous Button */}
                              <button
                                onClick={goToPreviousPage}
                                disabled={currentVehiclePage === 0}
                                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                  currentVehiclePage === 0
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                                }`}
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Previous
                              </button>
                              
                              {/* Page Indicators - Limited to show max 7 pages */}
                              <div className="flex items-center space-x-1 mx-4">
                                {(() => {
                                  const totalPages = getTotalPages();
                                  const maxVisiblePages = 7;
                                  let startPage = Math.max(0, currentVehiclePage - Math.floor(maxVisiblePages / 2));
                                  let endPage = Math.min(totalPages, startPage + maxVisiblePages);
                                  
                                  if (endPage - startPage < maxVisiblePages) {
                                    startPage = Math.max(0, endPage - maxVisiblePages);
                                  }
                                  
                                  const pages = [];
                                  
                                  // Show first page if not visible
                                  if (startPage > 0) {
                                    pages.push(
                                      <button
                                        key={0}
                                        onClick={() => goToPage(0)}
                                        className="w-8 h-8 rounded-full text-sm font-medium transition-colors text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                      >
                                        1
                                      </button>
                                    );
                                    if (startPage > 1) {
                                      pages.push(<span key="ellipsis1" className="text-gray-400">...</span>);
                                    }
                                  }
                                  
                                  // Show visible pages
                                  for (let i = startPage; i < endPage; i++) {
                                    pages.push(
                                      <button
                                        key={i}
                                        onClick={() => goToPage(i)}
                                        className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                                          i === currentVehiclePage
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                        }`}
                                      >
                                        {i + 1}
                                      </button>
                                    );
                                  }
                                  
                                  // Show last page if not visible
                                  if (endPage < totalPages) {
                                    if (endPage < totalPages - 1) {
                                      pages.push(<span key="ellipsis2" className="text-gray-400">...</span>);
                                    }
                                    pages.push(
                                      <button
                                        key={totalPages - 1}
                                        onClick={() => goToPage(totalPages - 1)}
                                        className="w-8 h-8 rounded-full text-sm font-medium transition-colors text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                      >
                                        {totalPages}
                                      </button>
                                    );
                                  }
                                  
                                  return pages;
                                })()}
                              </div>
                              
                              {/* Next Button */}
                              <button
                                onClick={goToNextPage}
                                disabled={currentVehiclePage === getTotalPages() - 1}
                                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                  currentVehiclePage === getTotalPages() - 1
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                                }`}
                              >
                                Next
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </div>
                          )}
                          
                          {/* Vehicle Count Info */}
                          <div className="text-center text-sm text-gray-500 mt-2">
                            Showing {getCurrentPageVehicles().length} of {currentVehicleDetails.length} vehicles
                            {getTotalPages() > 1 && ` (Page ${currentVehiclePage + 1} of ${getTotalPages()})`}
                          </div>
                          
                            {/* DISABLED: Vehicle Overview Text - Separate from messages to prevent re-rendering
                          {vehicleOverviewText && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-start">
                                <span className="text-blue-600 text-lg mr-2">💡</span>
                                <div>
                                  <strong className="text-blue-800 text-sm font-semibold">Vehicle Overview:</strong>
                                  <div className="text-blue-700 text-sm mt-1 leading-relaxed">
                                    {vehicleOverviewText.split('\n\n').map((paragraph, index) => (
                                      <p key={index} className={index > 0 ? 'mt-2' : ''}>
                                        {paragraph}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                            */}
                          
                            {/* DISABLED: Test Drive Explanation Text - Separate from messages to prevent re-rendering
                          {testDriveExplanationText && (
                            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-start">
                                <span className="text-green-600 text-lg mr-2">🚗</span>
                                <div>
                                  <strong className="text-green-800 text-sm font-semibold">Test Drive Interest:</strong>
                                  <div className="text-green-700 text-sm mt-1 leading-relaxed">
                                    {testDriveExplanationText.split('\n\n').map((paragraph, index) => (
                                      <p key={index} className={index > 0 ? 'mt-2' : ''}>
                                        {paragraph}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                            */}
                          
                          {/* Show More Options Button */}
                            {/* <div className="text-center mt-4">
                            <button
                              onClick={handleShowMoreOptions}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-300"
                            >
                              Show More Vehicle Options
                            </button>
                            </div> */}
                        </div>
                      )}
                      
                      {/* Typewriter cursor for AI messages - REMOVED */}
                      
                      {/* Skip typewriter button for AI messages */}
                      {isCurrentlyTypewriting && (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={skipTypewriterEffect}
                            className="h-6 px-2 text-xs bg-orange-50 border-orange-200 hover:bg-orange-100"
                            title="Skip typewriter effect and show full text"
                          >
                            ⏭️ Skip Typing
                          </Button>
                        </div>
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
                              onClick={() => {
                                const messageId = `${message.timestamp}-${message.role}`;
                                const isThisMessagePlaying = isPlaying && playingMessageId === messageId;
                                
                                if (isThisMessagePlaying) {
                                  console.log('🔇 Stopping audio for message:', messageId);
                                  stopAudio();
                                } else {
                                  console.log('🎵 Playing audio for message:', messageId);
                                  playAudio(message.audioUrl!, messageId);
                                }
                              }}
                            className="h-6 px-2"
                          >
                              {isPlaying && playingMessageId === `${message.timestamp}-${message.role}` ? (
                              <Square className="h-3 w-3" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                            <span className="ml-1 text-xs">
                                {isPlaying && playingMessageId === `${message.timestamp}-${message.role}` ? 'Stop' : 'Play'} Audio
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
                {/* Clean, Simple Thinking Indicator - Original Style */}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <span className="text-sm text-gray-600 ml-2">D.A.I.V.E. is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* NEW: Crew AI Toggle Thinking Indicator */}
                {isCrewAIToggling && (
                  <div className="flex justify-start">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <span className="text-sm text-green-700 ml-2 font-medium">🔄 Switching Crew AI mode...</span>
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Crew AI</span>
                    <Badge variant="secondary" className="text-xs">
                      {isCrewAIToggling ? 'Switching...' : useCrewAI ? 'Active' : 'Standby'}
                    </Badge>
                    {isCrewAIToggling && (
                      <Loader2 className="h-3 w-3 animate-spin text-green-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                  {crewType !== 'N/A' && (
                    <span className="text-xs text-green-600">
                      Using: {crewType}
                    </span>
                  )}
                    <div className="flex items-center gap-1">
                      <Volume2 className={`h-3 w-3 ${autoplayEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className={`text-xs ${autoplayEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                        {autoplayEnabled ? 'Autoplay ON' : 'Autoplay OFF'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs">✍️</span>
                      <span className={`text-xs ${typewriterEnabled ? 'text-purple-600' : 'text-gray-400'}`}>
                        {typewriterEnabled ? 'Typewriter ON' : 'Typewriter OFF'}
                      </span>
                    </div>
                    {/* Processing indicator */}
                    {isProcessing && (
                      <div className="flex items-center gap-1 ml-2">
                        <Loader2 className="h-3 w-3 animate-spin text-green-600" />
                        <span className="text-xs text-green-600 font-medium">Processing...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* DISABLED: Inactivity Timer Status */}
            {/* {!followUpSent && messages.length > 0 && (
              <div className="p-2 border-t border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    <span className="text-sm text-blue-700">Inactivity Timer Active</span>
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {Math.max(0, Math.ceil((30000 - (Date.now() - lastUserActivity)) / 1000))}s
                    </Badge>
                  </div>
                  <div className="text-xs text-blue-600">
                    Follow-up message will appear after 30s of inactivity
                  </div>
                </div>
              </div>
            )} */}

            {/* Modern Welcome Section - Only show when messages are minimal */}
            {messages.length <= 1 && (
              <div className="p-6 sm:p-8">
                {/* Greeting */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                    Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'} How can I help you?
                  </h2>
                  <p className="text-lg text-gray-600">Let's get started with your inquiry</p>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-6">
                  {/* Voice Card */}
                  <div 
                    className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-3xl p-6 border border-purple-200 hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105"
                    onClick={() => {
                      if (!isProcessing && !isRecording) {
                        // Enable continuous voice mode
                        setIsContinuousVoiceMode(true);
                        continuousVoiceModeRef.current = true;
                        setShowVoicePanel(true);
                        
                        // Enable VAD if not already enabled
                        if (!isVADEnabled) {
                          setIsVADEnabled(true);
                          localStorage.setItem('daive_vad_enabled', 'true');
                          toast.info('Voice interruption enabled');
                        }
                        
                        // Start first recording
                        handleVoiceButtonClick();
                        toast.success('🎤 Continuous voice mode activated!');
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center">
                        <Mic className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Voice</h3>
                        <p className="text-sm text-gray-600">Talk to AI assistant</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Continuous conversation mode</p>
                  </div>

                  {/* Text Input Card */}
                  <div 
                    className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-3xl p-6 border border-blue-200 hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105"
                    onClick={() => {
                      const inputElement = document.querySelector('input[placeholder*="Type your message"]') as HTMLInputElement;
                      if (inputElement) {
                        inputElement.focus();
                        inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                        <Send className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">Text</h3>
                        <p className="text-sm text-gray-600">Type your message</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Start typing below</p>
                  </div>
                </div>

                {/* Start Talking Button */}
                <div className="text-center">
                  <Button
                    onClick={() => {
                      if (!isProcessing && !isRecording) {
                        // Enable continuous voice mode
                        setIsContinuousVoiceMode(true);
                        continuousVoiceModeRef.current = true;
                        setShowVoicePanel(true);
                        
                        // Enable VAD if not already enabled
                        if (!isVADEnabled) {
                          setIsVADEnabled(true);
                          localStorage.setItem('daive_vad_enabled', 'true');
                        }
                        
                        // Start first recording
                        handleVoiceButtonClick();
                        toast.success('🎤 Continuous voice mode activated!');
                      }
                    }}
                    disabled={isProcessing || isRecording}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-8 py-3 rounded-full text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRecording ? 'Recording...' : 'Start Talking'}
                  </Button>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 sm:p-4 border-t">
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <input
                    value={inputMessage}
                    onChange={(e) => {
                      setInputMessage(e.target.value);
                      // Pause audio when user starts typing
                      if (e.target.value.length > 0) {
                        pauseAudioForUserInteraction();
                        
                        // Play greeting audio on first user interaction if needed
                        if (shouldPlayGreetingOnInteraction && !greetingAudioPlayed) {
                          console.log('🎵 First user interaction detected - playing greeting audio');
                          setShouldPlayGreetingOnInteraction(false);
                          const greetingMessage = messages.find(msg => msg.role === 'assistant');
                          if (greetingMessage) {
                            playGreetingAudio(greetingMessage.content);
                          }
                        }
                      }
                    }}
                    onFocus={() => {
                      // Pause audio when user focuses on input field
                      pauseAudioForUserInteraction();
                      
                      // Play greeting audio on first user interaction if needed
                      if (shouldPlayGreetingOnInteraction && !greetingAudioPlayed) {
                        console.log('🎵 First user interaction detected (focus) - playing greeting audio');
                        setShouldPlayGreetingOnInteraction(false);
                        const greetingMessage = messages.find(msg => msg.role === 'assistant');
                        if (greetingMessage) {
                          playGreetingAudio(greetingMessage.content);
                        }
                      }
                    }}
                    placeholder={isProcessing ? "D.A.I.V.E. is processing..." : "Type your message..."}
                    disabled={isProcessing}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 ${
                      isProcessing 
                        ? 'border-blue-300 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  />
                  {isProcessing && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    </div>
                  )}
                </div>
                <div className="flex gap-1 sm:gap-2 justify-center sm:justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newValue = !autoplayEnabled;
                      setAutoplayEnabled(newValue);
                      localStorage.setItem('daive_autoplay_enabled', newValue.toString());
                    }}
                    className={autoplayEnabled ? 'bg-green-50 border-green-200' : ''}
                    disabled={isProcessing}
                    title={autoplayEnabled ? 'Disable Autoplay' : 'Enable Autoplay'}
                  >
                    {autoplayEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={toggleVAD}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      // Cycle through sensitivity levels on double-click
                      const sensitivities = [0.2, 0.5, 0.8];
                      const currentIndex = sensitivities.findIndex(s => Math.abs(s - vadSensitivity) < 0.1);
                      const nextIndex = (currentIndex + 1) % sensitivities.length;
                      const newSensitivity = sensitivities[nextIndex];
                      updateVADSensitivity(newSensitivity);
                      localStorage.setItem('daive_vad_sensitivity', newSensitivity.toString());
                      toast.info(`🎯 VAD Sensitivity: ${(newSensitivity * 100).toFixed(0)}%`);
                    }}
                    disabled={isProcessing}
                    title={isVADEnabled ? `Disable Voice Interruption Detection (Current: ${(vadSensitivity * 100).toFixed(0)}%) - Double-click to cycle sensitivity` : 'Enable Voice Interruption Detection'}
                    className={isVADEnabled ? 'bg-blue-50 border-blue-200 text-blue-600' : 'text-gray-600 border-gray-200'}
                  >
                    🎯
                  </Button>
                  {!isProductionMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={clearAudioCache}
                      disabled={isProcessing}
                      title="Clear Audio Cache"
                      className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {!isProductionMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={async () => {
                        // Clear old voice caches and force regeneration with new voice setting
                        console.log('🔄 Clearing old voice caches and forcing regeneration...');
                        
                        // Clear all greeting audio caches
                        clearAudioCache();
                        
                        // Clear last greeting text to force new generation
                        localStorage.removeItem('daive_last_greeting_text');
                        
                        // Reset greeting audio state
                        setGreetingAudioPlayed(false);
                        setIsGreetingAudioPlaying(false);
                        
                        toast.success('🗑️ Old voice caches cleared! New greeting will use current voice setting.');
                        
                        // Force regeneration of greeting audio with new voice setting
                        setTimeout(() => {
                          const currentGreeting = messages.find(msg => msg.role === 'assistant')?.content;
                          if (currentGreeting) {
                            console.log('🎵 Force regenerating greeting audio with new voice setting...');
                            playGreetingAudio(currentGreeting);
                          }
                        }, 1000);
                      }}
                      disabled={isProcessing}
                      title="Clear Old Voice Caches & Regenerate with New Voice"
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      🎤
                    </Button>
                  )}
                  {!isProductionMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={showGreetingCacheStatus}
                      disabled={isProcessing}
                      title="Show Greeting Cache Status"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Database className="h-4 w-4" />
                    </Button>
                  )}
                  {!isProductionMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={toggleVAD}
                      disabled={isProcessing}
                      title={isVADEnabled ? 'Disable Voice Interruption Detection' : 'Enable Voice Interruption Detection'}
                      className={isVADEnabled ? 'bg-green-50 border-green-200 text-green-600' : 'text-gray-600 border-gray-200'}
                    >
                      🎯
                    </Button>
                  )}
                  {!isProductionMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        // Clear all caches
                        clearAudioCache();
                        localStorage.removeItem('daive_autoplay_enabled');
                        setGreetingAudioPlayed(false);
                        setAutoplayEnabled(true);
                        console.log('🗑️ All caches cleared, refreshing page...');
                        // Force page refresh
                        window.location.reload();
                      }}
                      disabled={isProcessing}
                      title="Clear All Caches & Refresh Page"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Database className="h-4 w-4" />
                    </Button>
                  )}
                  {/* DISABLED: Follow-up related buttons
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      // Reset follow-up state to test inactivity timer again
                      // setFollowUpSent(false);
                      // followUpSentRef.current = false;
                      // resetInactivityTimer();
                      // toast.success('🔄 Follow-up state reset! Inactivity timer restarted.');
                    }}
                    disabled={isProcessing}
                    title="Reset follow-up state and restart inactivity timer"
                    className="text-orange-600 border-orange-200 hover:bg-orange-50"
                  >
                    🔄
                  </Button>
                  */}
                  {!isProductionMode && (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={showRegularActionsToggle}
                        disabled={isProcessing}
                        title="Show Regular Quick Actions"
                        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      >
                        <span className="text-xs font-bold">QA</span>
                      </Button>
                        {/* DISABLED: DaiveSteps tab button
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={showDaivestepsActionsToggle}
                        disabled={isProcessing}
                        title="Show DAIVESTEPS Journey Actions"
                        className="text-purple-600 border-purple-200 hover:bg-purple-50"
                      >
                        <span className="text-xs font-bold">DS</span>
                      </Button>
                        */}
                    </div>
                  )}
                  {/* DISABLED: Manual follow-up trigger button
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      // if (!followUpSent) {
                      //   sendContextualFollowUp();
                      //   toast.info('🎯 Manual follow-up triggered');
                      // } else {
                      //   toast.info('✅ Follow-up already sent');
                      // }
                    }}
                    disabled={isProcessing}
                    title="Manually trigger contextual follow-up message"
                    className="text-cyan-600 border-cyan-200 hover:bg-cyan-50"
                  >
                    🎯
                  </Button>
                  */}
                  {!isProductionMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleCrewAIToggle}
                      className={useCrewAI ? 'bg-green-50 border-green-200' : ''}
                      disabled={isProcessing || !crewAIEnabled || isCrewAIToggling}
                      title={crewAIEnabled ? 'Toggle Crew AI' : 'Crew AI not available'}
                    >
                      {isCrewAIToggling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Users className="h-4 w-4" />
                      )}
                      {useCrewAI && crewAIEnabled && !isCrewAIToggling && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      )}
                    </Button>
                  )}
                  {!isProductionMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newValue = !typewriterEnabled;
                        setTypewriterEnabled(newValue);
                        localStorage.setItem('daive_typewriter_enabled', newValue.toString());
                        if (newValue) {
                          toast.success('✍️ Typewriter effect enabled');
                        } else {
                          toast.info('📝 Typewriter effect disabled');
                        }
                      }}
                      className={typewriterEnabled ? 'bg-purple-50 border-purple-200' : ''}
                      disabled={isProcessing}
                      title={typewriterEnabled ? 'Disable Typewriter Effect' : 'Enable Typewriter Effect'}
                    >
                      ✍️
                    </Button>
                  )}
                  {typewriterEnabled && !isProductionMode && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newSpeed = Math.max(10, typewriterSpeed - 10);
                          setTypewriterSpeed(newSpeed);
                          localStorage.setItem('daive_typewriter_speed', newSpeed.toString());
                          toast.info(`⚡ Typewriter speed: ${newSpeed}ms`);
                        }}
                        disabled={isProcessing || typewriterSpeed <= 10}
                        className="h-6 w-6 text-xs bg-blue-50 border-blue-200 hover:bg-blue-100"
                        title="Increase typewriter speed"
                      >
                        ⚡
                      </Button>
                      <span className="text-xs text-gray-600 px-1">
                        {typewriterSpeed}ms
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const newSpeed = Math.min(100, typewriterSpeed + 10);
                          setTypewriterSpeed(newSpeed);
                          localStorage.setItem('daive_typewriter_speed', newSpeed.toString());
                          toast.info(`🐌 Typewriter speed: ${newSpeed}ms`);
                        }}
                        disabled={isProcessing || typewriterSpeed >= 100}
                        className="h-6 w-6 text-xs bg-blue-50 border-blue-200 hover:bg-blue-100"
                        title="Decrease typewriter speed"
                      >
                        🐌
                      </Button>
                    </div>
                  )}
                  
                  {/* Stop Audio Button - Show when audio is playing */}
                  {isPlaying && (
                    <Button
                      type="button"
                      onClick={stopAudio}
                      variant="outline"
                      size="icon"
                      className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white border-red-500 transition-all duration-300"
                      title="Stop Audio Playback"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    type="button"
                    onClick={() => {
                      if (isPlaying) {
                        // If audio is playing, pause it
                        pauseAudioForUserInteraction();
                      } else {
                        // If not playing, start voice recording
                        handleVoiceButtonClick();
                      }
                    }}
                    onMouseDown={handleVoiceButtonPress}
                    onMouseUp={handleVoiceButtonRelease}
                    onMouseLeave={handleVoiceButtonRelease}
                    onTouchStart={handleVoiceButtonPress}
                    onTouchEnd={handleVoiceButtonRelease}
                    disabled={isProcessing || (isRecording && !isPressingVoiceButton)}
                    variant="outline"
                    size="icon"
                    className={`relative w-10 h-10 rounded-full transition-all duration-150 ease-in-out select-none ${
                      isPlaying 
                        ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600 shadow-lg' 
                        : isRecording || isPressingVoiceButton
                          ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 shadow-xl' 
                          : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500'
                    } ${isPressingVoiceButton ? 'scale-[2] shadow-2xl' : 'scale-100'}`}
                    title={isRecording ? `Recording... ${recordingDuration}s (Release to stop)` : isPlaying ? 'Pause Audio & Voice Input' : 'Hold to record voice message (min 0.5s)'}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isRecording || isPressingVoiceButton ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                    {(isRecording || isPressingVoiceButton) && (
                      <>
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                        {recordingDuration > 0 && (
                          <div className={`absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs px-2 py-1 rounded whitespace-nowrap ${
                            recordingDuration < 0.5 
                              ? 'bg-orange-500 text-white' 
                              : 'bg-red-500 text-white'
                          }`}>
                            {recordingDuration}s
                            {recordingDuration < 0.5 && <span className="ml-1">(min 0.5s)</span>}
                          </div>
                        )}
                      </>
                    )}
                    {isPlaying && !isRecording && !isPressingVoiceButton && (
                      <>
                        {/* Pulsing ring effect when audio is playing */}
                        <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-75" />
                        <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-pulse" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isProcessing || !inputMessage.trim()}
                    className={`transition-all duration-200 ${
                      isProcessing 
                        ? 'bg-blue-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </form>
            </div>
              </TabsContent>
              
              <TabsContent value="debug" className="flex-1 flex flex-col mt-0 p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">Debug Information</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Refresh debug data
                        setDebugData({
                          timestamp: new Date().toISOString(),
                          sessionId,
                          dealerId: effectiveDealerId,
                          vehicleId,
                          messagesCount: messages.length,
                          lastMessage: messages[messages.length - 1],
                          preferences: {
                            autoplayEnabled,
                            typewriterEnabled,
                            typewriterSpeed,
                            isVoiceEnabled,
                            useCrewAI,
                            crewAIEnabled,
                            isVADEnabled,
                            vadSensitivity
                          }
                        });
                        // Also fetch conversation data
                        fetchConversationData();
                      }}
                      className="text-xs"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                  
                  {/* Journey Stages Section */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-700">Journey Stages & Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">Current Stage:</label>
                          <div className="text-xs bg-blue-50 p-2 rounded mt-1">
                            <div>Stage: {journeyStages?.currentStage || 'Not set'}</div>
                            <div>Journey Step: {journeyStages?.journeyStep || 'Not set'}</div>
                            <div>Last Updated: {journeyStages?.lastUpdated || 'Never'}</div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-600">Slot Data:</label>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-32">
                            {journeyStages?.slots ? JSON.stringify(journeyStages.slots, null, 2) : 'No slot data available'}
                          </pre>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-600">Vehicle History:</label>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-32">
                            {journeyStages?.vehicleHistory ? JSON.stringify(journeyStages.vehicleHistory, null, 2) : 'No vehicle history available'}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Intent & Response Data Section */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-700">Intent Detection & Response Data</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">Last Intent Result:</label>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-32">
                            {lastIntentResult ? JSON.stringify(lastIntentResult, null, 2) : 'No intent data available'}
                          </pre>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-600">Last Slot Data:</label>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-32">
                            {lastSlotData ? JSON.stringify(lastSlotData, null, 2) : 'No slot data available'}
                          </pre>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-600">Current Session Info:</label>
                          <div className="text-xs bg-gray-100 p-2 rounded mt-1">
                            <div>Session ID: {sessionId || 'Not set'}</div>
                            <div>Dealer ID: {effectiveDealerId || 'Not set'}</div>
                            <div className={vehicleId ? 'text-green-600 font-semibold' : 'text-gray-500'}>
                              Vehicle ID: {vehicleId || 'Not set'}
                              {vehicleId && <span className="ml-2 text-xs">(QR Scan)</span>}
                            </div>
                            {vehicleInfo && (
                              <div className="text-green-600 font-semibold mt-1">
                                Vehicle: {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
                                {vehicleInfo.price && <span className="ml-2">${vehicleInfo.price.toLocaleString()}</span>}
                              </div>
                            )}
                            <div>Messages Count: {messages.length}</div>
                            <div>Last Message: {messages[messages.length - 1]?.content?.substring(0, 50) || 'None'}...</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Preferences Section */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-700">User Preferences</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="space-y-1">
                          <div>Autoplay: {autoplayEnabled ? '✅' : '❌'}</div>
                          <div>Typewriter: {typewriterEnabled ? '✅' : '❌'}</div>
                          <div>Voice: {isVoiceEnabled ? '✅' : '❌'}</div>
                          <div>CrewAI: {useCrewAI ? '✅' : '❌'}</div>
                          <div>VAD: {isVADEnabled ? '✅' : '❌'}</div>
                        </div>
                        <div className="space-y-1">
                          <div>Typewriter Speed: {typewriterSpeed}ms</div>
                          <div>CrewAI Enabled: {crewAIEnabled ? '✅' : '❌'}</div>
                          <div>Journey Tracker: {showJourneyTracker ? '✅' : '❌'}</div>
                          <div>Production Mode: {isProductionMode ? '✅' : '❌'}</div>
                          <div>VAD Sensitivity: {(vadSensitivity * 100).toFixed(0)}%</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Voice Activity Detection Controls */}
                  {!isProductionMode && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-700">Voice Interruption Detection</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-gray-600">Enable VAD:</label>
                            <Button
                              size="sm"
                              variant={isVADEnabled ? "default" : "outline"}
                              onClick={toggleVAD}
                              className="h-6 px-2 text-xs"
                            >
                              {isVADEnabled ? 'Enabled' : 'Disabled'}
                            </Button>
                          </div>
                          
                          {isVADEnabled && (
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-gray-600">
                                Sensitivity: {(vadSensitivity * 100).toFixed(0)}%
                              </label>
                              <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.1"
                                value={vadSensitivity}
                                onChange={(e) => {
                                  const newSensitivity = parseFloat(e.target.value);
                                  updateVADSensitivity(newSensitivity);
                                  localStorage.setItem('daive_vad_sensitivity', newSensitivity.toString());
                                }}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>Low (10%)</span>
                                <span>High (100%)</span>
                              </div>
                              <div className="text-xs text-gray-600">
                                <p>• Lower values = more sensitive (interrupts on quiet sounds)</p>
                                <p>• Higher values = less sensitive (requires louder speech)</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Conversation Context Section */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-700">Conversation Context</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">Full Context:</label>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-48">
                            {conversationContext ? JSON.stringify(conversationContext, null, 2) : 'No conversation context available'}
                          </pre>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-600">Preferences:</label>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-32">
                            {journeyStages?.preferences ? JSON.stringify(journeyStages.preferences, null, 2) : 'No preferences available'}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Debug Data Section */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-700">System Debug Data</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-48">
                        {debugData ? JSON.stringify(debugData, null, 2) : 'Click Refresh to load debug data'}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Hidden audio element for playing responses */}
        <audio ref={audioRef} style={{ display: 'none' }} />
        
        {/* Image Gallery Modal */}
        {showImageGallery && currentVehicleInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Gallery Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">{currentVehicleInfo.title}</h3>
                <button
                  onClick={closeImageGallery}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              {/* Main Image */}
              <div className="relative p-4">
                <div className="relative">
                  {/* Navigation Buttons */}
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 z-10"
                  >
                    ‹
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 z-10"
                  >
                    ›
                  </button>
                  
                  {/* Current Image */}
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    {currentGalleryImages[currentImageIndex] && (
                      <img
                        src={currentGalleryImages[currentImageIndex]}
                        alt={`${currentVehicleInfo.title} - Image ${currentImageIndex + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                </div>
                
                {/* Image Counter */}
                <div className="text-center mt-2 text-sm text-gray-600">
                  {currentImageIndex + 1} of {currentGalleryImages.length}
                </div>
              </div>
              
              {/* Thumbnail Navigation */}
              {currentGalleryImages.length > 1 && (
                <div className="p-4 border-t bg-gray-50">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {currentGalleryImages.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => goToImage(index)}
                        className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 ${
                          index === currentImageIndex ? 'border-blue-500' : 'border-gray-300'
                        }`}
                      >
                        <img
                          src={image}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Auth Modal for QR Code Access */}
      {(() => {
        // Check if user has proper authentication tokens
        const authToken = localStorage.getItem('auth_token');
        const customerToken = localStorage.getItem('customerToken');
        const hasProperAuth = authToken || customerToken;
        
        console.log('🔍 Modal Render Check:', {
          hasValidSession,
          isCustomerAuthenticated,
          showQuickAuth,
          hasProperAuth,
          shouldRender: !hasProperAuth
        });
        return !hasProperAuth;
      })() && (
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

      {/* Voice Analysis Animation - Show when recording (ONLY if NOT in continuous voice mode) */}
      {isRecording && !isContinuousVoiceMode && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-purple-500/95 to-blue-500/95 flex flex-col items-center justify-center backdrop-blur-sm">
          <button 
            onClick={() => {
              stopRecording();
            }}
            className="absolute top-4 left-4 text-white hover:bg-white/10 rounded-full p-2 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          
          <h3 className="text-white text-xl font-semibold mb-2">Voice Analysis</h3>
          <p className="text-white/80 text-sm mb-8">Listening...</p>
          
          {/* Animated Orb */}
          <div className="relative w-64 h-64 mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 opacity-50 animate-pulse"></div>
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 opacity-60" style={{animation: 'spin 3s linear infinite'}}></div>
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-blue-300 to-purple-500 opacity-70" style={{animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'}}></div>
            <div className="absolute inset-12 rounded-full bg-gradient-to-br from-white to-purple-200 opacity-90 flex items-center justify-center">
              <Mic className="h-16 w-16 text-purple-600" />
            </div>
          </div>
          
          <div className="text-center px-8 max-w-md">
            <p className="text-white text-base mb-2">
              {recordingDuration > 0 ? `Recording: ${recordingDuration}s` : 'Starting...'}
            </p>
            {recordingDuration < 0.5 && recordingDuration > 0 && (
              <p className="text-white/70 text-sm">
                Minimum 0.5 seconds required
              </p>
            )}
          </div>
          
          <div className="flex gap-4 mt-8">
            <Button 
              variant="outline" 
              className="rounded-full bg-white/20 text-white border-white/30 hover:bg-white/30 px-6"
              onClick={() => stopRecording()}
            >
              <Square className="h-5 w-5 mr-2" />
              Stop Recording
            </Button>
          </div>
        </div>
      )}

      {/* Voice Panel - Continuous Mode */}
      <VoicePanel />

      {/* ✅ CarFax Modal */}
      <CarfaxModal />
    </div>
  );
};

export default AIBotPage; 
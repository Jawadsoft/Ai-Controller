/**
 * AIBotPage - Main AI Bot Interface
 * 
 * DEVELOPMENT FEATURE: Journey Tracker Display
 * - Shows 16-step client journey progress during conversations
 * - Can be easily hidden when going live by setting localStorage 'daive_show_journey_tracker' to 'false'
 * - Or by clicking the "Hide Tracker" button in the header
 * - The journey tracker helps developers monitoccr conversation flow and step progression
 */
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Slider } from '../components/ui/slider';
import { ScrollArea } from '../components/ui/scroll-area';
import { Mic, MicOff, Loader2, Send, Volume2, VolumeX, Play, Square, Users, Database, Trash2, Eye, EyeOff, Settings, BarChart3, Check, Calendar, FileText, ExternalLink, AlertTriangle, CheckCircle, X, Images, Sparkles, ChevronLeft, MoreVertical, Plus, Car, Languages, Repeat, Ban, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { buildApiUrl, buildAssetUrl, buildBackendAssetUrl } from '../lib/config';
import JourneyTrackerDisplay from '../components/JourneyTrackerDisplay';
import { useCustomer, useQRCodeAccess } from '../contexts/CustomerContext';
import QuickAuthModal from '../components/customer/QuickAuthModal';
import testDriveIconUrl from '../assets/icons/test-drive.svg?url';
import carfaxIconUrl from '../assets/icons/carfax.svg?url';

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

/** Stable row id for compare / side panel (no backend dependency). */
function getVehicleStableId(v: any): string {
  if (v?.id != null && String(v.id).trim() !== '') return String(v.id);
  const sn = v?.stockNumber ?? v?.stock_number;
  if (sn != null && String(sn).trim() !== '') return `sn-${String(sn).trim()}`;
  return `legacy-${String(v?.year ?? '')}-${String(v?.make ?? '')}-${String(v?.model ?? '')}-${String(v?.price ?? '')}`;
}

function parseVehiclePriceValue(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw).replace(/[^0-9.]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
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
  const navigate = useNavigate();
  
  // Get vehicle data from navigation state or props
  const vehicleId = location.state?.vehicleId || propVehicleId;
  const dealerId = location.state?.dealerId || propDealerId;
  const vehicleInfo = location.state?.vehicleInfo || propVehicleInfo;
  // Salesperson QR context — set when customer arrives via /salesperson/qr/:hash
  const assignedStaffId = location.state?.assignedStaffId || localStorage.getItem('assigned_staff_id') || null;
  const staffQrHash = location.state?.staffQrHash || localStorage.getItem('assigned_staff_qr_hash') || null;
  
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

  /** Client-only panel: filters for "Ask with these filters" (same chat API). */
  const [inventoryBudgetMax, setInventoryBudgetMax] = useState(50000);
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState('');
  const [inventoryConditionFilter, setInventoryConditionFilter] = useState<'new' | 'used' | ''>('');
  const [inventoryFeatureFilters, setInventoryFeatureFilters] = useState<string[]>([]);

  // Groups mirror the backend FEATURE_CATEGORIES so OR/AND logic is consistent.
  // Selecting a pill deselects any other active pill in the same group (single-select per group).
  const FEATURE_GROUPS: Record<string, string[]> = {
    fuel_type:  ['hybrid', 'electric', 'fuel-efficient'],
    drivetrain: ['awd'],
    tech:       ['apple carplay', 'navigation', 'bluetooth'],
    safety:     ['backup camera', 'blind spot'],
    comfort:    ['sunroof', 'leather seats', 'heated seats'],
    seating:    ['7-seater'],
  };
  const getFeatureGroup = (f: string) =>
    Object.keys(FEATURE_GROUPS).find(g => FEATURE_GROUPS[g].includes(f.toLowerCase())) ?? null;

  const toggleFeatureFilter = (f: string) => {
    const val = f.toLowerCase();
    setInventoryFeatureFilters(prev => {
      if (prev.includes(val)) {
        // Clicking an already-active pill deselects it
        return prev.filter(x => x !== val);
      }
      const group = getFeatureGroup(val);
      // Remove any sibling from the same group before adding the new selection
      const withoutSiblings = group
        ? prev.filter(x => !FEATURE_GROUPS[group].includes(x))
        : prev;
      return [...withoutSiblings, val];
    });
  };
  
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
    // Keep header in sync with the customer's active selection
    setActiveSelectedVehicle({
      year: selectedVehicle.year,
      make: selectedVehicle.make,
      model: selectedVehicle.model,
      price: selectedVehicle.price,
      trim: selectedVehicle.trim
    });
    
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
          conversationContext: conversationContext,
          assignedStaffId,
          staffQrHash,
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
        
        if (data.data?.context) {
          setConversationContext(data.data.context);
        }
        
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
    setActiveSelectedVehicle({
      year: selectedVehicle.year,
      make: selectedVehicle.make,
      model: selectedVehicle.model,
      price: selectedVehicle.price,
      trim: selectedVehicle.trim
    });
    
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
      // Prefer vehicleInfo already passed via navigation state to avoid an extra API call
      let vehicleDetails: any = vehicleInfo || null;
      if (vehicleDetails) {
        console.log('✅ Using vehicleInfo from navigation state — skipping vehicle API fetch');
        setQrVehicleDetails(vehicleDetails);
      } else if (vehicleIdentifier) {
        try {
          // Determine endpoint: UUID → by id, 16-char hex → QR hash, else → by-stock
          const isVehicleId = vehicleIdentifier.includes('-') && vehicleIdentifier.length === 36;
          const isQRHash = /^[0-9a-f]{16}$/i.test(vehicleIdentifier);

          console.log('🔍 Vehicle Identifier Analysis:', {
            vehicleIdentifier,
            length: vehicleIdentifier.length,
            isVehicleId,
            isQRHash,
          });

          let vehicleResponse;
          if (isVehicleId) {
            console.log('🔍 Using vehicleId endpoint');
            vehicleResponse = await fetch(buildApiUrl(`vehicles/public/${vehicleIdentifier}?dealerId=${data.id}`));
          } else if (isQRHash) {
            console.log('🔍 Using QR hash endpoint');
            vehicleResponse = await fetch(buildApiUrl(`vehicles/public/qr/${vehicleIdentifier}`));
          } else {
            console.log('🔍 Using by-stock endpoint');
            vehicleResponse = await fetch(buildApiUrl(`vehicles/public/by-stock/${vehicleIdentifier}?dealerId=${data.id}`));
          }

          if (vehicleResponse && vehicleResponse.ok) {
            const vehicleData = await vehicleResponse.json();
            console.log('🔍 Raw API Response:', vehicleData);
            vehicleDetails = vehicleData.data || vehicleData;
            console.log('✅ Vehicle details processed:', vehicleDetails);

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
  
  const [activeTab] = useState<'chat'>('chat');
  const [lastIntentResult, setLastIntentResult] = useState<any>(null);
  const [lastSlotData, setLastSlotData] = useState<any>(null);
  const [conversationContext, setConversationContext] = useState<any>(null);
  const [journeyStages, setJourneyStages] = useState<any>(null);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false);
  // Tracks the vehicle the customer actively selected so we can show it in the header
  const [activeSelectedVehicle, setActiveSelectedVehicle] = useState<{year?: any; make?: string; model?: string; price?: any; trim?: string} | null>(null);

  // ── Conversation Resumption (Option C) ──────────────────────────────────────
  // Holds data fetched from DB for a prior session while we wait for user's choice
  const [resumePromptData, setResumePromptData] = useState<{
    sessionId: string;
    updatedAt: string; // ISO string
    messageCount: number;
    lastMessage: string;
    context: any;
    messages: any[];
  } | null>(null);
  /** localStorage key scoped to dealer so different dealers don't share sessions */
  const getSessionStorageKey = (dId?: string) => `daive_session_${dId ?? 'default'}`;

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
    if (!newValue) {
      toast.success('Development mode enabled - dev controls shown');
    }
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

  // Web Speech API refs
  const speechRecognitionRef = useRef<any>(null); // SpeechRecognition type
  /** Standalone Web Speech test (no MediaRecorder) — separate from main `startRecording` flow */
  const webSpeechTestRef = useRef<any>(null);
  const [isWebSpeechTestActive, setIsWebSpeechTestActive] = useState(false);
  const [isWebSpeechFeatureEnabled, setIsWebSpeechFeatureEnabled] = useState(() => {
    try {
      return localStorage.getItem('daive_webspeech_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [isWebSpeechAutoListenEnabled, setIsWebSpeechAutoListenEnabled] = useState(() => {
    try {
      return localStorage.getItem('daive_webspeech_autolisten') === 'true';
    } catch {
      return false;
    }
  });
  const webSpeechLastEndAtRef = useRef<number>(0);
  const webSpeechLastErrorRef = useRef<string | null>(null);
  const webSpeechLastAutoStartAtRef = useRef<number>(0);
  const webSpeechPausedForPlaybackRef = useRef<boolean>(false);
  /** Set to true when the user explicitly taps the mic/pause button — prevents auto-restart. */
  const webSpeechUserPausedRef = useRef<boolean>(false);
  /** Counts consecutive no-speech results so we can apply exponential back-off. */
  const webSpeechNoSpeechCountRef = useRef<number>(0);
  const lastUserGestureAtRef = useRef<number>(0);
  const isSpeakingRef = useRef(false); // Track if AI is speaking
  const speechDetectedInSessionRef = useRef(false); // Track if speech was detected in current session
  const lastRestartTimeRef = useRef<number>(0); // Track last restart time to prevent loops
  const restartCooldownRef = useRef(2000); // 2 second cooldown between restarts
  const speechWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Continuous voice mode state
  const [isContinuousVoiceMode, setIsContinuousVoiceMode] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const continuousVoiceModeRef = useRef(false);

  // Auto-stop recording on silence detection
  const recordingSilenceDetectionRef = useRef<number | null>(null);
  const recordingAnalyserRef = useRef<AnalyserNode | null>(null);
  const recordingSilenceCounterRef = useRef(0);
  const recordingSilenceThresholdRef = useRef(180); // frames of silence (~3 seconds at 60fps)
  const recordingVolumeThresholdRef = useRef(0.08); // Threshold to detect actual silence vs ambient noise
  const hasSpeechDetectedRef = useRef(false); // Track if actual speech has been detected
  const recordingStartTimeRef = useRef<number | null>(null); // Track when recording started
  const lastSpeechTimeRef = useRef<number | null>(null); // Track when user last spoke
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout for 3-second silence
  const maxRecordingDurationRef = useRef(30000); // Maximum recording duration in ms (30 seconds) - safety fallback

  // Performance timing tracking
  const [performanceTimings, setPerformanceTimings] = useState<{
    recordingStart?: number;
    recordingEnd?: number;
    recordingDuration?: number;
    transcriptionStart?: number;
    transcriptionEnd?: number;
    transcriptionDuration?: number;
    backendStart?: number;
    backendEnd?: number;
    backendDuration?: number;
    ttsStart?: number;
    ttsEnd?: number;
    ttsDuration?: number;
    totalDuration?: number;
  }>({});
  const timingsRef = useRef<typeof performanceTimings>({});

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

  // Cleanup recording duration timer on unmount
  useEffect(() => {
    return () => {
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
    
    if (!isProductionMode) {
      toast.info(`Greeting cache: ${greetingKeys.length} files, check console for details`);
    }
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
  const chatInputRef = useRef<HTMLInputElement>(null);

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
    if (!isProductionMode) toast.info('Quick actions are now available again');
  };

  // Function to toggle to daivesteps actions
  const showDaivestepsActionsToggle = () => {
    setShowDaivestepsActions(true);
    setShowQuickActions(false);
    if (!isProductionMode) toast.info('DAIVESTEPS journey actions are now available');
  };

  // Function to toggle to regular actions
  const showRegularActionsToggle = () => {
    setShowQuickActions(true);
    setShowDaivestepsActions(false);
    if (!isProductionMode) toast.info('Regular quick actions are now available');
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
        if (!isProductionMode) toast.success('Cache cleared and refreshed!');
      }
    } catch (error) {
      if (!silent) {
        console.error('Error clearing cache:', error);
        toast.error('Failed to clear cache');
      }
    }
  };

  // ── Restore a saved session into all frontend state ────────────────────────
  const applyRestoredSession = (data: { sessionId: string; messages: any[]; context: any }) => {
    setSessionId(data.sessionId);

    // Restore chat messages
    if (data.messages?.length > 0) {
      setMessages(
        data.messages.map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content || '',
          timestamp: m.timestamp || new Date().toISOString(),
        }))
      );
    }

    // Restore Daivesteps context so the AI picks up from the right stage
    if (data.context) {
      const ctx = data.context;
      setConversationContext({
        Daivesteps: ctx.Daivesteps || {},
        Currentstep: ctx.Currentstep || 'Inquiry',
        stepCompleted: ctx.step_completion || {},
        session_id: data.sessionId,
        // Spread other known fields
        ...(ctx.customer_profile && { customerProfile: ctx.customer_profile }),
        ...(ctx.budget_info && { budget_info: ctx.budget_info }),
        ...(ctx.vehicle_preferences && { vehicle_preferences: ctx.vehicle_preferences }),
        ...(ctx.finance_info && { finance_info: ctx.finance_info }),
      });

      // Restore selected vehicle in header if present
      const selVehicle = ctx.selected_vehicles?.[0];
      if (selVehicle) {
        setActiveSelectedVehicle({
          year: selVehicle.year,
          make: selVehicle.make,
          model: selVehicle.model,
          price: selVehicle.price,
          trim: selVehicle.trim,
        });
      }
    }

    setResumePromptData(null);
  };

  // ── Try to find and offer a previous session on mount ───────────────────────
  const tryResumeConversation = async (dId: string) => {
    const key = getSessionStorageKey(dId);
    const storedSessionId = localStorage.getItem(key);
    if (!storedSessionId) return false; // nothing to resume

    try {
      const res = await fetch(buildApiUrl(`daive/conversation/${storedSessionId}/resume`));
      if (!res.ok) {
        // Session no longer exists — clean up stale key
        localStorage.removeItem(key);
        return false;
      }

      const data = await res.json();
      if (!data.success || !data.messages?.length) {
        localStorage.removeItem(key);
        return false;
      }

      const updatedAt = data.conversation?.updated_at;

      const lastUserMsg = [...data.messages].reverse().find((m: any) => m.role === 'user');
      const preview = lastUserMsg?.content
        ? lastUserMsg.content.substring(0, 80) + (lastUserMsg.content.length > 80 ? '…' : '')
        : 'Previous conversation';

      // Always prompt the user — let them decide to continue or start fresh
      setResumePromptData({
        sessionId: storedSessionId,
        updatedAt: updatedAt ?? '',
        messageCount: data.messages.length,
        lastMessage: preview,
        context: data.context,
        messages: data.messages,
      });
      return true; // hold off on sending greeting until user decides
    } catch (err) {
      console.warn('Could not check previous conversation:', err);
      return false;
    }
  };

  // Start a completely fresh conversation – resets session, messages, vehicle context
  const handleStartNewConversation = async () => {
    setShowNewChatConfirm(false);
    setResumePromptData(null);
    // Remove persisted session so next load starts fresh
    if (effectiveDealerId) localStorage.removeItem(getSessionStorageKey(effectiveDealerId));
    try {
      // Try to clear backend cache silently
      const authToken = localStorage.getItem('auth_token');
      if (authToken && sessionId) {
        await fetch(buildApiUrl('daive/clear-cache'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
        }).catch(() => {});
      }
    } catch (_) {}

    // Generate a fresh session
    setSessionId(`daive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    // Reset all conversation state
    setMessages([]);
    setConversationContext(null);
    setJourneyStages(null);
    setCurrentVehicleDetails([]);
    setShowVehicleCards(false);
    setSelectedVehicles([]);
    setActiveSelectedVehicle(null);
    setCurrentVehiclePage(0);
    setVehicleOverviewText('');
    setTestDriveExplanationText('');
    setGreetingAudioPlayed(false);
    setIsGreetingAudioPlaying(false);

    setTimeout(() => {
      if (hash) {
        // QR mode: re-fire the vehicle-aware greeting by re-running the same hash logic.
        const hashParts = hash.split(':');
        const extractedDealerId = hashParts.length >= 2 ? hashParts[0] : null;
        const rawVehiclePart = hashParts.length >= 2 ? hashParts.slice(1).join(':') : null;
        const isValidVehicleId = rawVehiclePart && rawVehiclePart !== 'vehicle'
          && (rawVehiclePart.includes('-') || /^[A-Z0-9]+$/i.test(rawVehiclePart));
        const vehicleIdentifier = isValidVehicleId ? rawVehiclePart : searchParams.get('stk') || undefined;
        fetchDealerFromHash(extractedDealerId || hash, vehicleIdentifier);
      } else {
        sendInitialGreeting();
      }
    }, 100);

    toast.success('New conversation started');
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
    
    if (!isProductionMode) toast.info('Dealer context logged to console');
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
      
      // Extract a clean vehicle identifier from the hash parts (e.g. "dealerId:vehicleUUID" or "dealerId:STOCK123").
      // The literal placeholder "vehicle" (inserted by VehicleDetail when hash is empty) is ignored.
      const _rawVehiclePart = hashParts.length >= 2 ? hashParts.slice(1).join(':') : null;
      const _isValidVehicleId = _rawVehiclePart && _rawVehiclePart !== 'vehicle'
        && (_rawVehiclePart.includes('-') || /^[A-Z0-9]+$/i.test(_rawVehiclePart));
      const _vehicleIdentifierForGreeting = _isValidVehicleId ? _rawVehiclePart : (vehicleIdentifier || undefined);

      if (extractedDealerId) {
        // FIX: Use fetchDealerFromHash (vehicle-aware) instead of fetchDealerById + sendInitialGreeting,
        // so the vehicle-specific QR greeting fires correctly when a vehicle identifier is present.
        console.log('🔍 Using extracted dealer ID with vehicle-aware greeting:', extractedDealerId, 'vehicle:', _vehicleIdentifierForGreeting);
        fetchDealerFromHash(extractedDealerId, _vehicleIdentifierForGreeting).then(async (dealerData) => {
          if (dealerData) {
            // FIX: In QR mode, always show the QR greeting first — a previous session should NOT
            // suppress the vehicle welcome message. Resume prompt is shown alongside, not instead.
            const newSessionId = `aibot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            setSessionId(newSessionId);
            localStorage.setItem(getSessionStorageKey(dealerData.id), newSessionId);
            // tryResumeConversation sets resumePromptData (shown as a UI prompt) without
            // clearing the QR greeting that fetchDealerFromHash already added above.
            await tryResumeConversation(dealerData.id);
            setTimeout(() => { resetInactivityTimer(); }, 1000);
          }
        });
      } else {
        // Fallback to original hash-based fetching
        console.log('🔍 Using original hash-based fetching');
        fetchDealerFromHash(actualHash, _vehicleIdentifierForGreeting).then(async (dealerData) => {
          if (dealerData) {
            const newSessionId = `aibot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            setSessionId(newSessionId);
            localStorage.setItem(getSessionStorageKey(dealerData.id), newSessionId);
            // fetchDealerFromHash already set the greeting — resume prompt shows alongside it.
            await tryResumeConversation(dealerData.id);
            setTimeout(() => { resetInactivityTimer(); }, 1000);
          }
        });
      }
    } 
    // Priority 2: If we have dealerId (from props/navigation state) but no hash, use it directly
    else if (dealerId) {
      setEffectiveDealerId(dealerId);
      console.log('✅ Using dealerId from props/navigation:', dealerId);

      tryResumeConversation(dealerId).then(resumed => {
        if (!resumed) {
          const newSessionId = `aibot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          setSessionId(newSessionId);
          localStorage.setItem(getSessionStorageKey(dealerId), newSessionId);
          sendInitialGreeting();
        }
      });

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
        if (!isProductionMode) toast.info('⏭️ Typewriter effect skipped');
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

  // Keep focus on the chat input whenever the bot becomes idle (not processing)
  useEffect(() => {
    if (!isProcessing) {
      // Small delay so any click/tap that triggered the state change has fully settled
      const t = setTimeout(() => chatInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isProcessing]);

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
    
    // Get dynamic dealership name from dealer profile
    const dealershipName = dealerInfo?.business_name || dealerInfo?.name || 'our dealership';
    
    // Use dynamic dealership name in fallback greeting
    let personalizedGreeting = greeting || `WELCOME to **${dealershipName}**! How can I help you today? I'm here to help you find the **perfect vehicle**. What type of car are you looking for today? 🚗`;
    
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

      // Greeting must always use the Mark voice, regardless of dealer/customer voice settings.
      voiceSetting = 'mark';
      console.log('🎵 Forcing greeting voice to:', voiceSetting);
      
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
      
      // Mobile/Safari compatibility: don't assume webm support.
      const preferredMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/mpeg',
        'audio/ogg;codecs=opus',
      ];
      const supportedMimeType = preferredMimeTypes.find((t) => {
        try {
          return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t);
        } catch {
          return false;
        }
      });

      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Ensure we're working with a fresh array
          if (!audioChunksRef.current) {
            audioChunksRef.current = [];
          }
          
          // Only add chunks if we're actually recording
          // Check recorder state - only add if actively recording
          if (recorder.state === 'recording') {
            audioChunksRef.current.push(event.data);
            console.log(`📦 Audio chunk received: ${event.data.size} bytes`);
            console.log(`📊 Total chunks: ${audioChunksRef.current.length}`);
          } else {
            console.log('⚠️ Ignoring chunk - recorder not in recording state:', recorder.state);
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
          const mimeType = recorder.mimeType || supportedMimeType || 'application/octet-stream';
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          setAudioBlob(blob);
          console.log(`✅ Audio blob created: ${(blob.size / 1024).toFixed(2)} KB`);
          console.log(`🎵 Processing with ${audioChunksRef.current.length} chunks`);
          
          // Process the audio (will auto-continue conversation after backend response)
          handleVoiceSubmission(blob);
          
          // Clear chunks after processing to prevent re-use
          audioChunksRef.current = [];
          setAudioChunks([]);
        } else {
          console.log('❌ No audio chunks received');
          
          // Only restart if speech was detected (edge case where chunks weren't captured)
          // AND enough time has passed since last restart (cooldown)
          const timeSinceLastRestart = Date.now() - lastRestartTimeRef.current;
          
          if (speechDetectedInSessionRef.current && timeSinceLastRestart > restartCooldownRef.current) {
            console.log('🔄 Speech was detected but no chunks - restarting after cooldown...');
            lastRestartTimeRef.current = Date.now();
            
            setTimeout(() => {
              if (!isPlaying && !isSpeakingRef.current && !isRecording && !isProcessing) {
                startRecording();
              } else {
                console.log('⚠️ Skipping restart - still active');
              }
            }, 1000);
          } else {
            console.log('🔇 No speech detected or cooldown active - not restarting to prevent loop');
            // Don't restart - prevents infinite loop when no speech is detected
          }
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
      // Stop SpeechRecognition
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
      if (webSpeechTestRef.current) {
        try {
          webSpeechTestRef.current.stop();
        } catch (e) {
          // Ignore
        }
        webSpeechTestRef.current = null;
      }
      
      // Stop MediaRecorder
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

  const clearSpeechWatchdog = () => {
    if (speechWatchdogRef.current) {
      clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = null;
    }
  };

  const armSpeechWatchdog = () => {
    clearSpeechWatchdog();
    speechWatchdogRef.current = setTimeout(() => {
      console.warn('⚠️ Speech watchdog fired – recognition appears stuck, force-resetting');
      try { speechRecognitionRef.current?.abort(); } catch (_) {}
      speechRecognitionRef.current = null;
      setIsRecording(false);
      setIsPressingVoiceButton(false);
      recordingInProgressRef.current = false;
      speechDetectedInSessionRef.current = false;
      try {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      } catch (_) {}
      toast.warning('Microphone reset – tap the mic button to try again.');
    }, 9000);
  };

  const startRecording = () => {
    // Stop standalone Web Speech test if active (avoid two listeners at once)
    if (webSpeechTestRef.current) {
      try {
        webSpeechTestRef.current.stop();
      } catch {
        // ignore
      }
      webSpeechTestRef.current = null;
      setIsWebSpeechTestActive(false);
    }

    // Prevent starting if AI is speaking or processing
    if (isPlaying || isSpeakingRef.current || isProcessing) {
      console.log('⚠️ Cannot start recording - AI is speaking or processing:', {
        isPlaying,
        isSpeaking: isSpeakingRef.current,
        isProcessing
      });
      return;
    }
    
    // Cooldown check to prevent rapid restarts
    const timeSinceLastRestart = Date.now() - lastRestartTimeRef.current;
    if (timeSinceLastRestart < restartCooldownRef.current) {
      console.log('⚠️ Cooldown active - waiting before restart:', {
        timeSinceLastRestart,
        cooldown: restartCooldownRef.current
      });
      return;
    }
    
    // Reset speech detection flag
    speechDetectedInSessionRef.current = false;

    // Pause any running audio when starting voice recording
    pauseAllAudio();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      // Mobile Safari doesn't support SpeechRecognition. Fall back to MediaRecorder-only capture.
      console.warn('⚠️ Speech Recognition not supported - using MediaRecorder-only recording');
      startRecordingInternal();
      return;
    }

    // Stop any existing recognition
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false; // Auto-stop when user finishes speaking
    recognition.interimResults = false; // Only final results
    recognition.maxAlternatives = 1;

    recognition.onstart = async () => {
      console.log('🎤 Speech Recognition started');
      setIsRecording(true);
      speechDetectedInSessionRef.current = false; // Reset speech detection flag
      
      // Also start MediaRecorder in parallel to capture audio for backend
      if (!mediaRecorderRef.current) {
        await initializeMediaRecorder();
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
        try {
          // Reset audio chunks
          setAudioChunks([]);
          audioChunksRef.current = [];
          
          // Start MediaRecorder to capture audio
          mediaRecorderRef.current.start(100);
          console.log('🎤 MediaRecorder started in parallel');
        } catch (error) {
          console.error('Error starting MediaRecorder:', error);
        }
      }
    };

    recognition.onresult = async (event) => {
      clearSpeechWatchdog();
      const transcript = event.results[0][0].transcript;
      console.log('📝 Speech recognized:', transcript);
      speechDetectedInSessionRef.current = true; // Mark that speech was detected
      
      // Stop MediaRecorder to get the audio blob
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
          console.log('🛑 MediaRecorder stopped after speech recognition');
        } catch (error) {
          console.error('Error stopping MediaRecorder:', error);
        }
      }
      
      // The onstop event will handle sending to backend
    };

    recognition.onerror = (event: any) => {
      clearSpeechWatchdog();
      console.error('❌ Speech Recognition error:', event.error);
      speechDetectedInSessionRef.current = false;
      setIsRecording(false);
      setIsPressingVoiceButton(false);
      recordingInProgressRef.current = false;

      if (event.error === 'no-speech') {
        console.log('🔇 No speech detected - not restarting to prevent loop');
        // Don't auto-restart on no-speech to prevent infinite loops
      } else if (event.error === 'aborted') {
        console.log('⏸️ Speech Recognition aborted');
      } else {
        toast.error(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      clearSpeechWatchdog();
      console.log('🔚 Speech Recognition ended');
      setIsRecording(false);
      setIsPressingVoiceButton(false);
      recordingInProgressRef.current = false;

      // Only restart if speech was actually detected but no chunks received (edge case)
      // Otherwise, don't restart to prevent infinite loops
      if (!speechDetectedInSessionRef.current) {
        console.log('🔇 No speech detected in session - not auto-restarting');
      }
      // If speech was detected, MediaRecorder's onstop will handle it
    };

    try {
      recognition.start();
      speechRecognitionRef.current = recognition;
      armSpeechWatchdog();
    } catch (error) {
      console.error('Error starting Speech Recognition:', error);
      toast.error('Failed to start voice recognition. Please try again.');
      setIsRecording(false);
      recordingInProgressRef.current = false;
      setIsPressingVoiceButton(false);
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
      
      // ⏱️ START TIMING: Recording
      const recordingStart = Date.now();
      timingsRef.current = {
        recordingStart,
        recordingEnd: undefined,
        recordingDuration: undefined,
      };
      setPerformanceTimings({ recordingStart });
      console.log('⏱️ TIMING: Recording started at', new Date(recordingStart).toISOString());
      
      // Reset all counters and timers
      recordingSilenceCounterRef.current = 0;
      hasSpeechDetectedRef.current = false;
      recordingStartTimeRef.current = Date.now();
      lastSpeechTimeRef.current = null;
      
      // Clear any existing silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      console.log('🎤 Recording started successfully with 100ms timeslice');
      console.log('🔍 MediaRecorder state:', mediaRecorderRef.current.state);
      console.log('🔍 Audio chunks ref length:', audioChunksRef.current.length);
      
      // Start simple silence detection for auto-stop
      setTimeout(() => {
        console.log('🔍 Starting simple silence detection (3 seconds)...');
        startRecordingSilenceDetection();
      }, 500); // 500ms delay to let recording stabilize
      
      // Safety fallback: Maximum recording duration (30 seconds)
      setTimeout(() => {
        if (isRecording && mediaRecorderRef.current?.state === 'recording') {
          console.log('⏱️ Maximum recording duration reached - auto-stopping');
          stopRecording();
        }
      }, maxRecordingDurationRef.current);
      
      toast.success('🎤 Recording started. Auto-stop enabled.');
    } catch (error) {
      console.error('Error in startRecordingInternal:', error);
      toast.error('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    clearSpeechWatchdog();
    // Stop SpeechRecognition
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current = null;
        console.log('🛑 Speech Recognition stopped');
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
        console.log('🛑 MediaRecorder stopped');
      } catch (error) {
        console.error('Error stopping MediaRecorder:', error);
      }
    }
    
    setIsRecording(false);
    
    // ⏱️ END TIMING: Recording
    if (timingsRef.current.recordingStart) {
      const recordingEnd = Date.now();
      const recordingDuration = recordingEnd - timingsRef.current.recordingStart;
      timingsRef.current = {
        ...timingsRef.current,
        recordingEnd,
        recordingDuration,
      };
      setPerformanceTimings(prev => ({
        ...prev,
        recordingEnd,
        recordingDuration,
      }));
      console.log(`⏱️ TIMING: Recording stopped - Duration: ${recordingDuration}ms (${(recordingDuration / 1000).toFixed(2)}s)`);
    }
    
    // Stop silence detection if running
    stopRecordingSilenceDetection();
    
    // Reset recording duration
    setRecordingDuration(0);
    setRecordingStartTime(null);
    if (recordingStartTimeRef.current) {
      recordingStartTimeRef.current = null;
    }
  };

  // Simple silence detection: After user finishes speaking, wait 3 seconds then stop
  const startRecordingSilenceDetection = async () => {
    try {
      console.log('🔍 Starting simple silence detection (3 seconds after speech ends)...');
      
      if (!streamRef.current) {
        console.log('⚠️ No audio stream available for silence detection');
        return;
      }

      // Create audio context and analyser for recording
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(streamRef.current);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      recordingAnalyserRef.current = analyser;
      hasSpeechDetectedRef.current = false;

      console.log('✅ Simple silence detection started - will stop after 3 seconds of silence');

      const detectSilence = () => {
        if (!recordingAnalyserRef.current || !isRecording) {
          console.log('⚠️ Stopping detection - analyser lost or recording stopped');
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

        // Detect if user is speaking (volume above threshold)
        const isSpeaking = normalizedVolume > recordingVolumeThresholdRef.current * 1.5;

        if (isSpeaking) {
          // User is speaking - mark speech detected and reset timeout
          if (!hasSpeechDetectedRef.current) {
            hasSpeechDetectedRef.current = true;
            console.log('🗣️ Speech detected!');
          }
          
          // Clear any existing silence timeout
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
            console.log('🗣️ Speech detected - resetting 3-second silence timer');
          }
          
          lastSpeechTimeRef.current = Date.now();
        } else {
          // Silence detected
          // Only start timeout if speech was detected first
          if (hasSpeechDetectedRef.current && !silenceTimeoutRef.current) {
            console.log('🔇 Silence detected after speech - starting 3-second timer...');
            silenceTimeoutRef.current = setTimeout(() => {
              // Check if still recording and still silent
              if (isRecording && mediaRecorderRef.current?.state === 'recording') {
                const timeSinceLastSpeech = lastSpeechTimeRef.current 
                  ? Date.now() - lastSpeechTimeRef.current 
                  : 0;
                
                if (timeSinceLastSpeech >= 3000) {
                  console.log('🔇 3 seconds of silence - auto-stopping recording');
                  stopRecordingSilenceDetection();
                  stopRecording();
                } else {
                  // Speech detected during timeout, reset
                  silenceTimeoutRef.current = null;
                }
              }
            }, 3000); // 3 seconds
          }
        }

        // Continue monitoring
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
    
    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    recordingAnalyserRef.current = null;
    recordingSilenceCounterRef.current = 0;
    hasSpeechDetectedRef.current = false;
    lastSpeechTimeRef.current = null;
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
        
        // Restart listening after validation failure
        setTimeout(() => {
          if (!isPlaying && !isSpeakingRef.current && !isRecording && !isProcessing) {
            console.log('🔄 Restarting listening after validation failure...');
            startRecording();
          } else {
            console.log('⚠️ Skipping restart after validation failure - still active');
          }
        }, 1000);
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
      
      // Restart listening after error
      setTimeout(() => {
        if (!isPlaying && !isSpeakingRef.current && !isRecording && !isProcessing) {
          console.log('🔄 Restarting listening after error...');
          startRecording();
        } else {
          console.log('⚠️ Skipping restart after error - still active');
        }
      }, 1000);
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

      // ⏱️ START TIMING: Transcription + Backend Processing
      const backendStart = Date.now();
      timingsRef.current = {
        ...timingsRef.current,
        transcriptionStart: backendStart,
        backendStart,
      };
      setPerformanceTimings(prev => ({
        ...prev,
        transcriptionStart: backendStart,
        backendStart,
      }));
      console.log('⏱️ TIMING: Backend request started (Transcription + AI Processing)');

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
      
      // ⏱️ END TIMING: Transcription + Backend Processing
      if (timingsRef.current.backendStart) {
        const backendEnd = Date.now();
        const transcriptionEnd = backendEnd;
        const backendDuration = backendEnd - timingsRef.current.backendStart;
        const transcriptionDuration = backendDuration; // Combined with backend processing
        
        timingsRef.current = {
          ...timingsRef.current,
          backendEnd,
          backendDuration,
          transcriptionEnd,
          transcriptionDuration,
        };
        setPerformanceTimings(prev => ({
          ...prev,
          backendEnd,
          backendDuration,
          transcriptionEnd,
          transcriptionDuration,
        }));
        console.log(`⏱️ TIMING: Backend completed - Duration: ${backendDuration}ms (${(backendDuration / 1000).toFixed(2)}s)`);
        console.log(`⏱️ TIMING: This includes: Transcription + AI Processing + TTS Generation`);
      }
      
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
            
            // Prefer top-level vehicleDetails (already diversified by backend).
            // Fall back to contextVehicles only when top-level is empty.
            const allVehicles = topLevelVehicles.length > 0 ? topLevelVehicles : contextVehicles;
            console.log(`📊 Voice vehicle source: ${topLevelVehicles.length > 0 ? 'top-level' : 'context'} — ${allVehicles.length} vehicles`);

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

          // Lead score is an internal signal; don't toast to customers.
          if (leadScore > 50) {
            onLeadGenerated?.(data.data);
          }

          // Check if handoff is needed
          // Customer-facing UX: avoid internal success/info toasts (lead score, handoff, etc.)
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

    // Mark a "recent user action" window to allow autoplay when possible.
    // (Typing + pressing send / Web Speech button should set this; this is a fallback.)
    lastUserGestureAtRef.current = Date.now();

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
          email: customerEmail,
          dealerId: effectiveDealerId,
          sessionId: sessionId
        },
        assignedStaffId,
        staffQrHash,
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

        // Capture intent/slot snapshots
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

          // Persist sessionId so we can resume this conversation on next visit
          if (sessionId && effectiveDealerId) {
            localStorage.setItem(getSessionStorageKey(effectiveDealerId), sessionId);
          }

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
        
        // Prefer top-level vehicleDetails (already diversified by backend).
        // Fall back to contextVehicles only when top-level is empty.
        // Never combine both — they represent the same set stored in two places,
        // and merging them inflates the count shown to the user.
        const allVehicles = topLevelVehicles.length > 0 ? topLevelVehicles : contextVehicles;
        console.log(`📊 Vehicle source: ${topLevelVehicles.length > 0 ? 'top-level' : 'context'} — ${allVehicles.length} vehicles`);
        
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
          console.log('🖼️ First Vehicle Thumbnail Debug:', {
            id: allVehicles[0]?.id,
            thumbnailUrl: allVehicles[0]?.thumbnailUrl,
            thumbnail_url: allVehicles[0]?.thumbnail_url,
            image_url: allVehicles[0]?.image_url,
            photo_url_list_type: typeof allVehicles[0]?.photo_url_list,
            photo_url_list_isArray: Array.isArray(allVehicles[0]?.photo_url_list),
            photo_url_list_first: Array.isArray(allVehicles[0]?.photo_url_list) ? allVehicles[0]?.photo_url_list?.[0] : undefined
          });
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

        // Autoplay assistant audio when possible.
        // Note: on mobile Chrome, autoplay often requires a recent user gesture.
        if (assistantMessage.audioUrl && autoplayEnabled) {
          const messageId = `${assistantMessage.timestamp}-${assistantMessage.role}`;
          const msSinceGesture = Date.now() - (lastUserGestureAtRef.current || 0);
          if (msSinceGesture >= 0 && msSinceGesture < 15000) {
            setTimeout(() => playAudio(assistantMessage.audioUrl!, messageId), 0);
          } else {
            console.log('🔇 Skipping autoplay (no recent user gesture) - user can tap Play Audio', { msSinceGesture });
          }
        }

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
        if (data.data?.crewType === 'EnhancedGoNext' && data.data?.shouldAutoplay && autoplayEnabled) {
            console.log('🎵 Enhanced system response detected, but TTS DISABLED - only backend audio will play');
            console.log('🔍 Response that would have been processed:', responseContent.substring(0, 100) + '...');
        }

        // Lead/handoff are internal signals; don't toast to customers.
        if (data.data.leadScore > 50) {
          onLeadGenerated?.(data.data);
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

  const hasActiveVehicleSelection =
    selectedVehicles.length > 0 ||
    !!conversationContext?.Daivesteps?.[3]?.slots?.VehicleSelection?.hasSelectedVehicle ||
    !!conversationContext?.slots?.VehicleSelection?.hasSelectedVehicle ||
    !!conversationContext?.vehicle_selected;

  // Lightweight journey progress derived directly from the backend context array (no extra API / tracker).
  const daiveArray = (conversationContext as any)?.Daivesteps ?? (conversationContext as any)?.daiveArray ?? null;
  const daiveTotalSteps = Array.isArray(daiveArray) ? daiveArray.length : 0;
  const daiveCurrentStep =
    (journeyStages?.journeyStep as number | undefined) ??
    ((conversationContext as any)?.journeyStep as number | undefined) ??
    undefined;
  const daiveCurrentStage =
    (journeyStages?.currentStage as string | undefined) ??
    ((conversationContext as any)?.stage as string | undefined) ??
    undefined;
  const daiveCompletedCount = (() => {
    if (Array.isArray(daiveArray)) {
      const explicitCompleted = daiveArray.filter((s: any, idx: number) => {
        if (!s) return false;
        if (s.completed === true || s.isCompleted === true || s.done === true) return true;
        if (typeof s.status === 'string' && s.status.toLowerCase() === 'completed') return true;
        // If backend only sends current step, treat steps before current as completed.
        if (typeof daiveCurrentStep === 'number' && daiveCurrentStep > 0) {
          return idx + 1 < daiveCurrentStep;
        }
        return false;
      }).length;
      if (explicitCompleted > 0) return explicitCompleted;
      if (typeof daiveCurrentStep === 'number' && daiveCurrentStep > 0) return Math.max(0, daiveCurrentStep - 1);
      return 0;
    }
    if (typeof daiveCurrentStep === 'number' && daiveCurrentStep > 0) return Math.max(0, daiveCurrentStep - 1);
    return 0;
  })();

  const handleCancelVehicleSelection = async () => {
    const authToken = localStorage.getItem('auth_token');
    const customerToken = localStorage.getItem('customerToken');
    if (!authToken && !customerToken && hash) {
      setShowQuickAuth(true);
      return;
    }
    if (!hasActiveVehicleSelection || isProcessing) return;

    const cancelMessage =
      "I'd like to cancel my vehicle selection and explore other options.";
    const userMessage: Message = {
      role: 'user',
      content: cancelMessage,
      timestamp: new Date().toISOString(),
    };

    const selectedSnapshot = [...selectedVehicles];
    setMessages((prev) => [...prev, userMessage]);
    setSelectedVehicles([]);

    let patchedContext = conversationContext;
    if (conversationContext) {
      try {
        patchedContext = JSON.parse(JSON.stringify(conversationContext));
        const stepSlots = patchedContext.Daivesteps?.[3]?.slots;
        if (stepSlots?.VehicleSelection) {
          stepSlots.VehicleSelection.hasSelectedVehicle = false;
          stepSlots.VehicleSelection.selectedVehicle = null;
          stepSlots.VehicleSelection.hasRecentSelection = false;
        }
        if (stepSlots && Object.prototype.hasOwnProperty.call(stepSlots, 'inventory_choice')) {
          delete stepSlots.inventory_choice;
        }
        patchedContext.vehicle_selected = false;
        if (patchedContext.slots?.VehicleSelection) {
          patchedContext.slots.VehicleSelection.hasSelectedVehicle = false;
        }
        patchedContext.vehicleDetails = [];
      } catch {
        patchedContext = conversationContext;
      }
    }

    const customerEmail = customer?.email || null;
    const customerName = customer?.name || 'Customer';
    const customerId = (customer as any)?.id || null;

    setIsProcessing(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const response = await fetch(buildApiUrl('daive/chat'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: cancelMessage,
          sessionId,
          dealerId: effectiveDealerId,
          vehicleId,
          useCrewAI,
          action: 'cancel_vehicle_selection',
          conversationContext: patchedContext,
          customerInfo: {
            customerId,
            name: customerName,
            email: customerEmail,
            dealerId: effectiveDealerId,
            sessionId,
          },
          dataArray: [
            { type: 'userMessage', content: cancelMessage },
            { type: 'selectedVehicles', items: [] },
          ],
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
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        if (data.data?.context) {
          setConversationContext(data.data.context);
          setJourneyStages({
            currentStage: data.data.context.stage,
            journeyStep: data.data.context.journeyStep,
            slots: data.data.context.slots,
            preferences: data.data.context.preferences,
            vehicleHistory: data.data.context.vehicle_history,
            lastUpdated: new Date().toISOString(),
          });
        }
        setTimeout(() => {
          startTypewriterEffect(assistantMessage);
        }, 50);
        toast.success('Selection cleared. You can keep browsing.');
      } else {
        throw new Error(data.error || 'Failed to cancel selection');
      }
    } catch (error) {
      console.error('Error canceling vehicle selection:', error);
      toast.error('Failed to cancel selection. Please try again.');
      setMessages((prev) => prev.slice(0, -1));
      setSelectedVehicles(selectedSnapshot);
    } finally {
      setIsProcessing(false);
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
          // Mark AI as speaking
          isSpeakingRef.current = true;
          
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
          
          // ⏱️ START TIMING: TTS Playback
          const ttsStart = Date.now();
          timingsRef.current = {
            ...timingsRef.current,
            ttsStart,
          };
          setPerformanceTimings(prev => ({
            ...prev,
            ttsStart,
          }));
          console.log('⏱️ TIMING: TTS playback started');
          
          audioRef.current?.play().catch(err => {
            console.log('Could not play audio:', err);
              setIsPlaying(false);
              setPlayingMessageId(null);
              isSpeakingRef.current = false;
          });
          }, { once: true });
        
        audioRef.current.addEventListener('error', (e) => {
          console.error('❌ Audio loading error:', e);
          setIsPlaying(false);
            setPlayingMessageId(null);
            isSpeakingRef.current = false;
            
            // Still try to continue conversation even if audio fails
            setTimeout(() => {
              if (!isRecording && !isProcessing && !isPlaying && !isSpeakingRef.current) {
                console.log('🔄 Auto-continuing conversation after audio error...');
                startRecording();
              } else {
                console.log('⚠️ Skipping auto-continue after error - still active:', {
                  isRecording,
                  isProcessing,
                  isPlaying,
                  isSpeaking: isSpeakingRef.current
                });
              }
            }, 500);
          }, { once: true });
        
        audioRef.current.addEventListener('ended', () => {
            console.log('🏁 Audio playback ended');
          
          // ⏱️ END TIMING: TTS Playback + Calculate Total
          if (timingsRef.current.ttsStart) {
            const ttsEnd = Date.now();
            const ttsDuration = ttsEnd - timingsRef.current.ttsStart;
            
            // Calculate total duration from recording start to TTS end
            let totalDuration = 0;
            if (timingsRef.current.recordingStart) {
              totalDuration = ttsEnd - timingsRef.current.recordingStart;
            }
            
            timingsRef.current = {
              ...timingsRef.current,
              ttsEnd,
              ttsDuration,
              totalDuration,
            };
            setPerformanceTimings(prev => ({
              ...prev,
              ttsEnd,
              ttsDuration,
              totalDuration,
            }));
            
            console.log(`⏱️ TIMING: TTS playback completed - Duration: ${ttsDuration}ms (${(ttsDuration / 1000).toFixed(2)}s)`);
            console.log(`⏱️ TIMING: TOTAL CONVERSATION CYCLE - Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('⏱️ PERFORMANCE BREAKDOWN:');
            console.log(`  1. Recording: ${timingsRef.current.recordingDuration}ms (${((timingsRef.current.recordingDuration || 0) / 1000).toFixed(2)}s)`);
            console.log(`  2. Backend (Transcription + AI + TTS): ${timingsRef.current.backendDuration}ms (${((timingsRef.current.backendDuration || 0) / 1000).toFixed(2)}s)`);
            console.log(`  3. TTS Playback: ${ttsDuration}ms (${(ttsDuration / 1000).toFixed(2)}s)`);
            console.log(`  TOTAL: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          }
          
          setIsPlaying(false);
            setPlayingMessageId(null);
            isSpeakingRef.current = false;

            // If we paused Web Speech to prevent self-hearing, resume after playback ends.
            if (webSpeechPausedForPlaybackRef.current) {
              webSpeechPausedForPlaybackRef.current = false;
              setTimeout(() => {
                if (isWebSpeechFeatureEnabled && isWebSpeechAutoListenEnabled) {
                  startWebSpeechTestOnly('auto');
                }
              }, 700);
            }
            
            // 🔁 Auto-continue conversation - start listening again
            // Double-check that audio is really done before restarting
            setTimeout(() => {
              if (!isRecording && !isProcessing && !isPlaying && !isSpeakingRef.current) {
                console.log('🔄 Auto-continuing conversation - starting listening...');
                lastRestartTimeRef.current = Date.now(); // Reset cooldown for normal flow
                startRecording();
              } else {
                console.log('⚠️ Skipping auto-continue - still processing or playing:', {
                  isRecording,
                  isProcessing,
                  isPlaying,
                  isSpeaking: isSpeakingRef.current
                });
              }
            }, 500); // Small delay before restarting
          }, { once: true });
        
        audioRef.current.addEventListener('play', () => {
            console.log('▶️ Audio playback started');
          setIsPlaying(true);
          isSpeakingRef.current = true; // Ensure speaking ref is set when actually playing

          // Prevent Web Speech from hearing the bot: pause listening during playback.
          if (webSpeechTestRef.current || isWebSpeechTestActive) {
            webSpeechPausedForPlaybackRef.current = true;
            stopWebSpeechTestOnly();
          }
          }, { once: true });
        
        audioRef.current.addEventListener('pause', () => {
            console.log('⏸️ Audio playback paused');
          // Don't reset isSpeakingRef on pause - might resume
          }, { once: false });
        
        audioRef.current.load(); // Start loading the audio
      } catch (err) {
        console.log('Could not create audio element:', err);
          setIsPlaying(false);
          setPlayingMessageId(null);
          isSpeakingRef.current = false;
          
          // Try to continue conversation even if audio setup fails
          setTimeout(() => {
            if (!isRecording && !isProcessing && !isPlaying && !isSpeakingRef.current) {
              console.log('🔄 Auto-continuing after audio setup failure...');
              startRecording();
            } else {
              console.log('⚠️ Skipping auto-continue after setup failure - still active');
            }
          }, 500);
      }
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setPlayingMessageId(null);
      isSpeakingRef.current = false;

      // If playback was stopped while Web Speech was paused for it, resume auto-listen.
      if (webSpeechPausedForPlaybackRef.current) {
        webSpeechPausedForPlaybackRef.current = false;
        setTimeout(() => {
          if (isWebSpeechFeatureEnabled && isWebSpeechAutoListenEnabled) {
            startWebSpeechTestOnly('auto');
          }
        }, 700);
      }
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
  const handleVoiceButtonPress = async () => {
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

    // Mobile/Android: mic permission prompts are unreliable on non-secure origins.
    // If we're not in a secure context (HTTPS or localhost), fail fast with a clear message.
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      toast.error('Voice requires HTTPS on mobile. Open this page via a secure (https) link to enable microphone access.');
      setIsPressingVoiceButton(false);
      recordingInProgressRef.current = false;
      return;
    }
    
    // Ensure MediaRecorder is initialized before starting
    if (!mediaRecorderRef.current) {
      console.log('🎤 Initializing MediaRecorder...');
      try {
        // Await directly inside the user gesture handler so Chrome shows the permission prompt.
        await initializeMediaRecorder();
        console.log('✅ MediaRecorder ready, starting recording...');
        startRecording();
        startRecordingDurationTimer();
      } catch (error) {
        console.error('Failed to initialize MediaRecorder:', error);
        toast.error('Microphone access denied. Please allow microphone access and try again.');
        setIsPressingVoiceButton(false);
        recordingInProgressRef.current = false; // Reset flag on error
      }
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
    
    // Stop recording duration timer
    if (recordingDurationRef.current) {
      clearInterval(recordingDurationRef.current);
      recordingDurationRef.current = null;
    }
    
    // Check minimum recording duration before stopping
    const minRecordingDuration = 0.5; // 500ms minimum
    const actualDuration =
      recordingStartTime != null ? (Date.now() - recordingStartTime) / 1000 : recordingDuration;

    // Clear start time after we've calculated duration
    setRecordingStartTime(null);

    if (actualDuration < minRecordingDuration) {
      console.log('⚠️ Recording too short, continuing for minimum duration...');
      
      // Continue recording for minimum duration
      setTimeout(() => {
        stopRecording();
        recordingInProgressRef.current = false; // Reset flag after stopping
      }, (minRecordingDuration - actualDuration) * 1000);
    } else {
      // Stop recording immediately if duration is sufficient
      stopRecording();
      recordingInProgressRef.current = false; // Reset flag after stopping
    }
  };

  const stopWebSpeechTestOnly = () => {
    if (webSpeechTestRef.current) {
      try {
        webSpeechTestRef.current.stop();
      } catch {
        // ignore
      }
      webSpeechTestRef.current = null;
    }
    setIsWebSpeechTestActive(false);
  };

  const startWebSpeechTestOnly = (source: 'manual' | 'auto') => {
    if (!isWebSpeechFeatureEnabled) return;
    if (isProcessing || isRecording || isPressingVoiceButton || recordingInProgressRef.current) return;

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      if (source === 'manual') {
        toast.error('Web Speech requires HTTPS on mobile. Open this page via a secure (https) link.');
      }
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      if (source === 'manual') {
        toast.error('Web Speech API is not supported in this browser.');
      }
      return;
    }

    // Important: stop any app playback BEFORE starting recognition.
    // This prevents the recognizer from "hearing" our own agent audio via the mic/speaker.
    if (isPlaying) {
      stopAudio();
    }
    pauseAllAudio();

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('🌐 Web Speech (test): listening');
        webSpeechLastErrorRef.current = null;
        setIsWebSpeechTestActive(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = (event.results[0]?.[0]?.transcript as string | undefined)?.trim() ?? '';
        console.log('🌐 Web Speech (test): transcript', transcript);
        // Successful speech — reset no-speech back-off counter
        webSpeechNoSpeechCountRef.current = 0;
        stopWebSpeechTestOnly();
        if (transcript) {
          void sendTextMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        const errCode = String(event.error ?? '');
        webSpeechLastErrorRef.current = errCode;

        if (errCode === 'no-speech') {
          // Stamp end-time NOW so the auto-listen useEffect sees it before onend fires
          webSpeechLastEndAtRef.current = Date.now();
          webSpeechNoSpeechCountRef.current += 1;
          // Only log at debug level — no-speech is normal, not an error
          console.log(`🌐 Web Speech: no-speech (consecutive: ${webSpeechNoSpeechCountRef.current})`);
        } else {
          console.error('🌐 Web Speech (test): error', errCode);
          // Non-no-speech errors reset the counter
          webSpeechNoSpeechCountRef.current = 0;

          // Fatal errors — the browser won't recover on its own, so kill auto-listen
          // to prevent a zombie "Listening" UI with nothing actually capturing audio.
          const fatalErrors = ['not-allowed', 'service-not-allowed', 'audio-capture', 'network'];
          if (fatalErrors.includes(errCode)) {
            console.warn(`🌐 Web Speech: fatal error "${errCode}" — disabling auto-listen`);
            setIsWebSpeechAutoListenEnabled(false);
            localStorage.setItem('daive_webspeech_autolisten', 'false');
          }
        }

        stopWebSpeechTestOnly();
        if (source === 'manual' && errCode !== 'aborted' && errCode !== 'no-speech') {
          toast.error(`Web Speech: ${errCode}`);
        }
      };

      recognition.onend = () => {
        webSpeechLastEndAtRef.current = Date.now();
        webSpeechTestRef.current = null;
        setIsWebSpeechTestActive(false);
      };

      webSpeechTestRef.current = recognition;
      // Small delay lets the device speaker/mic settle after we stop playback,
      // reducing the chance of recognizing the tail-end of our own audio.
      window.setTimeout(() => {
        try {
          recognition.start();
        } catch (e) {
          console.error('🌐 Web Speech (test): recognition.start failed', e);
          stopWebSpeechTestOnly();
        }
      }, 200);
    } catch (error) {
      console.error('🌐 Web Speech (test): failed to start', error);
      if (source === 'manual') toast.error('Could not start Web Speech recognition.');
      stopWebSpeechTestOnly();
    }
  };

  /** Browser Web Speech only (no blob / daive/voice). Sends transcript as a normal chat message. */
  const handleWebSpeechTestButton = () => {
    if (isProcessing && !isWebSpeechTestActive) return;

    if (isWebSpeechTestActive || isWebSpeechAutoListenEnabled) {
      // End the whole session — reset user-pause flag too
      webSpeechUserPausedRef.current = false;
      stopWebSpeechTestOnly();
      setIsWebSpeechAutoListenEnabled(false);
      return;
    }

    // Treat this as a user gesture for autoplay unlock (mobile Chrome).
    lastUserGestureAtRef.current = Date.now();

    if (!isWebSpeechFeatureEnabled) {
      toast.info('Web Speech is disabled. Enable it first.');
      return;
    }

    if (isRecording || isPressingVoiceButton || recordingInProgressRef.current) {
      toast.info('Stop the hold-to-record microphone first.');
      return;
    }

    // Starting a fresh session — clear any prior user-pause and back-off state
    webSpeechUserPausedRef.current = false;
    webSpeechNoSpeechCountRef.current = 0;
    setIsWebSpeechAutoListenEnabled(true);
    startWebSpeechTestOnly('auto');
  };

  // Persist Web Speech settings
  useEffect(() => {
    try {
      localStorage.setItem('daive_webspeech_enabled', String(isWebSpeechFeatureEnabled));
    } catch {
      // ignore
    }
  }, [isWebSpeechFeatureEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('daive_webspeech_autolisten', String(isWebSpeechAutoListenEnabled));
    } catch {
      // ignore
    }
  }, [isWebSpeechAutoListenEnabled]);

  // Auto-listen loop for Web Speech test (starts after chat finishes processing).
  useEffect(() => {
    if (!isWebSpeechFeatureEnabled || !isWebSpeechAutoListenEnabled) return;
    // Never auto-listen while bot audio is playing (prevents self-hearing).
    if (isProcessing || isPlaying || isRecording || isPressingVoiceButton) return;
    // If we explicitly paused Web Speech for playback, don't restart until playback ends.
    if (webSpeechPausedForPlaybackRef.current) return;
    // If the user manually paused the mic, never auto-restart.
    if (webSpeechUserPausedRef.current) return;
    if (isWebSpeechTestActive || webSpeechTestRef.current) return;

    // Exponential back-off after consecutive no-speech results.
    // count=1→3s, count=2→5s, count=3→9s, count≥4→15s cap
    const lastErr = webSpeechLastErrorRef.current;
    const sinceEnd = Date.now() - (webSpeechLastEndAtRef.current || 0);
    if (lastErr === 'no-speech') {
      const count = webSpeechNoSpeechCountRef.current;
      const backoffMs = Math.min(3000 * Math.pow(1.8, count - 1), 15000);
      if (sinceEnd < backoffMs) return;
    }

    // Cooldown so we don't thrash on quick state changes.
    const sinceLastAutoStart = Date.now() - (webSpeechLastAutoStartAtRef.current || 0);
    if (sinceLastAutoStart < 1500) return;

    const t = window.setTimeout(() => {
      if (!isWebSpeechFeatureEnabled || !isWebSpeechAutoListenEnabled) return;
      if (isProcessing || isPlaying || isRecording || isPressingVoiceButton) return;
      if (webSpeechUserPausedRef.current) return;
      if (isWebSpeechTestActive || webSpeechTestRef.current) return;
      webSpeechLastAutoStartAtRef.current = Date.now();
      startWebSpeechTestOnly('auto');
    }, 400);

    return () => window.clearTimeout(t);
  }, [
    isWebSpeechFeatureEnabled,
    isWebSpeechAutoListenEnabled,
    isProcessing,
    isPlaying,
    isRecording,
    isPressingVoiceButton,
    isWebSpeechTestActive,
  ]);

  // Watchdog: detects zombie state where isWebSpeechTestActive is true but the
  // underlying recognition object is gone (onend/onerror silently dropped).
  // Also resets if auto-listen is enabled but nothing has happened for too long.
  useEffect(() => {
    if (!isWebSpeechAutoListenEnabled && !isWebSpeechTestActive) return;

    const watchdog = window.setInterval(() => {
      // Zombie: UI thinks it's active but ref is gone
      if (isWebSpeechTestActive && !webSpeechTestRef.current) {
        console.warn('🌐 Web Speech watchdog: zombie state detected — resetting');
        setIsWebSpeechTestActive(false);
        webSpeechLastEndAtRef.current = Date.now();
        return;
      }

      // Stale auto-listen: enabled and not processing/playing, but recognition
      // hasn't started in the last 20 seconds — browser may have silently died
      if (
        isWebSpeechAutoListenEnabled &&
        !isWebSpeechTestActive &&
        !webSpeechTestRef.current &&
        !isProcessing &&
        !isPlaying &&
        !webSpeechUserPausedRef.current
      ) {
        const sinceLastEnd = Date.now() - (webSpeechLastEndAtRef.current || 0);
        const sinceLastStart = Date.now() - (webSpeechLastAutoStartAtRef.current || 0);
        if (sinceLastEnd > 20000 && sinceLastStart > 20000) {
          console.warn('🌐 Web Speech watchdog: stale auto-listen — disabling');
          setIsWebSpeechAutoListenEnabled(false);
          localStorage.setItem('daive_webspeech_autolisten', 'false');
        }
      }
    }, 5000);

    return () => window.clearInterval(watchdog);
  }, [isWebSpeechAutoListenEnabled, isWebSpeechTestActive, isProcessing, isPlaying]);

  // Start recording duration timer
  const startRecordingDurationTimer = () => {
    recordingDurationRef.current = setInterval(() => {
      if (recordingStartTime != null) {
        const duration = (Date.now() - recordingStartTime) / 1000;
        setRecordingDuration(Number(duration.toFixed(1)));
      }
    }, 100);
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
    const firstFromPhotoUrlListString = (() => {
      const raw = vehicle?.photo_url_list;
      if (!raw || typeof raw !== 'string') return undefined;
      const trimmed = raw.trim();
      // JSON array format: ["url1","url2"] or [{"url":"..."}]
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const first = parsed[0];
            if (typeof first === 'string') return first || undefined;
            if (first && typeof first === 'object') {
              const candidate = (first as any).url ?? (first as any).src ?? (first as any).href;
              return (typeof candidate === 'string' && candidate) ? candidate : undefined;
            }
          }
        } catch {
          // ignore
        }
      }
      // PostgreSQL array string format: {"url1","url2"}
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const content = trimmed.slice(1, -1);
        const first = content.split(',')[0]?.trim().replace(/^"|"$/g, '');
        return first || undefined;
      }
      // Comma-separated URLs
      if (trimmed.includes(',')) {
        const first = trimmed.split(',')[0]?.trim();
        return first || undefined;
      }
      return trimmed || undefined;
    })();

    const thumbCandidate =
      (vehicle.thumbnailUrl as string | undefined) ||
      (vehicle.thumbnail_url as string | undefined) ||
      (vehicle.image_url as string | undefined) ||
      (Array.isArray(vehicle.photo_url_list) ? (vehicle.photo_url_list[0] as string | undefined) : undefined) ||
      firstFromPhotoUrlListString ||
      (Array.isArray(vehicle.images) ? (vehicle.images[0] as string | undefined) : undefined);

    const thumbSrc =
      thumbCandidate &&
      (/^https?:\/\//i.test(thumbCandidate) ? thumbCandidate : buildAssetUrl(thumbCandidate));
    const galleryTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}${
      vehicle.trim ? ` ${String(vehicle.trim).trim()}` : ''
    }`;
    return (
      <div 
        className="bg-white border border-[#5D6D7E]/18 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-[#FF6B2B]/35"
        onClick={() => onSelect(vehicle)}
      >
        {thumbSrc ? (
          <div className="relative w-full h-24 bg-gray-100">
            <img
              src={thumbSrc}
              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : null}
        <div className="p-2">
          <div className="flex justify-between items-start gap-1 mb-1">
            <h3 className="font-semibold text-sm text-gray-900 leading-snug">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            <span className="text-sm font-bold text-[#FF6B2B] whitespace-nowrap shrink-0">{vehicle.price}</span>
          </div>

          {/* Compact 2-column spec grid */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-gray-600 mb-1.5">
            {vehicle.color && (
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-gray-400 shrink-0">Color</span>
                <span className="font-medium truncate">{vehicle.color}</span>
              </div>
            )}
            {vehicle.mileage && (
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-gray-400 shrink-0">Mi</span>
                <span className="font-medium truncate">{vehicle.mileage}</span>
              </div>
            )}
            {vehicle.trim && (
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-gray-400 shrink-0">Trim</span>
                <span className="font-medium truncate">{vehicle.trim}</span>
              </div>
            )}
            {vehicle.stockNumber && (
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-gray-400 shrink-0">Stock</span>
                <span className="font-medium truncate">{vehicle.stockNumber}</span>
              </div>
            )}
          </div>

          {/* Badges row (condition + type) */}
          {(vehicle.new_used || vehicle.vehicle_type) && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {vehicle.new_used && (
                <span className={`inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium ${
                  vehicle.new_used.toLowerCase() === 'new'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-primary/15 text-primary'
                }`}>
                  {vehicle.new_used}
                </span>
              )}
              {vehicle.vehicle_type && (
                <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
                  {vehicle.vehicle_type}
                </span>
              )}
            </div>
          )}

        <div className="pt-1.5 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            {/* Compact icon button: Select vehicle */}
            <button
              aria-label="Select This Vehicle"
              title="Select This Vehicle"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#FF6B2B] text-white hover:bg-[#e85f24] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(vehicle);
              }}
            >
              <Check className="w-3.5 h-3.5" />
            </button>

            {/* Compact icon button: Test drive */}
            <button
              aria-label="Test Drive Interested"
              title="Test Drive Interested"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#5D6D7E] text-white hover:bg-[#4d5a68] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onTestDrive(vehicle);
              }}
            >
              <img src={testDriveIconUrl} alt="" className="w-4 h-4" draggable={false} />
            </button>

            {/* Compact icon button: CARFAX */}
            <button
              aria-label="View CARFAX"
              title={vehicle.id ? 'View CARFAX Report' : 'CARFAX not available'}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
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
              {loadingCarfax ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <img src={carfaxIconUrl} alt="" className="w-4 h-4" draggable={false} />
              )}
            </button>

            <button
              aria-label="View vehicle photos"
              title={vehicle.id ? 'View photos' : 'Photos unavailable'}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                vehicle.id
                  ? 'bg-[#FF6B2B]/90 text-white hover:bg-[#e85f24]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (!vehicle.id) return;
                void openImageGallery(vehicle.id, galleryTitle);
              }}
              disabled={!vehicle.id}
            >
              <Images className="w-3.5 h-3.5" />
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
      </div>
    );
  };

  // Voice Panel Component - Shows alongside chat for continuous voice mode
  const VoicePanel: React.FC = () => {
    if (!showVoicePanel) return null;

    return (
      <div className="fixed right-2 sm:right-4 top-20 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-purple-200 z-40 overflow-hidden max-h-[calc(100vh-100px)] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-primary/90 p-4 text-white">
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
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/80 to-purple-600 opacity-50 animate-pulse"></div>
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-400 to-primary/90 opacity-60" style={{animation: 'spin 2s linear infinite'}}></div>
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-primary/70 to-purple-500 opacity-70 flex items-center justify-center">
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
              <li>• Use Stop Speaking to interrupt</li>
            </ul>
          </div>

          {/* Status Indicators */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-primary">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span>{isRecording ? 'Detecting silence...' : 'Auto-stop ready'}</span>
            </div>
          </div>

          {/* Performance Timing Display */}
          {performanceTimings.totalDuration && (
            <div className="mt-3 bg-gradient-to-br from-primary/5 to-purple-50 rounded-lg p-2.5 border border-primary/20">
              <p className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1">
                ⏱️ Last Response Time
              </p>
              <div className="space-y-1 text-xs text-gray-700">
                <div className="flex justify-between">
                  <span>Recording:</span>
                  <span className="font-medium">{((performanceTimings.recordingDuration || 0) / 1000).toFixed(2)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing:</span>
                  <span className="font-medium">{((performanceTimings.backendDuration || 0) / 1000).toFixed(2)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Playback:</span>
                  <span className="font-medium">{((performanceTimings.ttsDuration || 0) / 1000).toFixed(2)}s</span>
                </div>
                <div className="flex justify-between border-t border-primary/20 pt-1 mt-1">
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold text-primary">{(performanceTimings.totalDuration / 1000).toFixed(2)}s</span>
                </div>
              </div>
            </div>
          )}
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
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <div className="text-3xl font-bold text-primary">{carfaxData.owners || 0}</div>
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
                  className="text-primary hover:underline mt-2 inline-block"
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
                          <div key={itemIndex} className="flex items-start gap-3 p-2 bg-[#F3F6FB] rounded-xl border border-[#CFD8DC]">
                            <span className="flex-shrink-0 w-7 h-7 bg-[#FF6B2B] text-white rounded-full flex items-center justify-center text-sm font-bold">
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
                        <div key={itemIndex} className="flex items-start gap-3 p-2 bg-[#F3F6FB] rounded-xl border border-[#CFD8DC]">
                          <span className="flex-shrink-0 w-7 h-7 bg-[#FF6B2B] text-white rounded-full flex items-center justify-center text-sm font-bold">
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
                        <div key={itemIndex} className="flex items-start gap-3 p-2 bg-[#F3F6FB] rounded-xl border border-[#CFD8DC]/80">
                          <span className="flex-shrink-0 w-2.5 h-2.5 bg-[#FF6B2B] rounded-full mt-2"></span>
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
                   className="text-sm leading-relaxed p-3 bg-[#F3F6FB] rounded-2xl border border-[#CFD8DC]"
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
      // Backend GET /vehicles/:id returns the row as the JSON body (see vehicles.js res.json(result.rows[0])).
      // Some callers may still wrap as { vehicle } or { data }.
      const vehicle =
        (data && typeof data.vehicle === 'object' && data.vehicle !== null ? data.vehicle : null) ??
        (data && typeof data.data === 'object' && data.data !== null ? data.data : null) ??
        (data && typeof data === 'object' && data.id != null ? data : null);

      if (!vehicle || typeof vehicle !== 'object') {
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

  const sendInventoryFilterPrompt = () => {
    const parts: string[] = [];
    parts.push(`I'm looking for vehicles up to $${inventoryBudgetMax.toLocaleString()}${inventoryBudgetMax >= 100000 ? ' or best options near this range' : ''}.`);
    if (inventoryTypeFilter) parts.push(`I prefer a ${inventoryTypeFilter}.`);
    if (inventoryConditionFilter) parts.push(`I want ${inventoryConditionFilter === 'new' ? 'new' : 'used'} vehicles.`);
    if (inventoryFeatureFilters.length > 0) parts.push(`I want a vehicle with: ${inventoryFeatureFilters.join(', ')}.`);
    parts.push('Please show options from your inventory that match.');
    void sendTextMessage(parts.join(' '));
  };

  // Track the visual viewport position and size so the chat container always
  // covers exactly what the user can see — including when the iOS keyboard opens.
  // iOS Safari scrolls `visualViewport.offsetTop` upward when an input is focused,
  // which would push our fixed container off-screen. We counteract this with
  // translateY(offsetTop) so the header is always visible at the top.
  const [vvState, setVvState] = React.useState<{ offsetTop: number; height: number }>({
    offsetTop: 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const activeElement = document.activeElement;
      const inputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      // iOS can keep offsetTop stale for a moment after a typed input blurs.
      // Only use offsetTop while an editable field is actively focused.
      setVvState({
        offsetTop: inputFocused ? vv.offsetTop : 0,
        height: vv.height,
      });
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('focusout', update);
    window.addEventListener('blur', update);
    // Also lock body scroll so iOS can't independently scroll the page behind us
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('focusout', update);
      window.removeEventListener('blur', update);
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.width = '';
    };
  }, []);

  return (
    <div
      className="bg-[#F3F6FB] p-2 sm:p-4 overflow-hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: `${vvState.height}px`,
        // Counteract iOS Safari's visual viewport scroll so the header stays on screen
        transform: vvState.offsetTop > 0 ? `translateY(${vvState.offsetTop}px)` : undefined,
      }}
    >
      {/* ✅ CarFax Button Styling + Daive Call Overlay Animations */}
      <style>{`
        /* ── Mobile page scroll lock ── */
        /* Prevent the page/body from scrolling at all — only the message box scrolls */
        html, body {
          overflow: hidden !important;
          position: fixed !important;
          width: 100% !important;
          height: 100% !important;
          overscroll-behavior: none !important;
          touch-action: none;
        }
        /* Restore touch scrolling inside the messages area only */
        [data-messages-scroll] {
          touch-action: pan-y !important;
          overscroll-behavior: contain;
        }
        /* Prevent iOS auto-zoom on input focus */
        input, textarea, select {
          font-size: 16px !important;
        }

        /* ── Daive Orb ── */
        @keyframes daive-orb-idle {
          0%, 100% { transform: scale(1);   box-shadow: 0 0 40px 10px rgba(90,140,255,0.35), 0 0 80px 20px rgba(90,140,255,0.15); }
          50%       { transform: scale(1.06); box-shadow: 0 0 60px 18px rgba(90,140,255,0.5),  0 0 110px 30px rgba(90,140,255,0.2); }
        }
        @keyframes daive-orb-listening {
          0%, 100% { transform: scale(1);    box-shadow: 0 0 50px 15px rgba(0,200,180,0.45), 0 0 90px 25px rgba(0,200,180,0.2); }
          25%       { transform: scale(1.09); box-shadow: 0 0 70px 22px rgba(0,200,180,0.6),  0 0 130px 40px rgba(0,200,180,0.25); }
          75%       { transform: scale(0.97); box-shadow: 0 0 40px 10px rgba(0,200,180,0.3),  0 0 80px 18px rgba(0,200,180,0.15); }
        }
        @keyframes daive-orb-speaking {
          0%, 100% { transform: scale(1);    box-shadow: 0 0 50px 15px rgba(255,107,43,0.45), 0 0 90px 25px rgba(255,107,43,0.2); }
          33%       { transform: scale(1.1);  box-shadow: 0 0 70px 22px rgba(255,107,43,0.6),  0 0 130px 40px rgba(255,107,43,0.25); }
          66%       { transform: scale(0.96); box-shadow: 0 0 40px 10px rgba(255,107,43,0.3),  0 0 80px 18px rgba(255,107,43,0.15); }
        }
        .daive-orb-idle      { animation: daive-orb-idle      2.4s ease-in-out infinite; }
        .daive-orb-listening { animation: daive-orb-listening 1.2s ease-in-out infinite; }
        .daive-orb-speaking  { animation: daive-orb-speaking  0.9s ease-in-out infinite; }

        /* ── Widget slide-up ── */
        @keyframes daive-widget-in  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .daive-overlay-enter { animation: daive-widget-in 0.28s cubic-bezier(.22,1,.36,1) forwards; }

        /* ── Sound bars (listening indicator) ── */
        @keyframes daive-bar1 { 0%,100%{height:4px}  40%{height:16px} }
        @keyframes daive-bar2 { 0%,100%{height:10px} 30%{height:22px} }
        @keyframes daive-bar3 { 0%,100%{height:6px}  50%{height:18px} }
        @keyframes daive-bar4 { 0%,100%{height:14px} 20%{height:6px}  }
        @keyframes daive-bar5 { 0%,100%{height:4px}  60%{height:14px} }
        .daive-bar1 { animation: daive-bar1 0.9s ease-in-out infinite; }
        .daive-bar2 { animation: daive-bar2 0.75s ease-in-out infinite 0.1s; }
        .daive-bar3 { animation: daive-bar3 1.0s ease-in-out infinite 0.2s; }
        .daive-bar4 { animation: daive-bar4 0.8s ease-in-out infinite 0.05s; }
        .daive-bar5 { animation: daive-bar5 0.95s ease-in-out infinite 0.15s; }

        /* ── Glowing accent border ── */
        @keyframes daive-border-glow {
          0%,100% { opacity:.5; } 50% { opacity:1; }
        }
        .daive-widget-border {
          position:absolute; inset:0; border-radius:1rem;
          padding:1px;
          background: linear-gradient(135deg, rgba(0,200,180,0.6) 0%, rgba(90,140,255,0.4) 50%, rgba(0,200,180,0.6) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          animation: daive-border-glow 2s ease-in-out infinite;
          pointer-events: none;
        }
        .daive-widget-border-speaking {
          background: linear-gradient(135deg, rgba(255,107,43,0.7) 0%, rgba(255,60,60,0.4) 50%, rgba(255,107,43,0.7) 100%);
        }

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
      
      <div className="max-w-6xl xl:max-w-7xl mx-auto h-full">
        <Card className="w-full h-full flex flex-col border border-[#5D6D7E]/20 shadow-2xl shadow-slate-300/35 rounded-3xl bg-white overflow-hidden">

          <CardHeader className="p-0 space-y-0 border-0 shrink-0">
            <div className="bg-[#5D6D7E] text-white">
              <div className="flex items-center gap-2 px-2 sm:px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/15 rounded-full h-10 w-10 shrink-0"
                  onClick={() => navigate(-1)}
                  aria-label="Go back"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <div className="w-10 h-10 rounded-2xl bg-[#FF6B2B] flex items-center justify-center shadow-md ring-2 ring-white/25 shrink-0">
                  <Car className="h-5 w-5 text-white" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg font-semibold text-white border-0 p-0 m-0 leading-tight">
                    D.A.I.V.E.
                  </CardTitle>
                  <p className="text-xs text-white/80 truncate mt-0.5">
                    {activeSelectedVehicle
                      ? `${activeSelectedVehicle.year ?? ''} ${activeSelectedVehicle.make ?? ''} ${activeSelectedVehicle.model ?? ''}${activeSelectedVehicle.trim ? ` · ${activeSelectedVehicle.trim}` : ''}${activeSelectedVehicle.price ? ` · $${Number(String(activeSelectedVehicle.price).replace(/[^0-9]/g, '')).toLocaleString()}` : ''}`
                      : vehicleInfo
                        ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`
                        : 'Inventory & assistance'}
                  </p>
                </div>
                {/* New Conversation button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/15 rounded-full h-10 w-10 shrink-0"
                  aria-label="Start new conversation"
                  title="Start new conversation"
                  onClick={() => setShowNewChatConfirm(true)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/15 rounded-full h-10 w-10 shrink-0"
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
              {!isProductionMode && (
                <div className="flex flex-wrap items-center gap-1.5 px-2 sm:px-4 py-2 border-t border-white/15 bg-black/10 text-[10px] sm:text-xs">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={testBackendConnection}
                    className="h-7 px-2 text-[10px] sm:text-xs border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    Test Backend
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={queryInventoryDatabase}
                    className="h-7 px-2 text-[10px] sm:text-xs border-white/30 bg-white/10 text-white hover:bg-white/20"
                    title="Query database for inventory details"
                    disabled={isInventoryQuerying}
                  >
                    {isInventoryQuerying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                    <span className="ml-1 hidden sm:inline">{isInventoryQuerying ? 'Querying...' : 'Inventory'}</span>
                  </Button>
                  {lastQueryTime != null && (
                    <span className="text-white/70">{lastQueryTime}ms</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={checkUserAuthStatus}
                    className="h-7 px-2 text-[10px] sm:text-xs border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    Auth
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={checkCurrentDealerContext}
                    className="h-7 px-2 text-[10px] sm:text-xs border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    Dealer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => clearCacheAndRefresh(false)}
                    className="h-7 px-2 text-[10px] sm:text-xs border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    Cache
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggleJourneyTracker}
                    className="h-7 px-2 text-[10px] sm:text-xs border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    {showJourneyTracker ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggleProductionMode}
                    className="h-7 px-2 text-[10px] sm:text-xs border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    {isProductionMode ? 'Prod' : 'Dev'}
                  </Button>
                  <span className="text-white/60 ml-auto truncate max-w-[140px] sm:max-w-none">{backendStatus}</span>
                  <Badge variant="outline" className="text-[10px] border-white/40 text-white bg-transparent">
                    {localStorage.getItem('auth_token') ? 'Auth ✓' : 'No auth'}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 flex flex-col p-0">
            {/* ── New Conversation Confirmation Banner ── */}
            {showNewChatConfirm && (
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm animate-in slide-in-from-top-2 duration-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="flex-1 font-medium">Start a new conversation? All current messages will be cleared.</span>
                <button
                  onClick={handleStartNewConversation}
                  className="px-3 py-1 rounded-full bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors shrink-0"
                >
                  Yes, Start New
                </button>
                <button
                  onClick={() => setShowNewChatConfirm(false)}
                  className="p-1 rounded-full hover:bg-amber-100 text-amber-700 transition-colors shrink-0"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* ── Resume Previous Conversation Prompt (Option C — older than 24 h) ── */}
            {resumePromptData && (
              <div className="animate-in slide-in-from-top-2 duration-250 border-b border-[#5D6D7E]/20">
                <div
                  className="flex flex-col gap-2 px-4 py-3"
                  style={{ background: 'linear-gradient(135deg, #0f1923 0%, #1a2d3a 100%)' }}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#FF6B2B] flex items-center justify-center shrink-0">
                      <Car className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold leading-tight">Welcome back!</p>
                      <p className="text-white/50 text-xs leading-tight">
                        You have a previous conversation from{' '}
                        {resumePromptData.updatedAt
                          ? new Date(resumePromptData.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : 'earlier'}
                        {' '}· {Math.floor(resumePromptData.messageCount / 2)} message{Math.floor(resumePromptData.messageCount / 2) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setResumePromptData(null);
                        if (effectiveDealerId) localStorage.removeItem(getSessionStorageKey(effectiveDealerId));
                        const newId = `aibot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        setSessionId(newId);
                        if (!hash) sendInitialGreeting();
                      }}
                      className="p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors shrink-0"
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Last message preview */}
                  {resumePromptData.lastMessage && (
                    <p className="text-white/40 text-xs italic pl-9 truncate">
                      "{resumePromptData.lastMessage}"
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pl-9">
                    <button
                      onClick={() => {
                        applyRestoredSession({
                          sessionId: resumePromptData.sessionId,
                          messages: resumePromptData.messages,
                          context: resumePromptData.context,
                        });
                        toast.success('Conversation resumed');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6B2B] hover:bg-[#e85f20] text-white text-xs font-semibold transition-colors"
                    >
                      <Repeat className="h-3 w-3" />
                      Continue Previous
                    </button>
                    <button
                      onClick={() => {
                        setResumePromptData(null);
                        if (effectiveDealerId) localStorage.removeItem(getSessionStorageKey(effectiveDealerId));
                        const newId = `aibot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        setSessionId(newId);
                        if (effectiveDealerId) localStorage.setItem(getSessionStorageKey(effectiveDealerId), newId);
                        if (!hash) sendInitialGreeting();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 text-xs font-semibold border border-white/15 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Start Fresh
                    </button>
                  </div>
                </div>
              </div>
            )}
            <Tabs value={activeTab} className="flex-1 min-h-0 flex flex-col">
              <TabsList className="grid w-[calc(100%-2rem)] grid-cols-1 mx-4 mt-3 gap-1 p-1 h-auto rounded-full bg-[#ECEFF1] border border-[#CFD8DC]/60">
                <TabsTrigger
                  value="chat"
                  className="flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold text-slate-600 data-[state=active]:bg-[#5D6D7E] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:bg-transparent transition-all"
                >
                  <Users className="h-3.5 w-3.5" />
                  Chat
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="chat" className="flex-1 flex flex-col mt-0 min-h-0 overflow-hidden" style={{ minHeight: 0 }}>
                <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden" style={{ minHeight: 0 }}>
                <div className="flex flex-col flex-1 min-w-0 min-h-0" style={{ minHeight: 0 }}>
                {/* Journey Tracker Display - Development Only */}
                {showJourneyTracker && !isProductionMode && (
                  <div className="border-b border-gray-200 bg-gradient-to-r from-muted to-muted">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">Journey Tracker (Dev Mode)</span>
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
                      {(daiveCurrentStage || daiveCurrentStep || daiveTotalSteps > 0) && (
                        <div className="mb-3 rounded-xl border border-[#CFD8DC] bg-white px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {daiveCurrentStage && (
                              <Badge variant="outline" className="border-[#5D6D7E]/35 text-[#5D6D7E] bg-transparent">
                                Stage: {daiveCurrentStage}
                              </Badge>
                            )}
                            {typeof daiveCurrentStep === 'number' && (
                              <Badge variant="secondary" className="bg-[#F3F6FB] text-[#2D3436] border border-[#CFD8DC]">
                                Step {daiveCurrentStep}{daiveTotalSteps > 0 ? `/${daiveTotalSteps}` : ''}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="bg-green-50 text-green-700 border border-green-200">
                              {daiveCompletedCount} completed
                            </Badge>
                          </div>

                          {daiveTotalSteps > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-full bg-[#ECEFF1] overflow-hidden border border-[#CFD8DC]/70">
                                <div
                                  className="h-full bg-[#FF6B2B]"
                                  style={{
                                    width: `${Math.min(100, Math.round((daiveCompletedCount / daiveTotalSteps) * 100))}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[11px] text-[#5D6D7E] tabular-nums">
                                {Math.min(100, Math.round((daiveCompletedCount / daiveTotalSteps) * 100))}%
                              </span>
                            </div>
                          )}

                          {daiveTotalSteps > 0 && (
                            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 -mb-1">
                              {Array.from({ length: daiveTotalSteps }, (_, i) => {
                                const stepNum = i + 1;
                                const isCompleted = stepNum <= daiveCompletedCount;
                                const isCurrent = typeof daiveCurrentStep === 'number' && stepNum === daiveCurrentStep;
                                return (
                                  <span
                                    key={stepNum}
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] border ${
                                      isCurrent
                                        ? 'bg-[#5D6D7E] text-white border-[#5D6D7E]'
                                        : isCompleted
                                          ? 'bg-green-50 text-green-700 border-green-200'
                                          : 'bg-white text-[#5D6D7E] border-[#CFD8DC]'
                                    }`}
                                    title={isCurrent ? 'Current step' : isCompleted ? 'Completed step' : 'Pending step'}
                                  >
                                    {stepNum}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      <JourneyTrackerDisplay sessionId={sessionId} />
                    </div>
                  </div>
                )}

                {hasActiveVehicleSelection && (
                  <div className="mx-2 sm:mx-4 mt-3 flex flex-col gap-2 rounded-2xl border border-[#FF6B2B]/25 bg-[#FF6B2B]/10 px-3 py-2.5 text-[#5D6D7E] shadow-sm">
                    <p className="text-xs sm:text-sm leading-snug">
                      You can <span className="font-medium text-[#5D6D7E]">cancel your selection at any time</span> and keep browsing inventory.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full border-[#5D6D7E]/30 bg-white text-[#5D6D7E] hover:bg-[#F3F6FB]"
                        disabled={isProcessing}
                        onClick={() => void handleCancelVehicleSelection()}
                      >
                        Cancel selection
                      </Button>
                    </div>
                  </div>
                )}

                {(daiveCurrentStage || typeof daiveCurrentStep === 'number' || daiveTotalSteps > 0) && (
                  <div className="mx-2 sm:mx-4 mt-3 rounded-2xl border border-[#CFD8DC] bg-white px-3 py-2 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {daiveCurrentStage && (
                        <span className="rounded-full border border-[#5D6D7E]/35 bg-white px-2 py-0.5 text-[#5D6D7E]">
                          Stage: {daiveCurrentStage}
                        </span>
                      )}
                      {typeof daiveCurrentStep === 'number' && (
                        <span className="rounded-full border border-[#CFD8DC] bg-[#F3F6FB] px-2 py-0.5 text-[#2D3436]">
                          Step {daiveCurrentStep}{daiveTotalSteps > 0 ? `/${daiveTotalSteps}` : ''}
                        </span>
                      )}
                      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-green-700">
                        {daiveCompletedCount} completed
                      </span>
                    </div>

                    {daiveTotalSteps > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-[#ECEFF1] overflow-hidden border border-[#CFD8DC]/70">
                          <div
                            className="h-full bg-[#FF6B2B]"
                            style={{
                              width: `${Math.min(100, Math.round((daiveCompletedCount / daiveTotalSteps) * 100))}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-[#5D6D7E] tabular-nums">
                          {Math.min(100, Math.round((daiveCompletedCount / daiveTotalSteps) * 100))}%
                        </span>
                      </div>
                    )}

                    {daiveTotalSteps > 0 && daiveTotalSteps <= 16 && (
                      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 -mb-1">
                        {Array.from({ length: daiveTotalSteps }, (_, i) => {
                          const stepNum = i + 1;
                          const isCompleted = stepNum <= daiveCompletedCount;
                          const isCurrent = typeof daiveCurrentStep === 'number' && stepNum === daiveCurrentStep;
                          return (
                            <span
                              key={stepNum}
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] border ${
                                isCurrent
                                  ? 'bg-[#5D6D7E] text-white border-[#5D6D7E]'
                                  : isCompleted
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-white text-[#5D6D7E] border-[#CFD8DC]'
                              }`}
                            >
                              {stepNum}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
            
            {/* Messages Area — only this element is allowed to scroll on mobile */}
            <div
              data-messages-scroll
              className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-2 sm:px-4 pb-4 bg-[#F3F6FB]"
              style={{ WebkitOverflowScrolling: 'touch', minHeight: 0 }}
              ref={scrollAreaRef}
            >
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
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-300`}
                  >
                    {message.role === 'assistant' && (
                      <div
                        className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-[#FF6B2B] flex items-center justify-center shadow-md ring-2 ring-white mb-0.5"
                        aria-hidden
                      >
                        <Car className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-white" strokeWidth={2} />
                      </div>
                    )}
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] rounded-[1.35rem] px-3 sm:px-4 py-2 sm:py-3 shadow-sm message-bubble ${
                        message.role === 'user'
                          ? 'bg-white text-[#2D3436] border border-[#CFD8DC]'
                          : 'bg-white text-gray-900 border border-[#CFD8DC]'
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
                        <div className="mt-2 text-xs text-[#5D6D7E] bg-[#F3F6FB] px-2 py-1 rounded-full border border-[#CFD8DC]">
                          🔊 Audio will be available after you start typing or click in the chat
                        </div>
                      )}
                      
                      {/* ✅ NEW: Display vehicle cards for inventory responses */}
                      {message.role === 'assistant' && showVehicleCards && currentVehicleDetails.length > 0 && index === messages.length - 1 && (
                        <div className="mt-4">
                          {/* Vehicle Cards Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3 transition-all duration-300 ease-in-out">
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
                            <div className="mt-3 px-3 py-2 bg-[#F3F6FB] rounded-2xl border border-[#CFD8DC] max-w-full overflow-hidden">
                              <div className="flex items-center justify-between gap-2 w-full max-w-full">
                              {/* Previous Button */}
                              <button
                                onClick={goToPreviousPage}
                                disabled={currentVehiclePage === 0}
                                className={`flex items-center px-3 py-2 text-sm font-medium rounded-full transition-colors ${
                                  currentVehiclePage === 0
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-[#5D6D7E] hover:text-[#FF6B2B] hover:bg-white'
                                }`}
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Previous
                              </button>
                              
                              {/* Page Indicators - Limited to show max 7 pages */}
                              <div className="flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                                <div className="flex items-center justify-center space-x-1 min-w-max px-2">
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
                                        className="w-8 h-8 rounded-full text-sm font-medium transition-colors text-gray-500 hover:text-[#FF6B2B] hover:bg-white"
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
                                            ? 'bg-[#FF6B2B] text-white'
                                            : 'text-gray-500 hover:text-[#FF6B2B] hover:bg-white'
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
                                        className="w-8 h-8 rounded-full text-sm font-medium transition-colors text-gray-500 hover:text-[#FF6B2B] hover:bg-white"
                                      >
                                        {totalPages}
                                      </button>
                                    );
                                  }
                                  
                                  return pages;
                                })()}
                                </div>
                              </div>
                              
                              {/* Next Button */}
                              <button
                                onClick={goToNextPage}
                                disabled={currentVehiclePage === getTotalPages() - 1}
                                className={`flex items-center px-3 py-2 text-sm font-medium rounded-full transition-colors ${
                                  currentVehiclePage === getTotalPages() - 1
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-[#5D6D7E] hover:text-[#FF6B2B] hover:bg-white'
                                }`}
                              >
                                Next
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </div>
                            </div>
                          )}
                          
                          {/* Vehicle Count Info */}
                          <div className="text-center text-sm text-gray-500 mt-2">
                            Showing {getCurrentPageVehicles().length} of {currentVehicleDetails.length} vehicles
                            {getTotalPages() > 1 && ` (Page ${currentVehiclePage + 1} of ${getTotalPages()})`}
                          </div>
                          
                            {/* DISABLED: Vehicle Overview Text - Separate from messages to prevent re-rendering
                          {vehicleOverviewText && (
                            <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                              <div className="flex items-start">
                                <span className="text-primary text-lg mr-2">💡</span>
                                <div>
                                  <strong className="text-primary text-sm font-semibold">Vehicle Overview:</strong>
                                  <div className="text-primary/90 text-sm mt-1 leading-relaxed">
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
                      <p
                        className={
                          message.role === 'user'
                            ? 'text-xs text-[#5D6D7E]/50 mt-1'
                            : 'text-xs text-[#5D6D7E]/55 mt-1'
                        }
                      >
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
                })}
                {/* Clean, Simple Thinking Indicator - Original Style */}
                {isProcessing && (
                  <div className="flex justify-start items-end gap-2">
                    <div
                      className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-[#FF6B2B] flex items-center justify-center shadow-md ring-2 ring-white mb-0.5"
                      aria-hidden
                    >
                      <Car className="h-4 w-4 text-white" strokeWidth={2} />
                    </div>
                    <div className="bg-white border border-[#CFD8DC] rounded-[1.35rem] px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#FF6B2B] rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-[#FF6B2B] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-[#FF6B2B] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <span className="text-sm text-[#5D6D7E] ml-2">D.A.I.V.E. is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* NEW: Crew AI Toggle Thinking Indicator */}
                {isCrewAIToggling && (
                  <div className="flex justify-start items-end gap-2">
                    <div className="w-8 h-8 shrink-0 rounded-xl bg-[#FF6B2B] flex items-center justify-center shadow-md ring-2 ring-white mb-0.5" aria-hidden>
                      <Car className="h-4 w-4 text-white" strokeWidth={2} />
                    </div>
                    <div className="bg-white border border-[#CFD8DC] rounded-[1.35rem] px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#FF6B2B] rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-[#FF6B2B] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-[#FF6B2B] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <span className="text-sm text-[#5D6D7E] ml-2 font-medium">Switching Crew AI mode…</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Crew AI Status strip hidden (mobile space saver) */}

            {/* DISABLED: Inactivity Timer Status */}
            {/* {!followUpSent && messages.length > 0 && (
              <div className="p-2 border-t border-gray-200 bg-gradient-to-r from-muted to-muted">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                    <span className="text-sm text-primary/90">Inactivity Timer Active</span>
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary/90 border-primary/20">
                      {Math.max(0, Math.ceil((30000 - (Date.now() - lastUserActivity)) / 1000))}s
                    </Badge>
                  </div>
                  <div className="text-xs text-primary">
                    Follow-up message will appear after 30s of inactivity
                  </div>
                </div>
              </div>
            )} */}

            {/* ── Daive Voice Session Widget ── */}
            {(isWebSpeechTestActive || isWebSpeechAutoListenEnabled) && (
              <div className="daive-overlay-enter mx-3 mb-2 mt-0 relative select-none">
                {/* Animated gradient border */}
                <div className={`daive-widget-border${isPlaying ? ' daive-widget-border-speaking' : ''}`} />

                {/* Card body */}
                <div
                  className="relative rounded-2xl flex items-center gap-3 px-4 py-3 overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #0f1923 0%, #111d2b 60%, #0d1a14 100%)' }}
                >
                  {/* Subtle ambient glow behind orb */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-24 pointer-events-none"
                    style={{
                      background: isPlaying
                        ? 'radial-gradient(ellipse at 20% 50%, rgba(255,107,43,0.18) 0%, transparent 70%)'
                        : isWebSpeechTestActive
                          ? 'radial-gradient(ellipse at 20% 50%, rgba(0,200,180,0.18) 0%, transparent 70%)'
                          : 'radial-gradient(ellipse at 20% 50%, rgba(90,140,255,0.18) 0%, transparent 70%)',
                    }}
                  />

                  {/* Orb */}
                  <div className="relative shrink-0 flex items-center justify-center z-10" style={{ width: 44, height: 44 }}>
                    {/* Glow halo */}
                    <div
                      className={`absolute rounded-full ${isPlaying ? 'daive-orb-speaking' : isWebSpeechTestActive ? 'daive-orb-listening' : 'daive-orb-idle'}`}
                      style={{
                        inset: -8, opacity: 0.35,
                        background: isPlaying ? 'radial-gradient(circle, rgba(255,107,43,0.8) 0%, transparent 70%)' : isWebSpeechTestActive ? 'radial-gradient(circle, rgba(0,200,180,0.8) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(90,140,255,0.8) 0%, transparent 70%)',
                      }}
                    />
                    {/* Sphere */}
                    <div
                      className={`rounded-full relative overflow-hidden shadow-lg ${isPlaying ? 'daive-orb-speaking' : isWebSpeechTestActive ? 'daive-orb-listening' : 'daive-orb-idle'}`}
                      style={{
                        width: 44, height: 44,
                        background: isPlaying
                          ? 'radial-gradient(circle at 36% 32%, #ffb07c 0%, #FF6B2B 44%, #b03010 100%)'
                          : isWebSpeechTestActive
                            ? 'radial-gradient(circle at 36% 32%, #b8f5ee 0%, #00c8b4 44%, #006b60 100%)'
                            : 'radial-gradient(circle at 36% 32%, #c4d8ff 0%, #5a8cff 44%, #1a40c0 100%)',
                      }}
                    >
                      <div className="absolute rounded-full" style={{ width: 16, height: 16, top: 6, left: 8, background: 'radial-gradient(circle, rgba(255,255,255,0.65) 0%, transparent 70%)' }} />
                    </div>
                  </div>

                  {/* Name + animated sound bars or status */}
                  <div className="flex-1 min-w-0 z-10">
                    <p className="text-white text-sm font-semibold leading-tight tracking-wide">Daive</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {/* Sound bars — visible only when actively listening or speaking */}
                      {(isWebSpeechTestActive || isPlaying) ? (
                        <div className="flex items-end gap-[3px] h-5">
                          {[
                            { cls: 'daive-bar1', color: isPlaying ? '#FF6B2B' : '#00c8b4' },
                            { cls: 'daive-bar2', color: isPlaying ? '#FF6B2B' : '#00c8b4' },
                            { cls: 'daive-bar3', color: isPlaying ? '#FF6B2B' : '#00c8b4' },
                            { cls: 'daive-bar4', color: isPlaying ? '#FF6B2B' : '#00c8b4' },
                            { cls: 'daive-bar5', color: isPlaying ? '#FF6B2B' : '#00c8b4' },
                          ].map((b, i) => (
                            <div
                              key={i}
                              className={`rounded-full w-[3px] ${b.cls}`}
                              style={{ background: b.color, minHeight: 4 }}
                            />
                          ))}
                          <span className="text-white/50 text-[11px] ml-1 leading-none self-center">
                            {isPlaying ? 'Speaking' : 'Listening'}
                          </span>
                        </div>
                      ) : (
                        <p className="text-white/45 text-xs leading-tight">
                          {isProcessing ? 'Thinking…' : 'Ready — say something'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0 z-10">
                    {/* Mic – mute / unmute (user-controlled pause, blocks auto-restart) */}
                    <button
                      onClick={() => {
                        if (isWebSpeechTestActive) {
                          // User is actively pausing — block auto-restart
                          webSpeechUserPausedRef.current = true;
                          stopWebSpeechTestOnly();
                        } else {
                          // User is manually resuming — clear the pause flag first
                          webSpeechUserPausedRef.current = false;
                          if (!isProcessing && !isPlaying) {
                            startWebSpeechTestOnly('manual');
                          }
                        }
                      }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isWebSpeechTestActive
                          ? 'bg-white/15 ring-1 ring-white/30 text-white hover:bg-white/25'
                          : 'bg-white/8 text-white/40 hover:bg-white/15 hover:text-white/70'
                      }`}
                      title={isWebSpeechTestActive ? 'Mute mic' : 'Unmute mic'}
                    >
                      {isWebSpeechTestActive ? <Mic className="h-[18px] w-[18px]" /> : <MicOff className="h-[18px] w-[18px]" />}
                    </button>

                    {/* End call */}
                    <button
                      onClick={() => {
                        webSpeechUserPausedRef.current = false; // reset so next session starts clean
                        stopWebSpeechTestOnly();
                        setIsWebSpeechAutoListenEnabled(false);
                        localStorage.setItem('daive_webspeech_autolisten', 'false');
                      }}
                      className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center text-white shadow-md shadow-red-900/40 transition-all duration-200"
                      title="End call"
                    >
                      <Phone className="h-[18px] w-[18px] rotate-[135deg]" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Input Area — pill bar (reference: Beauty Insider style) */}
            <div className="relative p-3 sm:p-4 border-t border-[#CFD8DC] bg-white shrink-0 z-10">
              {/* ── Resume-prompt overlay — blocks input until user picks Continue or Start Fresh ── */}
              {resumePromptData && (
                <div className="absolute inset-0 z-20 flex items-center justify-center gap-3 px-4 rounded-b-3xl"
                  style={{ background: 'rgba(13,25,35,0.55)', backdropFilter: 'blur(4px)' }}>
                  <span className="text-white/80 text-sm font-medium text-center">
                    Choose <strong className="text-white">Continue Previous</strong> or <strong className="text-white">Start Fresh</strong> above to begin
                  </span>
                </div>
              )}

              {/* ── Voice-active overlay — blocks the text box while voice session is on ── */}
              {(isWebSpeechTestActive || isWebSpeechAutoListenEnabled) && (
                <div className="daive-overlay-enter absolute inset-0 z-20 flex items-center justify-between gap-3 px-4 rounded-b-3xl"
                  style={{ background: 'linear-gradient(135deg, rgba(13,25,35,0.82) 0%, rgba(0,200,180,0.12) 100%)', backdropFilter: 'blur(6px)' }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Pulsing mic dot */}
                    <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${isPlaying ? 'bg-[#FF6B2B]' : 'bg-[#00c8b4]'} animate-pulse`} />
                    <span className="text-white/80 text-sm font-medium truncate">
                      {isPlaying ? 'Daive is speaking…' : isProcessing ? 'Daive is thinking…' : 'Listening — say something or cancel to type'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      webSpeechUserPausedRef.current = false;
                      webSpeechNoSpeechCountRef.current = 0;
                      stopWebSpeechTestOnly();
                      setIsWebSpeechAutoListenEnabled(false);
                      localStorage.setItem('daive_webspeech_autolisten', 'false');
                    }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel voice
                  </button>
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full border border-[#CFD8DC] bg-[#ECEFF1] text-[#5D6D7E] hover:bg-[#CFD8DC]/80 hover:text-[#4d5a68]"
                  disabled={!!resumePromptData || isProcessing}
                  aria-label="More actions"
                  onClick={() => {
                    const inputEl = document.querySelector('input[placeholder="Send message"]') as HTMLInputElement | null;
                    inputEl?.focus();
                  }}
                >
                  <Plus className="h-5 w-5" />
                </Button>
                <div className="flex-1 relative flex items-center rounded-full border border-[#CFD8DC] bg-white pl-4 pr-1.5 py-1 shadow-sm focus-within:ring-2 focus-within:ring-[#FF6B2B]/30 focus-within:border-[#FF6B2B]/40">
                  <input
                    ref={chatInputRef}
                    value={inputMessage}
                    onChange={(e) => {
                      setInputMessage(e.target.value);
                      if (e.target.value.length > 0) {
                        pauseAudioForUserInteraction();
                        if (shouldPlayGreetingOnInteraction && !greetingAudioPlayed) {
                          setShouldPlayGreetingOnInteraction(false);
                          const greetingMessage = messages.find(msg => msg.role === 'assistant');
                          if (greetingMessage) {
                            playGreetingAudio(greetingMessage.content);
                          }
                        }
                      }
                    }}
                    onFocus={() => {
                      pauseAudioForUserInteraction();
                      if (shouldPlayGreetingOnInteraction && !greetingAudioPlayed) {
                        setShouldPlayGreetingOnInteraction(false);
                        const greetingMessage = messages.find(msg => msg.role === 'assistant');
                        if (greetingMessage) {
                          playGreetingAudio(greetingMessage.content);
                        }
                      }
                    }}
                    onBlur={() => {
                      const vv = window.visualViewport;
                      setVvState({
                        offsetTop: 0,
                        height: vv?.height ?? window.innerHeight,
                      });
                    }}
                    placeholder={resumePromptData ? 'Choose an option above to begin…' : isProcessing ? 'Processing…' : 'Send message'}
                    disabled={!!resumePromptData || isProcessing}
                    className={`w-full min-w-0 bg-transparent border-0 py-2.5 pr-2 text-[#2D3436] placeholder:text-[#5D6D7E]/50 focus:outline-none focus:ring-0 ${
                      isProcessing ? 'opacity-80' : ''
                    }`}
                  />
                  {isProcessing ? (
                    <div className="flex h-9 w-9 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-[#FF6B2B]" />
                    </div>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!!resumePromptData || !inputMessage.trim()}
                      className="h-9 w-9 shrink-0 rounded-full bg-transparent text-[#5D6D7E]/60 hover:text-[#FF6B2B] hover:bg-[#FF632B]/10 shadow-none"
                      aria-label="Send message"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center sm:justify-start w-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newValue = !autoplayEnabled;
                      setAutoplayEnabled(newValue);
                      localStorage.setItem('daive_autoplay_enabled', newValue.toString());
                    }}
                    className={`h-10 w-10 rounded-full border-[#CFD8DC] ${
                      autoplayEnabled ? 'bg-[#FF6B2B]/15 text-[#FF6B2B] border-[#FF6B2B]/30' : 'bg-[#F3F6FB] text-[#5D6D7E]'
                    }`}
                    disabled={isProcessing}
                    title={autoplayEnabled ? 'Disable Autoplay' : 'Enable Autoplay'}
                  >
                    {autoplayEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
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
                      className="text-primary border-primary/20 hover:bg-primary/10"
                    >
                      <Database className="h-4 w-4" />
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
                        className="text-primary border-border hover:bg-primary/10"
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
                        className="h-6 w-6 text-xs bg-primary/10 border-primary/20 hover:bg-primary/15"
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
                        className="h-6 w-6 text-xs bg-primary/10 border-primary/20 hover:bg-primary/15"
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
                  
                  {/* Talk to Daive – opens the full-screen call overlay */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      onClick={handleWebSpeechTestButton}
                      disabled={!isWebSpeechTestActive && (isProcessing || isPlaying)}
                      variant="outline"
                      className={`relative h-10 rounded-full px-4 flex items-center gap-2 transition-all duration-200 shadow-sm font-medium text-sm ${
                        isWebSpeechTestActive || isWebSpeechAutoListenEnabled
                          ? 'bg-[#5a8cff] hover:bg-[#4a7cf0] text-white border-[#5a8cff] shadow-md'
                          : 'bg-white text-[#2D3436] border-[#CFD8DC] hover:bg-[#F3F6FB]'
                      }`}
                      title={isWebSpeechTestActive ? 'End session' : 'Talk to Daive'}
                      aria-label={isWebSpeechTestActive ? 'End session' : 'Talk to Daive'}
                    >
                      {/* Small orb indicator */}
                      <span
                        className={`inline-block w-3.5 h-3.5 rounded-full shrink-0 ${
                          isPlaying
                            ? 'bg-[#FF6B2B] animate-pulse'
                            : isWebSpeechTestActive
                              ? 'bg-[#00c8b4] animate-pulse'
                              : 'bg-[#5a8cff]'
                        }`}
                        style={{ boxShadow: isWebSpeechTestActive || isPlaying ? '0 0 6px 2px currentColor' : undefined }}
                      />
                      <span>
                        {isWebSpeechTestActive || isWebSpeechAutoListenEnabled ? 'Voice is On' : 'Talk to Daive'}
                      </span>
                    </Button>
                  </div>
                </div>
              </form>
            </div>
                </div>

                <aside
                  className="hidden lg:flex w-full shrink-0 flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-[#5D6D7E]/18 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.07)] lg:shadow-none lg:w-[min(100%,380px)] xl:w-[400px] relative"
                  aria-label="Inventory and filters"
                >
                  {resumePromptData && (
                    <div className="absolute inset-0 z-10 rounded-r-3xl" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(3px)', pointerEvents: 'all' }} />
                  )}
                  <div className="px-3 py-2.5 border-b border-[#CFD8DC] bg-white">
                    <div className="flex items-center gap-2 text-[#5D6D7E] font-semibold text-sm">
                      <Sparkles className="w-4 h-4 text-[#FF6B2B]" />
                      Browse & refine
                    </div>
                    <p className="text-xs text-[#5D6D7E]/75 mt-0.5 leading-snug">
                      Filters apply to the latest inventory shown in chat. “Ask” sends a normal message—same API as typing.
                    </p>
                  </div>

                  <ScrollArea className="h-[min(52vh,480px)] min-h-[160px] lg:h-auto lg:min-h-[200px] lg:flex-1 lg:max-h-none">
                    <div className="p-3 space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-medium text-slate-600 mb-1.5">
                          <span>Budget (max)</span>
                          <span className="text-slate-900">${inventoryBudgetMax.toLocaleString()}</span>
                        </div>
                        <Slider
                          min={5000}
                          max={100000}
                          step={1000}
                          value={[inventoryBudgetMax]}
                          onValueChange={(v) => setInventoryBudgetMax(v[0] ?? 50000)}
                          className="py-1 [&_.bg-primary]:bg-[#FF6B2B] [&_.border-primary]:border-[#FF6B2B]"
                        />
                      </div>

                      <div>
                        <p className="text-xs font-medium text-[#5D6D7E] mb-1.5">Body type</p>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 sm:mb-0 sm:pb-0 sm:gap-1.5 sm:flex-wrap">
                          {['', 'SUV', 'Sedan', 'Hatchback', 'Truck'].map((t) => (
                            <Button
                              key={t || 'all'}
                              type="button"
                              size="sm"
                              variant="secondary"
                              className={`h-8 shrink-0 justify-center rounded-full px-3 text-xs font-medium border-0 transition-colors ${
                                inventoryTypeFilter === t
                                  ? 'bg-[#FF6B2B] text-white hover:bg-[#e85f24] shadow-sm'
                                  : 'bg-white text-[#2D3436] hover:bg-[#CFD8DC] shadow-sm border border-[#CFD8DC]'
                              }`}
                              onClick={() => setInventoryTypeFilter(t)}
                              disabled={!!resumePromptData}
                            >
                              {t || 'All'}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-[#5D6D7E] mb-1.5">Condition</p>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 sm:mb-0 sm:pb-0 sm:gap-1.5 sm:flex-wrap">
                          {(['', 'new', 'used'] as const).map((c) => (
                            <Button
                              key={c || 'all-c'}
                              type="button"
                              size="sm"
                              variant="secondary"
                              className={`h-8 shrink-0 justify-center rounded-full px-3 text-xs font-medium border-0 transition-colors ${
                                inventoryConditionFilter === c
                                  ? 'bg-[#FF6B2B] text-white hover:bg-[#e85f24] shadow-sm'
                                  : 'bg-white text-[#2D3436] hover:bg-[#CFD8DC] shadow-sm border border-[#CFD8DC]'
                              }`}
                              onClick={() => setInventoryConditionFilter(c)}
                              disabled={!!resumePromptData}
                            >
                              {!c ? 'All' : c === 'new' ? 'New' : 'Used'}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <p className="text-xs font-medium text-[#5D6D7E]">Features</p>
                          <p className="text-[9px] text-[#5D6D7E]/50 italic">pick any within a group</p>
                        </div>
                        {[
                          { group: 'Fuel Type',   hint: 'OR',  items: ['Hybrid', 'Electric', 'Fuel-efficient'] },
                          { group: 'Drivetrain',  hint: 'OR',  items: ['AWD'] },
                          { group: 'Technology',  hint: 'OR',  items: ['Apple CarPlay', 'Navigation', 'Bluetooth'] },
                          { group: 'Safety',      hint: 'OR',  items: ['Backup Camera', 'Blind Spot'] },
                          { group: 'Comfort',     hint: 'OR',  items: ['Sunroof', 'Leather Seats', 'Heated Seats'] },
                          { group: 'Seating',     hint: 'OR',  items: ['7-Seater'] },
                        ].map(({ group, items }) => (
                          <div key={group} className="mb-2">
                            <p className="text-[10px] font-medium text-[#5D6D7E]/60 mb-1 uppercase tracking-wide">{group}</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {items.map((feat) => {
                                const val = feat.toLowerCase();
                                const active = inventoryFeatureFilters.includes(val);
                                return (
                                  <Button
                                    key={feat}
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className={`h-7 shrink-0 justify-center rounded-full px-2.5 text-[11px] font-medium border-0 transition-colors ${
                                      active
                                        ? 'bg-[#FF6B2B] text-white hover:bg-[#e85f24] shadow-sm'
                                        : 'bg-white text-[#2D3436] hover:bg-[#CFD8DC] shadow-sm border border-[#CFD8DC]'
                                    }`}
                                    onClick={() => toggleFeatureFilter(val)}
                                    disabled={!!resumePromptData}
                                  >
                                    {feat}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {inventoryFeatureFilters.length > 0 && (
                          <button
                            type="button"
                            className="text-[10px] text-[#5D6D7E]/70 underline mt-0.5"
                            onClick={() => setInventoryFeatureFilters([])}
                          >
                            Clear features
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="w-full rounded-full bg-[#5D6D7E] hover:bg-[#4d5a68] text-white h-10 text-sm font-medium shadow-sm"
                          disabled={!!resumePromptData || isProcessing}
                          onClick={() => void sendInventoryFilterPrompt()}
                        >
                          Ask with these filters
                        </Button>

                      </div>
                    </div>
                  </ScrollArea>
                </aside>
                </div>
              </TabsContent>
              
              {/* Debug tab hidden */}
            </Tabs>
          </CardContent>
        </Card>

        {/* Mobile filters: floating button + modal */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsFiltersModalOpen(true)}
          disabled={!!resumePromptData}
          className="lg:hidden fixed bottom-4 right-4 z-40 h-11 w-11 rounded-full border-[#CFD8DC] bg-white shadow-lg"
          aria-label="Open filters"
        >
          <Sparkles className="h-5 w-5 text-[#FF6B2B]" />
        </Button>

        {isFiltersModalOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setIsFiltersModalOpen(false)}
            role="presentation"
          >
            <div
              className="absolute left-2 right-2 bottom-0 flex flex-col h-[90vh] rounded-t-3xl bg-white shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
            >
              {/* ── Header ── */}
              <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#CFD8DC] shrink-0">
                <div>
                  <div className="flex items-center gap-2 text-[#5D6D7E] font-semibold">
                    <Sparkles className="h-4 w-4 text-[#FF6B2B]" />
                    Browse & refine
                  </div>
                  <p className="text-xs text-[#5D6D7E]/75 mt-0.5 leading-snug">
                    Filters apply to the latest inventory shown in chat.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-[#5D6D7E] shrink-0"
                  onClick={() => setIsFiltersModalOpen(false)}
                  aria-label="Close filters"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* ── Scrollable filter options ── */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="px-4 pt-3 pb-2 space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                      <span>Budget (max)</span>
                      <span className="text-slate-900">${inventoryBudgetMax.toLocaleString()}</span>
                    </div>
                    <Slider
                      min={5000}
                      max={100000}
                      step={1000}
                      value={[inventoryBudgetMax]}
                      onValueChange={(v) => setInventoryBudgetMax(v[0] ?? 50000)}
                      className="py-1 [&_.bg-primary]:bg-[#FF6B2B] [&_.border-primary]:border-[#FF6B2B]"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#5D6D7E] mb-1.5 uppercase tracking-wide">Body type</p>
                    <div className="flex gap-2 flex-wrap">
                      {['', 'SUV', 'Sedan', 'Hatchback', 'Truck'].map((t) => (
                        <Button
                          key={t || 'all'}
                          type="button"
                          size="sm"
                          variant="secondary"
                          className={`h-9 shrink-0 justify-center rounded-full px-4 text-sm font-medium border-0 transition-colors ${
                            inventoryTypeFilter === t
                              ? 'bg-[#FF6B2B] text-white hover:bg-[#e85f24] shadow-sm'
                              : 'bg-white text-[#2D3436] hover:bg-[#CFD8DC] shadow-sm border border-[#CFD8DC]'
                          }`}
                          onClick={() => setInventoryTypeFilter(t)}
                          disabled={!!resumePromptData}
                        >
                          {t || 'All'}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#5D6D7E] mb-1.5 uppercase tracking-wide">Condition</p>
                    <div className="flex gap-2 flex-wrap">
                      {(['', 'new', 'used'] as const).map((c) => (
                        <Button
                          key={c || 'all-c'}
                          type="button"
                          size="sm"
                          variant="secondary"
                          className={`h-9 shrink-0 justify-center rounded-full px-4 text-sm font-medium border-0 transition-colors ${
                            inventoryConditionFilter === c
                              ? 'bg-[#FF6B2B] text-white hover:bg-[#e85f24] shadow-sm'
                              : 'bg-white text-[#2D3436] hover:bg-[#CFD8DC] shadow-sm border border-[#CFD8DC]'
                          }`}
                          onClick={() => setInventoryConditionFilter(c)}
                          disabled={!!resumePromptData}
                        >
                          {!c ? 'All' : c === 'new' ? 'New' : 'Used'}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-[#5D6D7E] uppercase tracking-wide">Features</p>
                      <p className="text-[10px] text-[#5D6D7E]/50 italic">pick any within a group</p>
                    </div>
                    {[
                      { group: 'Fuel Type',   items: ['Hybrid', 'Electric', 'Fuel-efficient'] },
                      { group: 'Drivetrain',  items: ['AWD'] },
                      { group: 'Technology',  items: ['Apple CarPlay', 'Navigation', 'Bluetooth'] },
                      { group: 'Safety',      items: ['Backup Camera', 'Blind Spot'] },
                      { group: 'Comfort',     items: ['Sunroof', 'Leather Seats', 'Heated Seats'] },
                      { group: 'Seating',     items: ['7-Seater'] },
                    ].map(({ group, items }) => (
                      <div key={group} className="mb-2">
                        <p className="text-[10px] font-semibold text-[#5D6D7E]/50 mb-1 uppercase tracking-wide">{group}</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {items.map((feat) => {
                            const val = feat.toLowerCase();
                            const active = inventoryFeatureFilters.includes(val);
                            return (
                              <Button
                                key={feat}
                                type="button"
                                size="sm"
                                variant="secondary"
                                className={`h-8 shrink-0 justify-center rounded-full px-3 text-xs font-medium border-0 transition-colors ${
                                  active
                                    ? 'bg-[#FF6B2B] text-white hover:bg-[#e85f24] shadow-sm'
                                    : 'bg-white text-[#2D3436] hover:bg-[#CFD8DC] shadow-sm border border-[#CFD8DC]'
                                }`}
                                onClick={() => toggleFeatureFilter(val)}
                                disabled={!!resumePromptData}
                              >
                                {feat}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {inventoryFeatureFilters.length > 0 && (
                      <button
                        type="button"
                        className="text-[10px] text-[#5D6D7E]/70 underline mt-0.5"
                        onClick={() => setInventoryFeatureFilters([])}
                      >
                        Clear features
                      </button>
                    )}
                  </div>

                </div>
              </div>

              {/* ── Sticky footer — always visible ── */}
              <div className="shrink-0 px-4 py-2.5 border-t border-[#CFD8DC] bg-white flex gap-2" style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-full h-10 text-sm border-[#CFD8DC] text-[#5D6D7E]"
                  onClick={() => setIsFiltersModalOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-[2] rounded-full bg-[#FF6B2B] hover:bg-[#e85f20] text-white h-10 text-sm font-semibold shadow-sm"
                  disabled={!!resumePromptData || isProcessing}
                  onClick={() => { void sendInventoryFilterPrompt(); setIsFiltersModalOpen(false); }}
                >
                  Apply filters
                </Button>
              </div>
            </div>
          </div>
        )}

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
                          index === currentImageIndex ? 'border-primary' : 'border-gray-300'
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

      {/* Voice Panel - Continuous Mode */}
      <VoicePanel />

      {/* ✅ CarFax Modal */}
      <CarfaxModal />
    </div>
  );
};

export default AIBotPage; 
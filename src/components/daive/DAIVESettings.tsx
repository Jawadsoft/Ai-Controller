import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Settings, 
  MessageSquare, 
  Mic, 
  Users, 
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Key,
  Zap,
  Eye,
  EyeOff,
  TestTube,
  Trash2,
  Upload,
  Download,
  Brain
} from 'lucide-react';
import { toast } from 'sonner';
import { extractDealerIdFromToken } from '../../utils/authUtils';

interface PromptSettings {
  greeting: string;
  vehicle_info: string;
  financing: string;
  test_drive: string;
  handoff: string;
  master_prompt: string;
  style_guidelines: string;
  sales_methodology: string;
  facts_integrity: string;
  voice_behavior: string;
  refusal_handling: string;
  // New AI bot specific prompts
  inventory_greeting: string;
  family_vehicle_prompt: string;
  similar_vehicles_prompt: string;
  new_arrivals_prompt: string;
  suv_selection_prompt: string;
  sedan_selection_prompt: string;
  budget_inquiry_prompt: string;
  financing_calculation_prompt: string;
}

interface VoiceSettings {
  enabled: boolean;
  language: string;
  voiceSpeed: number;
  voicePitch: number;
  voiceProvider: string;
  speechProvider: string;
  ttsProvider: string;
  openaiVoice?: string;
  elevenLabsVoice?: string;
  // New AI bot voice settings
  autoVoiceResponse: boolean;
  voiceQuality: 'standard' | 'hd' | 'ultra';
  voiceEmotion: 'neutral' | 'friendly' | 'professional' | 'enthusiastic';
  recordingQuality: 'low' | 'medium' | 'high';
}

interface LeadSettings {
  autoQualification: boolean;
  minScoreForLead: number;
  autoHandoffScore: number;
  notificationEmail: string;
  // New AI bot lead settings
  conversationTracking: boolean;
  interestDetection: boolean;
  autoFollowUp: boolean;
  followUpDelay: number; // hours
}

interface ApiSettings {
  openai_key: string;
  elevenlabs_key: string;
  azure_speech_key: string;
  deepgram_key: string;
  voice_provider: string;
  dealer_id: string;
}

// New interface for AI bot behavior
interface AIBotBehavior {
  enableQuickActions: boolean;
  showInventorySuggestions: boolean;
  enableVoiceInput: boolean;
  enableVoiceOutput: boolean;
  autoGreeting: boolean;
  conversationMemory: number; // number of messages to remember
  responseLength: 'short' | 'medium' | 'long';
  personality: 'professional' | 'friendly' | 'enthusiastic' | 'casual';
  enableLeadScoring: boolean;
  enableHandoff: boolean;
  maxConversationLength: number;
  enableAnalytics: boolean;
}

// New interface for Crew AI settings
interface CrewAISettings {
  enabled: boolean;
  autoRouting: boolean;
  enableSalesCrew: boolean;
  enableCustomerServiceCrew: boolean;
  enableInventoryCrew: boolean;
  crewCollaboration: boolean;
  agentMemory: boolean;
  performanceTracking: boolean;
  fallbackToTraditional: boolean;
  crewSelection: 'auto' | 'manual' | 'hybrid';
  maxTokens: number; // Control response length
}

const DAIVESettings: React.FC = () => {
  const [prompts, setPrompts] = useState<PromptSettings>({
    greeting: '',
    vehicle_info: '',
    financing: '',
    test_drive: '',
    handoff: '',
    master_prompt: '',
    style_guidelines: '',
    sales_methodology: '',
    facts_integrity: '',
    voice_behavior: '',
    refusal_handling: '',
    // New AI bot specific prompts
    inventory_greeting: '',
    family_vehicle_prompt: '',
    similar_vehicles_prompt: '',
    new_arrivals_prompt: '',
    suv_selection_prompt: '',
    sedan_selection_prompt: '',
    budget_inquiry_prompt: '',
    financing_calculation_prompt: ''
  });
  
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true, // Enable voice by default
    language: 'en-US',
    voiceSpeed: 1.0,
    voicePitch: 1.0,
    voiceProvider: 'openai', // Change to OpenAI TTS for better reliability
    speechProvider: 'whisper',
    ttsProvider: 'openai', // Use OpenAI TTS as default
    openaiVoice: 'alloy',
    elevenLabsVoice: 'jessica',
    // New AI bot voice settings
    autoVoiceResponse: true, // Enable auto voice response
    voiceQuality: 'hd',
    voiceEmotion: 'friendly',
    recordingQuality: 'high'
  });
  
  const [leadSettings, setLeadSettings] = useState<LeadSettings>({
    autoQualification: true,
    minScoreForLead: 50,
    autoHandoffScore: 80,
    notificationEmail: '',
    // New AI bot lead settings
    conversationTracking: true,
    interestDetection: true,
    autoFollowUp: false,
    followUpDelay: 24
  });

  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    openai_key: '',
    elevenlabs_key: '',
    azure_speech_key: '',
    deepgram_key: '',
    voice_provider: 'elevenlabs',
    dealer_id: ''
  });

  // New AI bot behavior state
  const [aiBotBehavior, setAiBotBehavior] = useState<AIBotBehavior>({
    enableQuickActions: true,
    showInventorySuggestions: true,
    enableVoiceInput: true,
    enableVoiceOutput: true,
    autoGreeting: false, // Disabled to prevent repetitive greetings
    conversationMemory: 10,
    responseLength: 'medium',
    personality: 'friendly',
    enableLeadScoring: true,
    enableHandoff: true,
    maxConversationLength: 50,
    enableAnalytics: true
  });

  // New Crew AI settings state
  const [crewAISettings, setCrewAISettings] = useState<CrewAISettings>({
    enabled: false, // Start disabled for safety
    autoRouting: true,
    enableSalesCrew: true,
    enableCustomerServiceCrew: true,
    enableInventoryCrew: false,
    crewCollaboration: true,
    agentMemory: true,
    performanceTracking: true,
    fallbackToTraditional: true,
    crewSelection: 'auto',
    maxTokens: 100 // Default maxTokens
  });

  const [showApiKeys, setShowApiKeys] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingApi, setTestingApi] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Fetch prompts
      const promptsResponse = await fetch('http://localhost:3000/api/daive/prompts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const promptsData = await promptsResponse.json();
      console.log('🔍 Prompts Response:', promptsData);
      
      if (promptsData.success) {
        const promptData = promptsData.data;
        console.log('🔍 Prompt Data from DB:', promptData);
        
        const updatedPrompts = {
          greeting: promptData.greeting?.text || '',
          vehicle_info: promptData.vehicle_info?.text || '',
          financing: promptData.financing?.text || '',
          test_drive: promptData.test_drive?.text || '',
          handoff: promptData.handoff?.text || '',
          master_prompt: promptData.master_prompt?.text || '',
          style_guidelines: promptData.style_guidelines?.text || '',
          sales_methodology: promptData.sales_methodology?.text || '',
          facts_integrity: promptData.facts_integrity?.text || '',
          voice_behavior: promptData.voice_behavior?.text || '',
          refusal_handling: promptData.refusal_handling?.text || '',
          // New AI bot specific prompts
          inventory_greeting: promptData.inventory_greeting?.text || '',
          family_vehicle_prompt: promptData.family_vehicle_prompt?.text || '',
          similar_vehicles_prompt: promptData.similar_vehicles_prompt?.text || '',
          new_arrivals_prompt: promptData.new_arrivals_prompt?.text || '',
          suv_selection_prompt: promptData.suv_selection_prompt?.text || '',
          sedan_selection_prompt: promptData.sedan_selection_prompt?.text || '',
          budget_inquiry_prompt: promptData.budget_inquiry_prompt?.text || '',
          financing_calculation_prompt: promptData.financing_calculation_prompt?.text || ''
        };
        
        console.log('🔍 Setting prompts state:', updatedPrompts);
        setPrompts(updatedPrompts);
      } else {
        console.log('❌ Failed to load prompts:', promptsData);
      }

      // Fetch API settings
      const apiResponse = await fetch('http://localhost:3000/api/daive/api-settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const apiData = await apiResponse.json();
      if (apiData.success) {
        const settings = apiData.data;
        setApiSettings({
          openai_key: settings.openai_key?.value || '',
          elevenlabs_key: settings.elevenlabs_key?.value || '',
          azure_speech_key: settings.azure_speech_key?.value || '',
          deepgram_key: settings.deepgram_key?.value || '',
          voice_provider: settings.voice_provider?.value || 'elevenlabs',
          dealer_id: settings.dealer_id?.value || ''
        });
      }

      // Fetch voice settings
      const voiceResponse = await fetch('http://localhost:3000/api/daive/voice-settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const voiceData = await voiceResponse.json();
      console.log('🔍 Voice Settings Response:', voiceData);
      
      if (voiceData.success) {
        const voiceSettingsData = voiceData.data;
        console.log('📊 Voice Settings Data from DB:', voiceSettingsData);
        
        setVoiceSettings({
          enabled: voiceSettingsData.enabled || false,
          language: voiceSettingsData.language || 'en-US',
          voiceSpeed: voiceSettingsData.voiceSpeed || 1.0,
          voicePitch: voiceSettingsData.voicePitch || 1.0,
          voiceProvider: voiceSettingsData.voiceProvider || 'elevenlabs',
          speechProvider: voiceSettingsData.speechProvider || 'whisper',
          ttsProvider: voiceSettingsData.ttsProvider || 'elevenlabs',
          openaiVoice: voiceSettingsData.openaiVoice || 'alloy',
          elevenLabsVoice: voiceSettingsData.elevenLabsVoice || 'jessica',
          // New AI bot voice settings
          autoVoiceResponse: voiceSettingsData.autoVoiceResponse || false,
          voiceQuality: voiceSettingsData.voiceQuality || 'hd',
          voiceEmotion: voiceSettingsData.voiceEmotion || 'friendly',
          recordingQuality: voiceSettingsData.recordingQuality || 'high'
        });
        
        console.log('✅ Voice Settings Updated:', {
          enabled: voiceSettingsData.enabled || false,
          ttsProvider: voiceSettingsData.ttsProvider || 'elevenlabs',
          openaiVoice: voiceSettingsData.openaiVoice || 'alloy',
          autoVoiceResponse: voiceSettingsData.autoVoiceResponse || false
        });
      } else {
        console.log('❌ Voice Settings Failed to Load:', voiceData);
      }
      
      // Fetch Crew AI settings
      let dealerId = apiSettings.dealer_id;
      if (!dealerId) {
        dealerId = extractDealerIdFromToken();
      }
      
      if (!dealerId) {
        console.warn('⚠️ No dealer ID available for Crew AI settings');
        return; // Skip Crew AI settings if no dealer ID
      }
      
      const crewAIResponse = await fetch(`http://localhost:3000/api/daive/crew-ai-settings?dealerId=${dealerId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      const crewAIData = await crewAIResponse.json();
      if (crewAIData.success) {
        console.log('✅ Crew AI Settings Loaded:', crewAIData.data);
        setCrewAISettings(crewAIData.data);
      } else {
        console.log('❌ Crew AI Settings Failed to Load:', crewAIData);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const savePrompts = async () => {
    setSaving(true);
    try {
      console.log('💾 Starting to save prompts...');
      const promptTypes = [
        'greeting', 'vehicle_info', 'financing', 'test_drive', 'handoff', 
        'master_prompt', 'style_guidelines', 'sales_methodology', 'facts_integrity', 
        'voice_behavior', 'refusal_handling',
        // New AI bot specific prompts
        'inventory_greeting', 'family_vehicle_prompt', 'similar_vehicles_prompt',
        'new_arrivals_prompt', 'suv_selection_prompt', 'sedan_selection_prompt',
        'budget_inquiry_prompt', 'financing_calculation_prompt'
      ];
      
      let savedCount = 0;
      console.log('🔍 Current prompts state:', prompts);
      console.log('🔍 Prompt types to save:', promptTypes);
      
      for (const promptType of promptTypes) {
        // Save all prompts, even empty ones, to ensure they get updated
        const promptText = prompts[promptType as keyof PromptSettings];
        console.log(`💾 Processing ${promptType}:`, {
          promptType,
          promptText,
          exists: promptText !== undefined,
          type: typeof promptText
        });
        
        // Ensure we have a valid promptType and promptText
        if (!promptType) {
          console.error(`❌ Invalid promptType: ${promptType}`);
          continue;
        }
        
        const response = await fetch('http://localhost:3000/api/daive/prompts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            promptType,
            promptText: promptText || ''
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error(`❌ Failed to save ${promptType}:`, errorData);
          throw new Error(`Failed to save ${promptType}: ${errorData.error || response.statusText}`);
        }
        
        const result = await response.json();
        if (result.success) {
          savedCount++;
          console.log(`✅ Saved ${promptType} successfully`);
        } else {
          console.error(`❌ Failed to save ${promptType}:`, result);
        }
      }
      
      console.log(`🎉 Successfully saved ${savedCount} prompts`);
      toast.success(`Prompts saved successfully (${savedCount} updated)`);
      
      // Refresh the prompts to show the updated values
      await fetchSettings();
      
    } catch (error) {
      console.error('Error saving prompts:', error);
      toast.error(`Failed to save prompts: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveApiSettings = async () => {
    setSaving(true);
    try {
      const apiTypes = ['openai_key', 'elevenlabs_key', 'azure_speech_key', 'deepgram_key', 'voice_provider'];
      
      for (const apiType of apiTypes) {
        if (apiSettings[apiType as keyof ApiSettings]) {
          await fetch('http://localhost:3000/api/daive/api-settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({
              settingType: apiType,
              settingValue: apiSettings[apiType as keyof ApiSettings]
            })
          });
        }
      }
      
      toast.success('API settings saved successfully');
    } catch (error) {
      console.error('Error saving API settings:', error);
      toast.error('Failed to save API settings');
    } finally {
      setSaving(false);
    }
  };

  const saveVoiceSettings = async () => {
    setSaving(true);
    try {
      const voiceSettingsToSave = {
        enabled: voiceSettings.enabled,
        language: voiceSettings.language,
        voiceSpeed: voiceSettings.voiceSpeed,
        voicePitch: voiceSettings.voicePitch,
        voiceProvider: voiceSettings.voiceProvider,
        speechProvider: voiceSettings.speechProvider,
        ttsProvider: voiceSettings.ttsProvider,
        openaiVoice: voiceSettings.openaiVoice,
        // New AI bot voice settings
        autoVoiceResponse: voiceSettings.autoVoiceResponse,
        voiceQuality: voiceSettings.voiceQuality,
        voiceEmotion: voiceSettings.voiceEmotion,
        recordingQuality: voiceSettings.recordingQuality
      };
      
      console.log('💾 Saving Voice Settings:', voiceSettingsToSave);
      
      // Save all voice settings in a single request
      const response = await fetch('http://localhost:3000/api/daive/voice-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(voiceSettingsToSave)
      });
      
      const result = await response.json();
      console.log('💾 Voice Settings Save Response:', result);
      
      if (result.success) {
        toast.success('Voice settings saved successfully');
        console.log('✅ Voice settings saved to database');
      } else {
        toast.error('Failed to save voice settings');
        console.log('❌ Voice settings save failed:', result);
      }
    } catch (error) {
      console.error('Error saving voice settings:', error);
      toast.error('Failed to save voice settings');
    } finally {
      setSaving(false);
    }
  };

  const saveAIBotSettings = async () => {
    setSaving(true);
    try {
      // Save AI bot behavior settings
      await fetch('http://localhost:3000/api/daive/ai-bot-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          behavior: aiBotBehavior,
          leadSettings: leadSettings
        })
      });
      
      toast.success('AI Bot settings saved successfully');
    } catch (error) {
      console.error('Error saving AI Bot settings:', error);
      toast.error('Failed to save AI Bot settings');
    } finally {
      setSaving(false);
    }
  };

  const saveCrewAISettings = async () => {
    setSaving(true);
    try {
      // Get dealer ID from API settings or try to get it from the current user context
      let dealerId = apiSettings.dealer_id;
      
      // If no dealer ID in API settings, try to get it from the current user's token
      if (!dealerId) {
        dealerId = extractDealerIdFromToken();
      }
      
      // If still no dealer ID, we can't proceed
      if (!dealerId) {
        console.error('❌ No dealer ID available for saving Crew AI settings');
        toast.error('Cannot save Crew AI settings: No dealer ID available');
        toast.error('Please ensure you are logged in with a dealer account');
        return;
      }
      
      console.log('💾 Saving Crew AI settings for dealer:', dealerId);
      console.log('💾 Crew AI settings data:', crewAISettings);
      
      // Save Crew AI settings - send data directly in request body, not nested
      const response = await fetch('http://localhost:3000/api/daive/crew-ai-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          dealerId,
          ...crewAISettings // Spread the settings directly, not nested
        })
      });
      
      if (response.ok) {
        toast.success('Crew AI settings saved successfully');
        // Refresh the settings to show the updated values
        await fetchSettings();
      } else {
        const errorData = await response.json();
        console.error('❌ Backend error response:', errorData);
        toast.error(`Failed to save Crew AI settings: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving Crew AI settings:', error);
      toast.error('Failed to save Crew AI settings');
    } finally {
      setSaving(false);
    }
  };

  const testApiConnection = async (apiType: string) => {
    setTestingApi(apiType);
    try {
      const response = await fetch('http://localhost:3000/api/daive/test-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ apiType })
      });

      const data = await response.json();
      if (data.success && data.data.success) {
        toast.success(data.data.message);
      } else {
        toast.error(data.data.message || 'API test failed');
      }
    } catch (error) {
      console.error('Error testing API:', error);
      toast.error('Failed to test API connection');
    } finally {
      setTestingApi(null);
    }
  };

  const checkCurrentVoiceSettings = async () => {
    try {
      console.log('🔍 Checking current voice settings in database...');
      
      const response = await fetch('http://localhost:3000/api/daive/voice-settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const data = await response.json();
      console.log('📊 Current Voice Settings from API:', data);
      
      if (data.success) {
        console.log('✅ Voice Settings Loaded Successfully');
        console.log('📋 Settings Details:', data.data);
        
        // Show current settings in a toast
        const settings = data.data;
        toast.success(`Voice: ${settings.enabled ? 'ON' : 'OFF'}, TTS: ${settings.ttsProvider || 'Not set'}, Auto: ${settings.autoVoiceResponse ? 'ON' : 'OFF'}`);
      } else {
        console.log('❌ Failed to load voice settings:', data);
        toast.error('Failed to load voice settings');
      }
    } catch (error) {
      console.error('Error checking voice settings:', error);
      toast.error('Error checking voice settings');
    }
  };

  const deleteApiSetting = async (settingType: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/daive/api-settings/${settingType}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setApiSettings(prev => ({
          ...prev,
          [settingType]: ''
        }));
        toast.success('API setting deleted successfully');
      } else {
        toast.error('Failed to delete API setting');
      }
    } catch (error) {
      console.error('Error deleting API setting:', error);
      toast.error('Failed to delete API setting');
    }
  };

  const resetToDefaults = () => {
    setPrompts({
      greeting: "Hello! I'm D.A.I.V.E., your AI sales assistant. I can help you with information about this {vehicle_year} {vehicle_make} {vehicle_model} or any other vehicles in our inventory. What would you like to know?",
      vehicle_info: "This {vehicle_year} {vehicle_make} {vehicle_model} has {features}. The price is ${price} with {mileage} miles. What specific aspect would you like me to focus on: features, pricing, or availability?",
      financing: "Based on your budget of ${monthly_budget} per month, I can help you find vehicles that fit your payment range. Let me check our current inventory and financing options to show you what's available within your budget.",
      test_drive: "Great choice! I can help you schedule a test drive at {dealership_name}. What day and time works best for you?",
      handoff: "I'd be happy to connect you with one of our sales representatives at {dealership_name} who can provide more detailed assistance. Let me transfer you now.",
      master_prompt: `You are "DAIVE", a warm, confident sales agent. Goals: understand the user's needs, present tailored options, and help them decide—without pressure.

Core Principles:
1) Think first: make a brief plan of what you need, then call tools; don't guess facts.
2) Prioritize outcomes: match needs, handle objections, and ask for micro-commitments.
3) Be concise, warm, and specific. No fluff. No hallucinations.
4) Safety & honesty: if uncertain, say so and offer to check.

Budget & Financing Intelligence:
- When customers mention monthly budgets (e.g., "$3,000 per month"), immediately use tools to search inventory
- Calculate financing options based on their stated budget
- Show specific vehicles that fit their payment range
- Use the budget_inquiry_prompt and financing_calculation_prompt for appropriate responses
- Always verify current inventory and pricing before making recommendations

Style:
- Conversational, human, concise (120–160 words unless asked).
- Use contractions and varied sentence length.
- Acknowledge, clarify, recommend, then close with a light CTA.
- Mirror the user's tone and vocabulary.

Sales Method:
1) Acknowledge & empathize in 1 short line.
2) Ask 1–2 clarifying questions max.
3) Offer 2–3 options: {name, who it's for, 2 key benefits, 1 tradeoff}.
4) Handle objections briefly: clarify, compare, reassure, invite next step.
5) Close with a choice of next actions (schedule, quick quote, link, or recap).

Facts & Integrity:
- If you're unsure, say so and propose how to confirm.
- Use tools for inventory, pricing, availability, and appointments.
- Never invent discounts, timelines, or legal terms.
- Always verify information before presenting it as fact.

Voice (if TTS):
- Natural pacing; brief pauses before numbers or totals.
- Keep enthusiasm measured; avoid hype words.

Refusals:
- If a request is unsafe or off-policy, decline quickly and suggest a safe alternative.

Naming Rules:
- NEVER use specific names like "John", "Sarah", etc. in responses
- Address customers generically or not at all
- Use phrases like "I can help you" instead of "Hey [name]!"
- If you don't know the customer's actual name, don't make one up

Output format:
- Plain text by default
- When listing vehicles, use HTML list format for better presentation:
  <ul class="inventory-list">
    <li class="vehicle-item" data-vehicle-id="[id]">
      <div class="vehicle-name">🚗 <strong>[Year Make Model]</strong></div>
      <div class="vehicle-details">
        <span class="color">Color: [color]</span><br>
        <span class="price">Price: [price]</span> • [mileage] miles
      </div>
    </li>
  </ul>
- Use simple bullets for non-vehicle options
- Include exactly one question unless user asked for a summary or next step`,
      style_guidelines: "Conversational, human, concise (120–160 words unless asked). Use contractions and varied sentence length. Acknowledge, clarify, recommend, then close with a light CTA. Mirror the user's tone and vocabulary. Think first, prioritize outcomes, be specific without fluff, and maintain safety & honesty.",
      sales_methodology: "1) Think first: make a brief plan of what you need, then call tools. 2) Acknowledge & empathize in 1 short line. 3) Ask 1–2 clarifying questions max. 4) Offer 2–3 options: {name, who it's for, 2 key benefits, 1 tradeoff}. 5) Handle objections briefly: clarify, compare, reassure, invite next step. 6) Prioritize outcomes: ask for micro-commitments. 7) Close with a choice of next actions (schedule, quick quote, link, or recap).",
      facts_integrity: "Think first: make a brief plan before calling tools. If you're unsure, say so and propose how to confirm. Use tools for inventory, pricing, availability, and appointments. Never invent discounts, timelines, or legal terms. Always verify information before presenting it as fact.",
      voice_behavior: "Natural pacing; brief pauses before numbers or totals. Keep enthusiasm measured; avoid hype words.",
      refusal_handling: "If a request is unsafe or off-policy, decline quickly and suggest a safe alternative.",
      // New AI bot specific prompts
      inventory_greeting: "Hi, I'm D.A.I.V.E.! I can help you find the perfect vehicle from our inventory. What are you looking for today?",
      family_vehicle_prompt: "I'd love to help you find the perfect family vehicle. What's most important to you: safety features, space, fuel efficiency, or all-around reliability?",
      similar_vehicles_prompt: "Great choice! Let me show you some similar options that might also interest you. What specific features are you looking for?",
      new_arrivals_prompt: "I'm excited to show you our newest arrivals! These vehicles are fresh off the truck and ready for you to explore. What type of vehicle interests you most?",
      suv_selection_prompt: "SUVs are perfect for families and active lifestyles. I have several great options to show you. What size SUV are you looking for: compact, midsize, or full-size?",
      sedan_selection_prompt: "Sedans offer great fuel efficiency and comfort. I have several excellent options in our inventory. What's your priority: luxury, economy, or sporty performance?",
      budget_inquiry_prompt: "Perfect! With a budget of ${monthly_budget} per month, I can help you find vehicles that fit your payment range. Let me search our inventory for options within your budget and show you what's available.",
      financing_calculation_prompt: "Great! Let me calculate financing options for you. With a ${monthly_budget} monthly budget, I can show you vehicles that fit your payment range. Would you like me to search for specific vehicle types or show you all available options within your budget?"
    });
    toast.info('Reset to comprehensive DAIVE prompts');
  };

  const setDefaultApiKeys = async () => {
    setSaving(true);
    try {
      // Set default API keys for testing
      const defaultKeys = {
        openai_key: process.env.REACT_APP_OPENAI_KEY || 'sk-test-openai-key',
        elevenlabs_key: process.env.REACT_APP_ELEVENLABS_KEY || 'test-elevenlabs-key',
        deepgram_key: 'fc3ae1a1762b2eb96ff9b59813d49f8881030dd2',
        azure_speech_key: process.env.REACT_APP_AZURE_SPEECH_KEY || 'test-azure-key'
      };

      for (const [keyType, keyValue] of Object.entries(defaultKeys)) {
        await fetch('http://localhost:3000/api/daive/api-settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            settingType: keyType,
            settingValue: keyValue
          })
        });
      }

      // Set default speech provider to Deepgram
      await fetch('http://localhost:3000/api/daive/api-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          settingType: 'speech_provider',
          settingValue: 'deepgram'
        })
      });

      // Refresh settings
      await fetchSettings();
      
      toast.success('Default API keys set successfully');
    } catch (error) {
      console.error('Error setting default API keys:', error);
      toast.error('Failed to set default API keys');
    } finally {
      setSaving(false);
    }
  };

  const handlePromptChange = (type: keyof PromptSettings, value: string) => {
    setPrompts(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const handleApiSettingChange = (type: keyof ApiSettings, value: string) => {
    setApiSettings(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const getPromptPlaceholders = (type: string) => {
    switch (type) {
      case 'greeting':
        return 'Available variables: {vehicle_year}, {vehicle_make}, {vehicle_model}, {dealership_name}';
      case 'vehicle_info':
        return 'Available variables: {features}, {price}, {mileage}, {color}, {trim}, {dealership_name}, {vehicle_year}, {vehicle_make}, {vehicle_model}';
      case 'financing':
        return 'Available variables: {rate}, {monthly_payment}, {down_payment}, {dealership_name}';
      case 'test_drive':
        return 'Available variables: {customer_name}, {vehicle_info}, {dealership_name}';
      case 'handoff':
        return 'Available variables: {sales_rep_name}, {dealership_name}';
      default:
        return '';
    }
  };

  const getApiKeyDisplay = (key: string) => {
    if (!key) return '';
    if (showApiKeys) return key;
    return key.substring(0, 8) + '...' + key.substring(key.length - 4);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">D.A.I.V.E. Settings</h1>
          <p className="text-gray-600">Customize your AI assistant behavior and responses</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            <Settings className="h-3 w-3 mr-1" />
            Configuration
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="prompts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="prompts" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Quick Prompts
          </TabsTrigger>
          <TabsTrigger value="behavior" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Behavior
          </TabsTrigger>
          <TabsTrigger value="aibot" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Bot
          </TabsTrigger>
          <TabsTrigger value="crew-ai" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Crew AI
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Voice Settings
          </TabsTrigger>
          <TabsTrigger value="integration" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Integration
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Lead Management
          </TabsTrigger>
        </TabsList>

        {/* AI Prompts Tab */}
        <TabsContent value="prompts" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Customize AI Responses</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetToDefaults}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset to Defaults
                  </Button>
                  <Button
                    onClick={savePrompts}
                    disabled={saving}
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Greeting Prompt */}
              <div className="space-y-2">
                <Label htmlFor="greeting">Greeting Message</Label>
                <Textarea
                  id="greeting"
                  value={prompts.greeting}
                  onChange={(e) => handlePromptChange('greeting', e.target.value)}
                  placeholder="Enter the greeting message D.A.I.V.E. will use..."
                  rows={3}
                />
                <p className="text-sm text-gray-500">
                  {getPromptPlaceholders('greeting')}
                </p>
              </div>

              {/* Vehicle Info Prompt */}
              <div className="space-y-2">
                <Label htmlFor="vehicle_info">Vehicle Information Response</Label>
                <Textarea
                  id="vehicle_info"
                  value={prompts.vehicle_info}
                  onChange={(e) => handlePromptChange('vehicle_info', e.target.value)}
                  placeholder="Enter how D.A.I.V.E. should describe vehicle features..."
                  rows={4}
                />
                <p className="text-sm text-gray-500">
                  {getPromptPlaceholders('vehicle_info')}
                </p>
              </div>

              {/* Financing Prompt */}
              <div className="space-y-2">
                <Label htmlFor="financing">Financing Information Response</Label>
                <Textarea
                  id="financing"
                  value={prompts.financing}
                  onChange={(e) => handlePromptChange('financing', e.target.value)}
                  placeholder="Enter how D.A.I.V.E. should discuss financing options..."
                  rows={4}
                />
                <p className="text-sm text-gray-500">
                  {getPromptPlaceholders('financing')}
                </p>
              </div>

              {/* Test Drive Prompt */}
              <div className="space-y-2">
                <Label htmlFor="test_drive">Test Drive Scheduling Response</Label>
                <Textarea
                  id="test_drive"
                  value={prompts.test_drive}
                  onChange={(e) => handlePromptChange('test_drive', e.target.value)}
                  placeholder="Enter how D.A.I.V.E. should handle test drive requests..."
                  rows={3}
                />
                <p className="text-sm text-gray-500">
                  {getPromptPlaceholders('test_drive')}
                </p>
              </div>

              {/* Handoff Prompt */}
              <div className="space-y-2">
                <Label htmlFor="handoff">Human Handoff Response</Label>
                <Textarea
                  id="handoff"
                  value={prompts.handoff}
                  onChange={(e) => handlePromptChange('handoff', e.target.value)}
                  placeholder="Enter how D.A.I.V.E. should handle handoffs to human agents..."
                  rows={3}
                />
                <p className="text-sm text-gray-500">
                  {getPromptPlaceholders('handoff')}
                </p>
              </div>
            </CardContent>
          </Card>


        </TabsContent>

        {/* Behavior Configuration Tab */}
        <TabsContent value="behavior" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Advanced Behavior Configuration</CardTitle>
                <Button
                  onClick={savePrompts}
                  disabled={saving}
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Behavior Settings
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Core Principles */}
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h3 className="font-semibold text-blue-900 mb-3">Core DAIVE Principles</h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex items-start gap-2">
                    <span className="font-medium">1.</span>
                    <span><strong>Think first:</strong> Make a brief plan of what you need, then call tools; don't guess facts.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium">2.</span>
                    <span><strong>Prioritize outcomes:</strong> Match needs, handle objections, and ask for micro-commitments.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium">3.</span>
                    <span><strong>Be concise, warm, and specific:</strong> No fluff. No hallucinations.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium">4.</span>
                    <span><strong>Safety & honesty:</strong> If uncertain, say so and offer to check.</span>
                  </div>
                </div>
              </div>

              {/* Master Prompt */}
              <div className="space-y-2">
                <Label htmlFor="master_prompt">Master System Prompt</Label>
                <Textarea
                  id="master_prompt"
                  value={prompts.master_prompt}
                  onChange={(e) => handlePromptChange('master_prompt', e.target.value)}
                  placeholder="Enter the main system prompt that defines DAIVE's personality and behavior..."
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-gray-500">
                  This is the core prompt that defines DAIVE's personality, style, and overall behavior patterns.
                </p>
              </div>

              {/* Style Guidelines */}
              <div className="space-y-2">
                <Label htmlFor="style_guidelines">Communication Style Guidelines</Label>
                <Textarea
                  id="style_guidelines"
                  value={prompts.style_guidelines}
                  onChange={(e) => handlePromptChange('style_guidelines', e.target.value)}
                  placeholder="Enter specific style and communication guidelines..."
                  rows={4}
                />
                <p className="text-sm text-gray-500">
                  Defines how DAIVE should communicate: tone, word count, sentence structure, etc.
                </p>
              </div>

              {/* Sales Methodology */}
              <div className="space-y-2">
                <Label htmlFor="sales_methodology">Sales Process Methodology</Label>
                <Textarea
                  id="sales_methodology"
                  value={prompts.sales_methodology}
                  onChange={(e) => handlePromptChange('sales_methodology', e.target.value)}
                  placeholder="Enter the step-by-step sales process DAIVE should follow..."
                  rows={5}
                />
                <p className="text-sm text-gray-500">
                  Step-by-step sales process that DAIVE should follow in conversations.
                </p>
              </div>

              {/* Facts & Integrity */}
              <div className="space-y-2">
                <Label htmlFor="facts_integrity">Facts & Integrity Guidelines</Label>
                <Textarea
                  id="facts_integrity"
                  value={prompts.facts_integrity}
                  onChange={(e) => handlePromptChange('facts_integrity', e.target.value)}
                  placeholder="Enter guidelines for handling uncertain information and maintaining integrity..."
                  rows={3}
                />
                <p className="text-sm text-gray-500">
                  Guidelines for handling uncertain information and maintaining factual accuracy.
                </p>
              </div>

              {/* Voice Behavior */}
              <div className="space-y-2">
                <Label htmlFor="voice_behavior">Voice & TTS Behavior</Label>
                <Textarea
                  id="voice_behavior"
                  value={prompts.voice_behavior}
                  onChange={(e) => handlePromptChange('voice_behavior', e.target.value)}
                  placeholder="Enter specific voice behavior guidelines for TTS responses..."
                  rows={3}
                />
                <p className="text-sm text-gray-500">
                  Specific guidelines for voice responses including pacing, enthusiasm, and delivery.
                </p>
              </div>

              {/* Refusal Handling */}
              <div className="space-y-2">
                <Label htmlFor="refusal_handling">Refusal & Safety Guidelines</Label>
                <Textarea
                  id="refusal_handling"
                  value={prompts.refusal_handling}
                  onChange={(e) => handlePromptChange('refusal_handling', e.target.value)}
                  placeholder="Enter guidelines for handling inappropriate requests or safety concerns..."
                  rows={3}
                />
                <p className="text-sm text-gray-500">
                  Guidelines for handling inappropriate requests, safety concerns, and off-topic conversations.
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Advanced Configuration</p>
                    <p className="text-sm text-blue-700">
                      These settings define DAIVE's core personality and behavior patterns. Changes here will affect all conversations.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Bot Configuration Tab */}
        <TabsContent value="aibot" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>AI Bot Behavior Configuration</CardTitle>
                <Button
                  onClick={saveAIBotSettings}
                  disabled={saving}
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save AI Bot Settings
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* AI Bot Behavior Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Core Behavior</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Quick Actions</Label>
                    <p className="text-sm text-gray-500">
                      Show quick action buttons for common questions
                    </p>
                  </div>
                  <Switch
                    checked={aiBotBehavior.enableQuickActions}
                    onCheckedChange={(checked) => 
                      setAiBotBehavior(prev => ({ ...prev, enableQuickActions: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Inventory Suggestions</Label>
                    <p className="text-sm text-gray-500">
                      Automatically suggest similar vehicles from inventory
                    </p>
                  </div>
                  <Switch
                    checked={aiBotBehavior.showInventorySuggestions}
                    onCheckedChange={(checked) => 
                      setAiBotBehavior(prev => ({ ...prev, showInventorySuggestions: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Greeting</Label>
                    <p className="text-sm text-gray-500">
                      Automatically send greeting message when chat opens
                    </p>
                    <p className="text-xs text-amber-600 font-medium">
                      ⚠️ Disabled by default to prevent repetitive greetings
                    </p>
                  </div>
                  <Switch
                    checked={aiBotBehavior.autoGreeting}
                    onCheckedChange={(checked) => 
                      setAiBotBehavior(prev => ({ ...prev, autoGreeting: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Lead Scoring</Label>
                    <p className="text-sm text-gray-500">
                      Automatically score conversations for lead qualification
                    </p>
                  </div>
                  <Switch
                    checked={aiBotBehavior.enableLeadScoring}
                    onCheckedChange={(checked) => 
                      setAiBotBehavior(prev => ({ ...prev, enableLeadScoring: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Handoff</Label>
                    <p className="text-sm text-gray-500">
                      Allow automatic handoff to human agents
                    </p>
                  </div>
                  <Switch
                    checked={aiBotBehavior.enableHandoff}
                    onCheckedChange={(checked) => 
                      setAiBotBehavior(prev => ({ ...prev, enableHandoff: checked }))
                    }
                  />
                </div>
              </div>

              {/* AI Bot Advanced Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Advanced Settings</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="conversationMemory">Conversation Memory</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="conversationMemory"
                      type="range"
                      min="5"
                      max="20"
                      step="1"
                      value={aiBotBehavior.conversationMemory}
                      onChange={(e) => 
                        setAiBotBehavior(prev => ({ ...prev, conversationMemory: parseInt(e.target.value) }))
                      }
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-12">
                      {aiBotBehavior.conversationMemory} messages
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Number of previous messages to remember for context
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responseLength">Response Length</Label>
                  <select
                    id="responseLength"
                    value={aiBotBehavior.responseLength}
                    onChange={(e) => 
                      setAiBotBehavior(prev => ({ ...prev, responseLength: e.target.value as 'short' | 'medium' | 'long' }))
                    }
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="short">Short (50-100 words)</option>
                    <option value="medium">Medium (100-200 words)</option>
                    <option value="long">Long (200+ words)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="personality">AI Personality</Label>
                  <select
                    id="personality"
                    value={aiBotBehavior.personality}
                    onChange={(e) => 
                      setAiBotBehavior(prev => ({ ...prev, personality: e.target.value as 'professional' | 'friendly' | 'enthusiastic' | 'casual' }))
                    }
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="professional">Professional & Formal</option>
                    <option value="friendly">Friendly & Approachable</option>
                    <option value="enthusiastic">Enthusiastic & Energetic</option>
                    <option value="casual">Casual & Relaxed</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxConversationLength">Max Conversation Length</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="maxConversationLength"
                      type="range"
                      min="20"
                      max="100"
                      step="5"
                      value={aiBotBehavior.maxConversationLength}
                      onChange={(e) => 
                        setAiBotBehavior(prev => ({ ...prev, maxConversationLength: parseInt(e.target.value) }))
                      }
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-12">
                      {aiBotBehavior.maxConversationLength} messages
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Maximum number of messages before suggesting handoff
                  </p>
                </div>
              </div>

              {/* AI Bot Specific Prompts */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Specialized Prompts</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="inventory_greeting">Inventory Greeting</Label>
                  <Textarea
                    id="inventory_greeting"
                    value={prompts.inventory_greeting}
                    onChange={(e) => handlePromptChange('inventory_greeting', e.target.value)}
                    placeholder="Enter greeting message for general inventory inquiries..."
                    rows={3}
                  />
                  <p className="text-sm text-gray-500">
                    Used when customers ask about general inventory without a specific vehicle
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="family_vehicle_prompt">Family Vehicle Prompt</Label>
                  <Textarea
                    id="family_vehicle_prompt"
                    value={prompts.family_vehicle_prompt}
                    onChange={(e) => handlePromptChange('family_vehicle_prompt', e.target.value)}
                    placeholder="Enter response for family vehicle inquiries..."
                    rows={3}
                  />
                  <p className="text-sm text-gray-500">
                    Used when customers ask about family-friendly vehicles
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="similar_vehicles_prompt">Similar Vehicles Prompt</Label>
                  <Textarea
                    id="similar_vehicles_prompt"
                    value={prompts.similar_vehicles_prompt}
                    onChange={(e) => handlePromptChange('similar_vehicles_prompt', e.target.value)}
                    placeholder="Enter response for similar vehicle requests..."
                    rows={3}
                  />
                  <p className="text-sm text-gray-500">
                    Used when customers ask to see similar vehicle options
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new_arrivals_prompt">New Arrivals Prompt</Label>
                    <Textarea
                      id="new_arrivals_prompt"
                      value={prompts.new_arrivals_prompt}
                      onChange={(e) => handlePromptChange('new_arrivals_prompt', e.target.value)}
                      placeholder="Enter response for new arrivals inquiries..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="suv_selection_prompt">SUV Selection Prompt</Label>
                    <Textarea
                      id="suv_selection_prompt"
                      value={prompts.suv_selection_prompt}
                      onChange={(e) => handlePromptChange('suv_selection_prompt', e.target.value)}
                      placeholder="Enter response for SUV inquiries..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sedan_selection_prompt">Sedan Selection Prompt</Label>
                  <Textarea
                    id="sedan_selection_prompt"
                    value={prompts.sedan_selection_prompt}
                    onChange={(e) => handlePromptChange('sedan_selection_prompt', e.target.value)}
                    placeholder="Enter response for sedan inquiries..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget_inquiry_prompt">Budget Inquiry Prompt</Label>
                  <Textarea
                    id="budget_inquiry_prompt"
                    value={prompts.budget_inquiry_prompt}
                    onChange={(e) => handlePromptChange('budget_inquiry_prompt', e.target.value)}
                    placeholder="Enter response when customers share their budget..."
                    rows={3}
                  />
                  <p className="text-sm text-gray-500">
                    Used when customers mention their monthly budget or payment range
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="financing_calculation_prompt">Financing Calculation Prompt</Label>
                  <Textarea
                    id="financing_calculation_prompt"
                    value={prompts.financing_calculation_prompt}
                    onChange={(e) => handlePromptChange('financing_calculation_prompt', e.target.value)}
                    placeholder="Enter response for financing calculations..."
                    rows={3}
                  />
                  <p className="text-sm text-gray-500">
                    Used when customers want to calculate payments or financing options
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">AI Bot Configuration</p>
                    <p className="text-sm text-blue-700">
                      These settings control how the AI bot behaves in conversations, including personality, response style, and specialized prompts for different scenarios.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-4 rounded-lg border-l-4 border-amber-400">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Greeting Behavior Fix</p>
                    <p className="text-sm text-amber-700">
                      Auto Greeting is disabled by default to prevent DAIVE from repeatedly sending greeting messages. 
                      If you want DAIVE to greet users, enable this setting but ensure your greeting prompt is contextual and not repetitive.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Crew AI Tab */}
        <TabsContent value="crew-ai" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Crew AI Configuration</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCrewAISettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                  >
                    {crewAISettings.enabled ? 'Disable' : 'Enable'} Crew AI
                  </Button>
                  <Button
                    onClick={saveCrewAISettings}
                    disabled={saving}
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Crew AI Settings
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Crew AI Master Switch */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="space-y-1">
                  <Label className="text-lg font-semibold text-blue-900">Enable Crew AI</Label>
                  <p className="text-sm text-blue-700">
                    Activate specialized AI agents that work together to provide enhanced customer service
                  </p>
                </div>
                <Switch
                  checked={crewAISettings.enabled}
                  onCheckedChange={(checked) => 
                    setCrewAISettings(prev => ({ ...prev, enabled: checked }))
                  }
                />
              </div>

              {crewAISettings.enabled && (
                <>
                  {/* Crew Selection */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Crew Configuration</h3>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto Routing</Label>
                        <p className="text-sm text-gray-500">
                          Automatically route conversations to appropriate crews
                        </p>
                      </div>
                      <Switch
                        checked={crewAISettings.autoRouting}
                        onCheckedChange={(checked) => 
                          setCrewAISettings(prev => ({ ...prev, autoRouting: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Sales Crew</Label>
                        <p className="text-sm text-gray-500">
                          Enable specialized sales agents for vehicle inquiries
                        </p>
                      </div>
                      <Switch
                        checked={crewAISettings.enableSalesCrew}
                        onCheckedChange={(checked) => 
                          setCrewAISettings(prev => ({ ...prev, enableSalesCrew: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Customer Service Crew</Label>
                        <p className="text-sm text-gray-500">
                          Enable general customer service agents
                        </p>
                      </div>
                      <Switch
                        checked={crewAISettings.enableCustomerServiceCrew}
                        onCheckedChange={(checked) => 
                          setCrewAISettings(prev => ({ ...prev, enableCustomerServiceCrew: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Inventory Crew</Label>
                        <p className="text-sm text-gray-500">
                          Enable specialized inventory management agents
                        </p>
                      </div>
                      <Switch
                        checked={crewAISettings.enableInventoryCrew}
                        onCheckedChange={(checked) => 
                          setCrewAISettings(prev => ({ ...prev, enableInventoryCrew: checked }))
                        }
                      />
                    </div>
                  </div>

                  {/* Advanced Settings */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Advanced Settings</h3>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Crew Collaboration</Label>
                        <p className="text-sm text-gray-500">
                          Allow agents to collaborate and share information
                        </p>
                      </div>
                      <Switch
                        checked={crewAISettings.crewCollaboration}
                        onCheckedChange={(checked) => 
                          setCrewAISettings(prev => ({ ...prev, crewCollaboration: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Agent Memory</Label>
                        <p className="text-sm text-gray-500">
                          Enable agents to remember conversation context
                        </p>
                      </div>
                      <Switch
                        checked={crewAISettings.agentMemory}
                        onCheckedChange={(checked) => 
                          setCrewAISettings(prev => ({ ...prev, agentMemory: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Performance Tracking</Label>
                        <p className="text-sm text-gray-500">
                          Track agent performance and effectiveness
                        </p>
                      </div>
                      <Switch
                        checked={crewAISettings.performanceTracking}
                        onCheckedChange={(checked) => 
                          setCrewAISettings(prev => ({ ...prev, performanceTracking: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Fallback to Traditional</Label>
                        <p className="text-sm text-gray-500">
                          Use traditional DAIVE if Crew AI fails
                        </p>
                      </div>
                      <Switch
                        checked={crewAISettings.fallbackToTraditional}
                        onCheckedChange={(checked) => 
                          setCrewAISettings(prev => ({ ...prev, fallbackToTraditional: checked }))
                        }
                      />
                    </div>

                    {/* Max Tokens Setting */}
                    <div className="space-y-2">
                      <Label>Max Response Length (Tokens)</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          type="number"
                          min="50"
                          max="2000"
                          step="50"
                          value={crewAISettings.maxTokens}
                          onChange={(e) => setCrewAISettings(prev => ({ 
                            ...prev, 
                            maxTokens: parseInt(e.target.value) || 100 
                          }))}
                          className="w-32"
                          placeholder="100"
                        />
                        <div className="flex-1">
                          <p className="text-sm text-gray-500">
                            Control the maximum length of Crew AI responses. 
                            Lower values (50-200) for concise responses, 
                            higher values (500-1000) for detailed explanations.
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCrewAISettings(prev => ({ ...prev, maxTokens: 100 }))}
                            >
                              Short (100)
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCrewAISettings(prev => ({ ...prev, maxTokens: 300 }))}
                            >
                              Medium (300)
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCrewAISettings(prev => ({ ...prev, maxTokens: 600 }))}
                            >
                              Long (600)
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Crew Selection Strategy */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Crew Selection Strategy</h3>
                    
                    <div className="space-y-2">
                      <Label>Crew Selection Mode</Label>
                      <select
                        value={crewAISettings.crewSelection}
                        onChange={(e) => setCrewAISettings(prev => ({ 
                          ...prev, 
                          crewSelection: e.target.value as 'auto' | 'manual' | 'hybrid' 
                        }))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="auto">Automatic - AI decides best crew</option>
                        <option value="manual">Manual - User selects crew</option>
                        <option value="hybrid">Hybrid - AI suggests, user confirms</option>
                      </select>
                      <p className="text-sm text-gray-500">
                        Choose how crews are selected for conversations
                      </p>
                    </div>
                  </div>

                  {/* Information Panel */}
                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Crew AI Benefits</p>
                        <p className="text-sm text-blue-700">
                          Crew AI provides specialized agents for different aspects of vehicle sales, 
                          including lead qualification, vehicle expertise, financing, and test drive coordination. 
                          This results in more accurate, specialized responses and better customer experience.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>API Key Management</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={setDefaultApiKeys}
                    disabled={saving}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Set Default Keys
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApiKeys(!showApiKeys)}
                  >
                    {showApiKeys ? (
                      <EyeOff className="h-4 w-4 mr-2" />
                    ) : (
                      <Eye className="h-4 w-4 mr-2" />
                    )}
                    {showApiKeys ? 'Hide' : 'Show'} Keys
                  </Button>
                  <Button
                    onClick={saveApiSettings}
                    disabled={saving}
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save API Keys
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OpenAI API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="openai_key">OpenAI API Key</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testApiConnection('openai')}
                      disabled={testingApi === 'openai' || !apiSettings.openai_key}
                    >
                      {testingApi === 'openai' ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      Test
                    </Button>
                    {apiSettings.openai_key && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteApiSetting('openai_key')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <Input
                  id="openai_key"
                  type={showApiKeys ? "text" : "password"}
                  value={apiSettings.openai_key}
                  onChange={(e) => handleApiSettingChange('openai_key', e.target.value)}
                  placeholder="sk-..."
                />
                <p className="text-sm text-gray-500">
                  Required for AI conversation processing. Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Platform</a>
                </p>
                
                {/* OpenAI TTS Test Button */}
                {apiSettings.openai_key && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testApiConnection('openai_tts')}
                      disabled={testingApi === 'openai_tts'}
                    >
                      {testingApi === 'openai_tts' ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      Test TTS
                    </Button>
                    <p className="text-xs text-gray-500 mt-1">
                      Test OpenAI TTS (tts-1-hd) functionality
                    </p>
                  </div>
                )}
              </div>

              {/* ElevenLabs API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="elevenlabs_key">ElevenLabs API Key</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testApiConnection('elevenlabs')}
                      disabled={testingApi === 'elevenlabs' || !apiSettings.elevenlabs_key}
                    >
                      {testingApi === 'elevenlabs' ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      Test
                    </Button>
                    {apiSettings.elevenlabs_key && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteApiSetting('elevenlabs_key')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <Input
                  id="elevenlabs_key"
                  type={showApiKeys ? "text" : "password"}
                  value={apiSettings.elevenlabs_key}
                  onChange={(e) => handleApiSettingChange('elevenlabs_key', e.target.value)}
                  placeholder="Enter your ElevenLabs API key..."
                />
                <p className="text-sm text-gray-500">
                  Required for voice synthesis. Get your key from <a href="https://elevenlabs.io/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ElevenLabs</a>
                </p>
              </div>

              {/* Azure Speech API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="azure_speech_key">Azure Speech API Key</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testApiConnection('azure')}
                      disabled={testingApi === 'azure' || !apiSettings.azure_speech_key}
                    >
                      {testingApi === 'azure' ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      Test
                    </Button>
                    {apiSettings.azure_speech_key && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteApiSetting('azure_speech_key')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <Input
                  id="azure_speech_key"
                  type={showApiKeys ? "text" : "password"}
                  value={apiSettings.azure_speech_key}
                  onChange={(e) => handleApiSettingChange('azure_speech_key', e.target.value)}
                  placeholder="Enter your Azure Speech API key..."
                />
                <p className="text-sm text-gray-500">
                  Alternative voice synthesis option. Get your key from <a href="https://azure.microsoft.com/en-us/services/cognitive-services/speech-services/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Azure Speech Services</a>
                </p>
              </div>

              {/* Deepgram API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="deepgram_key">Deepgram API Key</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testApiConnection('deepgram')}
                      disabled={testingApi === 'deepgram' || !apiSettings.deepgram_key}
                    >
                      {testingApi === 'deepgram' ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      Test
                    </Button>
                    {apiSettings.deepgram_key && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteApiSetting('deepgram_key')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <Input
                  id="deepgram_key"
                  type={showApiKeys ? "text" : "password"}
                  value={apiSettings.deepgram_key}
                  onChange={(e) => handleApiSettingChange('deepgram_key', e.target.value)}
                  placeholder="Enter your Deepgram API key..."
                />
                <p className="text-sm text-gray-500">
                  Alternative speech-to-text option. Get your key from <a href="https://deepgram.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Deepgram</a>
                </p>
              </div>

              {/* Dealer ID */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dealer_id">Dealer ID</Label>
                  {apiSettings.dealer_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteApiSetting('dealer_id')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Input
                  id="dealer_id"
                  type="text"
                  value={apiSettings.dealer_id}
                  onChange={(e) => handleApiSettingChange('dealer_id', e.target.value)}
                  placeholder="Enter your dealer ID..."
                />
                <p className="text-sm text-gray-500">
                  Your unique dealer identifier for API integration and vehicle management.
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">API Key Security</p>
                    <p className="text-sm text-blue-700">
                      Your API keys are encrypted and stored securely. Never share your keys publicly.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice Settings Tab */}
        <TabsContent value="voice" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Voice Configuration</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkCurrentVoiceSettings}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Check Settings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testApiConnection('openai_tts')}
                    disabled={testingApi === 'openai_tts'}
                  >
                    {testingApi === 'openai_tts' ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    Test Voice
                  </Button>
                  <Button
                    onClick={saveVoiceSettings}
                    disabled={saving}
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Voice Settings
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Voice Responses</Label>
                  <p className="text-sm text-gray-500">
                    Allow D.A.I.V.E. to respond with voice in addition to text
                  </p>
                </div>
                <Switch
                  checked={voiceSettings.enabled}
                  onCheckedChange={(checked) => 
                    setVoiceSettings(prev => ({ ...prev, enabled: checked }))
                  }
                />
              </div>

              {/* Voice Status Indicator */}
              {voiceSettings.enabled && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div className="text-sm">
                      <span className="font-medium text-green-800">Voice Status: </span>
                      <span className="text-green-700">
                        {voiceSettings.ttsProvider === 'openai' ? 'OpenAI TTS' : voiceSettings.ttsProvider === 'elevenlabs' ? 'ElevenLabs' : voiceSettings.ttsProvider} 
                        {voiceSettings.ttsProvider === 'openai' && voiceSettings.openaiVoice && ` (${voiceSettings.openaiVoice})`}
                        {voiceSettings.ttsProvider === 'elevenlabs' && voiceSettings.elevenLabsVoice && ` (${voiceSettings.elevenLabsVoice})`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {voiceSettings.enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="speechProvider">Speech-to-Text Provider</Label>
                    <select
                      id="speechProvider"
                      value={voiceSettings.speechProvider || 'whisper'}
                      onChange={(e) => 
                        setVoiceSettings(prev => ({ ...prev, speechProvider: e.target.value }))
                      }
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="whisper">OpenAI Whisper (Recommended)</option>
                      <option value="deepgram">Deepgram</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="voiceProvider">Voice Provider</Label>
                    <select
                      id="voiceProvider"
                      value={voiceSettings.voiceProvider}
                      onChange={(e) => 
                        setVoiceSettings(prev => ({ ...prev, voiceProvider: e.target.value }))
                      }
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="elevenlabs">ElevenLabs (Recommended)</option>
                      <option value="openai">OpenAI TTS (tts-1-hd)</option>
                      <option value="deepgram">Deepgram</option>
                      <option value="azure">Azure Speech Services</option>
                      <option value="google">Google Cloud Speech</option>
                    </select>
                  </div>

                  {voiceSettings.voiceProvider === 'openai' && (
                    <div className="space-y-2">
                      <Label htmlFor="openaiVoiceProvider">OpenAI Voice</Label>
                      <select
                        id="openaiVoiceProvider"
                        value={voiceSettings.openaiVoice || 'onyx'}
                        onChange={(e) => 
                          setVoiceSettings(prev => ({ ...prev, openaiVoice: e.target.value }))
                        }
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="alloy">Alloy</option>
                        <option value="echo">Echo</option>
                        <option value="fable">Fable</option>
                        <option value="onyx">Onyx</option>
                        <option value="nova">Nova</option>
                        <option value="shimmer">Shimmer</option>



                        <option value="spruce">Spruce</option>
                      </select>
                      <p className="text-sm text-gray-500">
                        Select the voice for OpenAI TTS. All voices use the tts-1-hd model for high quality.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="ttsProvider">Text-to-Speech Provider</Label>
                    <select
                      id="ttsProvider"
                      value={voiceSettings.ttsProvider}
                      onChange={(e) => 
                        setVoiceSettings(prev => ({ ...prev, ttsProvider: e.target.value }))
                      }
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="elevenlabs">ElevenLabs (Recommended)</option>
                      <option value="openai">OpenAI TTS (tts-1-hd)</option>
                      <option value="deepgram">Deepgram</option>
                    </select>
                  </div>

                  {voiceSettings.ttsProvider === 'openai' && (
                    <div className="space-y-2">
                      <Label htmlFor="openaiVoice">OpenAI Voice</Label>
                      <select
                        id="openaiVoice"
                        value={voiceSettings.openaiVoice || 'alloy'}
                        onChange={(e) => 
                          setVoiceSettings(prev => ({ ...prev, openaiVoice: e.target.value }))
                        }
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="alloy">Alloy</option>
                        <option value="echo">Echo</option>
                        <option value="fable">Fable</option>
                        <option value="onyx">Onyx</option>
                        <option value="nova">Nova</option>
                        <option value="shimmer">Shimmer</option>
                      </select>
                      <p className="text-sm text-gray-500">
                        Select the voice for OpenAI TTS. All voices use the tts-1-hd model for high quality.
                      </p>
                    </div>
                  )}

                  {voiceSettings.ttsProvider === 'elevenlabs' && (
                    <div className="space-y-2">
                      <Label htmlFor="elevenLabsVoice">ElevenLabs Voice</Label>
                      <select
                        id="elevenLabsVoice"
                        value={voiceSettings.elevenLabsVoice || 'jessica'}
                        onChange={(e) => 
                          setVoiceSettings(prev => ({ ...prev, elevenLabsVoice: e.target.value }))
                        }
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="jessica">Jessica (Recommended)</option>
                        <option value="liam">Liam (Multilingual)</option>
                        <option value="rachel">Rachel</option>
                        <option value="domi">Domi</option>
                        <option value="bella">Bella</option>
                        <option value="antoni">Antoni</option>
                        <option value="elli">Elli</option>
                        <option value="josh">Josh</option>
                        <option value="arnold">Arnold</option>
                        <option value="adam">Adam</option>
                        <option value="sam">Sam</option>
                      </select>
                      <p className="text-sm text-gray-500">
                        Select the ElevenLabs voice for TTS. Jessica is recommended for professional customer service. Liam supports multiple languages for international customers.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="language">Voice Language</Label>
                    <select
                      id="language"
                      value={voiceSettings.language}
                      onChange={(e) => 
                        setVoiceSettings(prev => ({ ...prev, language: e.target.value }))
                      }
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="es-ES">Spanish</option>
                      <option value="fr-FR">French</option>
                      <option value="de-DE">German</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="voiceSpeed">Voice Speed</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="voiceSpeed"
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={voiceSettings.voiceSpeed}
                        onChange={(e) => 
                          setVoiceSettings(prev => ({ ...prev, voiceSpeed: parseFloat(e.target.value) }))
                        }
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-12">
                        {voiceSettings.voiceSpeed}x
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="voicePitch">Voice Pitch</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="voicePitch"
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={voiceSettings.voicePitch}
                        onChange={(e) => 
                          setVoiceSettings(prev => ({ ...prev, voicePitch: parseFloat(e.target.value) }))
                        }
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-12">
                        {voiceSettings.voicePitch}x
                      </span>
                    </div>
                  </div>

                  {/* New AI Bot Voice Settings */}
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium text-sm">AI Bot Voice Enhancements</h4>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto Voice Response</Label>
                        <p className="text-sm text-gray-500">
                          Automatically generate voice for all AI responses
                        </p>
                      </div>
                      <Switch
                        checked={voiceSettings.autoVoiceResponse}
                        onCheckedChange={(checked) => 
                          setVoiceSettings(prev => ({ ...prev, autoVoiceResponse: checked }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="voiceQuality">Voice Quality</Label>
                      <select
                        id="voiceQuality"
                        value={voiceSettings.voiceQuality}
                        onChange={(e) => 
                          setVoiceSettings(prev => ({ ...prev, voiceQuality: e.target.value as 'standard' | 'hd' | 'ultra' }))
                        }
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="standard">Standard (Fast)</option>
                        <option value="hd">HD (Balanced)</option>
                        <option value="ultra">Ultra HD (Best Quality)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="voiceEmotion">Voice Emotion</Label>
                      <select
                        id="voiceEmotion"
                        value={voiceSettings.voiceEmotion}
                        onChange={(e) => 
                          setVoiceSettings(prev => ({ ...prev, voiceEmotion: e.target.value as 'neutral' | 'friendly' | 'professional' | 'enthusiastic' }))
                        }
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="neutral">Neutral</option>
                        <option value="friendly">Friendly</option>
                        <option value="professional">Professional</option>
                        <option value="enthusiastic">Enthusiastic</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="recordingQuality">Recording Quality</Label>
                      <select
                        id="recordingQuality"
                        value={voiceSettings.recordingQuality}
                        onChange={(e) => 
                          setVoiceSettings(prev => ({ ...prev, recordingQuality: e.target.value as 'low' | 'medium' | 'high' }))
                        }
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="low">Low (Fast Processing)</option>
                        <option value="medium">Medium (Balanced)</option>
                        <option value="high">High (Best Accuracy)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Voice Feature Notice</p>
                    <p className="text-sm text-blue-700">
                      Voice features require API keys to be configured in the API Keys tab. 
                      Make sure to test your API connections before enabling voice features.
                    </p>
                  </div>
                </div>
              </div>

              {/* Voice Troubleshooting Section */}
              <div className="bg-amber-50 p-4 rounded-lg border-l-4 border-amber-400">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Voice Not Working? Try These Steps:</p>
                    <div className="space-y-2 text-sm text-amber-700 mt-2">
                      <div className="flex items-start gap-2">
                        <span className="font-medium">1.</span>
                        <span>Check that "Enable Voice Responses" is turned ON</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium">2.</span>
                        <span>Verify your OpenAI API key is valid and has credits</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium">3.</span>
                        <span>Test your OpenAI API connection using the "Test" button</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium">4.</span>
                        <span>Check your browser's audio permissions and volume settings</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium">5.</span>
                        <span>Try switching between different voice providers (OpenAI, ElevenLabs)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integration Settings Tab */}
        <TabsContent value="integration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integration Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Webhook Integration</h3>
                    <p className="text-sm text-gray-500">Send conversation data to external systems</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">CRM Integration</h3>
                    <p className="text-sm text-gray-500">Connect with your CRM system</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Analytics Export</h3>
                    <p className="text-sm text-gray-500">Export conversation analytics</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Integration Ready</p>
                    <p className="text-sm text-green-700">
                      Your D.A.I.V.E. system is ready for external integrations. Contact support for advanced integration options.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lead Management Tab */}
        <TabsContent value="leads" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead Qualification Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automatic Lead Qualification</Label>
                  <p className="text-sm text-gray-500">
                    Automatically qualify leads based on conversation analysis
                  </p>
                </div>
                <Switch
                  checked={leadSettings.autoQualification}
                  onCheckedChange={(checked) => 
                    setLeadSettings(prev => ({ ...prev, autoQualification: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minScore">Minimum Score for Lead Generation</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="minScore"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={leadSettings.minScoreForLead}
                    onChange={(e) => 
                      setLeadSettings(prev => ({ ...prev, minScoreForLead: parseInt(e.target.value) }))
                    }
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12">
                    {leadSettings.minScoreForLead}%
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Conversations with scores above this threshold will be marked as leads
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="autoHandoff">Automatic Handoff Score</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="autoHandoff"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={leadSettings.autoHandoffScore}
                    onChange={(e) => 
                      setLeadSettings(prev => ({ ...prev, autoHandoffScore: parseInt(e.target.value) }))
                    }
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12">
                    {leadSettings.autoHandoffScore}%
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Automatically request human handoff when lead score reaches this threshold
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notificationEmail">Lead Notification Email</Label>
                <Input
                  id="notificationEmail"
                  type="email"
                  value={leadSettings.notificationEmail}
                  onChange={(e) => 
                    setLeadSettings(prev => ({ ...prev, notificationEmail: e.target.value }))
                  }
                  placeholder="sales@dealership.com"
                />
                <p className="text-sm text-gray-500">
                  Email address to receive notifications for qualified leads
                </p>
              </div>

              {/* New AI Bot Lead Settings */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium text-sm">AI Bot Lead Enhancement</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Conversation Tracking</Label>
                    <p className="text-sm text-gray-500">
                      Track all conversations for lead analysis
                    </p>
                  </div>
                  <Switch
                    checked={leadSettings.conversationTracking}
                    onCheckedChange={(checked) => 
                      setLeadSettings(prev => ({ ...prev, conversationTracking: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Interest Detection</Label>
                    <p className="text-sm text-gray-500">
                      Automatically detect customer interests from conversations
                    </p>
                  </div>
                  <Switch
                    checked={leadSettings.interestDetection}
                    onCheckedChange={(checked) => 
                      setLeadSettings(prev => ({ ...prev, interestDetection: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Follow-up</Label>
                    <p className="text-sm text-gray-500">
                      Automatically send follow-up messages to interested customers
                    </p>
                  </div>
                  <Switch
                    checked={leadSettings.autoFollowUp}
                    onCheckedChange={(checked) => 
                      setLeadSettings(prev => ({ ...prev, autoFollowUp: checked }))
                    }
                  />
                </div>

                {leadSettings.autoFollowUp && (
                  <div className="space-y-2">
                    <Label htmlFor="followUpDelay">Follow-up Delay (hours)</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="followUpDelay"
                        type="range"
                        min="1"
                        max="72"
                        step="1"
                        value={leadSettings.followUpDelay}
                        onChange={(e) => 
                          setLeadSettings(prev => ({ ...prev, followUpDelay: parseInt(e.target.value) }))
                        }
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-12">
                        {leadSettings.followUpDelay}h
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Delay before sending automatic follow-up messages
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Lead Management Active</p>
                    <p className="text-sm text-green-700">
                      D.A.I.V.E. will automatically qualify leads and notify your team when high-quality prospects are identified.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DAIVESettings; 
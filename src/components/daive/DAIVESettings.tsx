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
  Download
} from 'lucide-react';
import { toast } from 'sonner';

interface PromptSettings {
  greeting: string;
  vehicle_info: string;
  financing: string;
  test_drive: string;
  handoff: string;
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
}

interface LeadSettings {
  autoQualification: boolean;
  minScoreForLead: number;
  autoHandoffScore: number;
  notificationEmail: string;
}

interface ApiSettings {
  openai_key: string;
  elevenlabs_key: string;
  azure_speech_key: string;
  deepgram_key: string;
  voice_provider: string;
  dealer_id: string;
}

const DAIVESettings: React.FC = () => {
  const [prompts, setPrompts] = useState<PromptSettings>({
    greeting: '',
    vehicle_info: '',
    financing: '',
    test_drive: '',
    handoff: ''
  });
  
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: false,
    language: 'en-US',
    voiceSpeed: 1.0,
    voicePitch: 1.0,
    voiceProvider: 'elevenlabs',
    speechProvider: 'whisper',
    ttsProvider: 'elevenlabs',
    openaiVoice: 'alloy',
    elevenLabsVoice: 'jessica'
  });
  
  const [leadSettings, setLeadSettings] = useState<LeadSettings>({
    autoQualification: true,
    minScoreForLead: 50,
    autoHandoffScore: 80,
    notificationEmail: ''
  });

  const [apiSettings, setApiSettings] = useState<ApiSettings>({
    openai_key: '',
    elevenlabs_key: '',
    azure_speech_key: '',
    deepgram_key: '',
    voice_provider: 'elevenlabs',
    dealer_id: ''
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
      if (promptsData.success) {
        const promptData = promptsData.data;
        setPrompts({
          greeting: promptData.greeting?.text || '',
          vehicle_info: promptData.vehicle_info?.text || '',
          financing: promptData.financing?.text || '',
          test_drive: promptData.test_drive?.text || '',
          handoff: promptData.handoff?.text || ''
        });
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
      if (voiceData.success) {
        const voiceSettingsData = voiceData.data;
        setVoiceSettings({
          enabled: voiceSettingsData.enabled || false,
          language: voiceSettingsData.language || 'en-US',
          voiceSpeed: voiceSettingsData.voiceSpeed || 1.0,
          voicePitch: voiceSettingsData.voicePitch || 1.0,
          voiceProvider: voiceSettingsData.voiceProvider || 'elevenlabs',
          speechProvider: voiceSettingsData.speechProvider || 'whisper',
          ttsProvider: voiceSettingsData.ttsProvider || 'elevenlabs',
          openaiVoice: voiceSettingsData.openaiVoice || 'alloy',
          elevenLabsVoice: voiceSettingsData.elevenLabsVoice || 'jessica'
        });
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
      const promptTypes = ['greeting', 'vehicle_info', 'financing', 'test_drive', 'handoff'];
      
      for (const promptType of promptTypes) {
        if (prompts[promptType as keyof PromptSettings]) {
          await fetch('http://localhost:3000/api/daive/prompts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({
              promptType,
              promptText: prompts[promptType as keyof PromptSettings]
            })
          });
        }
      }
      
      toast.success('Prompts saved successfully');
    } catch (error) {
      console.error('Error saving prompts:', error);
      toast.error('Failed to save prompts');
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
      // Save all voice settings in a single request
      await fetch('http://localhost:3000/api/daive/voice-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          enabled: voiceSettings.enabled,
          language: voiceSettings.language,
          voiceSpeed: voiceSettings.voiceSpeed,
          voicePitch: voiceSettings.voicePitch,
          voiceProvider: voiceSettings.voiceProvider,
          speechProvider: voiceSettings.speechProvider,
          ttsProvider: voiceSettings.ttsProvider,
          openaiVoice: voiceSettings.openaiVoice
        })
      });
      
      toast.success('Voice settings saved successfully');
    } catch (error) {
      console.error('Error saving voice settings:', error);
      toast.error('Failed to save voice settings');
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
      greeting: "Hi, I'm D.A.I.V.E., your AI sales assistant at {dealership_name}. How can I help you with this {vehicle_year} {vehicle_make} {vehicle_model}?",
      vehicle_info: "This {vehicle_year} {vehicle_make} {vehicle_model} has excellent features including {features}. The price is ${price} and it has {mileage} miles. Would you like to know more about financing options at {dealership_name}?",
      financing: "I can help you with financing options at {dealership_name}. We offer competitive rates starting at {rate}% APR. Would you like to calculate your monthly payment?",
      test_drive: "Great choice! I can help you schedule a test drive at {dealership_name}. What day and time works best for you?",
      handoff: "I'd be happy to connect you with one of our sales representatives at {dealership_name} who can provide more detailed assistance. Let me transfer you now."
    });
    toast.info('Reset to default prompts');
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="prompts" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            AI Prompts
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
                        Select the ElevenLabs voice for TTS. Jessica is recommended for professional customer service.
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
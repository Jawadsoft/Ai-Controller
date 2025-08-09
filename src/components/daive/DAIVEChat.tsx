import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Send, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import VoiceRecorder from './VoiceRecorder';
import { validateAudioBlob, formatFileSize } from '../../lib/voiceUtils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface DAIVEChatProps {
  vehicleId: string;
  vehicleInfo?: {
    make: string;
    model: string;
    year: number;
    price?: number;
  };
  onLeadGenerated?: (leadData: any) => void;
}

interface QuickAction {
  label: string;
  message: string;
  icon?: string;
}

const DAIVEChat: React.FC<DAIVEChatProps> = ({ 
  vehicleId, 
  vehicleInfo, 
  onLeadGenerated 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Quick action buttons for common questions
  const quickActions: QuickAction[] = [
    { label: 'Family Features', message: 'I want an ideal car for my family' },
    { label: 'Safety Info', message: 'What safety features does this vehicle have?' },
    { label: 'Pricing', message: 'What is the price and financing options?' },
    { label: 'Test Drive', message: 'Can I schedule a test drive?' },
    { label: 'Fuel Economy', message: 'What are the fuel efficiency ratings?' },
    { label: 'Cargo Space', message: 'How much cargo space does it have?' }
  ];

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.message);
    setShowQuickActions(false); // Hide quick actions after first use
  };

  // Generate session ID on component mount
  useEffect(() => {
    const newSessionId = `daive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    
    // Send initial greeting
    sendInitialGreeting();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);



  const sendInitialGreeting = async () => {
    const greeting = `Hi, I'm D.A.I.V.E., your AI sales assistant! I'm here to help you find the perfect vehicle for your needs. This ${vehicleInfo?.year} ${vehicleInfo?.make} ${vehicleInfo?.model} is a great choice with excellent features for families, safety, and reliability. What would you like to know about it?`;
    
    setMessages([{
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString()
    }]);
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/daive/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vehicleId,
          sessionId,
          message,
          customerInfo: {
            name: 'D.A.I.V.E. Chat User',
            email: 'chat@example.com',
            dealerId: '0aa94346-ed1d-420e-8823-bcd97bf6456f' // Add dealerId for proper API key lookup
          }
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.data.response,
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
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
      
      // Remove the user message if it failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceSubmission = async (audioBlob: Blob) => {
    console.log('🎵 Processing voice submission:', {
      size: formatFileSize(audioBlob.size),
      type: audioBlob.type
    });

    setIsLoading(true);
    toast.info('Processing your voice message...');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-test.wav');
      formData.append('vehicleId', vehicleId);
      formData.append('sessionId', sessionId);
      formData.append('customerInfo', JSON.stringify({
        name: 'D.A.I.V.E. Chat User',
        email: 'chat@example.com',
        dealerId: '0aa94346-ed1d-420e-8823-bcd97bf6456f'
      }));

      console.log('📤 Sending voice data to backend:', {
        size: formatFileSize(audioBlob.size),
        vehicleId,
        sessionId,
        dealerId: '0aa94346-ed1d-420e-8823-bcd97bf6456f',
        url: 'http://localhost:3000/api/daive/voice'
      });

      const response = await fetch('http://localhost:3000/api/daive/voice', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voice API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔍 Raw API Response:', data);

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
            timestamp: new Date().toISOString()
          };

          // Add assistant response
          const assistantMessage: Message = {
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date().toISOString()
          };

          setMessages(prev => [...prev, userMessage, assistantMessage]);

          // Play audio response if available
          if (audioResponseUrl) {
            const audio = new Audio(`http://localhost:3000${audioResponseUrl}`);
            audio.play().catch(err => {
              console.log('Could not play audio response:', err);
            });
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
      console.error('❌ Error processing voice message:', error);
      toast.error('Failed to process voice message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && inputMessage.trim()) {
      sendMessage(inputMessage);
    }
  };

  const toggleVoiceMode = () => {
    setIsVoiceEnabled(!isVoiceEnabled);
    if (!isVoiceEnabled) {
      toast.info('Voice mode enabled. Click the microphone to record.');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">D</span>
          </div>
          D.A.I.V.E. Assistant
          <Badge variant="secondary" className="ml-auto">
            {vehicleInfo ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}` : 'AI'}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
          <div className="space-y-4 pb-4">
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
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
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
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

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

        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleVoiceMode}
              className={isVoiceEnabled ? 'bg-blue-50 border-blue-200' : ''}
              disabled={isLoading}
            >
              {isVoiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            {isVoiceEnabled && (
              <VoiceRecorder
                onVoiceSubmit={handleVoiceSubmission}
                disabled={isLoading}
              />
            )}
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !inputMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};

export default DAIVEChat; 
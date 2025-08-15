import React, { useState } from 'react';
import { StructuredResponse, responseTemplates } from './StructuredResponse';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Bot, User } from 'lucide-react';

// Example of how to use StructuredResponse in your D.A.I.V.E. AI Bot
export const StructuredResponseExample: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Array<{
    id: string;
    type: 'user' | 'ai';
    content: string | React.ReactNode;
    timestamp: string;
  }>>([
    {
      id: '1',
      type: 'user',
      content: "I'm interested in scheduling a test drive. What's the process like?",
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  const handleOptionSelect = (optionNumber: string) => {
    setSelectedOption(optionNumber);
    
    // Add the AI response with structured options
    const newMessage = {
      id: Date.now().toString(),
      type: 'ai' as const,
      content: (
        <StructuredResponse
          template={responseTemplates.testDriveOptions}
          onOptionSelect={(selected) => {
            console.log('User selected option:', selected);
            // Handle the selection - you can add more conversation here
            setConversation(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              type: 'user',
              content: `I choose option ${selected}`,
              timestamp: new Date().toLocaleTimeString()
            }]);
          }}
          variant="default"
        />
      ),
      timestamp: new Date().toLocaleTimeString()
    };
    
    setConversation(prev => [...prev, newMessage]);
  };

  const addUserMessage = (message: string) => {
    const newMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: message,
      timestamp: new Date().toLocaleTimeString()
    };
    setConversation(prev => [...prev, newMessage]);
  };

  const addAIResponse = (template: any) => {
    const newMessage = {
      id: Date.now().toString(),
      type: 'ai' as const,
      content: (
        <StructuredResponse
          template={template}
          onOptionSelect={(selected) => {
            console.log('User selected option:', selected);
            addUserMessage(`I choose option ${selected}`);
          }}
          variant="default"
        />
      ),
      timestamp: new Date().toLocaleTimeString()
    };
    setConversation(prev => [...prev, newMessage]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            D.A.I.V.E. AI Bot - Structured Response Example
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            This example shows how to use structured responses with list-based options in your AI bot.
          </p>
          
          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button 
              variant="outline" 
              onClick={() => addAIResponse(responseTemplates.testDriveOptions)}
            >
              🚗 Test Drive Options
            </Button>
            <Button 
              variant="outline" 
              onClick={() => addAIResponse(responseTemplates.vehicleSelection)}
            >
              🚙 Vehicle Selection
            </Button>
            <Button 
              variant="outline" 
              onClick={() => addAIResponse(responseTemplates.serviceOptions)}
            >
              🔧 Service Options
            </Button>
            <Button 
              variant="outline" 
              onClick={() => addAIResponse(responseTemplates.financingOptions)}
            >
              💰 Financing Options
            </Button>
          </div>

          {/* Conversation Display */}
          <div className="space-y-4">
            {conversation.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.type === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                
                <div className={`max-w-[80%] ${
                  message.type === 'user' ? 'order-first' : 'order-last'
                }`}>
                  {typeof message.content === 'string' ? (
                    <Card className={message.type === 'user' ? 'bg-primary text-primary-foreground' : ''}>
                      <CardContent className="p-3">
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">{message.timestamp}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="relative">
                      {message.content}
                      <p className="text-xs text-muted-foreground mt-1 text-center">{message.timestamp}</p>
                    </div>
                  )}
                </div>

                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Selected Option Display */}
          {selectedOption && (
            <Card className="mt-6 border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Selected Option
                  </Badge>
                  <span className="font-medium">Option {selectedOption}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  User selected option {selectedOption} from the structured response.
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Variant Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Response Variants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Compact Variant:</h4>
            <StructuredResponse
              template={responseTemplates.testDriveOptions}
              variant="compact"
              onOptionSelect={(option) => console.log('Compact option selected:', option)}
            />
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Detailed Variant:</h4>
            <StructuredResponse
              template={responseTemplates.vehicleSelection}
              variant="detailed"
              onOptionSelect={(option) => console.log('Detailed option selected:', option)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StructuredResponseExample;

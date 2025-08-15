import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Car, Wrench, DollarSign, MessageSquare } from 'lucide-react';

interface StructuredResponse {
  title: string;
  message: string;
  type: string;
  options: Array<{
    number: string;
    title: string;
    description: string;
    details: string;
  }>;
  footer: string;
}

const StructuredResponseDemo: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Array<{
    id: string;
    type: 'user' | 'ai';
    content: string | StructuredResponse;
    timestamp: string;
  }>>([
    {
      id: '1',
      type: 'user',
      content: "I'm interested in scheduling a test drive. What's the process like?",
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  // Sample structured response templates
  const responseTemplates = {
    testDrive: {
      title: "🚗 Test Drive Scheduling Options",
      message: "Great! Here are your test drive options:",
      type: 'test-drive',
      options: [
        {
          number: "1",
          title: "Choose Your Vehicle",
          description: "Select from our available inventory",
          details: "We have SUVs, Sedans, Trucks, and more"
        },
        {
          number: "2", 
          title: "Select Time & Date",
          description: "Pick from available slots",
          details: "Monday-Saturday, 9 AM - 6 PM"
        },
        {
          number: "3",
          title: "Required Documents",
          description: "What you need to bring",
          details: "Driver's license and proof of insurance"
        }
      ],
      footer: "Which option would you like to start with?"
    },

    vehicleSelection: {
      title: "🚙 Available Vehicle Options",
      message: "Here are our current vehicles:",
      type: 'vehicle',
      options: [
        {
          number: "1",
          title: "SUV Category",
          description: "Family-friendly options",
          details: "Honda CR-V, Toyota RAV4, Ford Explorer"
        },
        {
          number: "2",
          title: "Sedan Category", 
          description: "Efficient daily drivers",
          details: "Honda Accord, Toyota Camry, Ford Fusion"
        },
        {
          number: "3",
          title: "Truck Category",
          description: "Work and utility vehicles",
          details: "Ford F-150, Chevrolet Silverado, Ram 1500"
        }
      ],
      footer: "Which vehicle type interests you?"
    },

    serviceOptions: {
      title: "🔧 Service & Maintenance Options",
      message: "Here are our service offerings:",
      type: 'service',
      options: [
        {
          number: "1",
          title: "Oil Change Service",
          description: "Regular maintenance",
          details: "Synthetic oil, filter replacement, inspection"
        },
        {
          number: "2",
          title: "Brake Service",
          description: "Safety maintenance",
          details: "Pad replacement, rotor inspection, fluid check"
        },
        {
          number: "3",
          title: "Tire Service",
          description: "Tire maintenance",
          details: "Rotation, balancing, alignment, replacement"
        }
      ],
      footer: "What service do you need today?"
    },

    financingOptions: {
      title: "💰 Financing & Payment Options",
      message: "Here are your financing choices:",
      type: 'financing',
      options: [
        {
          number: "1",
          title: "Traditional Auto Loan",
          description: "Standard financing",
          details: "Competitive rates, flexible terms"
        },
        {
          number: "2",
          title: "Lease Options",
          description: "Lower monthly payments",
          details: "New vehicle every few years"
        },
        {
          number: "3",
          title: "Cash Purchase",
          description: "Full payment",
          details: "No interest, immediate ownership"
        }
      ],
      footer: "Which financing option works best for you?"
    }
  };

  const handleOptionSelect = (optionNumber: string, messageIndex: number) => {
    setSelectedOption(optionNumber);
    
    const message = conversation[messageIndex];
    if (message.type === 'ai' && typeof message.content !== 'string') {
      const structuredResponse = message.content as StructuredResponse;
      const selectedOption = structuredResponse.options.find(opt => opt.number === optionNumber);
      
      if (selectedOption) {
        // Add user's selection as a message
        const userSelectionMessage = {
          id: Date.now().toString(),
          type: 'user' as const,
          content: `I choose option ${optionNumber}: ${selectedOption.title}`,
          timestamp: new Date().toLocaleTimeString()
        };
        
        setConversation(prev => [...prev, userSelectionMessage]);
      }
    }
  };

  const addAIResponse = (template: StructuredResponse) => {
    const newMessage = {
      id: Date.now().toString(),
      type: 'ai' as const,
      content: template,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setConversation(prev => [...prev, newMessage]);
  };

  const renderStructuredResponse = (response: StructuredResponse, messageIndex: number) => {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="mb-3">
          <h4 className="font-semibold text-gray-900 mb-1">{response.title}</h4>
          <p className="text-sm text-gray-600">{response.message}</p>
        </div>
        
        <div className="space-y-2 mb-3">
          {response.options.map((option) => (
            <div
              key={option.number}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => handleOptionSelect(option.number, messageIndex)}
            >
              <Badge variant="outline" className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
                {option.number}
              </Badge>
              <div className="flex-1">
                <h5 className="font-medium text-sm text-gray-900">{option.title}</h5>
                <p className="text-xs text-gray-600">{option.description}</p>
                <p className="text-xs text-gray-500 mt-1">{option.details}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          ))}
        </div>
        
        <p className="text-sm font-medium text-blue-600 text-center">{response.footer}</p>
      </div>
    );
  };

  const renderMessageContent = (message: any, index: number) => {
    if (typeof message.content === 'string') {
      return (
        <p className="text-sm">{message.content}</p>
      );
    } else {
      return renderStructuredResponse(message.content, index);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              D.A.I.V.E. AI Bot - Structured Response Demo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This demo shows how structured responses with list-based options work in your AI bot.
              Users can click on options to make selections, creating a more interactive experience.
            </p>
            
            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Button 
                variant="outline" 
                onClick={() => addAIResponse(responseTemplates.testDrive)}
                className="flex items-center gap-2"
              >
                <Car className="h-4 w-4" />
                Test Drive Options
              </Button>
              <Button 
                variant="outline" 
                onClick={() => addAIResponse(responseTemplates.vehicleSelection)}
                className="flex items-center gap-2"
              >
                <Car className="h-4 w-4" />
                Vehicle Selection
              </Button>
              <Button 
                variant="outline" 
                onClick={() => addAIResponse(responseTemplates.serviceOptions)}
                className="flex items-center gap-2"
              >
                <Wrench className="h-4 w-4" />
                Service Options
              </Button>
              <Button 
                variant="outline" 
                onClick={() => addAIResponse(responseTemplates.financingOptions)}
                className="flex items-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Financing Options
              </Button>
            </div>

            {/* Conversation Display */}
            <div className="space-y-4">
              {conversation.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.type === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">AI</span>
                    </div>
                  )}
                  
                  <div className={`max-w-[80%] ${
                    message.type === 'user' ? 'order-first' : 'order-last'
                  }`}>
                    {typeof message.content === 'string' ? (
                      <Card className={message.type === 'user' ? 'bg-blue-500 text-white' : ''}>
                        <CardContent className="p-3">
                          <p className="text-sm">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">{message.timestamp}</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="relative">
                        {renderMessageContent(message, index)}
                        <p className="text-xs text-muted-foreground mt-1 text-center">{message.timestamp}</p>
                      </div>
                    )}
                  </div>

                  {message.type === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-600 text-xs font-bold">U</span>
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

        {/* Integration Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Integrate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">1. Backend Response Format</h4>
              <p className="text-sm text-muted-foreground">
                Your AI backend should return responses in this format when you want structured options:
              </p>
              <pre className="bg-gray-100 p-3 rounded text-xs mt-2 overflow-x-auto">
{`{
  "response": {
    "title": "🚗 Available Vehicles",
    "message": "Here are your options:",
    "type": "inventory",
    "options": [
      {
        "number": "1",
        "title": "Vehicle Name",
        "description": "Brief description",
        "details": "Additional details"
      }
    ],
    "footer": "What would you like to choose?"
  }
}`}
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">2. Frontend Handling</h4>
              <p className="text-sm text-muted-foreground">
                The frontend automatically detects structured responses and renders them as interactive options.
                Users can click on options to make selections.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">3. Benefits</h4>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Better user experience with clear, organized options</li>
                <li>Interactive responses that guide users through processes</li>
                <li>Consistent, professional appearance</li>
                <li>Mobile-friendly design</li>
                <li>Easy to maintain and update</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StructuredResponseDemo;

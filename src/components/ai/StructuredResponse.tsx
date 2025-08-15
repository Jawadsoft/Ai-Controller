import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, ChevronRight, Car, Wrench, DollarSign, Calendar } from 'lucide-react';

interface Option {
  number: string;
  title: string;
  description: string;
  details: string;
}

interface ResponseTemplate {
  title: string;
  message: string;
  options: Option[];
  footer: string;
  type?: 'test-drive' | 'vehicle' | 'service' | 'financing';
}

interface StructuredResponseProps {
  template: ResponseTemplate;
  onOptionSelect?: (optionNumber: string) => void;
  variant?: 'default' | 'compact' | 'detailed';
}

const getIconForType = (type?: string) => {
  switch (type) {
    case 'test-drive':
      return <Car className="h-5 w-5" />;
    case 'vehicle':
      return <Car className="h-5 w-5" />;
    case 'service':
      return <Wrench className="h-5 w-5" />;
    case 'financing':
      return <DollarSign className="h-5 w-5" />;
    default:
      return <CheckCircle className="h-5 w-5" />;
  }
};

const getColorForType = (type?: string) => {
  switch (type) {
    case 'test-drive':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'vehicle':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'service':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'financing':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

export const StructuredResponse: React.FC<StructuredResponseProps> = ({
  template,
  onOptionSelect,
  variant = 'default'
}) => {
  const handleOptionClick = (optionNumber: string) => {
    if (onOptionSelect) {
      onOptionSelect(optionNumber);
    }
  };

  if (variant === 'compact') {
    return (
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {getIconForType(template.type)}
            {template.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{template.message}</p>
          
          <div className="space-y-2">
            {template.options.map((option) => (
              <div
                key={option.number}
                className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleOptionClick(option.number)}
              >
                <Badge variant="outline" className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
                  {option.number}
                </Badge>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{option.title}</h4>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
          
          <p className="text-sm font-medium text-primary">{template.footer}</p>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'detailed') {
    return (
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            {getIconForType(template.type)}
            {template.title}
          </CardTitle>
          <p className="text-muted-foreground">{template.message}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {template.options.map((option) => (
            <div
              key={option.number}
              className="p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer"
              onClick={() => handleOptionClick(option.number)}
            >
              <div className="flex items-start gap-4">
                <Badge 
                  variant="outline" 
                  className={`w-10 h-10 rounded-full p-0 flex items-center justify-center text-lg font-bold ${getColorForType(template.type)}`}
                >
                  {option.number}
                </Badge>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold mb-2">{option.title}</h4>
                  <p className="text-muted-foreground mb-2">{option.description}</p>
                  <p className="text-sm bg-muted/50 p-2 rounded">{option.details}</p>
                </div>
                <Button variant="ghost" size="sm" className="mt-2">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          
          <div className="pt-4 border-t">
            <p className="text-lg font-semibold text-primary text-center">{template.footer}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {getIconForType(template.type)}
          {template.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{template.message}</p>
        
        <div className="space-y-2">
          {template.options.map((option) => (
            <div
              key={option.number}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleOptionClick(option.number)}
            >
              <Badge variant="outline" className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
                {option.number}
              </Badge>
              <div className="flex-1">
                <h4 className="font-medium">{option.title}</h4>
                <p className="text-sm text-muted-foreground">{option.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{option.details}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
        
        <p className="text-sm font-medium text-primary text-center pt-2">{template.footer}</p>
      </CardContent>
    </Card>
  );
};

// Predefined response templates
export const responseTemplates = {
  testDriveOptions: {
    title: "🚗 Test Drive Scheduling Options",
    message: "Great! Here are your test drive options:",
    type: 'test-drive' as const,
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
    type: 'vehicle' as const,
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
    type: 'service' as const,
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
    type: 'financing' as const,
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

export default StructuredResponse;

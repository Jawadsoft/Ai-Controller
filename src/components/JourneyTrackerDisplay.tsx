import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ChevronDown, ChevronUp, CheckCircle, Circle, SkipForward, ArrowLeft, ArrowRight, Clock, Target, User, Car, CreditCard, Truck, HeadphonesIcon, Loader2 } from 'lucide-react';

interface JourneyStep {
  step: number;
  name: string;
  description: string;
  required: boolean;
  mandatory: boolean;
  agent: string;
  phase: string;
}

interface JourneyStatus {
  sessionId: string;
  currentStep: number;
  currentStepName: string;
  currentStepDescription: string;
  currentStepQuestion: string;
  currentStepIntent: string;
  currentStepAgent: string;
  currentPhase: string;
  completedSteps: number[];
  skippedSteps: number[];
  totalSteps: number;
  completedCount: number;
  skippedCount: number;
  progressPercentage: number;
  mandatoryProgress: number;
  mandatoryStepsCompleted: number;
  totalMandatorySteps: number;
  nextSteps: JourneyStep[];
  journeyStartTime: string;
  lastUpdated: string;
  estimatedTimeRemaining: {
    remainingSteps: number;
    estimatedMinutes: number;
    estimatedTimeString: string;
  };
  preferences: Record<string, any>;
  remainingSteps: number;
}

interface JourneyTrackerDisplayProps {
  sessionId: string;
  className?: string;
}

const JourneyTrackerDisplay: React.FC<JourneyTrackerDisplayProps> = ({ sessionId, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [journeyStatus, setJourneyStatus] = useState<JourneyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mock journey status for demonstration (replace with real API call)
  useEffect(() => {
    if (sessionId) {
      // Simulate journey tracking - replace this with actual API call
      const mockJourneyStatus: JourneyStatus = {
        sessionId,
        currentStep: 3,
        currentStepName: "Define Budget",
        currentStepDescription: "Establish budget range and constraints",
        currentStepQuestion: "What's your budget range?",
        currentStepIntent: "budget",
        currentStepAgent: "sales_consultant",
        currentPhase: "lead_qualification",
        completedSteps: [1, 2],
        skippedSteps: [],
        totalSteps: 16,
        completedCount: 2,
        skippedCount: 0,
        progressPercentage: 12,
        mandatoryProgress: 25,
        mandatoryStepsCompleted: 2,
        totalMandatorySteps: 8,
        nextSteps: [
          {
            step: 4,
            name: "Select Features / Needs",
            description: "Identify key features and requirements",
            required: true,
            mandatory: true,
            agent: "sales_consultant",
            phase: "lead_qualification"
          },
          {
            step: 5,
            name: "Check Preferred Brand",
            description: "Determine brand preferences",
            required: false,
            mandatory: false,
            agent: "sales_consultant",
            phase: "lead_qualification"
          }
        ],
        journeyStartTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
        lastUpdated: new Date().toISOString(),
        estimatedTimeRemaining: {
          remainingSteps: 14,
          estimatedMinutes: 49,
          estimatedTimeString: "49 minutes"
        },
        preferences: {
          vehicle_condition: "new",
          body_style: "SUV"
        },
        remainingSteps: 14
      };
      
      setJourneyStatus(mockJourneyStatus);
    }
  }, [sessionId]);

  const getStepIcon = (stepNumber: number, isCompleted: boolean, isSkipped: boolean, isCurrent: boolean) => {
    if (isCompleted) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (isSkipped) return <SkipForward className="w-4 h-4 text-orange-500" />;
    if (isCurrent) return <Target className="w-4 h-4 text-primary" />;
    return <Circle className="w-4 h-4 text-gray-400" />;
  };

  const getAgentIcon = (agent: string) => {
    switch (agent) {
      case 'sales_consultant':
        return <User className="w-4 h-4" />;
      case 'finance':
        return <CreditCard className="w-4 h-4" />;
      case 'inventory_crew':
        return <Truck className="w-4 h-4" />;
      case 'customer_service':
        return <HeadphonesIcon className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getPhaseColor = (phase: string) => {
    return phase === 'lead_qualification' ? 'bg-primary/15 text-primary' : 'bg-green-100 text-green-800';
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!journeyStatus) {
    return (
      <Card className={`${className} border-dashed`}>
        <CardContent className="p-4 text-center text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p>Initializing journey tracking...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} transition-all duration-300`}>
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Car className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Client Journey Tracker</CardTitle>
            <Badge variant="outline" className={getPhaseColor(journeyStatus.currentPhase)}>
              {journeyStatus.currentPhase.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              Step {journeyStatus.currentStep}/16
            </Badge>
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Step Display */}
        <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
          <div className="flex items-center space-x-3 mb-3">
            <Target className="w-6 h-6 text-primary" />
            <div>
              <h3 className="font-semibold text-primary">
                Current Step: {journeyStatus.currentStepName}
              </h3>
              <p className="text-sm text-primary/90">{journeyStatus.currentStepDescription}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">
                Agent: {journeyStatus.currentStepAgent.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">
                Estimated time remaining: {journeyStatus.estimatedTimeRemaining.estimatedTimeString}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Overall Progress</span>
              <span>{journeyStatus.progressPercentage}%</span>
            </div>
            <Progress value={journeyStatus.progressPercentage} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Mandatory Steps</span>
              <span>{journeyStatus.mandatoryProgress}%</span>
            </div>
            <Progress value={journeyStatus.mandatoryProgress} className="h-2" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{journeyStatus.completedCount}</div>
            <div className="text-xs text-green-700">Completed</div>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{journeyStatus.skippedCount}</div>
            <div className="text-xs text-orange-700">Skipped</div>
          </div>
          <div className="bg-primary/10 p-3 rounded-lg">
            <div className="text-2xl font-bold text-primary">{journeyStatus.remainingSteps}</div>
            <div className="text-xs text-primary/90">Remaining</div>
          </div>
        </div>

        {/* Expandable Details */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            {/* Next Steps */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center space-x-2">
                <ArrowRight className="w-4 h-4" />
                <span>Next Steps</span>
              </h4>
              <div className="space-y-2">
                {journeyStatus.nextSteps.map((step) => (
                  <div key={step.step} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                    <Badge variant="outline" className="min-w-[40px]">
                      {step.step}
                    </Badge>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{step.name}</div>
                      <div className="text-xs text-gray-600">{step.description}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getAgentIcon(step.agent)}
                      {step.mandatory ? (
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Optional</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* All Steps Overview */}
            <div>
              <h4 className="font-semibold mb-3">All 16 Steps</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {Array.from({ length: 16 }, (_, i) => {
                  const stepNumber = i + 1;
                  const isCompleted = journeyStatus.completedSteps.includes(stepNumber);
                  const isSkipped = journeyStatus.skippedSteps.includes(stepNumber);
                  const isCurrent = stepNumber === journeyStatus.currentStep;
                  
                  return (
                    <div
                      key={stepNumber}
                      className={`flex items-center space-x-2 p-2 rounded text-sm ${
                        isCurrent ? 'bg-primary/15 border border-primary/25' :
                        isCompleted ? 'bg-green-100' :
                        isSkipped ? 'bg-orange-100' : 'bg-gray-100'
                      }`}
                    >
                      {getStepIcon(stepNumber, isCompleted, isSkipped, isCurrent)}
                      <span className="font-medium">Step {stepNumber}</span>
                      <span className="text-xs text-gray-600">
                        {stepNumber <= 8 ? 'Lead Qual.' : 'Purchase'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preferences */}
            {Object.keys(journeyStatus.preferences).length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">Collected Preferences</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(journeyStatus.preferences).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 p-2 rounded text-sm">
                      <span className="font-medium">{key.replace('_', ' ')}:</span>
                      <span className="ml-2 text-gray-600">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Journey Timeline */}
            <div>
              <h4 className="font-semibold mb-3">Journey Timeline</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Started:</span>
                  <span>{formatTime(journeyStatus.journeyStartTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Updated:</span>
                  <span>{formatTime(journeyStatus.lastUpdated)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Session ID:</span>
                  <span className="font-mono text-xs">{journeyStatus.sessionId}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full"
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default JourneyTrackerDisplay;


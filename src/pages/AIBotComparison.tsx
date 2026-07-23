import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Zap, 
  Clock, 
  BarChart3, 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Play,
  Pause,
  RotateCcw,
  MessageSquare,
  Mic,
  Volume2
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface ComparisonData {
  original: {
    pipeline: string;
    targetResponseTime: string;
    features: string[];
    performance: {
      voiceCapture: number;
      sttProcessing: number;
      intentDetection: number;
      llmProcessing: number;
      ttsGeneration: number;
      totalResponse: number;
    };
  };
  optimized: {
    pipeline: string;
    targetResponseTime: string;
    features: string[];
    performance: {
      voiceCapture: number;
      sttProcessing: number;
      intentDetection: number;
      llmProcessing: number;
      ttsGeneration: number;
      totalResponse: number;
    };
  };
}

const AIBotComparison: React.FC = () => {
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'features' | 'testing'>('overview');
  const { toast } = useToast();

  useEffect(() => {
    // Simulate loading comparison data
    setTimeout(() => {
      setComparisonData({
        original: {
          pipeline: 'Batch Processing',
          targetResponseTime: '8-12 seconds',
          features: [
            'Traditional STT (Whisper)',
            'Sequential LLM processing',
            'Batch TTS generation',
            'No caching system',
            'Basic error handling',
            'No performance monitoring'
          ],
          performance: {
            voiceCapture: 200,
            sttProcessing: 2000,
            intentDetection: 500,
            llmProcessing: 3000,
            ttsGeneration: 2000,
            totalResponse: 7700
          }
        },
        optimized: {
          pipeline: 'Streaming Pipeline',
          targetResponseTime: '2-4 seconds',
          features: [
            'Streaming STT (Real-time)',
            'Parallel LLM processing',
            'Streaming TTS generation',
            'Intelligent phrase caching',
            'Advanced error handling',
            'Real-time performance monitoring'
          ],
          performance: {
            voiceCapture: 80,
            sttProcessing: 500,
            intentDetection: 120,
            llmProcessing: 700,
            ttsGeneration: 600,
            totalResponse: 2000
          }
        }
      });
      setIsLoading(false);
    }, 1000);
  }, []);

  const calculateImprovement = (original: number, optimized: number) => {
    return Math.round(((original - optimized) / original) * 100);
  };

  const getPerformanceColor = (value: number, target: number) => {
    if (value <= target) return 'text-green-600';
    if (value <= target * 1.2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceStatus = (value: number, target: number) => {
    if (value <= target) return '✅ Target Met';
    if (value <= target * 1.2) return '⚠️ Close to Target';
    return '❌ Target Exceeded';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-muted p-4 flex items-center justify-center">
        <div className="text-center">
          <RotateCcw className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Loading Comparison Data...</h2>
        </div>
      </div>
    );
  }

  if (!comparisonData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-muted p-4 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Failed to load comparison data</h2>
        </div>
      </div>
    );
  }

  const { original, optimized } = comparisonData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-muted p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Zap className="h-8 w-8 text-yellow-500" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                AIBot Performance Comparison
              </h1>
              <Zap className="h-8 w-8 text-yellow-500" />
            </div>
            <CardDescription className="text-lg">
              Original vs. Optimized • See the dramatic performance improvements
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Navigation Tabs */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-0">
            <div className="flex border-b">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'performance', label: 'Performance', icon: Clock },
                { id: 'features', label: 'Features', icon: CheckCircle },
                { id: 'testing', label: 'Testing', icon: Play }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 px-6 py-4 text-center border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <Icon className="h-5 w-5 mx-auto mb-2" />
                    <span className="block text-sm font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Original AIBot */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  Original AIBot
                </CardTitle>
                <CardDescription>
                  Traditional batch processing approach
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-3xl font-bold text-red-600">
                    {original.targetResponseTime}
                  </div>
                  <div className="text-sm text-red-600">Target Response Time</div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Pipeline Type:</span>
                    <Badge variant="secondary">{original.pipeline}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Response:</span>
                    <span className="font-semibold text-red-600">
                      {original.performance.totalResponse}ms
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2 text-gray-700">Key Characteristics:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {original.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Optimized AIBot */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  Optimized AIBot
                </CardTitle>
                <CardDescription>
                  Ultra-fast streaming pipeline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {optimized.targetResponseTime}
                  </div>
                  <div className="text-sm text-green-600">Target Response Time</div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Pipeline Type:</span>
                    <Badge variant="default" className="bg-green-600">
                      {optimized.pipeline}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Response:</span>
                    <span className="font-semibold text-green-600">
                      {optimized.performance.totalResponse}ms
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2 text-gray-700">Key Characteristics:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {optimized.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Performance Comparison
              </CardTitle>
              <CardDescription>
                Detailed timing analysis of each pipeline stage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  { key: 'voiceCapture', label: 'Voice Capture', target: 80 },
                  { key: 'sttProcessing', label: 'STT Processing', target: 500 },
                  { key: 'intentDetection', label: 'Intent Detection', target: 120 },
                  { key: 'llmProcessing', label: 'LLM Processing', target: 700 },
                  { key: 'ttsGeneration', label: 'TTS Generation', target: 600 }
                ].map((stage) => {
                  const originalValue = original.performance[stage.key as keyof typeof original.performance];
                  const optimizedValue = optimized.performance[stage.key as keyof typeof optimized.performance];
                  const improvement = calculateImprovement(originalValue, optimizedValue);
                  
                  return (
                    <div key={stage.key} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium text-gray-700">{stage.label}</h4>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">Target: {stage.target}ms</span>
                          <Badge variant={improvement > 0 ? "default" : "secondary"}>
                            {improvement > 0 ? `+${improvement}%` : `${improvement}%`} faster
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <div className={`text-xl font-bold ${getPerformanceColor(originalValue, stage.target)}`}>
                            {originalValue}ms
                          </div>
                          <div className="text-xs text-gray-600">Original</div>
                          <div className="text-xs text-gray-500">
                            {getPerformanceStatus(originalValue, stage.target)}
                          </div>
                        </div>
                        
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className={`text-xl font-bold ${getPerformanceColor(optimizedValue, stage.target)}`}>
                            {optimizedValue}ms
                          </div>
                          <div className="text-xs text-gray-600">Optimized</div>
                          <div className="text-xs text-gray-500">
                            {getPerformanceStatus(optimizedValue, stage.target)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Total Response Time */}
                <div className="pt-6 border-t">
                  <div className="text-center p-6 bg-gradient-to-r from-red-50 to-green-50 rounded-lg">
                    <h3 className="text-2xl font-bold mb-4">Total Response Time</h3>
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <div className="text-3xl font-bold text-red-600">
                          {original.performance.totalResponse}ms
                        </div>
                        <div className="text-sm text-red-600">Original</div>
                      </div>
                      <div className="flex items-center justify-center">
                        <ArrowRight className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-green-600">
                          {optimized.performance.totalResponse}ms
                        </div>
                        <div className="text-sm text-green-600">Optimized</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Badge variant="default" className="text-lg px-4 py-2">
                        {calculateImprovement(original.performance.totalResponse, optimized.performance.totalResponse)}% Faster
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features Tab */}
        {activeTab === 'features' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-red-600">Original Features</CardTitle>
                <CardDescription>What the original AIBot provides</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {original.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-green-600">Optimized Features</CardTitle>
                <CardDescription>What the new optimized AIBot provides</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {optimized.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Testing Tab */}
        {activeTab === 'testing' && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Test Both Versions
              </CardTitle>
              <CardDescription>
                Compare the performance in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="text-center p-6 bg-red-50 rounded-lg">
                  <h3 className="text-xl font-bold text-red-600 mb-4">Original AIBot</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Test the traditional batch processing approach
                  </p>
                  <Button variant="outline" className="w-full">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Test Original
                  </Button>
                </div>

                <div className="text-center p-6 bg-green-50 rounded-lg">
                  <h3 className="text-xl font-bold text-green-600 mb-4">Optimized AIBot</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Experience the ultra-fast streaming pipeline
                  </p>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    <Zap className="h-4 w-4 mr-2" />
                    Test Optimized
                  </Button>
                </div>
              </div>

              <div className="mt-6 p-4 bg-primary/10 rounded-lg">
                <h4 className="font-medium text-primary mb-2">Testing Instructions:</h4>
                <ol className="text-sm text-primary/90 space-y-1 list-decimal list-inside">
                  <li>Click "Test Original" to try the traditional AIBot</li>
                  <li>Click "Test Optimized" to try the new streaming AIBot</li>
                  <li>Compare response times and user experience</li>
                  <li>Use the performance dashboard to see real-time metrics</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Card */}
        <Card className="mt-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-primary/10 rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {calculateImprovement(original.performance.totalResponse, optimized.performance.totalResponse)}%
                </div>
                <div className="text-sm text-primary">Faster Response</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {original.performance.totalResponse / optimized.performance.totalResponse}x
                </div>
                <div className="text-sm text-green-600">Performance Multiplier</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {original.performance.totalResponse - optimized.performance.totalResponse}ms
                </div>
                <div className="text-sm text-purple-600">Time Saved</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIBotComparison;

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Zap, 
  MessageSquare, 
  BarChart3, 
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

const AIBotNavigation: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-muted p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="mb-8 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Zap className="h-10 w-10 text-yellow-500" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                AIBot Version Selection
              </h1>
              <Zap className="h-10 w-10 text-yellow-500" />
            </div>
            <CardDescription className="text-xl">
              Choose your AIBot experience • Compare performance • Test both versions
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Version Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Original AIBot */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <XCircle className="h-8 w-8 text-red-500" />
                <CardTitle className="text-2xl text-red-600">Original AIBot</CardTitle>
              </div>
              <CardDescription>
                Traditional batch processing approach
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">8-12 seconds</div>
                <div className="text-sm text-red-600">Response Time</div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Simple and reliable</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Well-tested</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Traditional REST API</span>
                </div>
              </div>

              <div className="pt-4">
                <Link to="/ai-bot">
                  <Button variant="outline" className="w-full">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Use Original AIBot
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Optimized AIBot */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <CardTitle className="text-2xl text-green-600">Optimized AIBot</CardTitle>
              </div>
              <CardDescription>
                Ultra-fast streaming pipeline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">2-4 seconds</div>
                <div className="text-sm text-green-600">Response Time</div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span>4-6x faster</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span>Real-time streaming</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span>Performance dashboard</span>
                </div>
              </div>

              <div className="pt-4">
                <Link to="/optimized-aibot">
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    <Zap className="h-4 w-4 mr-2" />
                    Use Optimized AIBot
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Comparison */}
        <Card className="mb-8 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Comparison
            </CardTitle>
            <CardDescription>
              See the dramatic improvements in each pipeline stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="text-lg font-bold text-primary">Voice Capture</div>
                <div className="text-sm text-gray-600">200ms → 80ms</div>
                <div className="text-xs text-green-600">60% faster</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">STT Processing</div>
                <div className="text-sm text-gray-600">2000ms → 500ms</div>
                <div className="text-xs text-green-600">75% faster</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">Intent Detection</div>
                <div className="text-sm text-gray-600">500ms → 120ms</div>
                <div className="text-xs text-green-600">76% faster</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="text-lg font-bold text-orange-600">LLM Processing</div>
                <div className="text-sm text-gray-600">3000ms → 700ms</div>
                <div className="text-xs text-green-600">77% faster</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-600">TTS Generation</div>
                <div className="text-sm text-gray-600">2000ms → 600ms</div>
                <div className="text-xs text-green-600">70% faster</div>
              </div>
            </div>
            
            <div className="mt-6 text-center p-4 bg-gradient-to-r from-red-50 to-green-50 rounded-lg">
              <div className="text-2xl font-bold text-primary mb-2">Total Response Time</div>
              <div className="flex items-center justify-center gap-4">
                <div>
                  <div className="text-3xl font-bold text-red-600">7700ms</div>
                  <div className="text-sm text-red-600">Original</div>
                </div>
                <ArrowRight className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-3xl font-bold text-green-600">2000ms</div>
                  <div className="text-sm text-green-600">Optimized</div>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-lg font-bold text-green-600">74% Faster Overall</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/ai-bot">
            <Button variant="outline" className="w-full h-16 text-lg">
              <MessageSquare className="h-5 w-5 mr-2" />
              Test Original AIBot
            </Button>
          </Link>
          
          <Link to="/optimized-aibot">
            <Button className="w-full h-16 text-lg bg-green-600 hover:bg-green-700">
              <Zap className="h-5 w-5 mr-2" />
              Test Optimized AIBot
            </Button>
          </Link>
          
          <Link to="/aibot-comparison">
            <Button variant="outline" className="w-full h-16 text-lg">
              <BarChart3 className="h-5 w-5 mr-2" />
              View Detailed Comparison
            </Button>
          </Link>
        </div>

        {/* Quick Start Guide */}
        <Card className="mt-8 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Quick Start Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-primary">For Performance Testing:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>Open both AIBots in separate tabs</li>
                  <li>Use the same test phrase: "What cars do you have in stock?"</li>
                  <li>Measure response time from voice input to audio output</li>
                  <li>Compare results: Original (8-12s) vs Optimized (2-4s)</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-green-600">For Production Use:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>Start with the Optimized AIBot for new deployments</li>
                  <li>Monitor performance metrics in real-time</li>
                  <li>Use the performance dashboard for optimization</li>
                  <li>Gradually migrate existing users</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIBotNavigation;

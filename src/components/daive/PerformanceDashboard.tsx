// Performance Dashboard - Real-time streaming voice metrics
// Shows performance against targets and system health

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface PerformanceMetrics {
  websocket: any;
  crewAI: any;
  tts: any;
  targets: {
    voiceCapture: number;
    sttFirstPartial: number;
    intentDetection: number;
    llmFirstToken: number;
    ttsFirstAudio: number;
    audioPlayStart: number;
    totalResponse: number;
  };
}

interface PerformanceDashboardProps {
  dealerId?: string;
  className?: string;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  dealerId,
  className = ''
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  // Fetch performance metrics
  const fetchMetrics = useCallback(async () => {
    if (!dealerId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/streaming-voice/performance', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.data);
        setLastUpdated(new Date());
      } else {
        throw new Error('Failed to fetch metrics');
      }
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch performance metrics",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [dealerId, toast]);

  // Initialize services
  const initializeServices = useCallback(async () => {
    if (!dealerId) return;
    
    try {
      const response = await fetch('/api/streaming-voice/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ dealerId })
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Streaming voice services initialized successfully",
        });
        fetchMetrics();
      } else {
        throw new Error('Failed to initialize services');
      }
    } catch (error) {
      console.error('Error initializing services:', error);
      toast({
        title: "Error",
        description: "Failed to initialize streaming voice services",
        variant: "destructive",
      });
    }
  }, [dealerId, toast, fetchMetrics]);

  // Clear cache
  const clearCache = useCallback(async () => {
    if (!dealerId) return;
    
    try {
      const response = await fetch('/api/streaming-voice/clear-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ dealerId })
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Cache cleared successfully",
        });
        fetchMetrics();
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast({
        title: "Error",
        description: "Failed to clear cache",
        variant: "destructive",
      });
    }
  }, [dealerId, toast, fetchMetrics]);

  // Preload common phrases
  const preloadPhrases = useCallback(async () => {
    if (!dealerId) return;
    
    try {
      const response = await fetch('/api/streaming-voice/preload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ dealerId })
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Common phrases preloaded successfully",
        });
        fetchMetrics();
      } else {
        throw new Error('Failed to preload phrases');
      }
    } catch (error) {
      console.error('Error preloading phrases:', error);
      toast({
        title: "Error",
        description: "Failed to preload common phrases",
        variant: "destructive",
      });
    }
  }, [dealerId, toast, fetchMetrics]);

  // Set up auto-refresh
  useEffect(() => {
    if (autoRefresh && dealerId) {
      const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
      setRefreshInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, dealerId, fetchMetrics]);

  // Initial fetch
  useEffect(() => {
    if (dealerId) {
      fetchMetrics();
    }
  }, [dealerId, fetchMetrics]);

  // Calculate performance score
  const calculatePerformanceScore = (metric: string, value: number, target: number) => {
    const ratio = value / target;
    if (ratio <= 1) return 100; // Perfect score if within target
    if (ratio <= 1.5) return Math.max(50, 100 - (ratio - 1) * 100); // Gradual degradation
    return Math.max(0, 50 - (ratio - 1.5) * 100); // Severe penalty for exceeding 1.5x target
  };

  // Get performance status
  const getPerformanceStatus = (metric: string, value: number, target: number) => {
    if (value <= target) return { status: 'success', icon: <CheckCircle className="w-4 h-4 text-green-500" /> };
    if (value <= target * 1.5) return { status: 'warning', icon: <AlertTriangle className="w-4 h-4 text-yellow-500" /> };
    return { status: 'error', icon: <AlertTriangle className="w-4 h-4 text-red-500" /> };
  };

  // Get trend indicator
  const getTrendIndicator = (current: number, previous: number) => {
    if (current < previous) return <TrendingDown className="w-4 h-4 text-green-500" />;
    if (current > previous) return <TrendingUp className="w-4 h-4 text-red-500" />;
    return null;
  };

  if (!dealerId) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Performance Dashboard</CardTitle>
          <CardDescription>Dealer ID required to view performance metrics</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className={`performance-dashboard ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Performance Dashboard</h2>
          <p className="text-gray-600">Real-time streaming voice pipeline metrics</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={initializeServices}
            disabled={isLoading}
          >
            Initialize Services
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearCache}
            disabled={isLoading}
          >
            Clear Cache
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={preloadPhrases}
            disabled={isLoading}
          >
            Preload Phrases
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Auto-refresh toggle */}
      <div className="mb-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-600">Auto-refresh every 5 seconds</span>
        </label>
        
        {lastUpdated && (
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {!metrics ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No performance data available</p>
          <Button onClick={fetchMetrics} className="mt-2">
            Load Metrics
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Performance Targets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>Performance Targets</span>
                <Badge variant="outline">Targets</Badge>
              </CardTitle>
              <CardDescription>Response time targets for optimal performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(metrics.targets).map(([key, target]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span className="text-sm font-medium">{target}ms</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* WebSocket Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>WebSocket</span>
                <Badge variant="outline">Real-time</Badge>
              </CardTitle>
              <CardDescription>WebSocket connection and streaming metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.websocket && Object.keys(metrics.websocket).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(metrics.websocket).map(([key, data]: [string, any]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="font-medium">{data.average?.toFixed(0) || 0}ms</span>
                      </div>
                      <Progress value={Math.min(100, (data.average || 0) / 100)} className="h-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No WebSocket metrics available</p>
              )}
            </CardContent>
          </Card>

          {/* CrewAI Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>CrewAI</span>
                <Badge variant="outline">AI Processing</Badge>
              </CardTitle>
              <CardDescription>AI model performance and response times</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.crewAI && Object.keys(metrics.crewAI).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(metrics.crewAI).map(([key, data]: [string, any]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="font-medium">{data.average?.toFixed(0) || 0}ms</span>
                      </div>
                      <Progress value={Math.min(100, (data.average || 0) / 100)} className="h-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No CrewAI metrics available</p>
              )}
            </CardContent>
          </Card>

          {/* TTS Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>Text-to-Speech</span>
                <Badge variant="outline">Audio Generation</Badge>
              </CardTitle>
              <CardDescription>TTS generation and caching performance</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.tts && Object.keys(metrics.tts).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(metrics.tts).map(([key, data]: [string, any]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="font-medium">{data.average?.toFixed(0) || 0}ms</span>
                      </div>
                      <Progress value={Math.min(100, (data.average || 0) / 100)} className="h-2" />
                    </div>
                  ))}
                  
                  {/* Cache stats */}
                  {metrics.tts.cacheStats && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium mb-2">Cache Performance</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Hit Rate:</span>
                          <span className="font-medium">
                            {(metrics.tts.cacheStats.hitRate * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Cache Size:</span>
                          <span className="font-medium">{metrics.tts.cacheStats.size}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No TTS metrics available</p>
              )}
            </CardContent>
          </Card>

          {/* Overall Performance Score */}
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>Overall Performance Score</CardTitle>
              <CardDescription>Combined performance across all metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(metrics.targets).map(([key, target]) => {
                  const currentValue = metrics.websocket?.[key]?.average || 
                                    metrics.crewAI?.[key]?.average || 
                                    metrics.tts?.[key]?.average || 0;
                  const score = calculatePerformanceScore(key, currentValue, target);
                  const status = getPerformanceStatus(key, currentValue, target);
                  
                  return (
                    <div key={key} className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        {status.icon}
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{score}</div>
                      <div className="text-xs text-gray-600 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {currentValue.toFixed(0)}ms / {target}ms
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;

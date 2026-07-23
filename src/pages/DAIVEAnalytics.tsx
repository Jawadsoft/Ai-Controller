import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import TopNavigation from '../components/layout/TopNavigation';
import DAIVEAnalyticsComponent from '../components/daive/DAIVEAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Brain, BarChart3, MessageSquare, Users, RefreshCw, LogOut } from 'lucide-react';

const DAIVEAnalytics: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const handleSignOut = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = '/auth';
  };

  const clearCache = () => {
    // Clear any cached data and refresh
    localStorage.removeItem('daive_analytics_cache');
    window.location.reload();
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return;
      
      try {
        const response = await fetch('/api/daive/analytics', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data.data || []);
        } else {
          console.error('Failed to fetch analytics');
          setAnalytics([]);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setAnalytics([]);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    fetchAnalytics();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <TopNavigation />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Main Analytics Component */}
        <DAIVEAnalyticsComponent />
      </main>
    </div>
  );
};

export default DAIVEAnalytics; 
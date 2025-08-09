import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import AIBotPage from '../pages/AIBotPage';
import { Card, CardContent } from './ui/card';
import { Loader2 } from 'lucide-react';

const AIBotWrapper: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [dealerId, setDealerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getDealerContext = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }

      if (!user) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Getting dealer context for user:', user.id);
        
        // Get the current user's dealer information
        const response = await fetch('http://localhost:3000/api/dealers/profile', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('📡 Dealer profile response status:', response.status);

        if (response.ok) {
          const dealerData = await response.json();
          console.log('✅ Dealer context found:', dealerData);
          setDealerId(dealerData.id);
        } else if (response.status === 404) {
          console.log('⚠️ No dealer profile found for user');
          setError('No dealer profile found. Please set up your dealer profile first.');
        } else if (response.status === 401) {
          console.log('❌ Authentication failed');
          setError('Authentication failed. Please log in again.');
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('❌ Failed to get dealer context:', response.status, errorData);
          setError(`Failed to get dealer context: ${errorData.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('❌ Error getting dealer context:', error);
        setError('Network error. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    getDealerContext();
  }, [user, authLoading]);

  // Show loading while auth is still loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Checking authentication...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading dealer context...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <p className="text-destructive mb-4">{error}</p>
            <p className="text-muted-foreground text-sm">
              {error.includes('Authentication failed') 
                ? 'Please log out and log back in to refresh your session.'
                : error.includes('No dealer profile') 
                ? 'Please set up your dealer profile in the settings.'
                : 'Please try again or contact support if the issue persists.'
              }
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dealerId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <p className="text-destructive mb-4">No dealer profile found</p>
            <p className="text-muted-foreground text-sm">
              Please set up your dealer profile first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log('🤖 AIBotPage with dealer ID:', dealerId);

  return <AIBotPage dealerId={dealerId} />;
};

export default AIBotWrapper; 
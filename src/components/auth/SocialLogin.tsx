import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { 
  Chrome, 
  Facebook, 
  Github, 
  Loader2,
  Mail,
  Lock
} from 'lucide-react';

interface SocialProvider {
  name: string;
  enabled: boolean;
  url: string;
}

interface ProvidersResponse {
  providers: {
    google: SocialProvider;
    facebook: SocialProvider;
    github: SocialProvider;
  };
}

const SocialLogin: React.FC = () => {
  const [providers, setProviders] = useState<ProvidersResponse['providers'] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/auth/providers');
      const data: ProvidersResponse = await response.json();
      setProviders(data.providers);
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    setLoading(provider);
    try {
      // Redirect to the OAuth provider
      window.location.href = `/api/auth/${provider}`;
    } catch (error) {
      console.error(`${provider} login error:`, error);
      toast({
        title: 'Login Failed',
        description: `Failed to login with ${provider}. Please try again.`,
        variant: 'destructive',
      });
      setLoading(null);
    }
  };

  const handleTokenFromURL = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const provider = urlParams.get('provider');

    if (token) {
      try {
        // Store the token
        localStorage.setItem('auth_token', token);
        
        // Refresh user data
        await refreshUser();
        
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Show success message
        toast({
          title: 'Login Successful!',
          description: `Successfully logged in with ${provider || 'social account'}.`,
        });
        
        // Navigate to dashboard
        navigate('/dashboard');
      } catch (error) {
        console.error('Error processing social login:', error);
        toast({
          title: 'Login Failed',
          description: 'Failed to complete social login. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  useEffect(() => {
    handleTokenFromURL();
  }, []);

  if (!providers) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const enabledProviders = Object.entries(providers).filter(([_, provider]) => provider.enabled);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Welcome to DealerIQ</CardTitle>
        <CardDescription>
          Sign in to your account to continue
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Social Login Buttons */}
        {enabledProviders.length > 0 && (
          <>
            <div className="space-y-3">
              {enabledProviders.map(([key, provider]) => (
                <Button
                  key={key}
                  variant="outline"
                  className="w-full h-12 text-base"
                  onClick={() => handleSocialLogin(key)}
                  disabled={loading === key}
                >
                  {loading === key ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <>
                      {key === 'google' && <Chrome className="h-5 w-5 mr-2" />}
                      {key === 'facebook' && <Facebook className="h-5 w-5 mr-2" />}
                      {key === 'github' && <Github className="h-5 w-5 mr-2" />}
                    </>
                  )}
                  Continue with {provider.name}
                </Button>
              ))}
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
          </>
        )}

        {/* Traditional Login Link */}
        <div className="text-center">
          <Button
            variant="link"
            className="text-sm"
            onClick={() => navigate('/auth?mode=login')}
          >
            <Mail className="h-4 w-4 mr-2" />
            Sign in with email
          </Button>
        </div>

        {/* Sign Up Link */}
        <div className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Button
            variant="link"
            className="p-0 h-auto text-sm"
            onClick={() => navigate('/auth?mode=signup')}
          >
            <Lock className="h-4 w-4 mr-1" />
            Create one
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SocialLogin; 
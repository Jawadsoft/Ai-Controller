import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Mail, AlertCircle } from 'lucide-react';

export const EmailVerification = () => {
  console.log('🚀 EmailVerification component loaded!');
  console.log('📍 Current URL:', window.location.href);
  console.log('📍 Current pathname:', window.location.pathname);
  console.log('📍 Current hash:', window.location.hash);
  
  // Extract token from query parameters
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  console.log('🔑 Token from query params:', token);
  console.log('🔍 All query params:', Object.fromEntries(searchParams.entries()));
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error' | 'expired'>('pending');
  const [errorMessage, setErrorMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setVerificationStatus('error');
      setErrorMessage('No verification token provided');
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      console.log('🔍 Starting email verification...');
      console.log('📍 Token:', verificationToken);
      console.log('🌐 Backend URL:', import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000');
      
      const backendUrl = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/customer-auth/verify-email/${verificationToken}`;
      console.log('🔗 Full API URL:', backendUrl);
      
      const response = await fetch(backendUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers);

      const data = await response.json();
      console.log('📄 Response data:', data);

      if (response.ok) {
        console.log('✅ Verification successful!');
        setVerificationStatus('success');
        toast({
          title: 'Email Verified!',
          description: 'Your account has been successfully verified. You can now log in.',
        });
      } else {
        console.log('❌ Verification failed:', data.error);
        if (data.error?.includes('expired')) {
          setVerificationStatus('expired');
        } else {
          setVerificationStatus('error');
          setErrorMessage(data.error || 'Verification failed');
        }
      }
    } catch (error) {
      console.error('💥 Verification error:', error);
      setVerificationStatus('error');
      setErrorMessage(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const resendVerification = async () => {
    if (!email) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address to resend the verification email.',
        variant: 'destructive',
      });
      return;
    }

    setIsResending(true);
    try {
      console.log('📧 Resending verification email to:', email);
      console.log('🌐 Backend URL:', import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000');
      
      const backendUrl = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/customer-auth/resend-verification`;
      console.log('🔗 Full API URL:', backendUrl);
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      console.log('📡 Response status:', response.status);
      const data = await response.json();
      console.log('📄 Response data:', data);

      if (response.ok) {
        console.log('✅ Resend successful!');
        toast({
          title: 'Verification Email Sent',
          description: 'A new verification email has been sent to your inbox.',
        });
      } else {
        console.log('❌ Resend failed:', data.error);
        toast({
          title: 'Failed to Resend',
          description: data.error || 'Failed to resend verification email',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('💥 Resend error:', error);
      toast({
        title: 'Error',
        description: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  const renderContent = () => {
    switch (verificationStatus) {
      case 'pending':
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Verifying your email...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-600 mb-2">Email Verified!</h2>
            <p className="text-muted-foreground mb-6">
              Your DealerIQ account has been successfully verified. You can now log in and start managing your vehicle inventory.
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Login
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-2">Verification Failed</h2>
            <p className="text-muted-foreground mb-4">
              {errorMessage || 'There was an error verifying your email address.'}
            </p>
            <div className="space-y-4">
              <Button onClick={() => navigate('/auth')} variant="outline" className="w-full">
                Back to Login
              </Button>
              <Button onClick={() => window.location.reload()} className="w-full">
                Try Again
              </Button>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-orange-600 mb-2">Verification Link Expired</h2>
            <p className="text-muted-foreground mb-6">
              Your verification link has expired. Please enter your email address below to receive a new verification email.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button 
                onClick={resendVerification} 
                disabled={isResending}
                className="w-full"
              >
                {isResending ? 'Sending...' : 'Resend Verification Email'}
              </Button>
              <Button onClick={() => navigate('/auth')} variant="outline" className="w-full">
                Back to Login
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Test Header - Remove this later */}
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>🧪 TEST:</strong> EmailVerification Component is Loading!
        </div>
        
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-lg bg-primary">
            <Mail className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-gray-900">Email Verification</h1>
          <p className="mt-2 text-sm text-gray-600">
            Verify your email address to activate your DealerIQ account
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {renderContent()}
          </CardContent>
        </Card>

        {/* Debug Information - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Debug Information</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Token:</strong> {token || 'None'}</p>
              <p><strong>Backend URL:</strong> {import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}</p>
              <p><strong>Current Status:</strong> {verificationStatus}</p>
              <p><strong>Error Message:</strong> {errorMessage || 'None'}</p>
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Having trouble? Contact our support team for assistance.
          </p>
        </div>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Mail, AlertCircle } from 'lucide-react';
import { buildApiUrl, API_BASE_URL } from '@/lib/config';

export const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const { token: pathToken } = useParams();

  // Try to get token from query params first, then from path params
  const token = searchParams.get('token') || pathToken;
  
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
      console.log('🌐 API base URL:', API_BASE_URL);

      // Customer QR accounts verify via /api/customer-auth; dealer/staff users verify via /api/auth.
      // Use buildApiUrl so production hits the real API host, not localhost.
      const candidateUrls = [
        buildApiUrl(`customer-auth/verify-email/${verificationToken}`),
        buildApiUrl(`auth/verify-email/${verificationToken}`),
      ];

      let lastError: any = null;

      for (const backendUrl of candidateUrls) {
        console.log('🔗 Trying API URL:', backendUrl);

        const response = await fetch(backendUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        console.log('📡 Response status:', response.status);

        const data = await response.json().catch(() => ({}));
        console.log('📄 Response data:', data);

        if (response.ok) {
          console.log('✅ Verification successful!');
          setVerificationStatus('success');
          toast({
            title: 'Email Verified!',
            description: data?.message || 'Your account has been successfully verified. You can now log in.',
          });
          return;
        }

        // If token is clearly invalid for this endpoint, try the next one.
        const code = data?.code;
        const errText = data?.error || data?.message || 'Verification failed';
        lastError = { code, error: errText };

        if (code === 'INVALID_TOKEN' || errText.toLowerCase().includes('invalid verification token')) {
          continue;
        }

        if (code === 'TOKEN_EXPIRED' || errText.toLowerCase().includes('expired')) {
          setVerificationStatus('expired');
          setErrorMessage(errText);
          return;
        }

        setVerificationStatus('error');
        setErrorMessage(errText);
        return;
      }

      // Invalid for both endpoints — allow resend from the UI
      setVerificationStatus('expired');
      setErrorMessage(lastError?.error || 'Invalid or expired verification token');
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
      console.log('🌐 API base URL:', API_BASE_URL);

      const candidateUrls = [
        buildApiUrl('customer-auth/resend-verification'),
        buildApiUrl('auth/resend-verification'),
      ];

      let lastError: any = null;

      for (const backendUrl of candidateUrls) {
        console.log('🔗 Trying resend API URL:', backendUrl);

        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        console.log('📡 Response status:', response.status);
        const data = await response.json().catch(() => ({}));
        console.log('📄 Response data:', data);

        if (response.ok) {
          console.log('✅ Resend successful!');

          if (data.alreadyVerified) {
            toast({
              title: 'Already Verified',
              description: data.message || 'Your email is already verified! You can log in now.',
            });
            setVerificationStatus('success');
          } else {
            toast({
              title: 'Verification Email Sent',
              description: data.message || 'A new verification email has been sent to your inbox.',
            });
          }
          return;
        }

        lastError = data;
      }

      toast({
        title: 'Failed to Resend',
        description: lastError?.error || 'Failed to resend verification email',
        variant: 'destructive',
      });
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

  const renderResendForm = (title: string, description: string) => (
    <div className="text-center">
      <AlertCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-orange-600 mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6">{description}</p>
      <div className="space-y-4">
        <div className="space-y-2 text-left">
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
        <Button onClick={() => navigate('/')} variant="outline" className="w-full">
          Back to Home
        </Button>
      </div>
    </div>
  );

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
              Your account has been successfully verified. You can now log in via QR code to access vehicle information.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Continue to Website
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
              <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                Back to Home
              </Button>
              <Button onClick={() => window.location.reload()} className="w-full">
                Try Again
              </Button>
            </div>
          </div>
        );

      case 'expired':
        return renderResendForm(
          'Verification Link Invalid or Expired',
          errorMessage ||
            'Your verification link is invalid or expired. Enter your email below to receive a new verification email.'
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
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

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Having trouble? Contact our support team for assistance.
          </p>
        </div>
      </div>
    </div>
  );
};

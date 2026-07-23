import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { buildApiUrl } from '@/lib/config';
import { User, Mail, Phone, Car, Building2, Clock } from 'lucide-react';

interface QuickAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sessionData: any) => void;
  vehicleData?: {
    id: string;
    make: string;
    model: string;
    year: number;
    price?: number;
    images?: string[];
  };
  dealerData?: {
    id: string;
    business_name: string;
    contact_name: string;
  };
  qrHash?: string;
}

const QuickAuthModal: React.FC<QuickAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vehicleData,
  dealerData,
  qrHash
}) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    terms_accepted: false,
    privacy_policy_accepted: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'register' | 'login' | 'forgot-password'>('info');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError(''); // Clear error when user types
  };

  const handleRegister = async () => {
    if (!qrHash) {
      toast({
        title: "Error",
        description: "QR code information is missing",
        variant: "destructive",
      });
      return;
    }

    if (!formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    if (!formData.terms_accepted || !formData.privacy_policy_accepted) {
      setError('Please accept the terms and privacy policy');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // For dealer QR codes, use the dealer-session endpoint
      if (dealerData && !vehicleData) {
        const sessionResponse = await fetch(buildApiUrl('customer-auth/dealer-session'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dealer_id: dealerData.id,
            email: formData.email,
            password: formData.password,
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone,
            is_registration: true,
          }),
        });

        const sessionData = await sessionResponse.json();

        if (!sessionResponse.ok) {
          throw new Error(sessionData.error || 'Failed to create session');
        }

        // Store customer token in localStorage
        localStorage.setItem('customerToken', sessionData.session.token);
        localStorage.setItem('customerSession', JSON.stringify(sessionData.session));

        onSuccess(sessionData);
        
        toast({
          title: "Welcome!",
          description: `Hello ${formData.first_name}, you're now registered and logged in`,
        });

        onClose();
        return;
      }

      // Original vehicle QR code logic
      // First register the customer
      const registerResponse = await fetch(buildApiUrl('customer-auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone || undefined,
          terms_accepted: formData.terms_accepted,
          privacy_policy_accepted: formData.privacy_policy_accepted,
        }),
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(registerData.error || 'Registration failed');
      }

      // Then create session with login
      const sessionResponse = await fetch(buildApiUrl('customer-auth/session-with-login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_hash: qrHash,
          email: formData.email,
          password: formData.password,
        }),
      });

      const sessionData = await sessionResponse.json();

      if (!sessionResponse.ok) {
        throw new Error(sessionData.error || 'Failed to create session');
      }

      // Store customer token in localStorage
      localStorage.setItem('customerToken', sessionData.session.token);
      localStorage.setItem('customerSession', JSON.stringify(sessionData.session));

      onSuccess(sessionData);
      
      toast({
        title: "Welcome!",
        description: `Hello ${formData.first_name}, you're now registered and logged in`,
      });

      onClose();
    } catch (error: any) {
      setError(error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!qrHash) {
      toast({
        title: "Error",
        description: "QR code information is missing",
        variant: "destructive",
      });
      return;
    }

    if (!formData.email || !formData.password) {
      setError('Please enter your email and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // For dealer QR codes, use the dealer-session endpoint
      if (dealerData && !vehicleData) {
        const sessionResponse = await fetch(buildApiUrl('customer-auth/dealer-session'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dealer_id: dealerData.id,
            email: formData.email,
            password: formData.password,
            is_registration: false,
          }),
        });

        const sessionData = await sessionResponse.json();

        if (!sessionResponse.ok) {
          throw new Error(sessionData.error || 'Failed to create session');
        }

        // Store customer token in localStorage
        localStorage.setItem('customerToken', sessionData.session.token);
        localStorage.setItem('customerSession', JSON.stringify(sessionData.session));

        onSuccess(sessionData);
        
        toast({
          title: "Welcome back!",
          description: "You're now logged in",
        });

        onClose();
        return;
      }

      // Original vehicle QR code logic
      // Create session with login
      const sessionResponse = await fetch(buildApiUrl('customer-auth/session-with-login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qr_hash: qrHash,
          email: formData.email,
          password: formData.password,
        }),
      });

      const sessionData = await sessionResponse.json();

      if (!sessionResponse.ok) {
        throw new Error(sessionData.error || 'Login failed');
      }

      // Store customer token in localStorage
      localStorage.setItem('customerToken', sessionData.session.token);
      localStorage.setItem('customerSession', JSON.stringify(sessionData.session));

      onSuccess(sessionData);
      
      toast({
        title: "Welcome back!",
        description: `Hello ${sessionData.customer.first_name}, you're now logged in`,
      });

      onClose();
    } catch (error: any) {
      setError(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };



  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(buildApiUrl('customer-auth/forgot-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      toast({
        title: "Reset Link Sent",
        description: data.message,
      });

      // Show the reset token in console for testing (remove in production)
      if (data.resetToken) {
        console.log('Reset Token (for testing):', data.resetToken);
        console.log('Reset Link (for testing):', data.resetLink);
      }

      // Go back to login
      setStep('login');
    } catch (error: any) {
      setError(error.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Allow limited access without authentication
    onSuccess({
      session: { is_authenticated: false },
      customer: null
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {
      // Prevent closing the modal entirely
    }}>
      <DialogContent 
        className={`max-w-md ${step !== 'info' ? 'ring-2 ring-primary/25' : ''}`}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {step === 'info' ? 'Quick Access' : step === 'register' ? 'Create Account' : step === 'login' ? 'Sign In' : 'Reset Password'}
          </DialogTitle>
          {step !== 'info' && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span>Please complete the authentication process to access vehicle details</span>
            </div>
          )}
        </DialogHeader>

        {step === 'info' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                You've scanned a QR code for this vehicle. Provide your contact information to get full access to vehicle details and contact the dealer.
              </p>
            </div>

            {vehicleData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Vehicle Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <p className="font-medium">
                      {vehicleData.year} {vehicleData.make} {vehicleData.model}
                    </p>
                    {vehicleData.price && (
                      <p className="text-lg font-bold text-primary">
                        ${vehicleData.price.toLocaleString()}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {dealerData && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Dealer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="font-medium">{dealerData.business_name}</p>
                  <p className="text-sm text-muted-foreground">{dealerData.contact_name}</p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              <Button 
                onClick={() => setStep('register')} 
                className="w-full"
              >
                Create Account
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setStep('login')}
                className="w-full"
              >
                Sign In
              </Button>
              
              
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Providing contact information allows you to chat with the dealer and get personalized assistance.
              </p>
            </div>
          </div>
        )}

        {step === 'register' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Create an account to access full vehicle details and save your preferences.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    placeholder="First name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email address"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a password (min 6 characters)"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter your phone number"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="terms_accepted"
                    name="terms_accepted"
                    checked={formData.terms_accepted}
                    onChange={handleInputChange}
                    className="rounded"
                  />
                  <Label htmlFor="terms_accepted" className="text-sm">
                    I accept the <a href="#" className="text-primary hover:underline">Terms of Service</a>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="privacy_policy_accepted"
                    name="privacy_policy_accepted"
                    checked={formData.privacy_policy_accepted}
                    onChange={handleInputChange}
                    className="rounded"
                  />
                  <Label htmlFor="privacy_policy_accepted" className="text-sm">
                    I accept the <a href="#" className="text-primary hover:underline">Privacy Policy</a>
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleRegister} 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setStep('info')}
                className="w-full"
              >
                Back to Options
              </Button>
            </div>
          </div>
        )}

        {step === 'login' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Sign in to your account to access full vehicle details.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email address"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleLogin} 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('forgot-password')}
                  className="text-sm text-primary hover:text-primary hover:underline"
                >
                  Forgot your password?
                </button>
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => setStep('info')}
                className="w-full"
              >
                Back to Options
              </Button>
            </div>
          </div>
        )}

        {step === 'forgot-password' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email address"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleForgotPassword} 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Sending Reset Link...' : 'Send Reset Link'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setStep('info')}
                className="w-full"
              >
                Back to Options
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuickAuthModal;

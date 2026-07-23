import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { buildApiUrl } from '@/lib/utils';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link');
      setIsVerifying(false);
      return;
    }

    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(buildApiUrl(`customer-auth/verify-reset-token/${token}`));
      const data = await response.json();

      if (response.ok && data.valid) {
        setIsValidToken(true);
        setCustomer(data.customer);
      } else {
        setError(data.error || 'Invalid or expired reset token');
      }
    } catch (error: any) {
      setError('Failed to verify reset token');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleResetPassword = async () => {
    if (!formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(buildApiUrl('customer-auth/reset-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      toast({
        title: "Password Reset Successful",
        description: "Your password has been reset successfully. You can now sign in with your new password.",
      });

      // Redirect to login or home page
      navigate('/');
    } catch (error: any) {
      setError(error.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Verifying reset token...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Invalid Reset Link</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => navigate('/')} className="w-full">
                Go to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Reset Your Password</CardTitle>
          <p className="text-center text-sm text-gray-600">
            Hello {customer?.first_name}, please enter your new password below.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="password">New Password *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your new password"
                required
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm New Password *</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your new password"
                required
              />
            </div>
          </div>

          <div className="mt-6">
            <Button 
              onClick={handleResetPassword} 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password'}
            </Button>
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-sm text-primary hover:text-primary hover:underline"
            >
              Back to Home
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;

import React from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RestrictedAccessWrapperProps {
  children: React.ReactNode;
  dealerId?: string;
  stockNumber?: string;
}

export const RestrictedAccessWrapper: React.FC<RestrictedAccessWrapperProps> = ({ 
  children, 
  dealerId, 
  stockNumber 
}) => {
  const location = useLocation();
  
  // Check if this is a QR code access
  const isQRAccess = location.hash.includes('/aibot/dealer/qr/') || 
                    location.hash.includes('/vehicle/qr/');
  
  // Check if user has restricted access (QR code customer)
  const isRestrictedAccess = localStorage.getItem('qr_dealer_id') && 
                            !localStorage.getItem('auth_token');
  
  if (isQRAccess && isRestrictedAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/15 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Restricted Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                You are accessing this system through a QR code. Your access is limited to the dealer's 
                information and services only.
              </AlertDescription>
            </Alert>
            
            <div className="text-sm text-gray-600">
              <p><strong>Dealer ID:</strong> {localStorage.getItem('qr_dealer_id')}</p>
              {localStorage.getItem('qr_stock_number') && (
                <p><strong>Stock Number:</strong> {localStorage.getItem('qr_stock_number')}</p>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => window.history.back()} 
                variant="outline" 
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return <>{children}</>;
};

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  sessionId: string;
  name: string;
  email: string;
  phone?: string;
  isAuthenticated: boolean;
}

interface CustomerSession {
  id: string;
  token: string;
  is_authenticated: boolean;
  expires_at: string;
}

interface CustomerContextType {
  customer: Customer | null;
  session: CustomerSession | null;
  isLoading: boolean;
  login: (sessionData: any) => void;
  logout: () => void;
  clearPreviousSessions: () => void;
  createRestrictedSession: (dealerId: string, stockNumber?: string) => void;
  isAuthenticated: boolean;
  hasValidSession: boolean;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

interface CustomerProviderProps {
  children: ReactNode;
}

export const CustomerProvider: React.FC<CustomerProviderProps> = ({ children }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Check for existing customer session on mount
  useEffect(() => {
    const checkExistingSession = () => {
      try {
        const storedToken = localStorage.getItem('customerToken');
        const storedSession = localStorage.getItem('customerSession');

        if (storedToken && storedSession) {
          const sessionData = JSON.parse(storedSession);
          
          // Check if session is still valid (not expired)
          const expiresAt = new Date(sessionData.expires_at);
          const now = new Date();
          
          if (expiresAt > now) {
            setSession(sessionData);
            
            // Try to decode customer info from token
            try {
              const tokenPayload = JSON.parse(atob(storedToken.split('.')[1]));
              if (tokenPayload.type === 'customer' && tokenPayload.customer_name) {
                setCustomer({
                  sessionId: tokenPayload.sessionId,
                  name: tokenPayload.customer_name,
                  email: tokenPayload.customer_email || '',
                  phone: tokenPayload.customer_phone || '',
                  isAuthenticated: sessionData.is_authenticated
                });
              }
            } catch (error) {
              console.error('Error decoding customer token:', error);
            }
          } else {
            // Session expired, clear storage
            localStorage.removeItem('customerToken');
            localStorage.removeItem('customerSession');
          }
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
        // Clear corrupted data
        localStorage.removeItem('customerToken');
        localStorage.removeItem('customerSession');
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  const login = (sessionData: any) => {
    try {
      const { session: newSession, customer: newCustomer } = sessionData;
      
      setSession(newSession);
      
      if (newCustomer) {
        setCustomer({
          sessionId: newSession.id,
          name: newCustomer.first_name && newCustomer.last_name 
            ? `${newCustomer.first_name} ${newCustomer.last_name}`
            : newCustomer.name || 'Customer',
          email: newCustomer.email,
          phone: newCustomer.phone || '',
          isAuthenticated: newSession.is_authenticated
        });
      } else {
        // Limited access without full authentication
        setCustomer({
          sessionId: newSession.id,
          name: 'Guest User',
          email: '',
          phone: '',
          isAuthenticated: false
        });
      }

      // Store in localStorage
      localStorage.setItem('customerToken', newSession.token);
      localStorage.setItem('customerSession', JSON.stringify(newSession));

      toast({
        title: "Welcome!",
        description: newCustomer 
          ? `Hello ${newCustomer.first_name || newCustomer.name || 'Customer'}, you now have full access`
          : "You have limited access to vehicle information",
      });
    } catch (error) {
      console.error('Error during customer login:', error);
      toast({
        title: "Error",
        description: "Failed to save session data",
        variant: "destructive",
      });
    }
  };

  const logout = () => {
    setCustomer(null);
    setSession(null);
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerSession');
    
    toast({
      title: "Logged Out",
      description: "Your session has been cleared",
    });
  };

  // Clear previous sessions when accessing via QR code
  const clearPreviousSessions = () => {
    setCustomer(null);
    setSession(null);
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerSession');
    localStorage.removeItem('auth_token'); // Also clear dealer auth token
    localStorage.removeItem('user'); // Clear user data
    console.log('🧹 Cleared previous sessions for QR code access');
  };

  // Create a restricted customer session for QR code access
  const createRestrictedSession = (dealerId: string, stockNumber?: string) => {
    const restrictedSession = {
      id: `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      token: `qr_${dealerId}_${Date.now()}`,
      is_authenticated: false,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };

    const restrictedCustomer = {
      sessionId: restrictedSession.id,
      name: 'Guest Customer',
      email: '',
      phone: '',
      isAuthenticated: false
    };

    setSession(restrictedSession);
    setCustomer(restrictedCustomer);

    // Store in localStorage with restricted access
    localStorage.setItem('customerToken', restrictedSession.token);
    localStorage.setItem('customerSession', JSON.stringify(restrictedSession));
    localStorage.setItem('qr_dealer_id', dealerId);
    if (stockNumber) {
      localStorage.setItem('qr_stock_number', stockNumber);
    }

    console.log('🔒 Created restricted session for QR code access:', { dealerId, stockNumber });
  };

  const isAuthenticated = customer?.isAuthenticated || false;
  const hasValidSession = session !== null && new Date(session.expires_at) > new Date();

  const value: CustomerContextType = {
    customer,
    session,
    isLoading,
    login,
    logout,
    clearPreviousSessions,
    createRestrictedSession,
    isAuthenticated,
    hasValidSession
  };

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = (): CustomerContextType => {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
};

// Hook to check if user is accessing via QR code
export const useQRCodeAccess = () => {
  const { customer, hasValidSession } = useCustomer();
  
  // Check if we're on a QR code route (vehicle or dealer)
  const isQRRoute = window.location.hash.includes('/vehicle/qr/') || 
                   window.location.hash.includes('/aibot/dealer/qr/');
  
  return {
    isQRAccess: isQRRoute && hasValidSession,
    isCustomerAuthenticated: customer?.isAuthenticated || false,
    customer
  };
};

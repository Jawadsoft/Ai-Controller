import { useState, useEffect } from "react";
import { authAPI, getToken } from "@/lib/api";

interface DealerProfile {
  id: string;
  user_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  website?: string;
  description?: string;
  license_number?: string;
  established_year?: number;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  email: string;
  role: string;
  dealerProfile?: DealerProfile | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          const response = await authAPI.getCurrentUser();
          setUser(response.user);
        } catch (error) {
          console.error('Auth check failed:', error);
          authAPI.logout();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const signOut = async () => {
    authAPI.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    const token = getToken();
    if (token) {
      try {
        const response = await authAPI.getCurrentUser();
        setUser(response.user);
        return response.user;
      } catch (error) {
        console.error('Auth refresh failed:', error);
        authAPI.logout();
        setUser(null);
        throw error;
      }
    }
  };

  // Helper function to get dealer ID from authenticated user
  const getDealerId = (): string | null => {
    if (user?.dealerProfile?.id) {
      return user.dealerProfile.id;
    }
    return null;
  };

  // Helper function to check if user is a dealer
  const isDealer = (): boolean => {
    return user?.role === 'dealer' && !!user.dealerProfile;
  };

  return {
    user,
    loading,
    signOut,
    refreshUser,
    isAuthenticated: !!user,
    getDealerId,
    isDealer,
  };
};
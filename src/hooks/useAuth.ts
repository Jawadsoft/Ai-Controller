import { useState, useEffect } from "react";
import { authAPI, getToken } from "@/lib/api";

interface DealerProfile {
  id: string;
  user_id?: string;
  business_name?: string;
  businessName?: string;
  contact_name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  website?: string;
  description?: string;
  license_number?: string;
  established_year?: number;
  logo_url?: string;
  created_at?: string;
  updated_at?: string;
  marbalism_ai_enabled?: boolean;
  marbalism_ai_activated_at?: string;
}

export interface User {
  id: string;
  email: string;
  /** Display name from `users.name` (set in Profile); optional on older accounts */
  name?: string | null;
  role: string;
  staffRole?: string | null;
  staffId?: string | null;
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
import { useState, useEffect } from "react";
import { authAPI, getToken } from "@/lib/api";

interface User {
  id: string;
  email: string;
  role: string;
  dealerProfile?: {
    id: string;
    businessName: string;
    contactName: string;
  } | null;
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

  return {
    user,
    loading,
    signOut,
    refreshUser,
    isAuthenticated: !!user,
  };
};
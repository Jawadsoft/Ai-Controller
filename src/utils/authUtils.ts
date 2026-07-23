/**
 * Utility functions for authentication and user context
 */

export interface AuthUser {
  id: string;
  email: string;
  dealer_id?: string;
  dealerId?: string;
  role?: string;
}

/**
 * Extract dealer ID from the auth token
 * @returns The dealer ID if available, null otherwise
 */
export const extractDealerIdFromToken = (): string | null => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.log('No auth token found');
      return null;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    const dealerId = payload.dealer_id || payload.dealerId;
    
    if (dealerId) {
      console.log('✅ Dealer ID extracted from token:', dealerId);
      return dealerId;
    } else {
      console.log('❌ No dealer ID found in token payload');
      return null;
    }
  } catch (error) {
    console.error('Error extracting dealer ID from token:', error);
    return null;
  }
};

/**
 * Get the current authenticated user's dealer ID
 * @returns The dealer ID if available, throws error if not
 */
export const getCurrentDealerId = (): string => {
  const dealerId = extractDealerIdFromToken();
  if (!dealerId) {
    throw new Error('No dealer ID available. User may not be authenticated or may not have dealer access.');
  }
  return dealerId;
};

/**
 * Check if the current user has dealer access
 * @returns True if user has dealer access, false otherwise
 */
export const hasDealerAccess = (): boolean => {
  return extractDealerIdFromToken() !== null;
};

/**
 * Get the current user's authentication status
 * @returns Object with authentication details
 */
export const getAuthStatus = (): {
  isAuthenticated: boolean;
  hasDealerAccess: boolean;
  dealerId: string | null;
  token: string | null;
} => {
  const token = localStorage.getItem('auth_token');
  const dealerId = extractDealerIdFromToken();
  
  return {
    isAuthenticated: !!token,
    hasDealerAccess: !!dealerId,
    dealerId,
    token
  };
};

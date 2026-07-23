import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";

export type FeaturePermission = 
  | 'qr_code_generation'
  | 'lead_management' 
  | 'vehicle_import'
  | 'analytics_dashboard'
  | 'bulk_actions'
  | 'custom_branding'
  | 'api_access'
  | 'priority_support';

export type UserRole = 'super_admin' | 'dealer' | 'client';

export type SubscriptionPlan = 'basic' | 'premium' | 'enterprise';

export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<FeaturePermission[]>([]);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setUserRole(null);
      setSubscriptionPlan(null);
      setLoading(false);
      return;
    }

    fetchUserPermissions();
  }, [user]);

  const fetchUserPermissions = async () => {
    if (!user) return;

    try {
      // User role is already available from user object in PostgreSQL backend
      const role = user.role as UserRole;
      console.log('User role data:', role);
      console.log('User ID:', user.id);
      console.log('Full user object:', user);
      setUserRole(role || 'dealer');

      // If super admin, grant all permissions
      if (role === 'super_admin') {
        setPermissions([
          'qr_code_generation',
          'lead_management',
          'vehicle_import',
          'analytics_dashboard',
          'bulk_actions',
          'custom_branding',
          'api_access',
          'priority_support'
        ]);
        setLoading(false);
        return;
      }

      // For dealers, basic permissions (can be extended based on subscription)
      setPermissions([
        'qr_code_generation',
        'lead_management',
        'vehicle_import'
      ]);
      setSubscriptionPlan('basic');
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: FeaturePermission): boolean => {
    return permissions.includes(permission);
  };

  const isSuperAdmin = (): boolean => {
    return userRole === 'super_admin';
  };

  const canAccessFeature = (feature: FeaturePermission): boolean => {
    return isSuperAdmin() || hasPermission(feature);
  };

  return {
    permissions,
    userRole,
    subscriptionPlan,
    loading,
    hasPermission,
    isSuperAdmin,
    canAccessFeature,
    refreshPermissions: fetchUserPermissions
  };
};
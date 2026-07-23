import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";

export type FeaturePermission = 
  | 'qr_code_generation'
  | 'lead_management' 
  | 'vehicle_import'
  | 'analytics_dashboard'
  | 'bulk_actions'
  | 'custom_branding'
  | 'api_access'
  | 'priority_support'
  | 'staff_management'
  | 'user_management'
  | 'finance_management'
  | 'rebate_management'
  | 'daive_settings_management'
  | 'followup_settings_management'
  | 'customer_management'
  | 'marbalism_ai';

export type UserRole = 'super_admin' | 'dealer' | 'client';

export type SubscriptionPlan = 'basic' | 'premium' | 'enterprise';

export const usePermissions = () => {
  const { user, refreshUser } = useAuth();
  const [permissions, setPermissions] = useState<FeaturePermission[]>([]);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setUserRole(null);
      setStaffRole(null);
      setSubscriptionPlan(null);
      setLoading(false);
      return;
    }

    applyPermissions(user);
  }, [user]);

  // Accept an explicit user object so refreshPermissions can pass a fresh one
  // without depending on the stale closure value of `user`
  const applyPermissions = (currentUser: typeof user) => {
    if (!currentUser) return;

    try {
      const role = currentUser.role as UserRole;
      const sRole = currentUser.staffRole;

      setUserRole(role || 'dealer');
      setStaffRole(sRole || null);

      if (role === 'super_admin') {
        setPermissions([
          'lead_management',
          'analytics_dashboard',
          'bulk_actions',
          'custom_branding',
          'api_access',
          'priority_support',
          'staff_management',
          'user_management',
          'finance_management',
          'rebate_management',
          'daive_settings_management',
          'followup_settings_management',
          'customer_management',
          'marbalism_ai',
        ]);
        setLoading(false);
        return;
      }

      if (sRole && currentUser.staffPermissions) {
        console.log('🔐 Loading permissions from database:', currentUser.staffPermissions);
        const perms = [...(currentUser.staffPermissions || [])] as FeaturePermission[];
        if (currentUser.dealerProfile?.marbalism_ai_enabled && !perms.includes('marbalism_ai')) {
          perms.push('marbalism_ai');
        }
        setPermissions(perms);
      } else if (!sRole) {
        console.log('🔐 Loading default dealer permissions');
        const basePerms: FeaturePermission[] = [
          'qr_code_generation',
          'lead_management',
          'vehicle_import',
        ];
        if (currentUser.dealerProfile?.marbalism_ai_enabled) {
          basePerms.push('marbalism_ai');
        }
        setPermissions(basePerms);
      } else {
        console.log('⚠️ Staff role exists but no permissions found');
        setPermissions([]);
      }

      setSubscriptionPlan('basic');
    } catch (error) {
      console.error('Error applying permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPermissions = () => applyPermissions(user);

  const hasPermission = useCallback((permission: FeaturePermission): boolean => {
    return permissions.includes(permission);
  }, [permissions]);

  const isSuperAdmin = useCallback((): boolean => {
    return userRole === 'super_admin';
  }, [userRole]);

  const isDealerAdmin = useCallback((): boolean => {
    return staffRole === 'admin';
  }, [staffRole]);

  const canAccessFeature = useCallback((feature: FeaturePermission): boolean => {
    if (isSuperAdmin()) return true;
    if (isDealerAdmin()) return true;
    return hasPermission(feature);
  }, [isSuperAdmin, isDealerAdmin, hasPermission]);

  const refreshPermissions = async () => {
    try {
      // refreshUser returns the fresh user — pass it directly to avoid stale closure
      const freshUser = await refreshUser?.();
      if (freshUser) {
        applyPermissions(freshUser);
      } else {
        applyPermissions(user);
      }
    } catch (_) {
      applyPermissions(user);
    }
  };

  return {
    permissions,
    userRole,
    staffRole,
    subscriptionPlan,
    loading,
    hasPermission,
    isSuperAdmin,
    isDealerAdmin,
    canAccessFeature,
    refreshPermissions
  };
};
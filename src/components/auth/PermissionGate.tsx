import { ReactNode } from "react";
import { usePermissions, type FeaturePermission } from "@/hooks/usePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Crown } from "lucide-react";

interface PermissionGateProps {
  permission?: FeaturePermission;
  superAdminOnly?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

export const PermissionGate = ({ 
  permission, 
  superAdminOnly = false,
  children, 
  fallback,
  showUpgradePrompt = false 
}: PermissionGateProps) => {
  const { canAccessFeature, isSuperAdmin, subscriptionPlan, loading } = usePermissions();

  if (loading) {
    return <div className="animate-pulse bg-muted/50 rounded h-20" />;
  }

  // Check super admin access
  if (superAdminOnly && !isSuperAdmin()) {
    return fallback || (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-destructive" />
            Admin Access Required
          </CardTitle>
          <CardDescription>
            This feature is only available to super administrators.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Check feature permission
  if (permission && !canAccessFeature(permission)) {
    if (showUpgradePrompt) {
      return (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Premium Feature
            </CardTitle>
            <CardDescription>
              This feature requires a {permission === 'analytics_dashboard' ? 'Premium' : 'higher'} subscription plan.
              {subscriptionPlan && ` Current plan: ${subscriptionPlan}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>
      );
    }
    
    return fallback || null;
  }

  return <>{children}</>;
};
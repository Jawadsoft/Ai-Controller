import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Building2, Settings, Activity } from "lucide-react";
import AdminDashboard from "@/components/admin/AdminDashboard";
import UserManagement from "@/components/admin/UserManagement";

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    console.log('Admin useEffect:', {
      authLoading,
      permissionsLoading,
      user: !!user,
      userEmail: user?.email,
      isSuperAdmin: isSuperAdmin()
    });

    // Wait for both auth and permissions to finish loading
    if (authLoading || permissionsLoading) {
      console.log('Still loading, waiting...');
      return;
    }

    // Now that loading is complete, check permissions
    if (!user) {
      console.log('No user, redirecting to auth');
      navigate("/auth");
      return;
    }

    if (!isSuperAdmin()) {
      console.log('Not super admin, redirecting to dashboard');
      navigate("/dashboard");
      return;
    }

    console.log('Super admin confirmed, showing admin panel');
  }, [user, authLoading, permissionsLoading, isSuperAdmin, navigate]);

  if (authLoading || permissionsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-lg">Loading admin panel...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div className="flex items-center space-x-2">
                <Settings className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-semibold">Admin Panel</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="dealers" className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>Dealer Management</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>User Management</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <AdminDashboard />
          </TabsContent>

          <TabsContent value="dealers">
            <Card>
              <CardHeader>
                <CardTitle>Dealer Management</CardTitle>
                <CardDescription>
                  Manage dealer accounts, subscriptions, and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Dealer Management</h3>
                  <p className="text-muted-foreground mb-4">
                    Use the Dashboard tab to manage dealers, subscriptions, and view analytics.
                  </p>
                  <Button onClick={() => setActiveTab("dashboard")}>
                    Go to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;

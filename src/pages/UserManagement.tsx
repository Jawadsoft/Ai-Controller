import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { adminAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, ArrowLeft, Shield, Building2, Calendar, Mail, Phone } from "lucide-react";
import { format } from "date-fns";

interface DealerData {
  id: string;
  user_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
  vehicle_count?: number;
  lead_count?: number;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
}

const UserManagement = () => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [dealers, setDealers] = useState<DealerData[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    console.log('UserManagement useEffect:', {
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

    // User is super admin, fetch data
    console.log('Super admin confirmed, fetching data');
    fetchUsersData();
  }, [user, authLoading, permissionsLoading, isSuperAdmin, navigate]);

  const fetchUsersData = async () => {
    try {
      setLoading(true);

      // Fetch dealers with vehicle and lead counts from new API
      const dealersData = await adminAPI.getStats();
      setDealers(dealersData);
    } catch (error: any) {
      console.error("Error fetching users data:", error);
      toast({
        title: "Error",
        description: "Failed to load users data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSubscriptionPlan = async (dealerId: string, newPlan: "basic" | "premium" | "enterprise") => {
    toast({
      title: "Feature Coming Soon",
      description: "Subscription management will be available when the admin API is fully implemented",
    });
  };

  const updateSubscriptionStatus = async (dealerId: string, newStatus: string) => {
    toast({
      title: "Feature Coming Soon", 
      description: "Status updates will be available when the admin API is fully implemented",
    });
  };

  const getUserRole = (userId: string) => {
    const userRole = userRoles.find(role => role.user_id === userId);
    return userRole?.role || "dealer";
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "inactive": return "secondary";
      case "suspended": return "destructive";
      default: return "outline";
    }
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case "basic": return "outline";
      case "premium": return "default";
      case "enterprise": return "secondary";
      default: return "outline";
    }
  };

  if (authLoading || permissionsLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-lg">Loading user management...</div>
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
                onClick={() => navigate("/admin")}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
              <div className="flex items-center space-x-2">
                <Users className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-semibold">User Management</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-2xl">{dealers.length}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Subscriptions</CardDescription>
              <CardTitle className="text-2xl">
                {dealers.filter(d => d.subscription_status === "active").length}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Vehicles</CardDescription>
              <CardTitle className="text-2xl">
                {dealers.reduce((sum, d) => sum + (d.vehicle_count || 0), 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Leads</CardDescription>
              <CardTitle className="text-2xl">
                {dealers.reduce((sum, d) => sum + (d.lead_count || 0), 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Dealers Management
            </CardTitle>
            <CardDescription>
              Manage dealer accounts, subscriptions, and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vehicles</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealers.map((dealer) => (
                  <TableRow key={dealer.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{dealer.business_name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {dealer.email}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div>
                        <div className="font-medium">{dealer.contact_name}</div>
                        {dealer.phone && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {dealer.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {getUserRole(dealer.user_id)}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Select
                        value={dealer.subscription_plan}
                        onValueChange={(value) => updateSubscriptionPlan(dealer.id, value as "basic" | "premium" | "enterprise")}
                        disabled={updating === dealer.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    <TableCell>
                      <Select
                        value={dealer.subscription_status}
                        onValueChange={(value) => updateSubscriptionStatus(dealer.id, value)}
                        disabled={updating === dealer.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline">
                        {dealer.vehicle_count || 0}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline">
                        {dealer.lead_count || 0}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(dealer.created_at), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(dealer.subscription_status)}>
                        {dealer.subscription_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserManagement;
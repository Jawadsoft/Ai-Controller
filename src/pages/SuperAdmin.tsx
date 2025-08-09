import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { dealersAPI, adminAPI } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Crown, Users, CreditCard, TrendingUp, ArrowLeft, UserCog, Building } from "lucide-react";
import UserManagement from "@/components/admin/UserManagement";

interface Dealer {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
  vehicles?: { count: number }[];
  leads?: { count: number }[];
}

const SuperAdmin = () => {
  const { isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dealers");
  const [stats, setStats] = useState({
    totalDealers: 0,
    activeDealers: 0,
    totalRevenue: 0,
    totalVehicles: 0
  });

  useEffect(() => {
    console.log('SuperAdmin useEffect:', { 
      authLoading, 
      user: !!user, 
      permissionsLoading, 
      isSuperAdmin: isSuperAdmin(),
      userEmail: user?.email 
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
    fetchDealers();
    fetchStats();
  }, [user, authLoading, permissionsLoading, isSuperAdmin, navigate]);

  const fetchDealers = async () => {
    try {
      const data = await dealersAPI.getAll();
      setDealers(data || []);
    } catch (error) {
      console.error('Error fetching dealers:', error);
      toast.error('Failed to fetch dealers');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [dealers, adminStats] = await Promise.all([
        dealersAPI.getAll(),
        adminAPI.getStats()
      ]);
      
      if (dealers && adminStats) {
        const totalDealers = dealers.length;
        const activeDealers = dealers.filter(d => d.subscription_status === 'active').length;
        
        setStats({
          totalDealers,
          activeDealers,
          totalRevenue: activeDealers * 79.99, // Approximate
          totalVehicles: adminStats.totalVehicles || 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const updateDealerPlan = async (dealerId: string, newPlan: "basic" | "premium" | "enterprise") => {
    try {
      await dealersAPI.update(dealerId, { subscription_plan: newPlan });
      
      toast.success('Subscription plan updated successfully');
      fetchDealers();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Failed to update subscription plan');
    }
  };

  if (authLoading || permissionsLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (!isSuperAdmin()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            <h1 className="text-xl font-semibold">Super Admin Dashboard</h1>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dealers" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Dealer Management
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="flex items-center gap-2"
              onClick={() => navigate("/admin/users")}
            >
              <UserCog className="h-4 w-4" />
              User Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dealers" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Dealers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalDealers}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Dealers</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeDealers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalVehicles}</div>
                </CardContent>
              </Card>
            </div>

            {/* Dealers Management */}
            <Card>
              <CardHeader>
                <CardTitle>Dealer Management</CardTitle>
                <CardDescription>Manage dealer accounts and subscription plans</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse bg-muted/50 rounded h-16" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Vehicles</TableHead>
                        <TableHead>Leads</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dealers.map((dealer) => (
                        <TableRow key={dealer.id}>
                          <TableCell className="font-medium">{dealer.business_name}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{dealer.contact_name}</div>
                              <div className="text-sm text-muted-foreground">{dealer.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              dealer.subscription_plan === 'enterprise' ? 'default' :
                              dealer.subscription_plan === 'premium' ? 'secondary' : 'outline'
                            }>
                              {dealer.subscription_plan}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={dealer.subscription_status === 'active' ? 'default' : 'destructive'}>
                              {dealer.subscription_status}
                            </Badge>
                          </TableCell>
                          <TableCell>{dealer.vehicles?.[0]?.count || 0}</TableCell>
                          <TableCell>{dealer.leads?.[0]?.count || 0}</TableCell>
                          <TableCell>
                            <Select
                              value={dealer.subscription_plan}
                              onValueChange={(value: "basic" | "premium" | "enterprise") => updateDealerPlan(dealer.id, value)}
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
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

export default SuperAdmin;
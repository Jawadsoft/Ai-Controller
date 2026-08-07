import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { adminAPI } from "@/lib/api";
import { 
  Users, 
  Building2, 
  CreditCard, 
  TrendingUp, 
  Shield, 
  Activity,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  BarChart3
} from "lucide-react";
import { format } from "date-fns";

interface AdminStats {
  totalUsers: number;
  totalDealers: number;
  totalVehicles: number;
  totalLeads: number;
  superAdmins: number;
  subscriptionStats: Array<{
    plan_name: string;
    dealer_count: number;
  }>;
  recentDealers: Array<{
    id: string;
    business_name: string;
    email: string;
    subscription_status: string;
    created_at: string;
    vehicle_count: number;
    lead_count: number;
  }>;
}

interface Dealer {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  website?: string;
  subscription_status: string;
  subscription_plan: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
  role?: string;
  vehicle_count: number;
  lead_count: number;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  description: string;
  monthly_price: number;
  yearly_price: number;
  max_vehicles: number;
  max_leads: number;
  features: string[];
  is_active: boolean;
  created_at: string;
}

interface AuditLog {
  id: string;
  dealer_id?: string;
  user_id?: string;
  action: string;
  table_name?: string;
  record_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  business_name?: string;
  user_email?: string;
}

const AdminDashboard = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Dealer management states
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [isDealerDialogOpen, setIsDealerDialogOpen] = useState(false);
  const [dealerForm, setDealerForm] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    website: "",
    subscription_plan: "basic",
    subscription_status: "active"
  });

  // Subscription plan management states
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [planForm, setPlanForm] = useState({
    display_name: "",
    description: "",
    monthly_price: 0,
    yearly_price: 0,
    max_vehicles: 0,
    max_leads: 0,
    features: [] as string[],
    is_active: true
  });

  // Audit log states
  const [auditFilters, setAuditFilters] = useState({
    dealer_id: "",
    action: "",
    page: 1,
    limit: 50
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, dealersData, plansData] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getDealers(),
        adminAPI.getSubscriptionPlans()
      ]);

      setStats(statsData);
      setDealers(dealersData);
      setSubscriptionPlans(plansData);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const auditData = await adminAPI.getAuditLog(auditFilters);
      setAuditLogs(auditData.logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDealerSubscription = async (dealerId: string, subscriptionPlan: string, subscriptionStatus: string) => {
    try {
      await adminAPI.updateDealerSubscription(dealerId, {
        subscription_plan: subscriptionPlan,
        subscription_status: subscriptionStatus
      });

      toast({
        title: "Success",
        description: "Dealer subscription updated successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update dealer subscription",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDealerProfile = async () => {
    if (!selectedDealer) return;

    try {
      await adminAPI.updateDealerProfile(selectedDealer.id, dealerForm);

      toast({
        title: "Success",
        description: "Dealer profile updated successfully",
      });

      setIsDealerDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update dealer profile",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSubscriptionPlan = async () => {
    if (!selectedPlan) return;

    try {
      await adminAPI.updateSubscriptionPlan(selectedPlan.id, planForm);

      toast({
        title: "Success",
        description: "Subscription plan updated successfully",
      });

      setIsPlanDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription plan",
        variant: "destructive",
      });
    }
  };

  const openDealerDialog = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setDealerForm({
      business_name: dealer.business_name,
      contact_name: dealer.contact_name,
      email: dealer.email,
      phone: dealer.phone || "",
      address: dealer.address || "",
      city: dealer.city || "",
      state: dealer.state || "",
      zip_code: dealer.zip_code || "",
      website: dealer.website || "",
      subscription_plan: dealer.subscription_plan,
      subscription_status: dealer.subscription_status
    });
    setIsDealerDialogOpen(true);
  };

  const openPlanDialog = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setPlanForm({
      display_name: plan.display_name,
      description: plan.description,
      monthly_price: plan.monthly_price,
      yearly_price: plan.yearly_price,
      max_vehicles: plan.max_vehicles,
      max_leads: plan.max_leads,
      features: plan.features,
      is_active: plan.is_active
    });
    setIsPlanDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-lg">Loading admin dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage users, dealers, and system settings</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={fetchData} variant="outline">
              <Activity className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 gap-1">
            <TabsTrigger value="overview" className="px-4 py-2">Overview</TabsTrigger>
            <TabsTrigger value="dealers" className="px-4 py-2">Dealers</TabsTrigger>
            <TabsTrigger value="subscriptions" className="px-4 py-2">Subscriptions</TabsTrigger>
            <TabsTrigger value="audit" className="px-4 py-2">Audit Log</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.superAdmins || 0} super admins
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Dealers</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalDealers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Active dealerships
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalVehicles || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Across all dealers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalLeads || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Generated leads
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Subscription Plan Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Subscription Plan Distribution</CardTitle>
                <CardDescription>Number of dealers per subscription plan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.subscriptionStats.map((stat) => (
                    <div key={stat.plan_name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="capitalize">
                          {stat.plan_name}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium">{stat.dealer_count} dealers</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Dealers */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Recent Dealers</CardTitle>
                <CardDescription>Latest dealership registrations</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="py-3 px-4 font-semibold">Business Name</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">Email</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">Plan</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">Status</TableHead>
                        <TableHead className="py-3 px-4 font-semibold text-center">Vehicles</TableHead>
                        <TableHead className="py-3 px-4 font-semibold text-center">Leads</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats?.recentDealers.map((dealer) => (
                        <TableRow key={dealer.id} className="hover:bg-muted/30">
                          <TableCell className="py-4 px-4 font-medium">{dealer.business_name}</TableCell>
                          <TableCell className="py-4 px-4">{dealer.email}</TableCell>
                          <TableCell className="py-4 px-4">
                            <Badge variant="outline" className="capitalize">
                              {dealer.subscription_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <Badge variant={dealer.subscription_status === 'active' ? 'default' : 'secondary'}>
                              {dealer.subscription_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-4 text-center font-medium">{dealer.vehicle_count}</TableCell>
                          <TableCell className="py-4 px-4 text-center font-medium">{dealer.lead_count}</TableCell>
                          <TableCell className="py-4 px-4">
                            {format(new Date(dealer.created_at), 'MMM dd, yyyy')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dealers Tab */}
          <TabsContent value="dealers" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Dealer Management</CardTitle>
                    <CardDescription className="mt-1">Manage dealer accounts and subscription plans</CardDescription>
                  </div>
                  <Button variant="default" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Dealer
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="py-3 px-4 font-semibold">Business Name</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">Contact</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">Plan</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">Status</TableHead>
                        <TableHead className="py-3 px-4 font-semibold text-center">Vehicles</TableHead>
                        <TableHead className="py-3 px-4 font-semibold text-center">Leads</TableHead>
                        <TableHead className="py-3 px-4 font-semibold text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dealers.map((dealer) => (
                        <TableRow key={dealer.id} className="hover:bg-muted/30">
                          <TableCell className="py-4 px-4">
                            <div>
                              <div className="font-medium text-sm">{dealer.business_name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{dealer.email}</div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <div>
                              <div className="font-medium text-sm">{dealer.contact_name}</div>
                              {dealer.phone && (
                                <div className="text-xs text-muted-foreground mt-0.5">{dealer.phone}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <Select
                              value={dealer.subscription_plan}
                              onValueChange={(value) => 
                                handleUpdateDealerSubscription(dealer.id, value, dealer.subscription_status)
                              }
                            >
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="basic">Basic</SelectItem>
                                <SelectItem value="premium">Premium</SelectItem>
                                <SelectItem value="enterprise">Enterprise</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <Select
                              value={dealer.subscription_status}
                              onValueChange={(value) => 
                                handleUpdateDealerSubscription(dealer.id, dealer.subscription_plan, value)
                              }
                            >
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-4 px-4 text-center font-medium">{dealer.vehicle_count}</TableCell>
                          <TableCell className="py-4 px-4 text-center font-medium">{dealer.lead_count}</TableCell>
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDealerDialog(dealer)}
                                className="h-8 px-3"
                              >
                                <Edit className="h-3.5 w-3.5 mr-1.5" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>Manage subscription plans and pricing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {subscriptionPlans.map((plan) => (
                    <Card key={plan.id} className="relative">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          {plan.display_name}
                          <Badge variant={plan.is_active ? "default" : "secondary"}>
                            {plan.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Monthly</span>
                          <span className="text-lg font-semibold">${plan.monthly_price}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Yearly</span>
                          <span className="text-lg font-semibold">${plan.yearly_price}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Max Vehicles</span>
                          <span className="font-medium">{plan.max_vehicles}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Max Leads</span>
                          <span className="font-medium">{plan.max_leads}</span>
                        </div>
                        <div className="pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPlanDialog(plan)}
                            className="w-full"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Plan
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>Track all admin actions and changes</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="flex items-center gap-4 mb-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dealer-filter" className="whitespace-nowrap">Dealer</Label>
                    <Select
                      value={auditFilters.dealer_id}
                      onValueChange={(value) => setAuditFilters({ ...auditFilters, dealer_id: value })}
                    >
                      <SelectTrigger className="w-48 h-9">
                        <SelectValue placeholder="All dealers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All dealers</SelectItem>
                        {dealers.map((dealer) => (
                          <SelectItem key={dealer.id} value={dealer.id}>
                            {dealer.business_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="action-filter" className="whitespace-nowrap">Action</Label>
                    <Select
                      value={auditFilters.action}
                      onValueChange={(value) => setAuditFilters({ ...auditFilters, action: value })}
                    >
                      <SelectTrigger className="w-48 h-9">
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All actions</SelectItem>
                        <SelectItem value="UPDATE_SUBSCRIPTION">Update Subscription</SelectItem>
                        <SelectItem value="UPDATE_PROFILE">Update Profile</SelectItem>
                        <SelectItem value="UPDATE_SUBSCRIPTION_PLAN">Update Plan</SelectItem>
                        <SelectItem value="CREATE_USER">Create User</SelectItem>
                        <SelectItem value="DELETE_USER">Delete User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={fetchAuditLogs} size="sm" className="h-9">
                    <Search className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="py-3 px-4 font-semibold">Action</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">Dealer</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">Admin</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">Details</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">IP Address</TableHead>
                        <TableHead className="py-3 px-4 font-semibold">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-muted/30">
                          <TableCell className="py-4 px-4">
                            <Badge variant="outline">{log.action}</Badge>
                          </TableCell>
                          <TableCell className="py-4 px-4">{log.business_name || "N/A"}</TableCell>
                          <TableCell className="py-4 px-4">{log.user_email || "N/A"}</TableCell>
                          <TableCell className="py-4 px-4">
                            {log.new_values && (
                              <div className="text-sm text-muted-foreground truncate max-w-xs">
                                {JSON.stringify(log.new_values, null, 2).substring(0, 100)}...
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-4 px-4">{log.ip_address || "N/A"}</TableCell>
                          <TableCell className="py-4 px-4 whitespace-nowrap">
                            {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dealer Edit Dialog */}
        <Dialog open={isDealerDialogOpen} onOpenChange={setIsDealerDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Dealer Profile</DialogTitle>
              <DialogDescription>
                Update dealer information and settings
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name</Label>
                <Input
                  id="business_name"
                  value={dealerForm.business_name}
                  onChange={(e) => setDealerForm({ ...dealerForm, business_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input
                  id="contact_name"
                  value={dealerForm.contact_name}
                  onChange={(e) => setDealerForm({ ...dealerForm, contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={dealerForm.email}
                  onChange={(e) => setDealerForm({ ...dealerForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={dealerForm.phone}
                  onChange={(e) => setDealerForm({ ...dealerForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={dealerForm.address}
                  onChange={(e) => setDealerForm({ ...dealerForm, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={dealerForm.city}
                  onChange={(e) => setDealerForm({ ...dealerForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={dealerForm.state}
                  onChange={(e) => setDealerForm({ ...dealerForm, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_code">Zip Code</Label>
                <Input
                  id="zip_code"
                  value={dealerForm.zip_code}
                  onChange={(e) => setDealerForm({ ...dealerForm, zip_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={dealerForm.website}
                  onChange={(e) => setDealerForm({ ...dealerForm, website: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDealerDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateDealerProfile}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Subscription Plan Edit Dialog */}
        <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Subscription Plan</DialogTitle>
              <DialogDescription>
                Update subscription plan details and pricing
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={planForm.display_name}
                    onChange={(e) => setPlanForm({ ...planForm, display_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly_price">Monthly Price</Label>
                  <Input
                    id="monthly_price"
                    type="number"
                    step="0.01"
                    value={planForm.monthly_price}
                    onChange={(e) => setPlanForm({ ...planForm, monthly_price: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="yearly_price">Yearly Price</Label>
                  <Input
                    id="yearly_price"
                    type="number"
                    step="0.01"
                    value={planForm.yearly_price}
                    onChange={(e) => setPlanForm({ ...planForm, yearly_price: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_vehicles">Max Vehicles</Label>
                  <Input
                    id="max_vehicles"
                    type="number"
                    value={planForm.max_vehicles}
                    onChange={(e) => setPlanForm({ ...planForm, max_vehicles: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_leads">Max Leads</Label>
                  <Input
                    id="max_leads"
                    type="number"
                    value={planForm.max_leads}
                    onChange={(e) => setPlanForm({ ...planForm, max_leads: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPlanDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSubscriptionPlan}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminDashboard;

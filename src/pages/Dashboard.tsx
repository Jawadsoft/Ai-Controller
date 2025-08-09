import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Users, TrendingUp, Settings, LogOut, Crown, Brain, BarChart3, Bot, Database, QrCode, RefreshCw } from "lucide-react";
import { vehiclesAPI, leadsAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import notificationService from "@/lib/notificationService";

interface DashboardStats {
  totalVehicles: number;
  availableVehicles: number;
  totalLeads: number;
  newLeads: number;
}

interface RecentVehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  status: string;
  price?: number;
  qr_code_url?: string;
  created_at: string;
}

interface RecentLead {
  id: string;
  customer_name: string;
  customer_email: string;
  status: string;
  interest_level: string;
  created_at: string;
}

const Dashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { isSuperAdmin, subscriptionPlan } = usePermissions();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    availableVehicles: 0,
    totalLeads: 0,
    newLeads: 0,
  });
  const [recentVehicles, setRecentVehicles] = useState<RecentVehicle[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generatingQR, setGeneratingQR] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchRecentLeads();
      
      // Initialize desktop notifications
      console.log('Initializing desktop notifications...');
      console.log('Notification supported:', notificationService.isNotificationSupported());
      console.log('Notification permission:', notificationService.getNotificationPermission());
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      // Fetch vehicle stats
      const vehicleData = await vehiclesAPI.getAll();
      
      // Fetch lead stats  
      const leadData = await leadsAPI.getAll();

      const dashboardStats = {
        totalVehicles: vehicleData.length,
        availableVehicles: vehicleData.filter((v: any) => v.status === "available").length,
        totalLeads: leadData.length,
        newLeads: leadData.filter((l: any) => l.status === "new").length,
      };

      setStats(dashboardStats);
      setRecentVehicles(vehicleData.slice(0, 5));
      
      toast({
        title: "Dashboard loaded",
        description: `Loaded ${dashboardStats.totalVehicles} vehicles and ${dashboardStats.totalLeads} leads`,
      });
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      setError("Failed to load dashboard data. Please check your connection.");
      
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
      
      // Set default stats if API fails
      setStats({
        totalVehicles: 0,
        availableVehicles: 0,
        totalLeads: 0,
        newLeads: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentLeads = async () => {
    try {
      const data = await leadsAPI.getAll();
      setRecentLeads(data.slice(0, 5));
    } catch (error: any) {
      console.error("Error fetching recent leads:", error);
      setRecentLeads([]);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out",
      });
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Sign out error",
        description: "Failed to sign out properly",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return "Price not set";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const clearCache = async () => {
    try {
      // Clear browser cache for images and files
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      // Clear localStorage if needed
      const keysToKeep = ['auth_token', 'user_preferences'];
      const keysToRemove = Object.keys(localStorage).filter(key => 
        !keysToKeep.includes(key) && (key.includes('cache') || key.includes('temp'))
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Force reload of images by adding timestamp
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (img.src.includes('/uploads/')) {
          img.src = img.src + (img.src.includes('?') ? '&' : '?') + 't=' + Date.now();
        }
      });

      toast({
        title: "Cache Cleared",
        description: "Browser cache and temporary files have been cleared",
      });

      // Refresh the dashboard data
      await fetchDashboardData();
      await fetchRecentLeads();
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Cache Clear Error",
        description: "Failed to clear cache completely",
        variant: "destructive",
      });
    }
  };

  const generateQRCode = async (vehicleId: string) => {
    try {
      setGeneratingQR(vehicleId);
      await vehiclesAPI.generateQRCode(vehicleId);
      
      // Update the vehicle in the local state
      setRecentVehicles(prev => prev.map(v => 
        v.id === vehicleId ? { ...v, qr_code_url: `/uploads/qr-codes/vehicle-${vehicleId}-qr.png` } : v
      ));
      
      toast({
        title: "QR Code Generated",
        description: "QR code has been generated successfully",
      });
    } catch (error: any) {
      console.error("Error generating QR code:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR code",
        variant: "destructive",
      });
    } finally {
      setGeneratingQR(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">DealerIQ</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearCache}
              className="flex items-center space-x-1"
              title="Clear cache and refresh data"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Clear Cache</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/vehicles")}>
              Vehicles
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/leads")}>
              Leads
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>
              Profile
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/etl")}>
              ETL
            </Button>
            {isSuperAdmin() && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate("/admin")}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <Crown className="h-3 w-3 mr-1" />
                Admin
              </Button>
            )}
            <span className="text-xs text-gray-600">
              {user.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center space-x-1"
            >
              <LogOut className="h-3 w-3" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1 text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-600">
            Manage your vehicle inventory and track customer interactions.
          </p>
          {subscriptionPlan && (
            <div className="mt-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                {subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1)} Plan
              </Badge>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={fetchDashboardData}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/vehicles")}>
            <CardContent className="flex items-center p-4">
              <Car className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <p className="text-xl font-bold">{stats.totalVehicles}</p>
                <p className="text-xs text-gray-600">Total Vehicles</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/leads")}>
            <CardContent className="flex items-center p-4">
              <Users className="h-6 w-6 text-green-600 mr-3" />
              <div>
                <p className="text-xl font-bold">{stats.totalLeads}</p>
                <p className="text-xs text-gray-600">Total Leads</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/daive/analytics")}>
            <CardContent className="flex items-center p-4">
              <Brain className="h-6 w-6 text-purple-600 mr-3" />
              <div>
                <p className="text-sm font-semibold">D.A.I.V.E.</p>
                <p className="text-xs text-gray-600">AI Analytics</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/daive/settings")}>
            <CardContent className="flex items-center p-4">
              <BarChart3 className="h-6 w-6 text-orange-600 mr-3" />
              <div>
                <p className="text-sm font-semibold">AI Settings</p>
                <p className="text-xs text-gray-600">Configure D.A.I.V.E.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/ai-bot")}>
            <CardContent className="flex items-center p-4">
              <Bot className="h-6 w-6 text-indigo-600 mr-3" />
              <div>
                <p className="text-sm font-semibold">AI Bot</p>
                <p className="text-xs text-gray-600">Voice & Text Chat</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/etl")}>
            <CardContent className="flex items-center p-4">
              <Database className="h-6 w-6 text-teal-600 mr-3" />
              <div>
                <p className="text-sm font-semibold">ETL</p>
                <p className="text-xs text-gray-600">Data Export</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent Vehicles</span>
                <Button variant="outline" size="sm" onClick={() => navigate("/vehicles")}>
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentVehicles.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Car className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">No vehicles yet</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => navigate("/vehicles")}
                  >
                    Add Your First Vehicle
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentVehicles.map((vehicle) => (
                    <div 
                      key={vehicle.id} 
                      className="flex items-center justify-between p-2 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                    >
                      <div className="flex items-center space-x-3">
                        {/* QR Code Display */}
                        <div className="flex-shrink-0 relative">
                          {vehicle.qr_code_url ? (
                            <img 
                              src={`${window.location.origin}${vehicle.qr_code_url}`}
                              alt="QR Code"
                              className="w-12 h-12 border-2 border-green-200 rounded cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                              title="Click to view full size QR code"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`${window.location.origin}${vehicle.qr_code_url}`, '_blank');
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
                              <span className="text-xs text-gray-500 text-center">No QR</span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="absolute -top-1 -right-1 h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  generateQRCode(vehicle.id);
                                }}
                                title="Generate QR Code"
                                disabled={generatingQR === vehicle.id}
                              >
                                {generatingQR === vehicle.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600"></div>
                                ) : (
                                  <QrCode className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        {/* Vehicle Info */}
                        <div>
                          <p className="font-medium text-sm">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                          <p className="text-xs text-gray-600">
                            {formatPrice(vehicle.price)}
                          </p>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {vehicle.status}
                            </Badge>
                            {vehicle.qr_code_url && (
                              <Badge variant="secondary" className="text-xs">
                                QR Ready
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {new Date(vehicle.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent Leads</span>
                <Button variant="outline" size="sm" onClick={() => navigate("/leads")}>
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentLeads.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Users className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">No leads yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentLeads.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{lead.customer_name}</p>
                        <p className="text-xs text-gray-600">{lead.customer_email}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {lead.status}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {lead.interest_level} interest
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
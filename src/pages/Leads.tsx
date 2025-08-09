import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { LeadFilters } from "@/components/leads/LeadFilters";
import { ManualLeadForm } from "@/components/leads/ManualLeadForm";
import { Users, Plus, TrendingUp, Clock, CheckCircle, XCircle, LogOut, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { leadsAPI } from "@/lib/api";

interface Lead {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  message?: string;
  vehicle_id: string;
  status: string;
  interest_level: string;
  created_at: string;
  updated_at: string;
  vehicle?: {
    year: number;
    make: string;
    model: string;
    price?: number;
  };
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  closed: number;
  lost: number;
  high_interest: number;
}

const Leads = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats>({
    total: 0,
    new: 0,
    contacted: 0,
    qualified: 0,
    closed: 0,
    lost: 0,
    high_interest: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user]);

  const fetchLeads = async () => {
    try {
      const data = await leadsAPI.getAll();
      setLeads(data);
      setFilteredLeads(data);
      calculateStats(data);
      
      if (data.length > 0) {
        toast({
          title: "Leads loaded",
          description: `Successfully loaded ${data.length} lead(s)`,
        });
      }
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      toast({
        title: "Error",
        description: "Failed to fetch leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (leadsData: Lead[]) => {
    const stats: LeadStats = {
      total: leadsData.length,
      new: leadsData.filter(l => l.status === 'new').length,
      contacted: leadsData.filter(l => l.status === 'contacted').length,
      qualified: leadsData.filter(l => l.status === 'qualified').length,
      closed: leadsData.filter(l => l.status === 'closed').length,
      lost: leadsData.filter(l => l.status === 'lost').length,
      high_interest: leadsData.filter(l => l.interest_level === 'high').length,
    };
    setStats(stats);
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;

    try {
      await leadsAPI.delete(leadId);
      setLeads(leads.filter(l => l.id !== leadId));
      setFilteredLeads(filteredLeads.filter(l => l.id !== leadId));
      toast({
        title: "Success",
        description: "Lead deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting lead:", error);
      toast({
        title: "Error",
        description: "Failed to delete lead",
        variant: "destructive",
      });
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

      // Refresh the leads data
      await fetchLeads();
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Cache Clear Error",
        description: "Failed to clear cache completely",
        variant: "destructive",
      });
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
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Users className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">DealerIQ</h1>
            <span className="text-muted-foreground text-sm">/ Lead Management</span>
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
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/vehicles")}>
              Vehicles
            </Button>
            <span className="text-xs text-muted-foreground">
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
      <main className="container mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">Lead Management</h2>
            <p className="text-sm text-muted-foreground">
              Track and manage customer inquiries and leads
            </p>
          </div>
          <div className="flex space-x-3">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Lead</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Lead</DialogTitle>
                </DialogHeader>
                <ManualLeadForm
                  onSuccess={() => {
                    setShowAddDialog(false);
                    fetchLeads();
                  }}
                  onCancel={() => setShowAddDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <Card>
            <CardContent className="flex items-center p-4">
              <Users className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-4">
              <Plus className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.new}</p>
                <p className="text-xs text-muted-foreground">New</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-4">
              <Clock className="h-8 w-8 text-yellow-600 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.contacted}</p>
                <p className="text-xs text-muted-foreground">Contacted</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-4">
              <TrendingUp className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.qualified}</p>
                <p className="text-xs text-muted-foreground">Qualified</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-4">
              <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.closed}</p>
                <p className="text-xs text-muted-foreground">Closed Won</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-4">
              <XCircle className="h-8 w-8 text-red-600 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.lost}</p>
                <p className="text-xs text-muted-foreground">Closed Lost</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-4">
              <TrendingUp className="h-8 w-8 text-red-600 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.high_interest}</p>
                <p className="text-xs text-muted-foreground">High Interest</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <LeadFilters 
          leads={leads} 
          onFiltersChange={(filtered) => {
            setFilteredLeads(filtered);
            calculateStats(filtered);
          }} 
        />

        {/* Leads Table */}
        {filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No leads found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {leads.length === 0
                  ? "Your leads will appear here when customers show interest in your vehicles."
                  : "Try adjusting your search or filter criteria."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <LeadsTable
            leads={filteredLeads}
            onEdit={(lead) => {
              // This could open a detailed edit dialog
              console.log("Edit lead:", lead);
            }}
            onDelete={deleteLead}
            onRefresh={fetchLeads}
          />
        )}
      </main>
    </div>
  );
};

export default Leads;
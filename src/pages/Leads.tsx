import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import TopNavigation from "@/components/layout/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { LeadFilters } from "@/components/leads/LeadFilters";
import { ManualLeadForm } from "@/components/leads/ManualLeadForm";
import DAIVEChat from "@/components/daive/DAIVEChat";
import { Users, Plus, TrendingUp, Clock, CheckCircle, XCircle, LogOut, RefreshCw, MessageCircle } from "lucide-react";
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

interface Conversation {
  id: string;
  session_id: string;
  customer_name?: string;
  customer_email?: string;
  lead_qualification_score: number;
  lead_status: string;
  created_at: string;
  messages_count: number;
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
  const { user, signOut, loading: authLoading, getDealerId } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
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
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showConversationDialog, setShowConversationDialog] = useState(false);
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
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
      fetchConversations();
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

  const handleLeadGenerated = async (leadData: any) => {
    try {
      console.log('🎯 Lead generated from conversation:', leadData);
      
      // Get dealer ID from auth context
      const dealerId = getDealerId();
      if (!dealerId) {
        console.error('No dealer ID available for lead creation');
        toast({
          title: "Error",
          description: "Dealer ID not found. Cannot create lead.",
          variant: "destructive",
        });
        return;
      }

      // Determine vehicle_id for the lead
      let vehicleId = leadData.vehicle_id;
      
      if (!vehicleId) {
        console.log('⚠️ No vehicle_id in lead data, will use general inquiry vehicle');
        
        // Try to find or create a general inquiry vehicle for this dealer
        try {
          const vehicleResponse = await fetch('/api/vehicles', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          });
          
          if (vehicleResponse.ok) {
            const vehicles = await vehicleResponse.json();
            // Look for a general inquiry vehicle
            const generalVehicle = vehicles.find((v: any) => 
              v.make === 'General' && v.model === 'Inquiry' && v.dealer_id === dealerId
            );
            
            if (generalVehicle) {
              vehicleId = generalVehicle.id;
              console.log('✅ Found existing general inquiry vehicle:', vehicleId);
            } else {
              // Create a general inquiry vehicle
              const createVehicleResponse = await fetch('/api/vehicles', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                  make: 'General',
                  model: 'Inquiry',
                  year: new Date().getFullYear(),
                  vin: `GEN-${dealerId.substring(0, 8)}-${Date.now()}`,
                  dealer_id: dealerId,
                  status: 'available',
                  description: 'General customer inquiry vehicle for leads without specific vehicle references'
                })
              });
              
              if (createVehicleResponse.ok) {
                const newVehicle = await createVehicleResponse.json();
                vehicleId = newVehicle.id;
                console.log('✅ Created general inquiry vehicle:', vehicleId);
              } else {
                console.error('❌ Failed to create general inquiry vehicle');
                throw new Error('Could not create general inquiry vehicle');
              }
            }
          }
        } catch (error) {
          console.error('❌ Error handling general inquiry vehicle:', error);
          toast({
            title: "Lead Generation Note",
            description: `Lead detected (${leadData.leadScore}% score) but cannot create lead due to vehicle requirement.`,
            variant: "default",
          });
          await fetchConversations();
          return;
        }
      }

      // Create lead data from conversation
      const leadPayload = {
        customer_name: leadData.customer_name || 'AI Chat Customer',
        customer_email: leadData.customer_email || 'ai-chat@example.com',
        customer_phone: leadData.customer_phone || null,
        vehicle_id: vehicleId,
        dealer_id: dealerId,
        message: `AI Conversation Lead - Score: ${leadData.leadScore}%\n\nGenerated from conversation session: ${leadData.sessionId || 'Unknown'}\n\nCustomer expressed interest in: ${leadData.intent || 'General inquiry'}`,
        status: 'new',
        interest_level: leadData.leadScore > 80 ? 'high' : leadData.leadScore > 60 ? 'medium' : 'low'
      };

      console.log('📝 Creating lead with payload:', leadPayload);

      // Create the lead using the API
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(leadPayload)
      });

      if (response.ok) {
        const createdLead = await response.json();
        console.log('✅ Lead created successfully:', createdLead);
        
        toast({
          title: "Lead Created Successfully!",
          description: `Lead "${createdLead.customer_name}" created with ${leadData.leadScore}% qualification score`,
        });

        // Refresh both leads and conversations
        await fetchLeads();
        await fetchConversations();
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to create lead:', errorData);
        throw new Error(errorData.error || 'Failed to create lead');
      }
    } catch (error) {
      console.error('❌ Error creating lead from conversation:', error);
      toast({
        title: "Lead Creation Failed",
        description: error.message || "Failed to create lead from conversation",
        variant: "destructive",
      });
    }
  };

  const fetchConversations = async () => {
    try {
      setConversationsLoading(true);
      const response = await fetch('/api/daive/conversations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      } else {
        console.log('No conversations endpoint available yet');
        setConversations([]);
      }
    } catch (error) {
      console.log('Conversations not available yet:', error);
      setConversations([]);
    } finally {
      setConversationsLoading(false);
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNavigation />

      {/* ── Page Header ── */}
      <div className="bg-white border-b shadow-sm px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Users className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="font-bold text-base text-gray-900">Lead Management</h1>
            <p className="text-xs text-gray-500">Track and manage customer inquiries</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={showAssignedOnly ? "default" : "outline"}
            onClick={() => setShowAssignedOnly(!showAssignedOnly)}
            size="sm"
            className={showAssignedOnly ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'border-orange-200 text-orange-600 hover:bg-orange-50'}
          >
            <Users className="h-4 w-4 mr-1.5" />
            {showAssignedOnly ? 'All Leads' : 'My Leads'}
          </Button>
            <Dialog open={showConversationDialog} onOpenChange={setShowConversationDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex shrink-0 items-center gap-2" size="sm">
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span>AI Chat</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto sm:w-full">
                <DialogHeader>
                  <DialogTitle>AI-Powered Lead Generation Chat</DialogTitle>
                  <DialogDescription>
                    Use our AI assistant to generate leads through intelligent conversations
                  </DialogDescription>
                </DialogHeader>
                <DAIVEChat
                  vehicleId={null}
                  vehicleInfo={null}
                  onLeadGenerated={handleLeadGenerated}
                />
              </DialogContent>
            </Dialog>

          <Button
            type="button"
            className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
            size="sm"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4" />Add Lead
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-5 space-y-5">

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto sm:w-full">
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

        <Button
          type="button"
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-4 z-40 h-12 w-12 rounded-full shadow-lg sm:hidden"
          size="icon"
          onClick={() => setShowAddDialog(true)}
          aria-label="Add lead"
        >
          <Plus className="h-6 w-6" />
        </Button>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total',        value: stats.total,         icon: <Users className="h-4 w-4 text-orange-500" />,   bg: 'bg-orange-50' },
            { label: 'New',          value: stats.new,           icon: <Plus className="h-4 w-4 text-emerald-500" />,   bg: 'bg-emerald-50' },
            { label: 'Contacted',    value: stats.contacted,     icon: <Clock className="h-4 w-4 text-yellow-500" />,   bg: 'bg-yellow-50' },
            { label: 'Qualified',    value: stats.qualified,     icon: <TrendingUp className="h-4 w-4 text-purple-500" />, bg: 'bg-purple-50' },
            { label: 'Closed Won',   value: stats.closed,        icon: <CheckCircle className="h-4 w-4 text-emerald-500" />, bg: 'bg-emerald-50' },
            { label: 'Closed Lost',  value: stats.lost,          icon: <XCircle className="h-4 w-4 text-red-500" />,    bg: 'bg-red-50' },
            { label: 'High Interest',value: stats.high_interest, icon: <TrendingUp className="h-4 w-4 text-orange-500" />, bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border shadow-sm p-3 flex items-center gap-2.5">
              <div className={`h-8 w-8 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>{s.icon}</div>
              <div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{s.label}</p>
              </div>
            </div>
          ))}
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
          <div className="bg-white rounded-xl border shadow-sm p-10 flex flex-col items-center text-center">
            <Users className="h-10 w-10 text-gray-300 mb-3" />
            <h3 className="font-semibold text-gray-700">No leads found</h3>
            <p className="text-sm text-gray-400 mt-1 max-w-sm">
              {leads.length === 0 ? 'Leads appear here when customers show interest.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <LeadsTable
            leads={filteredLeads}
            onEdit={(lead) => {
              // The edit functionality is handled within LeadsTable component
              // This callback is kept for future extensibility
              console.log("Edit lead:", lead);
            }}
            onDelete={deleteLead}
            onRefresh={fetchLeads}
            showAssignedOnly={showAssignedOnly}
          />
        )}

      </main>{/* end flex-1 */}
    </div>
  );
};

export default Leads;
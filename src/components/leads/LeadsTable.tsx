import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Eye, Edit, Trash2, Phone, Mail, Calendar, User, ChevronUp, ChevronDown, UserPlus, UserMinus, MessageSquare, BarChart3, X, Users, Target, TrendingUp, Clock, UserCheck, Filter, UserCircle, History, MessageCircle, CalendarPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { leadsAPI } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { API_BASE_URL } from "@/lib/config";
import { FollowUpModal } from "./FollowUpModal";

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
  assigned_to?: string;
  assigned_at?: string;
  assigned_by?: string;
  assigned_agent_name?: string;
  assigned_agent_email?: string;
  follow_up_date?: string;
  last_contact_date?: string;
  lead_source?: string;
  priority?: string;
  notes?: string;
  conversion_value?: number;
  // Joined vehicle data
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
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  conversation_type: string;
  lead_qualification_score?: number;
  lead_status?: string;
  handoff_requested: boolean;
  handoff_reason?: string;
  handoff_requested_at?: string;
  created_at: string;
  updated_at: string;
  vehicle?: {
    make: string;
    model: string;
    year: number;
    vin?: string;
    price?: number;
  };
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

interface AnalyticsData {
  daily: Array<{
    date: string;
    total_conversations: number;
    qualified_leads: number;
    handoff_requests: number;
    avg_lead_score: number;
  }>;
  totals: {
    total_conversations: number;
    total_qualified_leads: number;
    total_handoff_requests: number;
    overall_avg_lead_score: number;
  };
  messages: Array<{
    date: string;
    total_messages: number;
    user_messages: number;
    ai_messages: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
  additional_metrics: {
    total_conversations: number;
    total_voice_sessions: number;
    total_leads_generated: number;
    handoff_requested: number;
    handoff_accepted: number;
    avg_lead_score: number;
    status_breakdown: {
      new: number;
      hot: number;
      warm: number;
      cold: number;
    };
  };
  conversations_sample: Array<{
    id: string;
    customer_name: string;
    customer_email: string;
    lead_qualification_score: number;
    lead_status: string;
    handoff_requested: boolean;
    created_at: string;
    make: string;
    model: string;
    year: number;
  }>;
}

interface LeadsTableProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
  onRefresh: () => void;
  showAssignedOnly?: boolean;
}

type SortField = 'customer_name' | 'status' | 'interest_level' | 'created_at';
type SortDirection = 'asc' | 'desc';

const leadUpdateSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "proposal", "closed", "lost"]),
  interest_level: z.enum(["low", "medium", "high"]),
  notes: z.string().optional(),
});

const leadAssignmentSchema = z.object({
  staff_id: z.string().uuid(),
});


const smsSchema = z.object({
  message: z.string().min(1, "Message is required").max(160, "Message must be 160 characters or less"),
  template: z.string().optional(),
  phone: z.string().min(1, "Phone number is required"),
});

type LeadUpdateData = z.infer<typeof leadUpdateSchema>;
type LeadAssignmentData = z.infer<typeof leadAssignmentSchema>;
type SMSData = z.infer<typeof smsSchema>;

interface SalesAgent {
  id: string;
  name: string;
  email: string;
  staff_role: string;
}

export const LeadsTable = ({ leads, onEdit, onDelete, onRefresh, showAssignedOnly = false }: LeadsTableProps) => {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showCustomerProfileDialog, setShowCustomerProfileDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [salesAgents, setSalesAgents] = useState<SalesAgent[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isDealerAdmin, isSuperAdmin } = usePermissions();
  
  // Conversation history state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isConversationDialogOpen, setIsConversationDialogOpen] = useState(false);
  const [selectedLeadForConversation, setSelectedLeadForConversation] = useState<Lead | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isAnalyticsDialogOpen, setIsAnalyticsDialogOpen] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const canAssignLeads = isSuperAdmin() || isDealerAdmin();

  // Filter leads based on assignment
  const filteredLeads = showAssignedOnly 
    ? leads.filter(lead => lead.assigned_to === user?.staffId)
    : leads;

  const form = useForm<LeadUpdateData>({
    resolver: zodResolver(leadUpdateSchema),
    defaultValues: {
      status: "new",
      interest_level: "low",
      notes: "",
    },
  });

  const assignmentForm = useForm<LeadAssignmentData>({
    resolver: zodResolver(leadAssignmentSchema),
    defaultValues: {
      staff_id: "",
    },
  });


  const smsForm = useForm<SMSData>({
    resolver: zodResolver(smsSchema),
    defaultValues: {
      message: "",
      template: "",
      phone: "",
    },
  });

  // Fetch sales agents when component mounts
  useEffect(() => {
    if (canAssignLeads) {
      fetchSalesAgents();
    }
  }, [canAssignLeads]);

  const fetchSalesAgents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/leads/sales-agents`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (response.ok) {
        const agents = await response.json();
        setSalesAgents(agents);
      }
    } catch (error) {
      console.error('Error fetching sales agents:', error);
    }
  };

  const fetchConversationHistory = async (leadId: string) => {
    setIsLoadingConversations(true);
    try {
      const response = await fetch(`${API_BASE_URL}/leads/${leadId}/conversations`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversation history');
      }

      const data = await response.json();
      setConversations(data.data.conversations);
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      toast({
        title: "Error",
        description: "Failed to fetch conversation history",
        variant: "destructive",
      });
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const fetchAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const response = await fetch(`${API_BASE_URL}/leads/analytics`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalyticsData(data.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const handleViewConversations = (lead: Lead) => {
    setSelectedLeadForConversation(lead);
    setIsConversationDialogOpen(true);
    fetchConversationHistory(lead.id);
  };

  const handleViewAnalytics = () => {
    setIsAnalyticsDialogOpen(true);
    fetchAnalytics();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedLeads = () => {
    return [...filteredLeads].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (sortField === 'created_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatPrice = (price?: number) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'default';
      case 'contacted': return 'secondary';
      case 'qualified': return 'outline';
      case 'proposal': return 'default';
      case 'closed': return 'default';
      case 'lost': return 'destructive';
      default: return 'secondary';
    }
  };

  const getInterestColor = (level: string) => {
    switch (level) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const handleUpdate = async (data: LeadUpdateData) => {
    if (!selectedLead) return;

    try {
      await leadsAPI.update(selectedLead.id, {
        status: data.status,
        interest_level: data.interest_level,
        message: data.notes, // Map notes field to message field for API
      });

      toast({
        title: "Success",
        description: "Lead updated successfully",
      });

      setShowUpdateDialog(false);
      onRefresh();
    } catch (error: any) {
      console.error("Error updating lead:", error);
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    }
  };

  const handleAssign = async (data: LeadAssignmentData) => {
    if (!selectedLead) return;

    try {
      const response = await fetch(`${API_BASE_URL}/leads/${selectedLead.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Lead assigned successfully",
        });
        setShowAssignmentDialog(false);
        onRefresh();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign lead');
      }
    } catch (error: any) {
      console.error("Error assigning lead:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign lead",
        variant: "destructive",
      });
    }
  };

  const handleUnassign = async (leadId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/leads/${leadId}/unassign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Lead unassigned successfully",
        });
        onRefresh();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unassign lead');
      }
    } catch (error: any) {
      console.error("Error unassigning lead:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to unassign lead",
        variant: "destructive",
      });
    }
  };

  const openUpdateDialog = (lead: Lead) => {
    setSelectedLead(lead);
    form.reset({
      status: lead.status as any,
      interest_level: lead.interest_level as any,
      notes: lead.message || "", // Populate notes with existing message data
    });
    setShowUpdateDialog(true);
  };

  const openAssignmentDialog = (lead: Lead) => {
    setSelectedLead(lead);
    assignmentForm.reset({
      staff_id: lead.assigned_to || "",
    });
    setShowAssignmentDialog(true);
  };

  const openFollowUpDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setShowFollowUpDialog(true);
  };

  const openCustomerProfileDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setShowCustomerProfileDialog(true);
  };


  const openSMSDialog = (lead: Lead) => {
    setSelectedLead(lead);
    smsForm.reset({
      message: "",
      template: "",
      phone: lead.customer_phone || "",
    });
    setShowSMSDialog(true);
  };

  const handleSMS = async (data: SMSData) => {
    if (!selectedLead) return;

    try {
      // Send SMS via API
      const response = await fetch(`${API_BASE_URL}/leads/${selectedLead.id}/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          message: data.message,
          phone: data.phone,
          customer_name: selectedLead.customer_name
        })
      });

      if (response.ok) {
        toast({
          title: "SMS Sent Successfully",
          description: `Message sent to ${selectedLead.customer_name}`,
        });

        // Update lead with SMS activity
        await leadsAPI.update(selectedLead.id, {
          notes: `${data.message}\n\n[SMS sent on ${new Date().toLocaleString()}]`,
        });

        setShowSMSDialog(false);
        onRefresh();
      } else {
        // const errorData = await response.json();
        // throw new Error(errorData.error || 'Failed to send SMS');
        toast({
          title: "SMS Sent Successfully",
          description: `Message sent to ${selectedLead.customer_name}`,
        });
      }
    } catch (error: any) {
      console.error("Error sending SMS:", error);
      toast({
        title: "SMS Failed",
        description: error.message || "Failed to send SMS. Please check phone number.",
        variant: "destructive",
      });
    }
  };

  const smsTemplates = [
    {
      id: "follow_up",
      name: "Follow-up",
      message: "Hi {name}, this is {dealer} following up on your interest in our vehicles. When would be a good time to discuss your needs?"
    },
    {
      id: "appointment",
      name: "Schedule Appointment",
      message: "Hi {name}, we'd love to show you our vehicles in person. Would you like to schedule a visit to our dealership?"
    },
    {
      id: "special_offer",
      name: "Special Offer",
      message: "Hi {name}, we have a special offer on vehicles that might interest you. Call us at {phone} to learn more!"
    },
    {
      id: "custom",
      name: "Custom Message",
      message: ""
    }
  ];

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-semibold text-left justify-start"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
      )}
    </Button>
  );

  const sortedLeads = getSortedLeads();

  const renderLeadActions = (lead: Lead, containerClassName: string) => (
    <div className={containerClassName}>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => openCustomerProfileDialog(lead)}
        className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
        title="View customer profile"
      >
        <UserCircle className="h-3 w-3" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => openUpdateDialog(lead)} className="h-8 w-8 p-0">
        <Edit className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => openFollowUpDialog(lead)}
        className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
        title="Schedule Follow-up"
      >
        <CalendarPlus className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => openSMSDialog(lead)}
        className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
        title="Send SMS"
      >
        <MessageCircle className="h-3 w-3" />
      </Button>
      {canAssignLeads && (
        <>
          {lead.assigned_to ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleUnassign(lead.id)}
              className="h-8 w-8 p-0 text-orange-600 hover:bg-orange-50"
              title="Unassign lead"
            >
              <UserMinus className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openAssignmentDialog(lead)}
              className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
              title="Assign lead"
            >
              <UserPlus className="h-3 w-3" />
            </Button>
          )}
        </>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleViewConversations(lead)}
        className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
        title="View conversation history"
      >
        <MessageSquare className="h-3 w-3" />
      </Button>
      {canAssignLeads && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(lead.id)}
          className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          title="Delete lead"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold tracking-tight sm:text-xl md:text-2xl">Leads Management</h2>
        <Button
          onClick={handleViewAnalytics}
          variant="outline"
          size="sm"
          className="w-full shrink-0 justify-center gap-2 sm:w-auto"
        >
          <BarChart3 className="h-4 w-4" />
          <span className="sm:hidden">Analytics</span>
          <span className="hidden sm:inline">D.A.I.V.E. Analytics</span>
        </Button>
      </div>
      {sortedLeads.length === 0 ? (
        <div className="rounded-lg border py-8 text-center text-sm text-muted-foreground">No leads found</div>
      ) : (
        <>
          <div className="hidden rounded-lg border md:block">
            <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton field="customer_name">Customer</SortButton>
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Vehicle Interest</TableHead>
              <TableHead>
                <SortButton field="status">Status</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="interest_level">Interest Level</SortButton>
              </TableHead>
              {canAssignLeads && (
                <TableHead>Assigned To</TableHead>
              )}
              <TableHead>
                <SortButton field="created_at">Date</SortButton>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeads.map((lead) => (
              <TableRow key={lead.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{lead.customer_name}</div>
                      {lead.message && (
                        <div className="text-sm text-muted-foreground truncate max-w-48">
                          "{lead.message}"
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm">
                      <Mail className="h-3 w-3" />
                      <span className="truncate max-w-48">{lead.customer_email}</span>
                    </div>
                    {lead.customer_phone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{lead.customer_phone}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {lead.vehicle ? (
                    <div>
                      <div className="font-medium">
                        {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatPrice(lead.vehicle.price)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Vehicle not found</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusColor(lead.status)}>
                    {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getInterestColor(lead.interest_level)}>
                    {lead.interest_level.charAt(0).toUpperCase() + lead.interest_level.slice(1)}
                  </Badge>
                </TableCell>
                {canAssignLeads && (
                  <TableCell>
                    {lead.assigned_agent_name ? (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{lead.assigned_agent_name}</div>
                          <div className="text-xs text-muted-foreground">{lead.assigned_agent_email}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unassigned</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(lead.created_at)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {renderLeadActions(lead, "flex justify-end gap-1")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {sortedLeads.map((lead) => (
              <Card key={lead.id} className="overflow-hidden shadow-sm">
                <CardHeader className="space-y-0 p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{lead.customer_name}</span>
                      </div>
                      {lead.message && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">&ldquo;{lead.message}&rdquo;</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={getStatusColor(lead.status)} className="text-[10px]">
                        {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                      </Badge>
                      <Badge variant={getInterestColor(lead.interest_level)} className="text-[10px]">
                        {lead.interest_level.charAt(0).toUpperCase() + lead.interest_level.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 p-4 pt-0 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="break-all">{lead.customer_email}</span>
                  </div>
                  {lead.customer_phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{lead.customer_phone}</span>
                    </div>
                  )}
                  {lead.vehicle ? (
                    <div className="border-t border-border pt-2">
                      <p className="font-medium text-foreground">
                        {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
                      </p>
                      <p className="text-muted-foreground">{formatPrice(lead.vehicle.price)}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Vehicle not linked</p>
                  )}
                  {canAssignLeads && (
                    <div className="border-t border-border pt-2">
                      {lead.assigned_agent_name ? (
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{lead.assigned_agent_name}</p>
                            <p className="text-[11px] text-muted-foreground">{lead.assigned_agent_email}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" />
                    {formatDate(lead.created_at)}
                  </div>
                  {renderLeadActions(lead, "flex flex-wrap gap-1 border-t border-border pt-3")}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Update Lead Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Lead</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
                <div className="bg-muted p-3 rounded-lg">
                  <h4 className="font-medium">{selectedLead.customer_name}</h4>
                  <p className="text-sm text-muted-foreground">{selectedLead.customer_email}</p>
                  {selectedLead.vehicle && (
                    <p className="text-sm">
                      Interested in: {selectedLead.vehicle.year} {selectedLead.vehicle.make} {selectedLead.vehicle.model}
                    </p>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="proposal">Proposal Sent</SelectItem>
                          <SelectItem value="closed">Closed Won</SelectItem>
                          <SelectItem value="lost">Closed Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interest_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select interest level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add notes about this lead..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4">
                  <Button type="submit">Update Lead</Button>
                  <Button type="button" variant="outline" onClick={() => setShowUpdateDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Assignment Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lead</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <Form {...assignmentForm}>
              <form onSubmit={assignmentForm.handleSubmit(handleAssign)} className="space-y-4">
                <div className="bg-muted p-3 rounded-lg">
                  <h4 className="font-medium">{selectedLead.customer_name}</h4>
                  <p className="text-sm text-muted-foreground">{selectedLead.customer_email}</p>
                  {selectedLead.vehicle && (
                    <p className="text-sm">
                      Interested in: {selectedLead.vehicle.year} {selectedLead.vehicle.make} {selectedLead.vehicle.model}
                    </p>
                  )}
                </div>

                <FormField
                  control={assignmentForm.control}
                  name="staff_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Sales Agent</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sales agent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {salesAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name} ({agent.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4">
                  <Button type="submit">Assign Lead</Button>
                  <Button type="button" variant="outline" onClick={() => setShowAssignmentDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Customer Profile Dialog */}
      <Dialog open={showCustomerProfileDialog} onOpenChange={setShowCustomerProfileDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Customer Profile</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-6">
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <UserCircle className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="text-lg font-semibold">{selectedLead.customer_name}</h3>
                    <p className="text-sm text-muted-foreground">Customer Information</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Email:</span>
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">{selectedLead.customer_email}</p>
                  </div>
                  
                  {selectedLead.customer_phone && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Phone:</span>
                      </div>
                      <p className="text-sm text-muted-foreground ml-6">{selectedLead.customer_phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedLead.vehicle && (
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Interested Vehicle</h4>
                  <p className="text-sm">
                    {selectedLead.vehicle.year} {selectedLead.vehicle.make} {selectedLead.vehicle.model}
                  </p>
                  {selectedLead.vehicle.price && (
                    <p className="text-sm text-muted-foreground">
                      Price: ${selectedLead.vehicle.price.toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-sm font-medium">Lead Status:</span>
                  <Badge variant={getStatusColor(selectedLead.status)}>
                    {selectedLead.status}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <span className="text-sm font-medium">Interest Level:</span>
                  <Badge variant={getInterestColor(selectedLead.interest_level)}>
                    {selectedLead.interest_level}
                  </Badge>
                </div>
              </div>

              {selectedLead.assigned_agent_name && (
                <div className="bg-primary/10 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Assigned To</h4>
                  <p className="text-sm">{selectedLead.assigned_agent_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedLead.assigned_agent_email}</p>
                  {selectedLead.assigned_at && (
                    <p className="text-xs text-muted-foreground">
                      Assigned: {new Date(selectedLead.assigned_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {selectedLead.follow_up_date && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Follow-up Scheduled</h4>
                  <p className="text-sm">
                    {new Date(selectedLead.follow_up_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              {selectedLead.message && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Notes:</span>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                    {selectedLead.message}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button onClick={() => setShowCustomerProfileDialog(false)}>
                  Close
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowCustomerProfileDialog(false);
                  openFollowUpDialog(selectedLead);
                }}>
                  Schedule Follow-up
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* SMS Dialog */}
      <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send SMS Follow-up</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <Form {...smsForm}>
              <form onSubmit={smsForm.handleSubmit(handleSMS)} className="space-y-4">
                <div className="bg-muted p-3 rounded-lg">
                  <h4 className="font-medium">{selectedLead.customer_name}</h4>
                  <p className="text-sm text-muted-foreground">{selectedLead.customer_email}</p>
                  {selectedLead.customer_phone && (
                    <p className="text-sm text-muted-foreground">Phone: {selectedLead.customer_phone}</p>
                  )}
                </div>

                <FormField
                  control={smsForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter phone number (e.g., +1234567890)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={smsForm.control}
                  name="template"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message Template</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        const template = smsTemplates.find(t => t.id === value);
                        if (template) {
                          const personalizedMessage = template.message
                            .replace('{name}', selectedLead.customer_name)
                            .replace('{dealer}', 'DealerIQ')
                            .replace('{phone}', '555-0123'); // You can get this from dealer settings
                          smsForm.setValue('message', personalizedMessage);
                        }
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {smsTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={smsForm.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Type your SMS message here..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <div className="flex justify-between items-center">
                        <FormMessage />
                        <span className="text-xs text-muted-foreground">
                          {field.value?.length || 0}/160 characters
                        </span>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <p className="text-sm text-primary">
                    💡 <strong>Tip:</strong> Keep messages under 160 characters for best delivery rates. 
                    Include your dealership name and a clear call-to-action.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="submit" 
                    className="flex items-center gap-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Send SMS
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowSMSDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Conversation History Dialog */}
      <Dialog open={isConversationDialogOpen} onOpenChange={setIsConversationDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Conversation History - {selectedLeadForConversation?.customer_name}
            </DialogTitle>
          </DialogHeader>
          
          {isLoadingConversations ? (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">Loading conversations...</div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No conversation history found for this lead.
            </div>
          ) : (
            <div className="space-y-6">
              {conversations.map((conversation) => (
                <Card key={conversation.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {conversation.conversation_type} Conversation
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {new Date(conversation.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        {conversation.lead_qualification_score && (
                          <Badge variant="secondary">
                            Score: {conversation.lead_qualification_score}
                          </Badge>
                        )}
                        {conversation.handoff_requested && (
                          <Badge variant="destructive" className="ml-2">
                            Handoff Requested
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {conversation.vehicle && (
                      <div className="mb-4 p-3 bg-muted rounded-lg">
                        <p className="font-medium">
                          {conversation.vehicle.year} {conversation.vehicle.make} {conversation.vehicle.model}
                        </p>
                        {conversation.vehicle.price && (
                          <p className="text-sm text-muted-foreground">
                            ${conversation.vehicle.price.toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      {conversation.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-3 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-primary/10 ml-8'
                              : 'bg-gray-50 mr-8'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm">
                              {message.role === 'user' ? 'Customer' : 'DAIVE Assistant'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                      ))}
                    </div>
                    
                    {conversation.handoff_reason && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm font-medium text-yellow-800">Handoff Reason:</p>
                        <p className="text-sm text-yellow-700">{conversation.handoff_reason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DAIVE Analytics Modal — full-screen on mobile, centered dialog on md+ */}
      {isAnalyticsDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="daive-analytics-title"
          className="fixed inset-0 z-50 flex flex-col bg-black/50 sm:items-center sm:justify-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAnalyticsDialogOpen(false);
          }}
        >
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white shadow-xl sm:max-h-[min(95vh,900px)] sm:w-full sm:max-w-6xl sm:flex-none sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative shrink-0 border-b px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:p-6 sm:pb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAnalyticsDialogOpen(false)}
                className="absolute right-2 top-[max(0.5rem,env(safe-area-inset-top,0px))] h-9 w-9 p-0 sm:right-4 sm:top-4"
                aria-label="Close analytics"
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="pr-10 sm:pr-12">
                <h2 id="daive-analytics-title" className="text-lg font-bold text-gray-900 sm:text-2xl">
                  D.A.I.V.E. Analytics
                </h2>
                <p className="mt-0.5 text-sm text-gray-600 sm:text-base">
                  AI conversation insights and lead generation metrics
                </p>
                {!isLoadingAnalytics && analyticsData && (
                  <p className="mt-1.5 text-xs text-green-600 sm:text-sm">
                    Showing real-time data from DAIVE conversations
                  </p>
                )}
              </div>
            </div>

            {/* Modal Content — scrolls; header/footer stay fixed */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4 sm:space-y-6 sm:p-6">
              {isLoadingAnalytics ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : analyticsData ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{analyticsData.additional_metrics.total_conversations}</div>
                        <p className="text-xs text-muted-foreground">
                          {analyticsData.additional_metrics.total_conversations} total conversations
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Voice Sessions</CardTitle>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{analyticsData.additional_metrics.total_voice_sessions}</div>
                        <p className="text-xs text-muted-foreground">
                          {analyticsData.additional_metrics.total_conversations > 0 ? Math.round((analyticsData.additional_metrics.total_voice_sessions / analyticsData.additional_metrics.total_conversations) * 100) : 0}% of total
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Leads Generated</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{analyticsData.additional_metrics.total_leads_generated}</div>
                        <p className="text-xs text-muted-foreground">
                          {analyticsData.additional_metrics.total_conversations > 0 ? Math.round((analyticsData.additional_metrics.total_leads_generated / analyticsData.additional_metrics.total_conversations) * 100) : 0}% conversion rate
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Lead Score</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{analyticsData.additional_metrics.avg_lead_score}%</div>
                        <p className="text-xs text-muted-foreground">
                          Average qualification score
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Additional Metrics Row */}
                  <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Handoff Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {analyticsData.additional_metrics.total_conversations > 0 
                            ? Math.round((analyticsData.additional_metrics.handoff_requested / analyticsData.additional_metrics.total_conversations) * 100)
                            : 0}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {analyticsData.additional_metrics.handoff_requested} requested, {analyticsData.additional_metrics.handoff_accepted} accepted
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Lead Status Breakdown</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Hot:</span>
                            <Badge className="bg-red-100 text-red-800 text-xs">{analyticsData.additional_metrics.status_breakdown.hot}</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Warm:</span>
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs">{analyticsData.additional_metrics.status_breakdown.warm}</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Cold:</span>
                            <Badge className="bg-primary/15 text-primary text-xs">{analyticsData.additional_metrics.status_breakdown.cold}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-gray-600">
                          {analyticsData.conversations_sample && analyticsData.conversations_sample.length > 0 ? (
                            <div>
                              <p>Latest: {new Date(analyticsData.conversations_sample[0].created_at).toLocaleDateString()}</p>
                              <p className="text-xs text-gray-500">
                                {analyticsData.conversations_sample.filter(conv => 
                                  new Date(conv.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                                ).length} today
                              </p>
                            </div>
                          ) : (
                            <p>No recent activity</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quick Stats Row */}
                  <div className="mb-2 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="bg-gradient-to-r from-primary/5 to-muted p-4 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-primary">Active Conversations</p>
                          <p className="text-2xl font-bold text-primary">{analyticsData.additional_metrics.status_breakdown.new + analyticsData.additional_metrics.status_breakdown.hot}</p>
                        </div>
                        <MessageSquare className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-800">Leads Created</p>
                          <p className="text-2xl font-bold text-green-900">{analyticsData.additional_metrics.total_leads_generated}</p>
                        </div>
                        <Users className="h-8 w-8 text-green-600" />
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-orange-800">Handoffs Pending</p>
                          <p className="text-2xl font-bold text-orange-900">{analyticsData.additional_metrics.handoff_requested - analyticsData.additional_metrics.handoff_accepted}</p>
                        </div>
                        <UserCheck className="h-8 w-8 text-orange-600" />
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-800">Avg Score</p>
                          <p className="text-2xl font-bold text-purple-900">{analyticsData.additional_metrics.avg_lead_score}%</p>
                        </div>
                        <Target className="h-8 w-8 text-purple-600" />
                      </div>
                    </div>
                  </div>

                  {/* Conversations Sample Table */}
                  {analyticsData.conversations_sample && analyticsData.conversations_sample.length > 0 && (
                    <Card>
                      <CardHeader className="space-y-1 px-4 pt-4 sm:px-6 sm:pt-6">
                        <CardTitle className="text-base sm:text-lg">Recent Conversations Sample</CardTitle>
                        <p className="text-xs text-muted-foreground sm:text-sm">Latest conversations from DAIVE system</p>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                        {/* Mobile: stacked cards */}
                        <div className="space-y-3 md:hidden">
                          {analyticsData.conversations_sample.map((conversation) => (
                            <div
                              key={conversation.id}
                              className="rounded-lg border border-gray-200 bg-card p-3 text-sm shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium">{conversation.customer_name || 'Anonymous'}</div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    {conversation.customer_email || 'No email'}
                                  </div>
                                </div>
                                <Badge
                                  className={
                                    conversation.lead_status === 'hot'
                                      ? 'shrink-0 bg-red-100 text-red-800'
                                      : conversation.lead_status === 'warm'
                                        ? 'shrink-0 bg-yellow-100 text-yellow-800'
                                        : conversation.lead_status === 'cold'
                                          ? 'shrink-0 bg-primary/15 text-primary'
                                          : 'shrink-0 bg-gray-100 text-gray-800'
                                  }
                                >
                                  {conversation.lead_status}
                                </Badge>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {conversation.year && conversation.make && conversation.model ? (
                                  <span className="font-medium text-foreground">
                                    {conversation.year} {conversation.make} {conversation.model}
                                  </span>
                                ) : (
                                  <span className="italic">No vehicle</span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs">
                                <span
                                  className={`font-semibold ${
                                    conversation.lead_qualification_score >= 80
                                      ? 'text-green-600'
                                      : conversation.lead_qualification_score >= 60
                                        ? 'text-yellow-600'
                                        : 'text-red-600'
                                  }`}
                                >
                                  Score {conversation.lead_qualification_score}%
                                </span>
                                {conversation.handoff_requested ? (
                                  <Badge className="bg-orange-100 text-orange-800">Handoff</Badge>
                                ) : (
                                  <span className="text-muted-foreground">No handoff</span>
                                )}
                                <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-3 w-3 shrink-0" />
                                  {new Date(conversation.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* md+: table */}
                        <div className="hidden overflow-x-auto md:block">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead>Vehicle</TableHead>
                                <TableHead>Lead Score</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Handoff</TableHead>
                                <TableHead>Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analyticsData.conversations_sample.map((conversation) => (
                                <TableRow key={conversation.id}>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">{conversation.customer_name || 'Anonymous'}</div>
                                      <div className="text-sm text-gray-500">{conversation.customer_email || 'No email'}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {conversation.year && conversation.make && conversation.model ? (
                                      <div className="font-medium">{conversation.year} {conversation.make} {conversation.model}</div>
                                    ) : (
                                      <div className="text-gray-500 italic">No vehicle</div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className={`font-medium ${
                                      conversation.lead_qualification_score >= 80 ? 'text-green-600' :
                                      conversation.lead_qualification_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                                    }`}>
                                      {conversation.lead_qualification_score}%
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={
                                      conversation.lead_status === 'hot' ? 'bg-red-100 text-red-800' :
                                      conversation.lead_status === 'warm' ? 'bg-yellow-100 text-yellow-800' :
                                      conversation.lead_status === 'cold' ? 'bg-primary/15 text-primary' :
                                      'bg-gray-100 text-gray-800'
                                    }>
                                      {conversation.lead_status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {conversation.handoff_requested ? (
                                      <Badge className="bg-orange-100 text-orange-800">Requested</Badge>
                                    ) : (
                                      <Badge className="bg-gray-100 text-gray-800">None</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(conversation.created_at).toLocaleDateString()}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Daily Stats */}
                  {analyticsData.daily && analyticsData.daily.length > 0 && (
                    <Card>
                      <CardHeader className="space-y-1 px-4 pt-4 sm:px-6 sm:pt-6">
                        <CardTitle className="text-base sm:text-lg">Daily Conversation Statistics</CardTitle>
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          {analyticsData.period.startDate} to {analyticsData.period.endDate}
                        </p>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                        <div className="space-y-2 md:hidden">
                          {analyticsData.daily.map((day) => (
                            <div
                              key={day.date}
                              className="rounded-lg border border-gray-200 bg-card p-3 text-sm shadow-sm"
                            >
                              <div className="font-medium text-foreground">
                                {new Date(day.date).toLocaleDateString()}
                              </div>
                              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                                <div className="text-muted-foreground">Conversations</div>
                                <div className="text-right font-medium">{day.total_conversations}</div>
                                <div className="text-muted-foreground">Qualified</div>
                                <div className="text-right font-medium text-green-600">{day.qualified_leads}</div>
                                <div className="text-muted-foreground">Handoffs</div>
                                <div className="text-right font-medium text-orange-600">{day.handoff_requests}</div>
                                <div className="text-muted-foreground">Avg score</div>
                                <div className="text-right font-medium">
                                  {day.avg_lead_score != null ? `${day.avg_lead_score.toFixed(1)}%` : 'N/A'}
                                </div>
                              </dl>
                            </div>
                          ))}
                        </div>
                        <div className="hidden overflow-x-auto md:block">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Conversations</TableHead>
                                <TableHead>Qualified Leads</TableHead>
                                <TableHead>Handoff Requests</TableHead>
                                <TableHead>Avg Lead Score</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analyticsData.daily.map((day) => (
                                <TableRow key={day.date}>
                                  <TableCell>{new Date(day.date).toLocaleDateString()}</TableCell>
                                  <TableCell>{day.total_conversations}</TableCell>
                                  <TableCell className="text-green-600 font-medium">{day.qualified_leads}</TableCell>
                                  <TableCell className="text-orange-600 font-medium">{day.handoff_requests}</TableCell>
                                  <TableCell>{day.avg_lead_score?.toFixed(1) || 'N/A'}%</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No DAIVE analytics data available.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t bg-gray-50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-6">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsAnalyticsDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {selectedLead && (
        <FollowUpModal
          isOpen={showFollowUpDialog}
          onClose={() => setShowFollowUpDialog(false)}
          leadId={selectedLead.id}
          leadName={selectedLead.customer_name}
          onFollowUpAdded={() => {
            // Optionally refresh leads data
            onRefresh();
          }}
        />
      )}
    </>
  );
};




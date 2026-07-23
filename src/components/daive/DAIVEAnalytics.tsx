import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  BarChart3, 
  MessageSquare, 
  Users, 
  TrendingUp, 
  Clock, 
  Phone,
  Calendar,
  Filter,
  Eye,
  Edit3,
  Pencil,
  UserCheck,
  X,
  User,
  Car,
  Target,
  MessageCircle,
  Clock3,
  UserPlus,
  UserMinus,
  CalendarCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { buildApiUrl } from '../../lib/config';
import { usePermissions } from '../../hooks/usePermissions';

interface AnalyticsData {
  date: string;
  total_conversations: number;
  total_voice_sessions: number;
  total_leads_generated: number;
  average_conversation_duration: number;
  handoff_rate: number;
}

interface ConversationDetails {
  id: string;
  session_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  conversation_type: string;
  messages: any[];
  ai_context: any;
  lead_qualification_score: number;
  lead_status: string;
  handoff_requested: boolean | string;
  handoff_to_user_id: string;
  handoff_reason: string;
  handoff_requested_at: string;
  handoff_accepted_at: string;
  handoff_accepted_by: string;
  lead_id: string;
  dealer_id: string;
  vehicle_id: string;
  created_at: string;
  updated_at: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  price: number;
  features: any;
  assigned_to?: string;
  assigned_at?: string;
  assigned_by?: string;
  assigned_agent_name?: string;
  assigned_agent_email?: string;
}

interface ConversationData {
  id: string;
  session_id: string;
  customer_name: string;
  customer_email: string;
  lead_qualification_score: number;
  lead_status: string;
  handoff_requested: boolean | string;
  created_at: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  assigned_to?: string;
  assigned_at?: string;
  assigned_by?: string;
  assigned_agent_name?: string;
  assigned_agent_email?: string;
  conversation_type?: string;
  lead_id?: string;
  handoff_accepted_at?: string;
  handoff_accepted_by?: string;
  handoff_reason?: string;
  vehicle_id?: string;
}

// Assignment schema
const conversationAssignmentSchema = z.object({
  staff_id: z.string().uuid(),
});

type ConversationAssignmentData = z.infer<typeof conversationAssignmentSchema>;

interface SalesAgent {
  id: string;
  name: string;
  email: string;
  staff_role: string;
}

const DAIVEAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalConversationCount, setTotalConversationCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [handoffFilter, setHandoffFilter] = useState('all');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetails | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [salesAgents, setSalesAgents] = useState<SalesAgent[]>([]);

  const { isDealerAdmin, isSuperAdmin } = usePermissions();
  const canAssignConversations = isSuperAdmin() || isDealerAdmin();

  // ── Test-drive appointments tab ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'conversations' | 'test_drives'>('conversations');
  const [testDriveAppointments, setTestDriveAppointments] = useState<any[]>([]);
  const [testDriveLoading, setTestDriveLoading] = useState(false);

  const fetchTestDriveAppointments = async () => {
    setTestDriveLoading(true);
    try {
      const endDate   = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const response = await fetch(
        buildApiUrl(`daive/test-drive-appointments?start_date=${startDate}&end_date=${endDate}`),
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` } }
      );
      const data = await response.json();
      if (data.success) setTestDriveAppointments(data.data);
      else console.error('Test drive appointments error:', data.error);
    } catch (err) {
      console.error('Error fetching test drive appointments:', err);
    } finally {
      setTestDriveLoading(false);
    }
  };

  // ── Edit appointment ───────────────────────────────────────────────────────
  const [editAppt, setEditAppt] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ scheduled_day: '', scheduled_time: '', status: '', notes: '' });
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (appt: any) => {
    setEditAppt(appt);
    setEditForm({
      scheduled_day:  appt.scheduled_day  || '',
      scheduled_time: appt.scheduled_time || '',
      status:         appt.status         || 'scheduled',
      notes:          appt.notes          || '',
    });
  };

  const saveEdit = async () => {
    if (!editAppt) return;
    setEditSaving(true);
    try {
      const res = await fetch(buildApiUrl(`daive/test-drive-appointments/${editAppt.id}`), {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setTestDriveAppointments(prev =>
          prev.map(a => a.id === editAppt.id ? { ...a, ...data.data } : a)
        );
        toast.success('Appointment updated');
        setEditAppt(null);
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch (err) {
      toast.error('Update failed');
    } finally {
      setEditSaving(false);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  const assignmentForm = useForm<ConversationAssignmentData>({
    resolver: zodResolver(conversationAssignmentSchema),
    defaultValues: {
      staff_id: "",
    },
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  useEffect(() => {
    fetchConversations();
  }, [dateRange, statusFilter, currentPage, pageSize, handoffFilter]);

  useEffect(() => {
    if (canAssignConversations) fetchSalesAgents();
  }, [canAssignConversations]);

  // Fetch test drive appointments when the tab is opened or dateRange changes
  useEffect(() => {
    if (activeTab === 'test_drives') fetchTestDriveAppointments();
  }, [activeTab, dateRange]);

  // Reset to page 1 whenever a filter or page size changes
  useEffect(() => {
    setCurrentPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, statusFilter, handoffFilter, pageSize]);

  const fetchSalesAgents = async () => {
    try {
      const response = await fetch(buildApiUrl('leads/sales-agents'), {
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

  const openAssignmentDialog = (conversation: ConversationData) => {
    setSelectedConversation(conversation as ConversationDetails);
    assignmentForm.reset({
      staff_id: conversation.assigned_to || "",
    });
    setShowAssignmentDialog(true);
  };

  const handleAssign = async (data: ConversationAssignmentData) => {
    if (!selectedConversation) return;

    try {
      const response = await fetch(buildApiUrl(`daive/conversation/${selectedConversation.id}/assign`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        toast.success('Conversation assigned successfully');
        setShowAssignmentDialog(false);
        fetchConversations(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to assign conversation');
      }
    } catch (error) {
      console.error('Error assigning conversation:', error);
      toast.error('Failed to assign conversation');
    }
  };

  const handleUnassign = async (conversationId: string) => {
    try {
      const response = await fetch(buildApiUrl(`daive/conversation/${conversationId}/unassign`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        toast.success('Conversation unassigned successfully');
        fetchConversations(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to unassign conversation');
      }
    } catch (error) {
      console.error('Error unassigning conversation:', error);
      toast.error('Failed to unassign conversation');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log('Fetching analytics with dates:', { startDate, endDate });
      const response = await fetch(buildApiUrl(`daive/analytics?startDate=${startDate}&endDate=${endDate}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      console.log('Analytics response status:', response.status);
      const data = await response.json();
      console.log('Analytics response:', data);
      
      if (data.success) {
        setAnalytics(data.data);
      } else {
        console.error('Analytics API returned error:', data.error);
        toast.error(data.error || 'Failed to load analytics');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    }
  };

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        start_date: startDate,
        end_date: endDate,
      });

      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (handoffFilter !== 'all') params.append('handoff_status', handoffFilter);

      const response = await fetch(buildApiUrl(`daive/conversations?${params}`), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });

      const data = await response.json();
      
      if (data.success) {
        setConversations(data.data.conversations);
        // Backend returns pagination object
        const pg = data.data.pagination;
        if (pg) {
          setTotalConversationCount(pg.total ?? 0);
          setTotalPages(pg.pages ?? Math.ceil((pg.total ?? 0) / pageSize));
        }
      } else {
        console.error('API returned error:', data.error);
        toast.error(data.error || 'Failed to load conversations');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const acceptHandoff = async (conversationId: string) => {
    setActionLoading(conversationId);
    try {
      const response = await fetch(buildApiUrl(`daive/handoff/${conversationId}`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Handoff accepted successfully');
        fetchConversations(); // Refresh the list
      }
    } catch (error) {
      console.error('Error accepting handoff:', error);
      toast.error('Failed to accept handoff');
    } finally {
      setActionLoading(null);
    }
  };

  const viewConversation = async (conversationId: string) => {
    setActionLoading(conversationId);
    setConversationLoading(true);
    try {
      const response = await fetch(buildApiUrl(`daive/conversation/${conversationId}/details`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        console.log('Conversation details:', data.data);
        setSelectedConversation(data.data);
        setShowViewModal(true);
        toast.success(`Viewing conversation: ${data.data.customer_name || 'Anonymous'}`);
      } else {
        toast.error('Failed to load conversation details');
      }
    } catch (error) {
      console.error('Error viewing conversation:', error);
      toast.error('Failed to view conversation');
    } finally {
      setActionLoading(null);
      setConversationLoading(false);
    }
  };

  const updateConversationStatus = async (conversationId: string, newStatus: string) => {
    try {
      const response = await fetch(buildApiUrl(`daive/conversation/${conversationId}/status`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Status updated to: ${newStatus}`);
        fetchConversations(); // Refresh the list
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };



  const requestHandoff = async (conversationId: string) => {
    setActionLoading(conversationId);
    try {
      const reason = prompt('Enter reason for handoff request (optional):');
      
      const response = await fetch(buildApiUrl(`daive/handoff/${conversationId}/request`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason || 'Manual handoff request' })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Handoff requested successfully');
        fetchConversations(); // Refresh the list
      } else {
        toast.error(data.error || 'Failed to request handoff');
      }
    } catch (error) {
      console.error('Error requesting handoff:', error);
      toast.error('Failed to request handoff');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusUpdate = (conversationId: string) => {
    // Show a simple prompt for now - you can implement a proper modal later
    const newStatus = prompt('Enter new status (new, hot, warm, cold):');
    if (newStatus && ['new', 'hot', 'warm', 'cold'].includes(newStatus.toLowerCase())) {
      updateConversationStatus(conversationId, newStatus.toLowerCase());
    } else if (newStatus) {
      toast.error('Invalid status. Please use: new, hot, warm, or cold');
    }
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedConversation(null);
  };

  // Summary stats — use server total for overall count, page data for breakdowns
  const totalConversations = totalConversationCount || conversations.length;
  const totalVoiceSessions = conversations.filter(conv => conv.conversation_type === 'voice').length;
  const totalLeads = conversations.filter(conv => conv.lead_id).length;
  const avgLeadScore = conversations.length > 0 
    ? Math.round(conversations.reduce((sum, conv) => sum + (conv.lead_qualification_score || 0), 0) / conversations.length)
    : 0;
  const handoffRequested = conversations.filter(conv => conv.handoff_requested === true || conv.handoff_requested === 'true').length;
  const handoffAccepted = conversations.filter(conv => conv.handoff_accepted_at).length;
  const handoffRate = conversations.length > 0 ? Math.round((handoffRequested / conversations.length) * 100) : 0;
  
  // Calculate status breakdown
  const statusBreakdown = {
    new: conversations.filter(conv => conv.lead_status === 'new').length,
    hot: conversations.filter(conv => conv.lead_status === 'hot').length,
    warm: conversations.filter(conv => conv.lead_status === 'warm').length,
    cold: conversations.filter(conv => conv.lead_status === 'cold').length
  };

  const getLeadStatusColor = (status: string) => {
    switch (status) {
      case 'hot': return 'bg-red-100 text-red-800';
      case 'warm': return 'bg-yellow-100 text-yellow-800';
      case 'cold': return 'bg-primary/15 text-primary';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getQualificationColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">D.A.I.V.E. Analytics</h1>
          <p className="text-gray-600">AI conversation insights and lead generation metrics</p>
          {!loading && totalConversationCount > 0 && (
            <p className="text-sm text-green-600 mt-1">
              📊 {totalConversationCount} total conversations in selected period
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchConversations();
              fetchAnalytics();
            }}
            disabled={loading}
            className="ml-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            ) : (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Refresh
              </div>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConversations}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Loading...' : `${totalConversations} total conversations`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voice Sessions</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVoiceSessions}</div>
            <p className="text-xs text-muted-foreground">
              {totalConversations > 0 ? Math.round((totalVoiceSessions / totalConversations) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Generated</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              {totalConversations > 0 ? Math.round((totalLeads / totalConversations) * 100) : 0}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Lead Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgLeadScore}%</div>
            <p className="text-xs text-muted-foreground">
              Average qualification score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Handoff Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{handoffRate}%</div>
            <p className="text-xs text-muted-foreground">
              {handoffRequested} requested, {handoffAccepted} accepted
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
                <Badge className="bg-red-100 text-red-800 text-xs">{statusBreakdown.hot}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Warm:</span>
                <Badge className="bg-yellow-100 text-yellow-800 text-xs">{statusBreakdown.warm}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Cold:</span>
                <Badge className="bg-primary/15 text-primary text-xs">{statusBreakdown.cold}</Badge>
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
              {conversations.length > 0 ? (
                <div>
                  <p>Latest: {new Date(conversations[0].created_at).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-500">
                    {conversations.filter(conv => 
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-r from-primary/5 to-muted p-4 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Active Conversations</p>
              <p className="text-2xl font-bold text-primary">{conversations.filter(c => c.lead_status === 'new' || c.lead_status === 'hot').length}</p>
            </div>
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Leads Created</p>
              <p className="text-2xl font-bold text-green-900">{totalLeads}</p>
            </div>
            <Users className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-800">Handoffs Pending</p>
              <p className="text-2xl font-bold text-orange-900">{handoffRequested - handoffAccepted}</p>
            </div>
            <UserCheck className="h-8 w-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-800">Avg Score</p>
              <p className="text-2xl font-bold text-purple-900">{avgLeadScore}%</p>
            </div>
            <Target className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div
          className="bg-gradient-to-r from-teal-50 to-teal-100 p-4 rounded-lg border border-teal-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveTab('test_drives')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-teal-800">Test Drives Scheduled</p>
              <p className="text-2xl font-bold text-teal-900">{testDriveAppointments.length}</p>
              <p className="text-xs text-teal-600 mt-1">Click to view</p>
            </div>
            <CalendarCheck className="h-8 w-8 text-teal-600" />
          </div>
        </div>
      </div>

      {/* Unified Conversations & Handoffs Table */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'conversations' | 'test_drives')}>
        <TabsList className="mb-4">
          <TabsTrigger value="conversations">
            <MessageSquare className="h-4 w-4 mr-2" />
            All Conversations
            {totalConversationCount > 0 && (
              <span className="ml-2 bg-primary/15 text-primary text-xs px-2 py-0.5 rounded-full">
                {totalConversationCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="test_drives">
            <CalendarCheck className="h-4 w-4 mr-2" />
            Scheduled Test Drives
            {testDriveAppointments.length > 0 && (
              <span className="ml-2 bg-teal-100 text-teal-800 text-xs px-2 py-0.5 rounded-full">
                {testDriveAppointments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

       <TabsContent value="conversations">
       <Card>
         <CardHeader>
           <div className="flex items-center justify-between">
             <CardTitle>Conversations & Handoffs</CardTitle>
             <div className="flex items-center gap-2 flex-wrap">
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                 <SelectTrigger className="w-32">
                   <SelectValue placeholder="Filter by status" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Status</SelectItem>
                   <SelectItem value="new">New</SelectItem>
                   <SelectItem value="hot">Hot</SelectItem>
                   <SelectItem value="warm">Warm</SelectItem>
                   <SelectItem value="cold">Cold</SelectItem>
                 </SelectContent>
               </Select>
               <Select value={handoffFilter} onValueChange={setHandoffFilter}>
                 <SelectTrigger className="w-40">
                   <SelectValue placeholder="Filter handoffs" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Handoffs</SelectItem>
                   <SelectItem value="requested">Requested</SelectItem>
                   <SelectItem value="pending">Pending</SelectItem>
                   <SelectItem value="accepted">Accepted</SelectItem>
                 </SelectContent>
               </Select>
               <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                 <SelectTrigger className="w-28">
                   <SelectValue placeholder="Rows" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="10">10 / page</SelectItem>
                   <SelectItem value="25">25 / page</SelectItem>
                   <SelectItem value="50">50 / page</SelectItem>
                   <SelectItem value="100">100 / page</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>
         </CardHeader>
         <CardContent>
           
           {loading ? (
             <div className="flex items-center justify-center py-8">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
             </div>
           ) : conversations.length === 0 ? (
             <div className="text-center py-8 text-gray-500">
               No conversations found
             </div>
          ) : (
            <>
            {/* Pagination info */}
            {totalConversationCount > 0 && (
              <div className="flex items-center justify-between mb-3 text-sm text-gray-600">
                <span>
                  Showing {Math.min((currentPage - 1) * pageSize + 1, totalConversationCount)}–{Math.min(currentPage * pageSize, totalConversationCount)} of <strong>{totalConversationCount}</strong> conversations
                </span>
                <span className="text-xs text-gray-400">Page {currentPage} of {totalPages}</span>
              </div>
            )}

            <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Customer</TableHead>
                   <TableHead>Vehicle</TableHead>
                   <TableHead>Lead Score</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Assigned To</TableHead>
                   <TableHead>Handoff Info</TableHead>
                   <TableHead>Date</TableHead>
                   <TableHead>Actions</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {conversations.map((conversation) => (
                   <TableRow key={conversation.id}>
                     <TableCell>
                       <div>
                         <div className="font-medium">
                           {conversation.customer_name || 'Anonymous'}
                         </div>
                         <div className="text-sm text-gray-500">
                           {conversation.customer_email || 'No email'}
                         </div>
                       </div>
                     </TableCell>
                     <TableCell>
                       <div>
                         {conversation.vehicle_id ? (
                           <>
                             <div className="font-medium">
                               {conversation.year} {conversation.make} {conversation.model}
                             </div>
                             <div className="text-sm text-gray-500">
                               VIN: {conversation.vin}
                             </div>
                           </>
                         ) : (
                           <div className="text-gray-500 italic">
                             No vehicle specified
                           </div>
                         )}
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="flex items-center gap-2">
                         <Progress 
                           value={conversation.lead_qualification_score} 
                           className="w-16" 
                         />
                         <span className={`text-sm font-medium ${getQualificationColor(conversation.lead_qualification_score)}`}>
                           {conversation.lead_qualification_score}%
                         </span>
                       </div>
                     </TableCell>
                     <TableCell>
                       <Badge className={getLeadStatusColor(conversation.lead_status)}>
                         {conversation.lead_status}
                       </Badge>
                     </TableCell>
                     <TableCell>
                       <div className="text-sm">
                         {conversation.assigned_agent_name ? (
                           <div className="text-primary">
                             <div className="font-medium">{conversation.assigned_agent_name}</div>
                             <div className="text-xs text-gray-500">{conversation.assigned_agent_email}</div>
                             {conversation.assigned_at && (
                               <div className="text-xs text-gray-500 mt-1">
                                 Assigned: {new Date(conversation.assigned_at).toLocaleDateString()}
                               </div>
                             )}
                           </div>
                         ) : (
                           <div className="text-gray-500 italic">Unassigned</div>
                         )}
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="text-sm">
                         {conversation.handoff_requested ? (
                           <div className="text-orange-600">
                             <div>🔄 Handoff Requested</div>
                             {conversation.handoff_reason && (
                               <div className="text-xs text-gray-500 mt-1">
                                 Reason: {conversation.handoff_reason}
                               </div>
                             )}
                           </div>
                         ) : conversation.handoff_accepted_at ? (
                           <div className="text-green-600">
                             <div>✅ Handoff Accepted</div>
                             {conversation.handoff_accepted_by && (
                               <div className="text-xs text-gray-500 mt-1">
                                 By: {conversation.handoff_accepted_by}
                               </div>
                             )}
                             {conversation.lead_id && (
                               <div className="mt-2">
                                 <Badge className="bg-primary/15 text-primary text-xs">
                                   🎯 Lead Created
                                 </Badge>
                               </div>
                             )}
                           </div>
                         ) : (
                           <div className="text-gray-500">No handoff</div>
                         )}
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="flex items-center gap-1">
                         <Calendar className="h-3 w-3" />
                         {new Date(conversation.created_at).toLocaleDateString()}
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="flex gap-2">
                         {/* Always show action buttons */}
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => viewConversation(conversation.id)}
                           disabled={actionLoading === conversation.id}
                         >
                           <Eye className="h-4 w-4 mr-1" />
                           {actionLoading === conversation.id ? 'Loading...' : 'View'}
                         </Button>
                         
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => handleStatusUpdate(conversation.id)}
                           disabled={actionLoading === conversation.id}
                         >
                           <Edit3 className="h-4 w-4 mr-1" />
                           {actionLoading === conversation.id ? 'Loading...' : 'Update Status'}
                         </Button>

                         {/* Assignment buttons - only for admins */}
                         {canAssignConversations && (
                           <>
                             {conversation.assigned_to ? (
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => handleUnassign(conversation.id)}
                                 disabled={actionLoading === conversation.id}
                                 className="text-orange-600 hover:bg-orange-50"
                               >
                                 <UserMinus className="h-4 w-4 mr-1" />
                                 {actionLoading === conversation.id ? 'Loading...' : 'Unassign'}
                               </Button>
                             ) : (
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => openAssignmentDialog(conversation)}
                                 disabled={actionLoading === conversation.id}
                                 className="text-primary hover:bg-primary/10"
                               >
                                 <UserPlus className="h-4 w-4 mr-1" />
                                 {actionLoading === conversation.id ? 'Loading...' : 'Assign'}
                               </Button>
                             )}
                           </>
                         )}
                        
                         {/* Show Accept Handoff button if handoff is requested but not yet accepted */}
                         {(conversation.handoff_requested === true || conversation.handoff_requested === 'true') && 
                          !conversation.handoff_accepted_at && (
                           <Button
                             size="sm"
                             variant="destructive"
                             onClick={() => acceptHandoff(conversation.id)}
                             disabled={actionLoading === conversation.id}
                           >
                             <UserCheck className="h-4 w-4 mr-1" />
                             {actionLoading === conversation.id ? 'Loading...' : 'Accept Handoff'}
                           </Button>
                         )}
                         
                         {/* Show Request Handoff button if handoff is NOT requested AND NOT already accepted */}
                         {!(conversation.handoff_requested === true || conversation.handoff_requested === 'true') && 
                          !conversation.handoff_accepted_at && (
                           <Button
                             size="sm"
                             variant="secondary"
                             onClick={() => requestHandoff(conversation.id)}
                             disabled={actionLoading === conversation.id}
                           >
                             <UserCheck className="h-4 w-4 mr-1" />
                             {actionLoading === conversation.id ? 'Loading...' : 'Request Handoff'}
                           </Button>
                         )}
                       </div>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>

            {/* Pagination controls */}
            {totalPages > 1 && (
             <div className="flex items-center justify-between mt-4 pt-4 border-t">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                 disabled={currentPage <= 1}
               >
                 ← Previous
               </Button>
               <div className="flex items-center gap-1">
                 {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                   let page: number;
                   if (totalPages <= 7) {
                     page = i + 1;
                   } else if (currentPage <= 4) {
                     page = i + 1;
                   } else if (currentPage >= totalPages - 3) {
                     page = totalPages - 6 + i;
                   } else {
                     page = currentPage - 3 + i;
                   }
                   return (
                     <Button
                       key={page}
                       variant={currentPage === page ? 'default' : 'outline'}
                       size="sm"
                       className="w-8 h-8 p-0"
                       onClick={() => setCurrentPage(page)}
                     >
                       {page}
                     </Button>
                   );
                 })}
               </div>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                 disabled={currentPage >= totalPages}
               >
                 Next →
               </Button>
             </div>
            )}
            </>
          )}
         </CardContent>
       </Card>
       </TabsContent>

       {/* ── Scheduled Test Drives Tab ─────────────────────────────────────── */}
       <TabsContent value="test_drives">
         <Card>
           <CardHeader>
             <div className="flex items-center justify-between">
               <div>
                 <CardTitle className="flex items-center gap-2">
                   <CalendarCheck className="h-5 w-5 text-teal-600" />
                   Scheduled Test Drives
                 </CardTitle>
                 <p className="text-sm text-gray-500 mt-1">
                   Conversations where a test drive was confirmed by D.A.I.V.E.
                 </p>
               </div>
               <Badge className="bg-teal-100 text-teal-800 text-sm px-3 py-1">
                 {testDriveAppointments.length} scheduled
               </Badge>
             </div>
           </CardHeader>
           <CardContent>
             {testDriveLoading ? (
               <div className="flex items-center justify-center py-8">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
               </div>
             ) : testDriveAppointments.length === 0 ? (
               <div className="text-center py-12 text-gray-500">
                 <CalendarCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                 <p className="font-medium">No scheduled test drives yet</p>
                 <p className="text-sm mt-1">Test drives confirmed in chat will appear here</p>
               </div>
             ) : (
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Customer</TableHead>
                     <TableHead>Vehicle</TableHead>
                     <TableHead>Scheduled Day</TableHead>
                     <TableHead>Scheduled Time</TableHead>
                     <TableHead>Booked On</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Actions</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {testDriveAppointments.map((appt) => (
                     <TableRow key={appt.id}>
                       <TableCell>
                         <div>
                           <div className="font-medium">{appt.customer_name || 'Anonymous'}</div>
                           <div className="text-sm text-gray-500">{appt.customer_email || 'No email'}</div>
                         </div>
                       </TableCell>
                       <TableCell>
                         {appt.vehicle_name ? (
                           <div>
                             <div className="font-medium">{appt.vehicle_name}</div>
                             {appt.vin && <div className="text-xs text-gray-500">{appt.vin}</div>}
                           </div>
                         ) : (
                           <span className="text-gray-400 italic text-sm">No vehicle specified</span>
                         )}
                       </TableCell>
                       <TableCell>
                         {appt.scheduled_day ? (
                           <div className="flex items-center gap-1 text-teal-700 font-medium">
                             <Calendar className="h-3 w-3" />
                             {appt.scheduled_day}
                           </div>
                         ) : appt.scheduled_date ? (
                           <div className="flex items-center gap-1 text-teal-700 font-medium">
                             <Calendar className="h-3 w-3" />
                             {new Date(appt.scheduled_date).toLocaleDateString()}
                           </div>
                         ) : (
                           <span className="text-gray-400 italic text-sm">Not specified</span>
                         )}
                       </TableCell>
                       <TableCell>
                         {appt.scheduled_time ? (
                           <div className="flex items-center gap-1 text-teal-700 font-medium">
                             <Clock className="h-3 w-3" />
                             {appt.scheduled_time}
                           </div>
                         ) : (
                           <span className="text-gray-400 italic text-sm">Not specified</span>
                         )}
                       </TableCell>
                       <TableCell>
                         <div className="flex items-center gap-1 text-sm text-gray-600">
                           <Calendar className="h-3 w-3" />
                           {new Date(appt.created_at).toLocaleDateString()}
                         </div>
                       </TableCell>
                       <TableCell>
                         <Badge className={
                           appt.status === 'completed'
                             ? 'bg-green-100 text-green-800'
                             : appt.status === 'cancelled'
                             ? 'bg-red-100 text-red-800'
                             : 'bg-teal-100 text-teal-800'
                         }>
                           {appt.status === 'completed' ? '✅ Completed' : appt.status === 'cancelled' ? '❌ Cancelled' : '📅 Scheduled'}
                         </Badge>
                       </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(appt)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          {appt.conversation_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewConversation(appt.conversation_id)}
                              disabled={actionLoading === appt.conversation_id}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {actionLoading === appt.conversation_id ? 'Loading...' : 'View'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             )}
           </CardContent>
         </Card>

         {/* ── Edit Appointment Dialog ──────────────────────────────────── */}
         <Dialog open={!!editAppt} onOpenChange={(open) => !open && setEditAppt(null)}>
           <DialogContent className="max-w-md">
             <DialogHeader>
               <DialogTitle className="flex items-center gap-2">
                 <Pencil className="h-4 w-4" />
                 Edit Test Drive Appointment
               </DialogTitle>
             </DialogHeader>
             {editAppt && (
               <div className="space-y-4 pt-2">
                 <div className="bg-gray-50 rounded-lg p-3 text-sm">
                   <div className="font-medium">{editAppt.customer_name || 'Anonymous'}</div>
                   {editAppt.vehicle_name && (
                     <div className="text-gray-500 text-xs mt-0.5">{editAppt.vehicle_name}</div>
                   )}
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                     <label className="text-sm font-medium text-gray-700">Scheduled Day</label>
                     <Input
                       placeholder="e.g. Monday, Today"
                       value={editForm.scheduled_day}
                       onChange={e => setEditForm(f => ({ ...f, scheduled_day: e.target.value }))}
                     />
                   </div>
                   <div className="space-y-1">
                     <label className="text-sm font-medium text-gray-700">Scheduled Time</label>
                     <Input
                       placeholder="e.g. 3pm, 15:00"
                       value={editForm.scheduled_time}
                       onChange={e => setEditForm(f => ({ ...f, scheduled_time: e.target.value }))}
                     />
                   </div>
                 </div>

                 <div className="space-y-1">
                   <label className="text-sm font-medium text-gray-700">Status</label>
                   <Select
                     value={editForm.status}
                     onValueChange={v => setEditForm(f => ({ ...f, status: v }))}
                   >
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="scheduled">📅 Scheduled</SelectItem>
                       <SelectItem value="completed">✅ Completed</SelectItem>
                       <SelectItem value="cancelled">❌ Cancelled</SelectItem>
                       <SelectItem value="no_show">🚫 No Show</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>

                 <div className="space-y-1">
                   <label className="text-sm font-medium text-gray-700">Notes</label>
                   <Input
                     placeholder="Optional notes..."
                     value={editForm.notes}
                     onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                   />
                 </div>

                 <div className="flex justify-end gap-2 pt-2">
                   <Button variant="outline" onClick={() => setEditAppt(null)} disabled={editSaving}>
                     Cancel
                   </Button>
                   <Button onClick={saveEdit} disabled={editSaving} className="bg-teal-600 hover:bg-teal-700 text-white">
                     {editSaving ? 'Saving...' : 'Save Changes'}
                   </Button>
                 </div>
               </div>
             )}
           </DialogContent>
         </Dialog>
       </TabsContent>

      </Tabs>

      {/* Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-2" />
              <p>Chart visualization coming soon</p>
              <p className="text-sm">Will show conversation volume over time</p>
            </div>
          </div>
                 </CardContent>
       </Card>

       {/* Conversation Details Modal */}
       {showViewModal && selectedConversation && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                           {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Conversation Details
                  </h2>
                  <div className="space-y-1 mt-2">
                    <p className="text-gray-600">
                      <span className="font-medium">Customer:</span> {selectedConversation.customer_name || 'Anonymous'}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Session ID:</span> {selectedConversation.session_id}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Conversation ID:</span> {selectedConversation.id}
                    </p>
                    {selectedConversation.vehicle_id && (
                      <p className="text-gray-600">
                        <span className="font-medium">Vehicle:</span> {selectedConversation.year} {selectedConversation.make} {selectedConversation.model}
                      </p>
                    )}
                  </div>
                </div>
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={closeViewModal}
                 className="h-8 w-8 p-0"
               >
                 <X className="h-4 w-4" />
               </Button>
             </div>

             {/* Modal Content */}
             <div className="p-6 space-y-6">
               {/* Customer Information */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card>
                   <CardHeader className="pb-3">
                     <CardTitle className="text-lg flex items-center gap-2">
                       <User className="h-5 w-5 text-primary" />
                       Customer Information
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-3">
                     <div className="flex justify-between">
                       <span className="font-medium">Name:</span>
                       <span>{selectedConversation.customer_name || 'Anonymous'}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="font-medium">Email:</span>
                       <span>{selectedConversation.customer_email || 'No email'}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="font-medium">Phone:</span>
                       <span>{selectedConversation.customer_phone || 'No phone'}</span>
                     </div>
                     {selectedConversation.conversation_type && (
                       <div className="flex justify-between">
                         <span className="font-medium">Type:</span>
                         <Badge className="bg-primary/15 text-primary text-xs">
                           {selectedConversation.conversation_type}
                         </Badge>
                       </div>
                     )}
                   </CardContent>
                 </Card>

                 {/* Vehicle Information */}
                 <Card>
                   <CardHeader className="pb-3">
                     <CardTitle className="text-lg flex items-center gap-2">
                       <Car className="h-5 w-5 text-green-600" />
                       Vehicle Information
                     </CardTitle>
                   </CardHeader>
                                        <CardContent className="space-y-3">
                       {selectedConversation.vehicle_id ? (
                         <>
                           <div className="flex justify-between">
                             <span className="font-medium">Vehicle:</span>
                             <span>{selectedConversation.year} {selectedConversation.make} {selectedConversation.model}</span>
                           </div>
                           <div className="flex justify-between">
                             <span className="font-medium">VIN:</span>
                             <span className="font-mono text-sm">{selectedConversation.vin}</span>
                           </div>
                           {selectedConversation.price && (
                             <div className="flex justify-between">
                               <span className="font-medium">Price:</span>
                               <span className="font-mono text-sm">${selectedConversation.price.toLocaleString()}</span>
                             </div>
                           )}
                           {selectedConversation.features && (
                             <div className="flex justify-between">
                               <span className="font-medium">Features:</span>
                               <span className="text-sm text-gray-600">
                                 {Array.isArray(selectedConversation.features) 
                                   ? selectedConversation.features.join(', ') 
                                   : 'Available'}
                               </span>
                             </div>
                           )}
                         </>
                       ) : (
                         <div className="text-gray-500 italic">No vehicle specified</div>
                       )}
                     </CardContent>
                 </Card>
               </div>

               {/* Lead & Handoff Information */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card>
                   <CardHeader className="pb-3">
                     <CardTitle className="text-lg flex items-center gap-2">
                       <Target className="h-5 w-5 text-purple-600" />
                       Lead Information
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-3">
                     <div className="flex justify-between">
                       <span className="font-medium">Status:</span>
                       <Badge className={getLeadStatusColor(selectedConversation.lead_status)}>
                         {selectedConversation.lead_status}
                       </Badge>
                     </div>
                     <div className="flex justify-between">
                       <span className="font-medium">Qualification Score:</span>
                       <div className="flex items-center gap-2">
                         <Progress 
                           value={selectedConversation.lead_qualification_score} 
                           className="w-20" 
                         />
                         <span className={`text-sm font-medium ${getQualificationColor(selectedConversation.lead_qualification_score)}`}>
                           {selectedConversation.lead_qualification_score}%
                         </span>
                       </div>
                     </div>
                     {selectedConversation.lead_id && (
                       <div className="flex justify-between">
                         <span className="font-medium">Lead ID:</span>
                         <span className="font-mono text-sm">{selectedConversation.lead_id}</span>
                       </div>
                     )}
                   </CardContent>
                 </Card>

                 <Card>
                   <CardHeader className="pb-3">
                     <CardTitle className="text-lg flex items-center gap-2">
                       <UserCheck className="h-5 w-5 text-orange-600" />
                       Handoff Information
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-3">
                     <div className="flex justify-between">
                       <span className="font-medium">Status:</span>
                       {selectedConversation.handoff_requested ? (
                         <Badge className="bg-orange-100 text-orange-800">
                           🔄 Requested
                         </Badge>
                       ) : selectedConversation.handoff_accepted_at ? (
                         <Badge className="bg-green-100 text-green-800">
                           ✅ Accepted
                         </Badge>
                       ) : (
                         <Badge className="bg-gray-100 text-gray-800">
                           No Handoff
                         </Badge>
                       )}
                     </div>
                     {selectedConversation.handoff_reason && (
                       <div className="flex justify-between">
                         <span className="font-medium">Reason:</span>
                         <span className="text-sm">{selectedConversation.handoff_reason}</span>
                       </div>
                     )}
                     {selectedConversation.handoff_accepted_at && (
                       <div className="flex justify-between">
                         <span className="font-medium">Accepted At:</span>
                         <span className="text-sm">
                           {new Date(selectedConversation.handoff_accepted_at).toLocaleString()}
                         </span>
                       </div>
                     )}
                     {selectedConversation.handoff_accepted_by && (
                       <div className="flex justify-between">
                         <span className="font-medium">Accepted By:</span>
                         <span className="text-sm">{selectedConversation.handoff_accepted_by}</span>
                       </div>
                     )}
                   </CardContent>
                 </Card>
               </div>

               {/* Conversation Messages - Full Chat History */}
               {selectedConversation.messages && selectedConversation.messages.length > 0 && (
                 <Card>
                   <CardHeader className="pb-3">
                     <CardTitle className="text-lg flex items-center gap-2">
                       <MessageCircle className="h-5 w-5 text-primary" />
                       Full Conversation History ({selectedConversation.messages.length} messages)
                     </CardTitle>
                     <p className="text-sm text-gray-600">
                       Complete chat between customer and D.A.I.V.E. AI assistant
                     </p>
                   </CardHeader>
                   <CardContent>
                     <div className="space-y-4 max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                       {selectedConversation.messages.map((message, index) => (
                         <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[80%] p-4 rounded-2xl ${
                             message.role === 'user' 
                               ? 'bg-primary text-white' 
                               : 'bg-white text-gray-800 border border-gray-200'
                           }`}>
                             <div className="flex items-center gap-2 mb-2">
                               <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                 message.role === 'user' 
                                   ? 'bg-primary/70 text-white' 
                                   : 'bg-gray-200 text-gray-700'
                               }`}>
                                 {message.role === 'user' ? '👤 Customer' : '🤖 D.A.I.V.E.'}
                               </span>
                               <span className={`text-xs ${
                                 message.role === 'user' ? 'text-primary-foreground' : 'text-gray-500'
                               }`}>
                                 {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : `Message ${index + 1}`}
                               </span>
                             </div>
                             <div className={`text-sm leading-relaxed ${
                               message.role === 'user' ? 'text-white' : 'text-gray-700'
                             }`}>
                               {message.content || message.text || 'No content available'}
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                     
                     {/* Conversation Summary */}
                     <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                       <div className="flex items-center gap-2 mb-2">
                         <span className="text-primary">📊</span>
                         <span className="text-sm font-medium text-primary">Conversation Summary</span>
                       </div>
                       <div className="text-sm text-primary/90">
                         <p>• Customer messages: {selectedConversation.messages.filter(m => m.role === 'user').length}</p>
                         <p>• D.A.I.V.E. responses: {selectedConversation.messages.filter(m => m.role === 'assistant').length}</p>
                         <p>• Total conversation length: {selectedConversation.messages.reduce((total, m) => total + (m.content?.length || 0), 0)} characters</p>
                       </div>
                     </div>
                   </CardContent>
                 </Card>
               )}

               {/* AI Context & Technical Details */}
               {selectedConversation.ai_context && (
                 <Card>
                   <CardHeader className="pb-3">
                     <CardTitle className="text-lg flex items-center gap-2">
                       <Target className="h-5 w-5 text-purple-600" />
                       AI Context & Technical Details
                     </CardTitle>
                     <p className="text-sm text-gray-600">
                       D.A.I.V.E.'s understanding and conversation context
                     </p>
                   </CardHeader>
                   <CardContent>
                     <div className="space-y-3">
                       {/* Show key context information in a readable format */}
                       {selectedConversation.ai_context.vehicle_info && (
                         <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                           <h4 className="font-medium text-purple-800 mb-2">🚗 Vehicle Context</h4>
                           <pre className="text-xs text-purple-700 bg-white p-2 rounded">
                             {JSON.stringify(selectedConversation.ai_context.vehicle_info, null, 2)}
                           </pre>
                         </div>
                       )}
                       
                       {selectedConversation.ai_context.customer_intent && (
                         <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                           <h4 className="font-medium text-green-800 mb-2">🎯 Customer Intent</h4>
                           <p className="text-sm text-green-700">{selectedConversation.ai_context.customer_intent}</p>
                         </div>
                       )}
                       
                       {selectedConversation.ai_context.conversation_summary && (
                         <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                           <h4 className="font-medium text-primary mb-2">📝 AI Summary</h4>
                           <p className="text-sm text-primary/90">{selectedConversation.ai_context.conversation_summary}</p>
                         </div>
                       )}
                       
                       {/* Raw context for developers */}
                       <details className="mt-4">
                         <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                           🔧 Show Raw Technical Data
                         </summary>
                         <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto mt-2">
                           {JSON.stringify(selectedConversation.ai_context, null, 2)}
                         </pre>
                       </details>
                     </div>
                   </CardContent>
                 </Card>
               )}

               {/* Timestamps */}
               <Card>
                 <CardHeader className="pb-3">
                   <CardTitle className="text-lg flex items-center gap-2">
                     <Clock3 className="h-5 w-5 text-gray-600" />
                     Timestamps
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-3">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="flex justify-between">
                       <span className="font-medium">Created:</span>
                       <span className="text-sm">
                         {new Date(selectedConversation.created_at).toLocaleString()}
                       </span>
                     </div>
                     <div className="flex justify-between">
                       <span className="font-medium">Updated:</span>
                       <span className="text-sm">
                         {new Date(selectedConversation.updated_at).toLocaleString()}
                       </span>
                     </div>
                     {selectedConversation.handoff_requested_at && (
                       <div className="flex justify-between">
                         <span className="font-medium">Handoff Requested:</span>
                         <span className="text-sm">
                           {new Date(selectedConversation.handoff_requested_at).toLocaleString()}
                         </span>
                       </div>
                     )}
                   </div>
                 </CardContent>
               </Card>
             </div>

             {/* Modal Footer */}
             <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
               <Button variant="outline" onClick={closeViewModal}>
                 Close
               </Button>
               <Button 
                 variant="outline" 
                 onClick={() => handleStatusUpdate(selectedConversation.id)}
               >
                 <Edit3 className="h-4 w-4 mr-2" />
                 Update Status
               </Button>
               {!(selectedConversation.handoff_requested === true || selectedConversation.handoff_requested === 'true') && 
                !selectedConversation.handoff_accepted_at && (
                 <Button 
                   variant="secondary" 
                   onClick={() => {
                     closeViewModal();
                     requestHandoff(selectedConversation.id);
                   }}
                 >
                   <UserCheck className="h-4 w-4 mr-2" />
                   Request Handoff
                 </Button>
               )}
               {(selectedConversation.handoff_requested === true || selectedConversation.handoff_requested === 'true') && 
                !selectedConversation.handoff_accepted_at && (
                 <Button 
                   variant="destructive" 
                   onClick={() => {
                     closeViewModal();
                     acceptHandoff(selectedConversation.id);
                   }}
                 >
                   <UserCheck className="h-4 w-4 mr-2" />
                   Accept Handoff
                 </Button>
               )}
             </div>
           </div>
         </div>
       )}

       {/* Assignment Dialog - only for admins */}
       {canAssignConversations && (
         <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Assign Conversation</DialogTitle>
           </DialogHeader>
           {selectedConversation && (
             <Form {...assignmentForm}>
               <form onSubmit={assignmentForm.handleSubmit(handleAssign)} className="space-y-4">
                 <div className="bg-muted p-3 rounded-lg">
                   <h4 className="font-medium">{selectedConversation.customer_name || 'Anonymous'}</h4>
                   <p className="text-sm text-muted-foreground">{selectedConversation.customer_email || 'No email'}</p>
                   {selectedConversation.vehicle_id && (
                     <p className="text-sm">
                       Vehicle: {selectedConversation.year} {selectedConversation.make} {selectedConversation.model}
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
                   <Button type="submit">Assign Conversation</Button>
                   <Button type="button" variant="outline" onClick={() => setShowAssignmentDialog(false)}>
                     Cancel
                   </Button>
                 </div>
               </form>
             </Form>
           )}
         </DialogContent>
       </Dialog>
       )}
     </div>
   );
 };

export default DAIVEAnalytics; 
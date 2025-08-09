import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Progress } from '../ui/progress';
import { 
  BarChart3, 
  MessageSquare, 
  Users, 
  TrendingUp, 
  Clock, 
  Phone,
  Calendar,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsData {
  date: string;
  total_conversations: number;
  total_voice_sessions: number;
  total_leads_generated: number;
  average_conversation_duration: number;
  handoff_rate: number;
}

interface ConversationData {
  id: string;
  session_id: string;
  customer_name: string;
  customer_email: string;
  lead_qualification_score: number;
  lead_status: string;
  handoff_requested: boolean;
  created_at: string;
  make: string;
  model: string;
  year: number;
  vin: string;
}

const DAIVEAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchAnalytics();
    fetchConversations();
  }, [dateRange, statusFilter, currentPage]);

  const fetchAnalytics = async () => {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await fetch(`http://localhost:3000/api/daive/analytics?startDate=${startDate}&endDate=${endDate}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    }
  };

  const fetchConversations = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`http://localhost:3000/api/daive/conversations?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setConversations(data.data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const acceptHandoff = async (conversationId: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/daive/handoff/${conversationId}`, {
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
    }
  };

  // Calculate summary statistics
  const totalConversations = analytics.reduce((sum, day) => sum + day.total_conversations, 0);
  const totalVoiceSessions = analytics.reduce((sum, day) => sum + day.total_voice_sessions, 0);
  const totalLeads = analytics.reduce((sum, day) => sum + day.total_leads_generated, 0);
  const avgHandoffRate = analytics.length > 0 
    ? analytics.reduce((sum, day) => sum + day.handoff_rate, 0) / analytics.length 
    : 0;

  const getLeadStatusColor = (status: string) => {
    switch (status) {
      case 'hot': return 'bg-red-100 text-red-800';
      case 'warm': return 'bg-yellow-100 text-yellow-800';
      case 'cold': return 'bg-blue-100 text-blue-800';
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
              +{analytics.length > 0 ? analytics[analytics.length - 1].total_conversations : 0} today
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
            <CardTitle className="text-sm font-medium">Handoff Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgHandoffRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Average across period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conversations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Conversations</CardTitle>
            <div className="flex items-center gap-2">
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Lead Score</TableHead>
                  <TableHead>Status</TableHead>
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
                        <div className="font-medium">
                          {conversation.year} {conversation.make} {conversation.model}
                        </div>
                        <div className="text-sm text-gray-500">
                          VIN: {conversation.vin}
                        </div>
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
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(conversation.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {conversation.handoff_requested && (
                        <Button
                          size="sm"
                          onClick={() => acceptHandoff(conversation.id)}
                        >
                          Accept Handoff
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
};

export default DAIVEAnalytics; 
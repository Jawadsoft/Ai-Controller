import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { API_BASE_URL } from '@/lib/config';
import { 
  Bot, 
  Users, 
  BarChart3, 
  Clock, 
  Settings, 
  UserPlus, 
  UserMinus,
  Activity,
  Calendar,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface AgentAssignment {
  id: string;
  agent_type: string;
  agent_name: string;
  staff_id?: string;
  staff_name?: string;
  staff_email?: string;
  staff_role?: string;
  current_conversations: number;
  max_concurrent_conversations: number;
  performance_score: number;
  is_active: boolean;
  is_available: boolean;
  auto_assignment: boolean;
  agent_priority: number;
}

interface StaffMember {
  id: string;
  staff_role: string;
  name: string;
  email: string;
  is_active: boolean;
  current_assignments: number;
}

interface PerformanceData {
  assignment_id: string;
  agent_type: string;
  agent_name: string;
  staff_name: string;
  total_conversations: number;
  avg_satisfaction: number;
  avg_response_time: number;
  success_rate: number;
  handoff_rate: number;
}

const CrewAIAgentManagement = () => {
  const { user } = useAuth();
  const { canAccessFeature } = usePermissions();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [performance, setPerformance] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchAssignments(),
        fetchStaff(),
        fetchPerformance()
      ]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    const response = await fetch(`${API_BASE_URL}/crewai-agents/assignments`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      setAssignments(data.assignments);
    }
  };

  const fetchStaff = async () => {
    const response = await fetch(`${API_BASE_URL}/crewai-agents/staff-available`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      setStaff(data.staff);
    }
  };

  const fetchPerformance = async () => {
    const response = await fetch(`${API_BASE_URL}/crewai-agents/performance`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      setPerformance(data.performance);
    }
  };

  const handleAssignAgent = async () => {
    if (!selectedAgent || !selectedStaff) {
      toast({
        title: "Error",
        description: "Please select both agent and staff member",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/crewai-agents/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          agent_type: selectedAgent,
          staff_id: selectedStaff
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Agent assigned successfully"
        });
        setShowAssignDialog(false);
        setSelectedAgent('');
        setSelectedStaff('');
        fetchAssignments();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to assign agent",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign agent",
        variant: "destructive"
      });
    }
  };

  const handleUnassignAgent = async (agentType: string) => {
    if (!confirm('Are you sure you want to unassign this agent?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/crewai-agents/unassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ agent_type: agentType })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Agent unassigned successfully"
        });
        fetchAssignments();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to unassign agent",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unassign agent",
        variant: "destructive"
      });
    }
  };

  const handleUpdateAssignment = async (assignmentId: string, updates: Partial<AgentAssignment>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/crewai-agents/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Agent assignment updated successfully"
        });
        fetchAssignments();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update assignment",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update assignment",
        variant: "destructive"
      });
    }
  };

  const getAgentIcon = (agentType: string) => {
    const icons = {
      'sales_consultant': Users,
      'product_specialist': Bot,
      'finance_manager': BarChart3,
      'service_advisor': Settings,
      'inventory_specialist': Activity
    };
    return icons[agentType as keyof typeof icons] || Bot;
  };

  const getAgentBadgeColor = (agentType: string) => {
    const colors: Record<string, string> = {
      'sales_consultant': 'bg-primary/15 text-primary dark:bg-primary/20 dark:text-muted-foreground',
      'product_specialist': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'finance_manager': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'service_advisor': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'inventory_specialist': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
    };
    return colors[agentType] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const getAgentDisplayName = (agentType: string) => {
    const names: Record<string, string> = {
      'sales_consultant': 'Sales Consultant',
      'product_specialist': 'Product Specialist',
      'finance_manager': 'Finance Manager',
      'service_advisor': 'Service Advisor',
      'inventory_specialist': 'Inventory Specialist'
    };
    return names[agentType] || agentType;
  };

  const getStatusColor = (assignment: AgentAssignment) => {
    if (!assignment.is_active) return 'text-red-600';
    if (assignment.is_available) return 'text-green-600';
    if (assignment.current_conversations >= assignment.max_concurrent_conversations) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getStatusText = (assignment: AgentAssignment) => {
    if (!assignment.is_active) return 'Inactive';
    if (assignment.is_available) return 'Available';
    if (assignment.current_conversations >= assignment.max_concurrent_conversations) return 'Busy';
    return 'Offline';
  };

  if (!canAccessFeature('staff_management')) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>You don't have permission to access CrewAI agent management.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">CrewAI Agent Management</h1>
          <p className="text-muted-foreground">Manage your AI agent assignments to staff members</p>
        </div>
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Assign Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Agent to Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="agent">Agent Type</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_consultant">Sales Consultant</SelectItem>
                    <SelectItem value="product_specialist">Product Specialist</SelectItem>
                    <SelectItem value="finance_manager">Finance Manager</SelectItem>
                    <SelectItem value="service_advisor">Service Advisor</SelectItem>
                    <SelectItem value="inventory_specialist">Inventory Specialist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="staff">Staff Member</Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.staff_role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAssignAgent}>Assign Agent</Button>
                <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignments">Agent Assignments</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Agent Assignments ({assignments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No agent assignments yet</h3>
                  <p className="text-muted-foreground mb-4">Assign your first AI agent to a staff member</p>
                  <Button onClick={() => setShowAssignDialog(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign Agent
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Conversations</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => {
                      const AgentIcon = getAgentIcon(assignment.agent_type);
                      return (
                        <TableRow key={assignment.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <AgentIcon className="h-4 w-4" />
                              <div>
                                <div className="font-medium">{assignment.agent_name}</div>
                                <Badge className={getAgentBadgeColor(assignment.agent_type)}>
                                  {getAgentDisplayName(assignment.agent_type)}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {assignment.staff_name ? (
                              <div>
                                <div className="font-medium">{assignment.staff_name}</div>
                                <div className="text-sm text-muted-foreground">{assignment.staff_email}</div>
                                <Badge variant="outline">{assignment.staff_role}</Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                !assignment.is_active ? 'bg-red-500' :
                                assignment.is_available ? 'bg-green-500' :
                                'bg-yellow-500'
                              }`} />
                              <span className={getStatusColor(assignment)}>
                                {getStatusText(assignment)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {assignment.current_conversations} / {assignment.max_concurrent_conversations}
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full" 
                                style={{ 
                                  width: `${(assignment.current_conversations / assignment.max_concurrent_conversations) * 100}%` 
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4" />
                              <span className="font-medium">
                                {(assignment.performance_score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Switch
                                checked={assignment.is_active}
                                onCheckedChange={(checked) => 
                                  handleUpdateAssignment(assignment.id, { is_active: checked })
                                }
                              />
                              {assignment.staff_id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnassignAgent(assignment.agent_type)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Agent Performance (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {performance.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No performance data yet</h3>
                  <p className="text-muted-foreground">Performance metrics will appear after agents handle conversations</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Conversations</TableHead>
                      <TableHead>Avg Satisfaction</TableHead>
                      <TableHead>Avg Response Time</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Handoff Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performance.map((perf) => (
                      <TableRow key={perf.assignment_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{perf.agent_name}</div>
                              <Badge className={getAgentBadgeColor(perf.agent_type)}>
                                {getAgentDisplayName(perf.agent_type)}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{perf.staff_name || 'Unassigned'}</TableCell>
                        <TableCell>{perf.total_conversations}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{perf.avg_satisfaction?.toFixed(1) || 'N/A'}</span>
                            <span className="text-muted-foreground">/5</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{perf.avg_response_time?.toFixed(0) || 'N/A'}ms</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            <span className="font-medium">{perf.success_rate?.toFixed(1) || 'N/A'}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{perf.handoff_rate?.toFixed(1) || 'N/A'}%</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CrewAIAgentManagement;

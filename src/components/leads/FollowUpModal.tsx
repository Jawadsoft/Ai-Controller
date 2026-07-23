import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Phone, Mail, MessageSquare, MapPin, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { leadsAPI } from '@/lib/api';

interface FollowUp {
  id: string;
  lead_id: string;
  scheduled_date: string;
  follow_up_type: string;
  status: string;
  notes: string;
  outcome: string;
  created_by: string;
  completed_by: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  completed_by_name?: string;
}

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  onFollowUpAdded?: () => void;
}

const FOLLOW_UP_TYPES = [
  { value: 'call', label: 'Phone Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'text', label: 'Text Message', icon: MessageSquare },
  { value: 'visit', label: 'In-Person Visit', icon: MapPin },
  { value: 'other', label: 'Other', icon: Clock },
];

const FOLLOW_UP_STATUSES = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-primary/15 text-primary' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
  { value: 'missed', label: 'Missed', color: 'bg-red-100 text-red-800' },
];

const OUTCOME_OPTIONS = [
  'Interested - Ready to buy',
  'Interested - Needs more time',
  'Interested - Price negotiation',
  'Not interested',
  'Callback requested',
  'No answer',
  'Left voicemail',
  'Email sent',
  'Meeting scheduled',
  'Other'
];

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  isOpen,
  onClose,
  leadId,
  leadName,
  onFollowUpAdded
}) => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [formData, setFormData] = useState({
    scheduled_date: new Date(),
    follow_up_type: 'call',
    notes: '',
    status: 'scheduled',
    outcome: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchFollowUps();
    }
  }, [isOpen, leadId]);

  const fetchFollowUps = async () => {
    try {
      setLoading(true);
      const data = await leadsAPI.getFollowUps(leadId);
      setFollowUps(data.followUps || []);
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const userId = localStorage.getItem('user_id');
      
      const payload = {
        ...formData,
        scheduled_date: formData.scheduled_date.toISOString(),
        created_by: userId
      };

      let result;
      if (editingFollowUp) {
        // Update existing follow-up
        result = await leadsAPI.updateFollowUp(editingFollowUp.id, payload);
      } else {
        // Create new follow-up
        result = await leadsAPI.createFollowUp(leadId, payload);
      }

      toast({
        title: editingFollowUp ? "Follow-up Updated" : "Follow-up Scheduled",
        description: `Follow-up has been ${editingFollowUp ? 'updated' : 'scheduled'} successfully`,
      });
      
      setShowAddForm(false);
      setEditingFollowUp(null);
      resetForm();
      fetchFollowUps();
      onFollowUpAdded?.();
    } catch (error: any) {
      console.error('Error saving follow-up:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save follow-up",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (followUpId: string) => {
    if (!confirm('Are you sure you want to delete this follow-up?')) return;

    try {
      await leadsAPI.deleteFollowUp(followUpId);
      toast({
        title: "Follow-up Deleted",
        description: "Follow-up has been deleted successfully",
      });
      fetchFollowUps();
    } catch (error: any) {
      console.error('Error deleting follow-up:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete follow-up",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (followUp: FollowUp) => {
    setEditingFollowUp(followUp);
    setFormData({
      scheduled_date: new Date(followUp.scheduled_date),
      follow_up_type: followUp.follow_up_type,
      notes: followUp.notes || '',
      status: followUp.status,
      outcome: followUp.outcome || ''
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      scheduled_date: new Date(),
      follow_up_type: 'call',
      notes: '',
      status: 'scheduled',
      outcome: ''
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = FOLLOW_UP_STATUSES.find(s => s.value === status);
    return (
      <Badge className={statusConfig?.color || 'bg-gray-100 text-gray-800'}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = FOLLOW_UP_TYPES.find(t => t.value === type);
    const IconComponent = typeConfig?.icon || Clock;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Follow-ups for {leadName}</DialogTitle>
          <DialogDescription>
            Schedule and manage follow-up activities for this lead
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Follow-up Button */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Follow-up Activities</h3>
            <Button
              onClick={() => {
                setEditingFollowUp(null);
                resetForm();
                setShowAddForm(true);
              }}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Follow-up</span>
            </Button>
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingFollowUp ? 'Edit Follow-up' : 'Schedule New Follow-up'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Scheduled Date */}
                    <div className="space-y-2">
                      <Label htmlFor="scheduled_date">Scheduled Date & Time</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.scheduled_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.scheduled_date ? (
                              format(formData.scheduled_date, "PPP 'at' p")
                            ) : (
                              <span>Pick a date and time</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.scheduled_date}
                            onSelect={(date) => date && setFormData(prev => ({ ...prev, scheduled_date: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Follow-up Type */}
                    <div className="space-y-2">
                      <Label htmlFor="follow_up_type">Follow-up Type</Label>
                      <Select
                        value={formData.follow_up_type}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, follow_up_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FOLLOW_UP_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center space-x-2">
                                <type.icon className="h-4 w-4" />
                                <span>{type.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Status */}
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FOLLOW_UP_STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Outcome */}
                    {formData.status === 'completed' && (
                      <div className="space-y-2">
                        <Label htmlFor="outcome">Outcome</Label>
                        <Select
                          value={formData.outcome}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, outcome: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select outcome" />
                          </SelectTrigger>
                          <SelectContent>
                            {OUTCOME_OPTIONS.map((outcome) => (
                              <SelectItem key={outcome} value={outcome}>
                                {outcome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Add any notes about this follow-up..."
                      rows={3}
                    />
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingFollowUp(null);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingFollowUp ? 'Update Follow-up' : 'Schedule Follow-up'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Follow-ups List */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading follow-ups...</p>
            </div>
          ) : followUps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No follow-ups scheduled</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Schedule your first follow-up to stay on top of this lead.
                </p>
                <Button
                  onClick={() => {
                    setEditingFollowUp(null);
                    resetForm();
                    setShowAddForm(true);
                  }}
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Schedule Follow-up</span>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {followUps.map((followUp) => (
                <Card key={followUp.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getTypeIcon(followUp.follow_up_type)}
                          <h4 className="font-medium">
                            {FOLLOW_UP_TYPES.find(t => t.value === followUp.follow_up_type)?.label}
                          </h4>
                          {getStatusBadge(followUp.status)}
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            <strong>Scheduled:</strong> {format(new Date(followUp.scheduled_date), "PPP 'at' p")}
                          </p>
                          {followUp.completed_at && (
                            <p>
                              <strong>Completed:</strong> {format(new Date(followUp.completed_at), "PPP 'at' p")}
                            </p>
                          )}
                          {followUp.outcome && (
                            <p>
                              <strong>Outcome:</strong> {followUp.outcome}
                            </p>
                          )}
                          {followUp.notes && (
                            <p>
                              <strong>Notes:</strong> {followUp.notes}
                            </p>
                          )}
                          <p>
                            <strong>Created by:</strong> {followUp.created_by_name || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(followUp)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(followUp.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

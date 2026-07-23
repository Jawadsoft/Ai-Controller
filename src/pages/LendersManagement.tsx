/**
 * Lenders Management Page
 * Manage lender relationships and submissions
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { lendersAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Plus, Eye, Edit, Trash2, Star } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import TopNavigation from '@/components/layout/TopNavigation';

interface Lender {
  id: string;
  lender_name: string;
  lender_type: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  min_credit_score?: number;
  is_active: boolean;
  is_preferred: boolean;
  scope: 'global' | 'dealer';
  created_at: string;
}

const LendersManagement = () => {
  const { user, loading: authLoading } = useAuth();
  const { canAccessFeature } = usePermissions();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [filteredLenders, setFilteredLenders] = useState<Lender[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedLender, setSelectedLender] = useState<Lender | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  
  // Form state
  const [formData, setFormData] = useState({
    lender_name: '',
    lender_type: 'Bank',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    address: '',
    min_credit_score: '',
    max_ltv: '',
    notes: '',
    is_preferred: false
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadLenders();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [lenders, typeFilter, activeFilter]);

  const loadLenders = async () => {
    try {
      setLoading(true);
      const response = await lendersAPI.getAll();
      setLenders(response.data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load lenders',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...lenders];
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(l => l.lender_type === typeFilter);
    }
    
    if (activeFilter === 'active') {
      filtered = filtered.filter(l => l.is_active);
    } else if (activeFilter === 'inactive') {
      filtered = filtered.filter(l => !l.is_active);
    }
    
    setFilteredLenders(filtered);
  };

  const resetForm = () => {
    setFormData({
      lender_name: '',
      lender_type: 'Bank',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      website: '',
      address: '',
      min_credit_score: '',
      max_ltv: '',
      notes: '',
      is_preferred: false
    });
  };

  const handleCreate = async () => {
    if (!formData.lender_name) {
      toast({
        title: 'Error',
        description: 'Lender name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await lendersAPI.create(formData);
      
      toast({
        title: 'Success',
        description: 'Lender created successfully',
      });
      
      setShowCreateDialog(false);
      resetForm();
      loadLenders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create lender',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedLender || !formData.lender_name) {
      return;
    }

    try {
      setSaving(true);
      await lendersAPI.update(selectedLender.id, formData);
      
      toast({
        title: 'Success',
        description: 'Lender updated successfully',
      });
      
      setShowEditDialog(false);
      setSelectedLender(null);
      resetForm();
      loadLenders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update lender',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lenderId: string) => {
    if (!confirm('Are you sure you want to deactivate this lender?')) {
      return;
    }

    try {
      await lendersAPI.delete(lenderId);
      
      toast({
        title: 'Success',
        description: 'Lender deactivated successfully',
      });
      
      loadLenders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to deactivate lender',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (lender: Lender) => {
    setSelectedLender(lender);
    setFormData({
      lender_name: lender.lender_name,
      lender_type: lender.lender_type,
      contact_name: lender.contact_name || '',
      contact_email: lender.contact_email || '',
      contact_phone: lender.contact_phone || '',
      website: '',
      address: '',
      min_credit_score: lender.min_credit_score?.toString() || '',
      max_ltv: '',
      notes: '',
      is_preferred: lender.is_preferred
    });
    setShowEditDialog(true);
  };

  const openViewDialog = async (lender: Lender) => {
    try {
      const response = await lendersAPI.getById(lender.id);
      setSelectedLender(response.data);
      setShowViewDialog(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load lender details',
        variant: 'destructive',
      });
    }
  };

  const getLenderTypeBadge = (type: string) => {
    const colors: Record<string, 'default' | 'secondary' | 'outline'> = {
      Bank: 'default',
      CreditUnion: 'secondary',
      OEM: 'outline',
      InHouse: 'outline',
    };
    return <Badge variant={colors[type] || 'outline'}>{type}</Badge>;
  };

  const renderLenderActions = (lender: Lender, variant: 'table' | 'card' = 'table') => {
    const canManage = lender.scope === 'dealer' && canAccessFeature('finance_management' as any);
    const card = variant === 'card';
    return (
      <div className={card ? 'flex flex-wrap gap-1.5 border-t border-border/60 pt-3' : 'flex flex-wrap items-center gap-1.5 sm:gap-2'}>
        <Button
          variant="ghost"
          size="sm"
          className={card ? 'h-9 w-9 shrink-0 p-0' : undefined}
          onClick={() => openViewDialog(lender)}
          title="View details"
        >
          <Eye className="h-4 w-4" />
        </Button>
        {canManage && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className={card ? 'h-9 w-9 shrink-0 p-0' : undefined}
              onClick={() => openEditDialog(lender)}
              title="Edit lender"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`text-red-600 hover:text-red-700 ${card ? 'h-9 w-9 shrink-0 p-0' : ''}`}
              onClick={() => handleDelete(lender.id)}
              title="Deactivate lender"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNavigation />

      {/* ── Page Header ── */}
      <div className="bg-white border-b shadow-sm px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="font-bold text-base text-gray-900">Lenders Management</h1>
            <p className="text-xs text-gray-500">Manage lender relationships and financing options</p>
          </div>
        </div>
        {canAccessFeature('finance_management' as any) && (
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />Add Lender
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Lenders Panel */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lenders</p>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-32 text-xs border-gray-200"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Bank">Bank</SelectItem>
                  <SelectItem value="CreditUnion">Credit Union</SelectItem>
                  <SelectItem value="OEM">OEM</SelectItem>
                  <SelectItem value="InHouse">In-House</SelectItem>
                </SelectContent>
              </Select>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="h-8 w-28 text-xs border-gray-200"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading lenders…</div>
          ) : filteredLenders.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No lenders found</div>
          ) : (
            <>
              {/* Mobile cards */}
              <ul className="divide-y divide-gray-50 md:hidden">
                {filteredLenders.map((lender) => (
                  <li key={lender.id} className="p-4 hover:bg-orange-50/30 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {lender.is_preferred && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />}
                        <span className="font-semibold text-sm text-gray-900">{lender.lender_name}</span>
                      </div>
                      {getLenderTypeBadge(lender.lender_type)}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${lender.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{lender.is_active ? 'Active' : 'Inactive'}</span>
                      {lender.min_credit_score && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-700">{lender.min_credit_score}+ score</span>}
                    </div>
                    {lender.contact_email && <p className="text-xs text-orange-600 hover:underline mb-2"><a href={`mailto:${lender.contact_email}`}>{lender.contact_email}</a></p>}
                    {renderLenderActions(lender, 'card')}
                  </li>
                ))}
              </ul>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['Lender', 'Type', 'Contact', 'Min Score', 'Status', 'Scope', ''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredLenders.map((lender) => (
                      <tr key={lender.id} className="hover:bg-orange-50/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {lender.is_preferred && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />}
                            <span className="font-semibold text-gray-900">{lender.lender_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getLenderTypeBadge(lender.lender_type)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {lender.contact_name && <div className="font-medium text-gray-700">{lender.contact_name}</div>}
                          {lender.contact_email && <div className="text-orange-600">{lender.contact_email}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{lender.min_credit_score ? `${lender.min_credit_score}+` : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${lender.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{lender.is_active ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 capitalize">{lender.scope}</td>
                        <td className="px-4 py-3 text-right">{renderLenderActions(lender, 'table')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Create Lender Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-h-[min(92dvh,920px)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Add New Lender</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 sm:py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="lender_name">Lender Name *</Label>
                  <Input
                    id="lender_name"
                    className="mt-1.5"
                    value={formData.lender_name}
                    onChange={(e) => setFormData({ ...formData, lender_name: e.target.value })}
                    placeholder="Chase Auto Finance"
                  />
                </div>

                <div>
                  <Label htmlFor="lender_type">Type *</Label>
                  <Select
                    value={formData.lender_type}
                    onValueChange={(v) => setFormData({ ...formData, lender_type: v })}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank">Bank</SelectItem>
                      <SelectItem value="CreditUnion">Credit Union</SelectItem>
                      <SelectItem value="OEM">OEM</SelectItem>
                      <SelectItem value="InHouse">In-House</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="contact_name">Contact Name</Label>
                  <Input
                    id="contact_name"
                    className="mt-1.5"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    className="mt-1.5"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="contact@lender.com"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    className="mt-1.5"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <Label htmlFor="min_credit_score">Min Credit Score</Label>
                  <Input
                    id="min_credit_score"
                    type="number"
                    className="mt-1.5"
                    value={formData.min_credit_score}
                    onChange={(e) => setFormData({ ...formData, min_credit_score: e.target.value })}
                    placeholder="650"
                    min="300"
                    max="850"
                  />
                </div>

                <div>
                  <Label htmlFor="max_ltv">Max LTV (%)</Label>
                  <Input
                    id="max_ltv"
                    type="number"
                    className="mt-1.5"
                    value={formData.max_ltv}
                    onChange={(e) => setFormData({ ...formData, max_ltv: e.target.value })}
                    placeholder="125"
                    min="0"
                    max="200"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    className="mt-1.5"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this lender..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch
                    id="is_preferred"
                    checked={formData.is_preferred}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_preferred: checked })}
                  />
                  <Label htmlFor="is_preferred">Mark as preferred lender</Label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setShowCreateDialog(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button className="w-full sm:w-auto" onClick={handleCreate} disabled={saving}>
                  {saving ? 'Creating...' : 'Create Lender'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Lender Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-h-[min(92dvh,920px)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Edit Lender</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 sm:py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="edit_lender_name">Lender Name *</Label>
                  <Input
                    id="edit_lender_name"
                    className="mt-1.5"
                    value={formData.lender_name}
                    onChange={(e) => setFormData({ ...formData, lender_name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="edit_lender_type">Type *</Label>
                  <Select
                    value={formData.lender_type}
                    onValueChange={(v) => setFormData({ ...formData, lender_type: v })}
                  >
                    <SelectTrigger className="mt-1.5 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank">Bank</SelectItem>
                      <SelectItem value="CreditUnion">Credit Union</SelectItem>
                      <SelectItem value="OEM">OEM</SelectItem>
                      <SelectItem value="InHouse">In-House</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="edit_contact_name">Contact Name</Label>
                  <Input
                    id="edit_contact_name"
                    className="mt-1.5"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="edit_contact_email">Contact Email</Label>
                  <Input
                    id="edit_contact_email"
                    type="email"
                    className="mt-1.5"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="edit_contact_phone">Contact Phone</Label>
                  <Input
                    id="edit_contact_phone"
                    className="mt-1.5"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="edit_min_credit_score">Min Credit Score</Label>
                  <Input
                    id="edit_min_credit_score"
                    type="number"
                    className="mt-1.5"
                    value={formData.min_credit_score}
                    onChange={(e) => setFormData({ ...formData, min_credit_score: e.target.value })}
                    min="300"
                    max="850"
                  />
                </div>

                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch
                    id="edit_is_preferred"
                    checked={formData.is_preferred}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_preferred: checked })}
                  />
                  <Label htmlFor="edit_is_preferred">Mark as preferred lender</Label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedLender(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button className="w-full sm:w-auto" onClick={handleEdit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Lender Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-h-[min(90dvh,900px)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Lender Details</DialogTitle>
            </DialogHeader>
            {selectedLender && (
              <div className="space-y-4 py-2 sm:py-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Lender Name</Label>
                    <p className="font-medium">{selectedLender.lender_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <div>{getLenderTypeBadge(selectedLender.lender_type)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div>
                      <Badge variant={selectedLender.is_active ? 'default' : 'outline'}>
                        {selectedLender.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Preferred</Label>
                    <p>{selectedLender.is_preferred ? 'Yes' : 'No'}</p>
                  </div>
                  {selectedLender.contact_name && (
                    <div>
                      <Label className="text-muted-foreground">Contact Name</Label>
                      <p>{selectedLender.contact_name}</p>
                    </div>
                  )}
                  {selectedLender.contact_email && (
                    <div>
                      <Label className="text-muted-foreground">Contact Email</Label>
                      <p>{selectedLender.contact_email}</p>
                    </div>
                  )}
                  {selectedLender.contact_phone && (
                    <div>
                      <Label className="text-muted-foreground">Contact Phone</Label>
                      <p>{selectedLender.contact_phone}</p>
                    </div>
                  )}
                  {selectedLender.min_credit_score && (
                    <div>
                      <Label className="text-muted-foreground">Min Credit Score</Label>
                      <p>{selectedLender.min_credit_score}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>{/* end flex-1 */}
    </div>
  );
};

export default LendersManagement;


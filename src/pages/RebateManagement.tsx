import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { API_BASE_URL } from '@/lib/config';
import TopNavigation from '@/components/layout/TopNavigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Plus, DollarSign, Tag, TrendingUp, Calendar, CheckCircle, XCircle, Edit, Trash2, Play, StopCircle, AlertCircle, X, ChevronDown, Bug, Eye, ExternalLink } from 'lucide-react';

// USA States list
const USA_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'Washington DC' },
];

interface Rebate {
  id: string;
  rebate_name: string;
  rebate_code: string;
  description: string;
  rebate_type: 'consumer' | 'dealer' | 'manufacturer' | 'promotional';
  rebate_amount: number;
  amount_type: 'fixed' | 'percentage';
  eligible_makes: string[] | null;
  eligible_models: string[] | null;
  eligible_years: number[] | null;
  eligible_vehicle_types: string[] | null;
  eligible_states: string[] | null;
  model_specific_amounts: Record<string, { amount: number; enabled: boolean }> | null;
  min_price: number | null;
  max_price: number | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  times_applied: number;
  active_applications: number;
  created_at: string;
}

const RebateManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rebates, setRebates] = useState<Rebate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRebate, setEditingRebate] = useState<Rebate | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<any>(null);
  
  // Vehicle options from database
  const [vehicleOptions, setVehicleOptions] = useState<{
    makes: string[];
    models: string[];
    years: number[];
  }>({ makes: [], models: [], years: [] });
  
  // Dealer info for auto-populating state
  const [dealerState, setDealerState] = useState<string>('');
  
  // Selected make (only one make per rebate now)
  const [selectedMake, setSelectedMake] = useState<string>('');
  
  // Model configurations: { modelName: { amount: number, enabled: boolean } }
  const [modelConfigs, setModelConfigs] = useState<Record<string, { amount: number; enabled: boolean }>>({});
  
  // Models available for selected make
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  
  // Selected values for multi-select (legacy)
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  
  // Confirmation dialogs
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  // Applied vehicles modal
  const [appliedVehiclesModal, setAppliedVehiclesModal] = useState<{
    open: boolean;
    rebateName: string;
    vehicles: any[];
    loading: boolean;
  }>({
    open: false,
    rebateName: '',
    vehicles: [],
    loading: false,
  });

  // Form state
  const [formData, setFormData] = useState({
    rebate_name: '',
    rebate_code: '',
    description: '',
    rebate_type: 'consumer',
    rebate_amount: '',
    amount_type: 'fixed',
    eligible_makes: '',
    eligible_models: '',
    eligible_years: '',
    eligible_vehicle_types: '',
    min_price: '',
    max_price: '',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
    is_active: true,
    terms_and_conditions: '',
  });

  useEffect(() => {
    console.log('🔄 RebateManagement mounted - loading data...');
    fetchRebates();
    fetchStats();
    fetchVehicleOptions();
    fetchDealerProfile();
  }, [filterStatus, filterType, searchTerm]);
  
  // Debug log for vehicle options
  useEffect(() => {
    console.log('📊 Vehicle Options loaded:', {
      makes: vehicleOptions.makes.length,
      models: vehicleOptions.models.length,
      years: vehicleOptions.years.length
    });
  }, [vehicleOptions]);
  
  // Fetch models when make is selected
  useEffect(() => {
    if (selectedMake) {
      fetchModelsForMake(selectedMake);
    } else {
      setAvailableModels([]);
      setModelConfigs({});
    }
  }, [selectedMake]);

  const fetchRebates = async () => {
    try {
      const params = new URLSearchParams({
        status: filterStatus,
        rebate_type: filterType,
        search: searchTerm,
      });

      const response = await fetch(`${API_BASE_URL}/rebates?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch rebates');
      
      const data = await response.json();
      console.log(`📋 Fetched ${data.rebates.length} rebates:`, data.rebates.map(r => ({
        name: r.rebate_name,
        times_applied: r.times_applied,
        active_applications: r.active_applications
      })));
      setRebates(data.rebates);
    } catch (error) {
      console.error('Error fetching rebates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rebates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/rebates/stats`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchVehicleOptions = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('No auth token available for vehicle options fetch');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/rebates/vehicle-options`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch vehicle options:', response.status, response.statusText);
        return;
      }
      
      const data = await response.json();
      setVehicleOptions(data);
    } catch (error) {
      console.error('Error fetching vehicle options:', error);
      toast({
        title: 'Warning',
        description: 'Could not load vehicle options from inventory',
        variant: 'default',
      });
    }
  };
  
  const fetchDealerProfile = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('No auth token available for dealer profile fetch');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/dealers/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const state = data.state || data.dealer?.state;
        if (state) {
          setDealerState(state);
          setSelectedStates([state]); // Auto-populate dealer's state
        }
      } else if (response.status === 404) {
        console.log('Dealer profile not found - skipping state auto-population');
      } else {
        console.log('Could not fetch dealer profile for state auto-population');
      }
    } catch (error) {
      console.log('Error fetching dealer profile (non-critical):', error);
    }
  };
  
  const fetchModelsForMake = async (make: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/rebates/models-by-make?make=${encodeURIComponent(make)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      setAvailableModels(data.models || []);
      
      // Initialize model configs for newly loaded models
      const newConfigs: Record<string, { amount: number; enabled: boolean }> = {};
      data.models.forEach((model: string) => {
        // Check if we already have config for this model
        if (modelConfigs[model]) {
          newConfigs[model] = modelConfigs[model];
        } else {
          newConfigs[model] = { amount: 0, enabled: false };
        }
      });
      setModelConfigs(newConfigs);
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Filter enabled models with amounts > 0
      const enabledModels = Object.entries(modelConfigs)
        .filter(([_, config]) => config.enabled && config.amount > 0)
        .reduce((acc, [model, config]) => {
          acc[model] = config;
          return acc;
        }, {} as Record<string, { amount: number; enabled: boolean }>);

      // Validate
      if (selectedMake && Object.keys(enabledModels).length === 0) {
        toast({
          title: 'Validation Error',
          description: 'Please enable at least one model with a rebate amount, or remove the make selection to use base amount for all vehicles',
          variant: 'destructive',
        });
        return;
      }
      
      // If no make selected, require base rebate amount
      if (!selectedMake && (!formData.rebate_amount || parseFloat(formData.rebate_amount) <= 0)) {
        toast({
          title: 'Validation Error',
          description: 'Please enter a base rebate amount, or select a make to configure model-specific amounts',
          variant: 'destructive',
        });
        return;
      }

      // Determine method and URL
      const method = editingRebate ? 'PUT' : 'POST';
      const url = editingRebate ? `${API_BASE_URL}/rebates/${editingRebate.id}` : `${API_BASE_URL}/rebates`;
      
      // Prepare data
      const submitData = {
        ...formData,
        rebate_amount: parseFloat(formData.rebate_amount) || 0,
        eligible_makes: selectedMake ? [selectedMake] : null,
        eligible_models: null, // No longer used for model-specific configs
        model_specific_amounts: Object.keys(enabledModels).length > 0 ? enabledModels : null,
        eligible_years: selectedYears.length > 0 ? selectedYears : null,
        eligible_vehicle_types: selectedVehicleTypes.length > 0 ? selectedVehicleTypes : null,
        eligible_states: selectedStates.length > 0 ? selectedStates : null,
        min_price: formData.min_price ? parseFloat(formData.min_price) : null,
        max_price: formData.max_price ? parseFloat(formData.max_price) : null,
        valid_until: formData.valid_until || null,
      };

      console.log(`📤 Submitting rebate (${method}):`, {
        editingRebate: editingRebate?.id,
        rebate_name: submitData.rebate_name,
        rebate_amount: submitData.rebate_amount,
        formData: formData,
        submitData: submitData
      });

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Server validation error:', errorData);
        throw new Error('Failed to save rebate');
      }


      toast({
        title: 'Success',
        description: `Rebate ${editingRebate ? 'updated' : 'created'} successfully`,
      });

      setShowForm(false);
      setEditingRebate(null);
      fetchRebates();
      fetchStats();
      resetForm();
    } catch (error) {
      console.error('Error saving rebate:', error);
      toast({
        title: 'Error',
        description: 'Failed to save rebate',
        variant: 'destructive',
      });
    }
  };

  const handleViewAppliedVehicles = async (rebateId: string, rebateName: string) => {
    setAppliedVehiclesModal({
      open: true,
      rebateName,
      vehicles: [],
      loading: true,
    });

    try {
      const response = await fetch(`${API_BASE_URL}/rebates/${rebateId}/applied-vehicles`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch applied vehicles');
      
      const data = await response.json();
      
      setAppliedVehiclesModal({
        open: true,
        rebateName,
        vehicles: data.vehicles || [],
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching applied vehicles:', error);
      toast({
        title: 'Error',
        description: 'Failed to load applied vehicles',
        variant: 'destructive',
      });
      setAppliedVehiclesModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDebugRebate = async (rebateId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/rebates/${rebateId}/debug-match`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to debug rebate');
      
      const data = await response.json();
      
      console.log('🔍 Rebate Debug Analysis:', data);
      
      // Create detailed message
      const eligibleCount = data.eligible_vehicles;
      const totalCount = data.total_vehicles;
      const analysis = data.analysis;
      
      // Find common issues
      const issues = [];
      const failed_year = analysis.filter((a: any) => !a.checks.year_match).length;
      const failed_type = analysis.filter((a: any) => !a.checks.type_match).length;
      const failed_model = analysis.filter((a: any) => !a.checks.model_configured).length;
      const failed_status = analysis.filter((a: any) => !a.checks.status_match).length;
      
      if (failed_year > 0) issues.push(`${failed_year} vehicles wrong year`);
      if (failed_type > 0) issues.push(`${failed_type} vehicles wrong type`);
      if (failed_model > 0) issues.push(`${failed_model} models not configured`);
      if (failed_status > 0) issues.push(`${failed_status} vehicles not available`);
      
      toast({
        title: `Rebate Matching: ${eligibleCount}/${totalCount} vehicles eligible`,
        description: issues.length > 0 ? `Issues: ${issues.join(', ')}` : 'All vehicles match!',
        duration: 10000,
      });
      
      // Show detailed console output
      console.table(analysis.map((a: any) => ({
        stock: a.vehicle.stock,
        model: a.vehicle.model,
        year: a.vehicle.year,
        eligible: a.eligible ? '✅' : '❌',
        year_ok: a.checks.year_match ? '✅' : '❌',
        type_ok: a.checks.type_match ? '✅' : '❌',
        model_ok: a.checks.model_configured ? '✅' : '❌',
        status_ok: a.checks.status_match ? '✅' : '❌',
        amount: `$${a.model_amount}`
      })));
      
    } catch (error) {
      console.error('Error debugging rebate:', error);
      toast({
        title: 'Error',
        description: 'Failed to debug rebate matching',
        variant: 'destructive',
      });
    }
  };

  const handleApplyRebate = async (rebateId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Apply Rebate',
      message: 'Apply this rebate to all eligible vehicles in inventory?',
      onConfirm: () => executeApplyRebate(rebateId),
    });
  };

  const executeApplyRebate = async (rebateId: string) => {
    setConfirmDialog({ ...confirmDialog, open: false });
    
    try {
      const response = await fetch(`${API_BASE_URL}/rebates/${rebateId}/apply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to apply rebate');
      
      const data = await response.json();
      
      console.log('✅ Rebate apply response:', data);
      
      const s = data.summary;
      const total = s?.total ?? 0;
      const applied = s?.applied ?? 0;
      const already = s?.already_applied ?? 0;
      if (total === 0) {
        toast({
          title: 'No vehicles matched',
          description:
            'Inventory has no vehicles that pass this rebate’s rules (year, new/used, make/model key, status=available). Edit the rebate—often add model years to Eligible years—or use Debug to see per-vehicle checks.',
          variant: 'destructive',
        });
      } else if (applied === 0 && already > 0) {
        toast({
          title: 'Already applied',
          description: `All ${already} matching vehicle(s) already had this rebate.`,
        });
      } else {
        toast({
          title: 'Rebate Applied',
          description: `Applied to ${applied} vehicle(s) (${already} already had it).`,
        });
      }

      // Wait a moment for DB to commit, then refresh
      setTimeout(() => {
        fetchRebates();
        fetchStats();
      }, 500);
    } catch (error) {
      console.error('Error applying rebate:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply rebate',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveRebate = async (rebateId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Rebate',
      message: 'Remove this rebate from all vehicles?',
      onConfirm: () => executeRemoveRebate(rebateId),
    });
  };

  const executeRemoveRebate = async (rebateId: string) => {
    setConfirmDialog({ ...confirmDialog, open: false });
    
    try {
      const response = await fetch(`${API_BASE_URL}/rebates/${rebateId}/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ reason: 'Removed by user' }),
      });

      if (!response.ok) throw new Error('Failed to remove rebate');
      
      const data = await response.json();
      
      toast({
        title: 'Rebate Removed',
        description: `Removed from ${data.vehicles_updated} vehicles`,
      });

      fetchRebates();
      fetchStats();
    } catch (error) {
      console.error('Error removing rebate:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove rebate',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRebate = async (rebateId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Deactivate Rebate',
      message: 'Are you sure you want to deactivate this rebate? This action can be undone by editing the rebate.',
      onConfirm: () => executeDeleteRebate(rebateId),
    });
  };

  const executeDeleteRebate = async (rebateId: string) => {
    setConfirmDialog({ ...confirmDialog, open: false });
    
    try {
      const response = await fetch(`${API_BASE_URL}/rebates/${rebateId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete rebate');

      toast({
        title: 'Success',
        description: 'Rebate deactivated successfully',
      });

      fetchRebates();
      fetchStats();
    } catch (error) {
      console.error('Error deleting rebate:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rebate',
        variant: 'destructive',
      });
    }
  };

  const handleEditRebate = (rebate: Rebate) => {
    setEditingRebate(rebate);
    setFormData({
      rebate_name: rebate.rebate_name,
      rebate_code: rebate.rebate_code || '',
      description: rebate.description || '',
      rebate_type: rebate.rebate_type,
      rebate_amount: rebate.rebate_amount.toString(),
      amount_type: rebate.amount_type,
      eligible_makes: '',
      eligible_models: '',
      eligible_years: '',
      eligible_vehicle_types: '',
      min_price: rebate.min_price?.toString() || '',
      max_price: rebate.max_price?.toString() || '',
      valid_from: rebate.valid_from?.split('T')[0] || '',
      valid_until: rebate.valid_until?.split('T')[0] || '',
      is_active: rebate.is_active,
      terms_and_conditions: '',
    });
    
    // Set selected values
    setSelectedMake(rebate.eligible_makes?.[0] || '');
    setSelectedYears(rebate.eligible_years || []);
    setSelectedVehicleTypes(rebate.eligible_vehicle_types || []);
    setSelectedStates(rebate.eligible_states || (dealerState ? [dealerState] : []));
    
    // Set model configs if present
    if (rebate.model_specific_amounts) {
      setModelConfigs(rebate.model_specific_amounts);
    }
    
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingRebate(null);
    setFormData({
      rebate_name: '',
      rebate_code: '',
      description: '',
      rebate_type: 'consumer',
      rebate_amount: '',
      amount_type: 'fixed',
      eligible_makes: '',
      eligible_models: '',
      eligible_years: '',
      eligible_vehicle_types: '',
      min_price: '',
      max_price: '',
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '',
      is_active: true,
      terms_and_conditions: '',
    });
    
    // Reset selected values
    setSelectedMake('');
    setSelectedYears([]);
    setSelectedVehicleTypes([]);
    setSelectedStates(dealerState ? [dealerState] : []); // Keep dealer's default state
    setModelConfigs({});
    setAvailableModels([]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getRebateTypeBadge = (type: string) => {
    const colors = {
      consumer: 'bg-green-500',
      dealer: 'bg-primary',
      manufacturer: 'bg-purple-500',
      promotional: 'bg-orange-500',
    };
    return <Badge className={colors[type as keyof typeof colors]}>{type}</Badge>;
  };

  const renderRebateActions = (rebate: Rebate, variant: 'table' | 'card' = 'table') => {
    const card = variant === 'card';
    const btnClass = card ? 'h-9 shrink-0 px-2' : '';
    return (
      <div
        className={
          card
            ? 'mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3'
            : 'flex flex-wrap items-center gap-1.5 sm:gap-2'
        }
      >
        {rebate.times_applied > 0 && (
          <Button
            size="sm"
            variant="default"
            className={btnClass}
            onClick={() => handleViewAppliedVehicles(rebate.id, rebate.rebate_name)}
            title="View applied vehicles"
          >
            <Eye className="h-3 w-3" />
            {card && <span className="ml-1 text-xs">View</span>}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className={btnClass}
          onClick={() => handleDebugRebate(rebate.id)}
          title="Debug matching (check console)"
        >
          <Bug className="h-3 w-3" />
          {card && <span className="ml-1 text-xs">Debug</span>}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={btnClass}
          onClick={() => handleApplyRebate(rebate.id)}
          title="Apply to vehicles"
        >
          <Play className="h-3 w-3" />
          {card && <span className="ml-1 text-xs">Apply</span>}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={btnClass}
          onClick={() => handleRemoveRebate(rebate.id)}
          title="Remove from vehicles"
        >
          <StopCircle className="h-3 w-3" />
          {card && <span className="ml-1 text-xs">Stop</span>}
        </Button>
        <Button size="sm" variant="outline" className={btnClass} onClick={() => handleEditRebate(rebate)} title="Edit">
          <Edit className="h-3 w-3" />
          {card && <span className="ml-1 text-xs">Edit</span>}
        </Button>
        <Button size="sm" variant="outline" className={btnClass} onClick={() => handleDeleteRebate(rebate.id)} title="Delete">
          <Trash2 className="h-3 w-3" />
          {card && <span className="ml-1 text-xs">Del</span>}
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="container mx-auto px-3 py-6 sm:px-4">
          <div className="flex h-64 items-center justify-center">
            <div className="text-muted-foreground">Loading rebates...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      
      <main className="container mx-auto space-y-4 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-4 sm:space-y-6 sm:px-4 sm:py-6">
        {/* Header */}
        <div className="mb-2 sm:mb-6">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Rebate Management</h1>
          <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
            Manage vehicle rebates and incentives for your inventory
          </p>
        </div>

      {/* Stats Cards */}
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 sm:mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rebates</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_rebates}</div>
              <p className="text-xs text-muted-foreground">
                {stats.active_rebates} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Applied</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_applications}</div>
              <p className="text-xs text-muted-foreground">
                To {stats.vehicles_with_rebates} vehicles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(parseFloat(stats.total_rebate_amount || 0))}
              </div>
              <p className="text-xs text-muted-foreground">
                In active rebates
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Consumer Rebates</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.consumer_applications}</div>
              <p className="text-xs text-muted-foreground">
                {stats.dealer_applications} dealer rebates
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Rebates</CardTitle>
              <CardDescription>Create and manage vehicle rebates</CardDescription>
            </div>
            <Button className="w-full shrink-0 sm:w-auto" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              New Rebate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="min-w-0 flex-1">
              <Input
                className="w-full"
                placeholder="Search rebates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="consumer">Consumer</SelectItem>
                <SelectItem value="dealer">Dealer</SelectItem>
                <SelectItem value="manufacturer">Manufacturer</SelectItem>
                <SelectItem value="promotional">Promotional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rebates list: cards on small screens, table md+ */}
          {rebates.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No Rebates Found</h3>
              <p className="mb-4 text-muted-foreground">
                Create your first rebate to start offering incentives on your vehicles
              </p>
              <Button onClick={() => { resetForm(); setShowForm(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Rebate
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {rebates.map((rebate) => (
                  <div
                    key={rebate.id}
                    className="rounded-lg border border-border/60 bg-card p-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-snug">{rebate.rebate_name}</div>
                        {rebate.rebate_code && (
                          <div className="mt-0.5 text-sm text-muted-foreground">Code: {rebate.rebate_code}</div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {getRebateTypeBadge(rebate.rebate_type)}
                          {rebate.is_active && (!rebate.valid_until || new Date(rebate.valid_until) > new Date()) ? (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <XCircle className="mr-1 h-3 w-3" />
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      <div>
                        <span className="text-muted-foreground">Amount: </span>
                        {rebate.model_specific_amounts && Object.keys(rebate.model_specific_amounts).length > 0 ? (
                          <span className="font-medium">Variable by model</span>
                        ) : rebate.amount_type === 'percentage' ? (
                          <span>{rebate.rebate_amount}%</span>
                        ) : (
                          formatCurrency(rebate.rebate_amount)
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {rebate.eligible_makes && <span>Make: {rebate.eligible_makes.join(', ')} </span>}
                        {rebate.model_specific_amounts && Object.keys(rebate.model_specific_amounts).length > 0 ? (
                          <span>
                            {Object.entries(rebate.model_specific_amounts).filter(([_, c]) => c.enabled).length} model(s)
                          </span>
                        ) : rebate.eligible_models ? (
                          <span>Models: {rebate.eligible_models.join(', ')}</span>
                        ) : !rebate.eligible_makes && !rebate.eligible_models ? (
                          <span>All vehicles</span>
                        ) : null}
                      </div>
                      {rebate.eligible_years && rebate.eligible_years.length > 0 && (
                        <div className="text-xs text-amber-700 dark:text-amber-500">
                          Years only: {[...rebate.eligible_years].sort((a, b) => b - a).join(', ')}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span>
                          {rebate.valid_until ? (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(rebate.valid_until).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No expiry</span>
                          )}
                        </span>
                        <span>
                          <span className="font-medium">{rebate.times_applied}x</span>
                          <span className="text-muted-foreground"> ({rebate.active_applications} active)</span>
                        </span>
                      </div>
                    </div>
                    {renderRebateActions(rebate, 'card')}
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Eligibility</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rebates.map((rebate) => (
                      <TableRow key={rebate.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rebate.rebate_name}</div>
                            {rebate.rebate_code && (
                              <div className="text-sm text-muted-foreground">
                                Code: {rebate.rebate_code}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getRebateTypeBadge(rebate.rebate_type)}</TableCell>
                        <TableCell>
                          {rebate.model_specific_amounts && Object.keys(rebate.model_specific_amounts).length > 0 ? (
                            <div className="text-sm">
                              <div className="font-medium">Variable by Model</div>
                              <div className="text-xs text-muted-foreground">
                                {Object.entries(rebate.model_specific_amounts)
                                  .filter(([_, config]) => config.enabled)
                                  .map(([model, config]) => `${model}: ${formatCurrency(config.amount)}`)
                                  .slice(0, 2)
                                  .join(', ')}
                                {Object.entries(rebate.model_specific_amounts).filter(([_, c]) => c.enabled).length > 2 && '...'}
                              </div>
                            </div>
                          ) : (
                            rebate.amount_type === 'percentage'
                              ? `${rebate.rebate_amount}%`
                              : formatCurrency(rebate.rebate_amount)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rebate.eligible_makes && (
                              <div className="font-medium">Make: {rebate.eligible_makes.join(', ')}</div>
                            )}
                            {rebate.model_specific_amounts && Object.keys(rebate.model_specific_amounts).length > 0 ? (
                              <div className="mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {Object.entries(rebate.model_specific_amounts)
                                    .filter(([_, config]) => config.enabled)
                                    .length} model(s) configured
                                </span>
                              </div>
                            ) : rebate.eligible_models ? (
                              <div>Models: {rebate.eligible_models.join(', ')}</div>
                            ) : null}
                            {!rebate.eligible_makes && !rebate.eligible_models && !rebate.model_specific_amounts && (
                              <span className="text-muted-foreground">All vehicles</span>
                            )}
                            {rebate.eligible_years && rebate.eligible_years.length > 0 && (
                              <div className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                                Years only: {[...rebate.eligible_years].sort((a, b) => b - a).join(', ')} (other years excluded)
                              </div>
                            )}
                            {rebate.eligible_vehicle_types && rebate.eligible_vehicle_types.length > 0 && (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                Condition: {rebate.eligible_vehicle_types.join(', ')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {rebate.valid_until ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(rebate.valid_until).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No expiry</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rebate.times_applied}x</div>
                            <div className="text-sm text-muted-foreground">
                              {rebate.active_applications} active
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rebate.is_active && (!rebate.valid_until || new Date(rebate.valid_until) > new Date()) ? (
                            <Badge variant="default">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="mr-1 h-3 w-3" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{renderRebateActions(rebate, 'table')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => {
        if (!open) {
          // When closing, reset the form
          resetForm();
        }
        setShowForm(open);
      }}>
        <DialogContent className="max-h-[min(90dvh,90vh)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editingRebate ? 'Edit Rebate' : 'Create New Rebate'}
            </DialogTitle>
            <DialogDescription>
              {editingRebate ? 'Update' : 'Create'} rebate details and eligibility criteria
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Tabs defaultValue="basic">
              <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-md bg-muted p-1 sm:grid-cols-3 sm:h-10">
                <TabsTrigger value="basic" className="w-full">
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="eligibility" className="w-full">
                  Eligibility
                </TabsTrigger>
                <TabsTrigger value="validity" className="w-full">
                  Validity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rebate_name">Rebate Name *</Label>
                    <Input
                      id="rebate_name"
                      value={formData.rebate_name}
                      onChange={(e) => setFormData({ ...formData, rebate_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="rebate_code">Rebate Code</Label>
                    <Input
                      id="rebate_code"
                      value={formData.rebate_code}
                      onChange={(e) => setFormData({ ...formData, rebate_code: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rebate_type">Rebate Type *</Label>
                    <Select
                      value={formData.rebate_type}
                      onValueChange={(value) => setFormData({ ...formData, rebate_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consumer">Consumer</SelectItem>
                        <SelectItem value="dealer">Dealer</SelectItem>
                        <SelectItem value="manufacturer">Manufacturer</SelectItem>
                        <SelectItem value="promotional">Promotional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount_type">Amount Type *</Label>
                    <Select
                      value={formData.amount_type}
                      onValueChange={(value) => setFormData({ ...formData, amount_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="rebate_amount">
                    Base Rebate Amount {formData.amount_type === 'percentage' && '(%)'} 
                    {selectedMake ? '' : '*'}
                  </Label>
                  <Input
                    id="rebate_amount"
                    type="number"
                    step="0.01"
                    value={formData.rebate_amount}
                    onChange={(e) => setFormData({ ...formData, rebate_amount: e.target.value })}
                    placeholder="e.g., 2500"
                    required={!selectedMake}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedMake 
                      ? '💡 This base amount is used for the "Set All" button in model configuration'
                      : '⚠️ This amount will apply to ALL eligible vehicles (no model-specific amounts)'
                    }
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="eligibility" className="space-y-4">
                {/* Make Selection - Single Select */}
                <div>
                  <Label htmlFor="make_select">Select Make (One per rebate) *</Label>
                  {vehicleOptions.makes.length > 0 ? (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Select
                          value={selectedMake || undefined}
                          onValueChange={(value) => setSelectedMake(value)}
                        >
                          <SelectTrigger id="make_select" className="min-w-0 flex-1">
                            <SelectValue placeholder="Choose a make..." />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicleOptions.makes.map((make) => (
                              <SelectItem key={make} value={make}>
                                {make}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedMake && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 shrink-0 self-end sm:self-auto"
                            onClick={() => {
                              setSelectedMake('');
                              setAvailableModels([]);
                              setModelConfigs({});
                            }}
                            title="Clear selection"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Select one make to configure model-specific rebate amounts
                      </p>
                    </>
                  ) : (
                    <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-950/20">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-yellow-900 dark:text-yellow-200">No Makes Available</p>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            No vehicle makes found in your inventory. Please add vehicles first or refresh the page.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => {
                              fetchVehicleOptions();
                            }}
                          >
                            Refresh Options
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Model Configuration - Only shown when make is selected */}
                {selectedMake && availableModels.length > 0 && (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Label className="text-base font-semibold">
                        Configure Models for {selectedMake}
                      </Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => {
                            const newConfigs = { ...modelConfigs };
                            availableModels.forEach(model => {
                              newConfigs[model] = { ...newConfigs[model], enabled: true };
                            });
                            setModelConfigs(newConfigs);
                          }}
                        >
                          Enable All
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => {
                            const amount = parseFloat(formData.rebate_amount) || 0;
                            if (amount > 0) {
                              const newConfigs = { ...modelConfigs };
                              availableModels.forEach(model => {
                                newConfigs[model] = { amount, enabled: true };
                              });
                              setModelConfigs(newConfigs);
                            }
                          }}
                        >
                          Set All to ${formData.rebate_amount || '0'}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto">
                      {availableModels.map((model) => (
                        <Card key={model} className="p-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={modelConfigs[model]?.enabled || false}
                              onCheckedChange={(checked) => {
                                setModelConfigs({
                                  ...modelConfigs,
                                  [model]: {
                                    amount: modelConfigs[model]?.amount || 0,
                                    enabled: checked as boolean,
                                  },
                                });
                              }}
                            />
                            <div className="grid flex-1 grid-cols-1 items-center gap-3 sm:grid-cols-2">
                              <Label className="font-medium">{model}</Label>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={modelConfigs[model]?.amount || ''}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    setModelConfigs({
                                      ...modelConfigs,
                                      [model]: {
                                        enabled: modelConfigs[model]?.enabled || false,
                                        amount: value,
                                      },
                                    });
                                  }}
                                  disabled={!modelConfigs[model]?.enabled}
                                  className="flex-1"
                                />
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      💡 Enable models and set individual rebate amounts. Only enabled models with amounts {'>'} $0 will receive rebates.
                    </p>
                  </div>
                )}
                
                {selectedMake && availableModels.length === 0 && (
                  <div className="border rounded-lg p-4 text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No models found for {selectedMake} in your inventory</p>
                  </div>
                )}

                <div>
                  <Label>Eligible Years</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {selectedYears.length > 0 ? `${selectedYears.length} selected` : 'Select years...'}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search years..." />
                        <CommandEmpty>No years found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {vehicleOptions.years.map((year) => (
                            <CommandItem
                              key={year}
                              onSelect={() => {
                                if (selectedYears.includes(year)) {
                                  setSelectedYears(selectedYears.filter(y => y !== year));
                                } else {
                                  setSelectedYears([...selectedYears, year]);
                                }
                              }}
                            >
                              <Checkbox
                                checked={selectedYears.includes(year)}
                                className="mr-2"
                              />
                              {year}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedYears.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedYears.map((year) => (
                        <Badge key={year} variant="secondary" className="flex items-center gap-1">
                          {year}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => setSelectedYears(selectedYears.filter(y => y !== year))}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Vehicle Types</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {selectedVehicleTypes.length > 0 ? `${selectedVehicleTypes.length} selected` : 'Select types...'}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandGroup>
                          {['new', 'used', 'certified'].map((type) => (
                            <CommandItem
                              key={type}
                              onSelect={() => {
                                if (selectedVehicleTypes.includes(type)) {
                                  setSelectedVehicleTypes(selectedVehicleTypes.filter(t => t !== type));
                                } else {
                                  setSelectedVehicleTypes([...selectedVehicleTypes, type]);
                                }
                              }}
                            >
                              <Checkbox
                                checked={selectedVehicleTypes.includes(type)}
                                className="mr-2"
                              />
                              <span className="capitalize">{type}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedVehicleTypes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedVehicleTypes.map((type) => (
                        <Badge key={type} variant="secondary" className="flex items-center gap-1 capitalize">
                          {type}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => setSelectedVehicleTypes(selectedVehicleTypes.filter(t => t !== type))}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* USA States/Regions Selector */}
                <div>
                  <Label>Eligible USA States/Regions</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {selectedStates.length > 0 ? `${selectedStates.length} state(s) selected` : 'Select states...'}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search states..." />
                        <CommandEmpty>No states found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {USA_STATES.map((state) => (
                            <CommandItem
                              key={state.code}
                              onSelect={() => {
                                if (selectedStates.includes(state.code)) {
                                  setSelectedStates(selectedStates.filter(s => s !== state.code));
                                } else {
                                  setSelectedStates([...selectedStates, state.code]);
                                }
                              }}
                            >
                              <Checkbox
                                checked={selectedStates.includes(state.code)}
                                className="mr-2"
                              />
                              {state.name} ({state.code})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedStates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedStates.map((stateCode) => {
                        const state = USA_STATES.find(s => s.code === stateCode);
                        return (
                          <Badge key={stateCode} variant="secondary" className="flex items-center gap-1">
                            {state?.name || stateCode}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => setSelectedStates(selectedStates.filter(s => s !== stateCode))}
                            />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    {dealerState && `Defaults to your dealership state: ${dealerState}`}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="min_price">Minimum Price ($)</Label>
                    <Input
                      id="min_price"
                      type="number"
                      step="0.01"
                      value={formData.min_price}
                      onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_price">Maximum Price ($)</Label>
                    <Input
                      id="max_price"
                      type="number"
                      step="0.01"
                      value={formData.max_price}
                      onChange={(e) => setFormData({ ...formData, max_price: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="validity" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="valid_from">Valid From *</Label>
                    <Input
                      id="valid_from"
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="valid_until">Valid Until</Label>
                    <Input
                      id="valid_until"
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Leave empty for no expiry
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="terms_and_conditions">Terms & Conditions</Label>
                  <Textarea
                    id="terms_and_conditions"
                    value={formData.terms_and_conditions}
                    onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                    rows={4}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                {editingRebate ? 'Update' : 'Create'} Rebate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
            >
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" onClick={confirmDialog.onConfirm}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Applied Vehicles Modal */}
      <Dialog open={appliedVehiclesModal.open} onOpenChange={(open) => setAppliedVehiclesModal({ ...appliedVehiclesModal, open })}>
        <DialogContent className="max-h-[min(85dvh,85vh)] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Vehicles with "{appliedVehiclesModal.rebateName}" Rebate</DialogTitle>
            <DialogDescription>
              List of all vehicles that have this rebate applied
            </DialogDescription>
          </DialogHeader>

          {appliedVehiclesModal.loading ? (
            <div className="py-8 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-2 text-muted-foreground">Loading vehicles...</p>
            </div>
          ) : appliedVehiclesModal.vehicles.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <AlertCircle className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>No vehicles found with this rebate</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Total: {appliedVehiclesModal.vehicles.length} vehicle(s)
              </div>
              <div className="space-y-3 md:hidden">
                {appliedVehiclesModal.vehicles.map((vehicle) => (
                  <div
                    key={vehicle.vehicle_id}
                    className="rounded-lg border border-border/60 bg-card p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">Stock #{vehicle.stock_number}</div>
                        <div className="mt-1 font-medium">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </div>
                        {vehicle.trim && (
                          <div className="text-sm text-muted-foreground">{vehicle.trim}</div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => {
                          window.location.href = `/inventory?vehicle=${vehicle.vehicle_id}`;
                        }}
                        title="View vehicle details"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Price</dt>
                      <dd>{formatCurrency(vehicle.price)}</dd>
                      <dt className="text-muted-foreground">Rebate</dt>
                      <dd className="font-semibold text-green-600">{formatCurrency(vehicle.applied_amount)}</dd>
                      <dt className="text-muted-foreground">Applied</dt>
                      <dd>{new Date(vehicle.applied_at).toLocaleDateString()}</dd>
                    </dl>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stock #</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Rebate Amount</TableHead>
                      <TableHead>Applied Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appliedVehiclesModal.vehicles.map((vehicle) => (
                      <TableRow key={vehicle.vehicle_id}>
                        <TableCell className="font-medium">{vehicle.stock_number}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {vehicle.make} {vehicle.model}
                            </div>
                            {vehicle.trim && (
                              <div className="text-sm text-muted-foreground">{vehicle.trim}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{vehicle.year}</TableCell>
                        <TableCell>{formatCurrency(vehicle.price)}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatCurrency(vehicle.applied_amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(vehicle.applied_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              window.location.href = `/inventory?vehicle=${vehicle.vehicle_id}`;
                            }}
                            title="View vehicle details"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setAppliedVehiclesModal({ ...appliedVehiclesModal, open: false })}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </main>
    </div>
  );
};

export default RebateManagement;


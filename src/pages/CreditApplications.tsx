/**
 * Credit Applications Management Page
 * Comprehensive credit application workflow with customer-facing form,
 * multi-step wizard, document uploads, and application tracking
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { financeAPI, lendersAPI, vehiclesAPI } from '@/lib/api';
import { buildApiUrl } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FileText, Users, TrendingUp, CheckCircle, Clock, XCircle, Eye, Edit, Calculator, Send, Upload, Download, Filter, Search, Plus, ArrowLeft, Check, X, Trash2 } from 'lucide-react';
import TopNavigation from '@/components/layout/TopNavigation';

const DEAL_TERM_OPTIONS = ['24', '36', '48', '60', '72'] as const;

function getApplicationVehicleLabel(app: CreditApplication | null): string {
  if (!app) return '';
  const dn = typeof app.vehicle_display_name === 'string' ? app.vehicle_display_name.trim() : '';
  if (dn) return dn;
  const parts = [app.vehicle_year, app.vehicle_make, app.vehicle_model].filter(
    (p) => p !== null && p !== undefined && String(p).trim() !== ''
  );
  return parts.map(String).join(' ').trim();
}

interface CreditApplication {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  credit_score?: number;
  application_status: string;
  submitted_at: string;
  preferred_lender_id?: string;
  approved_lender_id?: string;
  preferred_lender_name?: string;
  approved_lender_name?: string;
  lender_approval_date?: string;
  notes?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  /** From credit application — used to pre-fill Create Deal */
  vehicle_id?: string | null;
  vehicle_purchase_price?: number | string | null;
  down_payment?: number | string | null;
  requested_term_months?: number | string | null;
  deal_type?: string | null;
  vehicle_msrp?: number | string | null;
  conversation_id?: string | null;
  /** Year / make / model resolved from application row or linked DAIVE chat + inventory */
  vehicle_year?: number | string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_display_name?: string | null;
}

const CreditApplications = () => {
  const { user, loading: authLoading } = useAuth();
  const { canAccessFeature } = usePermissions();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'list' | 'new' | 'stats'>('list');
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [lenders, setLenders] = useState<any[]>([]);
  
  // Filters
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
    lender: searchParams.get('lender') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
  });

  // New Application Form (Multi-step)
  const [currentStep, setCurrentStep] = useState(1);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Personal Info
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    
    // Step 2: Financial Info
    annual_income: '',
    employment_status: '',
    employer_name: '',
    years_employed: '',
    
    // Step 3: Credit Info
    ssn: '',
    dl_number: '',
    credit_score: '',
    
    // Step 4: Preferences
    preferred_lender_id: '',
    down_payment: '',
    trade_in_value: '',
    notes: '',
  });

  // View/Edit dialogs
  const [selectedApp, setSelectedApp] = useState<CreditApplication | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [appDetails, setAppDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [editingApp, setEditingApp] = useState<CreditApplication | null>(null);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    credit_score: '',
    preferred_lender_id: '',
    notes: ''
  });

  // Create Deal Dialog
  const [showCreateDealDialog, setShowCreateDealDialog] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<CreditApplication | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [dealForm, setDealForm] = useState({
    vehicle_id: '',
    price: '',
    down_payment: '',
    credit_score: '',
    term_months: '60',
    deal_type: 'finance' as 'finance' | 'lease',
    // Government Fees (TTL)
    sales_tax_rate: '',
    title_fee: '',
    license_fee: '',
    registration_fee: '',
    inspection_fee: '',
    processing_fee: '',
    // Trade-In
    trade_in_acv: '',
    trade_in_payoff: '',
    // Add-Ons
    add_ons: '',
    protection_products: '',
    // Lease-specific
    msrp: '',
    cap_cost_reductions: '',
    capitalized_fees: '',
    tax_rate: '',
    annual_mileage: '',
    excess_mileage_rate: '0.25'
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    reviewing: 0,
    avgProcessingTime: 0,
    approvalRate: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadApplications();
      loadLenders();
      loadVehicles();
      calculateStats();
    }
  }, [user, filters]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (filters.status) params.status = filters.status;
      
      const response = await financeAPI.getCreditApplications(params);
      let apps = response.data || [];
      
      // Client-side filtering for search
      if (filters.search) {
        const search = filters.search.toLowerCase();
        apps = apps.filter((app: CreditApplication) =>
          app.customer_name.toLowerCase().includes(search) ||
          app.customer_email.toLowerCase().includes(search) ||
          app.customer_phone?.toLowerCase().includes(search)
        );
      }
      
      // Filter by lender
      if (filters.lender) {
        apps = apps.filter((app: CreditApplication) =>
          app.preferred_lender_id === filters.lender ||
          app.approved_lender_id === filters.lender
        );
      }
      
      // Filter by date range
      if (filters.dateFrom) {
        apps = apps.filter((app: CreditApplication) =>
          new Date(app.submitted_at) >= new Date(filters.dateFrom)
        );
      }
      if (filters.dateTo) {
        apps = apps.filter((app: CreditApplication) =>
          new Date(app.submitted_at) <= new Date(filters.dateTo)
        );
      }
      
      setApplications(apps);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load applications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLenders = async () => {
    try {
      const response = await lendersAPI.getAll({ is_active: true });
      setLenders(response.data || []);
    } catch (error) {
      console.error('Error loading lenders:', error);
    }
  };

  const calculateStats = async () => {
    try {
      const response = await financeAPI.getCreditApplications({});
      const apps = response.data || [];
      
      const total = apps.length;
      const pending = apps.filter((a: any) => a.application_status === 'pending').length;
      const approved = apps.filter((a: any) => a.application_status === 'approved').length;
      const rejected = apps.filter((a: any) => a.application_status === 'rejected').length;
      const reviewing = apps.filter((a: any) => a.application_status === 'reviewing').length;
      
      const approvalRate = total > 0 ? (approved / total) * 100 : 0;
      
      // Calculate average processing time
      const processedApps = apps.filter((a: any) => a.reviewed_at);
      const avgTime = processedApps.length > 0
        ? processedApps.reduce((sum: number, app: any) => {
            const submitted = new Date(app.submitted_at).getTime();
            const reviewed = new Date(app.reviewed_at).getTime();
            return sum + (reviewed - submitted);
          }, 0) / processedApps.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0;
      
      setStats({
        total,
        pending,
        approved,
        rejected,
        reviewing,
        avgProcessingTime: avgTime,
        approvalRate,
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const handleSubmitApplication = async () => {
    try {
      setSubmittingApplication(true);
      
      // Validate required fields
      if (!formData.customer_name || !formData.customer_email) {
        toast({
          title: 'Validation Error',
          description: 'Name and email are required',
          variant: 'destructive',
        });
        setSubmittingApplication(false);
        return;
      }

      // Validate and normalize phone format if provided
      let normalizedPhone = null;
      if (formData.customer_phone && formData.customer_phone.trim()) {
        // Remove all non-digit characters
        const cleanPhone = formData.customer_phone.replace(/\D/g, '');
        
        // Validate: must be 10 digits (or 11 with country code 1)
        if (cleanPhone.length === 10 && /^[2-9]\d{9}$/.test(cleanPhone)) {
          normalizedPhone = cleanPhone; // Use 10-digit format
        } else if (cleanPhone.length === 11 && cleanPhone[0] === '1' && /^1[2-9]\d{9}$/.test(cleanPhone)) {
          normalizedPhone = cleanPhone; // Use 11-digit format with country code
        } else {
          toast({
            title: 'Validation Error',
            description: 'Please enter a valid US phone number (10 digits)',
            variant: 'destructive',
          });
          setSubmittingApplication(false);
          return;
        }
      }

      // Validate SSN format if provided
      if (formData.ssn && formData.ssn.trim()) {
        const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
        if (!ssnRegex.test(formData.ssn)) {
          toast({
            title: 'Validation Error',
            description: 'SSN must be in format XXX-XX-XXXX (e.g., 123-45-6789)',
            variant: 'destructive',
          });
          setSubmittingApplication(false);
          return;
        }
      }

      const payload: any = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: normalizedPhone,
        street_address: formData.street_address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        ssn: formData.ssn || null,
        dl_number: formData.dl_number || null,
        credit_score: formData.credit_score ? parseInt(formData.credit_score) : null,
        preferred_lender_id: formData.preferred_lender_id || null,
        notes: formData.notes || null,
      };

      await financeAPI.createCreditApplication(payload);

      toast({
        title: 'Success',
        description: 'Credit application submitted successfully',
      });

      // Reset form
      setFormData({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        street_address: '',
        city: '',
        state: '',
        zip_code: '',
        annual_income: '',
        employment_status: '',
        employer_name: '',
        years_employed: '',
        ssn: '',
        dl_number: '',
        credit_score: '',
        preferred_lender_id: '',
        down_payment: '',
        trade_in_value: '',
        notes: '',
      });
      setCurrentStep(1);
      setActiveTab('list');
      loadApplications();
      calculateStats();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit application',
        variant: 'destructive',
      });
    } finally {
      setSubmittingApplication(false);
    }
  };

  const handleUpdateStatus = async (appId: string, status: string) => {
    try {
      setUpdatingStatus(appId);
      await financeAPI.updateCreditApplicationStatus(appId, status);
      toast({
        title: 'Success',
        description: `Application status updated to ${status}`,
      });
      loadApplications();
      calculateStats();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleViewDetails = async (app: CreditApplication) => {
    try {
      setLoadingDetails(true);
      setSelectedApp(app);
      const response = await financeAPI.getCreditApplication(app.id);
      setAppDetails(response.data || response);
      setShowViewDialog(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load details',
        variant: 'destructive',
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleEdit = (app: CreditApplication) => {
    setEditingApp(app);
    setEditForm({
      customer_name: app.customer_name,
      customer_email: app.customer_email,
      customer_phone: app.customer_phone || '',
      credit_score: app.credit_score?.toString() || '',
      preferred_lender_id: app.preferred_lender_id || '',
      notes: app.notes || ''
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingApp) return;
    try {
      // Normalize phone number if provided
      let normalizedPhone = null;
      if (editForm.customer_phone && editForm.customer_phone.trim()) {
        const cleanPhone = editForm.customer_phone.replace(/\D/g, '');
        if (cleanPhone.length === 10 || (cleanPhone.length === 11 && cleanPhone[0] === '1')) {
          normalizedPhone = cleanPhone;
        } else {
          toast({
            title: 'Validation Error',
            description: 'Please enter a valid US phone number (10 digits)',
            variant: 'destructive',
          });
          return;
        }
      }

      await financeAPI.updateCreditApplication(editingApp.id, {
        customer_name: editForm.customer_name,
        customer_email: editForm.customer_email,
        customer_phone: normalizedPhone,
        credit_score: editForm.credit_score ? parseInt(editForm.credit_score) : null,
        preferred_lender_id: editForm.preferred_lender_id || null,
        notes: editForm.notes || null
      });

      toast({
        title: 'Success',
        description: 'Application updated successfully',
      });

      setShowEditDialog(false);
      loadApplications();
      calculateStats();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update application',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (app: CreditApplication) => {
    if (!confirm(`Are you sure you want to delete the application for ${app.customer_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await financeAPI.deleteCreditApplication(app.id);
      toast({
        title: 'Success',
        description: 'Application deleted successfully',
      });
      loadApplications();
      calculateStats();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete application',
        variant: 'destructive',
      });
    }
  };

  const formatMoneyField = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '';
    const n = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(n) ? String(n) : '';
  };

  const handleCreateDeal = async (app: CreditApplication) => {
    setSelectedApplication(app);

    const vehicleId = app.vehicle_id?.trim() || '';
    let priceStr = formatMoneyField(app.vehicle_purchase_price);
    if (!priceStr && vehicleId) {
      const v = vehicles.find((vh) => vh.id === vehicleId);
      if (v?.price != null && v.price !== '') {
        priceStr = formatMoneyField(v.price);
      }
    }

    const downStr = formatMoneyField(app.down_payment);
    const dealType: 'finance' | 'lease' = app.deal_type === 'lease' ? 'lease' : 'finance';
    const rawTerm = app.requested_term_months != null && app.requested_term_months !== ''
      ? String(app.requested_term_months)
      : '60';
    const termMonths = (DEAL_TERM_OPTIONS as readonly string[]).includes(rawTerm) ? rawTerm : '60';

    const msrpStr = formatMoneyField(app.vehicle_msrp) || (dealType === 'lease' ? priceStr : '');

    // Fetch dealer finance defaults (non-blocking — fall back to empty strings if unavailable)
    let finDefaults = {
      sales_tax_rate: '',
      title_fee: '',
      license_fee: '',
      registration_fee: '',
      inspection_fee: '',
      doc_fee: '',
    };
    try {
      const token = localStorage.getItem('auth_token');
      const fsRes = await fetch(buildApiUrl('daive/finance-settings'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fsRes.ok) {
        const fsData = await fsRes.json();
        if (fsData.success && fsData.data) {
          const d = fsData.data;
          finDefaults = {
            sales_tax_rate:   d.sales_tax_rate   != null ? String(d.sales_tax_rate)   : '',
            title_fee:        d.title_fee         != null ? String(d.title_fee)         : '',
            license_fee:      d.license_fee       != null ? String(d.license_fee)       : '',
            registration_fee: d.registration_fee  != null ? String(d.registration_fee)  : '',
            inspection_fee:   d.inspection_fee    != null ? String(d.inspection_fee)    : '',
            doc_fee:          d.doc_fee            != null ? String(d.doc_fee)            : '',
          };
        }
      }
    } catch { /* ignore — defaults are optional */ }

    setDealForm({
      vehicle_id: vehicleId,
      price: priceStr,
      down_payment: downStr,
      credit_score: app.credit_score != null ? String(app.credit_score) : '700',
      term_months: termMonths,
      deal_type: dealType,
      sales_tax_rate:   finDefaults.sales_tax_rate,
      title_fee:        finDefaults.title_fee,
      license_fee:      finDefaults.license_fee,
      registration_fee: finDefaults.registration_fee,
      inspection_fee:   finDefaults.inspection_fee,
      processing_fee:   finDefaults.doc_fee,
      trade_in_acv: '',
      trade_in_payoff: '',
      add_ons: '',
      protection_products: '',
      msrp: dealType === 'lease' ? msrpStr : '',
      cap_cost_reductions: '',
      capitalized_fees: '',
      tax_rate: '',
      annual_mileage: '',
      excess_mileage_rate: '0.25'
    });
    setShowCreateDealDialog(true);
  };

  const handleSubmitDeal = async () => {
    if (!dealForm.vehicle_id || !dealForm.price || !dealForm.credit_score || !dealForm.term_months) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreatingDeal(true);

      if (dealForm.deal_type === 'finance') {
        await financeAPI.createFinanceDeal({
          vehicle_id: dealForm.vehicle_id,
          price: parseFloat(dealForm.price),
          down_payment: parseFloat(dealForm.down_payment) || 0,
          credit_score: parseInt(dealForm.credit_score),
          term_months: parseInt(dealForm.term_months),
          application_id: selectedApplication?.id,
          // Government fees
          sales_tax_rate: dealForm.sales_tax_rate ? parseFloat(dealForm.sales_tax_rate) : undefined,
          title_fee: dealForm.title_fee ? parseFloat(dealForm.title_fee) : undefined,
          license_fee: dealForm.license_fee ? parseFloat(dealForm.license_fee) : undefined,
          registration_fee: dealForm.registration_fee ? parseFloat(dealForm.registration_fee) : undefined,
          inspection_fee: dealForm.inspection_fee ? parseFloat(dealForm.inspection_fee) : undefined,
          processing_fee: dealForm.processing_fee ? parseFloat(dealForm.processing_fee) : undefined,
          // Trade-in
          trade_in_acv: dealForm.trade_in_acv ? parseFloat(dealForm.trade_in_acv) : undefined,
          trade_in_payoff: dealForm.trade_in_payoff ? parseFloat(dealForm.trade_in_payoff) : undefined,
          // Other
          add_ons: dealForm.add_ons ? parseFloat(dealForm.add_ons) : undefined,
          protection_products: dealForm.protection_products ? parseFloat(dealForm.protection_products) : undefined
        });
      } else {
        await financeAPI.createLeaseDeal({
          vehicle_id: dealForm.vehicle_id,
          cap_cost: parseFloat(dealForm.price),
          credit_score: parseInt(dealForm.credit_score),
          term_months: parseInt(dealForm.term_months),
          application_id: selectedApplication?.id,
          msrp: dealForm.msrp ? parseFloat(dealForm.msrp) : undefined,
          cap_cost_reductions: dealForm.cap_cost_reductions ? parseFloat(dealForm.cap_cost_reductions) : 0,
          capitalized_fees: dealForm.capitalized_fees ? parseFloat(dealForm.capitalized_fees) : 0,
          tax_rate: dealForm.tax_rate ? parseFloat(dealForm.tax_rate) : 0,
          annual_mileage: dealForm.annual_mileage ? parseInt(dealForm.annual_mileage) : undefined,
          excess_mileage_rate: dealForm.excess_mileage_rate ? parseFloat(dealForm.excess_mileage_rate) : 0.25,
        });
      }

      toast({
        title: 'Success',
        description: `${dealForm.deal_type === 'finance' ? 'Finance' : 'Lease'} deal created successfully!`,
      });

      setShowCreateDealDialog(false);
      setSelectedApplication(null);
      setDealForm({
        vehicle_id: '',
        price: '',
        down_payment: '',
        credit_score: '',
        term_months: '60',
        deal_type: 'finance',
        sales_tax_rate: '',
        title_fee: '',
        license_fee: '',
        registration_fee: '',
        inspection_fee: '',
        processing_fee: '',
        trade_in_acv: '',
        trade_in_payoff: '',
        add_ons: '',
        protection_products: '',
        msrp: '',
        cap_cost_reductions: '',
        capitalized_fees: '',
        tax_rate: '',
        annual_mileage: '',
        excess_mileage_rate: '0.25'
      });

      navigate('/finance'); // Navigate to the main finance deals page
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create deal',
        variant: 'destructive',
      });
    } finally {
      setCreatingDeal(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const response = await vehiclesAPI.getAll({ limit: 100 });
      setVehicles(response.data || []);
    } catch (error: any) {
      console.error('Error loading vehicles:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const cls =
      status === 'approved'  ? 'bg-emerald-100 text-emerald-700' :
      status === 'rejected'  ? 'bg-red-100 text-red-700'         :
      status === 'reviewing' ? 'bg-blue-100 text-blue-700'       :
      status === 'pending'   ? 'bg-orange-100 text-orange-700'   :
                               'bg-gray-100 text-gray-600';
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{status?.replace(/_/g, ' ')}</span>;
  };

  const getStepProgress = () => {
    return ((currentStep - 1) / 3) * 100;
  };

  /** Shared action buttons for desktop table vs mobile card (icon + title on card) */
  const renderApplicationActions = (app: CreditApplication, variant: 'table' | 'card' = 'table') => {
    const card = variant === 'card';
    return (
      <div className={card ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap items-center gap-2'}>
        {['pending', 'reviewing'].includes(app.application_status) && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateStatus(app.id, 'approved')}
              disabled={updatingStatus === app.id}
              className={card ? 'h-9 w-9 shrink-0 p-0 text-green-600 hover:text-green-700' : 'text-green-600 hover:text-green-700'}
              title="Approve"
            >
              <Check className="h-4 w-4" />
              {!card && <span className="ml-1">Approve</span>}
            </Button>
            {app.application_status === 'pending' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateStatus(app.id, 'reviewing')}
                disabled={updatingStatus === app.id}
                className={card ? 'h-9 w-9 shrink-0 p-0 text-primary hover:text-primary/90' : 'text-primary hover:text-primary/90'}
                title="Mark reviewing"
              >
                <Clock className="h-4 w-4" />
                {!card && <span className="ml-1">Review</span>}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateStatus(app.id, 'rejected')}
              disabled={updatingStatus === app.id}
              className={card ? 'h-9 w-9 shrink-0 p-0 text-red-600 hover:text-red-700' : 'text-red-600 hover:text-red-700'}
              title="Reject"
            >
              <X className="h-4 w-4" />
              {!card && <span className="ml-1">Reject</span>}
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEdit(app)}
          title="Edit application"
          className={card ? 'h-9 w-9 shrink-0 p-0' : undefined}
        >
          <Edit className="h-4 w-4" />
        </Button>
        {(app.application_status === 'approved' || app.application_status === 'pending') && (
          <Button
            variant="default"
            size="sm"
            onClick={() => handleCreateDeal(app)}
            title="Create finance deal"
            className={card ? 'shrink-0 text-xs' : undefined}
          >
            <Calculator className={card ? 'h-4 w-4' : 'h-3 w-3 mr-1'} />
            {card ? <span className="ml-1">Deal</span> : <span>Create Deal</span>}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewDetails(app)}
          title="View details"
          className={card ? 'h-9 w-9 shrink-0 p-0' : undefined}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(app)}
          title="Delete application"
          className={`text-red-600 hover:bg-red-50 hover:text-red-700 ${card ? 'h-9 w-9 shrink-0 p-0' : ''}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
          <Button variant="ghost" size="sm" onClick={() => navigate('/finance')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <FileText className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="font-bold text-base text-gray-900">Credit Applications</h1>
            <p className="text-xs text-gray-500">Manage applications and track approval workflow</p>
          </div>
        </div>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5" onClick={() => setActiveTab('new')}>
          <Plus className="h-4 w-4" />New Application
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Applications', value: stats.total,                         color: 'text-gray-900',    bg: 'bg-orange-50', icon: '📋' },
            { label: 'Approval Rate',      value: `${stats.approvalRate.toFixed(1)}%`, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '✅' },
            { label: 'Pending Review',     value: stats.pending,                       color: 'text-orange-600',  bg: 'bg-orange-50', icon: '⏳' },
            { label: 'Avg Processing',     value: `${stats.avgProcessingTime.toFixed(1)}d`, color: 'text-blue-600', bg: 'bg-blue-50', icon: '📅' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="overflow-x-auto">
            <TabsList className="bg-white border shadow-sm rounded-xl p-1 h-auto gap-1 inline-flex min-w-max">
              <TabsTrigger value="list" className="gap-1.5 px-4 py-2 text-sm rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm font-medium">
                <Users className="h-4 w-4" />Applications
              </TabsTrigger>
              <TabsTrigger value="new" className="gap-1.5 px-4 py-2 text-sm rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm font-medium">
                <Plus className="h-4 w-4" />New
              </TabsTrigger>
              <TabsTrigger value="stats" className="gap-1.5 px-4 py-2 text-sm rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm font-medium">
                <TrendingUp className="h-4 w-4" />Statistics
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Applications List Tab */}
          <TabsContent value="list" className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">All Credit Applications</p>
                <Button variant="outline" size="sm" className="border-orange-200 text-orange-600 hover:bg-orange-50 gap-1.5">
                  <Download className="h-3.5 w-3.5" />Export
                </Button>
              </div>
              <div className="p-4 space-y-4">
                {/* Filters */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="w-full min-w-0 pl-10"
                    />
                  </div>
                  
                  <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? "" : v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="reviewing">Reviewing</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={filters.lender || "all"} onValueChange={(v) => setFilters({ ...filters, lender: v === "all" ? "" : v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Lenders" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Lenders</SelectItem>
                      {lenders.map((lender) => (
                        <SelectItem key={lender.id} value={lender.id}>
                          {lender.lender_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    type="date"
                    placeholder="From Date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full min-w-0"
                  />
                  
                  <Input
                    type="date"
                    placeholder="To Date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full min-w-0"
                  />
                </div>

                {loading && (
                  <div className="text-center py-8 text-sm text-gray-400">Loading…</div>
                )}
                {!loading && applications.length === 0 && (
                  <div className="text-center py-8 text-sm text-gray-400">No applications found</div>
                )}
              </div>

              {/* Mobile cards */}
              {!loading && applications.length > 0 && (
                <ul className="divide-y divide-gray-50 md:hidden">
                  {applications.map((app) => (
                    <li key={app.id} className="p-4 hover:bg-orange-50/30 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{app.customer_name}</p>
                          <a href={`mailto:${app.customer_email}`} className="text-xs text-orange-600 hover:underline">{app.customer_email}</a>
                          {app.customer_phone && <p className="text-xs text-gray-400 mt-0.5">{app.customer_phone}</p>}
                        </div>
                        {getStatusBadge(app.application_status)}
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mt-2 mb-3">
                        <dt className="text-gray-400">Credit Score</dt>
                        <dd className="text-right">
                          {app.credit_score ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${app.credit_score >= 700 ? 'bg-emerald-100 text-emerald-700' : app.credit_score >= 600 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{app.credit_score}</span>
                          ) : <span className="text-gray-400">—</span>}
                        </dd>
                        <dt className="text-gray-400">Lender</dt>
                        <dd className="text-right text-gray-700 text-[11px]">
                          {app.approved_lender_name ? `✓ ${app.approved_lender_name}` : app.preferred_lender_name ? app.preferred_lender_name : '—'}
                        </dd>
                        <dt className="text-gray-400">Submitted</dt>
                        <dd className="text-right text-gray-500">{new Date(app.submitted_at).toLocaleDateString()}</dd>
                      </dl>
                      <div className="border-t border-gray-100 pt-3">{renderApplicationActions(app, 'card')}</div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Desktop table */}
              {!loading && applications.length > 0 && (
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Customer', 'Contact', 'Credit Score', 'Status', 'Lender', 'Submitted', ''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {applications.map((app) => (
                        <tr key={app.id} className="hover:bg-orange-50/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900 max-w-[10rem]">
                            <span className="line-clamp-2">{app.customer_name}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[12rem]">
                            <div className="text-xs text-orange-600">{app.customer_email}</div>
                            {app.customer_phone && <div className="text-xs text-gray-400 mt-0.5">{app.customer_phone}</div>}
                          </td>
                          <td className="px-4 py-3">
                            {app.credit_score ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${app.credit_score >= 700 ? 'bg-emerald-100 text-emerald-700' : app.credit_score >= 600 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{app.credit_score}</span>
                            ) : <span className="text-xs text-gray-400">N/A</span>}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(app.application_status)}</td>
                          <td className="px-4 py-3 max-w-[8rem]">
                            {app.approved_lender_name ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-700">✓ {app.approved_lender_name}</span>
                            ) : app.preferred_lender_name ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-orange-100 text-orange-700 line-clamp-2">{app.preferred_lender_name}</span>
                            ) : <span className="text-xs text-gray-400">No lender</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(app.submitted_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-right">{renderApplicationActions(app, 'table')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* New Application Tab */}
          <TabsContent value="new" className="space-y-4">
            <Card>
              <CardHeader className="space-y-2 p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">New Credit Application</CardTitle>
                <CardDescription>Multi-step application wizard</CardDescription>
                <Progress value={getStepProgress()} className="mt-3" />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground sm:text-sm">
                  <span>Step {currentStep} of 4</span>
                  <span>{getStepProgress().toFixed(0)}% Complete</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
                {/* Step 1: Personal Info */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Personal Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="customer_name">Full Name *</Label>
                        <Input
                          id="customer_name"
                          value={formData.customer_name}
                          onChange={(e) =>
                            setFormData({ ...formData, customer_name: e.target.value })
                          }
                          placeholder="John Doe"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="customer_email">Email *</Label>
                        <Input
                          id="customer_email"
                          type="email"
                          value={formData.customer_email}
                          onChange={(e) =>
                            setFormData({ ...formData, customer_email: e.target.value })
                          }
                          placeholder="john@example.com"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="customer_phone">Phone</Label>
                        <Input
                          id="customer_phone"
                          type="tel"
                          value={formData.customer_phone}
                          onChange={(e) =>
                            setFormData({ ...formData, customer_phone: e.target.value })
                          }
                          placeholder="5551234567 or (555) 123-4567"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          US phone number (10 digits)
                        </p>
                      </div>
                    </div>

                    {/* Address Fields */}
                    <div className="space-y-4 mt-6">
                      <h4 className="font-medium text-base">Address</h4>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="street_address">Street Address</Label>
                          <Input
                            id="street_address"
                            value={formData.street_address}
                            onChange={(e) =>
                              setFormData({ ...formData, street_address: e.target.value })
                            }
                            placeholder="123 Main Street"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) =>
                              setFormData({ ...formData, city: e.target.value })
                            }
                            placeholder="Los Angeles"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            value={formData.state}
                            onChange={(e) =>
                              setFormData({ ...formData, state: e.target.value.toUpperCase() })
                            }
                            placeholder="CA"
                            maxLength={2}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            2-letter code
                          </p>
                        </div>
                        
                        <div>
                          <Label htmlFor="zip_code">ZIP Code</Label>
                          <Input
                            id="zip_code"
                            value={formData.zip_code}
                            onChange={(e) =>
                              setFormData({ ...formData, zip_code: e.target.value })
                            }
                            placeholder="90001"
                            maxLength={10}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Financial Info */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Financial Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="annual_income">Annual Income</Label>
                        <Input
                          id="annual_income"
                          type="number"
                          value={formData.annual_income}
                          onChange={(e) =>
                            setFormData({ ...formData, annual_income: e.target.value })
                          }
                          placeholder="50000"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="employment_status">Employment Status</Label>
                        <Select
                          value={formData.employment_status}
                          onValueChange={(v) =>
                            setFormData({ ...formData, employment_status: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employed">Employed</SelectItem>
                            <SelectItem value="self-employed">Self-Employed</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="employer_name">Employer Name</Label>
                        <Input
                          id="employer_name"
                          value={formData.employer_name}
                          onChange={(e) =>
                            setFormData({ ...formData, employer_name: e.target.value })
                          }
                          placeholder="Company Name"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="years_employed">Years Employed</Label>
                        <Input
                          id="years_employed"
                          type="number"
                          value={formData.years_employed}
                          onChange={(e) =>
                            setFormData({ ...formData, years_employed: e.target.value })
                          }
                          placeholder="5"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Credit Info */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Credit Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ssn">Social Security Number</Label>
                        <Input
                          id="ssn"
                          type="password"
                          value={formData.ssn}
                          onChange={(e) =>
                            setFormData({ ...formData, ssn: e.target.value })
                          }
                          placeholder="123-45-6789"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Format: XXX-XX-XXXX • Encrypted and stored securely
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="dl_number">Driver's License Number (Optional)</Label>
                        <Input
                          id="dl_number"
                          value={formData.dl_number}
                          onChange={(e) =>
                            setFormData({ ...formData, dl_number: e.target.value })
                          }
                          placeholder="DL123456"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="credit_score">Credit Score (if known)</Label>
                        <Input
                          id="credit_score"
                          type="number"
                          value={formData.credit_score}
                          onChange={(e) =>
                            setFormData({ ...formData, credit_score: e.target.value })
                          }
                          placeholder="700"
                          min="300"
                          max="850"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Preferences */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Preferences & Notes</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="preferred_lender_id">Preferred Lender</Label>
                        <Select
                          value={formData.preferred_lender_id || "none"}
                          onValueChange={(v) =>
                            setFormData({ ...formData, preferred_lender_id: v === "none" ? "" : v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select lender (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Preference</SelectItem>
                            {lenders.map((lender) => (
                              <SelectItem key={lender.id} value={lender.id}>
                                {lender.lender_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="down_payment">Down Payment</Label>
                        <Input
                          id="down_payment"
                          type="number"
                          value={formData.down_payment}
                          onChange={(e) =>
                            setFormData({ ...formData, down_payment: e.target.value })
                          }
                          placeholder="5000"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="trade_in_value">Trade-In Value</Label>
                        <Input
                          id="trade_in_value"
                          type="number"
                          value={formData.trade_in_value}
                          onChange={(e) =>
                            setFormData({ ...formData, trade_in_value: e.target.value })
                          }
                          placeholder="8000"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="notes">Additional Notes</Label>
                      <textarea
                        id="notes"
                        className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        placeholder="Any additional information..."
                      />
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                    disabled={currentStep === 1}
                  >
                    Previous
                  </Button>
                  
                  {currentStep < 4 ? (
                    <Button className="w-full sm:w-auto" onClick={() => setCurrentStep(currentStep + 1)}>
                      Next
                    </Button>
                  ) : (
                    <Button 
                      className="w-full sm:w-auto"
                      onClick={handleSubmitApplication}
                      disabled={submittingApplication}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {submittingApplication ? 'Submitting...' : 'Submit Application'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-4">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Application Statistics</CardTitle>
                <CardDescription>Overview of application metrics and trends</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Status Breakdown */}
                  <div>
                    <h3 className="font-semibold mb-4">Status Breakdown</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-orange-600" />
                          <span>Pending</span>
                        </div>
                        <Badge variant="secondary">{stats.pending}</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>Approved</span>
                        </div>
                        <Badge variant="default">{stats.approved}</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span>Rejected</span>
                        </div>
                        <Badge variant="destructive">{stats.rejected}</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <span>Reviewing</span>
                        </div>
                        <Badge variant="outline">{stats.reviewing}</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div>
                    <h3 className="font-semibold mb-4">Performance Metrics</h3>
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">
                          Approval Rate
                        </div>
                        <div className="text-3xl font-bold text-green-600">
                          {stats.approvalRate.toFixed(1)}%
                        </div>
                        <Progress value={stats.approvalRate} className="mt-2" />
                      </div>
                      
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">
                          Average Processing Time
                        </div>
                        <div className="text-3xl font-bold">
                          {stats.avgProcessingTime.toFixed(1)} days
                        </div>
                      </div>
                      
                      <div className="p-4 border rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">
                          Total Applications
                        </div>
                        <div className="text-3xl font-bold">{stats.total}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View Details Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-h-[min(90dvh,900px)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Application Details</DialogTitle>
            </DialogHeader>
            {loadingDetails ? (
              <div className="text-center py-8">Loading...</div>
            ) : appDetails ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Customer Name</Label>
                    <p className="font-medium">{appDetails.customer_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{appDetails.customer_email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{appDetails.customer_phone || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Credit Score</Label>
                    <p className="font-medium">
                      {appDetails.credit_score ? (
                        <Badge
                          variant={
                            appDetails.credit_score >= 700
                              ? 'default'
                              : appDetails.credit_score >= 600
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {appDetails.credit_score}
                        </Badge>
                      ) : (
                        'N/A'
                      )}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p>{getStatusBadge(appDetails.application_status)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Submitted</Label>
                    <p className="font-medium">
                      {new Date(appDetails.submitted_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {appDetails.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="font-medium mt-1">{appDetails.notes}</p>
                  </div>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Edit Application Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-h-[min(90dvh,900px)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Edit Credit Application</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 sm:py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit_customer_name">Customer Name *</Label>
                  <Input
                    id="edit_customer_name"
                    value={editForm.customer_name}
                    onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_customer_email">Email *</Label>
                  <Input
                    id="edit_customer_email"
                    type="email"
                    value={editForm.customer_email}
                    onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit_customer_phone">Phone</Label>
                  <Input
                    id="edit_customer_phone"
                    value={editForm.customer_phone}
                    onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_credit_score">Credit Score</Label>
                  <Input
                    id="edit_credit_score"
                    type="number"
                    value={editForm.credit_score}
                    onChange={(e) => setEditForm({ ...editForm, credit_score: e.target.value })}
                    placeholder="700"
                    min="300"
                    max="850"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit_preferred_lender">Preferred Lender</Label>
                <Select
                  value={editForm.preferred_lender_id || 'none'}
                  onValueChange={(value) => setEditForm({ ...editForm, preferred_lender_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a lender (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Lender</SelectItem>
                    {lenders.map((lender) => (
                      <SelectItem key={lender.id} value={lender.id}>
                        {lender.lender_name} ({lender.lender_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the lender you want to process this application
                </p>
              </div>

              <div>
                <Label htmlFor="edit_notes">Notes</Label>
                <textarea
                  id="edit_notes"
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Add any notes about this application..."
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={handleSaveEdit}
                  disabled={!editForm.customer_name || !editForm.customer_email}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Deal Dialog */}
        <Dialog open={showCreateDealDialog} onOpenChange={setShowCreateDealDialog}>
          <DialogContent className="max-h-[min(92dvh,920px)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Create {dealForm.deal_type === 'finance' ? 'Finance' : 'Lease'} Deal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 sm:py-4">
              {selectedApplication && (
                <div className="p-3 bg-primary/10 rounded-lg space-y-1">
                  <p className="text-sm font-medium">Customer: {selectedApplication.customer_name}</p>
                  <p className="text-sm text-muted-foreground">Credit Score: {selectedApplication.credit_score || 'N/A'}</p>
                  {(getApplicationVehicleLabel(selectedApplication) || selectedApplication.vehicle_id) && (
                    <p className="text-sm border-t border-primary/20 pt-2 mt-2 text-muted-foreground">
                      <span className="font-medium text-foreground">Vehicle (application / chat):</span>{' '}
                      {getApplicationVehicleLabel(selectedApplication) || 'Linked vehicle'}
                      {formatMoneyField(selectedApplication.vehicle_purchase_price) ? (
                        <span className="text-foreground">
                          {' '}
                          — $
                          {Number(formatMoneyField(selectedApplication.vehicle_purchase_price)).toLocaleString()}
                        </span>
                      ) : null}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label>Deal Type</Label>
                  <Select
                    value={dealForm.deal_type}
                    onValueChange={(v: 'finance' | 'lease') => setDealForm({ ...dealForm, deal_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="lease">Lease</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="vehicle_id">Vehicle *</Label>
                  <Select
                    value={dealForm.vehicle_id}
                    onValueChange={(v) => {
                      const vehicle = vehicles.find((vh) => vh.id === v);
                      let priceStr = '';
                      if (vehicle?.price != null && vehicle.price !== '') {
                        priceStr = String(vehicle.price);
                      } else if (selectedApplication?.vehicle_id === v) {
                        priceStr =
                          formatMoneyField(selectedApplication.vehicle_purchase_price) || dealForm.price;
                      }
                      setDealForm({
                        ...dealForm,
                        vehicle_id: v,
                        price: priceStr,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {dealForm.vehicle_id &&
                        selectedApplication &&
                        !vehicles.some((vh) => vh.id === dealForm.vehicle_id) && (
                          <SelectItem value={dealForm.vehicle_id}>
                            {getApplicationVehicleLabel(selectedApplication) || 'Vehicle from chat'}
                            {dealForm.price
                              ? ` — $${Number(dealForm.price).toLocaleString()}`
                              : ''}
                          </SelectItem>
                        )}
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.year} {vehicle.make} {vehicle.model} - ${vehicle.price?.toLocaleString() || 'N/A'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="price">{dealForm.deal_type === 'finance' ? 'Vehicle Price' : 'Capitalized Cost'} *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={dealForm.price}
                      onChange={(e) => setDealForm({ ...dealForm, price: e.target.value })}
                      placeholder="30000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="down_payment">Down Payment</Label>
                    <Input
                      id="down_payment"
                      type="number"
                      value={dealForm.down_payment}
                      onChange={(e) => setDealForm({ ...dealForm, down_payment: e.target.value })}
                      placeholder="5000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="credit_score">Credit Score *</Label>
                    <Input
                      id="credit_score"
                      type="number"
                      value={dealForm.credit_score}
                      onChange={(e) => setDealForm({ ...dealForm, credit_score: e.target.value })}
                      placeholder="720"
                      min="300"
                      max="850"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="term_months">Term (Months) *</Label>
                    <Select
                      value={dealForm.term_months}
                      onValueChange={(v) => setDealForm({ ...dealForm, term_months: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24 months</SelectItem>
                        <SelectItem value="36">36 months</SelectItem>
                        <SelectItem value="48">48 months</SelectItem>
                        <SelectItem value="60">60 months</SelectItem>
                        <SelectItem value="72">72 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Additional Options - Collapsible Sections */}
                <Accordion type="multiple" className="w-full">
                  {/* Government Fees (TTL) */}
                  <AccordionItem value="government-fees">
                    <AccordionTrigger className="text-sm font-medium">
                      Government Fees (Tax, Title, License) - Optional
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="sales_tax_rate">Sales Tax Rate (e.g., 0.065 for 6.5%)</Label>
                            <Input
                              id="sales_tax_rate"
                              type="number"
                              step="0.0001"
                              value={dealForm.sales_tax_rate}
                              onChange={(e) => setDealForm({ ...dealForm, sales_tax_rate: e.target.value })}
                              placeholder="0.065"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Goes to State Comptroller</p>
                          </div>
                          <div>
                            <Label htmlFor="title_fee">Title Fee</Label>
                            <Input
                              id="title_fee"
                              type="number"
                              value={dealForm.title_fee}
                              onChange={(e) => setDealForm({ ...dealForm, title_fee: e.target.value })}
                              placeholder="150"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Goes to DMV</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="license_fee">License Fee</Label>
                            <Input
                              id="license_fee"
                              type="number"
                              value={dealForm.license_fee}
                              onChange={(e) => setDealForm({ ...dealForm, license_fee: e.target.value })}
                              placeholder="50"
                            />
                          </div>
                          <div>
                            <Label htmlFor="registration_fee">Registration Fee</Label>
                            <Input
                              id="registration_fee"
                              type="number"
                              value={dealForm.registration_fee}
                              onChange={(e) => setDealForm({ ...dealForm, registration_fee: e.target.value })}
                              placeholder="200"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="inspection_fee">Inspection Fee</Label>
                            <Input
                              id="inspection_fee"
                              type="number"
                              value={dealForm.inspection_fee}
                              onChange={(e) => setDealForm({ ...dealForm, inspection_fee: e.target.value })}
                              placeholder="25"
                            />
                          </div>
                          <div>
                            <Label htmlFor="processing_fee">Processing/Doc Fee</Label>
                            <Input
                              id="processing_fee"
                              type="number"
                              value={dealForm.processing_fee}
                              onChange={(e) => setDealForm({ ...dealForm, processing_fee: e.target.value })}
                              placeholder="500"
                            />
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Trade-In */}
                  <AccordionItem value="trade-in">
                    <AccordionTrigger className="text-sm font-medium">
                      Trade-In - Optional
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="trade_in_acv">Actual Cash Value (ACV)</Label>
                            <Input
                              id="trade_in_acv"
                              type="number"
                              value={dealForm.trade_in_acv}
                              onChange={(e) => setDealForm({ ...dealForm, trade_in_acv: e.target.value })}
                              placeholder="15000"
                            />
                            <p className="text-xs text-muted-foreground mt-1">What dealer gives for trade-in</p>
                          </div>
                          <div>
                            <Label htmlFor="trade_in_payoff">Payoff Amount</Label>
                            <Input
                              id="trade_in_payoff"
                              type="number"
                              value={dealForm.trade_in_payoff}
                              onChange={(e) => setDealForm({ ...dealForm, trade_in_payoff: e.target.value })}
                              placeholder="12000"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Amount customer still owes</p>
                          </div>
                        </div>
                        {dealForm.trade_in_acv && dealForm.trade_in_payoff && (
                          <div className="p-3 bg-muted rounded-md">
                            <p className="text-sm">
                              <strong>Net Trade-In Credit:</strong> ${(parseFloat(dealForm.trade_in_acv || '0') - parseFloat(dealForm.trade_in_payoff || '0')).toLocaleString()}
                            </p>
                            {parseFloat(dealForm.trade_in_payoff || '0') > parseFloat(dealForm.trade_in_acv || '0') && (
                              <p className="text-sm text-destructive mt-1">
                                <strong>Negative Equity:</strong> ${(parseFloat(dealForm.trade_in_payoff || '0') - parseFloat(dealForm.trade_in_acv || '0')).toLocaleString()} (will be added to amount financed)
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Add-Ons & Protection Products */}
                  <AccordionItem value="addons">
                    <AccordionTrigger className="text-sm font-medium">
                      Add-Ons & Protection Products - Optional
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="add_ons">Add-Ons/Accessories Total</Label>
                            <Input
                              id="add_ons"
                              type="number"
                              value={dealForm.add_ons}
                              onChange={(e) => setDealForm({ ...dealForm, add_ons: e.target.value })}
                              placeholder="500"
                            />
                            <p className="text-xs text-muted-foreground mt-1">Accessories, add-ons, etc.</p>
                          </div>
                          <div>
                            <Label htmlFor="protection_products">Protection Products Total</Label>
                            <Input
                              id="protection_products"
                              type="number"
                              value={dealForm.protection_products}
                              onChange={(e) => setDealForm({ ...dealForm, protection_products: e.target.value })}
                              placeholder="1500"
                            />
                            <p className="text-xs text-muted-foreground mt-1">GAP, VSC, Appearance, etc.</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          💡 Tip: You can add individual protection products after creating the deal
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Lease-specific fields */}
                {dealForm.deal_type === 'lease' && (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="msrp">MSRP (Manufacturer Suggested Retail Price)</Label>
                        <Input
                          id="msrp"
                          type="number"
                          value={dealForm.msrp}
                          onChange={(e) => setDealForm({ ...dealForm, msrp: e.target.value })}
                          placeholder="40000"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Used for residual value calculation</p>
                      </div>
                      <div>
                        <Label htmlFor="tax_rate">Tax Rate (e.g., 0.065 for 6.5%)</Label>
                        <Input
                          id="tax_rate"
                          type="number"
                          step="0.0001"
                          value={dealForm.tax_rate}
                          onChange={(e) => setDealForm({ ...dealForm, tax_rate: e.target.value })}
                          placeholder="0.065"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="cap_cost_reductions">Cap Cost Reductions</Label>
                        <Input
                          id="cap_cost_reductions"
                          type="number"
                          value={dealForm.cap_cost_reductions}
                          onChange={(e) => setDealForm({ ...dealForm, cap_cost_reductions: e.target.value })}
                          placeholder="2000"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Down payment, trade-in, rebates</p>
                      </div>
                      <div>
                        <Label htmlFor="capitalized_fees">Capitalized Fees</Label>
                        <Input
                          id="capitalized_fees"
                          type="number"
                          value={dealForm.capitalized_fees}
                          onChange={(e) => setDealForm({ ...dealForm, capitalized_fees: e.target.value })}
                          placeholder="595"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Acquisition fee, etc.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="annual_mileage">Annual Mileage Allowance</Label>
                        <Input
                          id="annual_mileage"
                          type="number"
                          value={dealForm.annual_mileage}
                          onChange={(e) => setDealForm({ ...dealForm, annual_mileage: e.target.value })}
                          placeholder="12000"
                        />
                      </div>
                      <div>
                        <Label htmlFor="excess_mileage_rate">Excess Mileage Rate (per mile)</Label>
                        <Input
                          id="excess_mileage_rate"
                          type="number"
                          step="0.01"
                          value={dealForm.excess_mileage_rate}
                          onChange={(e) => setDealForm({ ...dealForm, excess_mileage_rate: e.target.value })}
                          placeholder="0.25"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setShowCreateDealDialog(false);
                      setSelectedApplication(null);
                      setDealForm({
                        vehicle_id: '',
                        price: '',
                        down_payment: '',
                        credit_score: '',
                        term_months: '60',
                        deal_type: 'finance',
                        sales_tax_rate: '',
                        title_fee: '',
                        license_fee: '',
                        registration_fee: '',
                        inspection_fee: '',
                        processing_fee: '',
                        trade_in_acv: '',
                        trade_in_payoff: '',
                        add_ons: '',
                        protection_products: '',
                        msrp: '',
                        cap_cost_reductions: '',
                        capitalized_fees: '',
                        tax_rate: '',
                        annual_mileage: '',
                        excess_mileage_rate: '0.25'
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={handleSubmitDeal}
                    disabled={creatingDeal}
                  >
                    {creatingDeal ? 'Creating...' : 'Create Deal'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>{/* end flex-1 */}
    </div>
  );
};

export default CreditApplications;


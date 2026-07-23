/**
 * Finance & Lease Management Page
 * Manage finance programs, deals, and credit applications
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { financeAPI, lendersAPI } from '@/lib/api';
import { API_BASE_URL, getBaseUrl, buildAssetUrl, BASE_URL , buildBackendAssetUrl } from '@/lib/config';

import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DollarSign, CreditCard, FileText, TrendingUp, Plus, Eye, Search, Filter, Check, X, Clock, Calculator, Edit, Send, PenTool, Download, CheckCircle, HelpCircle, ExternalLink } from 'lucide-react';
import { vehiclesAPI } from '@/lib/api';
import { FinanceHelpGuide } from '@/components/finance/FinanceHelpGuide';
import TopNavigation from '@/components/layout/TopNavigation';
import { statusBadge } from '@/lib/crmTheme';

interface FinanceProgram {
  id: string;
  program_name: string;
  type: 'finance' | 'lease';
  term_months: number;
  tier_min_score: number;
  tier_max_score: number;
  interest_rate?: number;
  money_factor?: number;
  residual_value_pct?: number;
  program_source: string;
  is_active: boolean;
  dealer_id?: string;
}

interface FinanceDeal {
  id: string;
  deal_type: 'finance' | 'lease';
  monthly_payment: number;
  down_payment: number;
  term_months: number;
  vehicle_price: number;
  total_amount: number;
  status: string;
  make?: string;
  model?: string;
  year?: number;
  apr?: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  latest_deal_sheet_id?: string;
  pdf_url?: string;
  signature_request_id?: string;
  signature_status?: string;
  created_at: string;
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
}

interface LenderSubmission {
  id: string;
  lender_id: string;
  lender_name: string;
  lender_type: string;
  submission_status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'countered' | 'withdrawn';
  submitted_at: string;
  responded_at?: string;
  submitted_by_name?: string;
  approved_amount?: number;
  approved_apr?: number;
  approved_term_months?: number;
  rejection_reason?: string;
  lender_reference_number?: string;
  notes?: string;
  counter_offer?: any;
}

const Finance = () => {
  const { user, loading: authLoading } = useAuth();
  const { canAccessFeature } = usePermissions();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'deals' | 'programs' | 'applications'>('deals');
  const [loading, setLoading] = useState(true);
  
  // Deals
  const [deals, setDeals] = useState<FinanceDeal[]>([]);
  const [dealFilters, setDealFilters] = useState({ status: '', deal_type: '' });
  
  // Programs
  const [programs, setPrograms] = useState<FinanceProgram[]>([]);
  const [programFilters, setProgramFilters] = useState({ type: '', is_active: '' });
  const [showProgramDialog, setShowProgramDialog] = useState(false);
  
  // Applications
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [applicationFilters, setApplicationFilters] = useState({ status: '' });
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [selectedAppForView, setSelectedAppForView] = useState<CreditApplication | null>(null);
  const [showAppViewDialog, setShowAppViewDialog] = useState(false);
  const [appDetails, setAppDetails] = useState<any>(null);
  const [loadingAppDetails, setLoadingAppDetails] = useState(false);
  const [showAppEditDialog, setShowAppEditDialog] = useState(false);
  const [editingApplication, setEditingApplication] = useState<CreditApplication | null>(null);
  const [appEditForm, setAppEditForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    credit_score: '',
    preferred_lender_id: '',
    notes: ''
  });
  const [lenders, setLenders] = useState<any[]>([]);
  
  // Deal actions
  const [showSubmitLenderDialog, setShowSubmitLenderDialog] = useState(false);
  const [selectedDealForAction, setSelectedDealForAction] = useState<FinanceDeal | null>(null);
  const [selectedLendersForSubmit, setSelectedLendersForSubmit] = useState<string[]>([]);
  const [submittingToLenders, setSubmittingToLenders] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [requestingSignature, setRequestingSignature] = useState(false);
  
  // Deal viewing and submissions
  const [showDealDetailsDialog, setShowDealDetailsDialog] = useState(false);
  const [selectedDealForView, setSelectedDealForView] = useState<FinanceDeal | null>(null);
  const [dealSubmissions, setDealSubmissions] = useState<LenderSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  
  // Deal editing
  const [showEditDealDialog, setShowEditDealDialog] = useState(false);
  const [editingDeal, setEditingDeal] = useState<FinanceDeal | null>(null);
  const [updatingDeal, setUpdatingDeal] = useState(false);
  const [editDealForm, setEditDealForm] = useState({
    vehicle_id: '',
    price: '',
    down_payment: '',
    credit_score: '',
    term_months: '60',
    deal_type: 'finance' as 'finance' | 'lease',
    // Lease-specific fields
    msrp: '',
    residual_percentage: '',
    money_factor: '',
    cap_cost_reductions: '',
    capitalized_fees: '',
    tax_rate: '',
    annual_mileage: '12000',
    excess_mileage_rate: '0.25',
    // Government fees (TTL)
    sales_tax_rate: '',
    title_fee: '',
    license_fee: '',
    registration_fee: '',
    inspection_fee: '',
    processing_fee: '',
    // Trade-in
    trade_in_acv: '',
    trade_in_payoff: '',
    // Add-ons
    add_ons: '',
    protection_products: ''
  });
  
  // Submission update
  const [showUpdateSubmissionDialog, setShowUpdateSubmissionDialog] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<LenderSubmission | null>(null);
  const [updatingSubmission, setUpdatingSubmission] = useState(false);
  const [submissionUpdateForm, setSubmissionUpdateForm] = useState({
    submission_status: '',
    approved_amount: '',
    approved_apr: '',
    approved_term_months: '',
    rejection_reason: '',
    lender_reference_number: ''
  });
  
  // Load lenders when dialog opens
  useEffect(() => {
    if ((showAppEditDialog || showSubmitLenderDialog) && lenders.length === 0) {
      loadLenders();
    }
  }, [showAppEditDialog, showSubmitLenderDialog]);
  
  const loadLenders = async () => {
    try {
      const response = await lendersAPI.getAll({ is_active: true });
      setLenders(response.data || []);
    } catch (error) {
      console.error('Error loading lenders:', error);
    }
  };
  
  // Generate PDF Deal Sheet
  const handleGeneratePDF = async (deal: FinanceDeal) => {
    try {
      setGeneratingPDF(true);
      const response = await fetch(`${API_BASE_URL}/finance/deals/${deal.id}/generate-sheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "PDF Generated",
          description: "Deal sheet PDF has been created successfully",
        });
        
        // Optionally download PDF
        if (result.data?.pdf_url) {
          window.open(buildBackendAssetUrl(result.data.pdf_url), '_blank');
        }
        
        loadData();
      } else {
        throw new Error(result.message || 'Failed to generate PDF');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate PDF deal sheet",
        variant: "destructive",
      });
    } finally {
      setGeneratingPDF(false);
    }
  };
  
  // Request E-Signature
  const handleRequestSignature = async (deal: FinanceDeal) => {
    try {
      setRequestingSignature(true);
      const response = await fetch(`${API_BASE_URL}/signatures/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          deal_id: deal.id,
          deal_sheet_id: deal.latest_deal_sheet_id,
          signer_name: deal.customer_name || 'Customer',
          // signer_email: deal.customer_email || '',
          signer_email: 'info@mitiesoft.com',
          signer_phone: deal.customer_phone,
          document_url: buildBackendAssetUrl(deal.pdf_url || ''),
          document_name: `Finance Agreement - ${deal.id}.pdf`,
          message: 'Please review and sign your finance agreement',
          expires_in_days: 7
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Signature Request Sent",
          description: `Email sent to ${deal.customer_email}`,
        });
        loadData();
      } else {
        throw new Error(result.message || 'Failed to send signature request');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send signature request",
        variant: "destructive",
      });
    } finally {
      setRequestingSignature(false);
    }
  };
  
  // Quick status update (for testing)
  const handleQuickStatusUpdate = async (dealId: string, newStatus: string) => {
    try {
      const result = await financeAPI.updateDealStatus(dealId, newStatus);
      
      if (result.success) {
        toast({
          title: "Status Updated",
          description: `Deal status changed to ${newStatus}`,
        });
        loadData();
      } else {
        throw new Error(result.error || result.message || 'Failed to update status');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update deal status",
        variant: "destructive",
      });
    }
  };
  
  // Load Deal Submissions
  const loadDealSubmissions = async (dealId: string) => {
    try {
      setLoadingSubmissions(true);
      const response = await lendersAPI.getDealSubmissions(dealId);
      setDealSubmissions(response.data || []);
    } catch (error: any) {
      console.error('Error loading submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load lender submissions",
        variant: "destructive",
      });
    } finally {
      setLoadingSubmissions(false);
    }
  };
  
  // Update Submission Status
  const handleUpdateSubmission = async () => {
    if (!selectedSubmission) return;
    
    try {
      setUpdatingSubmission(true);
      
      const updateData: any = {
        submission_status: submissionUpdateForm.submission_status
      };
      
      if (submissionUpdateForm.approved_amount) {
        updateData.approved_amount = parseFloat(submissionUpdateForm.approved_amount);
      }
      if (submissionUpdateForm.approved_apr) {
        updateData.approved_apr = parseFloat(submissionUpdateForm.approved_apr);
      }
      if (submissionUpdateForm.approved_term_months) {
        updateData.approved_term_months = parseInt(submissionUpdateForm.approved_term_months);
      }
      if (submissionUpdateForm.rejection_reason) {
        updateData.rejection_reason = submissionUpdateForm.rejection_reason;
      }
      if (submissionUpdateForm.lender_reference_number) {
        updateData.lender_reference_number = submissionUpdateForm.lender_reference_number;
      }
      
      const result = await lendersAPI.updateSubmission(selectedSubmission.id, updateData);
      
      if (result.success) {
        toast({
          title: "Submission Updated",
          description: "Lender submission status has been updated",
        });
        
        // Reload submissions
        if (selectedDealForView) {
          await loadDealSubmissions(selectedDealForView.id);
        }
        
        setShowUpdateSubmissionDialog(false);
        setSelectedSubmission(null);
        setSubmissionUpdateForm({
          submission_status: '',
          approved_amount: '',
          approved_apr: '',
          approved_term_months: '',
          rejection_reason: '',
          lender_reference_number: ''
        });
      } else {
        throw new Error(result.error || 'Failed to update submission');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update submission",
        variant: "destructive",
      });
    } finally {
      setUpdatingSubmission(false);
    }
  };
  
  // Handle Edit Deal
  const handleEditDeal = async () => {
    if (!editingDeal) return;
    
    try {
      setUpdatingDeal(true);
      
      // Build update data based on deal type
      const updateData: any = {
        down_payment: parseFloat(editDealForm.down_payment) || 0,
        term_months: parseInt(editDealForm.term_months)
      };
      
      if (editDealForm.deal_type === 'finance') {
        // Finance deal updates
        updateData.vehicle_price = parseFloat(editDealForm.price);
        
        // Optional fields
        if (editDealForm.sales_tax_rate) updateData.sales_tax_rate = parseFloat(editDealForm.sales_tax_rate);
        if (editDealForm.title_fee) updateData.title_fee = parseFloat(editDealForm.title_fee);
        if (editDealForm.license_fee) updateData.license_fee = parseFloat(editDealForm.license_fee);
        if (editDealForm.registration_fee) updateData.registration_fee = parseFloat(editDealForm.registration_fee);
        if (editDealForm.inspection_fee) updateData.inspection_fee = parseFloat(editDealForm.inspection_fee);
        if (editDealForm.processing_fee) updateData.processing_fee = parseFloat(editDealForm.processing_fee);
        if (editDealForm.trade_in_acv) updateData.trade_in_acv = parseFloat(editDealForm.trade_in_acv);
        if (editDealForm.trade_in_payoff) updateData.trade_in_payoff = parseFloat(editDealForm.trade_in_payoff);
        if (editDealForm.add_ons) updateData.add_ons = parseFloat(editDealForm.add_ons);
        if (editDealForm.protection_products) updateData.protection_products = parseFloat(editDealForm.protection_products);
      } else {
        // Lease deal updates
        updateData.cap_cost = parseFloat(editDealForm.price);
        
        if (editDealForm.msrp) updateData.msrp = parseFloat(editDealForm.msrp);
        if (editDealForm.cap_cost_reductions) updateData.cap_cost_reductions = parseFloat(editDealForm.cap_cost_reductions);
        if (editDealForm.capitalized_fees) updateData.capitalized_fees = parseFloat(editDealForm.capitalized_fees);
        if (editDealForm.tax_rate) updateData.tax_rate = parseFloat(editDealForm.tax_rate);
        if (editDealForm.annual_mileage) updateData.annual_mileage = parseInt(editDealForm.annual_mileage);
        if (editDealForm.excess_mileage_rate) updateData.excess_mileage_rate = parseFloat(editDealForm.excess_mileage_rate);
      }
      
      const result = await financeAPI.updateDeal(editingDeal.id, updateData);
      
      if (result.success) {
        toast({
          title: "Deal Updated",
          description: "Deal has been updated successfully",
        });
        
        setShowEditDealDialog(false);
        setEditingDeal(null);
        loadData();
      } else {
        throw new Error(result.error || result.message || 'Failed to update deal');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update deal",
        variant: "destructive",
      });
    } finally {
      setUpdatingDeal(false);
    }
  };
  
  // Submit to Lenders
  const handleSubmitToLenders = async () => {
    if (!selectedDealForAction || selectedLendersForSubmit.length === 0) {
      toast({
        title: "No Lenders Selected",
        description: "Please select at least one lender",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setSubmittingToLenders(true);
      let successCount = 0;
      let errorCount = 0;
      
      for (const lenderId of selectedLendersForSubmit) {
        try {
          await lendersAPI.submitDeal(lenderId, {
            deal_id: selectedDealForAction.id,
            submission_method: 'api',
            notes: 'Submitted from finance dashboard'
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to submit to lender ${lenderId}:`, error);
          errorCount++;
        }
      }
      
      toast({
        title: "Submission Complete",
        description: `Successfully submitted to ${successCount} lender(s)${errorCount > 0 ? `. ${errorCount} failed.` : ''}`,
        variant: errorCount > 0 ? "destructive" : "default",
      });
      
      setShowSubmitLenderDialog(false);
      setSelectedLendersForSubmit([]);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit to lenders",
        variant: "destructive",
      });
    } finally {
      setSubmittingToLenders(false);
    }
  };
  
  // Deal creation
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
    // Lease-specific fields
    msrp: '',
    residual_percentage: '',
    money_factor: '',
    cap_cost_reductions: '',
    capitalized_fees: '',
    tax_rate: '',
    annual_mileage: '12000',
    excess_mileage_rate: '0.25',
    // Government fees (TTL)
    sales_tax_rate: '',
    title_fee: '',
    license_fee: '',
    registration_fee: '',
    inspection_fee: '',
    processing_fee: '',
    // Trade-in
    trade_in_acv: '',
    trade_in_payoff: '',
    // Other
    add_ons: '',
    protection_products: ''
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
      if (activeTab === 'applications' || showCreateDealDialog) {
        loadVehicles();
      }
    }
  }, [user, activeTab, dealFilters, programFilters, applicationFilters, showCreateDealDialog]);
  
  const loadVehicles = async () => {
    try {
      const response = await vehiclesAPI.getAll({ limit: 100 });
      setVehicles(response.data || []);
    } catch (error: any) {
      console.error('Error loading vehicles:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'deals') {
        const response = await financeAPI.getDeals({
          ...(dealFilters.status && { status: dealFilters.status }),
          ...(dealFilters.deal_type && { deal_type: dealFilters.deal_type as 'finance' | 'lease' }),
        });
        setDeals(response.data || []);
      } else if (activeTab === 'programs') {
        const response = await financeAPI.getPrograms({
          ...(programFilters.type && { type: programFilters.type as 'finance' | 'lease' }),
          ...(programFilters.is_active !== '' && { is_active: programFilters.is_active === 'true' }),
        });
        setPrograms(response.data || []);
      } else if (activeTab === 'applications') {
        const response = await financeAPI.getCreditApplications({
          ...(applicationFilters.status && { status: applicationFilters.status }),
        });
        setApplications(response.data || []);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load finance data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => (
    <span className={statusBadge(status)}>{status?.replace(/_/g, ' ')}</span>
  );

  // Update application status
  const handleUpdateApplicationStatus = async (applicationId: string, newStatus: string) => {
    try {
      setUpdatingStatus(applicationId);
      await financeAPI.updateCreditApplicationStatus(applicationId, newStatus);
      toast({
        title: "Success",
        description: `Application status updated to ${newStatus}`,
      });
      loadData(); // Reload data
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update application status",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Create finance deal
  const handleCreateDeal = async () => {
    if (!dealForm.vehicle_id || !dealForm.price || !dealForm.credit_score || !dealForm.term_months) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreatingDeal(true);
      
      let newDealId: string | undefined;

      if (dealForm.deal_type === 'finance') {
        const res = await financeAPI.createFinanceDeal({
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
        newDealId = res?.data?.id || res?.id;
      } else {
        const res = await financeAPI.createLeaseDeal({
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
        newDealId = res?.data?.id || res?.id;
      }

      setShowCreateDealDialog(false);
      setSelectedApplication(null);
      setDealForm({
        vehicle_id: '',
        price: '',
        down_payment: '',
        credit_score: '',
        term_months: '60',
        deal_type: 'finance',
        msrp: '',
        residual_percentage: '',
        money_factor: '',
        cap_cost_reductions: '',
        capitalized_fees: '',
        tax_rate: '',
        annual_mileage: '12000',
        excess_mileage_rate: '0.25',
        sales_tax_rate: '',
        title_fee: '',
        license_fee: '',
        registration_fee: '',
        inspection_fee: '',
        processing_fee: '',
        trade_in_acv: '',
        trade_in_payoff: '',
        add_ons: '',
        protection_products: ''
      });

      if (newDealId) {
        navigate(`/finance/deal/${newDealId}`);
      } else {
        toast({ title: 'Deal created', description: 'Opening deals list…' });
        setActiveTab('deals');
        loadData();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create deal",
        variant: "destructive",
      });
    } finally {
      setCreatingDeal(false);
    }
  };

  const renderDealActions = (deal: FinanceDeal, variant: 'table' | 'card' = 'table') => (
    <div className={variant === 'card' ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap items-center gap-2'}>
      <Button
        variant="ghost"
        size="sm"
        className={variant === 'card' ? 'h-9 w-9 shrink-0 p-0' : undefined}
        onClick={() => {
          setSelectedDealForView(deal);
          loadDealSubmissions(deal.id);
          setShowDealDetailsDialog(true);
        }}
        title="View Deal Details & Submissions"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={variant === 'card' ? 'h-9 w-9 shrink-0 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50' : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'}
        onClick={() => navigate(`/finance/deal/${deal.id}`)}
        title="Open Deal Workspace"
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={variant === 'card' ? 'h-9 w-9 shrink-0 p-0' : undefined}
        onClick={() => {
          setEditingDeal(deal);
          setEditDealForm({
            vehicle_id: '',
            price: deal.vehicle_price?.toString() || '',
            down_payment: deal.down_payment?.toString() || '',
            credit_score: '',
            term_months: deal.term_months?.toString() || '60',
            deal_type: deal.deal_type,
            msrp: '',
            residual_percentage: '',
            money_factor: '',
            cap_cost_reductions: '',
            capitalized_fees: '',
            tax_rate: '',
            annual_mileage: '12000',
            excess_mileage_rate: '0.25',
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
          });
          setShowEditDealDialog(true);
        }}
        title="Edit Deal"
      >
        <Edit className="h-4 w-4" />
      </Button>
      {(deal.status === 'draft' || deal.status === 'pending') && (
        <>
          <Button
            variant="outline"
            size="sm"
            className={variant === 'card' ? 'text-xs' : undefined}
            onClick={() => {
              setSelectedDealForAction(deal);
              setSelectedLendersForSubmit([]);
              setShowSubmitLenderDialog(true);
            }}
            title="Submit to Lender"
          >
            <Send className="h-4 w-4 sm:mr-1" />
            {variant === 'card' ? <span className="ml-1">Submit</span> : <span>Submit</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleQuickStatusUpdate(deal.id, 'approved')}
            title="[TEST] Mark as Approved"
            className={`text-xs text-green-600 hover:text-green-700 ${variant === 'card' ? 'px-2' : ''}`}
          >
            ✓ {variant === 'card' ? 'OK' : 'Approve'}
          </Button>
        </>
      )}
      {deal.status === 'approved' && !deal.latest_deal_sheet_id && (
        <Button
          variant="outline"
          size="sm"
          className={variant === 'card' ? 'text-xs' : undefined}
          onClick={() => handleGeneratePDF(deal)}
          disabled={generatingPDF}
          title="Generate PDF Deal Sheet"
        >
          <FileText className="h-4 w-4 sm:mr-1" />
          {generatingPDF ? (variant === 'card' ? '…' : 'Generating...') : variant === 'card' ? 'PDF' : 'Generate PDF'}
        </Button>
      )}
      {deal.latest_deal_sheet_id && deal.pdf_url && (
        <Button
          variant="ghost"
          size="sm"
          className={variant === 'card' ? 'h-9 w-9 shrink-0 p-0' : undefined}
          onClick={() => window.open(buildBackendAssetUrl(deal.pdf_url), '_blank')}
          title="Download PDF"
        >
          <Download className="h-4 w-4" />
        </Button>
      )}
      {deal.latest_deal_sheet_id && !deal.signature_request_id && (
        <Button
          variant="default"
          size="sm"
          className={variant === 'card' ? 'text-xs' : undefined}
          onClick={() => handleRequestSignature(deal)}
          disabled={requestingSignature}
          title="Request E-Signature"
        >
          <PenTool className="h-4 w-4 sm:mr-1" />
          {requestingSignature ? (variant === 'card' ? '…' : 'Sending...') : variant === 'card' ? 'Sign' : 'Request Signature'}
        </Button>
      )}
      {deal.signature_request_id && (
        <Badge variant={deal.signature_status === 'signed' ? 'default' : 'secondary'} className="flex items-center gap-1">
          {deal.signature_status === 'signed' ? (
            <>
              <CheckCircle className="h-3 w-3" /> Signed
            </>
          ) : deal.signature_status === 'viewed' ? (
            <>
              <Eye className="h-3 w-3" /> Viewed
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" /> Pending
            </>
          )}
        </Badge>
      )}
    </div>
  );

  const renderFinanceApplicationActions = (app: CreditApplication, variant: 'table' | 'card' = 'table') => {
    const card = variant === 'card';
    return (
      <div className={card ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap items-center gap-2'}>
        {app.application_status === 'pending' && (
          <>
            <Button
              variant="outline"
              size="sm"
              className={card ? 'h-9 w-9 shrink-0 p-0 text-green-600 hover:text-green-700' : 'text-green-600 hover:text-green-700'}
              onClick={() => handleUpdateApplicationStatus(app.id, 'approved')}
              disabled={updatingStatus === app.id}
              title="Approve"
            >
              <Check className="h-4 w-4" />
              {!card && <span className="ml-1">Approve</span>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={card ? 'h-9 w-9 shrink-0 p-0 text-primary hover:text-primary/90' : 'text-primary hover:text-primary/90'}
              onClick={() => handleUpdateApplicationStatus(app.id, 'reviewing')}
              disabled={updatingStatus === app.id}
              title="Review"
            >
              <Clock className="h-4 w-4" />
              {!card && <span className="ml-1">Review</span>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={card ? 'h-9 w-9 shrink-0 p-0 text-red-600 hover:text-red-700' : 'text-red-600 hover:text-red-700'}
              onClick={() => handleUpdateApplicationStatus(app.id, 'rejected')}
              disabled={updatingStatus === app.id}
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
          className={card ? 'h-9 w-9 shrink-0 p-0' : undefined}
          onClick={() => {
            setEditingApplication(app);
            setAppEditForm({
              customer_name: app.customer_name,
              customer_email: app.customer_email,
              customer_phone: app.customer_phone || '',
              credit_score: app.credit_score?.toString() || '',
              preferred_lender_id: app.preferred_lender_id || '',
              notes: app.notes || '',
            });
            setShowAppEditDialog(true);
          }}
          title="Edit Application"
        >
          <Edit className="h-4 w-4" />
        </Button>
        {(app.application_status === 'approved' || app.application_status === 'pending') && (
          <Button
            variant="default"
            size="sm"
            className={card ? 'shrink-0 text-xs' : undefined}
            onClick={() => {
              setSelectedApplication(app);
              setDealForm({
                vehicle_id: '',
                price: '',
                down_payment: '',
                credit_score: app.credit_score?.toString() || '700',
                term_months: '60',
                deal_type: 'finance',
                msrp: '',
                residual_percentage: '',
                money_factor: '',
                cap_cost_reductions: '',
                capitalized_fees: '',
                tax_rate: '',
                annual_mileage: '12000',
                excess_mileage_rate: '0.25',
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
              });
              setShowCreateDealDialog(true);
            }}
            title="Create Finance Deal"
          >
            <Calculator className={card ? 'h-4 w-4' : 'mr-1 h-3 w-3'} />
            {card ? <span className="ml-1">Deal</span> : <span>Create Deal</span>}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={card ? 'h-9 w-9 shrink-0 p-0' : undefined}
          onClick={async () => {
            try {
              setLoadingAppDetails(true);
              setSelectedAppForView(app);
              const response = await financeAPI.getCreditApplication(app.id);
              const application = response.data || response;
              setAppDetails(application);
              setShowAppViewDialog(true);
            } catch (error: any) {
              toast({
                title: 'Error',
                description: error.message || 'Failed to load application details',
                variant: 'destructive',
              });
            } finally {
              setLoadingAppDetails(false);
            }
          }}
          title="View Application Details"
        >
          <Eye className="h-4 w-4" />
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
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <DollarSign className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="font-bold text-base text-gray-900">Finance & Lease Management</h1>
            <p className="text-xs text-gray-500">Manage programs, deals and credit applications</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="border-orange-200 text-orange-600 hover:bg-orange-50 gap-1.5" onClick={() => navigate('/finance/applications')}>
            <FileText className="h-3.5 w-3.5" /> Applications
          </Button>
          <Button variant="outline" size="sm" className="border-orange-200 text-orange-600 hover:bg-orange-50 gap-1.5" onClick={() => navigate('/finance/analytics')}>
            <TrendingUp className="h-3.5 w-3.5" /> Analytics
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="overflow-x-auto">
            <TabsList className="bg-white border shadow-sm rounded-xl p-1 h-auto gap-1 inline-flex min-w-max">
              <TabsTrigger value="deals" className="gap-1.5 px-4 py-2 text-sm rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm font-medium">
                <CreditCard className="h-4 w-4" />Deals
              </TabsTrigger>
              <TabsTrigger value="programs" className="gap-1.5 px-4 py-2 text-sm rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm font-medium">
                <TrendingUp className="h-4 w-4" />Programs
              </TabsTrigger>
              <TabsTrigger value="applications" className="gap-1.5 px-4 py-2 text-sm rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm font-medium">
                <FileText className="h-4 w-4" />Applications
              </TabsTrigger>
              <TabsTrigger value="help" className="gap-1.5 px-4 py-2 text-sm rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm font-medium">
                <HelpCircle className="h-4 w-4" />Help
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Deals Tab */}
          <TabsContent value="deals" className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Panel header */}
              <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Finance & Lease Deals</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">View and manage all deals</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={dealFilters.status || "all"} onValueChange={(v) => setDealFilters({ ...dealFilters, status: v === "all" ? "" : v })}>
                    <SelectTrigger className="h-8 w-32 text-xs border-gray-200"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="signed">Signed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dealFilters.deal_type || "all"} onValueChange={(v) => setDealFilters({ ...dealFilters, deal_type: v === "all" ? "" : v })}>
                    <SelectTrigger className="h-8 w-28 text-xs border-gray-200"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="lease">Lease</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12 text-sm text-gray-400">Loading deals…</div>
              ) : deals.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400">No deals found</div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <ul className="divide-y divide-gray-50 md:hidden">
                    {deals.map((deal) => (
                      <li key={deal.id} className="p-4 hover:bg-orange-50/30 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{deal.year} {deal.make} {deal.model || 'N/A'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{deal.customer_name || '—'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(deal.status)}
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${deal.deal_type === 'finance' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{deal.deal_type}</span>
                          </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
                          <dt className="text-gray-400">Monthly</dt>
                          <dd className="text-right font-semibold text-gray-800">{deal.monthly_payment != null ? `$${deal.monthly_payment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo` : '—'}</dd>
                          <dt className="text-gray-400">Down</dt>
                          <dd className="text-right text-gray-700">{deal.down_payment != null ? `$${deal.down_payment.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</dd>
                          <dt className="text-gray-400">Term</dt>
                          <dd className="text-right text-gray-700">{deal.term_months ? `${deal.term_months} mo` : '—'}</dd>
                          <dt className="text-gray-400">Total</dt>
                          <dd className="text-right font-medium text-gray-800">{deal.total_amount != null ? `$${deal.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</dd>
                        </dl>
                        <div className="border-t border-gray-100 pt-3">{renderDealActions(deal, 'card')}</div>
                      </li>
                    ))}
                  </ul>
                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          {['Vehicle', 'Customer', 'Type', 'Monthly', 'Down', 'Term', 'Total', 'Status', 'Date', ''].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {deals.map((deal) => (
                          <tr key={deal.id} className="hover:bg-orange-50/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{deal.year} {deal.make} {deal.model || 'N/A'}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{deal.customer_name || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${deal.deal_type === 'finance' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{deal.deal_type}</span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{deal.monthly_payment != null ? `$${deal.monthly_payment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo` : '—'}</td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{deal.down_payment != null ? `$${deal.down_payment.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td>
                            <td className="px-4 py-3 text-gray-700">{deal.term_months ? `${deal.term_months} mo` : '—'}</td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{deal.total_amount != null ? `$${deal.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td>
                            <td className="px-4 py-3">{getStatusBadge(deal.status)}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(deal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                            <td className="px-4 py-3 text-right">{renderDealActions(deal, 'table')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Programs Tab */}
          <TabsContent value="programs" className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Finance Programs</p>
                <div className="flex items-center gap-2">
                  {canAccessFeature('finance_management' as any) && (
                    <Dialog open={showProgramDialog} onOpenChange={setShowProgramDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5">
                          <Plus className="h-3.5 w-3.5" />Add Program
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[min(90dvh,900px)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
                        <DialogHeader>
                          <DialogTitle>Create Finance Program</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Program creation form would go here. This requires finance_management permission.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Select value={programFilters.type || "all"} onValueChange={(v) => setProgramFilters({ ...programFilters, type: v === "all" ? "" : v })}>
                    <SelectTrigger className="h-8 w-28 text-xs border-gray-200"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="lease">Lease</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {loading ? (
                <div className="text-center py-12 text-sm text-gray-400">Loading programs…</div>
              ) : programs.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400">
                    No programs found
                  </div>
                ) : (
                  <>
                    <ul className="divide-y divide-gray-50 md:hidden">
                      {programs.map((program) => (
                        <li key={program.id} className="p-4 hover:bg-orange-50/30 transition-colors">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-semibold text-sm text-gray-900">{program.program_name}</p>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${program.type === 'finance' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{program.type}</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${program.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{program.is_active ? 'Active' : 'Inactive'}</span>
                            </div>
                          </div>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
                            <dt className="text-gray-400">Term</dt><dd className="text-right text-gray-700">{program.term_months} mo</dd>
                            <dt className="text-gray-400">Credit Range</dt><dd className="text-right text-gray-700">{program.tier_min_score}–{program.tier_max_score}</dd>
                            <dt className="text-gray-400">Rate</dt>
                            <dd className="text-right font-medium text-gray-800">
                              {program.type === 'finance' ? `${program.interest_rate}% APR` : `MF: ${program.money_factor}`}
                            </dd>
                            <dt className="text-gray-400">Source</dt><dd className="text-right text-gray-500">{program.program_source}</dd>
                          </dl>
                          {canAccessFeature('finance_management' as any) && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-orange-600 hover:bg-orange-50 w-full"
                              onClick={() => toast({ title: 'Program Details', description: `${program.program_name} | ${program.type} | ${program.term_months} months | ${program.tier_min_score}-${program.tier_max_score} credit range` })}>
                              <Eye className="mr-1.5 h-3.5 w-3.5" />Details
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            {['Program Name', 'Type', 'Term', 'Credit Range', 'Rate / Factor', 'Source', 'Status', ''].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {programs.map((program) => (
                            <tr key={program.id} className="hover:bg-orange-50/40 transition-colors">
                              <td className="px-4 py-3 font-semibold text-gray-900 max-w-[12rem]">
                                <span className="line-clamp-2">{program.program_name}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${program.type === 'finance' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                  {program.type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{program.term_months} mo</td>
                              <td className="px-4 py-3 text-gray-700">{program.tier_min_score}–{program.tier_max_score}</td>
                              <td className="px-4 py-3 text-gray-700 max-w-[14rem] text-xs">
                                {program.type === 'finance'
                                  ? `${program.interest_rate}% APR`
                                  : `MF: ${program.money_factor} | Res: ${program.residual_value_pct}%`}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs">{program.program_source}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${program.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {program.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {canAccessFeature('finance_management' as any) && (
                                  <Button variant="ghost" size="sm"
                                    onClick={() => toast({ title: 'Program Details', description: `${program.program_name} | ${program.type} | ${program.term_months} months | ${program.tier_min_score}-${program.tier_max_score} credit range` })}
                                    title="View Program Details">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
            </div>{/* end programs panel */}
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Credit Applications</p>
                <Select value={applicationFilters.status || "all"} onValueChange={(v) => setApplicationFilters({ ...applicationFilters, status: v === "all" ? "" : v })}>
                  <SelectTrigger className="h-8 w-32 text-xs border-gray-200"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="reviewing">Reviewing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {loading ? (
                <div className="text-center py-12 text-sm text-gray-400">Loading applications…</div>
              ) : applications.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400">
                  No credit applications found
                </div>
                ) : (
                  <>
                    <ul className="divide-y divide-gray-50 md:hidden">
                      {applications.map((app) => (
                        <li key={app.id} className="p-4 hover:bg-orange-50/30 transition-colors">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="font-semibold text-sm text-gray-900">{app.customer_name}</p>
                            {getStatusBadge(app.application_status)}
                          </div>
                          <a href={`mailto:${app.customer_email}`} className="text-xs text-orange-600 hover:underline block mb-2">{app.customer_email}</a>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
                            <dt className="text-gray-400">Credit Score</dt>
                            <dd className="text-right">
                              {app.credit_score ? (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${app.credit_score >= 700 ? 'bg-emerald-100 text-emerald-700' : app.credit_score >= 600 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{app.credit_score}</span>
                              ) : <span className="text-gray-400">—</span>}
                            </dd>
                            <dt className="text-gray-400">Lender</dt>
                            <dd className="text-right text-gray-700 text-[11px]">
                              {app.approved_lender_name ? `✓ ${app.approved_lender_name}` : app.preferred_lender_name ? `⏳ ${app.preferred_lender_name}` : '—'}
                            </dd>
                            <dt className="text-gray-400">Submitted</dt>
                            <dd className="text-right text-gray-500">{new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</dd>
                          </dl>
                          <div className="border-t border-gray-100 pt-3">
                            {renderFinanceApplicationActions(app, 'card')}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            {['Customer', 'Email', 'Credit Score', 'Status', 'Lender', 'Submitted', ''].map(h => (
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
                              <td className="px-4 py-3 text-xs text-gray-500 max-w-[12rem] break-all">{app.customer_email}</td>
                              <td className="px-4 py-3">
                                {app.credit_score ? (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    app.credit_score >= 700 ? 'bg-emerald-100 text-emerald-700'
                                    : app.credit_score >= 600 ? 'bg-orange-100 text-orange-700'
                                    : 'bg-red-100 text-red-700'
                                  }`}>{app.credit_score}</span>
                                ) : (
                                  <span className="text-xs text-gray-400">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-3">{getStatusBadge(app.application_status)}</td>
                              <td className="px-4 py-3 max-w-[10rem]">
                                {app.approved_lender_name ? (
                                  <div>
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-700">✓ {app.approved_lender_name}</span>
                                    {app.lender_approval_date && <div className="text-[11px] text-gray-400 mt-0.5">{new Date(app.lender_approval_date).toLocaleDateString()}</div>}
                                  </div>
                                ) : app.preferred_lender_name ? (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-orange-100 text-orange-700 max-w-full truncate">⏳ {app.preferred_lender_name}</span>
                                ) : (
                                  <span className="text-xs text-gray-400">No lender</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                                {new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 text-right">{renderFinanceApplicationActions(app, 'table')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
            </div>{/* end applications panel */}
          </TabsContent>

          {/* Help Guide Tab */}
          <TabsContent value="help" className="space-y-4">
            <FinanceHelpGuide />
          </TabsContent>
        </Tabs>

        </div>{/* end content area */}

        {/* Application Details Dialog */}
        <Dialog open={showAppViewDialog} onOpenChange={setShowAppViewDialog}>
          <DialogContent className="max-h-[min(90dvh,900px)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Credit Application Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {loadingAppDetails ? (
                <div className="text-center py-8">Loading application details...</div>
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
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="font-medium">{appDetails.customer_phone || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Credit Score</Label>
                      <p className="font-medium">
                        {appDetails.credit_score ? (
                          <Badge variant={appDetails.credit_score >= 700 ? 'default' : appDetails.credit_score >= 600 ? 'secondary' : 'destructive'}>
                            {appDetails.credit_score}
                          </Badge>
                        ) : (
                          'N/A'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p>{getStatusBadge(appDetails.application_status)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Submitted At</Label>
                      <p className="font-medium">
                        {new Date(appDetails.submitted_at).toLocaleString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  {appDetails.reviewed_at && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-muted-foreground">Reviewed At</Label>
                        <p className="font-medium">
                          {new Date(appDetails.reviewed_at).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                  {appDetails.notes && (
                    <div>
                      <Label className="text-muted-foreground">Notes</Label>
                      <p className="font-medium">{appDetails.notes}</p>
                    </div>
                  )}
                  {(appDetails.ssn_masked || appDetails.dl_masked) && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {appDetails.ssn_masked && (
                        <div>
                          <Label className="text-muted-foreground">SSN</Label>
                          <p className="font-mono">{appDetails.ssn_masked}</p>
                        </div>
                      )}
                      {appDetails.dl_masked && (
                        <div>
                          <Label className="text-muted-foreground">Driver's License</Label>
                          <p className="font-mono">{appDetails.dl_masked}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No application details available</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Application Dialog */}
        <Dialog open={showAppEditDialog} onOpenChange={setShowAppEditDialog}>
          <DialogContent className="max-h-[min(90dvh,900px)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Edit Credit Application</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit_customer_name">Customer Name *</Label>
                  <Input
                    id="edit_customer_name"
                    value={appEditForm.customer_name}
                    onChange={(e) => setAppEditForm({ ...appEditForm, customer_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_customer_email">Email *</Label>
                  <Input
                    id="edit_customer_email"
                    type="email"
                    value={appEditForm.customer_email}
                    onChange={(e) => setAppEditForm({ ...appEditForm, customer_email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="edit_customer_phone">Phone</Label>
                  <Input
                    id="edit_customer_phone"
                    value={appEditForm.customer_phone}
                    onChange={(e) => setAppEditForm({ ...appEditForm, customer_phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_credit_score">Credit Score</Label>
                  <Input
                    id="edit_credit_score"
                    type="number"
                    value={appEditForm.credit_score}
                    onChange={(e) => setAppEditForm({ ...appEditForm, credit_score: e.target.value })}
                    placeholder="700"
                    min="300"
                    max="850"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit_preferred_lender">Preferred Lender</Label>
                <Select 
                  value={appEditForm.preferred_lender_id || 'none'} 
                  onValueChange={(value) => setAppEditForm({ ...appEditForm, preferred_lender_id: value === 'none' ? '' : value })}
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
                  value={appEditForm.notes}
                  onChange={(e) => setAppEditForm({ ...appEditForm, notes: e.target.value })}
                  placeholder="Add any notes about this application..."
                />
              </div>
              
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowAppEditDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  className="w-full sm:w-auto"
                  onClick={async () => {
                    try {
                      await financeAPI.updateCreditApplication(editingApplication!.id, {
                        customer_name: appEditForm.customer_name,
                        customer_email: appEditForm.customer_email,
                        customer_phone: appEditForm.customer_phone || null,
                        credit_score: appEditForm.credit_score ? parseInt(appEditForm.credit_score) : null,
                        preferred_lender_id: appEditForm.preferred_lender_id || null,
                        notes: appEditForm.notes || null
                      });
                      
                      toast({
                        title: "Success",
                        description: "Application updated successfully",
                      });
                      
                      setShowAppEditDialog(false);
                      loadData();
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: error.message || "Failed to update application",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={!appEditForm.customer_name || !appEditForm.customer_email}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Submit to Lender Dialog */}
        <Dialog open={showSubmitLenderDialog} onOpenChange={setShowSubmitLenderDialog}>
          <DialogContent className="max-h-[min(90dvh,900px)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Submit Deal to Lender(s)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedDealForAction && (
                <div className="bg-muted p-4 rounded-md mb-4">
                  <h3 className="font-semibold mb-2">Deal Information</h3>
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Vehicle:</span>{' '}
                      <span className="font-medium">
                        {selectedDealForAction.year} {selectedDealForAction.make} {selectedDealForAction.model}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Monthly Payment:</span>{' '}
                      <span className="font-medium">
                        ${selectedDealForAction.monthly_payment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Down Payment:</span>{' '}
                      <span className="font-medium">
                        ${selectedDealForAction.down_payment.toLocaleString('en-US')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Term:</span>{' '}
                      <span className="font-medium">{selectedDealForAction.term_months} months</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <Label>Select Lender(s) to Submit To</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  You can select multiple lenders. The deal will be submitted to all selected lenders.
                </p>
                <div className="border rounded-md p-4 max-h-[300px] overflow-y-auto space-y-2">
                  {lenders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No active lenders found. Please add lenders first.
                    </div>
                  ) : (
                    lenders.map((lender) => (
                      <label 
                        key={lender.id} 
                        className="flex items-start space-x-3 p-3 hover:bg-muted rounded-md cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLendersForSubmit.includes(lender.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLendersForSubmit([...selectedLendersForSubmit, lender.id]);
                            } else {
                              setSelectedLendersForSubmit(selectedLendersForSubmit.filter(id => id !== lender.id));
                            }
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{lender.lender_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {lender.lender_type}
                            {lender.min_credit_score && ` • Min Credit Score: ${lender.min_credit_score}`}
                            {lender.max_ltv && ` • Max LTV: ${lender.max_ltv}%`}
                          </div>
                        </div>
                        {lender.is_preferred && (
                          <Badge variant="secondary">Preferred</Badge>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>
              
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button 
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setShowSubmitLenderDialog(false);
                    setSelectedLendersForSubmit([]);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  className="w-full sm:w-auto"
                  onClick={handleSubmitToLenders}
                  disabled={submittingToLenders || selectedLendersForSubmit.length === 0}
                >
                  {submittingToLenders ? 'Submitting...' : `Submit to ${selectedLendersForSubmit.length} Lender(s)`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Deal Details & Submissions Dialog */}
        <Dialog open={showDealDetailsDialog} onOpenChange={setShowDealDetailsDialog}>
          <DialogContent className="max-h-[min(85dvh,880px)] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Deal Details & Lender Submissions</DialogTitle>
            </DialogHeader>
            
            {selectedDealForView && (
              <div className="space-y-6">
                {/* Deal Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Deal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Vehicle</Label>
                      <p className="font-semibold">
                        {selectedDealForView.year} {selectedDealForView.make} {selectedDealForView.model}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Type</Label>
                      <p><Badge>{selectedDealForView.deal_type}</Badge></p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Monthly Payment</Label>
                      <p className="font-semibold text-lg">
                        ${selectedDealForView.monthly_payment.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Down Payment</Label>
                      <p>${selectedDealForView.down_payment.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Term</Label>
                      <p>{selectedDealForView.term_months} months</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">APR</Label>
                      <p>{selectedDealForView.apr}%</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Vehicle Price</Label>
                      <p>${selectedDealForView.vehicle_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Total Amount</Label>
                      <p className="font-semibold">
                        ${selectedDealForView.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p>{getStatusBadge(selectedDealForView.status)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Created</Label>
                      <p>{new Date(selectedDealForView.created_at).toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Lender Submissions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Lender Submissions ({dealSubmissions.length})</span>
                      {dealSubmissions.length > 0 && (
                        <Badge variant="outline">
                          {dealSubmissions.filter(s => s.submission_status === 'approved').length} Approved
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingSubmissions ? (
                      <div className="text-center py-4">Loading submissions...</div>
                    ) : dealSubmissions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Send className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No lender submissions yet</p>
                        <p className="text-sm mt-1">Submit this deal to lenders to track their responses</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dealSubmissions.map((submission) => (
                          <Card key={submission.id} className="border">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="font-semibold text-lg">{submission.lender_name}</h4>
                                  <Badge variant="outline" className="mt-1">{submission.lender_type}</Badge>
                                </div>
                                <Badge 
                                  variant={
                                    submission.submission_status === 'approved' ? 'default' :
                                    submission.submission_status === 'rejected' ? 'destructive' :
                                    submission.submission_status === 'countered' ? 'secondary' :
                                    'outline'
                                  }
                                  className="text-sm"
                                >
                                  {submission.submission_status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                                  {submission.submission_status === 'rejected' && <X className="h-3 w-3 mr-1" />}
                                  {submission.submission_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                                  {submission.submission_status.toUpperCase()}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                <div>
                                  <span className="text-muted-foreground">Submitted:</span>
                                  <p>{new Date(submission.submitted_at).toLocaleString()}</p>
                                </div>
                                {submission.responded_at && (
                                  <div>
                                    <span className="text-muted-foreground">Responded:</span>
                                    <p>{new Date(submission.responded_at).toLocaleString()}</p>
                                  </div>
                                )}
                                {submission.submitted_by_name && (
                                  <div>
                                    <span className="text-muted-foreground">Submitted By:</span>
                                    <p>{submission.submitted_by_name}</p>
                                  </div>
                                )}
                                {submission.lender_reference_number && (
                                  <div>
                                    <span className="text-muted-foreground">Reference #:</span>
                                    <p className="font-mono">{submission.lender_reference_number}</p>
                                  </div>
                                )}
                              </div>

                              {/* Approval Details */}
                              {submission.submission_status === 'approved' && (
                                <div className="mt-3 pt-3 border-t">
                                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                                    {submission.approved_amount && (
                                      <div>
                                        <span className="text-muted-foreground">Approved Amount:</span>
                                        <p className="font-semibold text-green-600">
                                          ${submission.approved_amount.toLocaleString()}
                                        </p>
                                      </div>
                                    )}
                                    {submission.approved_apr && (
                                      <div>
                                        <span className="text-muted-foreground">APR:</span>
                                        <p className="font-semibold">{submission.approved_apr}%</p>
                                      </div>
                                    )}
                                    {submission.approved_term_months && (
                                      <div>
                                        <span className="text-muted-foreground">Term:</span>
                                        <p>{submission.approved_term_months} months</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Rejection Reason */}
                              {submission.submission_status === 'rejected' && submission.rejection_reason && (
                                <div className="mt-3 pt-3 border-t">
                                  <span className="text-muted-foreground text-sm">Rejection Reason:</span>
                                  <p className="text-sm text-red-600 mt-1">{submission.rejection_reason}</p>
                                </div>
                              )}

                              {/* Notes */}
                              {submission.notes && (
                                <div className="mt-3 pt-3 border-t">
                                  <span className="text-muted-foreground text-sm">Notes:</span>
                                  <p className="text-sm mt-1">{submission.notes}</p>
                                </div>
                              )}
                              
                              {/* Update Status Button */}
                              <div className="mt-3 flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedSubmission(submission);
                                    setSubmissionUpdateForm({
                                      submission_status: submission.submission_status,
                                      approved_amount: submission.approved_amount?.toString() || '',
                                      approved_apr: submission.approved_apr?.toString() || '',
                                      approved_term_months: submission.approved_term_months?.toString() || '',
                                      rejection_reason: submission.rejection_reason || '',
                                      lender_reference_number: submission.lender_reference_number || ''
                                    });
                                    setShowUpdateSubmissionDialog(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Update Status
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Update Submission Dialog */}
        <Dialog open={showUpdateSubmissionDialog} onOpenChange={setShowUpdateSubmissionDialog}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Update Lender Submission</DialogTitle>
            </DialogHeader>
            
            {selectedSubmission && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium">{selectedSubmission.lender_name}</p>
                  <p className="text-xs text-muted-foreground">Current Status: {selectedSubmission.submission_status}</p>
                </div>
                
                <div>
                  <Label>Status *</Label>
                  <Select 
                    value={submissionUpdateForm.submission_status} 
                    onValueChange={(v) => setSubmissionUpdateForm({ ...submissionUpdateForm, submission_status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="countered">Countered</SelectItem>
                      <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {submissionUpdateForm.submission_status === 'approved' && (
                  <>
                    <div>
                      <Label>Approved Amount</Label>
                      <Input
                        type="number"
                        placeholder="Approved amount"
                        value={submissionUpdateForm.approved_amount}
                        onChange={(e) => setSubmissionUpdateForm({ ...submissionUpdateForm, approved_amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Approved APR (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="APR"
                        value={submissionUpdateForm.approved_apr}
                        onChange={(e) => setSubmissionUpdateForm({ ...submissionUpdateForm, approved_apr: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Approved Term (months)</Label>
                      <Input
                        type="number"
                        placeholder="Term in months"
                        value={submissionUpdateForm.approved_term_months}
                        onChange={(e) => setSubmissionUpdateForm({ ...submissionUpdateForm, approved_term_months: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {submissionUpdateForm.submission_status === 'rejected' && (
                  <div>
                    <Label>Rejection Reason</Label>
                    <Input
                      placeholder="Why was this rejected?"
                      value={submissionUpdateForm.rejection_reason}
                      onChange={(e) => setSubmissionUpdateForm({ ...submissionUpdateForm, rejection_reason: e.target.value })}
                    />
                  </div>
                )}

                <div>
                  <Label>Lender Reference Number</Label>
                  <Input
                    placeholder="Lender's reference/tracking number"
                    value={submissionUpdateForm.lender_reference_number}
                    onChange={(e) => setSubmissionUpdateForm({ ...submissionUpdateForm, lender_reference_number: e.target.value })}
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
                  <Button 
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setShowUpdateSubmissionDialog(false);
                      setSelectedSubmission(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="w-full sm:w-auto"
                    onClick={handleUpdateSubmission}
                    disabled={updatingSubmission || !submissionUpdateForm.submission_status}
                  >
                    {updatingSubmission ? 'Updating...' : 'Update Submission'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Deal Dialog */}
        <Dialog open={showEditDealDialog} onOpenChange={setShowEditDealDialog}>
          <DialogContent className="max-h-[min(92dvh,920px)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Edit {editDealForm.deal_type === 'finance' ? 'Finance' : 'Lease'} Deal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium">
                  Vehicle: {editingDeal?.year} {editingDeal?.make} {editingDeal?.model}
                </p>
                <p className="text-xs text-muted-foreground">
                  Current Status: {editingDeal?.status}
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Deal Type</Label>
                  <Select 
                    value={editDealForm.deal_type} 
                    disabled
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="lease">Lease</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Deal type cannot be changed</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="edit_price">{editDealForm.deal_type === 'finance' ? 'Vehicle Price' : 'Capitalized Cost'} *</Label>
                    <Input
                      id="edit_price"
                      type="number"
                      value={editDealForm.price}
                      onChange={(e) => setEditDealForm({ ...editDealForm, price: e.target.value })}
                      placeholder="30000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_down_payment">Down Payment</Label>
                    <Input
                      id="edit_down_payment"
                      type="number"
                      value={editDealForm.down_payment}
                      onChange={(e) => setEditDealForm({ ...editDealForm, down_payment: e.target.value })}
                      placeholder="5000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="edit_term_months">Term (Months) *</Label>
                    <Select
                      value={editDealForm.term_months}
                      onValueChange={(v) => setEditDealForm({ ...editDealForm, term_months: v })}
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

                {/* Finance-specific fields */}
                {editDealForm.deal_type === 'finance' && (
                  <Accordion type="single" collapsible className="w-full">
                    {/* Government Fees */}
                    <AccordionItem value="fees">
                      <AccordionTrigger className="text-sm font-medium">
                        Government Fees (TTL) - Optional
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <Label htmlFor="edit_sales_tax_rate">Sales Tax Rate (e.g., 0.065)</Label>
                              <Input
                                id="edit_sales_tax_rate"
                                type="number"
                                step="0.0001"
                                value={editDealForm.sales_tax_rate}
                                onChange={(e) => setEditDealForm({ ...editDealForm, sales_tax_rate: e.target.value })}
                                placeholder="0.065"
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit_title_fee">Title Fee</Label>
                              <Input
                                id="edit_title_fee"
                                type="number"
                                value={editDealForm.title_fee}
                                onChange={(e) => setEditDealForm({ ...editDealForm, title_fee: e.target.value })}
                                placeholder="150"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <Label htmlFor="edit_license_fee">License Fee</Label>
                              <Input
                                id="edit_license_fee"
                                type="number"
                                value={editDealForm.license_fee}
                                onChange={(e) => setEditDealForm({ ...editDealForm, license_fee: e.target.value })}
                                placeholder="75"
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit_registration_fee">Registration Fee</Label>
                              <Input
                                id="edit_registration_fee"
                                type="number"
                                value={editDealForm.registration_fee}
                                onChange={(e) => setEditDealForm({ ...editDealForm, registration_fee: e.target.value })}
                                placeholder="100"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <Label htmlFor="edit_inspection_fee">Inspection Fee</Label>
                              <Input
                                id="edit_inspection_fee"
                                type="number"
                                value={editDealForm.inspection_fee}
                                onChange={(e) => setEditDealForm({ ...editDealForm, inspection_fee: e.target.value })}
                                placeholder="25"
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit_processing_fee">Processing/Doc Fee</Label>
                              <Input
                                id="edit_processing_fee"
                                type="number"
                                value={editDealForm.processing_fee}
                                onChange={(e) => setEditDealForm({ ...editDealForm, processing_fee: e.target.value })}
                                placeholder="299"
                              />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Trade-In */}
                    <AccordionItem value="tradein">
                      <AccordionTrigger className="text-sm font-medium">
                        Trade-In - Optional
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <Label htmlFor="edit_trade_in_acv">ACV (Actual Cash Value)</Label>
                              <Input
                                id="edit_trade_in_acv"
                                type="number"
                                value={editDealForm.trade_in_acv}
                                onChange={(e) => setEditDealForm({ ...editDealForm, trade_in_acv: e.target.value })}
                                placeholder="15000"
                              />
                              <p className="text-xs text-muted-foreground mt-1">What dealer gives for trade-in</p>
                            </div>
                            <div>
                              <Label htmlFor="edit_trade_in_payoff">Payoff Amount</Label>
                              <Input
                                id="edit_trade_in_payoff"
                                type="number"
                                value={editDealForm.trade_in_payoff}
                                onChange={(e) => setEditDealForm({ ...editDealForm, trade_in_payoff: e.target.value })}
                                placeholder="12000"
                              />
                              <p className="text-xs text-muted-foreground mt-1">Amount customer still owes</p>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Add-Ons */}
                    <AccordionItem value="addons">
                      <AccordionTrigger className="text-sm font-medium">
                        Add-Ons & Protection Products - Optional
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <Label htmlFor="edit_add_ons">Add-Ons/Accessories Total</Label>
                              <Input
                                id="edit_add_ons"
                                type="number"
                                value={editDealForm.add_ons}
                                onChange={(e) => setEditDealForm({ ...editDealForm, add_ons: e.target.value })}
                                placeholder="500"
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit_protection_products">Protection Products Total</Label>
                              <Input
                                id="edit_protection_products"
                                type="number"
                                value={editDealForm.protection_products}
                                onChange={(e) => setEditDealForm({ ...editDealForm, protection_products: e.target.value })}
                                placeholder="1500"
                              />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                {/* Lease-specific fields */}
                {editDealForm.deal_type === 'lease' && (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="edit_msrp">MSRP *</Label>
                        <Input
                          id="edit_msrp"
                          type="number"
                          value={editDealForm.msrp}
                          onChange={(e) => setEditDealForm({ ...editDealForm, msrp: e.target.value })}
                          placeholder="40000"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_residual_percentage">Residual % *</Label>
                        <Input
                          id="edit_residual_percentage"
                          type="number"
                          step="0.01"
                          value={editDealForm.residual_percentage}
                          onChange={(e) => setEditDealForm({ ...editDealForm, residual_percentage: e.target.value })}
                          placeholder="60"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="edit_money_factor">Money Factor *</Label>
                        <Input
                          id="edit_money_factor"
                          type="number"
                          step="0.0001"
                          value={editDealForm.money_factor}
                          onChange={(e) => setEditDealForm({ ...editDealForm, money_factor: e.target.value })}
                          placeholder="0.0010"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_tax_rate">Tax Rate</Label>
                        <Input
                          id="edit_tax_rate"
                          type="number"
                          step="0.0001"
                          value={editDealForm.tax_rate}
                          onChange={(e) => setEditDealForm({ ...editDealForm, tax_rate: e.target.value })}
                          placeholder="0.065"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="edit_cap_cost_reductions">Cap Cost Reductions</Label>
                        <Input
                          id="edit_cap_cost_reductions"
                          type="number"
                          value={editDealForm.cap_cost_reductions}
                          onChange={(e) => setEditDealForm({ ...editDealForm, cap_cost_reductions: e.target.value })}
                          placeholder="2000"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_capitalized_fees">Capitalized Fees</Label>
                        <Input
                          id="edit_capitalized_fees"
                          type="number"
                          value={editDealForm.capitalized_fees}
                          onChange={(e) => setEditDealForm({ ...editDealForm, capitalized_fees: e.target.value })}
                          placeholder="595"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="edit_annual_mileage">Annual Mileage</Label>
                        <Input
                          id="edit_annual_mileage"
                          type="number"
                          value={editDealForm.annual_mileage}
                          onChange={(e) => setEditDealForm({ ...editDealForm, annual_mileage: e.target.value })}
                          placeholder="12000"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_excess_mileage_rate">Excess Mileage Rate</Label>
                        <Input
                          id="edit_excess_mileage_rate"
                          type="number"
                          step="0.01"
                          value={editDealForm.excess_mileage_rate}
                          onChange={(e) => setEditDealForm({ ...editDealForm, excess_mileage_rate: e.target.value })}
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
                      setShowEditDealDialog(false);
                      setEditingDeal(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={handleEditDeal}
                    disabled={updatingDeal || !editDealForm.price || !editDealForm.term_months}
                  >
                    {updatingDeal ? 'Updating...' : 'Update Deal'}
                  </Button>
                </div>
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
            <div className="space-y-4 py-4">
              {selectedApplication && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium">Customer: {selectedApplication.customer_name}</p>
                  <p className="text-sm text-muted-foreground">Credit Score: {selectedApplication.credit_score || 'N/A'}</p>
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
                      const vehicle = vehicles.find(vh => vh.id === v);
                      setDealForm({
                        ...dealForm,
                        vehicle_id: v,
                        price: vehicle?.price?.toString() || ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
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
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-4">
                      <h4 className="font-semibold text-primary">Lease Terms</h4>
                      
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="msrp">MSRP *</Label>
                          <Input
                            id="msrp"
                            type="number"
                            value={dealForm.msrp}
                            onChange={(e) => setDealForm({ ...dealForm, msrp: e.target.value })}
                            placeholder="40000"
                          />
                          <p className="text-xs text-muted-foreground mt-1">For residual calculation</p>
                        </div>
                        <div>
                          <Label htmlFor="residual_percentage">Residual % *</Label>
                          <Input
                            id="residual_percentage"
                            type="number"
                            step="0.01"
                            value={dealForm.residual_percentage}
                            onChange={(e) => setDealForm({ ...dealForm, residual_percentage: e.target.value })}
                            placeholder="60"
                          />
                          <p className="text-xs text-muted-foreground mt-1">e.g., 60 for 60%</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="money_factor">Money Factor *</Label>
                          <Input
                            id="money_factor"
                            type="number"
                            step="0.0001"
                            value={dealForm.money_factor}
                            onChange={(e) => setDealForm({ ...dealForm, money_factor: e.target.value })}
                            placeholder="0.0010"
                          />
                          <p className="text-xs text-muted-foreground mt-1">0.0010 ≈ 2.4% APR</p>
                        </div>
                        <div>
                          <Label htmlFor="tax_rate">Tax Rate</Label>
                          <Input
                            id="tax_rate"
                            type="number"
                            step="0.0001"
                            value={dealForm.tax_rate}
                            onChange={(e) => setDealForm({ ...dealForm, tax_rate: e.target.value })}
                            placeholder="0.065"
                          />
                          <p className="text-xs text-muted-foreground mt-1">e.g., 0.065 for 6.5%</p>
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
                          <p className="text-xs text-muted-foreground mt-1">Down, trade-in, rebates</p>
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
                          <Label htmlFor="annual_mileage">Annual Mileage</Label>
                          <Select value={dealForm.annual_mileage} onValueChange={(v) => setDealForm({ ...dealForm, annual_mileage: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10000">10,000 miles/year</SelectItem>
                              <SelectItem value="12000">12,000 miles/year</SelectItem>
                              <SelectItem value="15000">15,000 miles/year</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="excess_mileage_rate">Excess Rate ($/mile)</Label>
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
                        msrp: '',
                        residual_percentage: '',
                        money_factor: '',
                        cap_cost_reductions: '',
                        capitalized_fees: '',
                        tax_rate: '',
                        annual_mileage: '12000',
                        excess_mileage_rate: '0.25',
                        sales_tax_rate: '',
                        title_fee: '',
                        license_fee: '',
                        registration_fee: '',
                        inspection_fee: '',
                        processing_fee: '',
                        trade_in_acv: '',
                        trade_in_payoff: '',
                        add_ons: '',
                        protection_products: ''
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={handleCreateDeal}
                    disabled={creatingDeal}
                  >
                    {creatingDeal ? 'Creating...' : 'Create Deal'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
};

export default Finance;


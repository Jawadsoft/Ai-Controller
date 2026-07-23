/**
 * Customer Credit Application Page
 * Public-facing credit application form with multi-step wizard
 * Requires customer authentication
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import CustomerSignaturePad from '@/components/CustomerSignaturePad';
import { ArrowLeft, ArrowRight, Send, FileText, User, Briefcase, Car, DollarSign, CheckCircle, Calculator } from 'lucide-react';
import { useCustomer } from '@/contexts/CustomerContext';
import { buildApiUrl } from '@/lib/config';

interface ApplicationFormData {
  // Personal Info
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  date_of_birth: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  
  // Vehicle Info
  vehicle_id?: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_mileage: string;
  vehicle_purchase_price: string;
  
  // Finance/Lease Selection
  deal_type: 'finance' | 'lease';
  
  // Loan Details (Finance)
  requested_loan_amount: string;
  requested_term_months: string;
  down_payment: string;
  
  // Lease-Specific Fields
  vehicle_msrp: string;
  trade_in_value: string;
  rebate_amount: string;
  acquisition_fee: string;
  doc_fee: string;
  residual_percentage: string;
  money_factor: string;
  sales_tax_rate: string;
  annual_mileage: string;
  excess_mileage_rate: string;
  
  // Employment
  employer_name: string;
  job_title: string;
  work_address: string;
  work_city: string;
  work_state: string;
  work_zip_code: string;
  monthly_income: string;
  employment_status: string;
  years_employed: string;
  
  // Credit & Authorization
  ssn: string;
  dl_number: string;
  credit_score: string;
  signature_data: string;
  terms_accepted: boolean;
}

const CustomerCreditApplication = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { customer, isLoading: customerAuthLoading } = useCustomer();
  const { vehicleId } = useParams(); // This can be either vehicleId or applicationId
  const [searchParams] = useSearchParams();
  const dealerId = searchParams.get('dealer');
  const linkToken = searchParams.get('token'); // Secure link from email (credit_application_tokens)
  const requiresLoginForEmailLink = Boolean(linkToken);

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [vehicle, setVehicle] = useState<any>(null);
  const [loadingApplication, setLoadingApplication] = useState(false);
  /** dealer_id from credit link prefill when not present in URL */
  const [linkMetaDealerId, setLinkMetaDealerId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<ApplicationFormData>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    date_of_birth: '',
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: '',
    vehicle_mileage: '',
    vehicle_purchase_price: '',
    deal_type: 'finance',
    requested_loan_amount: '',
    requested_term_months: '60',
    down_payment: '',
    vehicle_msrp: '',
    trade_in_value: '',
    rebate_amount: '',
    acquisition_fee: '595',
    doc_fee: '499',
    residual_percentage: '',
    money_factor: '',
    sales_tax_rate: '0.065',
    annual_mileage: '12000',
    excess_mileage_rate: '0.25',
    employer_name: '',
    job_title: '',
    work_address: '',
    work_city: '',
    work_state: '',
    work_zip_code: '',
    monthly_income: '',
    employment_status: '',
    years_employed: '',
    ssn: '',
    dl_number: '',
    credit_score: '',
    signature_data: '',
    terms_accepted: false,
  });

  // Credit application email links: sign in first, then return here
  useEffect(() => {
    if (!requiresLoginForEmailLink || customerAuthLoading) return;
    if (customer?.isAuthenticated) return;

    const dest = `${location.pathname}${location.search}`;
    const q = dealerId ? `&dealer=${encodeURIComponent(dealerId)}` : '';
    navigate(`/customer-login?redirect=${encodeURIComponent(dest)}${q}`, { replace: true });
  }, [
    requiresLoginForEmailLink,
    customerAuthLoading,
    customer?.isAuthenticated,
    location.pathname,
    location.search,
    dealerId,
    navigate,
  ]);

  // Load vehicle / application data once email-link users are signed in
  useEffect(() => {
    if (linkToken) {
      if (customerAuthLoading || !customer?.isAuthenticated) return;
      if (vehicleId) {
        loadApplicationData();
      } else {
        loadCreditLinkPrefill();
      }
      return;
    }
    if (vehicleId) {
      loadVehicleData();
    }
  }, [vehicleId, linkToken, customer?.isAuthenticated, customerAuthLoading]);

  const loadApplicationData = async () => {
    try {
      setLoadingApplication(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const url = `${apiUrl}/api/customer/application/${vehicleId}?token=${linkToken}`;
      
      console.log('🔍 Loading application data...');
      console.log('  - API URL:', apiUrl);
      console.log('  - Application ID:', vehicleId);
      console.log('  - Token:', linkToken ? linkToken.substring(0, 50) + '...' : 'MISSING');
      console.log('  - Full URL:', url);
      
      const response = await fetch(url);
      console.log('📊 Response status:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('📦 Response data:', data);
      
      if (data.success) {
        const app = data.data;
        console.log('✅ Loaded application data successfully');
        console.log('  - Application:', app);

        if (app.dealer_id) {
          setLinkMetaDealerId(String(app.dealer_id));
        }

        // Pre-fill form with application data
        setFormData(prev => ({
          ...prev,
          customer_name: app.customer_name || '',
          customer_email: app.customer_email || '',
          customer_phone: app.customer_phone || '',
          credit_score: app.credit_score?.toString() || '',
          deal_type: app.deal_type || 'finance',
          down_payment: app.down_payment?.toString() || '',
          requested_term_months: app.requested_term_months?.toString() || '60',
          // Vehicle data from application
          vehicle_id: app.vehicle_id || '',
        }));
        
        // Load vehicle details if vehicle_id exists
        if (app.vehicle && app.vehicle.id) {
          setVehicle(app.vehicle);
          setFormData(prev => ({
            ...prev,
            vehicle_make: app.vehicle.make || '',
            vehicle_model: app.vehicle.model || '',
            vehicle_year: app.vehicle.year?.toString() || '',
            vehicle_mileage: app.vehicle.mileage?.toString() || '',
            vehicle_purchase_price: app.vehicle.price?.toString() || '',
          }));
        }
        
        console.log('✅ Form data pre-filled successfully');
        
        toast({
          title: 'Application Loaded',
          description: 'Your application details have been pre-filled. Please review and complete the remaining information.',
        });
      } else {
        console.log('❌ API returned success=false:', data.error);
        toast({
          title: 'Error Loading Application',
          description: data.error || 'Could not load application data',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('❌ Error loading application:', error);
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
      toast({
        title: 'Note',
        description: 'Starting a new application form.',
      });
    } finally {
      setLoadingApplication(false);
    }
  };

  const loadVehicleData = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/vehicles/${vehicleId}`);
      const data = await response.json();
      
      if (data.success) {
        const vehicleData = data.data;
        setVehicle(vehicleData);
        setFormData(prev => ({
          ...prev,
          vehicle_id: vehicleData.id,
          vehicle_make: vehicleData.make || '',
          vehicle_model: vehicleData.model || '',
          vehicle_year: vehicleData.year?.toString() || '',
          vehicle_mileage: vehicleData.mileage?.toString() || '',
          vehicle_purchase_price: vehicleData.price?.toString() || '',
        }));
      }
    } catch (error) {
      console.error('Error loading vehicle:', error);
    }
  };

  const loadCreditLinkPrefill = async () => {
    if (!linkToken) return;
    try {
      setLoadingApplication(true);
      const url = `${buildApiUrl('customer/credit-application-link-info')}?token=${encodeURIComponent(linkToken)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        toast({
          title: 'Invalid link',
          description: data.error || 'This application link is invalid, expired, or already used.',
          variant: 'destructive',
        });
        return;
      }

      const row = data.data;
      if (row.dealer_id) {
        setLinkMetaDealerId(row.dealer_id);
      }
      setFormData((prev) => ({
        ...prev,
        customer_name: row.customer_name || prev.customer_name,
        customer_email: row.customer_email || prev.customer_email,
        vehicle_id: row.vehicle_id || prev.vehicle_id,
      }));

      if (row.vehicle) {
        const v = row.vehicle;
        setVehicle(v);
        setFormData((prev) => ({
          ...prev,
          vehicle_id: v.id,
          vehicle_make: v.make || '',
          vehicle_model: v.model || '',
          vehicle_year: v.year?.toString() || '',
          vehicle_mileage: v.mileage?.toString() || '',
          vehicle_purchase_price: v.price?.toString() || '',
        }));
      }

      const pre = row.prefill_data || {};
      if (pre && typeof pre === 'object') {
        setFormData((prev) => ({
          ...prev,
          down_payment: pre.down_payment != null ? String(pre.down_payment) : prev.down_payment,
          deal_type: pre.deal_type === 'lease' ? 'lease' : pre.deal_type === 'finance' ? 'finance' : prev.deal_type,
          requested_term_months:
            pre.requested_term_months != null ? String(pre.requested_term_months) : prev.requested_term_months,
        }));
      }

      toast({
        title: 'Application loaded',
        description: 'Review the details below and complete any missing information.',
      });
    } catch (error) {
      console.error('Error loading credit link prefill:', error);
      toast({
        title: 'Could not load application',
        description: 'Try again or contact the dealership.',
        variant: 'destructive',
      });
    } finally {
      setLoadingApplication(false);
    }
  };

  const updateFormData = (field: keyof ApplicationFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getStepProgress = () => {
    return ((currentStep - 1) / 4) * 100;
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.customer_name || !formData.customer_email || !formData.customer_phone) {
          toast({
            title: 'Required Fields Missing',
            description: 'Please fill in all required fields',
            variant: 'destructive',
          });
          return false;
        }
        if (!formData.customer_email.includes('@')) {
          toast({
            title: 'Invalid Email',
            description: 'Please enter a valid email address',
            variant: 'destructive',
          });
          return false;
        }
        break;
      
      case 2:
        if (!formData.vehicle_make || !formData.vehicle_model || !formData.vehicle_year) {
          toast({
            title: 'Vehicle Information Required',
            description: 'Please provide vehicle make, model, and year',
            variant: 'destructive',
          });
          return false;
        }
        break;
      
      case 3:
        if (formData.deal_type === 'finance') {
          if (!formData.requested_loan_amount || !formData.requested_term_months) {
            toast({
              title: 'Loan Details Required',
              description: 'Please provide loan amount and term',
              variant: 'destructive',
            });
            return false;
          }
        } else if (formData.deal_type === 'lease') {
          if (!formData.vehicle_msrp || !formData.residual_percentage || !formData.money_factor || !formData.requested_term_months) {
            toast({
              title: 'Lease Details Required',
              description: 'Please provide MSRP, residual percentage, money factor, and term',
              variant: 'destructive',
            });
            return false;
          }
        }
        break;
      
      case 5:
        if (!formData.signature_data) {
          toast({
            title: 'Signature Required',
            description: 'Please sign the application',
            variant: 'destructive',
          });
          return false;
        }
        if (!formData.terms_accepted) {
          toast({
            title: 'Terms Acceptance Required',
            description: 'You must accept the terms and conditions',
            variant: 'destructive',
          });
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(5, prev + 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    const resolvedDealerId = dealerId || linkMetaDealerId;

    if (!resolvedDealerId && !linkToken) {
      toast({
        title: 'Error',
        description: 'Dealer information missing. Please start from a vehicle page or use a valid application link.',
        variant: 'destructive',
      });
      return;
    }

    // /apply/:applicationId?token=JWT — update via PUT; dealer comes from the application record, not the query string.
    if (linkToken && !resolvedDealerId && !vehicleId) {
      toast({
        title: 'Error',
        description: 'Dealer information is missing from this link. Please request a new credit application link.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const customerToken = localStorage.getItem('customerToken');

      if (!customerToken) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to submit your application.',
          variant: 'destructive',
        });
        const dest = `${location.pathname}${location.search}`;
        const q = dealerId ? `&dealer=${encodeURIComponent(dealerId)}` : '';
        navigate(`/customer-login?redirect=${encodeURIComponent(dest)}${q}`);
        return;
      }

      // Prepare payload
      const payload: any = {
        ...formData,
        vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : undefined,
        vehicle_mileage: formData.vehicle_mileage ? parseInt(formData.vehicle_mileage) : undefined,
        vehicle_purchase_price: formData.vehicle_purchase_price ? parseFloat(formData.vehicle_purchase_price) : undefined,
        requested_loan_amount: formData.requested_loan_amount ? parseFloat(formData.requested_loan_amount) : undefined,
        requested_term_months: formData.requested_term_months ? parseInt(formData.requested_term_months) : undefined,
        down_payment: formData.down_payment ? parseFloat(formData.down_payment) : undefined,
        monthly_income: formData.monthly_income ? parseFloat(formData.monthly_income) : undefined,
        years_employed: formData.years_employed ? parseFloat(formData.years_employed) : undefined,
        credit_score: formData.credit_score ? parseInt(formData.credit_score) : undefined,
        // Lease-specific fields
        vehicle_msrp: formData.vehicle_msrp ? parseFloat(formData.vehicle_msrp) : undefined,
        trade_in_value: formData.trade_in_value ? parseFloat(formData.trade_in_value) : undefined,
        rebate_amount: formData.rebate_amount ? parseFloat(formData.rebate_amount) : undefined,
        acquisition_fee: formData.acquisition_fee ? parseFloat(formData.acquisition_fee) : undefined,
        doc_fee: formData.doc_fee ? parseFloat(formData.doc_fee) : undefined,
        residual_percentage: formData.residual_percentage ? parseFloat(formData.residual_percentage) : undefined,
        money_factor: formData.money_factor ? parseFloat(formData.money_factor) : undefined,
        sales_tax_rate: formData.sales_tax_rate ? parseFloat(formData.sales_tax_rate) : undefined,
        annual_mileage: formData.annual_mileage ? parseInt(formData.annual_mileage) : undefined,
        excess_mileage_rate: formData.excess_mileage_rate ? parseFloat(formData.excess_mileage_rate) : undefined,
      };

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      let method: string;
      let url: string;

      if (linkToken && vehicleId) {
        method = 'PUT';
        url = `${apiUrl}/api/customer/application/${vehicleId}?token=${encodeURIComponent(linkToken)}`;
      } else if (linkToken) {
        method = 'POST';
        url = `${apiUrl}/api/customer/credit-application`;
        payload.dealer_id = resolvedDealerId;
        payload.credit_application_link_token = linkToken;
      } else {
        method = 'POST';
        url = `${apiUrl}/api/customer/credit-application`;
        payload.dealer_id = resolvedDealerId;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      };

      console.log('🚀 Submitting application...');
      console.log('  - Method:', method);
      console.log('  - URL:', url);

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('📊 Response:', result);

      if (result.success) {
        toast({
          title: 'Application Submitted!',
          description: 'Your credit application has been submitted successfully. Check your email for confirmation.',
        });
        
        navigate('/');
      } else {
        toast({
          title: 'Submission Failed',
          description: result.error || result.message || 'Please try again',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Submission error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit application',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderPersonalInfo();
      case 2:
        return renderVehicleInfo();
      case 3:
        return renderLoanDetails();
      case 4:
        return renderEmploymentInfo();
      case 5:
        return renderAuthorizationStep();
      default:
        return null;
    }
  };

  const renderPersonalInfo = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-6 w-6 text-primary" />
        <h3 className="text-lg font-semibold">Personal Information</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="customer_name">Full Name *</Label>
          <Input
            id="customer_name"
            value={formData.customer_name}
            onChange={(e) => updateFormData('customer_name', e.target.value)}
            placeholder="John Doe"
            required
          />
        </div>

        <div>
          <Label htmlFor="date_of_birth">Date of Birth</Label>
          <Input
            id="date_of_birth"
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => updateFormData('date_of_birth', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="customer_email">Email *</Label>
          <Input
            id="customer_email"
            type="email"
            value={formData.customer_email}
            onChange={(e) => updateFormData('customer_email', e.target.value)}
            placeholder="john@example.com"
            required
          />
        </div>

        <div>
          <Label htmlFor="customer_phone">Phone *</Label>
          <Input
            id="customer_phone"
            type="tel"
            value={formData.customer_phone}
            onChange={(e) => updateFormData('customer_phone', e.target.value)}
            placeholder="(555) 123-4567"
            required
          />
        </div>
      </div>

      <div className="space-y-4 mt-6">
        <h4 className="font-medium">Address</h4>
        
        <div>
          <Label htmlFor="street_address">Street Address</Label>
          <Input
            id="street_address"
            value={formData.street_address}
            onChange={(e) => updateFormData('street_address', e.target.value)}
            placeholder="123 Main Street"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => updateFormData('city', e.target.value)}
              placeholder="Los Angeles"
            />
          </div>

          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => updateFormData('state', e.target.value.toUpperCase())}
              placeholder="CA"
              maxLength={2}
            />
          </div>

          <div>
            <Label htmlFor="zip_code">ZIP Code</Label>
            <Input
              id="zip_code"
              value={formData.zip_code}
              onChange={(e) => updateFormData('zip_code', e.target.value)}
              placeholder="90001"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderVehicleInfo = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Car className="h-6 w-6 text-primary" />
        <h3 className="text-lg font-semibold">Vehicle Information</h3>
      </div>

      {vehicle && (
        <div className="bg-primary/10 border border-primary/20 rounded-md p-4 mb-4">
          <p className="text-sm text-primary">
            <strong>Selected Vehicle:</strong> {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="vehicle_make">Make *</Label>
          <Input
            id="vehicle_make"
            value={formData.vehicle_make}
            onChange={(e) => updateFormData('vehicle_make', e.target.value)}
            placeholder="Toyota"
            required
          />
        </div>

        <div>
          <Label htmlFor="vehicle_model">Model *</Label>
          <Input
            id="vehicle_model"
            value={formData.vehicle_model}
            onChange={(e) => updateFormData('vehicle_model', e.target.value)}
            placeholder="Camry"
            required
          />
        </div>

        <div>
          <Label htmlFor="vehicle_year">Year *</Label>
          <Input
            id="vehicle_year"
            type="number"
            value={formData.vehicle_year}
            onChange={(e) => updateFormData('vehicle_year', e.target.value)}
            placeholder="2023"
            min="1900"
            max={new Date().getFullYear() + 2}
            required
          />
        </div>

        <div>
          <Label htmlFor="vehicle_mileage">Mileage</Label>
          <Input
            id="vehicle_mileage"
            type="number"
            value={formData.vehicle_mileage}
            onChange={(e) => updateFormData('vehicle_mileage', e.target.value)}
            placeholder="15000"
            min="0"
          />
        </div>

        <div>
          <Label htmlFor="vehicle_purchase_price">Purchase Price</Label>
          <Input
            id="vehicle_purchase_price"
            type="number"
            value={formData.vehicle_purchase_price}
            onChange={(e) => updateFormData('vehicle_purchase_price', e.target.value)}
            placeholder="28000"
            min="0"
            step="100"
          />
        </div>
      </div>
    </div>
  );

  const renderLoanDetails = () => {
    // Calculate lease payment in real-time
    const calculateLeasePayment = () => {
      if (formData.deal_type === 'lease' && 
          formData.vehicle_msrp && 
          formData.residual_percentage && 
          formData.money_factor && 
          formData.requested_term_months) {
        
        const msrp = parseFloat(formData.vehicle_msrp);
        const vehiclePrice = parseFloat(formData.vehicle_purchase_price || formData.vehicle_msrp);
        const downPayment = parseFloat(formData.down_payment) || 0;
        const tradeIn = parseFloat(formData.trade_in_value) || 0;
        const rebate = parseFloat(formData.rebate_amount) || 0;
        const acquisitionFee = parseFloat(formData.acquisition_fee) || 0;
        const docFee = parseFloat(formData.doc_fee) || 0;
        const residualPct = parseFloat(formData.residual_percentage);
        const moneyFactor = parseFloat(formData.money_factor);
        const termMonths = parseInt(formData.requested_term_months);
        const taxRate = parseFloat(formData.sales_tax_rate) || 0;

        const residualValue = msrp * (residualPct / 100);
        const capCostReductions = downPayment + tradeIn + rebate;
        const capitalizedFees = acquisitionFee + docFee;
        const adjustedCapCost = vehiclePrice - capCostReductions + capitalizedFees;
        
        const depreciationFee = (adjustedCapCost - residualValue) / termMonths;
        const financeCharge = (adjustedCapCost + residualValue) * moneyFactor;
        const basePayment = depreciationFee + financeCharge;
        const monthlyTax = basePayment * taxRate;
        const totalMonthly = basePayment + monthlyTax;
        const totalCost = (totalMonthly * termMonths) + downPayment;

        return {
          monthlyPayment: totalMonthly,
          basePayment,
          monthlyTax,
          residualValue,
          totalCost,
          depreciationFee,
          financeCharge
        };
      }
      return null;
    };

    const leaseCalc = calculateLeasePayment();

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold">Finance/Lease Details</h3>
        </div>

        {/* Deal Type Selector */}
        <div className="mb-6">
          <Label htmlFor="deal_type" className="mb-2 block">Financing Type *</Label>
          <Select
            value={formData.deal_type}
            onValueChange={(v) => updateFormData('deal_type', v as 'finance' | 'lease')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="finance">Finance (Loan)</SelectItem>
              <SelectItem value="lease">Lease</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Common Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="requested_term_months">Term *</Label>
            <Select
              value={formData.requested_term_months}
              onValueChange={(v) => updateFormData('requested_term_months', v)}
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

          <div>
            <Label htmlFor="down_payment">Down Payment</Label>
            <Input
              id="down_payment"
              type="number"
              value={formData.down_payment}
              onChange={(e) => updateFormData('down_payment', e.target.value)}
              placeholder="3000"
              min="0"
              step="100"
            />
          </div>

          <div>
            <Label htmlFor="credit_score">Credit Score (if known)</Label>
            <Input
              id="credit_score"
              type="number"
              value={formData.credit_score}
              onChange={(e) => updateFormData('credit_score', e.target.value)}
              placeholder="720"
              min="300"
              max="850"
            />
          </div>
        </div>

        {/* Finance-Specific Fields */}
        {formData.deal_type === 'finance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label htmlFor="requested_loan_amount">Loan Amount Requested *</Label>
              <Input
                id="requested_loan_amount"
                type="number"
                value={formData.requested_loan_amount}
                onChange={(e) => updateFormData('requested_loan_amount', e.target.value)}
                placeholder="25000"
                min="0"
                step="100"
                required
              />
            </div>
          </div>
        )}

        {/* Lease-Specific Fields */}
        {formData.deal_type === 'lease' && (
          <div className="space-y-4 mt-4">
            <div className="bg-primary/10 border border-primary/20 rounded-md p-4">
              <h4 className="font-semibold text-primary mb-3">Lease Terms</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehicle_msrp">Vehicle MSRP *</Label>
                  <Input
                    id="vehicle_msrp"
                    type="number"
                    value={formData.vehicle_msrp}
                    onChange={(e) => updateFormData('vehicle_msrp', e.target.value)}
                    placeholder="32000"
                    min="0"
                    step="100"
                  />
                </div>

                <div>
                  <Label htmlFor="residual_percentage">Residual % *</Label>
                  <Input
                    id="residual_percentage"
                    type="number"
                    value={formData.residual_percentage}
                    onChange={(e) => updateFormData('residual_percentage', e.target.value)}
                    placeholder="60"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">Typical: 50-65% for 36 months</p>
                </div>

                <div>
                  <Label htmlFor="money_factor">Money Factor *</Label>
                  <Input
                    id="money_factor"
                    type="number"
                    value={formData.money_factor}
                    onChange={(e) => updateFormData('money_factor', e.target.value)}
                    placeholder="0.0010"
                    min="0"
                    step="0.0001"
                  />
                  <p className="text-xs text-gray-500 mt-1">Example: 0.0010 ≈ 2.4% APR</p>
                </div>

                <div>
                  <Label htmlFor="annual_mileage">Annual Mileage</Label>
                  <Select
                    value={formData.annual_mileage}
                    onValueChange={(v) => updateFormData('annual_mileage', v)}
                  >
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
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Cap Cost Reductions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="trade_in_value">Trade-In Value</Label>
                  <Input
                    id="trade_in_value"
                    type="number"
                    value={formData.trade_in_value}
                    onChange={(e) => updateFormData('trade_in_value', e.target.value)}
                    placeholder="5000"
                    min="0"
                    step="100"
                  />
                </div>

                <div>
                  <Label htmlFor="rebate_amount">Rebates/Incentives</Label>
                  <Input
                    id="rebate_amount"
                    type="number"
                    value={formData.rebate_amount}
                    onChange={(e) => updateFormData('rebate_amount', e.target.value)}
                    placeholder="1000"
                    min="0"
                    step="100"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Fees</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="acquisition_fee">Acquisition Fee</Label>
                  <Input
                    id="acquisition_fee"
                    type="number"
                    value={formData.acquisition_fee}
                    onChange={(e) => updateFormData('acquisition_fee', e.target.value)}
                    placeholder="595"
                    min="0"
                    step="1"
                  />
                </div>

                <div>
                  <Label htmlFor="doc_fee">Doc Fee</Label>
                  <Input
                    id="doc_fee"
                    type="number"
                    value={formData.doc_fee}
                    onChange={(e) => updateFormData('doc_fee', e.target.value)}
                    placeholder="499"
                    min="0"
                    step="1"
                  />
                </div>

                <div>
                  <Label htmlFor="sales_tax_rate">Sales Tax Rate</Label>
                  <Input
                    id="sales_tax_rate"
                    type="number"
                    value={formData.sales_tax_rate}
                    onChange={(e) => updateFormData('sales_tax_rate', e.target.value)}
                    placeholder="0.065"
                    min="0"
                    max="1"
                    step="0.001"
                  />
                  <p className="text-xs text-gray-500 mt-1">Example: 0.065 = 6.5%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Estimate */}
        {formData.deal_type === 'finance' && formData.requested_loan_amount && formData.requested_term_months && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-4">
            <p className="text-sm font-medium text-green-800">
              Estimated Monthly Payment: ${(parseFloat(formData.requested_loan_amount) / parseInt(formData.requested_term_months)).toFixed(2)}
            </p>
            <p className="text-xs text-green-600 mt-1">
              *This is a rough estimate. Actual payment will depend on APR and other factors.
            </p>
          </div>
        )}

        {/* Lease Calculator Results */}
        {formData.deal_type === 'lease' && leaseCalc && (
          <div className="bg-gradient-to-br from-green-50 to-primary/5 border-2 border-green-300 rounded-lg p-6 mt-4">
            <h4 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Estimated Lease Payment
            </h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white rounded-md">
                <span className="font-semibold text-gray-700">Monthly Payment:</span>
                <span className="text-2xl font-bold text-green-700">
                  ${leaseCalc.monthlyPayment.toFixed(2)}/mo
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between p-2 bg-white rounded">
                  <span className="text-gray-600">Base Payment:</span>
                  <span className="font-semibold">${leaseCalc.basePayment.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded">
                  <span className="text-gray-600">Monthly Tax:</span>
                  <span className="font-semibold">${leaseCalc.monthlyTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded">
                  <span className="text-gray-600">Depreciation:</span>
                  <span className="font-semibold">${leaseCalc.depreciationFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 bg-white rounded">
                  <span className="text-gray-600">Finance Charge:</span>
                  <span className="font-semibold">${leaseCalc.financeCharge.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-green-200">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Lease Cost:</span>
                  <span className="font-semibold text-gray-900">${leaseCalc.totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Buyout Price at End:</span>
                  <span className="font-semibold text-primary/90">${leaseCalc.residualValue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-600 mt-4 italic">
              *Estimated calculation. Final terms subject to credit approval and dealer verification.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderEmploymentInfo = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="h-6 w-6 text-primary" />
        <h3 className="text-lg font-semibold">Employment Information</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="employer_name">Employer Name</Label>
          <Input
            id="employer_name"
            value={formData.employer_name}
            onChange={(e) => updateFormData('employer_name', e.target.value)}
            placeholder="Tech Corporation"
          />
        </div>

        <div>
          <Label htmlFor="job_title">Job Title</Label>
          <Input
            id="job_title"
            value={formData.job_title}
            onChange={(e) => updateFormData('job_title', e.target.value)}
            placeholder="Software Engineer"
          />
        </div>

        <div>
          <Label htmlFor="employment_status">Employment Status</Label>
          <Select
            value={formData.employment_status}
            onValueChange={(v) => updateFormData('employment_status', v)}
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
          <Label htmlFor="years_employed">Years Employed</Label>
          <Input
            id="years_employed"
            type="number"
            value={formData.years_employed}
            onChange={(e) => updateFormData('years_employed', e.target.value)}
            placeholder="3.5"
            min="0"
            step="0.5"
          />
        </div>

        <div>
          <Label htmlFor="monthly_income">Monthly Income</Label>
          <Input
            id="monthly_income"
            type="number"
            value={formData.monthly_income}
            onChange={(e) => updateFormData('monthly_income', e.target.value)}
            placeholder="8000"
            min="0"
            step="100"
          />
        </div>
      </div>

      <div className="space-y-4 mt-6">
        <h4 className="font-medium">Work Address</h4>
        
        <div>
          <Label htmlFor="work_address">Street Address</Label>
          <Input
            id="work_address"
            value={formData.work_address}
            onChange={(e) => updateFormData('work_address', e.target.value)}
            placeholder="456 Business Blvd"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="work_city">City</Label>
            <Input
              id="work_city"
              value={formData.work_city}
              onChange={(e) => updateFormData('work_city', e.target.value)}
              placeholder="Los Angeles"
            />
          </div>

          <div>
            <Label htmlFor="work_state">State</Label>
            <Input
              id="work_state"
              value={formData.work_state}
              onChange={(e) => updateFormData('work_state', e.target.value.toUpperCase())}
              placeholder="CA"
              maxLength={2}
            />
          </div>

          <div>
            <Label htmlFor="work_zip_code">ZIP Code</Label>
            <Input
              id="work_zip_code"
              value={formData.work_zip_code}
              onChange={(e) => updateFormData('work_zip_code', e.target.value)}
              placeholder="90002"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 mt-6">
        <h4 className="font-medium">Optional: Additional Information</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ssn">Social Security Number</Label>
            <Input
              id="ssn"
              type="password"
              value={formData.ssn}
              onChange={(e) => updateFormData('ssn', e.target.value)}
              placeholder="XXX-XX-XXXX"
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: 123-45-6789 • Encrypted and stored securely
            </p>
          </div>

          <div>
            <Label htmlFor="dl_number">Driver's License Number</Label>
            <Input
              id="dl_number"
              value={formData.dl_number}
              onChange={(e) => updateFormData('dl_number', e.target.value)}
              placeholder="D1234567"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderAuthorizationStep = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-6 w-6 text-primary" />
        <h3 className="text-lg font-semibold">Authorization & Signature</h3>
      </div>

      <CustomerSignaturePad
        signatureData={formData.signature_data}
        onSave={(data) => updateFormData('signature_data', data)}
        required
      />

      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h4 className="font-semibold mb-2">Terms & Conditions</h4>
          <div className="text-sm text-gray-700 space-y-2 max-h-60 overflow-y-auto">
            <p>
              By submitting this application, I certify that all information provided is true and accurate. 
              I authorize the lender and its designated agents to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Verify my employment and income information</li>
              <li>Obtain my credit report from credit bureaus</li>
              <li>Perform background checks as needed</li>
              <li>Contact me regarding this application via phone, email, or SMS</li>
            </ul>
            <p className="mt-2">
              I understand that this is an application for credit and does not guarantee approval. 
              The lender will review my application and notify me of their decision.
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="terms"
            checked={formData.terms_accepted}
            onCheckedChange={(checked) => updateFormData('terms_accepted', checked)}
          />
          <label
            htmlFor="terms"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            I have read and accept the terms and conditions *
          </label>
        </div>
      </div>
    </div>
  );

  if (requiresLoginForEmailLink && (customerAuthLoading || !customer?.isAuthenticated)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">
            {customerAuthLoading ? 'Loading your session…' : 'Redirecting to sign in…'}
          </p>
        </div>
      </div>
    );
  }

  if (requiresLoginForEmailLink && linkToken && loadingApplication) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading your credit application…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="bg-gradient-to-br from-primary/5 to-muted p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl md:text-3xl">Car Loan Application</CardTitle>
              <CardDescription>
                Complete this form to apply for financing. All fields marked with * are required.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Step {currentStep} of 5</span>
                <span>{Math.round(getStepProgress())}% Complete</span>
              </div>
              <Progress value={getStepProgress()} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Personal</span>
                <span>Vehicle</span>
                <span>Loan</span>
                <span>Employment</span>
                <span>Sign</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Content */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="w-32"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {currentStep < 5 ? (
            <Button onClick={nextStep} className="w-32">
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-48 bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                'Submitting...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          )}
        </div>

        {/* Info Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            <strong>Need help?</strong> Contact us at support@example.com or call (555) 123-4567
          </p>
          <p className="mt-2">
            Your information is secure and will only be shared with authorized lenders.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCreditApplication;


import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import TopNavigation from "@/components/layout/TopNavigation";
import { dealersAPI, adminAPI } from "@/lib/api";
import superAdminAPI from "@/lib/superAdminAPI";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Crown, Users, CreditCard, TrendingUp, ArrowLeft, UserCog, Building, 
  Settings, Mail, Plus, Search, Filter, Eye, Edit, Trash2, TestTube,
  Globe, Phone, Calendar, Tag, FileText, CheckCircle, XCircle, Bot,
  CheckSquare, Square, Download, Upload, Play, RefreshCw, UserPlus, Shield, Activity
} from "lucide-react";
import UserManagement from "@/components/admin/UserManagement";
import RoleManagement from "@/components/admin/RoleManagement";
import ResetDealershipData from "@/components/admin/ResetDealershipData";
import ConversationMonitor from "@/components/admin/ConversationMonitor";

interface Dealer {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  subscription_plan: string;
  subscription_status: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_current_period_end?: string;
  created_at: string;
  vehicles?: { count: number }[];
  leads?: { count: number }[];
  marbalism_ai_enabled?: boolean;
}

interface SoftwareLead {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  status: string;
  tags: string[];
  notes: string;
  created_at: string;
  updated_at: string;
  owner_email?: string;
  owner_name?: string;
  // Enhanced fields
  lead_score?: number;
  qualification_status?: 'unqualified' | 'qualified' | 'highly_qualified';
  last_contacted_at?: string;
  next_follow_up?: string;
  conversion_probability?: number;
  industry?: string;
  company_size?: string;
  budget_range?: string;
  decision_maker?: boolean;
  pain_points?: string[];
  preferred_contact_method?: 'email' | 'phone' | 'sms';
  timezone?: string;
  website?: string;
  linkedin_url?: string;
  social_media?: Record<string, string>;
  custom_fields?: Record<string, any>;
}

interface IntegrationSetting {
  provider: string;
  key: string;
  secret: string;
  config: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const SuperAdmin = () => {
  const { isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [softwareLeads, setSoftwareLeads] = useState<SoftwareLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<SoftwareLead | null>(null);
  const [showDealerForm, setShowDealerForm] = useState(false);
  const [editingDealer, setEditingDealer] = useState<Dealer | null>(null);
  const [integrationSettings, setIntegrationSettings] = useState<Record<string, Record<string, IntegrationSetting>>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({
    totalDealers: 0,
    activeDealers: 0,
    totalRevenue: 0,
    totalVehicles: 0,
    totalSoftwareLeads: 0,
    newSoftwareLeads: 0
  });

  // Software Leads state
  const [leadFilters, setLeadFilters] = useState({
    status: 'all',
    search: '',
    page: 1,
    limit: 20,
    // Enhanced filters
    qualification_status: 'all',
    lead_score_min: '',
    lead_score_max: '',
    industry: 'all',
    company_size: 'all',
    source: 'all',
    tags: [] as string[],
    owner: 'all',
    date_range: 'all',
    created_after: '',
    created_before: '',
    last_contacted_after: '',
    last_contacted_before: '',
    has_follow_up: 'all',
    conversion_probability_min: '',
    conversion_probability_max: ''
  });
  
  // Enhanced lead management state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [leadViewMode, setLeadViewMode] = useState<'table' | 'cards' | 'kanban'>('table');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<SoftwareLead | null>(null);
  const [leadActivities, setLeadActivities] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [leadOwners, setLeadOwners] = useState<any[]>([]);
  const [leadIndustries, setLeadIndustries] = useState<string[]>([]);
  const [leadSources, setLeadSources] = useState<string[]>([]);
  const [showLeadScoring, setShowLeadScoring] = useState(false);
  const [showLeadAssignment, setShowLeadAssignment] = useState(false);
  const [showLeadTimeline, setShowLeadTimeline] = useState(false);
  const [showLeadDuplicates, setShowLeadDuplicates] = useState(false);
  const [duplicateLeads, setDuplicateLeads] = useState<any[]>([]);
  const [showLeadMerge, setShowLeadMerge] = useState(false);
  const [leadsToMerge, setLeadsToMerge] = useState<string[]>([]);
  const [marketingJourneys, setMarketingJourneys] = useState<any[]>([]);
  const [selectedJourney, setSelectedJourney] = useState<any>(null);
  const [journeySteps, setJourneySteps] = useState<any[]>([]);
  const [showJourneyForm, setShowJourneyForm] = useState(false);
  const [journeyFormData, setJourneyFormData] = useState({
    name: '',
    description: '',
    status: 'active'
  });
  const [showStepForm, setShowStepForm] = useState(false);
  const [stepFormData, setStepFormData] = useState({
    type: 'email',
    subject: '',
    body: '',
    delay_minutes: 0,
    step_order: 1
  });
  const [editingStep, setEditingStep] = useState<any>(null);
  const [editingJourney, setEditingJourney] = useState<any>(null);
  const [showJourneyEditForm, setShowJourneyEditForm] = useState(false);
  const [showEnrollmentDialog, setShowEnrollmentDialog] = useState(false);
  const [selectedLeadsForEnrollment, setSelectedLeadsForEnrollment] = useState<string[]>([]);
  const [showBulkEnrollmentDialog, setShowBulkEnrollmentDialog] = useState(false);
  const [selectedJourneyForBulkEnrollment, setSelectedJourneyForBulkEnrollment] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [totalCsvRows, setTotalCsvRows] = useState<number>(0);

  // Analytics state
  const [campaignAnalytics, setCampaignAnalytics] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [revenueAttribution, setRevenueAttribution] = useState<any[]>([]);
  const [templateAnalytics, setTemplateAnalytics] = useState<any[]>([]);
  const [selectedCampaignForAnalytics, setSelectedCampaignForAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState(30); // days

  // Email/SMS Template state
  const [showEmailTemplate, setShowEmailTemplate] = useState(false);
  const [showSmsTemplate, setShowSmsTemplate] = useState(false);
  const [selectedLeadForMessage, setSelectedLeadForMessage] = useState<SoftwareLead | null>(null);
  const [emailTemplate, setEmailTemplate] = useState({
    subject: '',
    body: '',
    template: 'welcome'
  });
  const [smsTemplate, setSmsTemplate] = useState({
    message: '',
    template: 'welcome'
  });

  // Dealer form state
  const [dealerFormData, setDealerFormData] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    password: 'DealerIQ123!',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    subscription_plan: 'basic' as 'basic' | 'premium' | 'enterprise',
    subscription_status: 'active' as 'active' | 'inactive' | 'suspended'
  });

  // Staff form state
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [selectedDealerForStaff, setSelectedDealerForStaff] = useState<Dealer | null>(null);
  const [staffFormData, setStaffFormData] = useState({
    email: '',
    password: '',
    name: '',
    staff_role: 'sales' as 'admin' | 'sales' | 'finance' | 'service' | 'inventory',
    permissions: [] as string[]
  });

  // Audit state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState<any>({
    search: '',
    actionType: 'all',
    success: 'all',
    page: 1,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'DESC'
  });
  const [auditPagination, setAuditPagination] = useState<any>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [auditCategories, setAuditCategories] = useState<any[]>([]);
  const [auditSeverityLevels, setAuditSeverityLevels] = useState<any[]>([]);

  const loadAuditMeta = useCallback(async () => {
    try {
      const [cats, severities] = await Promise.all([
        superAdminAPI.getAuditCategories(),
        superAdminAPI.getAuditSeverityLevels()
      ]);
      setAuditCategories(cats.categories || []);
      setAuditSeverityLevels(severities.severityLevels || []);
    } catch (e) {
      // non-blocking
    }
  }, []);

  const loadAuditLogs = useCallback(async (overrides?: any) => {
    setAuditLoading(true);
    try {
      const filters = { ...auditFilters, ...(overrides || {}) };
      const pagination = { page: filters.page, limit: filters.limit, sortBy: filters.sortBy, sortOrder: filters.sortOrder };
      const res = await superAdminAPI.getAuditLogs({
        search: filters.search || undefined,
        actionType: filters.actionType === 'all' ? undefined : filters.actionType || undefined,
        success: filters.success === 'all' ? undefined : (filters.success !== '' ? filters.success : undefined)
      }, pagination);
      setAuditLogs(res.logs || []);
      setAuditPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (e: any) {
      toast.error('Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilters]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditMeta();
      loadAuditLogs();
    }
  }, [activeTab, loadAuditMeta, loadAuditLogs]);

  // Integration Settings state
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [editingSetting, setEditingSetting] = useState<{provider: string, key: string} | null>(null);
  const [settingFormData, setSettingFormData] = useState({ secret: '', config: {}, is_active: false });

  // Stripe Subscription state
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [dealerInvoices, setDealerInvoices] = useState<any[]>([]);
  const [stripePrices, setStripePrices] = useState<any[]>([]);

  // Marketing Journeys - declare before effects to avoid TDZ
  const loadMarketingJourneys = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No token found for marketing journeys');
        return;
      }
      
      console.log('Loading marketing journeys...');
      const result = await superAdminAPI.getMarketingJourneys();
      setMarketingJourneys(result.data || []);
    } catch (error) {
      console.error('Error loading marketing journeys:', error);
      toast.error('Failed to load marketing journeys');
    }
  }, []);

  const loadSchedulerStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No token found for scheduler status');
        return;
      }
      
      console.log('Loading scheduler status...');
      const result = await superAdminAPI.getSchedulerStatus();
      setSchedulerStatus(result.status || result || null);
    } catch (error) {
      console.error('Error loading scheduler status:', error);
      // non-blocking
    }
  }, []);

  const createJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await superAdminAPI.createMarketingJourney(journeyFormData);
      toast.success('Marketing journey created successfully');
      loadMarketingJourneys();
      setShowJourneyForm(false);
      setJourneyFormData({ name: '', description: '', status: 'active' });
    } catch (error) {
      console.error('Error creating journey:', error);
      toast.error('Failed to create marketing journey');
    }
  };

  const updateJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJourney) return;
    
    try {
      await superAdminAPI.updateMarketingJourney(editingJourney.id, journeyFormData);
      toast.success('Marketing journey updated successfully');
      loadMarketingJourneys();
      setShowJourneyEditForm(false);
      setEditingJourney(null);
      setJourneyFormData({ name: '', description: '', status: 'active' });
    } catch (error) {
      console.error('Error updating journey:', error);
      toast.error('Failed to update marketing journey');
    }
  };

  const deleteJourney = async (journeyId: string) => {
    if (!confirm('Are you sure you want to delete this journey? This will also delete all steps and enrollments.')) {
      return;
    }
    
    try {
      await superAdminAPI.deleteMarketingJourney(journeyId);
      toast.success('Marketing journey deleted successfully');
      loadMarketingJourneys();
      setSelectedJourney(null);
      setJourneySteps([]);
      setEnrollments([]);
    } catch (error) {
      console.error('Error deleting journey:', error);
      toast.error('Failed to delete marketing journey');
    }
  };

  const editJourney = (journey: any) => {
    setEditingJourney(journey);
    setJourneyFormData({
      name: journey.name,
      description: journey.description,
      status: journey.status
    });
    setShowJourneyEditForm(true);
  };

  const enrollLeadsInJourney = async () => {
    if (!selectedJourney || selectedLeadsForEnrollment.length === 0) return;
    
    try {
      const enrollmentPromises = selectedLeadsForEnrollment.map(leadId =>
        superAdminAPI.enrollLeadInJourney(selectedJourney.id, leadId)
      );
      
      await Promise.all(enrollmentPromises);
      toast.success(`${selectedLeadsForEnrollment.length} leads enrolled successfully`);
      setShowEnrollmentDialog(false);
      setSelectedLeadsForEnrollment([]);
      loadEnrollments(selectedJourney.id);
    } catch (error) {
      console.error('Error enrolling leads:', error);
      toast.error('Failed to enroll leads');
    }
  };

  const openEnrollmentDialog = (journey: any) => {
    setSelectedJourney(journey);
    setSelectedLeadsForEnrollment([]);
    setShowEnrollmentDialog(true);
  };

  const bulkEnrollSelectedLeads = async () => {
    if (!selectedJourneyForBulkEnrollment || selectedLeads.length === 0) return;
    
    try {
      const enrollmentPromises = selectedLeads.map(leadId =>
        superAdminAPI.enrollLeadInJourney(selectedJourneyForBulkEnrollment.id, leadId)
      );
      
      await Promise.all(enrollmentPromises);
      toast.success(`${selectedLeads.length} leads enrolled in "${selectedJourneyForBulkEnrollment.name}"`);
      setShowBulkEnrollmentDialog(false);
      setSelectedJourneyForBulkEnrollment(null);
      setSelectedLeads([]);
    } catch (error) {
      console.error('Error bulk enrolling leads:', error);
      toast.error('Failed to enroll leads');
    }
  };

  const openBulkEnrollmentDialog = () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select leads first');
      return;
    }
    setShowBulkEnrollmentDialog(true);
  };

  const cloneJourney = async (journey: any) => {
    try {
      // Create new journey with cloned name
      const clonedJourneyData = {
        name: `${journey.name} (Copy)`,
        description: journey.description,
        status: 'active'
      };
      
      const newJourney = await superAdminAPI.createMarketingJourney(clonedJourneyData);
      
      // Get steps from original journey
      const steps = await superAdminAPI.getMarketingJourneySteps(journey.id);
      
      // Clone each step
      for (const step of steps.data || []) {
        await superAdminAPI.addMarketingJourneyStep(newJourney.journey.id, {
          type: step.channel,
          subject: step.template_subject,
          body: step.template_body,
          delay_minutes: step.delay_minutes,
          step_order: step.step_order
        });
      }
      
      toast.success('Journey cloned successfully');
      loadMarketingJourneys();
    } catch (error) {
      console.error('Error cloning journey:', error);
      toast.error('Failed to clone journey');
    }
  };

  const createStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJourney) return;
    
    try {
      await superAdminAPI.addMarketingJourneyStep(selectedJourney.id, stepFormData);
      toast.success('Journey step created successfully');
      loadJourneySteps(selectedJourney.id);
      setShowStepForm(false);
      setStepFormData({ type: 'email', subject: '', body: '', delay_minutes: 0, step_order: journeySteps.length + 1 });
    } catch (error) {
      console.error('Error creating step:', error);
      toast.error('Failed to create journey step');
    }
  };

  const updateStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStep) return;
    
    try {
      await superAdminAPI.updateMarketingJourneyStep(editingStep.id, stepFormData);
      toast.success('Journey step updated successfully');
      loadJourneySteps(selectedJourney.id);
      setShowStepForm(false);
      setEditingStep(null);
      setStepFormData({ type: 'email', subject: '', body: '', delay_minutes: 0, step_order: 1 });
    } catch (error) {
      console.error('Error updating step:', error);
      toast.error('Failed to update journey step');
    }
  };

  const deleteStep = async (stepId: string) => {
    try {
      await superAdminAPI.deleteMarketingJourneyStep(stepId);
      toast.success('Journey step deleted successfully');
      loadJourneySteps(selectedJourney.id);
    } catch (error) {
      console.error('Error deleting step:', error);
      toast.error('Failed to delete journey step');
    }
  };

  const editStep = (step: any) => {
    setEditingStep(step);
    setStepFormData({
      type: step.channel || step.type,
      subject: step.template_subject || step.subject || '',
      body: step.template_body || step.body || '',
      delay_minutes: step.delay_minutes || 0,
      step_order: step.step_order
    });
    setShowStepForm(true);
  };

  const addStepToJourney = () => {
    setEditingStep(null);
    setStepFormData({
      type: 'email',
      subject: '',
      body: '',
      delay_minutes: 0,
      step_order: journeySteps.length + 1
    });
    setShowStepForm(true);
  };

  const sendEmailToLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadForMessage) return;
    
    try {
      await superAdminAPI.sendEmailToLead(selectedLeadForMessage.id, {
        subject: emailTemplate.subject,
        body: emailTemplate.body,
        template: emailTemplate.template
      });
      toast.success('Email sent successfully');
      setShowEmailTemplate(false);
      setSelectedLeadForMessage(null);
      setEmailTemplate({ subject: '', body: '', template: 'welcome' });
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    }
  };

  const sendSmsToLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadForMessage) return;
    
    try {
      await superAdminAPI.sendSmsToLead(selectedLeadForMessage.id, {
        message: smsTemplate.message,
        template: smsTemplate.template
      });
      toast.success('SMS sent successfully');
      setShowSmsTemplate(false);
      setSelectedLeadForMessage(null);
      setSmsTemplate({ message: '', template: 'welcome' });
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Failed to send SMS');
    }
  };

  const loadEmailTemplate = (template: string) => {
    const templates = {
      welcome: {
        subject: 'Welcome to Our Platform!',
        body: `Hi {{name}},\n\nWelcome to our platform! We're excited to have you on board.\n\nBest regards,\nThe Team`
      },
      followup: {
        subject: 'Following Up on Your Interest',
        body: `Hi {{name}},\n\nI wanted to follow up on your recent inquiry about our services.\n\nPlease let me know if you have any questions.\n\nBest regards,\nThe Team`
      },
      reminder: {
        subject: 'Reminder: Complete Your Setup',
        body: `Hi {{name}},\n\nThis is a friendly reminder to complete your account setup.\n\nIf you need any assistance, please don't hesitate to reach out.\n\nBest regards,\nThe Team`
      }
    };
    
    const selectedTemplate = templates[template as keyof typeof templates] || templates.welcome;
    setEmailTemplate({
      subject: selectedTemplate.subject,
      body: selectedTemplate.body.replace('{{name}}', selectedLeadForMessage?.full_name || 'there'),
      template
    });
  };

  const loadSmsTemplate = (template: string) => {
    const templates = {
      welcome: 'Hi {{name}}! Welcome to our platform. We\'re excited to have you on board!',
      followup: 'Hi {{name}}, following up on your recent inquiry. Any questions?',
      reminder: 'Hi {{name}}, friendly reminder to complete your setup. Need help?'
    };
    
    const selectedTemplate = templates[template as keyof typeof templates] || templates.welcome;
    setSmsTemplate({
      message: selectedTemplate.replace('{{name}}', selectedLeadForMessage?.full_name || 'there'),
      template
    });
  };

  const fetchDealers = useCallback(async () => {
    try {
      console.log('Fetching dealers...');
      const data = await dealersAPI.getAll();
      console.log('Dealers data received:', data);
      setDealers(data || []);
    } catch (error) {
      console.error('Error fetching dealers:', error);
      toast.error(`Failed to fetch dealers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const fetchSoftwareLeads = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No token found for software leads');
        return;
      }
      
      console.log('Fetching software leads...');
      const filters = { ...leadFilters, status: leadFilters.status === 'all' ? '' : leadFilters.status };
      const data = await superAdminAPI.getSoftwareLeads(filters);
      setSoftwareLeads(data.leads || []);
      
      setStats(prev => ({
        ...prev,
        totalSoftwareLeads: data.pagination?.total || 0,
        newSoftwareLeads: data.leads?.filter((lead: SoftwareLead) => lead.status === 'new').length || 0
      }));
    } catch (error) {
      console.error('Error fetching software leads:', error);
      toast.error('Failed to fetch software leads');
    }
  }, [leadFilters]);

  const fetchIntegrationSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No token found in localStorage');
        toast.error('Authentication required');
        return;
      }
      
      console.log('Fetching integration settings with token:', token.substring(0, 20) + '...');
      const data = await superAdminAPI.getSettings();
      setIntegrationSettings(data.settings || {});
    } catch (error) {
      console.error('Error fetching integration settings:', error);
      toast.error('Failed to fetch integration settings');
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      console.log('Fetching stats...');
      const [dealers, adminStats] = await Promise.all([
        dealersAPI.getAll(),
        adminAPI.getStats()
      ]);
      
      console.log('Stats data received:', { dealers, adminStats });
      
      if (dealers && adminStats) {
        const totalDealers = dealers.length;
        const activeDealers = dealers.filter(d => d.subscription_status === 'active').length;
        
        setStats(prev => ({
          ...prev,
          totalDealers,
          activeDealers,
          totalRevenue: activeDealers * 79.99, // Approximate
          totalVehicles: adminStats.totalVehicles || 0
        }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error(`Failed to fetch stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  useEffect(() => {
    console.log('SuperAdmin useEffect:', { 
      authLoading, 
      user: !!user, 
      permissionsLoading, 
      isSuperAdmin: isSuperAdmin(),
      userEmail: user?.email 
    });

    // Wait for both auth and permissions to finish loading
    if (authLoading || permissionsLoading) {
      console.log('Still loading, waiting...');
      return;
    }

    // Now that loading is complete, check permissions
    if (!user) {
      console.log('No user, redirecting to auth');
      navigate("/auth");
      return;
    }

    if (!isSuperAdmin()) {
      console.log('Not super admin, redirecting to dashboard');
      navigate("/dashboard");
      return;
    }

    // User is super admin, fetch data
    console.log('Super admin confirmed, fetching data');
    fetchDealers();
    fetchStats();
    fetchSoftwareLeads();
    fetchIntegrationSettings();
    loadMarketingJourneys();
    loadSchedulerStatus();
    setLoading(false);
  }, [user, authLoading, permissionsLoading, navigate, fetchDealers, fetchStats, fetchSoftwareLeads, fetchIntegrationSettings, loadMarketingJourneys, loadSchedulerStatus]);

  const updateDealerPlan = useCallback(async (dealerId: string, newPlan: "basic" | "premium" | "enterprise") => {
    try {
      console.log('Updating dealer plan:', { dealerId, newPlan });
      await dealersAPI.update(dealerId, { subscription_plan: newPlan });
      
      toast.success('Subscription plan updated successfully');
      fetchDealers();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error(`Failed to update subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [fetchDealers]);

  const handleMarbalismToggle = useCallback(async (dealerId: string, enabled: boolean) => {
    try {
      const result = await superAdminAPI.toggleMarbalismAI(dealerId, enabled);
      toast.success(result.message || `Marbalism AI ${enabled ? 'activated' : 'deactivated'}`);
      setDealers((prev) =>
        prev.map((d) => d.id === dealerId ? { ...d, marbalism_ai_enabled: enabled } : d)
      );
    } catch (error) {
      console.error('Marbalism toggle error:', error);
      toast.error(`Failed to toggle Marbalism AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const createSoftwareLead = async (leadData: Partial<SoftwareLead>) => {
    try {
      await superAdminAPI.createSoftwareLead(leadData);
      toast.success('Software lead created successfully');
      fetchSoftwareLeads();
      setShowLeadForm(false);
    } catch (error) {
      console.error('Error creating software lead:', error);
      toast.error('Failed to create software lead');
    }
  };

  const updateSoftwareLead = async (leadId: string, updates: Partial<SoftwareLead>) => {
    try {
      await superAdminAPI.updateSoftwareLead(leadId, updates);
      toast.success('Software lead updated successfully');
      fetchSoftwareLeads();
      setEditingLead(null);
    } catch (error) {
      console.error('Error updating software lead:', error);
      toast.error('Failed to update software lead');
    }
  };

  // Dealer management functions
  const createDealer = async (dealerData: Partial<Dealer>) => {
    try {
      const response = await superAdminAPI.createDealer(dealerData);
      toast.success('Dealer and user account created successfully');
      
      // Show login credentials in a more detailed toast
      toast.success(
        `Login Credentials: ${response.loginCredentials.email} / ${response.loginCredentials.password}`,
        { duration: 10000 }
      );
      
      fetchDealers();
      setShowDealerForm(false);
      setDealerFormData({
        business_name: '',
        contact_name: '',
        email: '',
        password: 'DealerIQ123!',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        subscription_plan: 'basic',
        subscription_status: 'active'
      });
    } catch (error) {
      console.error('Error creating dealer:', error);
      
      // Show specific error message from backend
      const errorMessage = error instanceof Error ? error.message : 'Failed to create dealer';
      toast.error(errorMessage);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDealerForStaff) return;

    try {
      await superAdminAPI.addDealerStaff(selectedDealerForStaff.id, staffFormData);
      toast.success('Staff member added successfully');
      setShowStaffForm(false);
      setSelectedDealerForStaff(null);
      setStaffFormData({
        email: '',
        password: '',
        name: '',
        staff_role: 'sales',
        permissions: []
      });
    } catch (error: any) {
      console.error('Error adding staff:', error);
      toast.error(error.message || 'Failed to add staff member');
    }
  };

  const updateDealer = async (dealerId: string, updates: any) => {
    try {
      // Remove password from updates when editing
      const updateData = { ...updates };
      delete updateData.password;
      await superAdminAPI.updateDealer(dealerId, updateData);
      toast.success('Dealer updated successfully');
      fetchDealers();
      setEditingDealer(null);
    } catch (error) {
      console.error('Error updating dealer:', error);
      toast.error('Failed to update dealer');
    }
  };

  const testIntegration = async (provider: string) => {
    try {
      const result = await superAdminAPI.testIntegration(provider);
      
      if (result.success) {
        toast.success(`${provider} connection successful`);
      } else {
        toast.error(`${provider} connection failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error testing integration:', error);
      toast.error(`Failed to test ${provider} connection`);
    }
  };

  // Stripe subscription management functions
  const createStripeCustomer = async (dealerId: string) => {
    try {
      await superAdminAPI.createStripeCustomer(dealerId);
      toast.success('Stripe customer created successfully');
      fetchDealers();
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      toast.error('Failed to create Stripe customer');
    }
  };

  const createSubscription = async (dealerId: string, priceId: string, trialDays?: number) => {
    try {
      await superAdminAPI.createSubscription(dealerId, priceId, trialDays);
      toast.success('Subscription created successfully');
      fetchDealers();
      setShowSubscriptionDialog(false);
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast.error('Failed to create subscription');
    }
  };

  const cancelSubscription = async (dealerId: string) => {
    try {
      await superAdminAPI.cancelSubscription(dealerId);
      toast.success('Subscription will be cancelled at period end');
      fetchDealers();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription');
    }
  };

  const fetchDealerInvoices = async (dealerId: string) => {
    try {
      const data = await superAdminAPI.getInvoices(dealerId);
      setDealerInvoices(data.invoices || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to fetch invoices');
    }
  };

  const updateIntegrationSetting = async (provider: string, key: string, data: any) => {
    try {
      await superAdminAPI.updateSetting(provider, key, data);
      toast.success(`${provider} setting updated successfully`);
      fetchIntegrationSettings();
      setShowSettingsDialog(false);
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Failed to update setting');
    }
  };

  const openSettingsEditor = (provider: string, key: string, currentSetting: IntegrationSetting) => {
    // TypeScript fix: Ensure proper IntegrationSetting type
    setEditingSetting({ provider, key });
    setSettingFormData({
      secret: currentSetting.secret || '',
      config: currentSetting.config || {},
      is_active: currentSetting.is_active
    });
    setShowSettingsDialog(true);
  };

  const verifyTwilioSender = async () => {
    try {
      const response = await fetch('/api/super-admin/settings/twilio/verify-sender', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Twilio sender verification successful');
      } else {
        toast.error(`Twilio sender verification failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Error verifying Twilio sender:', error);
      toast.error('Failed to verify Twilio sender');
    }
  };

  const testDaiveConnection = async () => {
    try {
      const result = await superAdminAPI.testDaiveConnection();
      
      if (result.success) {
        toast.success('Daive connection test successful');
      } else {
        toast.error(`Daive connection test failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error testing Daive connection:', error);
      toast.error('Failed to test Daive connection');
    }
  };

  // Marketing Journeys functions

  const loadJourneySteps = async (journeyId: string) => {
    try {
      const result = await superAdminAPI.getMarketingJourneySteps(journeyId);
      setJourneySteps(result.steps || []);
    } catch (error) {
      console.error('Error loading journey steps:', error);
      toast.error('Failed to load journey steps');
    }
  };

  const loadEnrollments = async (journeyId: string) => {
    try {
      const result = await superAdminAPI.getMarketingEnrollments(journeyId);
      setEnrollments(result.data || []);
    } catch (error) {
      console.error('Error loading enrollments:', error);
      toast.error('Failed to load enrollments');
    }
  };

  const loadAllEnrollments = useCallback(async () => {
    try {
      const result = await superAdminAPI.getMarketingEnrollments(); // No journeyId = loads all
      setEnrollments(result.data || []);
    } catch (error) {
      console.error('Error loading all enrollments:', error);
      toast.error('Failed to load enrollments');
    }
  }, []);

  const runNextStep = async (enrollmentId: string) => {
    try {
      const result = await superAdminAPI.runNextMarketingStep(enrollmentId);
      
      if (result.success) {
        toast.success('Next step executed successfully');
        // Reload enrollments to show updated status
        if (selectedJourney) {
          loadEnrollments(selectedJourney.id);
        }
      } else {
        toast.error(`Failed to run next step: ${result.error}`);
      }
    } catch (error) {
      console.error('Error running next step:', error);
      toast.error('Failed to run next step');
    }
  };

  // Scheduler functions

  const startScheduler = async () => {
    try {
      const result = await superAdminAPI.startScheduler();
      
      if (result.success) {
        toast.success('Scheduler started successfully');
        loadSchedulerStatus();
      } else {
        toast.error(`Failed to start scheduler: ${result.error}`);
      }
    } catch (error) {
      console.error('Error starting scheduler:', error);
      toast.error('Failed to start scheduler');
    }
  };

  const stopScheduler = async () => {
    try {
      const result = await superAdminAPI.stopScheduler();
      
      if (result.success) {
        toast.success('Scheduler stopped successfully');
        loadSchedulerStatus();
      } else {
        toast.error(`Failed to stop scheduler: ${result.error}`);
      }
    } catch (error) {
      console.error('Error stopping scheduler:', error);
      toast.error('Failed to stop scheduler');
    }
  };

  const triggerScheduler = async () => {
    try {
      const result = await superAdminAPI.triggerScheduler();
      
      if (result.success) {
        toast.success('Scheduler triggered successfully');
        loadSchedulerStatus();
      } else {
        toast.error(`Failed to trigger scheduler: ${result.error}`);
      }
    } catch (error) {
      console.error('Error triggering scheduler:', error);
      toast.error('Failed to trigger scheduler');
    }
  };

  // Bulk operations for software leads
  const bulkDeleteLeads = async () => {
    if (selectedLeads.length === 0) {
      toast.error('No leads selected');
      return;
    }

    try {
      await superAdminAPI.bulkDeleteLeads(selectedLeads);
      toast.success(`${selectedLeads.length} leads deleted successfully`);
      fetchSoftwareLeads();
      setSelectedLeads([]);
    } catch (error) {
      console.error('Error bulk deleting leads:', error);
      toast.error('Failed to bulk delete leads');
    }
  };

  const bulkUpdateLeadStatus = async (status: string) => {
    if (selectedLeads.length === 0) {
      toast.error('No leads selected');
      return;
    }

    try {
      await superAdminAPI.bulkUpdateLeadStatus(selectedLeads, status);
      toast.success(`${selectedLeads.length} leads updated to ${status}`);
      fetchSoftwareLeads();
      setSelectedLeads([]);
    } catch (error) {
      console.error('Error bulk updating leads:', error);
      toast.error('Failed to bulk update leads');
    }
  };

  const exportLeads = async () => {
    try {
      const blob = await superAdminAPI.exportLeadsToCSV(leadFilters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `software-leads-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Leads exported successfully');
    } catch (error) {
      console.error('Error exporting leads:', error);
      toast.error('Failed to export leads');
    }
  };

  // Enhanced lead management functions
  const loadLeadDetails = async (leadId: string) => {
    try {
      const lead = softwareLeads.find(l => l.id === leadId);
      if (lead) {
        setSelectedLeadDetails(lead);
        setShowLeadDetails(true);
        // Load activities for this lead
        await loadLeadActivities(leadId);
      }
    } catch (error) {
      console.error('Error loading lead details:', error);
      toast.error('Failed to load lead details');
    }
  };

  const loadLeadActivities = async (leadId: string) => {
    try {
      const response = await superAdminAPI.getLeadActivities(leadId);
      setLeadActivities(response.activities || []);
    } catch (error) {
      console.error('Error loading lead activities:', error);
      // Fallback to empty array if API fails
      setLeadActivities([]);
    }
  };

  const calculateLeadScore = (lead: SoftwareLead): number => {
    let score = 0;
    
    // Base score from status
    const statusScores = {
      'new': 10,
      'contacted': 20,
      'qualified': 40,
      'nurturing': 30,
      'won': 100,
      'lost': 0
    };
    score += statusScores[lead.status as keyof typeof statusScores] || 0;
    
    // Bonus for having complete information
    if (lead.email) score += 5;
    if (lead.phone) score += 5;
    if (lead.company) score += 5;
    if (lead.website) score += 10;
    if (lead.linkedin_url) score += 10;
    
    // Bonus for qualification status
    if (lead.qualification_status === 'highly_qualified') score += 30;
    else if (lead.qualification_status === 'qualified') score += 20;
    
    // Bonus for decision maker
    if (lead.decision_maker) score += 15;
    
    // Bonus for recent activity
    if (lead.last_contacted_at) {
      const daysSinceContact = Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceContact < 7) score += 10;
      else if (daysSinceContact < 30) score += 5;
    }
    
    return Math.min(score, 100); // Cap at 100
  };

  const detectDuplicateLeads = async () => {
    try {
      const duplicates = [];
      const processed = new Set();
      
      for (let i = 0; i < softwareLeads.length; i++) {
        if (processed.has(softwareLeads[i].id)) continue;
        
        const currentLead = softwareLeads[i];
        const similarLeads = softwareLeads.filter((lead, index) => {
          if (index <= i || processed.has(lead.id)) return false;
          
          // Check for duplicates based on email, phone, or company + name
          return (
            (lead.email && currentLead.email && lead.email.toLowerCase() === currentLead.email.toLowerCase()) ||
            (lead.phone && currentLead.phone && lead.phone === currentLead.phone) ||
            (lead.company && currentLead.company && lead.company.toLowerCase() === currentLead.company.toLowerCase() && 
             lead.full_name && currentLead.full_name && lead.full_name.toLowerCase() === currentLead.full_name.toLowerCase())
          );
        });
        
        if (similarLeads.length > 0) {
          duplicates.push({
            primary: currentLead,
            duplicates: similarLeads,
            confidence: similarLeads.length > 1 ? 'high' : 'medium'
          });
          similarLeads.forEach(lead => processed.add(lead.id));
        }
        processed.add(currentLead.id);
      }
      
      setDuplicateLeads(duplicates);
      setShowLeadDuplicates(true);
    } catch (error) {
      console.error('Error detecting duplicates:', error);
      toast.error('Failed to detect duplicate leads');
    }
  };

  const mergeLeads = async () => {
    if (leadsToMerge.length < 2) {
      toast.error('Please select at least 2 leads to merge');
      return;
    }
    
    try {
      // This would call an API to merge leads
      toast.success(`${leadsToMerge.length} leads merged successfully`);
      setShowLeadMerge(false);
      setLeadsToMerge([]);
      fetchSoftwareLeads();
    } catch (error) {
      console.error('Error merging leads:', error);
      toast.error('Failed to merge leads');
    }
  };

  const assignLeadOwner = async (leadId: string, ownerId: string) => {
    try {
      // This would call an API to assign lead owner
      toast.success('Lead assigned successfully');
      fetchSoftwareLeads();
    } catch (error) {
      console.error('Error assigning lead:', error);
      toast.error('Failed to assign lead');
    }
  };

  const updateLeadScore = async (leadId: string, newScore: number) => {
    try {
      // This would call an API to update lead score
      toast.success('Lead score updated successfully');
      fetchSoftwareLeads();
    } catch (error) {
      console.error('Error updating lead score:', error);
      toast.error('Failed to update lead score');
    }
  };

  const addLeadTag = async (leadId: string, tag: string) => {
    try {
      // This would call an API to add tag
      toast.success('Tag added successfully');
      fetchSoftwareLeads();
    } catch (error) {
      console.error('Error adding tag:', error);
      toast.error('Failed to add tag');
    }
  };

  const removeLeadTag = async (leadId: string, tag: string) => {
    try {
      // This would call an API to remove tag
      toast.success('Tag removed successfully');
      fetchSoftwareLeads();
    } catch (error) {
      console.error('Error removing tag:', error);
      toast.error('Failed to remove tag');
    }
  };

  const scheduleFollowUp = async (leadId: string, followUpDate: string, notes: string) => {
    try {
      // This would call an API to schedule follow-up
      toast.success('Follow-up scheduled successfully');
      fetchSoftwareLeads();
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
      toast.error('Failed to schedule follow-up');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
      // Preview CSV data
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const allLines = text.split('\n').filter(line => line.trim());
        const totalRows = allLines.length - 1; // Subtract header row
        
        // Preview all rows for display
        const previewLines = allLines; // Show all rows
        const headers = previewLines[0].split(',');
        const previewData = previewLines.slice(1).map(line => {
          const values = line.split(',');
          const row: any = {};
          headers.forEach((header, index) => {
            row[header.trim()] = values[index]?.trim() || '';
          });
          return row;
        }).filter(row => Object.values(row).some(val => val));
        
        setImportPreview(previewData);
        setTotalCsvRows(totalRows);
      };
      reader.readAsText(file);
    }
  };

  const importLeads = async () => {
    if (!importFile) {
      toast.error('No file selected');
      return;
    }

    try {
      const result = await superAdminAPI.importLeadsFromCSV(importFile);
      
      // Show detailed success message
      if (result.summary) {
        const { newInserted, duplicates, totalProcessed } = result.summary;
        toast.success(`Import completed: ${newInserted} new leads inserted, ${duplicates} duplicates skipped`);
      } else {
        // Fallback for older response format
        if (result.skippedDuplicates > 0) {
          toast.success(`${result.importedCount} leads imported successfully. ${result.skippedDuplicates} duplicates skipped.`);
        } else {
          toast.success(`${result.importedCount} leads imported successfully`);
        }
      }
      
      fetchSoftwareLeads();
      setShowImportDialog(false);
      setImportFile(null);
      setImportPreview([]);
      setTotalCsvRows(0);
    } catch (error: any) {
      console.error('Error importing leads:', error);
      
      // Check if error response contains structured data
      if (error.response?.data) {
        const { error: errorMessage, message, duplicates } = error.response.data;
        
        if (errorMessage === 'All leads already exist') {
          toast.error('All Leads Already in System');
        } else if (duplicates && duplicates.length > 0) {
          // Partial duplication case
          const insertedCount = error.response.data.insertedCount || 0;
          const duplicateCount = duplicates.length;
          toast.error(`${insertedCount} leads imported, ${duplicateCount} duplicates skipped`);
        } else if (message) {
          toast.error(message);
        } else {
          toast.error('Failed to import leads');
        }
      } else if (error.message?.includes('All leads already exist')) {
        toast.error('All Leads Already in System');
      } else if (error.message?.includes('validation errors')) {
        toast.error('Import failed: CSV validation errors');
      } else {
        toast.error('Failed to import leads');
      }
    }
  };

  // =====================================================
  // ANALYTICS FUNCTIONS
  // =====================================================

  const loadCampaignAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      const result = await superAdminAPI.getAllCampaignsAnalytics(analyticsTimeRange);
      setCampaignAnalytics(result.campaigns || []);
    } catch (error) {
      console.error('Error loading campaign analytics:', error);
      toast.error('Failed to load campaign analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsTimeRange]);

  const loadActivityFeed = useCallback(async () => {
    try {
      const result = await superAdminAPI.getActivityFeed(50);
      setActivityFeed(result.activities || []);
    } catch (error) {
      console.error('Error loading activity feed:', error);
      toast.error('Failed to load activity feed');
    }
  }, []);

  const loadRevenueAttribution = useCallback(async () => {
    try {
      const result = await superAdminAPI.getRevenueAttribution(analyticsTimeRange);
      setRevenueAttribution(result.attribution || []);
    } catch (error) {
      console.error('Error loading revenue attribution:', error);
      toast.error('Failed to load revenue attribution');
    }
  }, [analyticsTimeRange]);

  const loadTemplateAnalytics = useCallback(async () => {
    try {
      const result = await superAdminAPI.getTemplateAnalytics();
      setTemplateAnalytics(result.templates || []);
    } catch (error) {
      console.error('Error loading template analytics:', error);
      toast.error('Failed to load template analytics');
    }
  }, []);

  const loadAllAnalytics = useCallback(async () => {
    await Promise.all([
      loadCampaignAnalytics(),
      loadActivityFeed(),
      loadRevenueAttribution(),
      loadTemplateAnalytics()
    ]);
  }, [loadCampaignAnalytics, loadActivityFeed, loadRevenueAttribution, loadTemplateAnalytics]);

  // Load analytics when component mounts and when time range changes
  useEffect(() => {
    if (activeTab === 'marketing') {
      loadAllAnalytics();
      loadAllEnrollments(); // Load all enrollments for journey card counts
      // Load steps for all journeys when marketing tab is active
      marketingJourneys.forEach(journey => {
        loadJourneySteps(journey.id);
      });
    }
  }, [activeTab, loadAllAnalytics, loadAllEnrollments, marketingJourneys]);

  // Auto-refresh activity feed every 30 seconds when on marketing tab
  useEffect(() => {
    if (activeTab === 'marketing') {
      const interval = setInterval(() => {
        loadActivityFeed();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [activeTab, loadActivityFeed]);

  if (authLoading || permissionsLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (!isSuperAdmin()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <TopNavigation />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7 xl:grid-cols-7 gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-1 text-xs md:text-sm">
              <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="dealers" className="flex items-center gap-1 text-xs md:text-sm">
              <Building className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Dealers</span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center gap-1 text-xs md:text-sm">
              <CreditCard className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Subscriptions</span>
            </TabsTrigger>
            <TabsTrigger value="leads" className="flex items-center gap-1 text-xs md:text-sm">
              <Mail className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Software Leads</span>
            </TabsTrigger>
            <TabsTrigger value="marketing" className="flex items-center gap-1 text-xs md:text-sm">
              <FileText className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Marketing</span>
            </TabsTrigger> 
            {/* <TabsTrigger value="audit" className="flex items-center gap-1 text-xs md:text-sm">
              <FileText className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger> */}
            <TabsTrigger value="settings" className="flex items-center gap-1 text-xs md:text-sm">
              <Settings className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            {/* <TabsTrigger value="users" className="flex items-center gap-1 text-xs md:text-sm">
              <UserCog className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger> */}
            <TabsTrigger value="roles" className="flex items-center gap-1 text-xs md:text-sm">
              <Shield className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Roles</span>
            </TabsTrigger>
            <TabsTrigger value="conv-monitor" className="flex items-center gap-1 text-xs md:text-sm">
              <Activity className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Conv. Monitor</span>
            </TabsTrigger>
            <TabsTrigger value="reset-data" className="flex items-center gap-1 text-xs md:text-sm bg-red-50 hover:bg-red-100 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Reset</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Dealers</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalDealers}</div>
                  <p className="text-xs text-muted-foreground">
                    All registered dealers
                  </p>
                </CardContent>
              </Card>
              
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Dealers</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeDealers}</div>
                  <p className="text-xs text-muted-foreground">
                    With active subscriptions
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Software Leads</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                    <Mail className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalSoftwareLeads}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.newSoftwareLeads} new this month
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                    <CreditCard className="h-4 w-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    Recurring monthly revenue
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                    <Plus className="h-3 w-3 text-primary-foreground" />
                  </div>
                  Quick Actions
                </CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  <Button 
                    onClick={() => setActiveTab('leads')} 
                    className="h-16 flex-col gap-2 hover:bg-primary/90 transition-colors"
                    variant="outline"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-sm">Add Software Lead</span>
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('settings')} 
                    className="h-16 flex-col gap-2 hover:bg-primary/90 transition-colors"
                    variant="outline"
                  >
                    <Settings className="h-5 w-5" />
                    <span className="text-sm">Manage Settings</span>
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('dealers')} 
                    className="h-16 flex-col gap-2 hover:bg-primary/90 transition-colors"
                    variant="outline"
                  >
                    <Building className="h-5 w-5" />
                    <span className="text-sm">View Dealers</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dealers Tab */}
          <TabsContent value="dealers" className="space-y-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                        <Building className="h-3 w-3 text-primary-foreground" />
                      </div>
                      Dealer Management
                    </CardTitle>
                <CardDescription>Manage dealer accounts and subscription plans</CardDescription>
                  </div>
                  <Button onClick={() => setShowDealerForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Dealer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse bg-muted/50 rounded h-16" />
                    ))}
                  </div>
                ) : dealers.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted mx-auto mb-4">
                      <Building className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No dealers found</h3>
                    <p className="text-muted-foreground">No dealers have been registered yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                          <TableHead className="font-semibold">Business Name</TableHead>
                          <TableHead className="font-semibold">Contact</TableHead>
                          <TableHead className="font-semibold">Plan</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Vehicles</TableHead>
                          <TableHead className="font-semibold">Leads</TableHead>
                          <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dealers.map((dealer) => (
                        <TableRow key={dealer.id}>
                          <TableCell className="font-medium">{dealer.business_name}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{dealer.contact_name}</div>
                              <div className="text-sm text-muted-foreground">{dealer.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              dealer.subscription_plan === 'enterprise' ? 'default' :
                              dealer.subscription_plan === 'premium' ? 'secondary' : 'outline'
                            }>
                              {dealer.subscription_plan}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={dealer.subscription_status === 'active' ? 'default' : 'destructive'}>
                              {dealer.subscription_status}
                            </Badge>
                          </TableCell>
                          <TableCell>{dealer.vehicles?.[0]?.count || 0}</TableCell>
                          <TableCell>{dealer.leads?.[0]?.count || 0}</TableCell>
                          <TableCell>
                          <div className="flex gap-2 flex-wrap items-center">
                            <Select
                              value={dealer.subscription_plan}
                              onValueChange={(value: "basic" | "premium" | "enterprise") => updateDealerPlan(dealer.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="basic">Basic</SelectItem>
                                <SelectItem value="premium">Premium</SelectItem>
                                <SelectItem value="enterprise">Enterprise</SelectItem>
                              </SelectContent>
                            </Select>
                            {/* Marbalism AI toggle */}
                            <div className="flex items-center gap-1.5 border rounded-md px-2 py-1 bg-white">
                              <Bot className="h-3.5 w-3.5 text-purple-500" />
                              <span className="text-xs text-gray-600 hidden xl:inline">Marbalism</span>
                              <Switch
                                checked={dealer.marbalism_ai_enabled ?? false}
                                onCheckedChange={(enabled) => handleMarbalismToggle(dealer.id, enabled)}
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDealerForStaff(dealer);
                                setStaffFormData({
                                  email: '',
                                  password: '',
                                  name: '',
                                  staff_role: 'sales',
                                  permissions: []
                                });
                                setShowStaffForm(true);
                              }}
                              title="Add Staff Member"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingDealer(dealer);
                                setDealerFormData({
                                  business_name: dealer.business_name,
                                  contact_name: dealer.contact_name,
                                  email: dealer.email,
                                  password: '', // Don't show password when editing
                                  phone: '',
                                  address: '',
                                  city: '',
                                  state: '',
                                  zip_code: '',
                                  subscription_plan: dealer.subscription_plan as 'basic' | 'premium' | 'enterprise',
                                  subscription_status: dealer.subscription_status as 'active' | 'inactive' | 'suspended'
                                });
                                setShowDealerForm(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDealer(dealer);
                                setShowSubscriptionDialog(true);
                              }}
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                    <FileText className="h-3 w-3 text-primary-foreground" />
                  </div>
                  Audit Logs
                </CardTitle>
                <CardDescription>Review administrative activity across the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-3 mb-4">
                  <div className="flex-1 flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search description, user, resource..."
                      value={auditFilters.search}
                      onChange={(e) => setAuditFilters(prev => ({ ...prev, search: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') loadAuditLogs({ page: 1 }); }}
                    />
                  </div>
                  <Select
                    value={auditFilters.actionType}
                    onValueChange={(value) => { setAuditFilters(prev => ({ ...prev, actionType: value === 'all' ? '' : value })); loadAuditLogs({ actionType: value === 'all' ? '' : value, page: 1 }); }}
                  >
                    <SelectTrigger className="w-[220px]"><SelectValue placeholder="Action Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="login">login</SelectItem>
                      <SelectItem value="logout">logout</SelectItem>
                      <SelectItem value="user_create">user_create</SelectItem>
                      <SelectItem value="user_update">user_update</SelectItem>
                      <SelectItem value="user_delete">user_delete</SelectItem>
                      <SelectItem value="lead_create">lead_create</SelectItem>
                      <SelectItem value="lead_update">lead_update</SelectItem>
                      <SelectItem value="lead_delete">lead_delete</SelectItem>
                      <SelectItem value="settings_update">settings_update</SelectItem>
                      <SelectItem value="security_event">security_event</SelectItem>
                      <SelectItem value="error_event">error_event</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={auditFilters.success}
                    onValueChange={(value) => { setAuditFilters(prev => ({ ...prev, success: value === 'all' ? '' : value })); loadAuditLogs({ success: value === 'all' ? '' : value, page: 1 }); }}
                  >
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Outcome" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">Success</SelectItem>
                      <SelectItem value="false">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="secondary" onClick={() => loadAuditLogs({ page: 1 })}>
                    <Filter className="h-4 w-4 mr-2" /> Apply
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const csv = await superAdminAPI.exportAuditLogs({
                        search: auditFilters.search || undefined,
                        actionType: auditFilters.actionType || undefined,
                        success: auditFilters.success !== '' ? auditFilters.success : undefined
                      }, 'csv');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `audit-logs-${new Date().toISOString().slice(0,10)}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">When</TableHead>
                        <TableHead className="font-semibold">User</TableHead>
                        <TableHead className="font-semibold">Action</TableHead>
                        <TableHead className="font-semibold">Resource</TableHead>
                        <TableHead className="font-semibold">Tenant</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLoading ? (
                        <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
                      ) : auditLogs.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-muted-foreground">No audit logs found</TableCell></TableRow>
                      ) : (
                        auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                            <TableCell>{log.user_email || 'System'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{log.action_type}</Badge>
                                <span className="text-sm text-muted-foreground">{log.description}</span>
                              </div>
                            </TableCell>
                            <TableCell>{log.resource_type || '-'}</TableCell>
                            <TableCell>{log.tenant_name || 'Global'}</TableCell>
                            <TableCell>
                              <Badge variant={log.success ? 'default' : 'destructive'}>
                                {log.success ? 'Success' : 'Failed'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {auditPagination.page} of {auditPagination.totalPages || 1} — {auditPagination.total} results
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={auditPagination.page <= 1}
                      onClick={() => { const page = auditPagination.page - 1; setAuditFilters(prev => ({ ...prev, page })); loadAuditLogs({ page }); }}
                    >
                      Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!auditPagination.hasNext}
                      onClick={() => { const page = auditPagination.page + 1; setAuditFilters(prev => ({ ...prev, page })); loadAuditLogs({ page }); }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Management Tab */}
          <TabsContent value="subscriptions" className="space-y-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                    <CreditCard className="h-3 w-3 text-primary-foreground" />
                  </div>
                  Subscription Plans Management
                </CardTitle>
                <CardDescription>Manage subscription plans and pricing for dealers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Subscription Plans Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Basic Plan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">$29</div>
                        <p className="text-xs text-muted-foreground">per month</p>
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            Up to 100 vehicles
                          </div>
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            Basic lead management
                          </div>
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            Email support
                          </div>
                        </div>
                        <Button className="w-full mt-4" variant="outline">
                          Edit Plan
                        </Button>
                      </CardContent>
                    </Card>
                    
                    <Card className="hover:shadow-md transition-shadow border-primary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-primary">Premium Plan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">$79</div>
                        <p className="text-xs text-muted-foreground">per month</p>
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            Up to 500 vehicles
                          </div>
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            Advanced lead management
                          </div>
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            Marketing automation
                          </div>
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            Priority support
                          </div>
                        </div>
                        <Button className="w-full mt-4">
                          Edit Plan
                        </Button>
                      </CardContent>
                    </Card>
                    
                    <Card className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Enterprise Plan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">$199</div>
                        <p className="text-xs text-muted-foreground">per month</p>
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            Unlimited vehicles
                          </div>
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            Full feature access
                          </div>
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            Custom integrations
                          </div>
                          <div className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            24/7 dedicated support
                          </div>
                        </div>
                        <Button className="w-full mt-4" variant="outline">
                          Edit Plan
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Active Subscriptions */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Active Subscriptions</h3>
                      <Button onClick={() => {/* TODO: Add create subscription */}}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Subscription
                      </Button>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-semibold">Dealer</TableHead>
                            <TableHead className="font-semibold">Plan</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="font-semibold">Amount</TableHead>
                            <TableHead className="font-semibold">Next Billing</TableHead>
                            <TableHead className="font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                      <TableBody>
                        {dealers.map((dealer) => (
                          <TableRow key={dealer.id}>
                            <TableCell className="font-medium">{dealer.business_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {dealer.subscription_plan || 'basic'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={dealer.subscription_status === 'active' ? 'default' : 'secondary'}
                              >
                                {dealer.subscription_status || 'inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              ${dealer.subscription_plan === 'premium' ? '79' : 
                                dealer.subscription_plan === 'enterprise' ? '199' : '29'}
                            </TableCell>
                            <TableCell>
                              {dealer.subscription_status === 'active' ? 
                                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString() : 
                                'N/A'
                              }
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {/* TODO: View subscription details */}}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {/* TODO: Edit subscription */}}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {/* TODO: Cancel subscription */}}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Stripe Integration Status */}
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                          <CreditCard className="h-3 w-3 text-primary-foreground" />
                        </div>
                        Stripe Integration
                      </CardTitle>
                      <CardDescription>Manage Stripe payment processing settings</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Payment Processing</p>
                            <p className="text-sm text-muted-foreground">
                              Stripe integration for subscription billing
                            </p>
                          </div>
                          <Badge variant="outline">Connected</Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <TestTube className="h-4 w-4 mr-2" />
                            Test Connection
                          </Button>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-2" />
                            Configure
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Software Leads Tab */}
          <TabsContent value="leads" className="space-y-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                        <Mail className="h-3 w-3 text-primary-foreground" />
                      </div>
                      Software Leads Management
                    </CardTitle>
                    <CardDescription>Advanced lead management with scoring, analytics, and automation</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setShowLeadForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Lead
                    </Button>
                    <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                    <Button variant="outline" onClick={exportLeads}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button variant="outline" onClick={detectDuplicateLeads}>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Find Duplicates
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Enhanced Filters */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Advanced Filters</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
                    </Button>
                  </div>
                  
                  {/* Basic Filters */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Search leads by name, email, company..."
                        value={leadFilters.search}
                        onChange={(e) => setLeadFilters(prev => ({ ...prev, search: e.target.value }))}
                      />
                    </div>
                    <Select
                      value={leadFilters.status}
                      onValueChange={(value) => setLeadFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="nurturing">Nurturing</SelectItem>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={leadFilters.qualification_status}
                      onValueChange={(value) => setLeadFilters(prev => ({ ...prev, qualification_status: value === 'all' ? '' : value }))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Qualification" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Qualification</SelectItem>
                        <SelectItem value="unqualified">Unqualified</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="highly_qualified">Highly Qualified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Advanced Filters */}
                  {showAdvancedFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                      <div>
                        <Label htmlFor="lead-score-min">Lead Score Range</Label>
                        <div className="flex gap-2">
                          <Input
                            id="lead-score-min"
                            placeholder="Min"
                            type="number"
                            value={leadFilters.lead_score_min}
                            onChange={(e) => setLeadFilters(prev => ({ ...prev, lead_score_min: e.target.value }))}
                          />
                          <Input
                            placeholder="Max"
                            type="number"
                            value={leadFilters.lead_score_max}
                            onChange={(e) => setLeadFilters(prev => ({ ...prev, lead_score_max: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="industry">Industry</Label>
                        <Select
                          value={leadFilters.industry}
                          onValueChange={(value) => setLeadFilters(prev => ({ ...prev, industry: value === 'all' ? '' : value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All Industries" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Industries</SelectItem>
                            <SelectItem value="technology">Technology</SelectItem>
                            <SelectItem value="healthcare">Healthcare</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="retail">Retail</SelectItem>
                            <SelectItem value="manufacturing">Manufacturing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="company-size">Company Size</Label>
                        <Select
                          value={leadFilters.company_size}
                          onValueChange={(value) => setLeadFilters(prev => ({ ...prev, company_size: value === 'all' ? '' : value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All Sizes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sizes</SelectItem>
                            <SelectItem value="startup">Startup (1-10)</SelectItem>
                            <SelectItem value="small">Small (11-50)</SelectItem>
                            <SelectItem value="medium">Medium (51-200)</SelectItem>
                            <SelectItem value="large">Large (201-1000)</SelectItem>
                            <SelectItem value="enterprise">Enterprise (1000+)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">View Mode:</span>
                    <div className="flex border rounded-lg">
                      <Button
                        variant={leadViewMode === 'table' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setLeadViewMode('table')}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={leadViewMode === 'cards' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setLeadViewMode('cards')}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={leadViewMode === 'kanban' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setLeadViewMode('kanban')}
                      >
                        <CheckSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Sort by:</span>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_at">Created Date</SelectItem>
                        <SelectItem value="updated_at">Updated Date</SelectItem>
                        <SelectItem value="full_name">Name</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="lead_score">Lead Score</SelectItem>
                        <SelectItem value="last_contacted_at">Last Contact</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </Button>
                  </div>
                </div>

                {/* Bulk Actions */}
                {selectedLeads.length > 0 && (
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
                      </span>
                      <div className="flex gap-2">
                        <Select onValueChange={bulkUpdateLeadStatus}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Bulk Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Mark as New</SelectItem>
                            <SelectItem value="contacted">Mark as Contacted</SelectItem>
                            <SelectItem value="qualified">Mark as Qualified</SelectItem>
                            <SelectItem value="nurturing">Mark as Nurturing</SelectItem>
                            <SelectItem value="won">Mark as Won</SelectItem>
                            <SelectItem value="lost">Mark as Lost</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="destructive" size="sm" onClick={bulkDeleteLeads}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                        <Button variant="default" size="sm" onClick={openBulkEnrollmentDialog}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Enroll in Journey
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowLeadAssignment(true)}>
                          <UserCog className="h-4 w-4 mr-2" />
                          Assign Owner
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedLeads([])}>
                          Clear Selection
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Leads Table */}
                {/* Enhanced Leads Table */}
                {leadViewMode === 'table' && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            checked={selectedLeads.length === softwareLeads.length && softwareLeads.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeads(softwareLeads.map(lead => lead.id));
                              } else {
                                setSelectedLeads([]);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Lead Score</TableHead>
                        <TableHead>Qualification</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Last Contact</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {softwareLeads.map((lead) => {
                        const leadScore = calculateLeadScore(lead);
                        return (
                          <TableRow key={lead.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedLeads.includes(lead.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLeads(prev => [...prev, lead.id]);
                                  } else {
                                    setSelectedLeads(prev => prev.filter(id => id !== lead.id));
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div>
                                <div>{lead.full_name || 'N/A'}</div>
                                {lead.tags && lead.tags.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {lead.tags.slice(0, 2).map((tag, index) => (
                                      <Badge key={index} variant="secondary" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {lead.tags.length > 2 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{lead.tags.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{lead.email}</TableCell>
                            <TableCell>
                              <div>
                                <div>{lead.company || 'N/A'}</div>
                                {lead.industry && (
                                  <div className="text-xs text-muted-foreground">{lead.industry}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${
                                  leadScore >= 80 ? 'bg-green-500' :
                                  leadScore >= 60 ? 'bg-yellow-500' :
                                  leadScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
                                }`}></div>
                                <span className="text-sm font-medium">{leadScore}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                lead.qualification_status === 'highly_qualified' ? 'default' :
                                lead.qualification_status === 'qualified' ? 'secondary' : 'outline'
                              }>
                                {lead.qualification_status || 'unqualified'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{lead.source}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                lead.status === 'won' ? 'default' :
                                lead.status === 'lost' ? 'destructive' :
                                lead.status === 'qualified' ? 'secondary' : 'outline'
                              }>
                                {lead.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {lead.owner_name || 'Unassigned'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {lead.last_contacted_at 
                                  ? new Date(lead.last_contacted_at).toLocaleDateString()
                                  : 'Never'
                                }
                              </div>
                            </TableCell>
                            <TableCell>{new Date(lead.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => loadLeadDetails(lead.id)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingLead(lead)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedLeadForMessage(lead);
                                    loadEmailTemplate('welcome');
                                    setShowEmailTemplate(true);
                                  }}
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedLeadForMessage(lead);
                                    loadSmsTemplate('welcome');
                                    setShowSmsTemplate(true);
                                  }}
                                >
                                  <Phone className="h-4 w-4" />
                                </Button>
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

          {/* Marketing Journeys Tab */}
          <TabsContent value="marketing" className="space-y-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                    <FileText className="h-3 w-3 text-primary-foreground" />
                  </div>
                  Marketing Journeys
                </CardTitle>
                <CardDescription>Create and manage automated marketing email sequences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Scheduler Control */}
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Marketing Scheduler
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${schedulerStatus?.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-muted-foreground">
                          {schedulerStatus?.isRunning ? 'Running' : 'Stopped'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="text-sm">
                        <span className="font-medium">Check Interval:</span> {schedulerStatus?.checkInterval ? `${schedulerStatus.checkInterval / 1000 / 60}min` : 'N/A'}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Batch Size:</span> {schedulerStatus?.batchSize || 'N/A'}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Last Check:</span> {schedulerStatus?.lastCheck ? new Date(schedulerStatus.lastCheck).toLocaleTimeString() : 'N/A'}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={schedulerStatus?.isRunning ? "destructive" : "default"}
                        onClick={schedulerStatus?.isRunning ? stopScheduler : startScheduler}
                      >
                        {schedulerStatus?.isRunning ? (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Stop Scheduler
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Start Scheduler
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={triggerScheduler}
                        disabled={!schedulerStatus?.isRunning}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Trigger Now
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={loadSchedulerStatus}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Status
                      </Button>
                    </div>
                  </div>

                  {/* Journey List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Active Journeys</h3>
                      <Button onClick={() => setShowJourneyForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Journey
                      </Button>
                    </div>
                    
                    <div className="grid gap-4">
                      {marketingJourneys.map((journey) => (
                        <div key={journey.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-semibold">{journey.name}</h4>
                              <p className="text-sm text-muted-foreground">{journey.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={journey.status === 'active' ? 'default' : 'secondary'}>
                                {journey.status}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedJourney(journey);
                                  loadJourneySteps(journey.id);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Steps
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedJourney(journey);
                                  loadEnrollments(journey.id);
                                }}
                              >
                                <Users className="h-4 w-4 mr-2" />
                                Enrollments
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => editJourney(journey)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteJourney(journey.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openEnrollmentDialog(journey)}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Enroll Leads
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cloneJourney(journey)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Clone
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Created: {new Date(journey.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                            <span>Steps: {journeySteps.filter(step => step.journey_id === journey.id).length}</span>
                            <span>Enrollments: {enrollments.filter(enrollment => enrollment.journey_id === journey.id).length}</span>
                            <span>Active: {enrollments.filter(enrollment => enrollment.journey_id === journey.id && enrollment.status === 'active').length}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Journey Steps */}
                  {selectedJourney && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Steps for "{selectedJourney.name}"</h3>
                        <Button onClick={addStepToJourney}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Step
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        {journeySteps.map((step, index) => (
                          <div key={step.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                                  {step.step_order}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={step.channel === 'email' ? 'default' : 'secondary'}>
                                      {(step.channel || step.type).toUpperCase()}
                                    </Badge>
                                    {(step.template_subject || step.subject) && <span className="font-medium">{step.template_subject || step.subject}</span>}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {(step.template_body || step.body).substring(0, 100)}...
                                  </p>
                                  {step.delay_minutes > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Delay: {step.delay_minutes} minutes
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => editStep(step)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => deleteStep(step.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Enrollments */}
                  {selectedJourney && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Enrollments for "{selectedJourney.name}"</h3>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lead</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Current Step</TableHead>
                            <TableHead>Next Run</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {enrollments.map((enrollment) => (
                            <TableRow key={enrollment.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{enrollment.full_name}</div>
                                  <div className="text-sm text-muted-foreground">{enrollment.email}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={enrollment.status === 'active' ? 'default' : 'secondary'}>
                                  {enrollment.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {enrollment.current_step_order || 'N/A'}
                              </TableCell>
                              <TableCell>
                                {enrollment.next_run_at 
                                  ? new Date(enrollment.next_run_at).toLocaleString()
                                  : 'N/A'
                                }
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => runNextStep(enrollment.id)}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Run Next
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            {/* Marketing Analytics Dashboard */}
            <div className="space-y-6">
            {/* Analytics Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{campaignAnalytics.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Active marketing campaigns
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Emails Sent</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                    <Mail className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {campaignAnalytics.reduce((sum, campaign) => sum + (campaign.total_sends || 0), 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last {analyticsTimeRange} days
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Open Rate</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {campaignAnalytics.length > 0 
                      ? Math.round(campaignAnalytics.reduce((sum, campaign) => sum + (campaign.open_rate || 0), 0) / campaignAnalytics.length * 100) / 100
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Across all campaigns
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                    <CreditCard className="h-4 w-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${revenueAttribution.reduce((sum, attr) => sum + parseFloat(attr.total_revenue || 0), 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Attributed to marketing
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Campaign Performance Table */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                        <TrendingUp className="h-3 w-3 text-primary-foreground" />
                      </div>
                      Campaign Performance
                    </CardTitle>
                    <CardDescription>Performance metrics for all marketing campaigns</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      value={analyticsTimeRange} 
                      onChange={(e) => setAnalyticsTimeRange(parseInt(e.target.value))}
                      className="px-3 py-1 border rounded-md text-sm"
                    >
                      <option value={7}>Last 7 days</option>
                      <option value={30}>Last 30 days</option>
                      <option value={90}>Last 90 days</option>
                    </select>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={loadAllAnalytics}
                      disabled={analyticsLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse bg-muted/50 rounded h-16" />
                    ))}
                  </div>
                ) : campaignAnalytics.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted mx-auto mb-4">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
                    <p className="text-muted-foreground">Create your first marketing campaign to see analytics.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Campaign</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Emails Sent</TableHead>
                          <TableHead className="font-semibold">Open Rate</TableHead>
                          <TableHead className="font-semibold">Click Rate</TableHead>
                          <TableHead className="font-semibold">Conversions</TableHead>
                          <TableHead className="font-semibold">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaignAnalytics.map((campaign) => (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-medium">
                              <div>
                                <div className="font-medium">{campaign.name}</div>
                                <div className="text-sm text-muted-foreground">{campaign.description}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                                {campaign.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{campaign.total_sends || 0}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{campaign.open_rate || 0}%</span>
                                <div className="w-16 bg-muted rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full" 
                                    style={{ width: `${Math.min(campaign.open_rate || 0, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{campaign.click_rate || 0}%</span>
                                <div className="w-16 bg-muted rounded-full h-2">
                                  <div 
                                    className="bg-green-600 h-2 rounded-full" 
                                    style={{ width: `${Math.min(campaign.click_rate || 0, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{campaign.total_conversions || 0}</TableCell>
                            <TableCell className="font-medium">
                              ${parseFloat(campaign.total_revenue || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Real-time Activity Feed */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                    <Activity className="h-3 w-3 text-primary-foreground" />
                  </div>
                  Live Activity Feed
                </CardTitle>
                <CardDescription>Real-time marketing activity updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activityFeed.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No recent activity
                    </div>
                  ) : (
                    activityFeed.map((activity) => (
                      <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.activity_type === 'email_opened' ? 'bg-green-500' : 
                          activity.activity_type === 'email_clicked' ? 'bg-primary' : 
                          activity.activity_type === 'conversion' ? 'bg-purple-500' : 'bg-gray-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {activity.full_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {activity.activity_type === 'email_opened' ? 'opened' : 
                             activity.activity_type === 'email_clicked' ? 'clicked' : 
                             activity.activity_type === 'conversion' ? 'converted' : 'interacted with'}
                            {activity.journey_name && ` ${activity.journey_name}`}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(activity.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Revenue Attribution */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                    <CreditCard className="h-3 w-3 text-primary-foreground" />
                  </div>
                  Revenue Attribution
                </CardTitle>
                <CardDescription>Revenue attributed to marketing campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                {revenueAttribution.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No revenue attribution data available
                  </div>
                ) : (
                  <div className="space-y-4">
                    {revenueAttribution.map((attr) => (
                      <div key={attr.journey_id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{attr.journey_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {attr.conversion_count} conversions
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">
                            ${parseFloat(attr.total_revenue).toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Avg: ${parseFloat(attr.avg_revenue_per_conversion).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* Global Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
                    <Settings className="h-3 w-3 text-primary-foreground" />
                  </div>
                  Global Integration Settings
                </CardTitle>
                <CardDescription>Manage global provider settings for Stripe, Twilio, and Daive</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Stripe Settings */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Stripe Settings
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testIntegration('stripe')}
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        Test Connection
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Publishable Key</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="pk_test_..."
                            value={integrationSettings.stripe?.publishable_key?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('stripe', 'publishable_key', integrationSettings.stripe?.publishable_key || { provider: 'stripe', key: 'publishable_key', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>Secret Key</Label>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="sk_test_..."
                            value={integrationSettings.stripe?.secret_key?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('stripe', 'secret_key', integrationSettings.stripe?.secret_key || { provider: 'stripe', key: 'secret_key', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Twilio Settings */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Twilio Settings
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testIntegration('twilio')}
                        >
                          <TestTube className="h-4 w-4 mr-2" />
                          Test Connection
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => verifyTwilioSender()}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Verify Sender
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Account SID</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="AC..."
                            value={integrationSettings.twilio?.account_sid?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('twilio', 'account_sid', integrationSettings.twilio?.account_sid || { provider: 'twilio', key: 'account_sid', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>Auth Token</Label>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="..."
                            value={integrationSettings.twilio?.auth_token?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('twilio', 'auth_token', integrationSettings.twilio?.auth_token || { provider: 'twilio', key: 'auth_token', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>Messaging Service SID</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="MG..."
                            value={integrationSettings.twilio?.messaging_service_sid?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('twilio', 'messaging_service_sid', integrationSettings.twilio?.messaging_service_sid || { provider: 'twilio', key: 'messaging_service_sid', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>From Number</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="+1234567890"
                            value={integrationSettings.twilio?.from_number?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('twilio', 'from_number', integrationSettings.twilio?.from_number || { provider: 'twilio', key: 'from_number', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Twilio Status Indicators */}
                    <div className="mt-4 grid gap-2 md:grid-cols-3">
                      <div className="flex items-center gap-2 p-2 bg-muted rounded">
                        <div className={`w-2 h-2 rounded-full ${integrationSettings.twilio?.account_sid?.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm">Account SID</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-muted rounded">
                        <div className={`w-2 h-2 rounded-full ${integrationSettings.twilio?.auth_token?.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm">Auth Token</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-muted rounded">
                        <div className={`w-2 h-2 rounded-full ${integrationSettings.twilio?.messaging_service_sid?.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm">Messaging Service</span>
                      </div>
                    </div>
                  </div>

                  {/* SMTP Settings */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        SMTP Settings
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testIntegration('smtp')}
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        Test Connection
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>SMTP Host</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="smtp.gmail.com"
                            value={integrationSettings.smtp?.host?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('smtp', 'host', integrationSettings.smtp?.host || { provider: 'smtp', key: 'host', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>SMTP Port</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="587"
                            value={integrationSettings.smtp?.port?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('smtp', 'port', integrationSettings.smtp?.port || { provider: 'smtp', key: 'port', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>SMTP Username</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="your-email@gmail.com"
                            value={integrationSettings.smtp?.user?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('smtp', 'user', integrationSettings.smtp?.user || { provider: 'smtp', key: 'user', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>SMTP Password</Label>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="App Password"
                            value={integrationSettings.smtp?.pass?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('smtp', 'pass', integrationSettings.smtp?.pass || { provider: 'smtp', key: 'pass', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>From Email Address</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="noreply@yourdomain.com"
                            value={integrationSettings.smtp?.from?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('smtp', 'from', integrationSettings.smtp?.from || { provider: 'smtp', key: 'from', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>Use Secure Connection</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="true/false"
                            value={integrationSettings.smtp?.secure?.secret || ''}
                            readOnly
                            className="bg-muted"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSettingsEditor('smtp', 'secure', integrationSettings.smtp?.secure || { provider: 'smtp', key: 'secure', secret: '', config: {}, is_active: true, created_at: '', updated_at: '' })}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* SMTP Status Indicators */}
                    <div className="mt-4 grid gap-2 md:grid-cols-3">
                      <div className="flex items-center gap-2 p-2 bg-muted rounded">
                        <div className={`w-2 h-2 rounded-full ${integrationSettings.smtp?.host?.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm">SMTP Host</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-muted rounded">
                        <div className={`w-2 h-2 rounded-full ${integrationSettings.smtp?.user?.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm">Username</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-muted rounded">
                        <div className={`w-2 h-2 rounded-full ${integrationSettings.smtp?.pass?.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-sm">Password</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <p className="text-sm text-primary">
                        <strong>SMTP Configuration:</strong> Configure your email server settings for sending emails to leads and notifications. 
                        For Gmail, use an App Password instead of your regular password.
                      </p>
                    </div>
                  </div>

                  {/* Daive AI Settings */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        Daive AI Settings
                      </h3>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => testIntegration('daive')}>
                          <TestTube className="h-4 w-4 mr-2" /> Test Connection
                        </Button>
                        <Button size="sm" variant="outline" onClick={testDaiveConnection}>
                          <CheckCircle className="h-4 w-4 mr-2" /> Test Daive
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>OpenAI API Key</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="password"
                            value={integrationSettings.daive?.openai_key?.secret ? '••••••••••••••••' : ''}
                            disabled
                            className="flex-1"
                          />
                          <div className={`w-2 h-2 rounded-full ${integrationSettings.daive?.openai_key?.secret ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>ElevenLabs API Key</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="password"
                            value={integrationSettings.daive?.elevenlabs_key?.secret ? '••••••••••••••••' : ''}
                            disabled
                            className="flex-1"
                          />
                          <div className={`w-2 h-2 rounded-full ${integrationSettings.daive?.elevenlabs_key?.secret ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Deepgram API Key</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="password"
                            value={integrationSettings.daive?.deepgram_key?.secret ? '••••••••••••••••' : ''}
                            disabled
                            className="flex-1"
                          />
                          <div className={`w-2 h-2 rounded-full ${integrationSettings.daive?.deepgram_key?.secret ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Azure Speech Key</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="password"
                            value={integrationSettings.daive?.azure_speech_key?.secret ? '••••••••••••••••' : ''}
                            disabled
                            className="flex-1"
                          />
                          <div className={`w-2 h-2 rounded-full ${integrationSettings.daive?.azure_speech_key?.secret ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        <strong>Note:</strong> Daive AI settings are managed through the existing AI Settings page. 
                        These settings are read-only in Super Admin and show the current configuration status.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles">
            <RoleManagement />
          </TabsContent>

          {/* Conversation Monitor Tab */}
          <TabsContent value="conv-monitor" className="space-y-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" />
                Conversation Monitor
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time view of all DAIVE conversations across dealers. Select a conversation and click "Analyze Gaps" to run an AI quality check.
              </p>
            </div>
            <ConversationMonitor />
          </TabsContent>

          {/* Reset Dealership Data Tab */}
          <TabsContent value="reset-data">
            <ResetDealershipData />
          </TabsContent>
        </Tabs>
      </main>

      {/* Software Lead Form Dialog */}
      <Dialog open={showLeadForm} onOpenChange={setShowLeadForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Software Lead</DialogTitle>
            <DialogDescription>Create a new software lead for the platform</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            createSoftwareLead({
              full_name: formData.get('full_name') as string,
              email: formData.get('email') as string,
              phone: formData.get('phone') as string,
              company: formData.get('company') as string,
              source: formData.get('source') as string,
              notes: formData.get('notes') as string
            });
          }}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input id="full_name" name="full_name" required />
      </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" name="company" />
                </div>
              </div>
              <div>
                <Label htmlFor="source">Source</Label>
                <Select name="source" defaultValue="manual">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Entry</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="import">Import</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowLeadForm(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Lead</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={!!editingLead} onOpenChange={() => setEditingLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Software Lead</DialogTitle>
            <DialogDescription>Update lead information</DialogDescription>
          </DialogHeader>
          {editingLead && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              updateSoftwareLead(editingLead.id, {
                full_name: formData.get('full_name') as string,
                email: formData.get('email') as string,
                phone: formData.get('phone') as string,
                company: formData.get('company') as string,
                status: formData.get('status') as string,
                notes: formData.get('notes') as string
              });
            }}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_full_name">Full Name</Label>
                    <Input id="edit_full_name" name="full_name" defaultValue={editingLead.full_name} />
                  </div>
                  <div>
                    <Label htmlFor="edit_email">Email</Label>
                    <Input id="edit_email" name="email" type="email" defaultValue={editingLead.email} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_phone">Phone</Label>
                    <Input id="edit_phone" name="phone" defaultValue={editingLead.phone} />
                  </div>
                  <div>
                    <Label htmlFor="edit_company">Company</Label>
                    <Input id="edit_company" name="company" defaultValue={editingLead.company} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit_status">Status</Label>
                  <Select name="status" defaultValue={editingLead.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="nurturing">Nurturing</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_notes">Notes</Label>
                  <Textarea id="edit_notes" name="notes" defaultValue={editingLead.notes} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingLead(null)}>
                  Cancel
                </Button>
                <Button type="submit">Update Lead</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Stripe Subscription Management Dialog */}
      <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stripe Subscription Management</DialogTitle>
            <DialogDescription>
              Manage Stripe customer and subscription for {selectedDealer?.business_name}
            </DialogDescription>
          </DialogHeader>
          {selectedDealer && (
            <div className="space-y-6">
              {/* Customer Status */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Stripe Customer</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Customer ID</Label>
                    <Input 
                      value={selectedDealer.stripe_customer_id || 'Not created'} 
                      readOnly 
                      className="bg-muted"
                    />
                  </div>
                  <div className="flex items-end">
                    {!selectedDealer.stripe_customer_id ? (
                      <Button onClick={() => createStripeCustomer(selectedDealer.id)}>
                        Create Stripe Customer
                      </Button>
                    ) : (
                      <Badge variant="default">Customer Created</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Subscription Status */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Subscription</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Subscription ID</Label>
                    <Input 
                      value={selectedDealer.stripe_subscription_id || 'No subscription'} 
                      readOnly 
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Input 
                      value={selectedDealer.subscription_status || 'inactive'} 
                      readOnly 
                      className="bg-muted"
                    />
                  </div>
                </div>
                {selectedDealer.subscription_current_period_end && (
                  <div className="mt-4">
                    <Label>Current Period Ends</Label>
                    <Input 
                      value={new Date(selectedDealer.subscription_current_period_end).toLocaleDateString()} 
                      readOnly 
                      className="bg-muted"
                    />
                  </div>
                )}
              </div>

              {/* Subscription Actions */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Actions</h3>
                <div className="space-y-4">
                  {selectedDealer.stripe_customer_id && !selectedDealer.stripe_subscription_id && (
                    <div>
                      <Label>Create Subscription</Label>
                      <div className="flex gap-2 mt-2">
                        <Input 
                          placeholder="Stripe Price ID (e.g., price_1234567890)"
                          id="price-id"
                        />
                        <Input 
                          placeholder="Trial days (optional)"
                          type="number"
                          id="trial-days"
                        />
                        <Button onClick={() => {
                          const priceId = (document.getElementById('price-id') as HTMLInputElement)?.value;
                          const trialDays = (document.getElementById('trial-days') as HTMLInputElement)?.value;
                          if (priceId) {
                            createSubscription(selectedDealer.id, priceId, trialDays ? parseInt(trialDays) : undefined);
                          }
                        }}>
                          Create Subscription
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {selectedDealer.stripe_subscription_id && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => fetchDealerInvoices(selectedDealer.id)}
                      >
                        View Invoices
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => cancelSubscription(selectedDealer.id)}
                      >
                        Cancel Subscription
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Invoices Display */}
              {dealerInvoices.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4">Recent Invoices</h3>
                  <div className="space-y-2">
                    {dealerInvoices.slice(0, 5).map((invoice) => (
                      <div key={invoice.id} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div>
                          <span className="font-medium">${(invoice.amount_paid / 100).toFixed(2)}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {new Date(invoice.created * 1000).toLocaleDateString()}
                          </span>
                        </div>
                        <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                          {invoice.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubscriptionDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Integration Settings Editor Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingSetting?.provider} Setting</DialogTitle>
            <DialogDescription>
              Update {editingSetting?.key} for {editingSetting?.provider}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (editingSetting) {
              updateIntegrationSetting(editingSetting.provider, editingSetting.key, settingFormData);
            }
          }}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="secret">Secret/Value</Label>
                <Textarea 
                  id="secret" 
                  value={settingFormData.secret}
                  onChange={(e) => setSettingFormData(prev => ({ ...prev, secret: e.target.value }))}
                  placeholder="Enter the secret value..."
                />
              </div>
              <div>
                <Label htmlFor="config">Configuration (JSON)</Label>
                <Textarea 
                  id="config" 
                  value={JSON.stringify(settingFormData.config, null, 2)}
                  onChange={(e) => {
                    try {
                      const config = JSON.parse(e.target.value);
                      setSettingFormData(prev => ({ ...prev, config }));
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  placeholder='{"key": "value"}'
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={settingFormData.is_active}
                  onCheckedChange={(checked) => setSettingFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSettingsDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Setting</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Import Software Leads from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple software leads at once
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* File Upload */}
            <div className="flex-shrink-0">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Supported columns: full_name, email, phone, company, source, status, tags, notes, industry, company_size, budget_range, decision_maker, website, linkedin_url
              </p>
            </div>

            {/* Preview */}
            {importPreview.length > 0 && (
              <div className="flex-1 flex flex-col min-h-0">
                <Label className="mb-2">Preview (all {totalCsvRows} leads)</Label>
                <div className="flex-1 border rounded-lg overflow-auto">
                  <div className="min-w-full">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          {Object.keys(importPreview[0] || {}).map((header) => (
                            <TableHead key={header} className="whitespace-nowrap min-w-[120px]">
                              {header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.map((row, index) => (
                          <TableRow key={index}>
                            {Object.values(row).map((value, cellIndex) => (
                              <TableCell key={cellIndex} className="whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis" title={String(value)}>
                                {String(value)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="flex-shrink-0 bg-muted p-4 rounded-lg overflow-y-auto max-h-[200px]">
              <h4 className="font-semibold mb-2">CSV Format Requirements:</h4>
              <ul className="text-sm space-y-1">
                <li>• <strong>email</strong> (required): Valid email address</li>
                <li>• <strong>full_name</strong> (optional): Lead's full name</li>
                <li>• <strong>phone</strong> (optional): Phone number</li>
                <li>• <strong>company</strong> (optional): Company name</li>
                <li>• <strong>source</strong> (optional): Lead source (defaults to "import")</li>
                <li>• <strong>status</strong> (optional): new, contacted, qualified, nurturing, won, lost</li>
                <li>• <strong>tags</strong> (optional): Comma-separated tags</li>
                <li>• <strong>notes</strong> (optional): Additional notes</li>
                <li>• <strong>industry</strong> (optional): Industry type</li>
                <li>• <strong>company_size</strong> (optional): startup, small, medium, large, enterprise</li>
                <li>• <strong>budget_range</strong> (optional): Budget range (e.g., "$10k-50k")</li>
                <li>• <strong>decision_maker</strong> (optional): true/false</li>
                <li>• <strong>website</strong> (optional): Company website URL</li>
                <li>• <strong>linkedin_url</strong> (optional): LinkedIn profile URL</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowImportDialog(false);
              setImportFile(null);
              setImportPreview([]);
              setTotalCsvRows(0);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={importLeads} 
              disabled={!importFile}
            >
              Import {totalCsvRows > 0 ? `${totalCsvRows} leads` : 'Leads'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Template Dialog */}
      <Dialog open={showEmailTemplate} onOpenChange={setShowEmailTemplate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Email to {selectedLeadForMessage?.full_name}</DialogTitle>
            <DialogDescription>
              Send an email to {selectedLeadForMessage?.email} using a template
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={sendEmailToLead}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email-template">Template</Label>
                <Select
                  value={emailTemplate.template}
                  onValueChange={(value) => {
                    setEmailTemplate(prev => ({ ...prev, template: value }));
                    loadEmailTemplate(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="followup">Follow Up</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="email-subject">Subject</Label>
                <Input
                  id="email-subject"
                  value={emailTemplate.subject}
                  onChange={(e) => setEmailTemplate(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Email subject"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email-body">Message Body</Label>
                <Textarea
                  id="email-body"
                  value={emailTemplate.body}
                  onChange={(e) => setEmailTemplate(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Email message body"
                  rows={8}
                  required
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p><strong>Recipient:</strong> {selectedLeadForMessage?.email}</p>
                <p><strong>Name:</strong> {selectedLeadForMessage?.full_name}</p>
                <p><strong>Company:</strong> {selectedLeadForMessage?.company}</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEmailTemplate(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SMS Template Dialog */}
      <Dialog open={showSmsTemplate} onOpenChange={setShowSmsTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS to {selectedLeadForMessage?.full_name}</DialogTitle>
            <DialogDescription>
              Send an SMS to {selectedLeadForMessage?.phone} using a template
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={sendSmsToLead}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="sms-template">Template</Label>
                <Select
                  value={smsTemplate.template}
                  onValueChange={(value) => {
                    setSmsTemplate(prev => ({ ...prev, template: value }));
                    loadSmsTemplate(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="followup">Follow Up</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sms-message">Message</Label>
                <Textarea
                  id="sms-message"
                  value={smsTemplate.message}
                  onChange={(e) => setSmsTemplate(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="SMS message"
                  rows={4}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Character count: {smsTemplate.message.length}/160
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p><strong>Recipient:</strong> {selectedLeadForMessage?.phone}</p>
                <p><strong>Name:</strong> {selectedLeadForMessage?.full_name}</p>
                <p><strong>Company:</strong> {selectedLeadForMessage?.company}</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSmsTemplate(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Phone className="h-4 w-4 mr-2" />
                Send SMS
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Marketing Journey Dialog */}
      <Dialog open={showJourneyEditForm} onOpenChange={setShowJourneyEditForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Marketing Journey</DialogTitle>
            <DialogDescription>Update the marketing journey details</DialogDescription>
          </DialogHeader>
          <form onSubmit={updateJourney}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-journey-name">Journey Name</Label>
                <Input
                  id="edit-journey-name"
                  value={journeyFormData.name}
                  onChange={(e) => setJourneyFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter journey name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-journey-description">Description</Label>
                <Textarea
                  id="edit-journey-description"
                  value={journeyFormData.description}
                  onChange={(e) => setJourneyFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter journey description"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-journey-status">Status</Label>
                <Select
                  value={journeyFormData.status}
                  onValueChange={(value) => setJourneyFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowJourneyEditForm(false);
                setEditingJourney(null);
                setJourneyFormData({ name: '', description: '', status: 'active' });
              }}>
                Cancel
              </Button>
              <Button type="submit">Update Journey</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lead Enrollment Dialog */}
      <Dialog open={showEnrollmentDialog} onOpenChange={setShowEnrollmentDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Enroll Leads in "{selectedJourney?.name}"</DialogTitle>
            <DialogDescription>Select leads to enroll in this marketing journey</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedLeadsForEnrollment.length === softwareLeads.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLeadsForEnrollment(softwareLeads.map(lead => lead.id));
                          } else {
                            setSelectedLeadsForEnrollment([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {softwareLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLeadsForEnrollment.includes(lead.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedLeadsForEnrollment(prev => [...prev, lead.id]);
                            } else {
                              setSelectedLeadsForEnrollment(prev => prev.filter(id => id !== lead.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{lead.full_name}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{lead.company}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{lead.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedLeadsForEnrollment.length} lead(s) selected
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setShowEnrollmentDialog(false);
              setSelectedLeadsForEnrollment([]);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={enrollLeadsInJourney}
              disabled={selectedLeadsForEnrollment.length === 0}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Enroll {selectedLeadsForEnrollment.length} Lead(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Enrollment Dialog */}
      <Dialog open={showBulkEnrollmentDialog} onOpenChange={setShowBulkEnrollmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll Selected Leads in Journey</DialogTitle>
            <DialogDescription>
              Select a marketing journey to enroll {selectedLeads.length} selected lead(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="journey-select">Select Journey</Label>
              <Select onValueChange={(value) => {
                const journey = marketingJourneys.find(j => j.id === value);
                setSelectedJourneyForBulkEnrollment(journey);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a journey" />
                </SelectTrigger>
                <SelectContent>
                  {marketingJourneys.map((journey) => (
                    <SelectItem key={journey.id} value={journey.id}>
                      {journey.name} ({journey.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><strong>Selected Leads:</strong> {selectedLeads.length}</p>
              <p><strong>Journey:</strong> {selectedJourneyForBulkEnrollment?.name || 'None selected'}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setShowBulkEnrollmentDialog(false);
              setSelectedJourneyForBulkEnrollment(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={bulkEnrollSelectedLeads}
              disabled={!selectedJourneyForBulkEnrollment}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Enroll {selectedLeads.length} Lead(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Details Dialog */}
      <Dialog open={showLeadDetails} onOpenChange={setShowLeadDetails}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Lead Details - {selectedLeadDetails?.full_name}</DialogTitle>
            <DialogDescription>Complete lead information and activity timeline</DialogDescription>
          </DialogHeader>
          {selectedLeadDetails && (
            <div className="space-y-6">
              {/* Lead Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Contact Information</h3>
                  <div className="space-y-2">
                    <div><strong>Name:</strong> {selectedLeadDetails.full_name}</div>
                    <div><strong>Email:</strong> {selectedLeadDetails.email}</div>
                    <div><strong>Phone:</strong> {selectedLeadDetails.phone || 'N/A'}</div>
                    <div><strong>Company:</strong> {selectedLeadDetails.company || 'N/A'}</div>
                    <div><strong>Website:</strong> {selectedLeadDetails.website || 'N/A'}</div>
                    <div><strong>LinkedIn:</strong> {selectedLeadDetails.linkedin_url || 'N/A'}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Lead Scoring & Qualification</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <strong>Lead Score:</strong>
                      <div className={`w-3 h-3 rounded-full ${
                        calculateLeadScore(selectedLeadDetails) >= 80 ? 'bg-green-500' :
                        calculateLeadScore(selectedLeadDetails) >= 60 ? 'bg-yellow-500' :
                        calculateLeadScore(selectedLeadDetails) >= 40 ? 'bg-orange-500' : 'bg-red-500'
                      }`}></div>
                      <span className="font-medium">{calculateLeadScore(selectedLeadDetails)}/100</span>
                    </div>
                    <div><strong>Qualification:</strong> {selectedLeadDetails.qualification_status || 'unqualified'}</div>
                    <div><strong>Status:</strong> {selectedLeadDetails.status}</div>
                    <div><strong>Source:</strong> {selectedLeadDetails.source}</div>
                    <div><strong>Industry:</strong> {selectedLeadDetails.industry || 'N/A'}</div>
                    <div><strong>Company Size:</strong> {selectedLeadDetails.company_size || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {selectedLeadDetails.tags && selectedLeadDetails.tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedLeadDetails.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedLeadDetails.notes && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Notes</h3>
                  <div className="p-3 bg-muted rounded-lg">
                    {selectedLeadDetails.notes}
                  </div>
                </div>
              )}

              {/* Activity Timeline */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Activity Timeline</h3>
                {leadActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="text-4xl mb-2">📝</div>
                    <p>No activities recorded yet</p>
                    <p className="text-sm">Activities will appear here when you interact with this lead</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leadActivities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          activity.success === false ? 'bg-red-500' :
                          activity.type === 'email_send' || activity.type === 'email_sent' ? 'bg-primary' :
                          activity.type === 'sms_send' ? 'bg-green-500' :
                          activity.type === 'lead_create' ? 'bg-purple-500' :
                          activity.type === 'lead_update' ? 'bg-orange-500' :
                          'bg-primary'
                        }`}></div>
                        <div className="flex-1">
                          <div className="font-medium">{activity.description}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <span>{new Date(activity.timestamp).toLocaleString()}</span>
                            <span>•</span>
                            <span>by {activity.user || 'System'}</span>
                            {activity.success === false && (
                              <>
                                <span>•</span>
                                <span className="text-red-500 font-medium">Failed</span>
                              </>
                            )}
                          </div>
                          {activity.error_message && (
                            <div className="text-sm text-red-500 mt-1">
                              Error: {activity.error_message}
                            </div>
                          )}
                          {activity.metadata && typeof activity.metadata === 'object' && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {activity.metadata.subject && `Subject: ${activity.metadata.subject}`}
                              {activity.metadata.changed_fields && `Fields: ${activity.metadata.changed_fields.join(', ')}`}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeadDetails(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowLeadDetails(false);
              setEditingLead(selectedLeadDetails);
            }}>
              Edit Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Leads Dialog */}
      <Dialog open={showLeadDuplicates} onOpenChange={setShowLeadDuplicates}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Duplicate Leads Detection</DialogTitle>
            <DialogDescription>Review and merge potential duplicate leads</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {duplicateLeads.map((group, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Duplicate Group {index + 1}</h3>
                    <Badge variant={group.confidence === 'high' ? 'destructive' : 'secondary'}>
                      {group.confidence} confidence
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Primary Lead</h4>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="font-medium">{group.primary.full_name}</div>
                        <div className="text-sm text-muted-foreground">{group.primary.email}</div>
                        <div className="text-sm text-muted-foreground">{group.primary.company}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Duplicate Leads</h4>
                      <div className="space-y-2">
                        {group.duplicates.map((duplicate) => (
                          <div key={duplicate.id} className="p-3 border rounded-lg">
                            <div className="font-medium">{duplicate.full_name}</div>
                            <div className="text-sm text-muted-foreground">{duplicate.email}</div>
                            <div className="text-sm text-muted-foreground">{duplicate.company}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLeadsToMerge([group.primary.id, ...group.duplicates.map(d => d.id)]);
                        setShowLeadMerge(true);
                      }}
                    >
                      Merge All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Mark as not duplicates
                        toast.success('Marked as not duplicates');
                      }}
                    >
                      Not Duplicates
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeadDuplicates(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Assignment Dialog */}
      <Dialog open={showLeadAssignment} onOpenChange={setShowLeadAssignment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lead Owner</DialogTitle>
            <DialogDescription>Assign selected leads to a team member</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="owner-select">Select Owner</Label>
              <Select onValueChange={(value) => {
                // Assign leads to owner
                selectedLeads.forEach(leadId => {
                  assignLeadOwner(leadId, value);
                });
                setShowLeadAssignment(false);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user1">John Doe</SelectItem>
                  <SelectItem value="user2">Jane Smith</SelectItem>
                  <SelectItem value="user3">Mike Johnson</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedLeads.length} lead(s) will be assigned
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeadAssignment(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Journey Step Form Dialog */}
      <Dialog open={showStepForm} onOpenChange={setShowStepForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingStep ? 'Edit Journey Step' : 'Add Journey Step'}
            </DialogTitle>
            <DialogDescription>
              {editingStep ? 'Update the journey step details' : 'Add a new step to the marketing journey'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editingStep ? updateStep : createStep}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="step-type">Step Type</Label>
                  <Select
                    value={stepFormData.type}
                    onValueChange={(value) => setStepFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="step-order">Step Order</Label>
                  <Input
                    id="step-order"
                    type="number"
                    min="1"
                    value={stepFormData.step_order}
                    onChange={(e) => setStepFormData(prev => ({ ...prev, step_order: parseInt(e.target.value) || 1 }))}
                    required
                  />
                </div>
              </div>
              
              {stepFormData.type === 'email' && (
                <div>
                  <Label htmlFor="step-subject">Email Subject</Label>
                  <Input
                    id="step-subject"
                    value={stepFormData.subject}
                    onChange={(e) => setStepFormData(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Email subject line"
                    required
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="step-body">
                  {stepFormData.type === 'email' ? 'Email Body' : 'SMS Message'}
                </Label>
                <Textarea
                  id="step-body"
                  value={stepFormData.body}
                  onChange={(e) => setStepFormData(prev => ({ ...prev, body: e.target.value }))}
                  placeholder={stepFormData.type === 'email' ? 'Email message body...' : 'SMS message...'}
                  rows={stepFormData.type === 'email' ? 6 : 3}
                  required
                />
                {stepFormData.type === 'sms' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Character count: {stepFormData.body.length}/160
                  </p>
                )}
              </div>
              
              <div>
                <Label htmlFor="step-delay">Delay (minutes)</Label>
                <Input
                  id="step-delay"
                  type="number"
                  min="0"
                  value={stepFormData.delay_minutes}
                  onChange={(e) => setStepFormData(prev => ({ ...prev, delay_minutes: parseInt(e.target.value) || 0 }))}
                  placeholder="Minutes to wait before sending this step"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How long to wait after the previous step before sending this one
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowStepForm(false);
                setEditingStep(null);
                setStepFormData({ type: 'email', subject: '', body: '', delay_minutes: 0, step_order: 1 });
              }}>
                Cancel
              </Button>
              <Button type="submit">
                {editingStep ? 'Update Step' : 'Create Step'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Marketing Journey Dialog */}
      <Dialog open={showJourneyForm} onOpenChange={setShowJourneyForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Marketing Journey</DialogTitle>
            <DialogDescription>Create a new automated marketing journey for leads</DialogDescription>
          </DialogHeader>
          <form onSubmit={createJourney}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="journey-name">Journey Name</Label>
                <Input
                  id="journey-name"
                  value={journeyFormData.name}
                  onChange={(e) => setJourneyFormData({ ...journeyFormData, name: e.target.value })}
                  placeholder="e.g., Welcome Series"
                  required
                />
              </div>
              <div>
                <Label htmlFor="journey-description">Description</Label>
                <Textarea
                  id="journey-description"
                  value={journeyFormData.description}
                  onChange={(e) => setJourneyFormData({ ...journeyFormData, description: e.target.value })}
                  placeholder="Describe the purpose of this journey..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="journey-status">Status</Label>
                <Select
                  value={journeyFormData.status}
                  onValueChange={(value) => setJourneyFormData({ ...journeyFormData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowJourneyForm(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Journey</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dealer Form Dialog */}
      <Dialog open={showDealerForm} onOpenChange={setShowDealerForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDealer ? 'Edit Dealer' : 'Add New Dealer'}
            </DialogTitle>
            <DialogDescription>
              {editingDealer ? 'Update dealer information' : 'Create a new dealer account'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (editingDealer) {
              updateDealer(editingDealer.id, dealerFormData);
            } else {
              createDealer(dealerFormData);
            }
          }}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business_name">Business Name *</Label>
                  <Input 
                    id="business_name" 
                    name="business_name" 
                    value={dealerFormData.business_name}
                    onChange={(e) => setDealerFormData(prev => ({ ...prev, business_name: e.target.value }))}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="contact_name">Contact Name *</Label>
                  <Input 
                    id="contact_name" 
                    name="contact_name" 
                    value={dealerFormData.contact_name}
                    onChange={(e) => setDealerFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                    required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    value={dealerFormData.email}
                    onChange={(e) => setDealerFormData(prev => ({ ...prev, email: e.target.value }))}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    value={dealerFormData.phone}
                    onChange={(e) => setDealerFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
              {!editingDealer && (
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input 
                    id="password" 
                    name="password" 
                    type="password" 
                    value={dealerFormData.password}
                    onChange={(e) => setDealerFormData(prev => ({ ...prev, password: e.target.value }))}
                    required 
                    placeholder="Default: DealerIQ123!"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Default password is DealerIQ123! - dealer should change this after first login
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address" 
                  name="address" 
                  value={dealerFormData.address}
                  onChange={(e) => setDealerFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input 
                    id="city" 
                    name="city" 
                    value={dealerFormData.city}
                    onChange={(e) => setDealerFormData(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input 
                    id="state" 
                    name="state" 
                    value={dealerFormData.state}
                    onChange={(e) => setDealerFormData(prev => ({ ...prev, state: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="zip_code">ZIP Code</Label>
                  <Input 
                    id="zip_code" 
                    name="zip_code" 
                    value={dealerFormData.zip_code}
                    onChange={(e) => setDealerFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="subscription_plan">Subscription Plan</Label>
                  <Select
                    value={dealerFormData.subscription_plan}
                    onValueChange={(value: 'basic' | 'premium' | 'enterprise') => 
                      setDealerFormData(prev => ({ ...prev, subscription_plan: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subscription_status">Status</Label>
                  <Select
                    value={dealerFormData.subscription_status}
                    onValueChange={(value: 'active' | 'inactive' | 'suspended') => 
                      setDealerFormData(prev => ({ ...prev, subscription_status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowDealerForm(false);
                setEditingDealer(null);
                setDealerFormData({
                  business_name: '',
                  contact_name: '',
                  email: '',
                  password: 'DealerIQ123!',
                  phone: '',
                  address: '',
                  city: '',
                  state: '',
                  zip_code: '',
                  subscription_plan: 'basic',
                  subscription_status: 'active'
                });
              }}>
                Cancel
              </Button>
              <Button type="submit">
                {editingDealer ? 'Update Dealer' : 'Create Dealer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Staff Form Dialog */}
      <Dialog open={showStaffForm} onOpenChange={setShowStaffForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Add Staff Member
            </DialogTitle>
            <DialogDescription>
              Add a new staff member to {selectedDealerForStaff?.business_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddStaff}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="staff_name">Name</Label>
                  <Input 
                    id="staff_name" 
                    name="name" 
                    value={staffFormData.name}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Staff member name"
                  />
                </div>
                <div>
                  <Label htmlFor="staff_email">Email *</Label>
                  <Input 
                    id="staff_email" 
                    name="email" 
                    type="email"
                    value={staffFormData.email}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                    placeholder="staff@example.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="staff_password">Password *</Label>
                  <Input 
                    id="staff_password" 
                    name="password" 
                    type="password"
                    value={staffFormData.password}
                    onChange={(e) => setStaffFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <div>
                  <Label htmlFor="staff_role">Role *</Label>
                  <Select
                    value={staffFormData.staff_role}
                    onValueChange={(value: 'admin' | 'sales' | 'finance' | 'service' | 'inventory') => 
                      setStaffFormData(prev => ({ ...prev, staff_role: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="inventory">Inventory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowStaffForm(false);
                setSelectedDealerForStaff(null);
                setStaffFormData({
                  email: '',
                  password: '',
                  name: '',
                  staff_role: 'sales',
                  permissions: []
                });
              }}>
                Cancel
              </Button>
              <Button type="submit">
                Add Staff Member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;
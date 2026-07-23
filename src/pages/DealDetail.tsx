/**
 * Deal Workspace — full 4-panel layout matching the DealerIQ mockup
 * Left: customer + vehicle | Center: deal structure | Center-right: payment options | Right: Dave AI chat
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { financeAPI, lendersAPI } from '@/lib/api';
import { buildBackendAssetUrl, buildApiUrl } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import TopNavigation from '@/components/layout/TopNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { vehiclesAPI } from '@/lib/api';
import {
  ArrowLeft, Car, User, CreditCard, DollarSign, FileText,
  Send, Printer, MessageSquare, Mail, PenTool, Sparkles,
  ChevronRight, RotateCcw, Calculator, TrendingUp, Shield,
  Package, CheckCircle, AlertCircle, Clock, Edit2,
  Building2, Phone, RefreshCw, Bot, ThumbsUp, ThumbsDown,
  Banknote, Users, ExternalLink, MoreHorizontal, ChevronDown,
  Wrench, ClipboardCheck, Settings, History, X
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinanceDeal {
  id: string;
  deal_number?: string;
  deal_type: 'finance' | 'lease';
  deal_stage?: string;
  status: string;
  vehicle_id?: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  stock_number?: string;
  trim?: string;
  mileage?: number;
  vehicle_image_url?: string;
  color?: string;
  new_used?: string;
  vehicle_price: number;
  vehicle_msrp?: number;
  vehicle_internet_price?: number;
  dealer_discount?: number;
  dealer_fee?: number;
  reconditioning_cost?: number;
  gross_profit?: number;
  warranty_amount?: number;
  gap_amount?: number;
  accessories_amount?: number;
  include_warranty?: boolean;
  include_gap?: boolean;
  include_accessories?: boolean;
  sales_tax?: number;
  title_fee?: number;
  license_fee?: number;
  registration_fee?: number;
  total_government_fees?: number;
  trade_in_acv?: number;
  trade_in_payoff?: number;
  trade_in_net_credit?: number;
  trade_in_equity?: number;
  trade_in_negative_equity?: number;
  trade_in_year?: number;
  trade_in_make?: string;
  trade_in_model?: string;
  trade_in_vin?: string;
  trade_in_mileage?: number;
  trade_in_condition?: string;
  trade_in_image_url?: string;
  down_payment: number;
  amount_financed?: number;
  apr?: number;
  money_factor?: number;
  residual_value_pct?: number;
  term_months: number;
  monthly_payment: number;
  total_interest?: number;
  total_amount: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  credit_score?: number;
  experian_score?: number;
  equifax_score?: number;
  transunion_score?: number;
  credit_tier?: string;
  notes?: string;
  ai_notes?: string;
  latest_deal_sheet_id?: string;
  pdf_url?: string;
  pdf_filename?: string;
  signature_request_id?: string;
  signature_status?: string;
  program_name?: string;
  program_source?: string;
  created_at: string;
  updated_at?: string;
}

interface Lender {
  id: string;
  lender_name: string;
  lender_type: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEAL_STAGES = [
  { key: 'lead',            label: 'Lead' },
  { key: 'test_drive',      label: 'Test Drive' },
  { key: 'credit_app',      label: 'Credit App' },
  { key: 'lender_approval', label: 'Lender Approval' },
  { key: 'menu',            label: 'Menu' },
  { key: 'contract',        label: 'Contract' },
  { key: 'delivery',        label: 'Delivery' },
] as const;

const CREDIT_TIER_COLORS: Record<string, string> = {
  super_prime:   'bg-emerald-100 text-emerald-800',
  prime:         'bg-orange-100 text-orange-700',
  near_prime:    'bg-yellow-100 text-yellow-800',
  subprime:      'bg-orange-100 text-orange-800',
  deep_subprime: 'bg-red-100 text-red-800',
};

const DAVE_QUICK_ACTIONS = [
  'Recommend payment under $650',
  'Find best lender for this deal',
  'What products should I present?',
  'Show approval odds',
  'Explain this payment to customer',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n?: number | null, decimals = 0) =>
  n != null ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—';

const fmtCurrency = (n?: number | string | null) => {
  const num = n != null ? Number(n) : null;
  return num != null && !isNaN(num) ? `$${fmt(num)}` : '—';
};

function calcMonthlyPayment(principal: number, aprPct: number, months: number): number {
  if (months <= 0) return 0;
  if (aprPct <= 0) return principal / months;
  const r = aprPct / 100 / 12;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function getInitials(name?: string) {
  if (!name) return 'NA';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function creditScoreColor(score?: number) {
  if (!score) return 'text-gray-500';
  if (score >= 750) return 'text-emerald-600';
  if (score >= 670) return 'text-orange-600';
  if (score >= 580) return 'text-yellow-600';
  return 'text-red-600';
}

// ─── Build a structured Dave briefing from DAIVE slot context ────────────────
function buildSlotSummary(slots: any, conv: any): string {
  const lines: string[] = ['=== Customer Journey Intel (from DAIVE chat) ==='];

  const ds = slots?.daivesteps || {};
  const step1 = ds[1] || ds['1'] || {};
  const step2 = ds[2] || ds['2'] || {};
  const step3 = ds[3] || ds['3'] || {};

  // Vehicle interest
  const make  = step1.make  || step3?.slots?.VehicleSelection?.selectedVehicle?.make  || '';
  const model = step1.model || step3?.slots?.VehicleSelection?.selectedVehicle?.model || '';
  const year  = step3?.slots?.VehicleSelection?.selectedVehicle?.year || step3?.slots?.inventory_choice?.year || '';
  const vType = step1.vehicle_type || step3?.slots?.VehicleSelection?.selectedVehicle?.body_style || '';
  const cond  = step1.vehicle_condition || '';
  if (make || model || vType) {
    lines.push(`• Interested in: ${[year, make, model].filter(Boolean).join(' ')}${vType ? ` (${vType})` : ''}${cond ? `, ${cond}` : ''}`);
  }

  // Budget
  const budget = step2?.slots?.budget || slots?.budget_info || {};
  const maxPrice = budget.max_price || budget.maxPrice;
  const targetPrice = budget.target_price || budget.targetPrice;
  const monthlyBudget = budget.monthly_budget || budget.monthlyBudget;
  if (maxPrice || targetPrice || monthlyBudget) {
    const parts = [];
    if (targetPrice) parts.push(`target $${Number(targetPrice).toLocaleString()}`);
    if (maxPrice) parts.push(`max $${Number(maxPrice).toLocaleString()}`);
    if (monthlyBudget) parts.push(`~$${Number(monthlyBudget).toLocaleString()}/mo`);
    lines.push(`• Budget: ${parts.join(', ')}`);
  }

  // Finance preference
  const finInfo = slots?.finance_info || step2?.slots?.finance || {};
  const prefMethod = finInfo.preferred_method || finInfo.preferredMethod;
  const creditScore = finInfo.credit_score || finInfo.creditScore;
  const downPayment = finInfo.down_payment || finInfo.downPayment;
  if (prefMethod) lines.push(`• Prefers: ${prefMethod}`);
  if (creditScore) lines.push(`• Self-reported credit score: ${creditScore}`);
  if (downPayment) lines.push(`• Down payment mentioned: $${Number(downPayment).toLocaleString()}`);

  // Trade-in
  const tradeInfo = step3?.slots?.trade_in || step2?.slots?.trade_in || {};
  const tradeVehicle = tradeInfo.vehicle_info || tradeInfo.vehicleInfo || {};
  if (tradeVehicle.make || tradeVehicle.model || tradeInfo.estimated_value) {
    const tradeParts = [];
    if (tradeVehicle.year || tradeVehicle.make || tradeVehicle.model) {
      tradeParts.push([tradeVehicle.year, tradeVehicle.make, tradeVehicle.model].filter(Boolean).join(' '));
    }
    if (tradeInfo.estimated_value) tradeParts.push(`est. $${Number(tradeInfo.estimated_value).toLocaleString()}`);
    lines.push(`• Trade-in: ${tradeParts.join(', ')}`);
  }

  // Vehicle preferences / features
  const vpref = slots?.vehicle_preferences || {};
  if (vpref.features?.length) lines.push(`• Wanted features: ${vpref.features.slice(0, 5).join(', ')}`);
  const seating = step3?.slots?.customerPreferences?.requirements?.seating;
  if (seating) lines.push(`• Seating requirement: ${seating} seats`);

  // Test drive / appointment
  const td = slots?.test_drive_info || {};
  if (td.requested) lines.push(`• Test drive: requested${td.scheduled_date ? ` (${td.scheduled_date})` : ''}`);
  const appt = slots?.appointment_info || {};
  if (appt.scheduled) lines.push(`• Appointment scheduled: ${appt.date || 'yes'}`);

  // Lead status
  if (conv?.lead_score || conv?.lead_status) {
    lines.push(`• Lead score: ${conv.lead_score || '?'} / status: ${conv.lead_status || '?'}`);
  }

  return lines.length > 1 ? lines.join('\n') : '';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [deal, setDeal] = useState<FinanceDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dealType, setDealType]           = useState<'finance' | 'lease'>('finance');
  const [aprVal, setAprVal]               = useState(6.2);
  const [termVal, setTermVal]             = useState(60);
  const [downVal, setDownVal]             = useState(3000);
  // Lease-specific state
  const [moneyFactor, setMoneyFactor]     = useState(0.00125); // ~3% APR equivalent
  const [residualPct, setResidualPct]     = useState(55);      // % of MSRP
  const [includWarranty, setInclWarranty] = useState(true);
  const [includGap, setInclGap]           = useState(true);
  const [includAccessories, setInclAccessories] = useState(true);
  const [aiNotes, setAiNotes]             = useState('');
  const [editingNotes, setEditingNotes]   = useState(false);

  const [lenders, setLenders]             = useState<Lender[]>([]);
  const [selectedLenders, setSelectedLenders] = useState<string[]>([]);
  const [showLendersDialog, setShowLendersDialog]     = useState(false);
  const [showCreditDialog, setShowCreditDialog]       = useState(false);
  const [showDeskDialog, setShowDeskDialog]           = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog]   = useState(false);
  const [showSMSDialog, setShowSMSDialog]             = useState(false);
  const [showEmailDialog, setShowEmailDialog]         = useState(false);
  const [deskNotes, setDeskNotes]                     = useState('');
  const [followUpMsg, setFollowUpMsg]                 = useState('');
  const [smsMsg, setSmsMsg]                           = useState('');
  const [emailSubject, setEmailSubject]               = useState('');
  const [emailMsg, setEmailMsg]                       = useState('');
  const [actionLoading, setActionLoading]             = useState<string | null>(null);
  const [submittingLenders, setSubmittingLenders] = useState(false);

  // Edit Deal drawer
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [vehicles, setVehicles]             = useState<any[]>([]);
  const [savingEdit, setSavingEdit]         = useState(false);
  const [editForm, setEditForm] = useState({
    deal_type: 'finance' as 'finance' | 'lease',
    vehicle_id: '',
    vehicle_price: '',
    down_payment: '',
    credit_score: '',
    term_months: '60',
    // TTL
    sales_tax_rate: '',
    title_fee: '',
    license_fee: '',
    registration_fee: '',
    inspection_fee: '',
    processing_fee: '',
    // Trade-in
    trade_in_acv: '',
    trade_in_payoff: '',
    trade_in_year: '',
    trade_in_make: '',
    trade_in_model: '',
    trade_in_vin: '',
    trade_in_mileage: '',
    // Add-ons
    warranty_amount: '',
    gap_amount: '',
    accessories_amount: '',
    // Lease
    msrp: '',
    tax_rate: '',
    cap_cost_reductions: '',
    capitalized_fees: '',
    annual_mileage: '12000',
    excess_mileage_rate: '0.25',
  });

  // Dave AI chat state
  const [chatMessages, setChatMessages]         = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]               = useState('');
  const [chatLoading, setChatLoading]           = useState(false);
  const [chatSessionId]                         = useState(() => `deal_${Date.now()}_${Math.random().toString(36).slice(2,9)}`);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [priorConvSummary, setPriorConvSummary] = useState<string>('');
  const [loadingHistory, setLoadingHistory]     = useState(false);
  const [showHistory, setShowHistory]           = useState(false);
  const [priorMessages, setPriorMessages]       = useState<ChatMessage[]>([]);
  const [priorSlotContext, setPriorSlotContext] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Load deal ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await financeAPI.getDeal(id);
        if (res.success && res.data) {
          const d: FinanceDeal = res.data;
          setDeal(d);
          setDealType(d.deal_type || 'finance');
          // Use stored APR, or derive from credit tier if not set
          const storedApr = parseFloat(String(d.apr ?? 0));
          setAprVal(storedApr || 6.2);
          setTermVal(parseInt(String(d.term_months ?? 60)) || 60);
          setDownVal(parseFloat(String(d.down_payment ?? 0)) || 0);
          // Lease-specific: load stored money_factor / residual_value_pct if available
          if (d.money_factor) setMoneyFactor(parseFloat(String(d.money_factor)));
          if (d.residual_value_pct) setResidualPct(parseFloat(String(d.residual_value_pct)));
          setInclWarranty(d.include_warranty ?? true);
          setInclGap(d.include_gap ?? true);
          setInclAccessories(d.include_accessories ?? true);
          setAiNotes(d.ai_notes ?? '');
          setEditForm({
            deal_type:          d.deal_type || 'finance',
            vehicle_id:         d.vehicle_id || '',
            vehicle_price:      d.vehicle_price?.toString() || '',
            down_payment:       d.down_payment?.toString() || '0',
            credit_score:       d.credit_score?.toString() || '',
            term_months:        d.term_months?.toString() || '60',
            sales_tax_rate:     d.sales_tax ? (d.sales_tax / d.vehicle_price * 100 / 100).toFixed(4) : '',
            title_fee:          d.title_fee?.toString() || '',
            license_fee:        d.license_fee?.toString() || '',
            registration_fee:   d.registration_fee?.toString() || '',
            inspection_fee:     '',
            processing_fee:     d.dealer_fee?.toString() || '',
            trade_in_acv:       d.trade_in_acv?.toString() || '',
            trade_in_payoff:    d.trade_in_payoff?.toString() || '',
            trade_in_year:      d.trade_in_year?.toString() || '',
            trade_in_make:      d.trade_in_make || '',
            trade_in_model:     d.trade_in_model || '',
            trade_in_vin:       d.trade_in_vin || '',
            trade_in_mileage:   d.trade_in_mileage?.toString() || '',
            warranty_amount:    d.warranty_amount?.toString() || '',
            gap_amount:         d.gap_amount?.toString() || '',
            accessories_amount: d.accessories_amount?.toString() || '',
            msrp:               d.vehicle_msrp?.toString() || '',
            tax_rate:           '',
            cap_cost_reductions:'',
            capitalized_fees:   '',
            annual_mileage:     '12000',
            excess_mileage_rate:'0.25',
          });
        }
      } catch {
        toast({ title: 'Failed to load deal', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ── Load dealer finance defaults and apply as fallbacks ────────────────────
  useEffect(() => {
    if (!deal) return;
    (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(buildApiUrl('daive/finance-settings'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { data } = await res.json();
        if (!data) return;

        // Apply dealer defaults only where the deal has no value saved
        setEditForm(prev => ({
          ...prev,
          sales_tax_rate:   prev.sales_tax_rate   || (data.sales_tax_rate  ? String(data.sales_tax_rate)  : ''),
          title_fee:        prev.title_fee        || (data.title_fee        ? String(data.title_fee)        : ''),
          license_fee:      prev.license_fee      || (data.license_fee      ? String(data.license_fee)      : ''),
          registration_fee: prev.registration_fee || (data.registration_fee ? String(data.registration_fee) : ''),
          inspection_fee:   prev.inspection_fee   || (data.inspection_fee   ? String(data.inspection_fee)   : ''),
          processing_fee:   prev.processing_fee   || (data.doc_fee          ? String(data.doc_fee)          : ''),
        }));
      } catch { /* ignore — defaults are optional */ }
    })();
  }, [deal?.id]);

  // ── Load lenders ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await lendersAPI.getAll({ page: 1, limit: 50 });
        if (res.success) setLenders(res.data || []);
      } catch { /* ignore */ }
    })();
  }, []);

  // ── Load vehicles (for edit drawer) ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await vehiclesAPI.getAll({ limit: 200 });
        if (res.success) setVehicles(res.data || res.vehicles || []);
      } catch { /* ignore */ }
    })();
  }, []);

  // ── Dave AI init greeting + load prior conversation ────────────────────────
  useEffect(() => {
    if (!deal) return;
    const vehicleName = [deal.year, deal.make, deal.model].filter(Boolean).join(' ');

    const loadPriorAndGreet = async () => {
      let historySummary = '';
      let historyMsgs: ChatMessage[] = [];

      // If deal has a conversation_id, load the customer's prior DAIVE chat + slot context
      if (deal.conversation_id) {
        setLoadingHistory(true);
        try {
          const res = await fetch(buildApiUrl(`daive/deal-conversation/${deal.conversation_id}/messages`), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
          });
          const data = await res.json();
          if (data.success) {
            // Load chat messages
            if (data.messages?.length > 0) {
              historyMsgs = data.messages.map((m: any) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: m.timestamp,
              }));
              setPriorMessages(historyMsgs);
            }

            // Load and parse structured slot context
            const slots = data.slot_context;
            if (slots) {
              setPriorSlotContext(slots);
              historySummary = buildSlotSummary(slots, data.conversation);
            } else if (historyMsgs.length > 0) {
              // Fallback: summarise raw messages if no structured slots
              const userMsgs = historyMsgs.filter(m => m.role === 'user').slice(-6);
              historySummary = `Prior customer conversation summary:\n${userMsgs.map(m => `• Customer said: "${m.content.slice(0, 120)}"`).join('\n')}`;
            }
            setPriorConvSummary(historySummary);
          }
        } catch { /* ignore — graceful degradation */ }
        finally { setLoadingHistory(false); }
      }

      const hasPrior   = historyMsgs.length > 0;
      const hasSlots   = !!historySummary && historySummary.includes('===');
      const creditInfo = deal.credit_score ? ` · Credit: ${deal.credit_score}` : '';
      setChatMessages([{
        role: 'assistant',
        content: hasPrior
          ? hasSlots
            ? `Hi! I'm Dave. I've loaded ${deal.customer_name || 'the customer'}'s full DAIVE purchase journey — ${historyMsgs.filter(m => m.role === 'user').length} messages plus collected preferences (see chips below). Combined with the deal data (${vehicleName}${creditInfo}), I'm ready to help. What do you need?`
            : `Hi! I'm Dave. I've reviewed ${deal.customer_name || 'the customer'}'s prior chat with DAIVE (${historyMsgs.filter(m => m.role === 'user').length} messages). I also have the full deal on the ${vehicleName || 'vehicle'}${creditInfo}. How can I help you close it?`
          : `Hi! I'm Dave, your AI Sales Assistant. I have the full deal details for ${deal.customer_name || 'your customer'} on the ${vehicleName || 'vehicle'}${creditInfo}. How can I help you close this deal?`,
        timestamp: new Date().toISOString(),
      }]);
    };

    loadPriorAndGreet();
  }, [deal?.id]);

  // ── Auto-scroll chat ───────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Derived payment calculations ──────────────────────────────────────────
  // All DB fields are coerced to Number — backend returns strings from PostgreSQL
  const sellingPrice   = Number(deal?.vehicle_price ?? 0) || 0;
  const warrantyAmt    = includWarranty    ? (Number(deal?.warranty_amount    ?? 0) || 0) : 0;
  const gapAmt         = includGap         ? (Number(deal?.gap_amount         ?? 0) || 0) : 0;
  const accessoriesAmt = includAccessories ? (Number(deal?.accessories_amount ?? 0) || 0) : 0;
  const dealerFee      = Number(deal?.dealer_fee  ?? 0) || 0;
  const ttl            = Number(deal?.total_government_fees ?? 0) || 0;

  // Trade-in: use stored equity if available, otherwise derive from ACV - payoff
  const tradeAcv     = Number(deal?.trade_in_acv ?? 0) || 0;
  const tradePayoff  = Number(deal?.trade_in_payoff ?? 0) || 0;
  const tradeNet     = tradeAcv - tradePayoff;
  const tradeEquity  = Number(deal?.trade_in_equity ?? 0) || (tradeNet > 0 ? tradeNet : 0);
  const tradeNegative= Number(deal?.trade_in_negative_equity ?? 0) || (tradeNet < 0 ? Math.abs(tradeNet) : 0);

  // ── FINANCE calculations ───────────────────────────────────────────────────
  const amountFinanced = Math.max(
    0,
    sellingPrice + dealerFee + warrantyAmt + gapAmt + accessoriesAmt + ttl + tradeNegative
    - downVal - tradeEquity
  );
  const aprNum = Number(aprVal) || 0;
  const financePayment = calcMonthlyPayment(amountFinanced, aprNum, termVal);

  // ── LEASE calculations ─────────────────────────────────────────────────────
  // Standard lease formula: (Net Cap Cost - Residual) / term + (Net Cap Cost + Residual) × money_factor
  // Adjusted Cap Cost = selling price + F&I + fees - down - trade equity
  const msrpForLease   = sellingPrice;                           // use vehicle price as MSRP base
  const residualVal    = msrpForLease * (residualPct / 100);    // residual in dollars
  const netCapCost     = Math.max(
    0,
    sellingPrice + dealerFee + warrantyAmt + gapAmt + accessoriesAmt + ttl + tradeNegative
    - downVal - tradeEquity
  );
  const leaseTermMonths = termVal <= 48 ? termVal : 36;         // leases are typically 24/36/39 mo, cap at selected or 36
  const leaseDepreciation = (netCapCost - residualVal) / (leaseTermMonths || 36);
  const leaseFinanceCharge = (netCapCost + residualVal) * moneyFactor;
  const leasePayment  = Math.max(0, leaseDepreciation + leaseFinanceCharge);

  const estimatedPayment = dealType === 'lease' ? leasePayment : financePayment;

  // ── Dynamic APR matrix based on U.S. credit tier breakdown ────────────────
  // Super Prime 781-850: 4%–5.5% | Prime 661-780: 6%–9% | Near Prime 601-660: 9%–14%
  // Subprime 501-600: 14%–20% | Deep Subprime <500: 20%–29%
  const creditScore = Number(deal?.credit_score ?? 0);
  function getTierAprs(score: number): number[] {
    if (score >= 781) return [4.00, 4.50, 5.00, 5.50];   // Super Prime
    if (score >= 661) return [5.90, 6.20, 6.90, 7.50];   // Prime
    if (score >= 601) return [9.50, 10.50, 11.90, 13.50]; // Near Prime
    if (score >= 501) return [14.90, 16.50, 18.00, 19.90]; // Subprime
    if (score > 0)    return [20.90, 23.50, 25.90, 28.90]; // Deep Subprime
    return [5.90, 6.20, 6.90, 7.50]; // fallback (no score)
  }
  // Lease money factor tiers (approx APR / 2400)
  function getTierMoneyFactors(score: number): number[] {
    if (score >= 781) return [0.00100, 0.00110, 0.00125]; // Super Prime  ~2.4–3%
    if (score >= 661) return [0.00150, 0.00175, 0.00200]; // Prime        ~3.6–4.8%
    if (score >= 601) return [0.00250, 0.00300, 0.00350]; // Near Prime   ~6–8.4%
    if (score >= 501) return [0.00400, 0.00450, 0.00500]; // Subprime     ~9.6–12%
    return [0.00550, 0.00600, 0.00650];                   // Deep Subprime ~13.2–15.6%
  }
  const matrixTerms        = dealType === 'lease' ? [24, 36, 39] : [48, 60, 72, 84];
  const matrixAprs         = getTierAprs(creditScore);
  const matrixMoneyFactors = getTierMoneyFactors(creditScore);

  const stageIdx = DEAL_STAGES.findIndex(s => s.key === (deal?.deal_stage ?? 'lead'));

  // ── Save deal ──────────────────────────────────────────────────────────────
  const saveDeal = useCallback(async (patch: Partial<FinanceDeal>) => {
    if (!deal) return;
    setSaving(true);
    try {
      const res = await financeAPI.updateDeal(deal.id, patch);
      if (res.success) {
        setDeal(prev => prev ? { ...prev, ...patch } : prev);
        toast({ title: 'Deal saved' });
      }
    } catch {
      toast({ title: 'Failed to save deal', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [deal]);

  const recalcAndSave = async () => {
    const isLease = dealType === 'lease';
    await saveDeal({
      deal_type:            dealType,
      // Finance: set apr, null out lease fields. Lease: set lease fields, null out apr.
      apr:                  isLease ? null : aprNum,
      money_factor:         isLease ? moneyFactor : null,
      residual_value_pct:   isLease ? residualPct : null,
      term_months:          termVal,
      down_payment:         downVal,
      amount_financed:      isLease ? netCapCost : amountFinanced,
      monthly_payment:      estimatedPayment,
      include_warranty:     includWarranty,
      include_gap:          includGap,
      include_accessories:  includAccessories,
    });
  };

  // ── Submit to lenders ──────────────────────────────────────────────────────
  const submitToLenders = async () => {
    if (!deal || selectedLenders.length === 0) return;
    setSubmittingLenders(true);
    let ok = 0;
    for (const lid of selectedLenders) {
      try { await lendersAPI.submitDeal(lid, { deal_id: deal.id, submission_method: 'api' }); ok++; }
      catch { /* continue */ }
    }
    setSubmittingLenders(false);
    setShowLendersDialog(false);
    toast({ title: `Submitted to ${ok} lender${ok !== 1 ? 's' : ''}` });
  };

  // ── Generate PDF ───────────────────────────────────────────────────────────
  const generatePDF = async () => {
    if (!deal) return;
    setActionLoading('pdf');
    try {
      const res = await fetch(`/api/finance/deals/${deal.id}/generate-deal-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
      });
      const data = await res.json();
      if (data.success) {
        const sheetId  = data.id  || data.data?.id;
        const pdfUrl   = data.pdf_url || data.data?.pdf_url;
        setDeal(prev => prev ? { ...prev, pdf_url: pdfUrl, latest_deal_sheet_id: sheetId } : prev);
        toast({
          title: '✅ Deal Sheet Generated',
          description: pdfUrl
            ? <span>PDF ready. <a href={buildBackendAssetUrl(pdfUrl)} target="_blank" rel="noreferrer" className="underline text-orange-600">Open PDF</a></span>
            : 'Deal sheet saved.',
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (e: any) {
      toast({ title: 'Failed to generate PDF', description: e?.message, variant: 'destructive' });
    } finally { setActionLoading(null); }
  };

  // ── eSign ──────────────────────────────────────────────────────────────────
  const requestESign = async () => {
    if (!deal?.latest_deal_sheet_id) {
      toast({ title: 'Generate a deal sheet first', variant: 'destructive' }); return;
    }
    try {
      const res = await fetch('/api/finance/esign/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({
          deal_id: deal.id, deal_sheet_id: deal.latest_deal_sheet_id,
          signer_name: deal.customer_name || 'Customer',
          signer_email: deal.customer_email || '',
          signer_phone: deal.customer_phone,
          document_url: buildBackendAssetUrl(deal.pdf_url || ''),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'eSign request sent' });
        setDeal(prev => prev ? { ...prev, signature_request_id: data.id, signature_status: 'sent' } : prev);
      }
    } catch { toast({ title: 'Failed to send eSign request', variant: 'destructive' }); }
  };

  // ── Text Customer ─────────────────────────────────────────────────────────
  const sendSMS = async () => {
    if (!deal || !smsMsg.trim()) return;
    setActionLoading('sms');
    try {
      const res = await fetch(`/api/finance/deals/${deal.id}/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({ message: smsMsg.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSMSDialog(false);
        setSmsMsg('');
        toast({ title: '📱 SMS Sent', description: `Message sent to ${data.customer_name || data.phone}` });
      } else throw new Error(data.error);
    } catch (e: any) {
      toast({ title: 'Failed to send SMS', description: e?.message, variant: 'destructive' });
    } finally { setActionLoading(null); }
  };

  // ── Email Proposal ─────────────────────────────────────────────────────────
  const sendEmailProposal = async () => {
    if (!deal) return;
    setActionLoading('email');
    try {
      const res = await fetch(`/api/finance/deals/${deal.id}/send-email-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({ subject: emailSubject || undefined, message: emailMsg || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setShowEmailDialog(false);
        setEmailSubject('');
        setEmailMsg('');
        toast({ title: '📧 Proposal Sent', description: `Email sent to ${data.customer_name || data.email}` });
      } else throw new Error(data.error);
    } catch (e: any) {
      toast({ title: 'Failed to send email', description: e?.message, variant: 'destructive' });
    } finally { setActionLoading(null); }
  };

  // ── Send to F&I ───────────────────────────────────────────────────────────
  const sendToFI = async () => {
    if (!deal) return;
    setActionLoading('fi');
    try {
      const res = await fetch(`/api/finance/deals/${deal.id}/send-to-fi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
      });
      const data = await res.json();
      if (data.success) {
        setDeal(prev => prev ? { ...prev, deal_stage: 'fi' } : prev);
        toast({ title: '✅ Sent to F&I', description: 'F&I managers have been notified.' });
      } else throw new Error(data.error);
    } catch { toast({ title: 'Failed to send to F&I', variant: 'destructive' }); }
    finally { setActionLoading(null); }
  };

  // ── Desk Manager Approval ─────────────────────────────────────────────────
  const requestDeskApproval = async () => {
    if (!deal) return;
    setActionLoading('desk');
    try {
      const res = await fetch(`/api/finance/deals/${deal.id}/request-desk-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({ notes: deskNotes }),
      });
      const data = await res.json();
      if (data.success) {
        setDeal(prev => prev ? { ...prev, deal_stage: 'desk_approval' } : prev);
        setShowDeskDialog(false);
        setDeskNotes('');
        toast({ title: '🚨 Approval Requested', description: 'Desk managers have been notified.' });
      } else throw new Error(data.error);
    } catch { toast({ title: 'Failed to request approval', variant: 'destructive' }); }
    finally { setActionLoading(null); }
  };

  // ── AI Follow-Up ──────────────────────────────────────────────────────────
  const triggerAIFollowUp = async () => {
    if (!deal) return;
    setActionLoading('followup');
    try {
      const res = await fetch(`/api/finance/deals/${deal.id}/ai-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({ message: followUpMsg || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setShowFollowUpDialog(false);
        setFollowUpMsg('');
        toast({ title: '🤖 Follow-Up Queued', description: `AI follow-up sent for ${data.customer_name || 'customer'}.` });
      } else throw new Error(data.error);
    } catch { toast({ title: 'Failed to trigger follow-up', variant: 'destructive' }); }
    finally { setActionLoading(null); }
  };

  // ── Save edit form ─────────────────────────────────────────────────────────
  const saveEditForm = async () => {
    if (!deal) return;
    setSavingEdit(true);
    try {
      const patch: any = {
        deal_type:          editForm.deal_type,
        term_months:        parseInt(editForm.term_months) || deal.term_months,
        down_payment:       parseFloat(editForm.down_payment) || 0,
      };
      if (editForm.vehicle_price)      patch.vehicle_price      = parseFloat(editForm.vehicle_price);
      // credit_score lives on credit_applications, not finance_deals — excluded from patch
      if (editForm.title_fee)          patch.title_fee          = parseFloat(editForm.title_fee);
      if (editForm.license_fee)        patch.license_fee        = parseFloat(editForm.license_fee);
      if (editForm.registration_fee)   patch.registration_fee   = parseFloat(editForm.registration_fee);
      if (editForm.processing_fee)     patch.dealer_fee         = parseFloat(editForm.processing_fee);
      if (editForm.trade_in_acv)       patch.trade_in_acv       = parseFloat(editForm.trade_in_acv);
      if (editForm.trade_in_payoff)    patch.trade_in_payoff    = parseFloat(editForm.trade_in_payoff);
      if (editForm.trade_in_year)      patch.trade_in_year      = parseInt(editForm.trade_in_year);
      if (editForm.trade_in_make)      patch.trade_in_make      = editForm.trade_in_make;
      if (editForm.trade_in_model)     patch.trade_in_model     = editForm.trade_in_model;
      if (editForm.trade_in_vin)       patch.trade_in_vin       = editForm.trade_in_vin;
      if (editForm.trade_in_mileage)   patch.trade_in_mileage   = parseInt(editForm.trade_in_mileage);
      if (editForm.warranty_amount)    patch.warranty_amount    = parseFloat(editForm.warranty_amount);
      if (editForm.gap_amount)         patch.gap_amount         = parseFloat(editForm.gap_amount);
      if (editForm.accessories_amount) patch.accessories_amount = parseFloat(editForm.accessories_amount);
      if (editForm.msrp)               patch.vehicle_msrp       = parseFloat(editForm.msrp);

      // Recalculate TTL total
      const ttlTotal = [editForm.title_fee, editForm.license_fee, editForm.registration_fee, editForm.inspection_fee]
        .map(v => parseFloat(v) || 0).reduce((a, b) => a + b, 0);
      if (ttlTotal > 0) patch.total_government_fees = ttlTotal;

      // Recalculate trade equity
      if (editForm.trade_in_acv || editForm.trade_in_payoff) {
        const acv = parseFloat(editForm.trade_in_acv) || 0;
        const payoff = parseFloat(editForm.trade_in_payoff) || 0;
        const equity = acv - payoff;
        patch.trade_in_equity = equity > 0 ? equity : 0;
        patch.trade_in_negative_equity = equity < 0 ? Math.abs(equity) : 0;
      }

      const res = await financeAPI.updateDeal(deal.id, patch);
      if (res.success) {
        setDeal(prev => prev ? { ...prev, ...patch } : prev);
        setShowEditDrawer(false);
        toast({ title: 'Deal updated successfully' });
      }
    } catch {
      toast({ title: 'Failed to update deal', variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Dave AI send message ───────────────────────────────────────────────────
  const sendChatMessage = async (text: string) => {
    if (!text.trim() || chatLoading) return;
    setShowQuickActions(false);
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const creditScore  = deal?.credit_score ? String(deal.credit_score) : null;
      const dealContext = deal ? [
        `[DEAL WORKSPACE — Salesperson-facing AI assistant]`,
        `IMPORTANT: You are helping a SALESPERSON, not the customer. All information below is already known — do NOT ask for any of it.`,
        ``,
        `Customer: ${deal.customer_name || 'N/A'}`,
        `Credit Score: ${creditScore || 'not on file'}`,
        `Vehicle: ${[deal.year, deal.make, deal.model].filter(Boolean).join(' ') || 'N/A'}`,
        `Vehicle Price: $${Number(deal.vehicle_price || 0).toLocaleString()}`,
        `Down Payment: $${downVal?.toLocaleString() || '0'}`,
        `Term: ${termVal} months`,
        `APR: ${aprVal}%`,
        `Est. Monthly Payment: $${Math.round(estimatedPayment).toLocaleString()}/mo`,
        `Balance Financed: $${Math.round(amountFinanced).toLocaleString()}`,
        `Deal Type: ${deal.deal_type || 'finance'}`,
        `Deal Stage: ${deal.deal_stage || 'N/A'}`,
      ].join('\n') : '';
      const priorContext = priorConvSummary ? `\n\n${priorConvSummary}` : '';
      const response = await fetch(buildApiUrl('daive/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({
          vehicleId: deal?.vehicle_id || 'deal',
          sessionId: chatSessionId,
          message: `${dealContext}${priorContext}\n\nSalesperson question: ${text}`,
          customerInfo: { name: 'Salesperson', email: user?.email || 'staff@dealer.com', dealerId: user?.dealerProfile?.id || '' },
        }),
      });
      const data = await response.json();
      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.data.response, timestamp: new Date().toISOString() }]);
      } else { throw new Error(data.error); }
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I encountered an issue connecting to my analysis engine. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally { setChatLoading(false); }
  };

  // ── Loading / not found ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen flex-col">
        <TopNavigation />
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading deal workspace…
          </div>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex h-screen flex-col">
        <TopNavigation />
        <div className="flex flex-1 items-center justify-center gap-4 flex-col">
          <AlertCircle className="h-10 w-10 text-gray-400" />
          <p className="text-gray-500">Deal not found</p>
          <Button variant="outline" onClick={() => navigate('/finance')}>Back to Finance</Button>
        </div>
      </div>
    );
  }

  const vehicleLabel = [deal.year, deal.make, deal.model, deal.trim].filter(Boolean).join(' ') || 'Vehicle';
  const initials = getInitials(deal.customer_name);
  const adjPrice = sellingPrice;

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <TopNavigation />

      {/* ── Deal Header Bar ── */}
      <div className="bg-white border-b px-5 py-3 flex items-center gap-3 flex-wrap shadow-sm">
        <button
          onClick={() => navigate('/finance')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Deals
        </button>

        <div className="h-4 w-px bg-gray-200 mx-1" />

        <div className="flex items-center gap-2.5">
          <h1 className="font-bold text-base text-gray-900">
            Deal {deal.deal_number ? `#${deal.deal_number}` : `#${deal.id.slice(0,8).toUpperCase()}`}
          </h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
            {deal.status === 'approved' ? 'Active' : deal.status}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(deal.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {saving && <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={recalcAndSave}>
            Save Deal
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowEditDrawer(true)}>
            <Settings className="h-3.5 w-3.5" />
            Edit Deal
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white">
                Actions
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => saveDeal({ deal_stage: 'desking' })}>
                <Calculator className="h-4 w-4 mr-2 text-orange-500" />
                Move to Desking
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => saveDeal({ deal_stage: 'fi' })}>
                <FileText className="h-4 w-4 mr-2 text-purple-500" />
                Send to F&amp;I
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => saveDeal({ deal_stage: 'signed' })}>
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                Mark as Signed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => saveDeal({ status: 'approved' })}>
                <Shield className="h-4 w-4 mr-2 text-emerald-500" />
                Mark Approved
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={recalcAndSave}>
                <RefreshCw className="h-4 w-4 mr-2 text-gray-500" />
                Recalculate &amp; Save
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowEditDrawer(true)}>
                <Edit2 className="h-4 w-4 mr-2 text-gray-500" />
                Edit Deal Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => saveDeal({ status: 'cancelled' })}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Deal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Stage Progress Bar ── */}
      <div className="bg-white border-b px-5 py-3 overflow-x-auto">
        <div className="flex items-center min-w-max">
          {DEAL_STAGES.map((stage, i) => {
            const isDone    = i < stageIdx;
            const isActive  = i === stageIdx;
            const isFuture  = i > stageIdx;
            return (
              <div key={stage.key} className="flex items-center">
              <button
                onClick={() => saveDeal({ deal_stage: stage.key })}
                  className="flex flex-col items-center gap-1 group"
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all
                    ${isDone   ? 'bg-green-500 border-green-500 text-white'
                    : isActive  ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-200'
                    : 'bg-white border-gray-300 text-gray-400 group-hover:border-gray-400'}`}
                  >
                    {isDone ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <div className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-white' : 'bg-gray-300'}`} />
                    )}
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap
                    ${isDone ? 'text-green-600' : isActive ? 'text-orange-600' : 'text-gray-400'}`}>
                {stage.label}
                  </span>
                </button>
                {i < DEAL_STAGES.length - 1 && (
                  <div className={`h-0.5 w-10 mx-1 mt-[-14px] ${i < stageIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4-column workspace ── */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[240px_1fr_290px_290px] overflow-hidden min-h-0" style={{ height: 'calc(100vh - 160px)' }}>

        {/* ══════════════════════════════════════
            LEFT PANEL – Customer + Vehicle
        ══════════════════════════════════════ */}
        <aside className="bg-white border-r overflow-y-auto flex flex-col">

          {/* Customer Information */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer Information</h3>
              <button className="text-xs text-orange-600 hover:underline font-medium">Edit</button>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight truncate">{deal.customer_name || 'Unknown Customer'}</p>
            {deal.customer_phone && (
                  <p className="text-xs text-gray-500 truncate">{deal.customer_phone}</p>
                )}
                {deal.customer_email && (
                  <p className="text-xs text-gray-500 truncate">{deal.customer_email}</p>
                )}
              </div>
            </div>

            {/* Credit bureau score badges */}
            {(deal.experian_score || deal.equifax_score || deal.transunion_score || deal.credit_score) && (
              <div className="flex gap-2 mb-2">
                {deal.experian_score && (
                  <div className="flex-1 rounded-lg bg-gray-50 border px-2 py-1.5 text-center">
                    <p className="text-[10px] text-gray-500 font-medium">Experian</p>
                    <p className={`text-base font-bold ${creditScoreColor(deal.experian_score)}`}>{deal.experian_score}</p>
                  </div>
                )}
                {deal.equifax_score && (
                  <div className="flex-1 rounded-lg bg-gray-50 border px-2 py-1.5 text-center">
                    <p className="text-[10px] text-gray-500 font-medium">Equifax</p>
                    <p className={`text-base font-bold ${creditScoreColor(deal.equifax_score)}`}>{deal.equifax_score}</p>
                  </div>
                )}
                {deal.transunion_score && (
                  <div className="flex-1 rounded-lg bg-gray-50 border px-2 py-1.5 text-center">
                    <p className="text-[10px] text-gray-500 font-medium">TransUnion</p>
                    <p className={`text-base font-bold ${creditScoreColor(deal.transunion_score)}`}>{deal.transunion_score}</p>
                  </div>
                )}
                {!deal.experian_score && !deal.equifax_score && !deal.transunion_score && deal.credit_score && (
                  <div className="flex-1 rounded-lg bg-gray-50 border px-2 py-1.5 text-center">
                    <p className="text-[10px] text-gray-500 font-medium">Credit Score</p>
                    <p className={`text-base font-bold ${creditScoreColor(deal.credit_score)}`}>{deal.credit_score}</p>
                  </div>
                )}
                  </div>
                )}
                {deal.credit_tier && (
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${CREDIT_TIER_COLORS[deal.credit_tier] ?? 'bg-gray-100 text-gray-700'}`}>
                {deal.credit_tier.replace(/_/g, ' ')}
                  </span>
                )}
            <button
              className="flex items-center gap-1 text-xs text-orange-600 hover:underline mt-2"
              onClick={() => setShowCreditDialog(true)}
            >
              <ExternalLink className="h-3 w-3" />
              View Credit Report
            </button>
          </div>

          {/* AI Notes from Dave */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-orange-500" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Notes from Dave</p>
              </div>
              <button className="text-xs text-orange-600 hover:underline" onClick={() => setEditingNotes(!editingNotes)}>
                {editingNotes ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={aiNotes}
                  onChange={e => setAiNotes(e.target.value)}
                  rows={4}
                  className="text-xs resize-none"
                  placeholder="AI-generated notes…"
                />
                <Button size="sm" className="h-6 text-xs w-full" onClick={() => { saveDeal({ ai_notes: aiNotes }); setEditingNotes(false); }}>
                  Save Notes
                </Button>
              </div>
            ) : (
              <div className="rounded-lg bg-orange-50 border border-orange-100 p-2.5">
                <p className="text-xs text-gray-700 leading-relaxed">
                  {aiNotes || 'Prime credit tier. Strong approval odds with multiple lenders.'}
                </p>
              </div>
            )}
          </div>

          {/* Selected Vehicle */}
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Selected Vehicle</h3>
              <button className="text-xs text-orange-600 hover:underline font-medium">Edit</button>
            </div>

            {deal.vehicle_image_url ? (
              <img
                src={buildBackendAssetUrl(deal.vehicle_image_url.replace(/^"|"$/g, ''))}
                alt={vehicleLabel}
                className="w-full h-24 object-cover rounded-lg mb-2"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                <Car className="h-8 w-8 text-gray-300" />
              </div>
            )}

            <p className="font-semibold text-sm leading-tight">{vehicleLabel}</p>
            {deal.trim && <p className="text-xs text-gray-500 mb-2">{deal.trim}</p>}

            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs mt-1 mb-3">
              {deal.stock_number && (
                <><span className="text-gray-400">Stock #</span><span className="font-medium">{deal.stock_number}</span></>
              )}
              {deal.vin && (
                <><span className="text-gray-400">VIN</span><span className="font-mono truncate">{deal.vin.slice(-8)}</span></>
              )}
              {deal.mileage != null && (
                <><span className="text-gray-400">Miles</span><span>{fmt(deal.mileage)}</span></>
              )}
            </div>

            {/* Vehicle pricing breakdown */}
            <div className="space-y-1 text-xs border-t pt-2">
              {deal.vehicle_msrp != null && (
                <div className="flex justify-between"><span className="text-gray-500">MSRP</span><span className="font-medium">{fmtCurrency(deal.vehicle_msrp)}</span></div>
              )}
              {deal.vehicle_internet_price != null && (
                <div className="flex justify-between"><span className="text-gray-500">Internet Price</span><span className="font-medium">{fmtCurrency(deal.vehicle_internet_price)}</span></div>
              )}
              {deal.dealer_discount != null && deal.dealer_discount > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Dealer Discount</span><span className="font-medium text-green-600">-{fmtCurrency(deal.dealer_discount)}</span></div>
              )}
              {deal.reconditioning_cost != null && deal.reconditioning_cost > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Reconditioning</span><span className="font-medium">+{fmtCurrency(deal.reconditioning_cost)}</span></div>
              )}
              <div className="flex justify-between border-t pt-1">
                <span className="font-semibold text-gray-700">Adjusted Price</span>
                <span className="font-bold text-gray-900">{fmtCurrency(adjPrice)}</span>
            </div>
          </div>

            {deal.gross_profit != null && (
              <div className="mt-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-green-700">Gross Profit</span>
                <span className="text-sm font-bold text-green-700">{fmtCurrency(deal.gross_profit)}</span>
            </div>
            )}
          </div>
        </aside>

        {/* ══════════════════════════════════════
            CENTER – Deal Structure
        ══════════════════════════════════════ */}
        <main className="overflow-y-auto p-4 space-y-4 bg-gray-50">

          {/* Deal Structure Card */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-sm text-gray-800">Deal Structure</h2>
            </div>

            {/* Selling Price section */}
            <div className="px-5 pt-3 pb-1">
              <div className="flex justify-between items-center pb-2 border-b mb-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Selling Price</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</span>
              </div>

              <DSRow label="Vehicle Price"    value={fmtCurrency(sellingPrice)}             bold />
              <DSRow label="Dealer Fee"       value={dealerFee > 0 ? fmtCurrency(dealerFee) : '$0'} />
              <DSRow label="TTL (Tax, Title, License)" value={fmtCurrency(ttl || 0)} />
              <DSRow label="Warranty"         value={includWarranty && deal.warranty_amount ? fmtCurrency(warrantyAmt) : '—'} />
              <DSRow label="GAP"              value={includGap && deal.gap_amount ? fmtCurrency(gapAmt) : '—'} />
              <DSRow label="Accessories"      value={includAccessories && deal.accessories_amount ? fmtCurrency(accessoriesAmt) : '—'} />
              {downVal > 0 && <DSRow label="Down Payment"  value={`-${fmtCurrency(downVal)}`} green />}

              {/* Trade-in net — single line like the mockup */}
              {tradeAcv > 0 && tradeEquity > 0 && (
                <DSRow label="Trade Equity"    value={`-${fmtCurrency(tradeEquity)}`}    green />
              )}
              {tradeAcv > 0 && tradeNegative > 0 && (
                <DSRow label="Negative Equity" value={`+${fmtCurrency(tradeNegative)}`}  red />
              )}
            </div>

            <div className="mx-5 border-t pt-2 pb-3 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-800">Balance Financed</span>
              <span className="text-base font-bold text-orange-600">{fmtCurrency(amountFinanced)}</span>
            </div>
          </div>

          {/* Trade-In Card */}
          {(deal.trade_in_make || deal.trade_in_acv != null) && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-sm text-gray-800">Trade-In</h2>
                <button className="text-xs text-orange-600 hover:underline font-medium">Edit</button>
              </div>

              <div className="p-4 flex gap-3">
                {deal.trade_in_image_url ? (
                  <img src={buildBackendAssetUrl(deal.trade_in_image_url)} alt="Trade" className="h-16 w-24 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="h-16 w-24 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Car className="h-6 w-6 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">
                    {[deal.trade_in_year, deal.trade_in_make, deal.trade_in_model].filter(Boolean).join(' ') || 'Trade-In Vehicle'}
                  </p>
                  {deal.trade_in_vin && <p className="text-xs text-gray-500 font-mono">{deal.trade_in_vin}</p>}
                  {deal.trade_in_mileage != null && <p className="text-xs text-gray-500">Mileage: {fmt(deal.trade_in_mileage)}</p>}
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Trade Value (ACV)</span>
                      <span className="font-semibold">{fmtCurrency(deal.trade_in_acv)}</span>
                    </div>
                    {deal.trade_in_payoff != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Payoff</span>
                        <span className="font-semibold">{fmtCurrency(deal.trade_in_payoff)}</span>
                      </div>
                    )}
                    {tradeNegative > 0 && (
                      <div className="flex justify-between text-xs border-t pt-1 mt-1">
                        <span className="text-red-600 font-medium">Negative Equity</span>
                        <span className="font-bold text-red-600">-{fmtCurrency(tradeNegative)}</span>
                      </div>
                    )}
                    {tradeEquity > 0 && (
                      <div className="flex justify-between text-xs border-t pt-1 mt-1">
                        <span className="text-green-600 font-medium">Trade Equity</span>
                        <span className="font-bold text-green-600">+{fmtCurrency(tradeEquity)}</span>
            </div>
                    )}
          </div>
                </div>
              </div>
            </div>
          )}

          {/* Deal Notes */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2 text-gray-700">
              <FileText className="h-4 w-4 text-orange-500" />
              Deal Notes
            </h3>
            <Textarea
              defaultValue={deal.notes ?? ''}
              rows={3}
              className="text-xs resize-none"
              placeholder="Add internal notes…"
              onBlur={e => saveDeal({ notes: e.target.value })}
            />
          </div>
        </main>

        {/* ══════════════════════════════════════
            CENTER-RIGHT – Payment Options
        ══════════════════════════════════════ */}
        <aside className="bg-white border-l overflow-y-auto flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-bold text-sm text-gray-800 mb-3">Payment Options</h2>

            {/* Finance / Lease toggle */}
            <div className="flex rounded-lg overflow-hidden border border-orange-200 mb-4 text-sm font-medium">
              <button
                className={`flex-1 py-1.5 transition-colors text-sm font-semibold ${dealType === 'finance' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => {
                  setDealType('finance');
                  // Restore a valid finance term if currently on a lease term
                  if (termVal < 48) setTermVal(60);
                }}
              >Finance</button>
              <button
                className={`flex-1 py-1.5 transition-colors text-sm font-semibold ${dealType === 'lease' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => {
                  setDealType('lease');
                  // Lease terms are 24/36/39 — reset to 36 if on a finance term
                  if (termVal > 39) setTermVal(36);
                }}
              >Lease</button>
            </div>

            {/* Cash Down */}
            <div className="mb-4">
              <Label className="text-xs text-gray-500 mb-1 block">Cash Down</Label>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-500 font-medium">$</span>
                <Input
                  type="number"
                  value={downVal}
                  onChange={e => setDownVal(parseInt(e.target.value) || 0)}
                  className="h-8 text-sm font-semibold"
                />
              </div>
              <input
                type="range" min={0} max={Math.max(10000, sellingPrice * 0.3)} step={500}
                value={downVal}
                onChange={e => setDownVal(parseInt(e.target.value))}
                className="w-full accent-orange-500 h-1.5"
              />
            </div>

            {/* Term buttons */}
            <div className="mb-4">
              <Label className="text-xs text-gray-500 mb-2 block">Term (Months)</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[48, 60, 72, 84].map(t => (
                  <button
                    key={t}
                    onClick={() => setTermVal(t)}
                    className={`py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                      termVal === t
                        ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-orange-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* APR (finance) or Money Factor (lease) */}
            {dealType === 'finance' ? (
            <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <Label className="text-xs text-gray-500">APR (%)</Label>
                  <span className="text-xs font-bold text-orange-600">{aprNum.toFixed(2)}%</span>
              </div>
              <input
                  type="range" min={0} max={29.9} step={0.1}
                  value={aprNum}
                  onChange={e => setAprVal(parseFloat(e.target.value) || 0)}
                  className="w-full accent-orange-500 h-1.5"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>0%</span><span>14.95%</span><span>29.9%</span>
              </div>
            </div>
            ) : (
              <div className="mb-4 space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs text-gray-500">Money Factor</Label>
                    <span className="text-xs font-bold text-orange-600">
                      {moneyFactor.toFixed(5)} <span className="text-gray-400 font-normal">(~{(moneyFactor * 2400).toFixed(2)}% APR)</span>
                    </span>
              </div>
              <input
                    type="range" min={0.00050} max={0.00700} step={0.00005}
                    value={moneyFactor}
                    onChange={e => setMoneyFactor(parseFloat(e.target.value))}
                    className="w-full accent-orange-500 h-1.5"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0.00050</span><span>0.00350</span><span>0.00700</span>
              </div>
            </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs text-gray-500">Residual Value</Label>
                    <span className="text-xs font-bold text-orange-600">
                      {residualPct}% <span className="text-gray-400 font-normal">({fmtCurrency(residualVal)})</span>
                    </span>
                  </div>
                  <input
                    type="range" min={30} max={70} step={1}
                    value={residualPct}
                    onChange={e => setResidualPct(parseInt(e.target.value))}
                    className="w-full accent-orange-500 h-1.5"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>30%</span><span>50%</span><span>70%</span>
                  </div>
                </div>
              </div>
            )}

            {/* F&I Toggles */}
            <div className="space-y-2 mb-4">
              <ToggleRow label="Include Warranty"     checked={includWarranty}    onToggle={setInclWarranty} />
              <ToggleRow label="Include GAP"          checked={includGap}         onToggle={setInclGap} />
              <ToggleRow label="Include Accessories"  checked={includAccessories} onToggle={setInclAccessories} />
            </div>

            {/* Estimated Payment highlight */}
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 text-center">
              <p className="text-xs text-orange-600 font-medium">Est. Monthly Payment</p>
              <p className="text-3xl font-bold text-orange-600 mt-0.5">
                {fmtCurrency(estimatedPayment)}<span className="text-sm font-normal text-orange-400">/mo</span>
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                {dealType === 'lease'
                  ? `${termVal}mo lease · MF ${moneyFactor.toFixed(5)} · ${residualPct}% residual · ${fmtCurrency(downVal)} cap reduction`
                  : `${termVal}mo · ${aprNum.toFixed(2)}% APR · ${fmtCurrency(downVal)} down`}
              </p>
            </div>
          </div>

          {/* Payment Matrix */}
          <div className="p-4 flex-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {dealType === 'lease' ? 'Lease Matrix' : 'Payment Matrix'}
            </h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-gray-400 font-medium pb-2">Term</th>
                  <th className="text-center text-gray-400 font-medium pb-2">{dealType === 'lease' ? 'MF' : 'APR'}</th>
                  <th className="text-right text-gray-400 font-medium pb-2">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {matrixTerms.map((t, i) => {
                  const pmt = dealType === 'lease'
                    ? Math.max(0, (netCapCost - msrpForLease * (residualPct / 100)) / t + (netCapCost + msrpForLease * (residualPct / 100)) * matrixMoneyFactors[i])
                    : calcMonthlyPayment(amountFinanced, matrixAprs[i], t);
                  const isHighlight = t === termVal;
                      return (
                    <tr
                      key={t}
                      className={`cursor-pointer hover:bg-orange-50 transition-colors ${isHighlight ? 'bg-orange-50' : ''}`}
                      onClick={() => {
                        setTermVal(t);
                        if (dealType === 'lease') setMoneyFactor(matrixMoneyFactors[i]);
                        else setAprVal(matrixAprs[i]);
                      }}
                    >
                      <td className={`py-2.5 font-semibold ${isHighlight ? 'text-orange-600' : 'text-gray-700'}`}>
                        {t} Months
                      </td>
                      <td className={`py-2.5 text-center font-medium ${isHighlight ? 'text-orange-600' : 'text-gray-600'}`}>
                        {dealType === 'lease' ? matrixMoneyFactors[i].toFixed(5) : `${matrixAprs[i].toFixed(2)}%`}
                      </td>
                      <td className={`py-2.5 text-right font-bold ${isHighlight ? 'text-orange-600' : 'text-gray-800'}`}>
                          {fmtCurrency(pmt)}
                        </td>
                    </tr>
                      );
                    })}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-400 mt-3">Payments include all taxes and fees</p>
          </div>
        </aside>

        {/* ══════════════════════════════════════
            RIGHT – Dave AI Chat
        ══════════════════════════════════════ */}
        <aside className="bg-white border-l flex flex-col overflow-hidden">
          {/* Dave header */}
          <div className="px-4 py-3 border-b bg-white flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Bot className="h-4.5 w-4.5 text-white h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-gray-900">Dave</p>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">AI Sales Assistant</p>
              </div>
            </div>
      </div>

          {/* Prior conversation banner */}
          {loadingHistory && (
            <div className="px-3 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
              <span className="text-[11px] text-orange-700 font-medium">Loading customer's prior conversation…</span>
            </div>
          )}
          {!loadingHistory && (priorMessages.length > 0 || priorSlotContext) && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                  <span className="text-[11px] text-amber-800 font-semibold">
                    DAIVE Journey Loaded · {priorMessages.filter(m => m.role === 'user').length} customer messages
                  </span>
                </div>
                <button
                  onClick={() => setShowHistory(h => !h)}
                  className="text-[11px] text-amber-700 underline font-medium hover:text-amber-900"
                >
                  {showHistory ? 'Hide' : 'View'}
                </button>
              </div>

              {/* Slot highlights — always visible */}
              {priorSlotContext && (() => {
                const ds = priorSlotContext.daivesteps || {};
                const step1 = ds[1] || ds['1'] || {};
                const step2 = ds[2] || ds['2'] || {};
                const step3 = ds[3] || ds['3'] || {};
                const budget = step2?.slots?.budget || priorSlotContext.budget_info || {};
                const fi = priorSlotContext.finance_info || {};
                const chips: string[] = [];
                const vMake  = step1.make  || step3?.slots?.VehicleSelection?.selectedVehicle?.make || '';
                const vModel = step1.model || step3?.slots?.VehicleSelection?.selectedVehicle?.model || '';
                if (vMake || vModel) chips.push(`🚗 ${[vMake, vModel].filter(Boolean).join(' ')}`);
                const bp = budget.max_price || budget.target_price;
                if (bp) chips.push(`💰 $${Number(bp).toLocaleString()}`);
                const mo = budget.monthly_budget || fi.monthly_budget;
                if (mo) chips.push(`📅 $${Number(mo).toLocaleString()}/mo`);
                if (fi.preferred_method) chips.push(`🏦 ${fi.preferred_method}`);
                if (fi.credit_score) chips.push(`📊 ${fi.credit_score} score`);
                const ti = step3?.slots?.trade_in || {};
                const tv = ti.vehicle_info || {};
                if (tv.make) chips.push(`🔄 Trade: ${[tv.year, tv.make, tv.model].filter(Boolean).join(' ')}`);
                const seat = step3?.slots?.customerPreferences?.requirements?.seating;
                if (seat) chips.push(`💺 ${seat} seats`);
                return chips.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {chips.map((c, i) => (
                      <span key={i} className="text-[10px] bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 font-medium">
                        {c}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* Expandable full history */}
              {showHistory && (
                <div className="mt-2 max-h-52 overflow-y-auto space-y-1.5 pr-1 border-t border-amber-100 pt-2">
                  {priorMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-white border border-amber-100 text-gray-700'
                      }`}>
                        <span className="block font-semibold text-[10px] mb-0.5 opacity-70">
                          {m.role === 'user' ? 'Customer' : 'Dave (DAIVE)'}
                        </span>
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {showQuickActions && chatMessages.length <= 1 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500 mb-2">How can I help?</p>
                <div className="flex flex-col gap-1.5">
                  {DAVE_QUICK_ACTIONS.map(action => (
                    <button
                      key={action}
                      onClick={() => sendChatMessage(action)}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50 text-gray-700 transition-colors font-medium shadow-sm"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <Bot className="h-3 w-3 text-white" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-orange-500 text-white rounded-br-none'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                }`}>
                  {msg.content}
                  {msg.role === 'assistant' && (
                    <div className="flex gap-2 mt-1.5 pt-1.5 border-t border-gray-100">
                      <button className="text-gray-400 hover:text-gray-600"><ThumbsUp className="h-3 w-3" /></button>
                      <button className="text-gray-400 hover:text-gray-600"><ThumbsDown className="h-3 w-3" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mr-2">
                  <Bot className="h-3 w-3 text-white" />
                </div>
                <div className="bg-white border border-gray-100 rounded-xl rounded-bl-none px-3 py-2 shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-3 border-t bg-white flex-shrink-0">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(chatInput); } }}
                placeholder="Ask Dave anything…"
                className="flex-1 text-xs rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition"
              />
              <button
                onClick={() => sendChatMessage(chatInput)}
                disabled={chatLoading || !chatInput.trim()}
                className="h-8 w-8 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Send className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Bottom Action Bar ── */}
      <div className="bg-white border-t shadow-md px-4 py-2.5 flex items-center gap-2 flex-wrap flex-shrink-0">
        <ActionBtn icon={<Send className="h-4 w-4" />} label="Submit to Lenders" primary onClick={() => setShowLendersDialog(true)} />
        <ActionBtn icon={actionLoading === 'pdf' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} label="Print Pencil" onClick={generatePDF} />
        <ActionBtn icon={actionLoading === 'sms' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />} label="Text Customer" onClick={() => { setSmsMsg(`Hi ${deal.customer_name?.split(' ')[0] || 'there'}! Your ${[deal.year, deal.make, deal.model].filter(Boolean).join(' ')} deal is ready. Est. payment: $${Math.round(estimatedPayment).toLocaleString()}/mo. Let us know if you have questions!`); setShowSMSDialog(true); }} />
        <ActionBtn icon={actionLoading === 'email' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} label="Email Proposal" onClick={() => { setEmailSubject(`Your ${[deal.year, deal.make, deal.model].filter(Boolean).join(' ')} Proposal`); setShowEmailDialog(true); }} />
        <ActionBtn icon={actionLoading === 'fi' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} label="Send to Finance" onClick={sendToFI} />
        <ActionBtn icon={<ClipboardCheck className="h-4 w-4" />} label="Desk Manager Approval" onClick={() => setShowDeskDialog(true)} />
        <ActionBtn icon={<PenTool className="h-4 w-4" />} label="Contract eSign" onClick={requestESign} />
        <ActionBtn icon={actionLoading === 'followup' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />} label="AI Follow-Up" onClick={() => setShowFollowUpDialog(true)} />
        <button className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100">
          <MoreHorizontal className="h-4 w-4" /> More
        </button>
      </div>

      {/* ── Submit to Lenders Dialog ── */}
      <Dialog open={showLendersDialog} onOpenChange={setShowLendersDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit to Lenders</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {lenders.length === 0 && (
              <p className="text-sm text-gray-500">No lenders configured.</p>
            )}
            {lenders.map(lender => (
              <label key={lender.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLenders.includes(lender.id)}
                  onChange={e => setSelectedLenders(prev =>
                    e.target.checked ? [...prev, lender.id] : prev.filter(l => l !== lender.id)
                  )}
                  className="accent-orange-500"
                />
                <div>
                  <p className="text-sm font-medium">{lender.lender_name}</p>
                  <p className="text-xs text-gray-500">{lender.lender_type}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowLendersDialog(false)}>Cancel</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
              disabled={selectedLenders.length === 0 || submittingLenders}
              onClick={submitToLenders}
            >
              {submittingLenders ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit ({selectedLenders.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Credit Report Dialog ── */}
      <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-orange-500" />
              Credit Profile — {deal?.customer_name}
            </DialogTitle>
          </DialogHeader>
          {deal && (
            <div className="space-y-4 py-1">
              {/* Score overview */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Experian',   score: deal.experian_score },
                  { label: 'Equifax',    score: deal.equifax_score },
                  { label: 'TransUnion', score: deal.transunion_score },
                ].map(b => (
                  <div key={b.label} className="rounded-xl border bg-gray-50 p-3 text-center">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase">{b.label}</p>
                    {b.score
                      ? <p className={`text-2xl font-bold mt-1 ${creditScoreColor(b.score)}`}>{b.score}</p>
                      : <p className="text-sm text-gray-400 mt-1">N/A</p>}
    </div>
                ))}
              </div>

              {/* Middle score + tier */}
              {(deal.credit_score || deal.credit_tier) && (
                <div className="rounded-xl border bg-orange-50 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-orange-600 font-semibold">Used for Deal</p>
                    <p className={`text-3xl font-bold ${creditScoreColor(deal.credit_score)}`}>
                      {deal.credit_score || '—'}
                    </p>
                  </div>
                  {deal.credit_tier && (
                    <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${CREDIT_TIER_COLORS[deal.credit_tier] ?? 'bg-gray-100 text-gray-700'}`}>
                      {deal.credit_tier.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              )}

              {/* APR tier based on score */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Rate Tier for This Score</p>
                <div className="space-y-1">
                  {[
                    { label: 'Super Prime (781–850)', aprs: '4.00–5.50%', active: (deal.credit_score ?? 0) >= 781 },
                    { label: 'Prime (661–780)',       aprs: '5.90–7.50%', active: (deal.credit_score ?? 0) >= 661 && (deal.credit_score ?? 0) < 781 },
                    { label: 'Near Prime (601–660)',  aprs: '9.50–13.50%', active: (deal.credit_score ?? 0) >= 601 && (deal.credit_score ?? 0) < 661 },
                    { label: 'Subprime (501–600)',    aprs: '14.90–19.90%', active: (deal.credit_score ?? 0) >= 501 && (deal.credit_score ?? 0) < 601 },
                    { label: 'Deep Subprime (<500)',  aprs: '20.90–28.90%', active: (deal.credit_score ?? 0) > 0 && (deal.credit_score ?? 0) < 501 },
                  ].map(t => (
                    <div key={t.label} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${t.active ? 'bg-orange-100 border border-orange-300 font-semibold text-orange-800' : 'bg-gray-50 text-gray-500'}`}>
                      <span>{t.label}</span>
                      <span>{t.aprs}</span>
                      {t.active && <span className="ml-2 bg-orange-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">Current</span>}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-gray-400 text-center">Score data sourced from credit application. Pull a fresh bureau report for the latest data.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Text Customer Dialog ── */}
      <Dialog open={showSMSDialog} onOpenChange={setShowSMSDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              Text Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {deal && (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{deal.customer_name} · {deal.customer_phone || <span className="text-red-500">No phone on file</span>}</span>
              </div>
            )}
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Message</Label>
              <textarea
                value={smsMsg}
                onChange={e => setSmsMsg(e.target.value)}
                rows={4}
                maxLength={320}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
              <p className="text-[10px] text-gray-400 mt-1 text-right">{smsMsg.length}/320</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSMSDialog(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={actionLoading === 'sms' || !smsMsg.trim() || !deal?.customer_phone}
              onClick={sendSMS}
            >
              {actionLoading === 'sms' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Send Text
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Email Proposal Dialog ── */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-orange-500" />
              Email Proposal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {deal && (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>{deal.customer_name} · {deal.customer_email || <span className="text-red-500">No email on file</span>}</span>
              </div>
            )}
            <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 text-xs text-orange-700">
              A branded proposal email will be sent with the deal breakdown — monthly payment, term, down payment and APR/Money Factor.
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Subject</Label>
              <Input
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                className="text-sm"
                placeholder="Your Vehicle Proposal"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Personal Note (optional)</Label>
              <textarea
                value={emailMsg}
                onChange={e => setEmailMsg(e.target.value)}
                rows={3}
                placeholder="Add a personal message to appear above the deal details..."
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              disabled={actionLoading === 'email' || !deal?.customer_email}
              onClick={sendEmailProposal}
            >
              {actionLoading === 'email' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send Proposal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Desk Manager Approval Dialog ── */}
      <Dialog open={showDeskDialog} onOpenChange={setShowDeskDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-orange-500" />
              Request Desk Manager Approval
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 text-sm text-orange-800">
              This will notify desk managers that this deal needs approval before proceeding. The deal stage will be updated to <strong>Desk Approval</strong>.
    </div>
            {deal && (
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Customer:</span> {deal.customer_name}</p>
                <p><span className="font-medium">Vehicle:</span> {[deal.year, deal.make, deal.model].filter(Boolean).join(' ')}</p>
                <p><span className="font-medium">Payment:</span> ${Math.round(estimatedPayment).toLocaleString()}/mo · {termVal}mo</p>
              </div>
            )}
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Notes for Desk Manager (optional)</Label>
              <textarea
                value={deskNotes}
                onChange={e => setDeskNotes(e.target.value)}
                placeholder="e.g. Customer needs rate bump, asking for accessories discount..."
                rows={3}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDeskDialog(false)}>Cancel</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              disabled={actionLoading === 'desk'}
              onClick={requestDeskApproval}
            >
              {actionLoading === 'desk' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              Send for Approval
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AI Follow-Up Dialog ── */}
      <Dialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-orange-500" />
              AI Follow-Up Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 text-sm text-orange-800">
              Dave will send a follow-up message to the customer and log it in their DAIVE conversation history.
            </div>
            {deal && (
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">To:</span> {deal.customer_name}</p>
                {deal.customer_email && <p><span className="font-medium">Email:</span> {deal.customer_email}</p>}
                {deal.customer_phone && <p><span className="font-medium">Phone:</span> {deal.customer_phone}</p>}
              </div>
            )}
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Custom Message (optional — leave blank for AI to generate)</Label>
              <textarea
                value={followUpMsg}
                onChange={e => setFollowUpMsg(e.target.value)}
                placeholder={`Hi ${deal?.customer_name?.split(' ')[0] || 'there'}! We have a great deal ready for you on the ${[deal?.year, deal?.make, deal?.model].filter(Boolean).join(' ')}...`}
                rows={4}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowFollowUpDialog(false)}>Cancel</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              disabled={actionLoading === 'followup'}
              onClick={triggerAIFollowUp}
            >
              {actionLoading === 'followup' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              Send Follow-Up
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Deal Drawer ── */}
      <Sheet open={showEditDrawer} onOpenChange={setShowEditDrawer}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-500" />
              Edit Deal Details
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5 pb-8">
            {/* Deal Type */}
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Deal Type</Label>
              <div className="flex rounded-lg overflow-hidden border text-sm font-medium">
                <button
                  className={`flex-1 py-2 transition-colors ${editForm.deal_type === 'finance' ? 'bg-orange-500 text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                  onClick={() => setEditForm(f => ({ ...f, deal_type: 'finance' }))}
                >Finance</button>
                <button
                  className={`flex-1 py-2 transition-colors ${editForm.deal_type === 'lease' ? 'bg-orange-500 text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                  onClick={() => setEditForm(f => ({ ...f, deal_type: 'lease' }))}
                >Lease</button>
              </div>
            </div>

            {/* Vehicle */}
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Vehicle</Label>
              <Select value={editForm.vehicle_id} onValueChange={v => {
                const vh = vehicles.find(x => x.id === v);
                setEditForm(f => ({ ...f, vehicle_id: v, vehicle_price: vh?.price?.toString() || f.vehicle_price, msrp: vh?.msrp?.toString() || f.msrp }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.year} {v.make} {v.model} — ${v.price?.toLocaleString() || 'N/A'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price + Down Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">{editForm.deal_type === 'lease' ? 'Capitalized Cost' : 'Vehicle Price'} *</Label>
                <Input type="number" value={editForm.vehicle_price} onChange={e => setEditForm(f => ({ ...f, vehicle_price: e.target.value }))} placeholder="30000" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Down Payment</Label>
                <Input type="number" value={editForm.down_payment} onChange={e => setEditForm(f => ({ ...f, down_payment: e.target.value }))} placeholder="0" />
              </div>
            </div>

            {/* Credit Score + Term */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Credit Score</Label>
                <Input type="number" value={editForm.credit_score} onChange={e => setEditForm(f => ({ ...f, credit_score: e.target.value }))} placeholder="720" min="300" max="850" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Term (Months)</Label>
                <Select value={editForm.term_months} onValueChange={v => setEditForm(f => ({ ...f, term_months: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['24','36','48','60','72','84'].map(t => <SelectItem key={t} value={t}>{t} months</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Accordion type="multiple" className="w-full">
              {/* Government Fees */}
              <AccordionItem value="ttl">
                <AccordionTrigger className="text-sm font-medium">Government Fees (Tax, Title, License) — Optional</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Sales Tax Rate (e.g. 0.065)</Label>
                        <Input type="number" step="0.0001" value={editForm.sales_tax_rate} onChange={e => setEditForm(f => ({ ...f, sales_tax_rate: e.target.value }))} placeholder="0.065" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Title Fee</Label>
                        <Input type="number" value={editForm.title_fee} onChange={e => setEditForm(f => ({ ...f, title_fee: e.target.value }))} placeholder="150" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">License Fee</Label>
                        <Input type="number" value={editForm.license_fee} onChange={e => setEditForm(f => ({ ...f, license_fee: e.target.value }))} placeholder="50" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Registration Fee</Label>
                        <Input type="number" value={editForm.registration_fee} onChange={e => setEditForm(f => ({ ...f, registration_fee: e.target.value }))} placeholder="200" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Inspection Fee</Label>
                        <Input type="number" value={editForm.inspection_fee} onChange={e => setEditForm(f => ({ ...f, inspection_fee: e.target.value }))} placeholder="25" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Processing/Doc Fee</Label>
                        <Input type="number" value={editForm.processing_fee} onChange={e => setEditForm(f => ({ ...f, processing_fee: e.target.value }))} placeholder="500" />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Trade-In */}
              <AccordionItem value="tradein">
                <AccordionTrigger className="text-sm font-medium">Trade-In — Optional</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Trade-In ACV</Label>
                        <Input type="number" value={editForm.trade_in_acv} onChange={e => setEditForm(f => ({ ...f, trade_in_acv: e.target.value }))} placeholder="15000" />
                        <p className="text-[10px] text-gray-400 mt-0.5">Dealer trade-in value</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Payoff Amount</Label>
                        <Input type="number" value={editForm.trade_in_payoff} onChange={e => setEditForm(f => ({ ...f, trade_in_payoff: e.target.value }))} placeholder="12000" />
                        <p className="text-[10px] text-gray-400 mt-0.5">Amount customer still owes</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Year</Label>
                        <Input type="number" value={editForm.trade_in_year} onChange={e => setEditForm(f => ({ ...f, trade_in_year: e.target.value }))} placeholder="2020" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Make</Label>
                        <Input value={editForm.trade_in_make} onChange={e => setEditForm(f => ({ ...f, trade_in_make: e.target.value }))} placeholder="Ford" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Model</Label>
                        <Input value={editForm.trade_in_model} onChange={e => setEditForm(f => ({ ...f, trade_in_model: e.target.value }))} placeholder="F-150" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Mileage</Label>
                        <Input type="number" value={editForm.trade_in_mileage} onChange={e => setEditForm(f => ({ ...f, trade_in_mileage: e.target.value }))} placeholder="45000" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">VIN</Label>
                      <Input value={editForm.trade_in_vin} onChange={e => setEditForm(f => ({ ...f, trade_in_vin: e.target.value }))} placeholder="1FTEW1CP..." />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* F&I Products */}
              <AccordionItem value="fni">
                <AccordionTrigger className="text-sm font-medium">F&I Products — Optional</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Warranty / VSC Amount</Label>
                        <Input type="number" value={editForm.warranty_amount} onChange={e => setEditForm(f => ({ ...f, warranty_amount: e.target.value }))} placeholder="2995" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">GAP Insurance Amount</Label>
                        <Input type="number" value={editForm.gap_amount} onChange={e => setEditForm(f => ({ ...f, gap_amount: e.target.value }))} placeholder="899" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 mb-1 block">Accessories / Add-Ons Amount</Label>
                      <Input type="number" value={editForm.accessories_amount} onChange={e => setEditForm(f => ({ ...f, accessories_amount: e.target.value }))} placeholder="1200" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Lease-specific */}
              {editForm.deal_type === 'lease' && (
                <AccordionItem value="lease">
                  <AccordionTrigger className="text-sm font-medium">Lease Details</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500 mb-1 block">MSRP</Label>
                          <Input type="number" value={editForm.msrp} onChange={e => setEditForm(f => ({ ...f, msrp: e.target.value }))} placeholder="40000" />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500 mb-1 block">Tax Rate</Label>
                          <Input type="number" step="0.0001" value={editForm.tax_rate} onChange={e => setEditForm(f => ({ ...f, tax_rate: e.target.value }))} placeholder="0.065" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500 mb-1 block">Cap Cost Reductions</Label>
                          <Input type="number" value={editForm.cap_cost_reductions} onChange={e => setEditForm(f => ({ ...f, cap_cost_reductions: e.target.value }))} placeholder="2000" />
                          <p className="text-[10px] text-gray-400 mt-0.5">Down payment, trade-in, rebates</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500 mb-1 block">Capitalized Fees</Label>
                          <Input type="number" value={editForm.capitalized_fees} onChange={e => setEditForm(f => ({ ...f, capitalized_fees: e.target.value }))} placeholder="595" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500 mb-1 block">Annual Mileage</Label>
                          <Input type="number" value={editForm.annual_mileage} onChange={e => setEditForm(f => ({ ...f, annual_mileage: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500 mb-1 block">Excess Mileage Rate</Label>
                          <Input type="number" step="0.01" value={editForm.excess_mileage_rate} onChange={e => setEditForm(f => ({ ...f, excess_mileage_rate: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {/* Save Button */}
            <div className="flex gap-3 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setShowEditDrawer(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={saveEditForm}
                disabled={savingEdit}
              >
                {savingEdit ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DSRow({ label, value, bold, green, red }: {
  label: string; value: string;
  bold?: boolean; green?: boolean; red?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : 'font-medium text-gray-700'} ${green ? 'text-green-600' : ''} ${red ? 'text-red-600' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function ToggleRow({ label, checked, onToggle }: {
  label: string; checked: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs font-medium ${checked ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{label}</span>
        <Switch checked={checked} onCheckedChange={onToggle} className="scale-75" />
    </div>
  );
}

function ActionBtn({ icon, label, primary, onClick }: {
  icon: React.ReactNode; label: string; primary?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors min-w-[56px]
        ${primary
          ? 'bg-orange-500 text-white hover:bg-orange-600'
          : 'text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200'}`}
    >
      {icon}
      <span className="whitespace-nowrap leading-tight text-center">{label}</span>
    </button>
  );
}

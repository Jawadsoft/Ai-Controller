import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/config';
import TopNavigation from '@/components/layout/TopNavigation';
import { MessageCircle } from 'lucide-react';

type Role = 'user' | 'ai';

interface StepDefinition {
  id: number;
  name: string;
  phase: 'lead_qualification' | 'purchase_journey';
  agent: 'sales_consultant' | 'finance' | 'inventory_crew' | 'customer_service';
}

interface ScenarioMap {
  [step: number]: string;
}

interface ScenarioSet {
  key: string;
  label: string;
  messages: ScenarioMap;
  responses: ScenarioMap;
}

const DEFAULT_STEPS: Record<number, StepDefinition> = {
  1: { id: 1, name: 'Greet & Qualify Lead', phase: 'lead_qualification', agent: 'sales_consultant' },
  2: { id: 2, name: 'Identify Car Type', phase: 'lead_qualification', agent: 'sales_consultant' },
  3: { id: 3, name: 'Define Budget', phase: 'lead_qualification', agent: 'sales_consultant' },
  4: { id: 4, name: 'Select Features / Needs', phase: 'lead_qualification', agent: 'sales_consultant' },
  5: { id: 5, name: 'Check Preferred Brand', phase: 'lead_qualification', agent: 'sales_consultant' },
  6: { id: 6, name: 'Vehicle Recommendations', phase: 'lead_qualification', agent: 'sales_consultant' },
  7: { id: 7, name: 'Test Drive & Selection', phase: 'lead_qualification', agent: 'sales_consultant' },
  8: { id: 8, name: 'Purchase Decision', phase: 'lead_qualification', agent: 'sales_consultant' },
  9: { id: 9, name: 'Sale Confirmation', phase: 'purchase_journey', agent: 'sales_consultant' },
  10: { id: 10, name: 'Contract Review', phase: 'purchase_journey', agent: 'sales_consultant' },
  11: { id: 11, name: 'Trade-In Discussion', phase: 'purchase_journey', agent: 'sales_consultant' },
  12: { id: 12, name: 'Finance Finalization', phase: 'purchase_journey', agent: 'finance' },
  13: { id: 13, name: 'Vehicle Preparation', phase: 'purchase_journey', agent: 'inventory_crew' },
  14: { id: 14, name: 'Delivery & Handover', phase: 'purchase_journey', agent: 'sales_consultant' },
  15: { id: 15, name: 'Customer Support', phase: 'purchase_journey', agent: 'customer_service' },
  16: { id: 16, name: 'Follow-Up', phase: 'purchase_journey', agent: 'customer_service' }
};

const FAMILY_SUV_MESSAGES: ScenarioMap = { 1: "Hi! I'm looking for a new family SUV", 2: 'I want an SUV with 7 seats and good safety features', 3: 'My budget is around $45,000', 4: 'I need advanced safety features, 7 seats, and good fuel economy', 5: 'I prefer Hyundai or Toyota', 6: 'Yes, show me the Hyundai Palisade', 7: "I'd like to schedule a test drive", 8: "Yes, I'm ready to buy the Hyundai Palisade after the test drive", 9: "Perfect! Let's proceed with the purchase", 10: 'I understand the contract terms, let\'s continue', 11: 'I have a 2018 Honda CR-V to trade in', 12: 'I want to finance with a 60-month loan', 13: 'Great! When will my vehicle be ready?', 14: "I'm here for pickup, let's complete the delivery", 15: 'Everything looks perfect! I\'m very satisfied', 16: 'Yes, please schedule the follow-up call' };
const FAMILY_SUV_RESPONSES: ScenarioMap = { 1: "Hello! I'd be happy to help you find the perfect family SUV. Are you looking for a new or used vehicle?", 2: "Excellent choice! SUVs with 7 seats are perfect for families. What's your budget range?", 3: 'Great! $45,000 gives us excellent options. What specific features are most important to you?', 4: 'Perfect! Safety and fuel economy are top priorities. Do you have a preferred brand?', 5: 'Both Hyundai and Toyota make excellent family SUVs. Let me show you some recommendations.', 6: 'Excellent choice! The Hyundai Palisade is a fantastic family SUV. Would you like to schedule a test drive?', 7: "Perfect! I'll arrange a test drive for you. Are you ready to proceed with the purchase after the test drive?", 8: 'Wonderful! Let me confirm your vehicle selection and review the details.', 9: 'Perfect! Let me confirm your vehicle selection and review the details.', 10: "Now let's review the sales contract. I'll explain all terms and conditions.", 11: 'Do you have a trade-in vehicle? Let\'s discuss the details and valuation.', 12: "Let's finalize your financing. I'll explain all terms and get the paperwork ready.", 13: 'Great! Now our inventory crew will prepare your vehicle for delivery.', 14: 'Your vehicle is ready! Let\'s complete the delivery and handover process.', 15: 'How are you feeling about your purchase? Let me ensure everything meets your expectations.', 16: "Thank you for choosing us! Here's your follow-up plan." };

const LUXURY_MESSAGES: ScenarioMap = { 1: 'Hello! I\'m interested in a luxury vehicle', 2: 'I want a premium sedan with advanced technology', 3: 'Budget is not a major concern, around $80,000+', 4: 'I need cutting-edge tech, premium materials, and performance', 5: 'I prefer Mercedes-Benz or BMW', 6: 'Yes, show me the Mercedes S-Class', 7: "I'd like to schedule a test drive", 8: "Yes, I'm ready to proceed with the Mercedes S-Class", 9: 'Excellent! Let\'s finalize your luxury vehicle purchase', 10: 'I understand the premium terms, let\'s continue', 11: 'I have a 2020 BMW 5 Series to trade in', 12: 'I want premium financing options', 13: 'When will my luxury vehicle be prepared?', 14: "I'm here for the premium delivery experience", 15: 'This exceeds my expectations! Perfect luxury experience', 16: 'Yes, please arrange the VIP follow-up service' };
const LUXURY_RESPONSES: ScenarioMap = { 1: 'Welcome! I\'d be delighted to assist you with your luxury vehicle selection. What type of premium vehicle interests you?', 2: 'Excellent choice! Premium sedans offer the ultimate in luxury and technology. What\'s your preferred budget range?', 3: 'Perfect! At $80,000+, we have access to the finest luxury vehicles. What specific premium features matter most?', 4: 'Outstanding! Cutting-edge technology and premium materials are hallmarks of luxury. Any brand preferences?', 5: 'Excellent taste! Both Mercedes-Benz and BMW represent the pinnacle of luxury. Let me show you our premium selection.', 6: 'Magnificent choice! The Mercedes S-Class is the epitome of luxury sedans. Shall we schedule your premium test drive?', 7: "Perfect! I'll arrange an exclusive test drive experience for you. Ready to proceed with the S-Class?", 8: 'Excellent! Let me confirm your luxury vehicle selection and review all premium details.', 9: 'Outstanding! Let me confirm your luxury vehicle selection and review all premium details.', 10: 'Now let\'s review the premium sales contract with all luxury features and services.', 11: 'Excellent trade-in! Your BMW 5 Series will receive premium valuation. Let\'s discuss details.', 12: 'Perfect! Let me explore our premium financing options tailored for luxury vehicle purchases.', 13: 'Excellent! Our premium preparation team will ensure your luxury vehicle is immaculate.', 14: 'Your luxury vehicle is ready! Let\'s complete the premium delivery and handover experience.', 15: 'How does this luxury experience meet your expectations? I want to ensure perfection.', 16: 'Thank you for choosing luxury! Here\'s your VIP follow-up and concierge service plan.' };

const BUDGET_MESSAGES: ScenarioMap = { 1: 'Hi! I need a reliable car on a tight budget', 2: 'I want a compact sedan or small SUV', 3: 'My budget is around $20,000', 4: 'I need good fuel economy and reliability', 5: 'I prefer Honda or Toyota for reliability', 6: 'Yes, show me the Honda Civic', 7: "I'd like to schedule a test drive", 8: "Yes, I'm ready to buy the Honda Civic", 9: "Great! Let's proceed with the purchase", 10: 'I understand the terms, let\'s continue', 11: "I don't have a trade-in vehicle", 12: 'I need the most affordable financing option', 13: 'When will my car be ready?', 14: "I'm here for pickup, let's complete this", 15: "This fits my budget perfectly! I'm satisfied", 16: 'Yes, please schedule the follow-up call' };
const BUDGET_RESPONSES: ScenarioMap = { 1: 'Hello! I understand budget is important. Let me help you find a reliable vehicle within your price range.', 2: 'Great choice! Compact sedans and small SUVs offer excellent value. What\'s your budget range?', 3: 'Perfect! $20,000 gives us several reliable options. What features are most important to you?', 4: 'Excellent priorities! Fuel economy and reliability are key for budget-conscious buyers. Any brand preferences?', 5: 'Smart choice! Honda and Toyota are known for reliability and value. Let me show you some options.', 6: 'Excellent choice! The Honda Civic offers great value and reliability. Would you like to test drive it?', 7: "Perfect! I'll arrange a test drive for you. Ready to proceed with the Civic?", 8: 'Wonderful! Let me confirm your vehicle selection and review the affordable terms.', 9: 'Great! Let me confirm your vehicle selection and review the affordable terms.', 10: 'Now let\'s review the sales contract with all the budget-friendly options.', 11: "No problem! Let's focus on getting you the best value without a trade-in.", 12: 'Perfect! Let me show you our most affordable financing options to fit your budget.', 13: 'Great! Our team will prepare your vehicle efficiently and cost-effectively.', 14: 'Your car is ready! Let\'s complete the delivery process.', 15: "How does this fit your budget? I want to ensure you're getting the best value.", 16: "Thank you for choosing us! Here's your affordable follow-up and maintenance plan." };

const FLEET_MESSAGES: ScenarioMap = { 1: "Hello! I'm managing a business fleet purchase", 2: 'I need 5-10 vehicles for our sales team', 3: 'Budget is around $200,000 total', 4: 'I need reliable, fuel-efficient vehicles with good warranties', 5: 'I prefer Ford or Chevrolet for fleet pricing', 6: 'Yes, show me the Ford Fusion fleet options', 7: "I'd like to schedule fleet test drives", 8: "Yes, we're ready to proceed with the fleet purchase", 9: "Perfect! Let's finalize the fleet purchase", 10: 'I understand the fleet terms, let\'s continue', 11: 'We have 8 older vehicles to trade in', 12: 'I need fleet financing with business terms', 13: 'When will our fleet be ready?', 14: "We're here for fleet delivery", 15: 'This fleet solution meets our business needs perfectly', 16: 'Yes, please schedule fleet maintenance follow-up' };
const FLEET_RESPONSES: ScenarioMap = { 1: "Welcome! I'm here to help you with your business fleet requirements. How many vehicles do you need?", 2: 'Excellent! 5-10 vehicles for your sales team. What type of vehicles work best for your business?', 3: 'Perfect! $200,000 total budget gives us excellent fleet options. What\'s your timeline?', 4: 'Smart business priorities! Reliability and warranties are crucial for fleet operations. Any specific requirements?', 5: 'Excellent choice! Ford and Chevrolet offer great fleet pricing and support. Let me show you options.', 6: 'Perfect! The Ford Fusion offers excellent fleet value. Would you like to see fleet pricing?', 7: "Excellent! I'll arrange fleet test drives for your team. When works best for you?", 8: 'Wonderful! Let me confirm your fleet selection and review business terms.', 9: 'Perfect! Let me confirm your fleet selection and review business terms.', 10: 'Now let\'s review the fleet contract with all business terms and volume discounts.', 11: 'Excellent! 8 trade-ins will help with your fleet upgrade. Let\'s discuss valuations.', 12: 'Perfect! Let me show you our business fleet financing options with competitive terms.', 13: 'Great! Our fleet team will prepare all vehicles efficiently for your business needs.', 14: 'Your fleet is ready! Let\'s complete the business delivery process.', 15: 'How does this fleet solution meet your business requirements? I want to ensure success.', 16: "Thank you for choosing us! Here's your fleet maintenance and support plan." };

const FIRST_TIMER_MESSAGES: ScenarioMap = { 1: 'Hi! This is my first time buying a car', 2: 'I want something safe and easy to drive', 3: 'My budget is around $25,000', 4: 'I need safety features and good gas mileage', 5: "I'm open to any reliable brand", 6: 'Yes, show me the Toyota Corolla', 7: "I'd like to schedule a test drive", 8: "Yes, I'm ready to buy my first car", 9: 'Exciting! Let\'s complete your first car purchase', 10: 'I understand the terms, let\'s continue', 11: "I don't have a trade-in vehicle", 12: 'I need help understanding financing options', 13: 'When will my first car be ready?', 14: "I'm here for pickup, this is so exciting!", 15: 'I love my first car! Everything is perfect', 16: 'Yes, please schedule the follow-up call' };
const FIRST_TIMER_RESPONSES: ScenarioMap = { 1: 'Welcome! Congratulations on your first car purchase! I\'m here to guide you through the entire process.', 2: 'Excellent choice! Safety and ease of driving are perfect priorities for first-time buyers. What\'s your budget?', 3: 'Perfect! $25,000 gives you access to excellent first-car options. What features matter most?', 4: 'Smart priorities! Safety and fuel economy are essential for new drivers. Any brand preferences?', 5: 'Great approach! Being open to reliable brands gives us more options. Let me show you some recommendations.', 6: 'Excellent choice! The Toyota Corolla is perfect for first-time buyers. Would you like to test drive it?', 7: "Perfect! I'll arrange your first test drive experience. Ready to proceed with the Corolla?", 8: 'Wonderful! Let me confirm your first car selection and explain everything step by step.', 9: 'Exciting! Let me confirm your first car selection and explain everything step by step.', 10: "Now let's review your first car contract. I'll explain every term clearly.", 11: "No problem! Let's focus on getting you the best first-car deal without a trade-in.", 12: 'Perfect! Let me explain all financing options in simple terms for first-time buyers.', 13: 'Great! Our team will prepare your first car with extra care and attention.', 14: 'Your first car is ready! Let\'s complete this exciting delivery experience!', 15: 'How are you feeling about your first car? I want to ensure you\'re completely comfortable.', 16: 'Congratulations on your first car! Here\'s your follow-up and support plan.' };

const DEFAULT_SCENARIOS: ScenarioSet[] = [
  { key: 'family_suv', label: 'Family SUV Buyer', messages: FAMILY_SUV_MESSAGES, responses: FAMILY_SUV_RESPONSES },
  { key: 'luxury_car', label: 'Luxury Car Enthusiast', messages: LUXURY_MESSAGES, responses: LUXURY_RESPONSES },
  { key: 'budget_conscious', label: 'Budget-Conscious Buyer', messages: BUDGET_MESSAGES, responses: BUDGET_RESPONSES },
  { key: 'business_fleet', label: 'Business Fleet Manager', messages: FLEET_MESSAGES, responses: FLEET_RESPONSES },
  { key: 'first_time_buyer', label: 'First-Time Car Buyer', messages: FIRST_TIMER_MESSAGES, responses: FIRST_TIMER_RESPONSES },
];

const STORAGE_KEY = 'conversation_monitor_scenarios_v1';

const ConversationMonitorPage: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [scenarioKey, setScenarioKey] = useState<string>('family_suv');
  const [scenarios, setScenarios] = useState<ScenarioSet[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_SCENARIOS;
  });
  const [history, setHistory] = useState<{ role: Role; content: string; step: number }[]>([]);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [intervalMs, setIntervalMs] = useState(1000);
  const [isSaving, setIsSaving] = useState(false);

  const selectedScenario = useMemo(() => scenarios.find(s => s.key === scenarioKey) || scenarios[0], [scenarioKey, scenarios]);

  const getDealerIdFromToken = (): string | null => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1] || ''));
      return payload.dealer_id || payload.dealerId || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!running || paused || !autoAdvance) return;
    const t = setInterval(() => nextStep(), intervalMs);
    return () => clearInterval(t);
  }, [running, paused, autoAdvance, intervalMs, currentStep, scenarioKey]);

  const saveScenarios = (next: ScenarioSet[] = scenarios) => {
    setScenarios(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const persistScenarioToServer = async () => {
    try {
      console.log('[ConversationMonitor] Save clicked');
      setIsSaving(true);
      saveScenarios();
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) { toast.info('Saved locally. Login to sync to dealer.'); return; }
      const dealerId = getDealerIdFromToken();
      const scenario = scenarios.find(s => s.key === scenarioKey);
      if (!scenario) { console.warn('[ConversationMonitor] No scenario selected'); return; }
      const steps = Array.from({ length: 16 }).map((_, i) => {
        const step = i + 1;
        return {
          step,
          messageText: scenario.messages[step] || '',
          responseText: scenario.responses[step] || ''
        };
      });
      console.log('[ConversationMonitor] POST /daive/scenarios', { scenarioKey: scenario.key, dealerId });
      const res = await fetch(buildApiUrl('daive/scenarios'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ scenarioKey: scenario.key, label: scenario.label, steps, dealerId })
      });
      if (res.ok) {
        toast.success('Dealer scenario saved');
        console.log('[ConversationMonitor] Save success');
      } else {
        let detail = '';
        try { detail = await res.text(); } catch {}
        toast.error(`Failed to save (${res.status}). ${detail}`);
        if (!dealerId) toast.info('No dealer in token; data saved locally only.');
        console.error('[ConversationMonitor] Save failed', res.status, detail);
      }
    } catch (e) {
      console.error('[ConversationMonitor] Save exception', e);
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Load dealer-specific scenarios from backend
  useEffect(() => {
    const load = async () => {
      try {
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) return; // remain on local storage when not authenticated
        const dealerId = getDealerIdFromToken();
        const url = dealerId ? buildApiUrl(`daive/scenarios?dealerId=${dealerId}`) : buildApiUrl('daive/scenarios');
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const byKey: Record<string, ScenarioSet> = {};
          data.data.forEach((row: any) => {
            const key = row.scenario_key;
            if (!byKey[key]) byKey[key] = { key, label: row.label || key, messages: {}, responses: {} };
            byKey[key].messages[row.step] = row.message_text || '';
            byKey[key].responses[row.step] = row.response_text || '';
          });
          // Merge with defaults and any existing local custom scenarios
          const defaultsByKey: Record<string, ScenarioSet> = DEFAULT_SCENARIOS.reduce((acc, s) => {
            acc[s.key] = s; return acc;
          }, {} as Record<string, ScenarioSet>);
          const existingByKey: Record<string, ScenarioSet> = scenarios.reduce((acc, s) => {
            acc[s.key] = s; return acc;
          }, {} as Record<string, ScenarioSet>);
          const mergedKeys = Array.from(new Set([
            ...Object.keys(defaultsByKey),
            ...Object.keys(byKey),
            ...Object.keys(existingByKey)
          ]));
          const merged: ScenarioSet[] = mergedKeys.map(k => byKey[k] || existingByKey[k] || defaultsByKey[k]).filter(Boolean) as ScenarioSet[];
          setScenarios(merged);
          if (!merged.find(s => s.key === scenarioKey)) {
            setScenarioKey('family_suv');
          }
        } else if (!dealerId) {
          toast.info('Loaded local scenarios (no dealer bound in token)');
        }
      } catch (e) {
        // Non-fatal, keep local defaults
      }
    };
    load();
  }, []);

  const start = () => {
    if (running) return;
    setRunning(true);
    setPaused(false);
    setHistory([{ role: 'ai' as Role, content: "Welcome! I'm ready to guide you through the journey. Click Next to begin.", step: 0 }]);
    setCurrentStep(1);
  };

  const reset = () => {
    setRunning(false);
    setPaused(false);
    setHistory([{ role: 'ai' as Role, content: 'Ready to start', step: 0 }]);
    setCurrentStep(1);
  };

  const nextStep = () => {
    if (!running || paused) return;
    const step = currentStep;
    const msg = selectedScenario.messages[step] || 'Ready to proceed';
    const resp = selectedScenario.responses[step] || "Let's continue with the next step.";
    const newHistory: { role: Role; content: string; step: number }[] = [
      ...history,
      { role: 'user' as Role, content: msg, step },
      { role: 'ai' as Role, content: resp, step }
    ];
    setHistory(newHistory);
    if (step < 16) setCurrentStep(step + 1); else setRunning(false);
  };

  const updateScenarioEntry = (type: 'messages' | 'responses', step: number, value: string) => {
    const next = scenarios.map(s => {
      if (s.key !== scenarioKey) return s;
      return { ...s, [type]: { ...(s as any)[type], [step]: value } } as ScenarioSet;
    });
    saveScenarios(next);
  };

  const addCustomScenario = () => {
    const key = `custom_${Date.now()}`;
    const label = 'Custom Scenario';
    const blank: ScenarioMap = {};
    const newScenario: ScenarioSet = { key, label, messages: { ...blank }, responses: { ...blank } };
    const next = [...scenarios, newScenario];
    saveScenarios(next);
    setScenarioKey(key);
  };

  const saveTableCSV = () => {
    const lines: string[] = ['scenario,step,type,text'];
    scenarios.forEach(s => {
      for (let i = 1; i <= 16; i++) {
        const m = (s.messages[i] || '').replace(/\n/g, ' ').replace(/"/g, '""');
        const r = (s.responses[i] || '').replace(/\n/g, ' ').replace(/"/g, '""');
        lines.push(`${s.key},${i},message,"${m}"`);
        lines.push(`${s.key},${i},response,"${r}"`);
      }
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conversation_scenarios.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const progress = Math.min((currentStep / 16) * 100, 100);
  const currentPhase = DEFAULT_STEPS[currentStep]?.phase === 'purchase_journey' ? 'Purchase Journey' : 'Lead Qualification';
  const currentAgentMap: Record<string, string> = {
    sales_consultant: 'Sales Consultant',
    finance: 'Finance Specialist',
    inventory_crew: 'Inventory Crew',
    customer_service: 'Customer Service',
  };
  const currentAgent = currentAgentMap[DEFAULT_STEPS[currentStep]?.agent || 'sales_consultant'];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNavigation />

      {/* ── Page Header ── */}
      <div className="bg-white border-b shadow-sm px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="font-bold text-base text-gray-900">Conversation Flow Manager</h1>
            <p className="text-xs text-gray-500">Test and monitor DAIVE conversation scenarios</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={start}>Start</Button>
          <Button size="sm" variant="outline" className="border-gray-200" onClick={() => setPaused(p => !p)}>{paused ? 'Resume' : 'Pause'}</Button>
          <Button size="sm" variant="destructive" onClick={reset}>Reset</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scenario Settings</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="w-full sm:w-56">
              <Select value={scenarioKey} onValueChange={setScenarioKey}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map(s => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={addCustomScenario}>Add Custom</Button>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <Badge variant="outline" className="text-xs">Step {currentStep}/16</Badge>
              <Badge variant="secondary" className="max-w-full truncate text-xs">{currentPhase}</Badge>
              <Badge className="max-w-full truncate text-xs">{currentAgent}</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:border-0 sm:pt-0">
            <div className="flex items-center gap-2">
              <label htmlFor="conv-auto-advance" className="text-sm whitespace-nowrap">Auto-advance</label>
              <input id="conv-auto-advance" type="checkbox" className="h-4 w-4 accent-primary" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)} />
            </div>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="conv-interval" className="sr-only">Interval milliseconds</label>
              <Input
                id="conv-interval"
                className="w-full sm:w-28"
                type="number"
                value={intervalMs}
                onChange={e => setIntervalMs(Number(e.target.value) || 3000)}
                placeholder="Interval ms"
              />
              <Button size="sm" className="w-full shrink-0 sm:w-auto" onClick={() => nextStep()}>Next Step</Button>
            </div>
          </div>

          <div className="h-2 rounded bg-muted">
            <div className="h-2 rounded bg-gradient-to-r from-green-500 to-primary/90 transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>{/* end scenario settings body */}
      </div>{/* end scenario panel */}

      {/* Live conversation first on mobile; editor spans 2 cols on lg */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-4">
        <div className="order-1 lg:order-2 lg:col-span-1 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live Conversation</p>
          </div>
          <div className="p-4">
            <div className="h-[min(420px,50dvh)] min-h-[220px] overflow-y-auto overscroll-y-contain rounded-md border bg-muted/20 p-2 text-xs sm:min-h-[280px] lg:h-[520px] lg:max-h-[min(520px,calc(100vh-12rem))]">
              {history.length === 0 && (
                <div className="text-xs text-muted-foreground">Ready to start</div>
              )}
              {history.map((h, idx) => (
                <div
                  key={idx}
                  className={`mb-2 rounded p-2 sm:p-2.5 ${h.role === 'user' ? 'ml-1 border-l-4 border-primary/50 bg-primary/10 sm:ml-4' : 'mr-1 border-l-4 border-purple-400 bg-purple-50 sm:mr-4'}`}
                >
                  <div className="mb-1 flex justify-between gap-2 text-[11px] text-gray-600">
                    <span className="font-semibold">{h.role === 'user' ? 'Customer' : 'AI Assistant'}</span>
                    <span className="shrink-0">Step {h.step || '-'}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-left text-[13px] leading-snug sm:text-xs">{h.content}</div>
                </div>
              ))}
            </div>
          </div>{/* end live conversation body */}
        </div>{/* end live conversation panel */}

        <div className="order-2 lg:order-1 lg:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scenario Editor</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-gray-200 text-xs" onClick={persistScenarioToServer} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs" onClick={saveTableCSV}>Export CSV</Button>
            </div>
          </div>
          <div className="space-y-2 p-4 text-xs overflow-y-auto max-h-[600px]">
            {Array.from({ length: 16 }).map((_, i) => {
              const step = i + 1;
              return (
                <div key={step} className="rounded-md border p-3 sm:p-2">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs font-semibold leading-snug sm:text-xs">
                      Step {step}: {DEFAULT_STEPS[step]?.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant={DEFAULT_STEPS[step]?.phase === 'purchase_journey' ? 'secondary' : 'outline'}>
                        {DEFAULT_STEPS[step]?.phase === 'purchase_journey' ? 'Purchase' : 'Lead'}
                      </Badge>
                      <Badge className="max-w-[10rem] truncate sm:max-w-none">{currentAgentMap[DEFAULT_STEPS[step]?.agent]}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-2">
                    <div className="min-w-0">
                      <div className="mb-1 text-xs font-medium text-muted-foreground">Customer Message</div>
                      <Textarea
                        className="min-h-[5rem] text-xs sm:min-h-0"
                        value={selectedScenario.messages[step] || ''}
                        onChange={e => updateScenarioEntry('messages', step, e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 text-xs font-medium text-muted-foreground">AI Response</div>
                      <Textarea
                        className="min-h-[5rem] text-xs sm:min-h-0"
                        value={selectedScenario.responses[step] || ''}
                        onChange={e => updateScenarioEntry('responses', step, e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>{/* end editor body */}
        </div>{/* end editor panel */}
      </div>{/* end two-col grid */}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saved Scenarios</p>
          <Button size="sm" variant="outline" className="border-gray-200 text-xs" onClick={persistScenarioToServer} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
        </div>
        <p className="border-b px-4 py-2 text-xs text-gray-400 md:hidden">
          Swipe horizontally to see all columns, or use Export CSV.
        </p>
        <div className="overflow-x-auto px-4 pb-4">
            <Table className="min-w-[640px] text-xs sm:min-w-0 sm:text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Scenario</TableHead>
                  <TableHead className="whitespace-nowrap">Step</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead>Text</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.flatMap(s => (
                  Array.from({ length: 16 }).flatMap((_, i) => {
                    const step = i + 1;
                    const m = s.messages[step] || '';
                    const r = s.responses[step] || '';
                    return [
                      <TableRow key={`${s.key}-${step}-m`}>
                        <TableCell className="max-w-[7rem] truncate font-mono text-[11px] sm:max-w-none sm:text-xs" title={s.key}>{s.key}</TableCell>
                        <TableCell className="whitespace-nowrap">{step}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline">message</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] whitespace-normal break-words sm:max-w-[640px] sm:truncate" title={m}>{m}</TableCell>
                      </TableRow>,
                      <TableRow key={`${s.key}-${step}-r`}>
                        <TableCell className="max-w-[7rem] truncate font-mono text-[11px] sm:max-w-none sm:text-xs" title={s.key}>{s.key}</TableCell>
                        <TableCell className="whitespace-nowrap">{step}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge>response</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] whitespace-normal break-words sm:max-w-[640px] sm:truncate" title={r}>{r}</TableCell>
                      </TableRow>
                    ];
                  })
                ))}
              </TableBody>
            </Table>
          </div>{/* end table wrapper */}
        </div>{/* end saved scenarios panel */}
      </div>{/* end flex-1 */}
    </div>
  );
};

export default ConversationMonitorPage;



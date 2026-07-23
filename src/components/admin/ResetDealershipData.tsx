import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/config';
import { getToken } from '@/lib/api';

interface Dealer {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  city: string;
  state: string;
  vehicle_count: number;
  lead_count: number;
  finance_count: number;
  rebate_count: number;
  conversation_count: number;
}

interface DataCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
  danger: 'low' | 'medium' | 'high' | 'critical';
}

const DATA_CATEGORIES: DataCategory[] = [
  {
    id: 'vehicles',
    label: 'Vehicles',
    description: 'All vehicle inventory and related data',
    icon: '🚗',
    danger: 'high'
  },
  {
    id: 'leads',
    label: 'Leads',
    description: 'Customer leads and inquiries',
    icon: '👥',
    danger: 'high'
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Credit applications, finance deals, lenders, programs',
    icon: '💰',
    danger: 'high'
  },
  {
    id: 'rebates',
    label: 'Rebates',
    description: 'Rebates and rebate applications',
    icon: '💵',
    danger: 'medium'
  },
  {
    id: 'conversations',
    label: 'AI Conversations',
    description: 'DAIVE chat and voice conversations',
    icon: '💬',
    danger: 'medium'
  },
  {
    id: 'customers',
    label: 'Customers',
    description: 'Customer accounts and profiles',
    icon: '👤',
    danger: 'high'
  },
  {
    id: 'staff',
    label: 'Staff Members',
    description: 'Dealership staff accounts (⚠️ DANGER)',
    icon: '👨‍💼',
    danger: 'critical'
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'DAIVE settings, follow-up settings, prompts',
    icon: '⚙️',
    danger: 'medium'
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'Deal sheets, templates, signatures',
    icon: '📄',
    danger: 'low'
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'System notifications',
    icon: '🔔',
    danger: 'low'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Analytics and usage data',
    icon: '📊',
    danger: 'low'
  }
];

export default function ResetDealershipData() {
  const { toast } = useToast();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [confirmationText, setConfirmationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingDealers, setFetchingDealers] = useState(true);

  useEffect(() => {
    fetchDealers();
  }, []);

  const fetchDealers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/super-admin/dealers-for-reset`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDealers(data.dealers);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch dealers',
        variant: 'destructive'
      });
    } finally {
      setFetchingDealers(false);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCategories.length === DATA_CATEGORIES.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(DATA_CATEGORIES.map(cat => cat.id));
    }
  };

  const handleReset = async () => {
    if (!selectedDealer) {
      toast({
        title: 'Error',
        description: 'Please select a dealer',
        variant: 'destructive'
      });
      return;
    }

    if (selectedCategories.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one category to reset',
        variant: 'destructive'
      });
      return;
    }

    if (confirmationText !== 'RESET DATA') {
      toast({
        title: 'Error',
        description: 'Please type "RESET DATA" exactly to confirm',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/super-admin/reset-dealership-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          dealerId: selectedDealer,
          categories: selectedCategories,
          confirmationText
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Show detailed summary
        const summary = Object.entries(data.deletedCounts)
          .filter(([_, count]) => count > 0)
          .map(([key, count]) => `${key}: ${count}`)
          .join(', ');

        const totalDeleted = Object.values(data.deletedCounts).reduce((sum: number, count: any) => sum + count, 0);

        toast({
          title: '✅ Data Reset Complete',
          description: `Deleted ${totalDeleted} records from ${data.dealer.business_name}: ${summary}`,
          duration: 10000
        });

        console.log('✅ Reset successful:', data);
        console.log('📊 Deleted counts:', data.deletedCounts);

        // Reset form
        setSelectedDealer('');
        setSelectedCategories([]);
        setConfirmationText('');

        // Refresh dealer list to show updated counts
        setTimeout(() => {
          fetchDealers();
          console.log('🔄 Refreshing dealer list...');
        }, 1000);
      } else {
        throw new Error(data.error || 'Reset failed');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedDealerData = dealers.find(d => d.id === selectedDealer);

  const getDangerColor = (danger: string) => {
    switch (danger) {
      case 'critical': return 'border-red-600 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-primary bg-primary/10';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border-red-500 border-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div>
              <CardTitle className="text-2xl text-red-600">Reset Dealership Data</CardTitle>
              <CardDescription>
                ⚠️ DANGER ZONE - This action permanently deletes data and CANNOT be undone!
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Select Dealer */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Step 1: Select Dealer</Label>
            <Select value={selectedDealer} onValueChange={setSelectedDealer}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a dealer..." />
              </SelectTrigger>
              <SelectContent>
                {fetchingDealers ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (
                  dealers.map(dealer => (
                    <SelectItem key={dealer.id} value={dealer.id}>
                      {dealer.business_name} - {dealer.city}, {dealer.state}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedDealerData && (
              <Card className="bg-gray-50">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <div className="font-semibold">Vehicles</div>
                      <div className="text-2xl">{selectedDealerData.vehicle_count}</div>
                    </div>
                    <div>
                      <div className="font-semibold">Leads</div>
                      <div className="text-2xl">{selectedDealerData.lead_count}</div>
                    </div>
                    <div>
                      <div className="font-semibold">Finance</div>
                      <div className="text-2xl">{selectedDealerData.finance_count}</div>
                    </div>
                    <div>
                      <div className="font-semibold">Rebates</div>
                      <div className="text-2xl">{selectedDealerData.rebate_count}</div>
                    </div>
                    <div>
                      <div className="font-semibold">Conversations</div>
                      <div className="text-2xl">{selectedDealerData.conversation_count}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Step 2: Select Categories */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Step 2: Select Data Categories</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedCategories.length === DATA_CATEGORIES.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DATA_CATEGORIES.map(category => (
                <Card
                  key={category.id}
                  className={`cursor-pointer transition-all ${
                    selectedCategories.includes(category.id)
                      ? getDangerColor(category.danger)
                      : 'hover:border-gray-400'
                  }`}
                  onClick={() => handleCategoryToggle(category.id)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => handleCategoryToggle(category.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{category.icon}</span>
                          <div className="font-semibold">{category.label}</div>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{category.description}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Step 3: Confirmation */}
          {selectedCategories.length > 0 && (
            <div className="space-y-3">
              <Label className="text-lg font-semibold">Step 3: Confirm Action</Label>
              <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                  <div className="space-y-2 text-sm">
                    <p className="font-bold text-red-600">⚠️ WARNING: This action is IRREVERSIBLE!</p>
                    <p>You are about to permanently delete:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedCategories.map(catId => {
                        const cat = DATA_CATEGORIES.find(c => c.id === catId);
                        return <li key={catId}>{cat?.label} - {cat?.description}</li>;
                      })}
                    </ul>
                    <p className="font-bold mt-3">Type <span className="bg-red-200 px-2 py-1 rounded font-mono">RESET DATA</span> to confirm:</p>
                  </div>
                </div>
                <Input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Type: RESET DATA"
                  className="border-red-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleReset}
              disabled={
                !selectedDealer ||
                selectedCategories.length === 0 ||
                confirmationText !== 'RESET DATA' ||
                loading
              }
              className="bg-red-600 hover:bg-red-700 text-white"
              size="lg"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Reset Selected Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


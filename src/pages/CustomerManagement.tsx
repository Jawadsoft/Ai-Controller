/**
 * Customer Management Page
 * CRM interface for managing customers and generating application links
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Link as LinkIcon, 
  Mail, 
  MessageSquare, 
  Copy, 
  ExternalLink, 
  ArrowLeft,
  FileText,
  Calendar,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TopNavigation from '@/components/layout/TopNavigation';

interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  created_at: string;
  last_login: string;
  application_count: number;
  last_application_date: string;
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
}

const CustomerManagement = () => {
  const { user } = useAuth();
  const { isDealerAdmin, isSuperAdmin } = usePermissions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const canDeleteCustomers = isDealerAdmin() || isSuperAdmin();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('none');
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [linkExpiry, setLinkExpiry] = useState('168'); // 7 days in hours
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    console.log('CustomerManagement - Auth check:', { 
      hasToken: !!token, 
      hasUser: !!user,
      userEmail: user?.email 
    });
    
    if (token && user) {
      loadCustomers();
      loadVehicles();
    }
  }, [searchTerm, showAll, user]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (showAll) {
        params.append('all', 'true');
      }
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const url = `${API_BASE_URL}/api/customers${params.toString() ? `?${params.toString()}` : ''}`;
      console.log('Loading customers from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers.get('content-type'));
      
      if (!response.ok) {
        const text = await response.text();
        console.error('Error response:', text.substring(0, 200));
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Customers response:', data);
      
      setCustomers(data.data || []);
    } catch (error: any) {
      console.error('Error loading customers:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load customers',
        variant: 'destructive',
      });
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      console.log('Loading vehicles...');
      const response = await api.getVehicles();
      console.log('Vehicles loaded:', response?.length || 0, 'vehicles');
      setVehicles(response || []);
    } catch (error: any) {
      console.error('Error loading vehicles:', error);
      console.error('Error details:', error.message);
      setVehicles([]); // Set empty array on error
      
      // Don't show error toast - just log it
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        console.warn('Vehicle loading failed due to authentication. This is non-critical.');
      }
    }
  };

  const generateLink = async () => {
    if (!selectedCustomer) return;

    try {
      setGenerating(true);
      const response = await api.generateCustomerApplicationLink(
        selectedCustomer.id,
        {
          vehicleId: (selectedVehicle && selectedVehicle !== 'none') ? selectedVehicle : undefined,
          expiresIn: parseInt(linkExpiry)
        }
      );

      setGeneratedLink(response.link);
      
      toast({
        title: 'Link Generated!',
        description: 'Application link has been created successfully',
      });
    } catch (error: any) {
      console.error('Error generating link:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate link',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast({
      title: 'Copied!',
      description: 'Link copied to clipboard',
    });
  };

  const sendViaEmail = async () => {
    if (!selectedCustomer) return;

    try {
      setSending(true);
      await api.sendCustomerApplicationLink(
        selectedCustomer.id,
        {
          vehicleId: (selectedVehicle && selectedVehicle !== 'none') ? selectedVehicle : undefined,
          expiresIn: parseInt(linkExpiry),
          method: 'email'
        }
      );

      toast({
        title: 'Email Sent!',
        description: `Application link sent to ${selectedCustomer.email}`,
      });
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send email',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const sendViaSMS = async () => {
    if (!selectedCustomer) return;

    try {
      setSending(true);
      await api.sendCustomerApplicationLink(
        selectedCustomer.id,
        {
          vehicleId: (selectedVehicle && selectedVehicle !== 'none') ? selectedVehicle : undefined,
          expiresIn: parseInt(linkExpiry),
          method: 'sms'
        }
      );

      toast({
        title: 'SMS Sent!',
        description: `Application link sent to ${selectedCustomer.phone}`,
      });
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send SMS',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const sendViaBoth = async () => {
    if (!selectedCustomer) return;

    try {
      setSending(true);
      await api.sendCustomerApplicationLink(
        selectedCustomer.id,
        {
          vehicleId: (selectedVehicle && selectedVehicle !== 'none') ? selectedVehicle : undefined,
          expiresIn: parseInt(linkExpiry),
          method: 'both'
        }
      );

      toast({
        title: 'Sent!',
        description: `Application link sent via email and SMS`,
      });
    } catch (error: any) {
      console.error('Error sending:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send link',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const openLinkDialogForCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setGeneratedLink('');
    setSelectedVehicle('none');
  };

  const handleDeleteCustomer = async () => {
    if (!deleteTarget) return;
    try {
      setDeletingCustomer(true);
      await api.deleteCustomer(deleteTarget.id);
      toast({
        title: 'Customer deleted',
        description: `${deleteTarget.first_name} ${deleteTarget.last_name} has been removed.`,
      });
      if (selectedCustomer?.id === deleteTarget.id) {
        setSelectedCustomer(null);
      }
      setDeleteTarget(null);
      await loadCustomers();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete customer';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeletingCustomer(false);
    }
  };

  /** Shared generate-link dialog for table row and mobile card */
  const renderApplicationLinkDialog = (customer: Customer, opts: { fullWidth?: boolean }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={opts.fullWidth ? 'w-full' : undefined}
          onClick={() => openLinkDialogForCustomer(customer)}
        >
          <LinkIcon className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Generate Link</span>
          <span className="sm:hidden">Link</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90dvh,900px)] w-[calc(100vw-1rem)] max-w-2xl gap-0 overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1 pr-8 text-left">
          <DialogTitle className="text-lg leading-tight sm:text-xl">Generate Application Link</DialogTitle>
          <DialogDescription>
            Create a shareable link for {customer.first_name} {customer.last_name}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div>
            <Label>Vehicle (Optional)</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Select a vehicle or leave blank for general application" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific vehicle</SelectItem>
                {Array.isArray(vehicles) && vehicles.length > 0 ? (
                  vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.year} {v.make} {v.model}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-gray-500">No vehicles available</div>
                )}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-gray-500">
              {Array.isArray(vehicles) && vehicles.length > 0
                ? 'If selected, vehicle information will be pre-filled'
                : 'Add vehicles to your inventory to pre-fill vehicle information'}
            </p>
          </div>

          <div>
            <Label>Link Expiry</Label>
            <Select value={linkExpiry} onValueChange={setLinkExpiry}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="72">3 days</SelectItem>
                <SelectItem value="168">7 days (recommended)</SelectItem>
                <SelectItem value="336">14 days</SelectItem>
                <SelectItem value="720">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!generatedLink && (
            <Button onClick={generateLink} className="w-full" disabled={generating}>
              <LinkIcon className="mr-2 h-4 w-4" />
              {generating ? 'Generating...' : 'Generate Link'}
            </Button>
          )}

          {generatedLink && (
            <div className="space-y-3">
              <div>
                <Label>Generated Link</Label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input readOnly value={generatedLink} className="min-w-0 flex-1 font-mono text-xs sm:text-sm" />
                  <div className="flex shrink-0 gap-2 sm:flex-row">
                    <Button onClick={copyLink} variant="outline" size="icon" className="flex-1 sm:flex-none" aria-label="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => window.open(generatedLink, '_blank')}
                      variant="outline"
                      size="icon"
                      className="flex-1 sm:flex-none"
                      aria-label="Open link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Link expires: {new Date(Date.now() + parseInt(linkExpiry) * 60 * 60 * 1000).toLocaleString()}
                </p>
              </div>

              <div className="border-t pt-3">
                <Label className="mb-2 block">Send to Customer</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button onClick={sendViaEmail} variant="outline" disabled={sending} className="w-full">
                    <Mail className="mr-2 h-4 w-4 shrink-0" />
                    Email
                  </Button>
                  <Button onClick={sendViaSMS} variant="outline" disabled={sending || !customer.phone} className="w-full">
                    <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                    SMS
                  </Button>
                  <Button onClick={sendViaBoth} disabled={sending || !customer.phone} className="w-full">
                    <FileText className="mr-2 h-4 w-4 shrink-0" />
                    Both
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  // Check if user is logged in
  if (!user) {
    return (
      <div className="space-y-6 px-3 py-6 sm:px-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">Authentication Required</p>
              <p className="text-gray-600 mb-4">Please log in to access Customer Management</p>
              <Button onClick={() => navigate('/auth')}>
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNavigation />
      
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deletingCustomer && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{' '}
              <span className="font-medium text-foreground">
                {deleteTarget ? `${deleteTarget.first_name} ${deleteTarget.last_name}` : ''}
              </span>{' '}
              ({deleteTarget?.email}) from the system. Credit application history may lose the linked customer record.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCustomer}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteCustomer}
              disabled={deletingCustomer}
            >
              {deletingCustomer ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Page Header ── */}
      <div className="bg-white border-b shadow-sm px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-700 gap-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Users className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="font-bold text-base text-gray-900">Customer Management</h1>
            <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Manage and track your customers</span>
              <span className="text-[11px] font-medium text-orange-600 bg-orange-50 rounded-full px-2 py-0.5">{customers.length} customers</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customers</p>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search by name or email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-52 text-xs border-gray-200"
            />
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-3.5 w-3.5 accent-orange-500" />
              Show all
            </label>
          </div>
        </div>

          {loading ? (
            <div className="text-center py-8">
              <p>Loading customers...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              {showAll || searchTerm ? (
                <>
                  <p>No customers found</p>
                  <p className="text-sm mt-2">Try a different search or check "Show all customers"</p>
                </>
              ) : (
                <>
                  <p>No customers have interacted with your dealership yet</p>
                  <p className="text-sm mt-2">
                    Customers appear here after submitting applications or chatting with DAIVE
                  </p>
                  <p className="text-sm mt-2">
                    💡 <strong>Tip:</strong> Check "Show all customers" to search and generate links for any customer
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <ul className="space-y-3 md:hidden">
                {customers.map((customer) => (
                  <li
                    key={customer.id}
                    className="rounded-lg border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-base font-semibold leading-tight">
                        {customer.first_name} {customer.last_name}
                      </p>
                      <a
                        href={`mailto:${customer.email}`}
                        className="break-all text-sm text-primary underline-offset-2 hover:underline"
                      >
                        {customer.email}
                      </a>
                      {customer.phone ? (
                        <a
                          href={`tel:${customer.phone}`}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          {customer.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">No phone</span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                      <Badge variant="secondary" className="text-xs">
                        {customer.application_count} app{customer.application_count !== 1 ? 's' : ''}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {customer.last_application_date
                          ? new Date(customer.last_application_date).toLocaleDateString()
                          : 'Never'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      {renderApplicationLinkDialog(customer, { fullWidth: true })}
                      {canDeleteCustomers && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 sm:w-auto"
                          onClick={() => setDeleteTarget(customer)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* md+: table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Applications</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="max-w-[10rem] font-medium">
                          <span className="line-clamp-2">
                            {customer.first_name} {customer.last_name}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[14rem]">
                          <span className="line-clamp-2 break-all text-sm">{customer.email}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{customer.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{customer.application_count}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {customer.last_application_date ? (
                              <>
                                <Calendar className="mr-1 inline h-3 w-3" />
                                {new Date(customer.last_application_date).toLocaleDateString()}
                              </>
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {renderApplicationLinkDialog(customer, {})}
                            {canDeleteCustomers && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteTarget(customer)}
                                aria-label={`Delete ${customer.first_name} ${customer.last_name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
      </div>{/* end customers panel */}
      </div>{/* end flex-1 */}
    </div>
  );
};

export default CustomerManagement;


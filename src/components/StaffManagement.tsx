import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { getToken } from '@/lib/api';
import { API_BASE_URL, buildBackendAssetUrl } from '@/lib/config';

const getStaffPhotoUrl = (photoUrl?: string | null) => {
  if (!photoUrl) return '';
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) return photoUrl;
  return buildBackendAssetUrl(photoUrl);
};
import { Plus, Edit, Trash2, Users, Shield, DollarSign, Wrench, Package, LogOut, RefreshCw, Eye, EyeOff, QrCode, Copy, ExternalLink, Phone, LayoutGrid, List, MessageSquare, Clock, X } from 'lucide-react';

interface StaffMember {
  id: string;
  user_id?: string;
  email: string;
  name: string;
  staff_role: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  created_by_email?: string;
  // Extended profile fields
  staff_qr_hash?: string;
  photo_url?: string;
  phone?: string;
  extension_number?: string;
  department?: string;
  location?: string;
  languages?: string[];
  specialties?: string[];
  years_with_company?: number;
  employee_id?: string;
  availability_status?: string;
}

interface ActiveCustomer {
  session_id: string;
  claimed_at: string;
  expires_at: string;
  conversation_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  vehicle_id?: string;
  make?: string;
  model?: string;
  year?: number;
  last_active?: string;
  last_message?: string;
  message_count?: number;
}

interface Permission {
  permission_name: string;
  permission_value: boolean;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  is_system_role: boolean;
}

const StaffManagement = () => {
  const { user, signOut } = useAuth();
  const { canAccessFeature } = usePermissions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [activeCustomers, setActiveCustomers] = useState<ActiveCustomer[]>([]);
  const [activeCustomersStaffId, setActiveCustomersStaffId] = useState<string | null>(null);
  const [showActiveCustomers, setShowActiveCustomers] = useState(false);
  const [loadingActiveCustomers, setLoadingActiveCustomers] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [sendPasswordEmail, setSendPasswordEmail] = useState(false);
  const [newStaff, setNewStaff] = useState({
    email: '',
    password: '',
    name: '',
    staff_role: 'sales',
    permissions: [] as string[]
  });

  // ── QR card state ──────────────────────────────────────────────────────────
  const [qrCardStaff, setQrCardStaff] = useState<StaffMember | null>(null);
  const [qrCardDataUrl, setQrCardDataUrl] = useState<string>('');
  const [generatingQr, setGeneratingQr] = useState(false);

  useEffect(() => {
    fetchStaff();
    fetchRoles();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/staff`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch staff members');
      }
      
      const data = await response.json();
      setStaff(data.staff);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch staff members",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/super-admin/roles`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Fetched roles for staff management:', data.roles);
        // Include ALL roles except super_admin (both system and custom roles)
        const staffRoles = data.roles.filter((role: Role) => 
          role.name !== 'super_admin'
        );
        console.log('📋 Staff roles after filtering:', staffRoles);
        setRoles(staffRoles);
      } else {
        console.error('Failed to fetch roles - response not ok:', response.status);
        // Fallback to default roles if API fails
        setRoles([
          { id: 'admin', name: 'admin', display_name: 'Admin', description: '', is_system_role: true },
          { id: 'sales', name: 'sales', display_name: 'Sales Agent', description: '', is_system_role: true },
          { id: 'finance', name: 'finance', display_name: 'Finance Manager', description: '', is_system_role: true },
          { id: 'service', name: 'service', display_name: 'Service Advisor', description: '', is_system_role: true },
          { id: 'inventory', name: 'inventory', display_name: 'Inventory Manager', description: '', is_system_role: true }
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      // Fallback to default roles if API fails
      setRoles([
        { id: 'admin', name: 'admin', display_name: 'Admin', description: '', is_system_role: true },
        { id: 'sales', name: 'sales', display_name: 'Sales Agent', description: '', is_system_role: true },
        { id: 'finance', name: 'finance', display_name: 'Finance Manager', description: '', is_system_role: true },
        { id: 'service', name: 'service', display_name: 'Service Advisor', description: '', is_system_role: true },
        { id: 'inventory', name: 'inventory', display_name: 'Inventory Manager', description: '', is_system_role: true }
      ]);
    }
  };

  const fetchStaffPermissions = async (staffId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/staff/${staffId}/permissions`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const fetchActiveCustomers = async (staffId: string) => {
    setLoadingActiveCustomers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/staff/${staffId}/active-customers`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCustomers(data.customers || []);
        setActiveCustomersStaffId(staffId);
        setShowActiveCustomers(true);
      }
    } catch { /* non-critical */ } finally {
      setLoadingActiveCustomers(false);
    }
  };

  const fetchRolePermissions = async (roleName: string) => {
    try {
      // Find the role in our roles array
      const role = roles.find(r => r.name === roleName);
      if (role) {
        // Fetch the full role details including permissions
        const response = await fetch(`${API_BASE_URL}/super-admin/roles`, {
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const fullRole = data.roles.find((r: any) => r.name === roleName);
          if (fullRole && fullRole.permissions) {
            // Convert permissions array to Permission objects
            const rolePermissions = fullRole.permissions.map((permName: string) => ({
              permission_name: permName,
              permission_value: true
            }));
            console.log(`🔄 Updated permissions for role ${roleName}:`, rolePermissions);
            setPermissions(rolePermissions);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch role permissions:', error);
    }
  };

  // ── QR helpers ─────────────────────────────────────────────────────────────
  const handleOpenQrCard = async (member: StaffMember) => {
    setQrCardStaff(member);
    setQrCardDataUrl('');

    let hash = member.staff_qr_hash;

    // Generate hash if missing
    if (!hash) {
      setGeneratingQr(true);
      try {
        const res = await fetch(`${API_BASE_URL}/staff/${member.id}/generate-qr`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Server error');
        }
        hash = data.staff_qr_hash;
        if (!hash) {
          throw new Error('No QR hash returned from server');
        }
        setStaff(prev =>
          prev.map(s => s.id === member.id ? { ...s, staff_qr_hash: hash! } : s)
        );
        setQrCardStaff(prev => prev ? { ...prev, staff_qr_hash: hash! } : prev);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message || 'Failed to generate QR code', variant: 'destructive' });
        setGeneratingQr(false);
        return;
      }
      setGeneratingQr(false);
    }

    if (!hash) {
      toast({ title: 'Error', description: 'Could not resolve QR hash', variant: 'destructive' });
      return;
    }

    const profileUrl = `${window.location.origin}/#/salesperson/qr/${hash}`;
    try {
      const dataUrl = await QRCode.toDataURL(profileUrl, {
        width: 240,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });
      setQrCardDataUrl(dataUrl);
    } catch {
      toast({ title: 'Error', description: 'Failed to render QR code', variant: 'destructive' });
    }
  };

  const handleRegenerateQr = async () => {
    if (!qrCardStaff) return;
    setGeneratingQr(true);
    try {
      const res = await fetch(`${API_BASE_URL}/staff/${qrCardStaff.id}/generate-qr`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      const hash = data.staff_qr_hash;
      if (!hash) throw new Error('No QR hash returned');
      setStaff(prev =>
        prev.map(s => s.id === qrCardStaff.id ? { ...s, staff_qr_hash: hash } : s)
      );
      setQrCardStaff(prev => prev ? { ...prev, staff_qr_hash: hash } : prev);
      const profileUrl = `${window.location.origin}/#/salesperson/qr/${hash}`;
      const dataUrl = await QRCode.toDataURL(profileUrl, { width: 240, margin: 1 });
      setQrCardDataUrl(dataUrl);
      toast({ title: 'Success', description: 'New QR code generated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to regenerate QR', variant: 'destructive' });
    }
    setGeneratingQr(false);
  };

  const handleCopyProfileLink = () => {
    if (!qrCardStaff?.staff_qr_hash) return;
    const url = `${window.location.origin}/#/salesperson/qr/${qrCardStaff.staff_qr_hash}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied', description: 'Profile link copied to clipboard' });
  };

  const handleAddStaff = async (e: React.FormEvent) => {    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(newStaff)
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success",
          description: `Staff member added successfully. Verification email sent to ${newStaff.email}`
        });
        setShowAddForm(false);
        setNewStaff({ email: '', password: '', name: '', staff_role: 'sales', permissions: [] });
        setShowPassword(false);
        fetchStaff();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to add staff member",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add staff member",
        variant: "destructive"
      });
    }
  };

  const generateRandomPassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleUpdateStaff = async (staffId: string, updates: Partial<StaffMember> & { password?: string, sendEmail?: boolean }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/staff/${staffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success",
          description: data.emailSent 
            ? "Staff member updated and notification email sent"
            : "Staff member updated successfully"
        });
        fetchStaff();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update staff member",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update staff member",
        variant: "destructive"
      });
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/staff/${staffId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Staff member deleted successfully"
        });
        fetchStaff();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete staff member",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete staff member",
        variant: "destructive"
      });
    }
  };

  const handleUpdatePermissions = async (staffId: string, newPermissions: Permission[]) => {
    try {
      const response = await fetch(`${API_BASE_URL}/staff/${staffId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ permissions: newPermissions })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Permissions updated successfully"
        });
        fetchStaffPermissions(staffId);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update permissions",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update permissions",
        variant: "destructive"
      });
    }
  };

  const getRoleIcon = (role: string) => {
    const icons = {
      'admin': Shield,
      'sales': Users,
      'finance': DollarSign,
      'service': Wrench,
      'inventory': Package
    };
    return icons[role as keyof typeof icons] || Users;
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      'admin': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'sales': 'bg-primary/15 text-primary dark:bg-primary/20 dark:text-muted-foreground',
      'finance': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'service': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'inventory': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    };
    return colors[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const getRoleDisplayName = (role: string) => {
    const names: Record<string, string> = {
      'admin': 'Admin',
      'sales': 'Sales Agent',
      'finance': 'Finance Manager',
      'service': 'Service Advisor',
      'inventory': 'Inventory Manager'
    };
    return names[role] || role;
  };

  if (!canAccessFeature('staff_management')) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>You don't have permission to access staff management.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Users className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">DealerIQ</h1>
            <span className="text-muted-foreground text-sm">/ Staff Management</span>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/vehicles")}>
              Vehicles
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/leads")}>
              Leads
            </Button>
            <span className="text-xs text-muted-foreground">
              {user?.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center space-x-1"
            >
              <LogOut className="h-3 w-3" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">Staff Management</h2>
            <p className="text-sm text-muted-foreground">
              Manage your dealership staff members and their permissions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('card')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'card'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
                title="Card view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>
            <div className="flex space-x-3">
            <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
              <DialogTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Staff Member</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Staff Member</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddStaff} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={newStaff.password}
                        onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                        required
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={newStaff.staff_role}
                      onValueChange={(value) => setNewStaff({ ...newStaff, staff_role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.length === 0 ? (
                          <SelectItem value="loading" disabled>Loading roles...</SelectItem>
                        ) : (
                          roles.map((role) => (
                            <SelectItem key={role.id} value={role.name}>
                              {role.display_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">Add Staff</Button>
                    <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          </div>
        </div>

        {/* Staff Card Grid */}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {staff.length} staff member{staff.length !== 1 ? 's' : ''}
          </p>
        </div>

        {staff.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No staff members yet</h3>
              <p className="text-muted-foreground mb-4">Add your first staff member to get started</p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Staff Member
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {staff.map((member) => (
              <div key={member.id} className="bg-white dark:bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                {/* Photo strip */}
                <div className="relative h-32 bg-gray-100 dark:bg-muted overflow-hidden shrink-0">
                  {member.photo_url ? (
                    <img src={getStaffPhotoUrl(member.photo_url)} alt={member.name} className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-muted dark:to-muted/60">
                      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <span className={`absolute top-2 right-2 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    (member.availability_status || 'available') === 'available' ? 'bg-orange-500'
                      : member.availability_status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
                  }`}>
                    {member.availability_status || 'available'}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-3 flex flex-col flex-1">
                  {/* Name + role + ID */}
                  <div className="mb-2">
                    <h3 className="font-bold text-sm text-foreground leading-tight truncate">{member.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{getRoleDisplayName(member.staff_role)}</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">
                      ID: {member.employee_id || '—'}
                    </span>
                  </div>

                  {/* Contact rows */}
                  <div className="space-y-1 text-[11px] mb-2 flex-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-3 shrink-0">✉</span>
                      <span className="truncate">{member.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-3 shrink-0">📞</span>
                      <span>{member.phone || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-3 shrink-0">🏢</span>
                      <span className="truncate">{member.department || '—'}{member.location ? ` · ${member.location}` : ''}</span>
                    </div>
                  </div>

                  {/* Specialties */}
                  <div className="mb-2 min-h-[18px]">
                    {member.specialties && member.specialties.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {member.specialties.slice(0, 2).map((s) => (
                          <span key={s} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{s}</span>
                        ))}
                        {member.specialties.length > 2 && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">+{member.specialties.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40 italic">No specialties</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-border">
                    {/* View Profile / QR */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-[11px] h-7 gap-1 px-2"
                      onClick={() => handleOpenQrCard(member)}
                    >
                      <QrCode className="h-3 w-3" />
                      QR
                    </Button>

                    {/* Edit */}
                    <Dialog
                      open={editingStaff?.id === member.id}
                      onOpenChange={(open) => {
                        if (!open) { setEditingStaff(null); setPermissions([]); }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-[11px] h-7 gap-1 px-2"
                          onClick={() => { setEditingStaff(member); fetchStaffPermissions(member.id); }}
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                      </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Edit Staff Member</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-5">

                                  {/* ── Photo Upload ── */}
                                  <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-xl">
                                    <div className="relative h-16 w-16 shrink-0">
                                      {editingStaff?.photo_url ? (
                                        <img
                                          src={getStaffPhotoUrl(editingStaff.photo_url)}
                                          alt="Photo"
                                          className="h-16 w-16 rounded-full object-cover border-2 border-border"
                                        />
                                      ) : (
                                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary border-2 border-border">
                                          {member.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium mb-1">Profile Photo</p>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        id={`staff-photo-upload-${member.id}`}
                                        className="hidden"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (!file || !editingStaff) return;
                                          const formData = new FormData();
                                          formData.append('photo', file);
                                          try {
                                            const res = await fetch(`${API_BASE_URL}/staff/${editingStaff.id}/photo`, {
                                              method: 'POST',
                                              headers: { 'Authorization': `Bearer ${getToken()}` },
                                              body: formData
                                            });
                                            const data = await res.json();
                                            if (res.ok) {
                                              setEditingStaff({ ...editingStaff, photo_url: data.photo_url });
                                              setStaff(prev => prev.map(s => s.id === editingStaff.id ? { ...s, photo_url: data.photo_url } : s));
                                              toast({ title: 'Photo uploaded successfully' });
                                            } else {
                                              toast({ title: 'Upload failed', description: data.error, variant: 'destructive' });
                                            }
                                          } catch {
                                            toast({ title: 'Upload failed', variant: 'destructive' });
                                          }
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => document.getElementById(`staff-photo-upload-${member.id}`)?.click()}
                                      >
                                        Upload Photo
                                      </Button>
                                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG or GIF · Max 5MB</p>
                                    </div>
                                  </div>

                                  {/* ── Basic info ── */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label htmlFor="edit-name">Full Name</Label>
                                      <Input
                                        id="edit-name"
                                        value={editingStaff?.name || ''}
                                        onChange={(e) => setEditingStaff({ ...editingStaff!, name: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-role">Role</Label>
                                      <Select
                                        value={editingStaff?.staff_role || ''}
                                        onValueChange={(value) => {
                                          setEditingStaff({ ...editingStaff!, staff_role: value });
                                          fetchRolePermissions(value);
                                        }}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select a role..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {roles.length === 0 ? (
                                            <SelectItem value="loading" disabled>Loading roles...</SelectItem>
                                          ) : (
                                            roles.map((role) => (
                                              <SelectItem key={role.id} value={role.name}>
                                                {role.display_name}
                                              </SelectItem>
                                            ))
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-employee-id">Employee ID</Label>
                                      <Input
                                        id="edit-employee-id"
                                        placeholder="e.g. 10234"
                                        value={editingStaff?.employee_id || ''}
                                        onChange={(e) => setEditingStaff({ ...editingStaff!, employee_id: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-availability">Availability</Label>
                                      <Select
                                        value={editingStaff?.availability_status || 'available'}
                                        onValueChange={(value) => setEditingStaff({ ...editingStaff!, availability_status: value })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="available">Available</SelectItem>
                                          <SelectItem value="busy">Busy</SelectItem>
                                          <SelectItem value="away">Away</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {/* ── Contact ── */}
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contact Details</p>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <Label htmlFor="edit-phone">Phone</Label>
                                        <Input
                                          id="edit-phone"
                                          placeholder="(555) 123-4567"
                                          value={editingStaff?.phone || ''}
                                          onChange={(e) => setEditingStaff({ ...editingStaff!, phone: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-ext">Extension</Label>
                                        <Input
                                          id="edit-ext"
                                          placeholder="1001"
                                          value={editingStaff?.extension_number || ''}
                                          onChange={(e) => setEditingStaff({ ...editingStaff!, extension_number: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-dept">Department</Label>
                                        <Input
                                          id="edit-dept"
                                          placeholder="Sales"
                                          value={editingStaff?.department || ''}
                                          onChange={(e) => setEditingStaff({ ...editingStaff!, department: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-location">Location</Label>
                                        <Input
                                          id="edit-location"
                                          placeholder="Main Showroom"
                                          value={editingStaff?.location || ''}
                                          onChange={(e) => setEditingStaff({ ...editingStaff!, location: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-years">Years with Company</Label>
                                        <Input
                                          id="edit-years"
                                          type="number"
                                          min={0}
                                          placeholder="3"
                                          value={editingStaff?.years_with_company ?? ''}
                                          onChange={(e) => setEditingStaff({ ...editingStaff!, years_with_company: Number(e.target.value) })}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* ── Languages & Specialties ── */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label htmlFor="edit-languages">Languages</Label>
                                      <Input
                                        id="edit-languages"
                                        placeholder="English, Spanish"
                                        value={(editingStaff?.languages || []).join(', ')}
                                        onChange={(e) => setEditingStaff({
                                          ...editingStaff!,
                                          languages: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                        })}
                                      />
                                      <p className="text-xs text-muted-foreground mt-0.5">Comma-separated</p>
                                    </div>
                                    <div>
                                      <Label htmlFor="edit-specialties">Specialties</Label>
                                      <Input
                                        id="edit-specialties"
                                        placeholder="New Vehicle Sales, Leasing"
                                        value={(editingStaff?.specialties || []).join(', ')}
                                        onChange={(e) => setEditingStaff({
                                          ...editingStaff!,
                                          specialties: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                        })}
                                      />
                                      <p className="text-xs text-muted-foreground mt-0.5">Comma-separated</p>
                                    </div>
                                  </div>

                                  {/* ── Password Reset ── */}
                                  <div className="border-t pt-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <Label>Reset Password (Optional)</Label>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditPassword(generateRandomPassword());
                                          setSendPasswordEmail(true);
                                        }}
                                      >
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Generate New Password
                                      </Button>
                                    </div>
                                    <div className="relative">
                                      <Input
                                        type={showEditPassword ? 'text' : 'password'}
                                        placeholder="Leave blank to keep current password"
                                        value={editPassword}
                                        onChange={(e) => setEditPassword(e.target.value)}
                                        className="pr-10"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                        onClick={() => setShowEditPassword(!showEditPassword)}
                                      >
                                        {showEditPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                      </Button>
                                    </div>
                                    {editPassword && (
                                      <div className="flex items-center space-x-2 mt-2">
                                        <input type="checkbox" id="send-password-email" checked={sendPasswordEmail}
                                          onChange={(e) => setSendPasswordEmail(e.target.checked)} className="rounded border-gray-300" />
                                        <Label htmlFor="send-password-email" className="text-sm font-normal cursor-pointer">Send new password via email</Label>
                                      </div>
                                    )}
                                  </div>

                                  {/* ── Permissions ── */}
                                  {permissions.length > 0 && (
                                    <div className="border-t pt-4">
                                      <Label className="mb-2 block">Permissions</Label>
                                      <div className="space-y-2">
                                        {permissions.map((permission) => (
                                          <div key={permission.permission_name} className="flex items-center justify-between">
                                            <span className="text-sm">{permission.permission_name}</span>
                                            <Switch
                                              checked={permission.permission_value}
                                              onCheckedChange={(checked) => {
                                                setPermissions(permissions.map(p =>
                                                  p.permission_name === permission.permission_name ? { ...p, permission_value: checked } : p
                                                ));
                                              }}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* ── Save / Cancel ── */}
                                  <div className="flex gap-2 pt-2 border-t">
                                    <Button
                                      className="flex-1"
                                      onClick={async () => {
                                        if (!editingStaff) return;
                                        // 1. Save extended profile fields FIRST so fetchStaff picks them up
                                        try {
                                          await fetch(`${API_BASE_URL}/staff/${editingStaff.id}/profile`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                                            body: JSON.stringify({
                                              phone: editingStaff.phone || null,
                                              extension_number: editingStaff.extension_number || null,
                                              department: editingStaff.department || null,
                                              location: editingStaff.location || null,
                                              languages: editingStaff.languages?.length ? editingStaff.languages : null,
                                              specialties: editingStaff.specialties?.length ? editingStaff.specialties : null,
                                              years_with_company: editingStaff.years_with_company ?? null,
                                              employee_id: editingStaff.employee_id || null,
                                              availability_status: editingStaff.availability_status || 'available',
                                            })
                                          });
                                        } catch { /* non-critical */ }
                                        // 2. Save name / role / password — this also calls fetchStaff() which reloads cards
                                        const updates: any = { name: editingStaff.name, staff_role: editingStaff.staff_role };
                                        if (editPassword) { updates.password = editPassword; updates.sendEmail = sendPasswordEmail; }
                                        handleUpdateStaff(editingStaff.id, updates);
                                        handleUpdatePermissions(editingStaff.id, permissions);
                                        setEditingStaff(null);
                                        setPermissions([]);
                                        setEditPassword('');
                                        setSendPasswordEmail(false);
                                        setShowEditPassword(false);
                                      }}
                                    >
                                      Save Changes
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setEditingStaff(null);
                                        setPermissions([]);
                                        setEditPassword('');
                                        setSendPasswordEmail(false);
                                        setShowEditPassword(false);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                    </Dialog>

                    {/* Call */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => member.phone && (window.location.href = `tel:${member.phone}`)}
                      disabled={!member.phone}
                      title={member.phone ? `Call ${member.phone}` : 'No phone'}
                    >
                      <Phone className="h-3 w-3" />
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteStaff(member.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* My Customers today */}
                  <button
                    className="w-full mt-2 flex items-center justify-between text-[11px] text-muted-foreground hover:text-primary transition-colors px-1 py-1 rounded hover:bg-muted/40"
                    onClick={() => fetchActiveCustomers(member.id)}
                  >
                    <span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Active customers today</span>
                    <span className="text-[10px] bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded-full">Live</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── List View ─────────────────────────────────────────────── */
          <div className="border border-border rounded-xl overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1.2fr_auto] gap-3 px-4 py-2 bg-muted/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
              <span>Employee</span>
              <span>Contact</span>
              <span>Department</span>
              <span>Specialties</span>
              <span>Status</span>
              <span></span>
            </div>
            {staff.map((member, idx) => (
              <div
                key={member.id}
                className={`grid grid-cols-[2fr_1.2fr_1fr_1fr_1.2fr_auto] gap-3 px-4 py-3 items-center text-sm hover:bg-muted/30 transition-colors ${idx !== staff.length - 1 ? 'border-b border-border' : ''}`}
              >
                {/* Employee info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full shrink-0 overflow-hidden bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                    {member.photo_url ? (
                      <img src={getStaffPhotoUrl(member.photo_url)} alt={member.name} className="h-full w-full object-cover" />
                    ) : (
                      member.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground capitalize truncate">{getRoleDisplayName(member.staff_role)}</p>
                    {member.employee_id && (
                      <span className="text-[10px] font-medium text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">{member.employee_id}</span>
                    )}
                  </div>
                </div>

                {/* Contact */}
                <div className="text-xs text-muted-foreground min-w-0">
                  <p className="truncate">{member.email}</p>
                  <p>{member.phone || '—'}</p>
                </div>

                {/* Department / Location */}
                <div className="text-xs text-muted-foreground min-w-0">
                  <p className="truncate">{member.department || '—'}</p>
                  {member.location && <p className="truncate text-muted-foreground/60">{member.location}</p>}
                </div>

                {/* Specialties */}
                <div className="flex flex-wrap gap-1">
                  {member.specialties && member.specialties.length > 0 ? (
                    <>
                      {member.specialties.slice(0, 2).map(s => (
                        <span key={s} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full whitespace-nowrap">{s}</span>
                      ))}
                      {member.specialties.length > 2 && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">+{member.specialties.length - 2}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </div>

                {/* Status */}
                <div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full text-white ${
                    (member.availability_status || 'available') === 'available' ? 'bg-orange-500'
                      : member.availability_status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
                  }`}>
                    {member.availability_status || 'available'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="QR / View Profile" onClick={() => handleOpenQrCard(member)}>
                    <QrCode className="h-3.5 w-3.5" />
                  </Button>
                  <Dialog
                    open={editingStaff?.id === member.id}
                    onOpenChange={(open) => { if (!open) { setEditingStaff(null); setPermissions([]); } }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit"
                        onClick={() => { setEditingStaff(member); fetchStaffPermissions(member.id); setViewMode('card'); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader><DialogTitle>Edit — {member.name}</DialogTitle></DialogHeader>
                      <p className="text-sm text-muted-foreground">Use the Cards view for the full profile form with photo upload.</p>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={member.phone ? `Call ${member.phone}` : 'No phone'}
                    disabled={!member.phone} onClick={() => member.phone && (window.location.href = `tel:${member.phone}`)}>
                    <Phone className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" title="Delete"
                    onClick={() => handleDeleteStaff(member.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Active Customers Panel ─────────────────────────────────────────── */}
      <Dialog open={showActiveCustomers} onOpenChange={setShowActiveCustomers}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-orange-500" />
              Active Customers Today
              {activeCustomersStaffId && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  — {staff.find(s => s.id === activeCustomersStaffId)?.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {loadingActiveCustomers ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : activeCustomers.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No customers have scanned this QR code today.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Share your QR code with customers at the dealership.</p>
            </div>
          ) : (
            <div className="space-y-3 mt-1">
              {activeCustomers.map((c, i) => (
                <div key={c.session_id || i} className="border border-border rounded-xl p-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-sm text-foreground">
                        {c.customer_name || 'Anonymous Visitor'}
                      </p>
                      {(c.customer_email || c.customer_phone) && (
                        <p className="text-xs text-muted-foreground">
                          {c.customer_email || c.customer_phone}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {c.last_active ? (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3" />
                          {new Date(c.last_active).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Just scanned</span>
                      )}
                      {c.message_count && Number(c.message_count) > 0 ? (
                        <span className="text-[10px] bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded-full block mt-0.5">
                          {c.message_count} msg{Number(c.message_count) !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full block mt-0.5">browsing</span>
                      )}
                    </div>
                  </div>

                  {(c.make || c.model) && (
                    <p className="text-xs text-primary font-medium mb-1">
                      🚗 {[c.year, c.make, c.model].filter(Boolean).join(' ')}
                    </p>
                  )}

                  {c.last_message && (
                    <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground italic border-l-2 border-orange-300">
                      "{c.last_message.substring(0, 120)}{c.last_message.length > 120 ? '…' : ''}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Digital Business Card & QR Code Modal ────────────────────────── */}
      <Dialog open={!!qrCardStaff} onOpenChange={(open) => { if (!open) { setQrCardStaff(null); setQrCardDataUrl(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-orange-500" />
              Digital Business Card
            </DialogTitle>
          </DialogHeader>

          {qrCardStaff && (
            <div className="space-y-4">
              {/* Mini profile preview */}
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                  {qrCardStaff.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{qrCardStaff.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{qrCardStaff.staff_role}</p>
                  {qrCardStaff.employee_id && (
                    <p className="text-xs text-yellow-600 font-medium">ID: {qrCardStaff.employee_id}</p>
                  )}
                </div>
                <Badge className="ml-auto text-xs bg-orange-500 text-white">
                  {qrCardStaff.availability_status || 'available'}
                </Badge>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-2">
                {generatingQr ? (
                  <div className="h-[240px] w-[240px] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : qrCardDataUrl ? (
                  <img src={qrCardDataUrl} alt="QR Code" className="rounded-xl border" />
                ) : (
                  <div className="h-[240px] w-[240px] flex items-center justify-center text-muted-foreground text-sm">
                    No QR yet
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Customer scans to view profile &amp; connect with D.A.I.V.E.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={handleRegenerateQr}
                  disabled={generatingQr}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={handleCopyProfileLink}
                  disabled={!qrCardStaff.staff_qr_hash}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy Link
                </Button>
                {qrCardStaff.staff_qr_hash && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => window.open(`/#/salesperson/qr/${qrCardStaff.staff_qr_hash}`, '_blank')}
                    title="Open public profile"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Download QR */}
              {qrCardDataUrl && (
                <a
                  href={qrCardDataUrl}
                  download={`${qrCardStaff.name.replace(/\s+/g, '_')}_QR.png`}
                  className="block"
                >
                  <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm">
                    Download QR Code
                  </Button>
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffManagement;

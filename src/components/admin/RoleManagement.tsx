import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Crown, Users, Shield, Settings, Eye, Edit, Plus, Trash2, 
  CheckCircle, XCircle, UserCheck, UserX, AlertTriangle
} from "lucide-react";
import { superAdminAPI } from "@/lib/superAdminAPI";

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_system_role: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
}

interface Permission {
  name: string;
  display_name: string;
  description: string;
  category: string;
}

interface RoleManagementProps {
  onRefresh?: () => void;
}

const RoleManagement = ({ onRefresh }: RoleManagementProps) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    permissions: [] as string[]
  });

  // Define available permissions with categories
  const availablePermissions: Permission[] = [
    // Core Features
    { name: 'qr_code_generation', display_name: 'QR Code Generation', description: 'Generate QR codes for vehicles', category: 'Core Features' },
    { name: 'lead_management', display_name: 'Lead Management', description: 'Manage customer leads and follow-ups', category: 'Core Features' },
    { name: 'vehicle_import', display_name: 'Vehicle Import', description: 'Import vehicles from various sources', category: 'Core Features' },
    
    // Finance & Sales
    { name: 'finance_management', display_name: 'Finance Management', description: 'Manage finance and lease programs, deals, and credit applications', category: 'Finance & Sales' },
    { name: 'rebate_management', display_name: 'Rebate Management', description: 'Manage vehicle rebates and incentive programs', category: 'Finance & Sales' },
    { name: 'customer_management', display_name: 'Customer Management', description: 'Manage customer records and information', category: 'Finance & Sales' },
    
    // Analytics & Reporting
    { name: 'analytics_dashboard', display_name: 'Analytics Dashboard', description: 'Access analytics and reporting', category: 'Analytics & Reporting' },
    { name: 'bulk_actions', display_name: 'Bulk Actions', description: 'Perform bulk operations on data', category: 'Analytics & Reporting' },
    
    // Administration
    { name: 'staff_management', display_name: 'Staff Management', description: 'Manage dealership staff members', category: 'Administration' },
    { name: 'user_management', display_name: 'User Management', description: 'Manage user accounts and access', category: 'Administration' },
    
    // Daive & Settings
    { name: 'daive_settings_management', display_name: 'Daive Settings', description: 'Configure Daive AI bot settings and behavior', category: 'Daive & Settings' },
    { name: 'followup_settings_management', display_name: 'Follow-up Settings', description: 'Configure automatic follow-up rules and timing', category: 'Daive & Settings' },
    
    // Customization
    { name: 'custom_branding', display_name: 'Custom Branding', description: 'Customize dealership branding', category: 'Customization' },
    
    // Technical
    { name: 'api_access', display_name: 'API Access', description: 'Access to API endpoints', category: 'Technical' },
    { name: 'priority_support', display_name: 'Priority Support', description: 'Access to priority customer support', category: 'Technical' }
  ];

  // Define default roles
  const defaultRoles: Role[] = [
    {
      id: 'super_admin',
      name: 'super_admin',
      display_name: 'Super Admin',
      description: 'Full platform access (excludes vehicle/import management)',
      permissions: ['lead_management', 'analytics_dashboard', 'bulk_actions', 'custom_branding', 'api_access', 'priority_support', 'staff_management', 'user_management', 'finance_management', 'rebate_management', 'daive_settings_management', 'followup_settings_management', 'customer_management'],
      is_system_role: true,
      user_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'admin',
      name: 'admin',
      display_name: 'Dealership Admin',
      description: 'Full dealership access with all management capabilities',
      permissions: ['qr_code_generation', 'lead_management', 'vehicle_import', 'analytics_dashboard', 'bulk_actions', 'staff_management', 'user_management', 'custom_branding', 'api_access', 'priority_support', 'finance_management', 'rebate_management', 'daive_settings_management', 'followup_settings_management', 'customer_management'],
      is_system_role: true,
      user_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sales',
      name: 'sales',
      display_name: 'Sales Representative',
      description: 'Sales-focused access for lead and vehicle operations',
      permissions: ['qr_code_generation', 'lead_management', 'vehicle_import', 'rebate_management', 'followup_settings_management', 'customer_management'],
      is_system_role: true,
      user_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'finance',
      name: 'finance',
      display_name: 'Finance Manager',
      description: 'Finance-focused access for deals, credit apps, and rebates',
      permissions: ['lead_management', 'analytics_dashboard', 'finance_management', 'rebate_management', 'customer_management'],
      is_system_role: true,
      user_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'service',
      name: 'service',
      display_name: 'Service Advisor',
      description: 'Service-focused access for customer management',
      permissions: ['lead_management', 'followup_settings_management', 'customer_management'],
      is_system_role: true,
      user_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'inventory',
      name: 'inventory',
      display_name: 'Inventory Manager',
      description: 'Inventory-focused access for vehicle management',
      permissions: ['vehicle_import', 'qr_code_generation'],
      is_system_role: true,
      user_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  useEffect(() => {
    fetchRoles();
    setPermissions(availablePermissions);
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const data = await superAdminAPI.getRoles();
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to fetch roles');
      // Fallback to default roles
      setRoles(defaultRoles);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setRoleFormData({
      name: '',
      display_name: '',
      description: '',
      permissions: []
    });
    setShowRoleForm(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name,
      display_name: role.display_name,
      description: role.description,
      permissions: role.permissions
    });
    setShowRoleForm(true);
  };

  const handleSaveRole = async () => {
    try {
      if (!roleFormData.name || !roleFormData.display_name) {
        toast.error('Name and display name are required');
        return;
      }

      const roleData = {
        name: roleFormData.name,
        display_name: roleFormData.display_name,
        description: roleFormData.description,
        permissions: roleFormData.permissions
      };

      if (editingRole) {
        // Update existing role
        const response = await superAdminAPI.updateRole(editingRole.id, roleData);
        setRoles(roles.map(r => r.id === editingRole.id ? response.role : r));
        toast.success('Role updated successfully');
      } else {
        // Create new role
        const response = await superAdminAPI.createRole(roleData);
        setRoles([...roles, response.role]);
        toast.success('Role created successfully');
      }

      setShowRoleForm(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error saving role:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save role');
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.is_system_role) {
      toast.error('System roles cannot be deleted');
      return;
    }

    if (role.user_count > 0) {
      toast.error('Cannot delete role with assigned users');
      return;
    }

    try {
      await superAdminAPI.deleteRole(role.id);
      setRoles(roles.filter(r => r.id !== role.id));
      toast.success('Role deleted successfully');
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete role');
    }
  };

  const togglePermission = (permissionName: string) => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionName)
        ? prev.permissions.filter(p => p !== permissionName)
        : [...prev.permissions, permissionName]
    }));
  };

  const toggleCategoryPermissions = (category: string, permissions: Permission[]) => {
    const categoryPermissionNames = permissions.map(p => p.name);
    const allSelected = categoryPermissionNames.every(name => roleFormData.permissions.includes(name));
    
    setRoleFormData(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !categoryPermissionNames.includes(p))
        : [...prev.permissions.filter(p => !categoryPermissionNames.includes(p)), ...categoryPermissionNames]
    }));
  };

  const selectAllPermissions = () => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: availablePermissions.map(p => p.name)
    }));
  };

  const clearAllPermissions = () => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: []
    }));
  };

  const getPermissionCategory = (permissionName: string) => {
    return availablePermissions.find(p => p.name === permissionName)?.category || 'Other';
  };

  const groupedPermissions = availablePermissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Role Management</h2>
          <p className="text-gray-600">Manage user roles and permissions across the platform</p>
        </div>
        <Button onClick={handleCreateRole} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Role Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-xs text-gray-600">
              {roles.filter(r => r.is_system_role).length} System, {roles.filter(r => !r.is_system_role).length} Custom
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.reduce((sum, role) => sum + role.user_count, 0)}</div>
            <p className="text-xs text-gray-600">Across all roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availablePermissions.length}</div>
            <p className="text-xs text-gray-600">Permission types</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {role.is_system_role ? (
                    <Crown className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Shield className="h-5 w-5 text-primary" />
                  )}
                  <CardTitle className="text-lg">{role.display_name}</CardTitle>
                </div>
                <Badge variant={role.is_system_role ? "default" : "secondary"}>
                  {role.is_system_role ? "System" : "Custom"}
                </Badge>
              </div>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Users:</span>
                  <span className="font-medium">{role.user_count}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Permissions:</span>
                  <span className="font-medium">{role.permissions.length}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditRole(role)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteRole(role)}
                    disabled={role.is_system_role || role.user_count > 0}
                    className="flex-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Role Table */}
      <Card>
        <CardHeader>
          <CardTitle>Role Details</CardTitle>
          <CardDescription>Detailed view of all roles and their permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{role.display_name}</div>
                      <div className="text-sm text-gray-600">{role.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.is_system_role ? "default" : "secondary"}>
                      {role.is_system_role ? "System" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-gray-500" />
                      {role.user_count}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 3).map((permission) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {availablePermissions.find(p => p.name === permission)?.display_name || permission}
                        </Badge>
                      ))}
                      {role.permissions.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{role.permissions.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRole(role)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRole(role)}
                        disabled={role.is_system_role || role.user_count > 0}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Form Dialog */}
      <Dialog open={showRoleForm} onOpenChange={setShowRoleForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? 'Edit Role' : 'Create New Role'}
            </DialogTitle>
            <DialogDescription>
              {editingRole ? 'Update role details and permissions' : 'Create a new role with specific permissions'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  value={roleFormData.name}
                  onChange={(e) => setRoleFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., marketing_manager"
                  disabled={editingRole?.is_system_role}
                />
                {editingRole?.is_system_role && (
                  <p className="text-xs text-gray-500">System role name cannot be changed</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={roleFormData.display_name}
                  onChange={(e) => setRoleFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="e.g., Marketing Manager"
                  disabled={editingRole?.is_system_role}
                />
                {editingRole?.is_system_role && (
                  <p className="text-xs text-gray-500">System role display name cannot be changed</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={roleFormData.description}
                onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the role's responsibilities..."
                rows={3}
                disabled={editingRole?.is_system_role}
              />
              {editingRole?.is_system_role && (
                <p className="text-xs text-gray-500">System role description cannot be changed</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Permissions</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllPermissions}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearAllPermissions}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => {
                  const categoryPermissionNames = categoryPermissions.map(p => p.name);
                  const allSelected = categoryPermissionNames.every(name => roleFormData.permissions.includes(name));
                  const someSelected = categoryPermissionNames.some(name => roleFormData.permissions.includes(name));
                  
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm text-gray-700">{category}</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleCategoryPermissions(category, categoryPermissions)}
                          className="text-xs"
                        >
                          {allSelected ? 'Deselect All' : someSelected ? 'Select All' : 'Select All'}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 pl-4">
                        {categoryPermissions.map((permission) => (
                          <div key={permission.name} className="flex items-center space-x-2">
                            <Checkbox
                              id={permission.name}
                              checked={roleFormData.permissions.includes(permission.name)}
                              onCheckedChange={() => togglePermission(permission.name)}
                            />
                            <Label htmlFor={permission.name} className="flex-1">
                              <div className="font-medium">{permission.display_name}</div>
                              <div className="text-sm text-gray-600">{permission.description}</div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole}>
              {editingRole ? 'Update Role' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoleManagement;

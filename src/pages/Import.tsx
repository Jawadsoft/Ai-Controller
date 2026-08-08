import React, { useState, useEffect } from 'react';
import ImportConfiguration from '../components/import/ImportConfiguration';
import CSVUploadWithMapping from '../components/import/CSVUploadWithMapping';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Settings, Database, Loader2, RefreshCw, CheckCircle, XCircle, Clock, FileText, Eye, MoreVertical, Search, Globe, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { buildApiUrl } from '../lib/config';
import { formatDistanceToNow } from 'date-fns';

// Interface for file information
interface FileInfo {
  filename: string;
  size: number;
  last_modified: string;
  last_imported?: string;
  import_count?: number;
}

// Interface for sync status
interface SyncStatus {
  status: 'idle' | 'running' | 'success' | 'error';
  message?: string;
  last_sync?: string;
  records_imported?: number;
}

// Interface for the API response (snake_case)
interface ImportConfigResponse {
  id: number;
  config_name: string;
  dealer_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  connection_type: 'ftp' | 'sftp';
  host_url: string;
  port: number;
  username: string;
  remote_directory: string;
  file_pattern: string;
  file_match_keyword?: string;
  selected_files?: string[];
  available_files?: string[];
  last_file_scan?: string;
  tracked_files?: FileInfo[];
  file_type: 'csv' | 'xml' | 'json';
  delimiter: string;
  has_header: boolean;
  encoding: string;
  date_format: string;
  frequency: 'manual' | 'test' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  time_hour: number;
  time_minute: number;
  day_of_week?: number;
  day_of_month?: number;
  duplicate_handling: 'skip' | 'update' | 'replace';
  batch_size: number;
  max_errors: number;
  validate_data: boolean;
  archive_processed_files: boolean;
  archive_directory: string;
  fieldMappings?: Array<{
    id: number;
    import_config_id: number;
    source_field: string;
    target_field: string;
    field_type: 'string' | 'number' | 'date' | 'boolean' | 'json';
    is_required: boolean;
    default_value?: string;
    transformation_rule?: string;
    field_order: number;
  }>;
}

const Import: React.FC = () => {
  const { toast } = useToast();
  const [editConfigId, setEditConfigId] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>("ftp-sftp");
  const [configs, setConfigs] = useState<ImportConfigResponse[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ImportConfigResponse | null>(null);
  const [syncStatuses, setSyncStatuses] = useState<Map<number, SyncStatus>>(new Map());
  const [testingConnection, setTestingConnection] = useState<Set<number>>(new Set());
  
  // New state for table features
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [viewDetailsConfig, setViewDetailsConfig] = useState<ImportConfigResponse | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalConfig, setEditModalConfig] = useState<ImportConfigResponse | null>(null);

  // Load configurations when FTP/SFTP tab is active
  const loadConfigs = async () => {
    try {
      setIsLoadingConfigs(true);
      console.log('=== LOADING CONFIGS FROM IMPORT PAGE ===');
      
      const response = await fetch(buildApiUrl('import/configs'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('API Response:', result);
        console.log('Configs to set:', result.data);
        console.log('Configs length:', result.data?.length || 0);
        setConfigs(result.data || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to load configs:', response.status, errorText);
        toast({
          title: "Error",
          description: "Failed to load configurations",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading configs:', error);
      toast({
        title: "Error",
        description: "Failed to load configurations",
        variant: "destructive"
      });
    } finally {
      setIsLoadingConfigs(false);
      console.log('=== END LOADING CONFIGS FROM IMPORT PAGE ===');
    }
  };

  // Load configurations when FTP/SFTP tab becomes active
  useEffect(() => {
    if (activeTab === 'ftp-sftp') {
      loadConfigs();
    }
  }, [activeTab]);

  // Load full configuration details for editing
  const loadConfigurationForEdit = async (configId: number) => {
    try {
      setIsLoadingConfigs(true);
      
      const response = await fetch(buildApiUrl(`import/configs/${configId}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load configuration details');
      }

      const result = await response.json();
      const fullConfig = result.data;
      
      setSelectedConfig(fullConfig);
      setEditConfigId(configId);
      setEditModalConfig(fullConfig);
      
      toast({
        title: "Configuration Loaded",
        description: `Loaded configuration: ${fullConfig.config_name} for editing`
      });
    } catch (error) {
      console.error('Error loading configuration for edit:', error);
      toast({
        title: "Error",
        description: "Failed to load configuration details",
        variant: "destructive"
      });
    } finally {
      setIsLoadingConfigs(false);
    }
  };

  // Callback function to handle edit requests from ImportConfiguration
  const handleEditConfig = (configId: number) => {
    setEditConfigId(configId);
    // Stay on FTP/SFTP tab since we removed the wizard
  };

  // Callback function to handle when edit is complete
  const handleEditComplete = () => {
    setEditConfigId(undefined);
    setSelectedConfig(null);
  };

  // Handle configuration selection for editing
  const handleConfigEdit = async (config: ImportConfigResponse) => {
    await loadConfigurationForEdit(config.id);
    // Modal will open after config is loaded (editModalConfig is set in loadConfigurationForEdit)
    setShowEditModal(true);
  };

  // Handle edit modal close
  const handleEditModalClose = () => {
    setShowEditModal(false);
    setEditModalConfig(null);
    setSelectedConfig(null);
    setEditConfigId(undefined);
    // Reload configurations to get updated data
    loadConfigs();
  };

  // Test connection and list files
  const handleTestConnection = async (configId: number) => {
    try {
      setTestingConnection(prev => new Set(prev).add(configId));
      
      const response = await fetch(buildApiUrl(`import/configs/${configId}/test-connection`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Connection test failed');
      }

      const result = await response.json();
      
      toast({
        title: "Connection Successful",
        description: `Connected to ${result.host || 'server'}. ${result.files_found || 0} files found.`
      });

      // Reload configs to get updated file list
      await loadConfigs();
    } catch (error) {
      console.error('Connection test error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Could not connect to remote server",
        variant: "destructive"
      });
    } finally {
      setTestingConnection(prev => {
        const next = new Set(prev);
        next.delete(configId);
        return next;
      });
    }
  };

  // List remote files
  const handleListFiles = async (configId: number) => {
    try {
      const response = await fetch(buildApiUrl(`import/configs/${configId}/list-files`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to list files');
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('List files error:', error);
      toast({
        title: "Error",
        description: "Failed to list remote files",
        variant: "destructive"
      });
      return [];
    }
  };

  // Quick sync function
  const handleQuickSync = async (configId: number) => {
    try {
      // Update sync status to running
      setSyncStatuses(prev => new Map(prev).set(configId, {
        status: 'running',
        message: 'Starting import...'
      }));

      // Find the config to get selected files
      const config = configs.find(c => c.id === configId);
      const selectedFiles = config?.selected_files || [];

      const response = await fetch(buildApiUrl(`import/configs/${configId}/sync`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selectedFiles: selectedFiles.length > 0 ? selectedFiles : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();
      
      // Check if file selection is needed
      if (result.needsFileSelection) {
        setSyncStatuses(prev => new Map(prev).set(configId, {
          status: 'error',
          message: `Multiple files found (${result.matchingFiles?.length || 0}). Please select specific files in the configuration.`
        }));

        toast({
          title: "File Selection Needed",
          description: `Found ${result.matchingFiles?.length || 0} files: ${result.matchingFiles?.slice(0, 2).join(', ')}${result.matchingFiles?.length > 2 ? '...' : ''}. Please edit the configuration and select which file(s) to import.`,
          variant: "destructive"
        });

        // Clear status after 8 seconds
        setTimeout(() => {
          setSyncStatuses(prev => {
            const next = new Map(prev);
            const status = next.get(configId);
            if (status?.status === 'error' && status.message.includes('Multiple files')) {
              next.set(configId, { ...status, status: 'idle' });
            }
            return next;
          });
        }, 8000);
        
        return;
      }
      
      // Update sync status to success
      setSyncStatuses(prev => new Map(prev).set(configId, {
        status: 'success',
        message: result.message || 'Import completed successfully',
        last_sync: new Date().toISOString(),
        records_imported: result.records_imported || 0
      }));

      toast({
        title: "Sync Successful",
        description: `Imported ${result.records_imported || 0} records successfully`
      });

      // Clear success status after 5 seconds
      setTimeout(() => {
        setSyncStatuses(prev => {
          const next = new Map(prev);
          const status = next.get(configId);
          if (status?.status === 'success') {
            next.set(configId, { ...status, status: 'idle' });
          }
          return next;
        });
      }, 5000);
    } catch (error) {
      console.error('Sync error:', error);
      
      // Update sync status to error
      setSyncStatuses(prev => new Map(prev).set(configId, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Sync failed'
      }));

      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Could not complete the import",
        variant: "destructive"
      });

      // Clear error status after 5 seconds
      setTimeout(() => {
        setSyncStatuses(prev => {
          const next = new Map(prev);
          const status = next.get(configId);
          if (status?.status === 'error') {
            next.set(configId, { ...status, status: 'idle' });
          }
          return next;
        });
      }, 5000);
    }
  };

  // Helper function to get connection icon
  const getConnectionIcon = (config: ImportConfigResponse) => {
    const type = config.connection_type?.toLowerCase();
    if (type === 'ftp' || type === 'sftp') {
      return <Globe className="h-5 w-5" />;
    }
    return <Database className="h-5 w-5" />;
  };

  // Helper function to get status
  const getConfigStatus = (config: ImportConfigResponse): {
    status: 'active' | 'warning' | 'error' | 'paused';
    label: string;
    className: string;
  } => {
    const syncStatus = syncStatuses.get(config.id);
    
    // Check for errors
    if (!config.fieldMappings || config.fieldMappings.length === 0) {
      return {
        status: 'error',
        label: 'Error',
        className: 'bg-red-500 hover:bg-red-600'
      };
    }
    
    // Check if paused/inactive
    if (!config.is_active) {
      return {
        status: 'paused',
        label: 'Paused',
        className: 'bg-gray-400 hover:bg-gray-500'
      };
    }
    
    // Check for warnings (manual or no recent sync)
    if (config.frequency === 'manual') {
      return {
        status: 'warning',
        label: 'Warning',
        className: 'bg-yellow-500 hover:bg-yellow-600'
      };
    }
    
    // Active
    return {
      status: 'active',
      label: 'Active',
      className: 'bg-green-500 hover:bg-green-600'
    };
  };

  // Helper function to format sync frequency
  const formatSyncFrequency = (frequency: string): string => {
    if (frequency === 'manual') return 'Manual';
    if (frequency === 'hourly') return 'Every 1 hour';
    if (frequency === 'daily') return 'Daily';
    if (frequency === 'weekly') return 'Weekly';
    if (frequency === 'monthly') return 'Monthly';
    return frequency;
  };

  // Helper function to format last sync time
  const formatLastSync = (config: ImportConfigResponse): string => {
    const syncStatus = syncStatuses.get(config.id);
    if (syncStatus?.last_sync) {
      return formatDistanceToNow(new Date(syncStatus.last_sync), { addSuffix: true });
    }
    if (config.updated_at) {
      return formatDistanceToNow(new Date(config.updated_at), { addSuffix: true });
    }
    return 'Never';
  };

  // Filter configs based on search and filters
  const getFilteredConfigs = () => {
    return configs.filter(config => {
      // Search filter
      const matchesSearch = !searchQuery || 
        config.config_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        config.host_url.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Status filter
      const status = getConfigStatus(config).status;
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      
      // Type filter
      const matchesType = typeFilter === 'all' || config.connection_type === typeFilter;
      
      return matchesSearch && matchesStatus && matchesType;
    });
  };

  // Handle row selection
  const toggleRowSelection = (configId: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(configId)) {
        newSet.delete(configId);
      } else {
        newSet.add(configId);
      }
      return newSet;
    });
  };

  // Handle select all
  const toggleSelectAll = () => {
    const filteredConfigs = getFilteredConfigs();
    if (selectedRows.size === filteredConfigs.length && filteredConfigs.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredConfigs.map(c => c.id)));
    }
  };

  // Handle view details
  const handleViewDetails = (config: ImportConfigResponse) => {
    setViewDetailsConfig(config);
    setShowDetailsModal(true);
  };

  // Render configuration list for FTP/SFTP tab
  const renderConfigurationList = () => {
    const filteredConfigs = getFilteredConfigs();
    const allSelected = filteredConfigs.length > 0 && selectedRows.size === filteredConfigs.length;

    if (isLoadingConfigs) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin sm:h-6 sm:w-6" />
            <span className="text-sm text-muted-foreground sm:text-base">Loading configurations...</span>
          </CardContent>
        </Card>
      );
    }

    if (configs.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-4 py-8 sm:px-6">
            <Database className="mb-4 h-10 w-10 text-muted-foreground sm:h-12 sm:w-12" />
            <h3 className="mb-2 text-center text-base font-semibold sm:text-lg">No Import Configurations</h3>
            <p className="mb-4 max-w-md text-center text-sm text-muted-foreground sm:text-base">
              Create your first import configuration to start importing data from external systems.
            </p>
            <Button onClick={() => {
              setEditModalConfig({} as ImportConfigResponse);
              setShowEditModal(true);
            }} className="w-full text-sm sm:w-auto sm:text-base">
              Create Configuration
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Search and Filters Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search connections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Type: All</SelectItem>
                <SelectItem value="ftp">FTP</SelectItem>
                <SelectItem value="sftp">SFTP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Selected ({selectedRows.size})
            </span>
            <Button variant="outline" size="sm" disabled={selectedRows.size === 0}>
              Bulk Actions
            </Button>
            <Button size="sm" onClick={() => {
              setEditModalConfig({} as ImportConfigResponse);
              setShowEditModal(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add New Connection
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="font-semibold">SOURCE NAME & TYPE</TableHead>
                <TableHead className="font-semibold">STATUS</TableHead>
                <TableHead className="font-semibold">SYNC FREQUENCY</TableHead>
                <TableHead className="font-semibold">LAST SYNC</TableHead>
                <TableHead className="font-semibold">TOTAL ITEMS</TableHead>
                <TableHead className="font-semibold text-right">QUICK ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConfigs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Database className="mb-2 h-8 w-8" />
                      <span>No configurations found</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredConfigs.map((config) => {
                  const status = getConfigStatus(config);
                  const syncStatus = syncStatuses.get(config.id);
                  const isRowSelected = selectedRows.has(config.id);
                  const isSyncing = syncStatus?.status === 'running';

                  return (
                    <TableRow 
                      key={config.id} 
                      className={`hover:bg-muted/50 ${isRowSelected ? 'bg-muted/30' : ''}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isRowSelected}
                          onCheckedChange={() => toggleRowSelection(config.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            status.status === 'active' ? 'bg-blue-50 text-blue-600' :
                            status.status === 'warning' ? 'bg-yellow-50 text-yellow-600' :
                            status.status === 'error' ? 'bg-red-50 text-red-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {getConnectionIcon(config)}
                          </div>
                          <div>
                            <div className="font-semibold">{config.config_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {config.connection_type?.toUpperCase()} Connection
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={status.className}>
                          <div className="mr-1.5 h-2 w-2 rounded-full bg-white" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatSyncFrequency(config.frequency)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatLastSync(config)}
                      </TableCell>
                      <TableCell>
                        <span className="text-lg font-semibold">
                          {syncStatus?.records_imported?.toLocaleString() || config.fieldMappings?.length || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleConfigEdit(config)}
                            title="Edit Configuration"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleViewDetails(config)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleQuickSync(config.id)}
                            disabled={!config.fieldMappings || config.fieldMappings.length === 0 || isSyncing}
                            title="Sync Now"
                          >
                            {isSyncing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {filteredConfigs.length} of {configs.length} entries
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto space-y-5 px-4 py-6 sm:space-y-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Data Import
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Import vehicle data from CSV files or external systems via FTP/SFTP
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1">
            <TabsTrigger value="csv-upload" className="flex items-center gap-1.5 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
              <Upload className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="truncate">
                <span className="sm:hidden">CSV Upload</span>
                <span className="hidden sm:inline">Direct CSV Upload</span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="ftp-sftp" className="flex items-center gap-1.5 px-2 py-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
              <Settings className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span className="truncate">
                <span className="sm:hidden">FTP/SFTP</span>
                <span className="hidden sm:inline">FTP/SFTP Import</span>
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="csv-upload" className="mt-4 space-y-4 sm:mt-6">
            <div className="space-y-3 sm:space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Direct CSV Upload</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload CSV files directly and map fields to your database
                </p>
              </div>
              <CSVUploadWithMapping />
            </div>
          </TabsContent>

          <TabsContent value="ftp-sftp" className="mt-4 space-y-4 sm:mt-6">
            <div className="space-y-3 sm:space-y-4">
              {/* Avoid stacking two large titles + actions when ImportConfiguration is shown */}
              {!selectedConfig && (
                <div>
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">FTP/SFTP Import Configuration</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Configure automated imports from external systems
                  </p>
                </div>
              )}
              
              {/* Show configuration list when no config is selected */}
              {!selectedConfig && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold sm:text-lg">Import Configurations</h3>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        Manage your automated import configurations
                      </p>
                    </div>
                    <Button
                      onClick={() => setSelectedConfig({} as ImportConfigResponse)}
                      className="flex w-full items-center justify-center gap-2 sm:w-auto"
                      size="sm"
                    >
                      <Settings className="h-4 w-4" />
                      New Configuration
                    </Button>
                  </div>
                  {renderConfigurationList()}
                </div>
              )}

              {/* Selected Configuration Info */}
              {selectedConfig && (
                <Card className="mb-4 border-primary/20 bg-primary/10 sm:mb-6">
                  <CardHeader className="space-y-2 p-4 sm:p-6">
                    <CardTitle className="flex items-start gap-2 text-lg font-semibold leading-snug sm:text-xl">
                      <Settings className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />
                      <span>
                        Editing: {selectedConfig.config_name || 'New Configuration'}
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {selectedConfig.config_name ? 'Configuration loaded for editing. All tabs will be populated with this configuration\'s data.' : 'Creating a new import configuration.'}
                    </CardDescription>
                  </CardHeader>
                  {selectedConfig.config_name && (
                    <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                      <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 sm:gap-4 sm:text-sm">
                        <div className="break-words">
                          <span className="font-medium">Connection:</span> {selectedConfig.connection_type?.toUpperCase()} - {selectedConfig.host_url}
                        </div>
                        <div>
                          <span className="font-medium">File Type:</span> {selectedConfig.file_type?.toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium">Field Mappings:</span> {selectedConfig.fieldMappings?.length || 0} configured
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">Status:</span>
                          <Badge variant={selectedConfig.fieldMappings && selectedConfig.fieldMappings.length > 0 ? "default" : "destructive"} className="text-xs">
                            {selectedConfig.fieldMappings && selectedConfig.fieldMappings.length > 0 ? "Ready" : "Needs Setup"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
              
              {/* Show ImportConfiguration component when a config is selected */}
              {selectedConfig && (
                <ImportConfiguration 
                  onEditConfig={handleEditConfig} 
                  onCancel={handleEditComplete}
                  preloadedConfig={selectedConfig.config_name ? selectedConfig : null}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* View Details Modal */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Connection Details
              </DialogTitle>
              <DialogDescription>
                Detailed information about this import configuration
              </DialogDescription>
            </DialogHeader>

            {viewDetailsConfig && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="mb-3 font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Configuration Name:</span>
                      <p className="font-medium">{viewDetailsConfig.config_name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div className="mt-1">
                        <Badge className={getConfigStatus(viewDetailsConfig).className}>
                          {getConfigStatus(viewDetailsConfig).label}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Connection Type:</span>
                      <p className="font-medium">{viewDetailsConfig.connection_type?.toUpperCase()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sync Frequency:</span>
                      <p className="font-medium">{formatSyncFrequency(viewDetailsConfig.frequency)}</p>
                    </div>
                  </div>
                </div>

                {/* Connection Details */}
                <div>
                  <h3 className="mb-3 font-semibold">Connection Settings</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Host URL:</span>
                      <p className="font-medium break-all">{viewDetailsConfig.host_url}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Port:</span>
                      <p className="font-medium">{viewDetailsConfig.port}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Username:</span>
                      <p className="font-medium">{viewDetailsConfig.username}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Remote Directory:</span>
                      <p className="font-medium break-all">{viewDetailsConfig.remote_directory}</p>
                    </div>
                  </div>
                </div>

                {/* File Settings */}
                <div>
                  <h3 className="mb-3 font-semibold">File Settings</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">File Type:</span>
                      <p className="font-medium">{viewDetailsConfig.file_type?.toUpperCase()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">File Pattern:</span>
                      <p className="font-medium">{viewDetailsConfig.file_pattern}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Delimiter:</span>
                      <p className="font-medium">{viewDetailsConfig.delimiter === ',' ? 'Comma' : viewDetailsConfig.delimiter}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Has Header:</span>
                      <p className="font-medium">{viewDetailsConfig.has_header ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Encoding:</span>
                      <p className="font-medium">{viewDetailsConfig.encoding}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date Format:</span>
                      <p className="font-medium">{viewDetailsConfig.date_format}</p>
                    </div>
                  </div>
                </div>

                {/* Selected Files */}
                {viewDetailsConfig.selected_files && viewDetailsConfig.selected_files.length > 0 && (
                  <div>
                    <h3 className="mb-3 font-semibold">Selected Files</h3>
                    <div className="flex flex-wrap gap-2">
                      {viewDetailsConfig.selected_files.map((file, index) => (
                        <Badge key={index} variant="outline">
                          {file}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field Mappings */}
                <div>
                  <h3 className="mb-3 font-semibold">
                    Field Mappings ({viewDetailsConfig.fieldMappings?.length || 0})
                  </h3>
                  {viewDetailsConfig.fieldMappings && viewDetailsConfig.fieldMappings.length > 0 ? (
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Source Field</TableHead>
                            <TableHead>Target Field</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Required</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewDetailsConfig.fieldMappings.slice(0, 10).map((mapping, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{mapping.source_field}</TableCell>
                              <TableCell>{mapping.target_field}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{mapping.field_type}</Badge>
                              </TableCell>
                              <TableCell>
                                {mapping.is_required ? (
                                  <Badge variant="destructive">Required</Badge>
                                ) : (
                                  <Badge variant="outline">Optional</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {viewDetailsConfig.fieldMappings.length > 10 && (
                        <div className="border-t p-2 text-center text-sm text-muted-foreground">
                          +{viewDetailsConfig.fieldMappings.length - 10} more mappings
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No field mappings configured</p>
                  )}
                </div>

                {/* Processing Settings */}
                <div>
                  <h3 className="mb-3 font-semibold">Processing Settings</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Duplicate Handling:</span>
                      <p className="font-medium capitalize">{viewDetailsConfig.duplicate_handling}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Batch Size:</span>
                      <p className="font-medium">{viewDetailsConfig.batch_size}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max Errors:</span>
                      <p className="font-medium">{viewDetailsConfig.max_errors}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Validate Data:</span>
                      <p className="font-medium">{viewDetailsConfig.validate_data ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <p className="font-medium">{new Date(viewDetailsConfig.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Updated:</span>
                      <p className="font-medium">{new Date(viewDetailsConfig.updated_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleConfigEdit(viewDetailsConfig);
                    }}
                    className="flex-1"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Edit Configuration
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleTestConnection(viewDetailsConfig.id)}
                    disabled={testingConnection.has(viewDetailsConfig.id)}
                  >
                    {testingConnection.has(viewDetailsConfig.id) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Database className="mr-2 h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Configuration Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {editModalConfig?.config_name ? `Edit: ${editModalConfig.config_name}` : 'New Configuration'}
              </DialogTitle>
              <DialogDescription>
                Configure import settings, field mappings, and sync schedule
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              {editModalConfig && (
                <ImportConfiguration 
                  onEditConfig={handleEditConfig} 
                  onCancel={handleEditModalClose}
                  preloadedConfig={editModalConfig.config_name ? editModalConfig : null}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Import; 
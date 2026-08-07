import React, { useState, useEffect } from 'react';
import ImportConfiguration from '../components/import/ImportConfiguration';
import CSVUploadWithMapping from '../components/import/CSVUploadWithMapping';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Settings, Database, Loader2, RefreshCw, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { buildApiUrl } from '../lib/config';

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
    setActiveTab("ftp-sftp"); // Stay on FTP/SFTP tab to show the loaded configuration
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

  // Render configuration list for FTP/SFTP tab
  const renderConfigurationList = () => {
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
            <Button onClick={() => setActiveTab('ftp-sftp')} className="w-full text-sm sm:w-auto sm:text-base">
              Create Configuration
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4">
        {configs.map((config) => (
          <Card key={config.id} className={`cursor-pointer transition-all hover:shadow-md ${selectedConfig?.id === config.id ? 'ring-2 ring-primary bg-primary/10' : ''}`}>
            <CardHeader className="space-y-2 p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg font-semibold leading-snug sm:text-xl">
                    {config.config_name}
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs sm:text-sm">
                    {config.connection_type?.toUpperCase()} - {config.host_url}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={config.frequency === 'manual' ? 'secondary' : 'default'} className="text-xs">
                    {config.frequency}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 sm:h-9 sm:px-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfigEdit(config);
                    }}
                  >
                    <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3 sm:gap-4 sm:text-sm">
                <div className="break-words">
                  <span className="font-medium">File Type:</span> {config.file_type?.toUpperCase()}
                </div>
                <div className="break-all sm:break-words">
                  <span className="font-medium">Pattern:</span> {config.file_pattern}
                </div>
                <div className="break-words">
                  <span className="font-medium">Duplicates:</span> {config.duplicate_handling}
                </div>
              </div>

              {/* File Match Keyword Display */}
              {config.file_match_keyword && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <span className="text-xs font-medium text-green-900 sm:text-sm">Smart File Matching Active</span>
                      <p className="text-[11px] text-green-700 mt-1">
                        Automatically uses latest file containing: <strong>"{config.file_match_keyword}"</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Available Files Section */}
              {config.selected_files && config.selected_files.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-blue-600 sm:h-4 sm:w-4" />
                    <span className="text-xs font-medium text-blue-900 sm:text-sm">Selected Files</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {config.selected_files.slice(0, 3).map((file, index) => (
                      <Badge key={index} variant="outline" className="text-xs bg-white">
                        {file}
                      </Badge>
                    ))}
                    {config.selected_files.length > 3 && (
                      <Badge variant="outline" className="text-xs bg-white">
                        +{config.selected_files.length - 3} more
                      </Badge>
                    )}
                  </div>
                  {config.last_file_scan && (
                    <div className="mt-1 text-[11px] text-blue-700">
                      Last scanned: {new Date(config.last_file_scan).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
              
              {/* Field Mappings Status */}
              <div className="rounded-lg border p-3 sm:mt-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                    <span className="text-xs font-medium sm:text-sm">Field Mappings</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {config.fieldMappings && config.fieldMappings.length > 0 ? (
                      <>
                        <Badge variant="default" className="text-xs">
                          {config.fieldMappings.length} mappings
                        </Badge>
                        <Badge variant="outline" className="text-xs text-green-600">
                          Ready
                        </Badge>
                      </>
                    ) : (
                      <>
                        <Badge variant="destructive" className="text-xs">
                          No mappings
                        </Badge>
                        <Badge variant="outline" className="text-xs text-red-600">
                          Not Ready
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
                
                {config.fieldMappings && config.fieldMappings.length > 0 && (
                  <div className="mt-2">
                    <div className="mb-1 text-[11px] text-gray-600 sm:text-xs">
                      Required fields: {config.fieldMappings.filter(fm => fm.is_required).length} of {config.fieldMappings.length}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {config.fieldMappings.slice(0, 5).map((mapping, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {mapping.source_field} → {mapping.target_field}
                        </Badge>
                      ))}
                      {config.fieldMappings.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{config.fieldMappings.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                
                {(!config.fieldMappings || config.fieldMappings.length === 0) && (
                  <div className="mt-2 rounded border border-yellow-200 bg-yellow-50 p-2">
                    <p className="text-[11px] leading-relaxed text-yellow-800 sm:text-xs">
                      No field mappings configured. Edit this configuration to add field mappings before importing.
                    </p>
                  </div>
                )}
              </div>

              {/* Sync Status */}
              {syncStatuses.get(config.id) && syncStatuses.get(config.id)?.status !== 'idle' && (
                <div className={`rounded-lg border p-3 ${
                  syncStatuses.get(config.id)?.status === 'success' ? 'border-green-200 bg-green-50' :
                  syncStatuses.get(config.id)?.status === 'error' ? 'border-red-200 bg-red-50' :
                  'border-blue-200 bg-blue-50'
                }`}>
                  <div className="flex items-center gap-2">
                    {syncStatuses.get(config.id)?.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                    {syncStatuses.get(config.id)?.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {syncStatuses.get(config.id)?.status === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                    <span className="text-xs font-medium">{syncStatuses.get(config.id)?.message}</span>
                  </div>
                  {syncStatuses.get(config.id)?.records_imported !== undefined && (
                    <div className="mt-1 text-[11px] text-gray-600">
                      Records imported: {syncStatuses.get(config.id)?.records_imported}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Action Buttons */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickSync(config.id);
                  }}
                  disabled={!config.fieldMappings || config.fieldMappings.length === 0 || syncStatuses.get(config.id)?.status === 'running'}
                  className="flex-1"
                >
                  {syncStatuses.get(config.id)?.status === 'running' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Now
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTestConnection(config.id);
                  }}
                  disabled={testingConnection.has(config.id)}
                >
                  {testingConnection.has(config.id) ? (
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
            </CardContent>
          </Card>
        ))}
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
      </div>
    </div>
  );
};

export default Import; 
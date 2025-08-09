import React, { useState, useEffect } from 'react';
import ImportConfiguration from '../components/import/ImportConfiguration';
import CSVUploadWithMapping from '../components/import/CSVUploadWithMapping';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Settings, Database, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

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
  file_type: 'csv' | 'xml' | 'json';
  delimiter: string;
  has_header: boolean;
  encoding: string;
  date_format: string;
  frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'monthly';
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

  // Load configurations when FTP/SFTP tab is active
  const loadConfigs = async () => {
    try {
      setIsLoadingConfigs(true);
      console.log('=== LOADING CONFIGS FROM IMPORT PAGE ===');
      
      const response = await fetch('http://localhost:3000/api/import/configs', {
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
      
      const response = await fetch(`http://localhost:3000/api/import/configs/${configId}`, {
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

  // Render configuration list for FTP/SFTP tab
  const renderConfigurationList = () => {
    if (isLoadingConfigs) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading configurations...</span>
          </CardContent>
        </Card>
      );
    }

    if (configs.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Database className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Import Configurations</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first import configuration to start importing data from external systems.
            </p>
            <Button onClick={() => setActiveTab('ftp-sftp')}>
              Create Configuration
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4">
        {configs.map((config) => (
          <Card key={config.id} className={`cursor-pointer transition-all hover:shadow-md ${selectedConfig?.id === config.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{config.config_name}</CardTitle>
                  <CardDescription>
                    {config.connection_type?.toUpperCase()} - {config.host_url}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant={config.frequency === 'manual' ? 'secondary' : 'default'}>
                    {config.frequency}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfigEdit(config);
                    }}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">File Type:</span> {config.file_type?.toUpperCase()}
                </div>
                <div>
                  <span className="font-medium">Pattern:</span> {config.file_pattern}
                </div>
                <div>
                  <span className="font-medium">Duplicates:</span> {config.duplicate_handling}
                </div>
              </div>
              
              {/* Field Mappings Status */}
              <div className="mt-4 p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4" />
                    <span className="font-medium text-sm">Field Mappings</span>
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
                    <div className="text-xs text-gray-600 mb-1">
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
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs text-yellow-800">
                      ⚠️ No field mappings configured. Edit this configuration to add field mappings before importing.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Data Import</h1>
            <p className="text-muted-foreground">
              Import vehicle data from CSV files or external systems via FTP/SFTP
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="csv-upload" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Direct CSV Upload</span>
            </TabsTrigger>
            <TabsTrigger value="ftp-sftp" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>FTP/SFTP Import</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="csv-upload" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">Direct CSV Upload</h2>
                <p className="text-muted-foreground">
                  Upload CSV files directly and map fields to your database
                </p>
              </div>
              <CSVUploadWithMapping />
            </div>
          </TabsContent>

          <TabsContent value="ftp-sftp" className="space-y-4">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">FTP/SFTP Import Configuration</h2>
                <p className="text-muted-foreground">
                  Configure automated imports from external systems
                </p>
              </div>
              
              {/* Show configuration list when no config is selected */}
              {!selectedConfig && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold">Import Configurations</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage your automated import configurations
                      </p>
                    </div>
                    <Button onClick={() => setSelectedConfig({} as ImportConfigResponse)} className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      New Configuration
                    </Button>
                  </div>
                  {renderConfigurationList()}
                </div>
              )}

              {/* Selected Configuration Info */}
              {selectedConfig && (
                <Card className="mb-6 border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Settings className="w-5 h-5 text-blue-600" />
                      <span>Editing Configuration: {selectedConfig.config_name || 'New Configuration'}</span>
                    </CardTitle>
                    <CardDescription>
                      {selectedConfig.config_name ? 'Configuration loaded for editing. All tabs will be populated with this configuration\'s data.' : 'Creating a new import configuration.'}
                    </CardDescription>
                  </CardHeader>
                  {selectedConfig.config_name && (
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Connection:</span> {selectedConfig.connection_type?.toUpperCase()} - {selectedConfig.host_url}
                        </div>
                        <div>
                          <span className="font-medium">File Type:</span> {selectedConfig.file_type?.toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium">Field Mappings:</span> {selectedConfig.fieldMappings?.length || 0} configured
                        </div>
                        <div>
                          <span className="font-medium">Status:</span> 
                          <Badge variant={selectedConfig.fieldMappings && selectedConfig.fieldMappings.length > 0 ? "default" : "destructive"} className="ml-2">
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
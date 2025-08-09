import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { useToast } from '../../hooks/use-toast';
import { Loader2, Upload, Download, Settings, Clock, FileText, Database, Globe, Edit, Trash2 } from 'lucide-react';

// Interface for the API response (snake_case)
interface ETLConfigResponse {
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
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  time_hour: number;
  time_minute: number;
  day_of_week?: number;
  day_of_month?: number;
  file_type: 'csv' | 'txt' | 'xml' | 'json';
  delimiter: string;
  multi_value_delimiter: string;
  include_header: boolean;
  naming_pattern: string;
  include_timestamp: boolean;
  company_name: string;
  company_id?: string;
}

// Interface for the form (camelCase)
interface ETLConfig {
  id?: number;
  configName: string;
  connection: {
    type: 'ftp' | 'sftp';
    hostUrl: string;
    port: number;
    username: string;
    password: string;
    remoteDirectory: string;
  };
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
    timeHour: number;
    timeMinute: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  fileFormat: {
    fileType: 'csv' | 'txt' | 'xml' | 'json';
    delimiter: string;
    multiValueDelimiter: string;
    includeHeader: boolean;
    encoding: string;
  };
  fileNaming: {
    pattern: string;
    includeTimestamp: boolean;
    timestampFormat: string;
  };
  fieldMappings: Array<{
    sourceField: string;
    targetField: string;
    fieldOrder: number;
    isRequired: boolean;
    defaultValue?: string;
  }>;
  company: {
    name: string;
    id?: string;
    authorizationDocumentUrl?: string;
    dealerAuthorizationRequired: boolean;
  };
}

const ETLConfiguration: React.FC = () => {
  const [configs, setConfigs] = useState<ETLConfigResponse[]>([]);
  const [currentConfig, setCurrentConfig] = useState<ETLConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadConfigs();
    loadAvailableFields();
  }, []);

  const loadConfigs = async () => {
    try {
      setIsLoading(true);
      console.log('🔍 Loading ETL configs...');
      
      const response = await fetch('/api/etl/configs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API Response:', data);
        console.log('Configs to set:', data.data);
        setConfigs(data.data || []);
      } else {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        toast({
          title: "Error",
          description: "Failed to load ETL configurations",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading ETL configs:', error);
      toast({
        title: "Error",
        description: "Failed to load ETL configurations",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableFields = async () => {
    try {
      const response = await fetch('/api/etl/field-mappings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableFields(data.data || []);
      }
    } catch (error) {
      console.error('Error loading field mappings:', error);
    }
  };

  const createNewConfig = () => {
    const newConfig: ETLConfig = {
      configName: '',
      connection: {
        type: 'ftp',
        hostUrl: '',
        port: 21,
        username: '',
        password: '',
        remoteDirectory: '/'
      },
      schedule: {
        frequency: 'daily',
        timeHour: 1,
        timeMinute: 0
      },
      fileFormat: {
        fileType: 'csv',
        delimiter: ',',
        multiValueDelimiter: '|',
        includeHeader: true,
        encoding: 'UTF-8'
      },
      fileNaming: {
        pattern: '{dealer_id}_{date}_{timestamp}',
        includeTimestamp: true,
        timestampFormat: 'YYYYMMDD_HHMMSS'
      },
      fieldMappings: [],
      company: {
        name: '',
        dealerAuthorizationRequired: true
      }
    };
    setCurrentConfig(newConfig);
  };

  const saveConfig = async () => {
    if (!currentConfig) return;

    try {
      setIsLoading(true);
      
      // Determine if this is a new config or an update
      const isUpdate = currentConfig.id !== undefined;
      const url = isUpdate ? `/api/etl/configs/${currentConfig.id}` : '/api/etl/configs';
      const method = isUpdate ? 'PUT' : 'POST';
      
      console.log('Sending config data:', currentConfig);
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(currentConfig)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: isUpdate ? "ETL configuration updated successfully" : "ETL configuration created successfully"
        });
        loadConfigs();
        setCurrentConfig(null);
      } else {
        const error = await response.json();
        console.error('Save config error response:', error);
        toast({
          title: "Error",
          description: error.error || "Failed to save configuration",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    if (!currentConfig?.connection) return;

    try {
      setIsTestingConnection(true);
      
      // Convert camelCase to the format expected by the backend
      const connectionData = {
        connectionType: currentConfig.connection.type,
        hostUrl: currentConfig.connection.hostUrl,
        port: currentConfig.connection.port,
        username: currentConfig.connection.username,
        password: currentConfig.connection.password,
        remoteDirectory: currentConfig.connection.remoteDirectory
      };
      
      console.log('Sending connection data:', connectionData);
      
      const response = await fetch('/api/etl/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(connectionData)
      });

      const result = await response.json();
      console.log('Test connection response:', result);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Connection test successful"
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Connection test failed",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast({
        title: "Error",
        description: "Failed to test connection",
        variant: "destructive"
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const editConfig = (config: ETLConfigResponse) => {
    // Convert API response format to form format
    const formConfig: ETLConfig = {
      id: config.id,
      configName: config.config_name,
      connection: {
        type: config.connection_type,
        hostUrl: config.host_url,
        port: config.port,
        username: config.username,
        password: '', // Password is not returned from API for security
        remoteDirectory: config.remote_directory,
      },
      schedule: {
        frequency: config.frequency,
        timeHour: config.time_hour,
        timeMinute: config.time_minute,
        dayOfWeek: config.day_of_week,
        dayOfMonth: config.day_of_month,
      },
      fileFormat: {
        fileType: config.file_type,
        delimiter: config.delimiter,
        multiValueDelimiter: config.multi_value_delimiter,
        includeHeader: config.include_header,
        encoding: 'utf-8',
      },
      fileNaming: {
        pattern: config.naming_pattern,
        includeTimestamp: config.include_timestamp,
        timestampFormat: 'YYYY-MM-DD_HH-mm-ss',
      },
      fieldMappings: [], // Will be loaded separately
      company: {
        name: config.company_name,
        id: config.company_id,
        authorizationDocumentUrl: '',
        dealerAuthorizationRequired: false,
      },
    };
    setCurrentConfig(formConfig);
  };

  const deleteConfig = async (configId: number) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/etl/configs/${configId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Configuration deleted successfully"
        });
        loadConfigs(); // Reload the list
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete configuration",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      toast({
        title: "Error",
        description: "Failed to delete configuration",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ETL Configuration</h1>
          <p className="text-muted-foreground">
            Configure automated exports to external systems via FTP/SFTP
          </p>
        </div>
        <Button onClick={createNewConfig} className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          New Configuration
        </Button>
      </div>

      {currentConfig ? (
        <Card>
          <CardHeader>
            <CardTitle>ETL Configuration</CardTitle>
            <CardDescription>
              Configure export settings for external systems
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="connection" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="connection">Connection</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="format">File Format</TabsTrigger>
                <TabsTrigger value="fields">Fields</TabsTrigger>
                <TabsTrigger value="company">Company</TabsTrigger>
                <TabsTrigger value="test">Test</TabsTrigger>
              </TabsList>

              <TabsContent value="connection" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="configName">Configuration Name</Label>
                    <Input
                      id="configName"
                      value={currentConfig.configName}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        configName: e.target.value
                      })}
                      placeholder="e.g., vAuto Export"
                    />
                  </div>
                  <div>
                    <Label htmlFor="connectionType">Connection Type</Label>
                    <Select
                      value={currentConfig.connection.type}
                      onValueChange={(value: 'ftp' | 'sftp') => setCurrentConfig({
                        ...currentConfig,
                        connection: { ...currentConfig.connection, type: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ftp">FTP</SelectItem>
                        <SelectItem value="sftp">SFTP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hostUrl">Host URL</Label>
                    <Input
                      id="hostUrl"
                      value={currentConfig.connection.hostUrl}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        connection: { ...currentConfig.connection, hostUrl: e.target.value }
                      })}
                      placeholder="ftp.example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={currentConfig.connection.port}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        connection: { ...currentConfig.connection, port: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={currentConfig.connection.username}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        connection: { ...currentConfig.connection, username: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={currentConfig.connection.password}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        connection: { ...currentConfig.connection, password: e.target.value }
                      })}
                      placeholder={currentConfig.id ? "Leave blank to keep current password" : "Enter password"}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="remoteDirectory">Remote Directory</Label>
                  <Input
                    id="remoteDirectory"
                    value={currentConfig.connection.remoteDirectory}
                    onChange={(e) => setCurrentConfig({
                      ...currentConfig,
                      connection: { ...currentConfig.connection, remoteDirectory: e.target.value }
                    })}
                    placeholder="/exports"
                  />
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select
                      value={currentConfig.schedule.frequency}
                      onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'custom') => setCurrentConfig({
                        ...currentConfig,
                        schedule: { ...currentConfig.schedule, frequency: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="time">Time</Label>
                    <div className="flex gap-2">
                      <Select
                        value={currentConfig.schedule.timeHour.toString()}
                        onValueChange={(value) => setCurrentConfig({
                          ...currentConfig,
                          schedule: { ...currentConfig.schedule, timeHour: parseInt(value) }
                        })}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="flex items-center">:</span>
                      <Select
                        value={currentConfig.schedule.timeMinute.toString()}
                        onValueChange={(value) => setCurrentConfig({
                          ...currentConfig,
                          schedule: { ...currentConfig.schedule, timeMinute: parseInt(value) }
                        })}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 60 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="format" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fileType">File Type</Label>
                    <Select
                      value={currentConfig.fileFormat.fileType}
                      onValueChange={(value: 'csv' | 'txt' | 'xml' | 'json') => setCurrentConfig({
                        ...currentConfig,
                        fileFormat: { ...currentConfig.fileFormat, fileType: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="txt">TXT</SelectItem>
                        <SelectItem value="xml">XML</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="delimiter">Delimiter</Label>
                    <Input
                      id="delimiter"
                      value={currentConfig.fileFormat.delimiter}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        fileFormat: { ...currentConfig.fileFormat, delimiter: e.target.value }
                      })}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="includeHeader"
                    checked={currentConfig.fileFormat.includeHeader}
                    onCheckedChange={(checked) => setCurrentConfig({
                      ...currentConfig,
                      fileFormat: { ...currentConfig.fileFormat, includeHeader: checked }
                    })}
                  />
                  <Label htmlFor="includeHeader">Include Header Row</Label>
                </div>
              </TabsContent>

              <TabsContent value="company" className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={currentConfig.company.name}
                    onChange={(e) => setCurrentConfig({
                      ...currentConfig,
                      company: { ...currentConfig.company, name: e.target.value }
                    })}
                    placeholder="e.g., vAuto, AutoTrader"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="authorizationRequired"
                    checked={currentConfig.company.dealerAuthorizationRequired}
                    onCheckedChange={(checked) => setCurrentConfig({
                      ...currentConfig,
                      company: { ...currentConfig.company, dealerAuthorizationRequired: checked }
                    })}
                  />
                  <Label htmlFor="authorizationRequired">Require Dealer Authorization</Label>
                </div>
              </TabsContent>

              <TabsContent value="test" className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Test your connection settings before saving the configuration.
                  </AlertDescription>
                </Alert>
                
                <Button 
                  onClick={testConnection} 
                  disabled={isTestingConnection}
                  className="flex items-center gap-2"
                >
                  {isTestingConnection ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                  Test Connection
                </Button>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setCurrentConfig(null)}>
                Cancel
              </Button>
              <Button onClick={saveConfig} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Settings className="w-4 h-4" />
                )}
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {(() => {
            console.log('Rendering configs:', configs);
            console.log('Configs length:', configs.length);
            console.log('Is loading:', isLoading);
            return null;
          })()}
          {configs.map((config) => (
            <Card key={config.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{config.config_name}</CardTitle>
                    <CardDescription>
                      {config.connection_type?.toUpperCase()} - {config.host_url}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={config.frequency === 'daily' ? 'default' : 'secondary'}>
                      {config.frequency}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editConfig(config)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteConfig(config.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Schedule:</span> {config.time_hour}:{config.time_minute?.toString().padStart(2, '0')}
                  </div>
                  <div>
                    <span className="font-medium">Format:</span> {config.file_type?.toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium">Company:</span> {config.company_name}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {configs.length === 0 && !isLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Database className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No ETL Configurations</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first ETL configuration to start exporting data to external systems.
                </p>
                <Button onClick={createNewConfig}>
                  Create Configuration
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default ETLConfiguration; 
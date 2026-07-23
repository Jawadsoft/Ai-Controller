import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  Loader2,
  ArrowRight,
  ArrowLeft,
  Settings,
  FileText,
  Database,
  MapPin
} from 'lucide-react';
import { buildApiUrl } from '@/lib/config';

interface ImportConfig {
  id?: number;
  configName: string;
  connection: {
    type: 'ftp' | 'sftp';
    hostUrl: string;
    port: number;
    username: string;
    password: string;
    remoteDirectory: string;
    filePattern: string;
  };
  fileSettings: {
    fileType: 'csv' | 'xml' | 'json';
    delimiter: string;
    hasHeader: boolean;
    encoding: string;
    dateFormat: string;
  };
  processing: {
    duplicateHandling: 'skip' | 'update' | 'replace';
    batchSize: number;
    maxErrors: number;
    validateData: boolean;
    archiveProcessedFiles: boolean;
    archiveDirectory: string;
  };
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  fieldType: 'string' | 'number' | 'date' | 'boolean' | 'json';
  isRequired: boolean;
  isEnabled: boolean;
  defaultValue?: string;
  transformationRule?: string;
  fieldOrder: number;
}

interface SampleData {
  headers: string[];
  sampleData: any[];
  totalRows: number;
  fileName: string;
}

interface TestResult {
  success: boolean;
  fileName: string;
  localPath: string;
  sampleData: SampleData;
  totalFiles: number;
  allFiles: string[];
}

const ImportWorkflow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<ImportConfig | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dealerId, setDealerId] = useState('');
  const { toast } = useToast();

  // Database fields that are actually available in the import_vehicle_from_csv function
  // Based on the actual database function parameters
  const getDatabaseFields = () => [
    // Required fields
    { value: 'vin', label: 'VIN', type: 'TEXT', required: true, supported: true, description: 'Vehicle Identification Number' },
    { value: 'make', label: 'Make', type: 'TEXT', required: true, supported: true, description: 'Vehicle manufacturer' },
    { value: 'model', label: 'Model', type: 'TEXT', required: true, supported: true, description: 'Vehicle model' },
    { value: 'year', label: 'Year', type: 'INTEGER', required: true, supported: true, description: 'Model year' },
    
    // Optional fields
    { value: 'series', label: 'Series', type: 'TEXT', required: false, supported: true, description: 'Vehicle series/trim' },
    { value: 'stock_number', label: 'Stock Number', type: 'TEXT', required: false, supported: true, description: 'Dealer stock number' },
    { value: 'body_style', label: 'Body Style', type: 'TEXT', required: false, supported: true, description: 'Vehicle body style' },
    { value: 'vehicle_type', label: 'Vehicle Type', type: 'TEXT', required: false, supported: true, description: 'Type of vehicle' },
    { value: 'certified', label: 'Certified', type: 'BOOLEAN', required: false, supported: true, description: 'Certified pre-owned status' },
    { value: 'color', label: 'Color', type: 'TEXT', required: false, supported: true, description: 'Exterior color' },
    { value: 'interior_color', label: 'Interior Color', type: 'TEXT', required: false, supported: true, description: 'Interior color' },
    { value: 'engine_type', label: 'Engine Type', type: 'TEXT', required: false, supported: true, description: 'Engine type/specification' },
    { value: 'displacement', label: 'Displacement', type: 'TEXT', required: false, supported: true, description: 'Engine displacement' },
    { value: 'features', label: 'Features', type: 'TEXT', required: false, supported: true, description: 'Vehicle features and options' },
    { value: 'odometer', label: 'Odometer', type: 'INTEGER', required: false, supported: true, description: 'Mileage reading' },
    { value: 'mileage', label: 'Mileage', type: 'INTEGER', required: false, supported: true, description: 'Alternative field for odometer' },
    { value: 'price', label: 'Price', type: 'DECIMAL', required: false, supported: true, description: 'Selling price' },
    { value: 'other_price', label: 'Other Price', type: 'DECIMAL', required: false, supported: true, description: 'Additional price field' },
    { value: 'transmission', label: 'Transmission', type: 'TEXT', required: false, supported: true, description: 'Transmission type' },
    { value: 'msrp', label: 'MSRP', type: 'DECIMAL', required: false, supported: true, description: 'Manufacturer suggested retail price' },
    { value: 'dealer_discount', label: 'Dealer Discount', type: 'DECIMAL', required: false, supported: true, description: 'Dealer discount amount' },
    { value: 'consumer_rebate', label: 'Consumer Rebate', type: 'DECIMAL', required: false, supported: true, description: 'Consumer rebate amount' },
    { value: 'dealer_accessories', label: 'Dealer Accessories', type: 'DECIMAL', required: false, supported: true, description: 'Dealer accessories cost' },
    { value: 'total_customer_savings', label: 'Total Customer Savings', type: 'DECIMAL', required: false, supported: true, description: 'Total savings for customer' },
    { value: 'total_dealer_rebate', label: 'Total Dealer Rebate', type: 'DECIMAL', required: false, supported: true, description: 'Total dealer rebate' },
    { value: 'photo_url_list', label: 'Photo URL List', type: 'TEXT', required: false, supported: true, description: 'Comma-separated list of photo URLs' },
    { value: 'images', label: 'Images', type: 'TEXT', required: false, supported: true, description: 'Alternative field for photo URLs' },
    { value: 'reference_dealer_id', label: 'Reference Dealer ID', type: 'TEXT', required: false, supported: true, description: 'Original dealer reference' }
  ];

  // Smart mapping function - maps CSV field names to database field names
  const getSmartMapping = (csvField: string): string => {
    const fieldLower = csvField.toLowerCase();
    
    // Required fields - exact matches
    if (fieldLower.includes('vin')) return 'vin';
    if (fieldLower.includes('make')) return 'make';
    if (fieldLower.includes('model')) return 'model';
    if (fieldLower.includes('year')) return 'year';
    
    // Optional fields - more flexible matching
    if (fieldLower.includes('series') || fieldLower.includes('trim')) return 'series';
    if (fieldLower.includes('stock') && fieldLower.includes('number')) return 'stock_number';
    if (fieldLower.includes('stock') && !fieldLower.includes('number')) return 'stock_number';
    if (fieldLower.includes('body') && fieldLower.includes('style')) return 'body_style';
    if (fieldLower.includes('vehicle') && fieldLower.includes('type')) return 'vehicle_type';
    if (fieldLower.includes('certified') || fieldLower.includes('certification')) return 'certified';
    if (fieldLower.includes('color') && !fieldLower.includes('interior')) return 'color';
    if (fieldLower.includes('interior') && fieldLower.includes('color')) return 'interior_color';
    if (fieldLower.includes('engine') && fieldLower.includes('type')) return 'engine_type';
    if (fieldLower.includes('engine') && !fieldLower.includes('type')) return 'engine_type';
    if (fieldLower.includes('displacement') || fieldLower.includes('disp')) return 'displacement';
    if (fieldLower.includes('features') || fieldLower.includes('options') || fieldLower.includes('equipment')) return 'features';
    if (fieldLower.includes('odometer') || fieldLower.includes('mileage') || fieldLower.includes('miles')) return 'odometer';
    if (fieldLower.includes('price') && !fieldLower.includes('msrp') && !fieldLower.includes('other')) return 'price';
    if (fieldLower.includes('other') && fieldLower.includes('price')) return 'other_price';
    if (fieldLower.includes('msrp') || fieldLower.includes('manufacturer') && fieldLower.includes('price')) return 'msrp';
    if (fieldLower.includes('transmission')) return 'transmission';
    if (fieldLower.includes('dealer') && fieldLower.includes('discount')) return 'dealer_discount';
    if (fieldLower.includes('consumer') && fieldLower.includes('rebate')) return 'consumer_rebate';
    if (fieldLower.includes('dealer') && fieldLower.includes('accessories')) return 'dealer_accessories';
    if (fieldLower.includes('total') && fieldLower.includes('customer') && fieldLower.includes('savings')) return 'total_customer_savings';
    if (fieldLower.includes('total') && fieldLower.includes('dealer') && fieldLower.includes('rebate')) return 'total_dealer_rebate';
    if (fieldLower.includes('photo') || fieldLower.includes('image') || fieldLower.includes('picture')) return 'photo_url_list';
    if (fieldLower.includes('reference') && fieldLower.includes('dealer')) return 'reference_dealer_id';
    
    return '';
  };

  // Check if all required fields are mapped
  const areRequiredFieldsMapped = () => {
    const requiredFields = getDatabaseFields().filter(field => field.required);
    return requiredFields.every(requiredField => 
      fieldMappings.some(mapping => 
        mapping.targetField === requiredField.value && 
        mapping.isEnabled
      )
    );
  };

  // Initialize field mappings when sample data is available
  useEffect(() => {
    if (testResult?.sampleData?.headers) {
      const headers = testResult.sampleData.headers;
      const newMappings: FieldMapping[] = headers.map((header, index) => {
        const smartMapping = getSmartMapping(header);
        const dbField = getDatabaseFields().find(f => f.value === smartMapping);
        
        return {
          sourceField: header,
          targetField: smartMapping || '',
          fieldType: dbField?.type?.toLowerCase() as any || 'string',
          isRequired: dbField?.required || false,
          isEnabled: !!smartMapping,
          fieldOrder: index + 1
        };
      });
      
      setFieldMappings(newMappings);
    }
  }, [testResult]);

  // Step 1: Import Configuration
  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Step 1: Import Configuration
        </CardTitle>
        <CardDescription>
          Configure your import settings and test the connection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Connection Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Connection Settings</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="configName">Configuration Name</Label>
                <Input
                  id="configName"
                  value={config?.configName || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev!, configName: e.target.value }))}
                  placeholder="Enter configuration name"
                />
              </div>
              <div>
                <Label htmlFor="connectionType">Connection Type</Label>
                <Select
                  value={config?.connection?.type || 'sftp'}
                  onValueChange={(value) => setConfig(prev => ({ 
                    ...prev!, 
                    connection: { ...prev!.connection, type: value as 'ftp' | 'sftp' }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sftp">SFTP</SelectItem>
                    <SelectItem value="ftp">FTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="hostUrl">Host URL</Label>
                <Input
                  id="hostUrl"
                  value={config?.connection?.hostUrl || ''}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev!, 
                    connection: { ...prev!.connection, hostUrl: e.target.value }
                  }))}
                  placeholder="ftp.example.com"
                />
              </div>
              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={config?.connection?.port || 22}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev!, 
                    connection: { ...prev!.connection, port: parseInt(e.target.value) }
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={config?.connection?.username || ''}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev!, 
                    connection: { ...prev!.connection, username: e.target.value }
                  }))}
                  placeholder="Enter username"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={config?.connection?.password || ''}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev!, 
                    connection: { ...prev!.connection, password: e.target.value }
                  }))}
                  placeholder="Enter password"
                />
              </div>
              <div>
                <Label htmlFor="remoteDirectory">Remote Directory</Label>
                <Input
                  id="remoteDirectory"
                  value={config?.connection?.remoteDirectory || '/'}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev!, 
                    connection: { ...prev!.connection, remoteDirectory: e.target.value }
                  }))}
                  placeholder="/path/to/files"
                />
              </div>
              <div>
                <Label htmlFor="filePattern">File Pattern</Label>
                <Input
                  id="filePattern"
                  value={config?.connection?.filePattern || '*.csv'}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev!, 
                    connection: { ...prev!.connection, filePattern: e.target.value }
                  }))}
                  placeholder="*.csv"
                />
              </div>
            </div>
          </div>

          {/* File Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">File Settings</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="fileType">File Type</Label>
                <Select
                  value={config?.fileSettings?.fileType || 'csv'}
                  onValueChange={(value) => setConfig(prev => ({ 
                    ...prev!, 
                    fileSettings: { ...prev!.fileSettings, fileType: value as 'csv' | 'xml' | 'json' }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="xml">XML</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="delimiter">Delimiter</Label>
                <Input
                  id="delimiter"
                  value={config?.fileSettings?.delimiter || ','}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev!, 
                    fileSettings: { ...prev!.fileSettings, delimiter: e.target.value }
                  }))}
                  placeholder=","
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="hasHeader"
                  checked={config?.fileSettings?.hasHeader !== false}
                  onCheckedChange={(checked) => setConfig(prev => ({ 
                    ...prev!, 
                    fileSettings: { ...prev!.fileSettings, hasHeader: checked }
                  }))}
                />
                <Label htmlFor="hasHeader">Has Header Row</Label>
              </div>
              <div>
                <Label htmlFor="encoding">Encoding</Label>
                <Select
                  value={config?.fileSettings?.encoding || 'UTF-8'}
                  onValueChange={(value) => setConfig(prev => ({ 
                    ...prev!, 
                    fileSettings: { ...prev!.fileSettings, encoding: value }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTF-8">UTF-8</SelectItem>
                    <SelectItem value="ISO-8859-1">ISO-8859-1</SelectItem>
                    <SelectItem value="Windows-1252">Windows-1252</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleTestConnection}
            disabled={!config?.connection?.hostUrl || !config?.connection?.username}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Test Connection & Download Sample
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Step 2: Header Mapping Confirmation
  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Step 2: Header Mapping Confirmation
        </CardTitle>
        <CardDescription>
          Review and confirm field mappings for your data
        </CardDescription>
      </CardHeader>
      <CardContent>
        {testResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Sample File: {testResult.fileName}</h3>
                <p className="text-sm text-gray-600">
                  Total rows: {testResult.sampleData.totalRows} | 
                  Found {testResult.totalFiles} matching files
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview Data
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Field Mappings</h4>
                <div className="text-sm text-gray-600">
                  {fieldMappings.filter(m => m.isEnabled && m.targetField).length} of {fieldMappings.length} fields mapped
                </div>
              </div>
              
              {/* Mapping Summary */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Required Fields:</span>
                    <div className="mt-1">
                      {getDatabaseFields()
                        .filter(field => field.required)
                        .map(field => {
                          const isMapped = fieldMappings.some(m => m.targetField === field.value && m.isEnabled);
                          return (
                            <div key={field.value} className={`flex items-center gap-2 ${isMapped ? 'text-green-600' : 'text-red-600'}`}>
                              <span className={`w-2 h-2 rounded-full ${isMapped ? 'bg-green-500' : 'bg-red-500'}`}></span>
                              <span>{field.label}</span>
                              {isMapped && <span className="text-xs">✓</span>}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Optional Fields:</span>
                    <div className="mt-1">
                      {getDatabaseFields()
                        .filter(field => !field.required)
                        .slice(0, 5)
                        .map(field => {
                          const isMapped = fieldMappings.some(m => m.targetField === field.value && m.isEnabled);
                          return (
                            <div key={field.value} className={`flex items-center gap-2 ${isMapped ? 'text-green-600' : 'text-gray-500'}`}>
                              <span className={`w-2 h-2 rounded-full ${isMapped ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                              <span>{field.label}</span>
                              {isMapped && <span className="text-xs">✓</span>}
                            </div>
                          );
                        })}
                      {getDatabaseFields().filter(field => !field.required).length > 5 && (
                        <div className="text-xs text-gray-500 mt-1">
                          +{getDatabaseFields().filter(field => !field.required).length - 5} more...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Warning for missing required fields */}
              {!areRequiredFieldsMapped() && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Required fields not mapped:</p>
                      <div className="text-sm">
                        {getDatabaseFields()
                          .filter(field => field.required)
                          .filter(requiredField => 
                            !fieldMappings.some(mapping => 
                              mapping.targetField === requiredField.value && 
                              mapping.isEnabled
                            )
                          )
                          .map(field => field.label)
                          .join(', ')}
                      </div>
                      <p className="text-sm text-gray-600">
                        Please map all required fields before proceeding to import.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Field (CSV)</TableHead>
                    <TableHead>Target Field (Database)</TableHead>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldMappings.map((mapping, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{mapping.sourceField}</TableCell>
                      <TableCell>
                        <Select
                          value={mapping.targetField}
                          onValueChange={(value) => {
                            const newMappings = [...fieldMappings];
                            newMappings[index].targetField = value;
                            const dbField = getDatabaseFields().find(f => f.value === value);
                            if (dbField) {
                              newMappings[index].fieldType = dbField.type.toLowerCase() as any;
                              newMappings[index].isRequired = dbField.required;
                            }
                            setFieldMappings(newMappings);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select target field" />
                          </SelectTrigger>
                          <SelectContent className="max-h-96">
                            <SelectItem value="">-- Skip Field --</SelectItem>
                            {/* Required fields first */}
                            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Required Fields
                            </div>
                            {getDatabaseFields()
                              .filter(field => field.required)
                              .map(field => (
                                <SelectItem key={field.value} value={field.value}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{field.label}</span>
                                    <span className="text-xs text-gray-500">{field.description}</span>
                                    <span className="text-xs text-primary">({field.type})</span>
                                  </div>
                                </SelectItem>
                              ))}
                            
                            {/* Optional fields */}
                            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">
                              Optional Fields
                            </div>
                            {getDatabaseFields()
                              .filter(field => !field.required)
                              .map(field => (
                                <SelectItem key={field.value} value={field.value}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{field.label}</span>
                                    <span className="text-xs text-gray-500">{field.description}</span>
                                    <span className="text-xs text-primary">({field.type})</span>
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{mapping.fieldType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={mapping.isRequired ? "destructive" : "secondary"}>
                          {mapping.isRequired ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={mapping.isEnabled}
                          onCheckedChange={(checked) => {
                            const newMappings = [...fieldMappings];
                            newMappings[index].isEnabled = !!checked;
                            setFieldMappings(newMappings);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newMappings = fieldMappings.filter((_, i) => i !== index);
                            setFieldMappings(newMappings);
                          }}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Configuration
              </Button>
              <Button
                onClick={() => setCurrentStep(3)}
                disabled={!areRequiredFieldsMapped()}
                className="flex items-center gap-2"
              >
                Confirm Mappings
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Step 3: Import Execution
  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Step 3: Import Execution
        </CardTitle>
        <CardDescription>
          Execute the import with your confirmed field mappings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Import Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p><strong>File:</strong> {testResult?.fileName}</p>
                <p><strong>Total Rows:</strong> {testResult?.sampleData.totalRows}</p>
                <p><strong>Field Mappings:</strong> {fieldMappings.filter(m => m.isEnabled).length}</p>
              </div>
              <div className="space-y-2">
                <p><strong>Duplicate Handling:</strong> {config?.processing?.duplicateHandling || 'update'}</p>
                <p><strong>Validation:</strong> {config?.processing?.validateData ? 'Enabled' : 'Disabled'}</p>
                <p><strong>Batch Size:</strong> {config?.processing?.batchSize || 1000}</p>
              </div>
            </div>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Importing data...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {importResult && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Import completed successfully!</strong></p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <p>Records Processed: {importResult.recordsProcessed}</p>
                    <p>Records Inserted: {importResult.recordsInserted}</p>
                    <p>Records Updated: {importResult.recordsUpdated}</p>
                    <p>Records Skipped: {importResult.recordsSkipped}</p>
                    <p>Records Failed: {importResult.recordsFailed}</p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Mapping
            </Button>
            <Button
              onClick={handleExecuteImport}
              disabled={loading || !fieldMappings.some(m => m.isEnabled && m.targetField)}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Execute Import
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Test connection and download sample
  const handleTestConnection = async () => {
    if (!config) return;
    
    setLoading(true);
    try {
      const response = await fetch(buildApiUrl('/import/test-connection'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            connection_type: config.connection.type,
            host_url: config.connection.hostUrl,
            port: config.connection.port,
            username: config.connection.username,
            password: config.connection.password,
            remote_directory: config.connection.remoteDirectory,
            file_pattern: config.connection.filePattern,
            file_type: config.fileSettings.fileType,
            delimiter: config.fileSettings.delimiter,
            has_header: config.fileSettings.hasHeader,
            encoding: config.fileSettings.encoding,
            date_format: config.fileSettings.dateFormat
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to test connection');
      }

      const result = await response.json();
      setTestResult(result);
      setCurrentStep(2);
      
      toast({
        title: "Connection successful",
        description: `Found ${result.totalFiles} files matching pattern`,
      });
    } catch (error) {
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Execute import with user-defined mappings
  const handleExecuteImport = async () => {
    if (!config || !testResult) return;
    
    setLoading(true);
    setProgress(0);
    
    try {
      const enabledMappings = fieldMappings.filter(m => m.isEnabled && m.targetField);
      
      const response = await fetch(buildApiUrl('/import/execute-with-mappings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            connection_type: config.connection.type,
            host_url: config.connection.hostUrl,
            port: config.connection.port,
            username: config.connection.username,
            password: config.connection.password,
            remote_directory: config.connection.remoteDirectory,
            file_pattern: config.connection.filePattern,
            file_type: config.fileSettings.fileType,
            delimiter: config.fileSettings.delimiter,
            has_header: config.fileSettings.hasHeader,
            encoding: config.fileSettings.encoding,
            date_format: config.fileSettings.dateFormat,
            duplicate_handling: config.processing.duplicateHandling,
            batch_size: config.processing.batchSize,
            max_errors: config.processing.maxErrors,
            validate_data: config.processing.validateData,
            archive_processed_files: config.processing.archiveProcessedFiles,
            archive_directory: config.processing.archiveDirectory,
            useUserMappings: true,
            userFieldMappings: enabledMappings
          },
          sampleData: testResult.sampleData
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute import');
      }

      const result = await response.json();
      setImportResult(result);
      setProgress(100);
      
      toast({
        title: "Import completed",
        description: `Successfully processed ${result.recordsProcessed} records`,
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Import Workflow</h1>
          <p className="text-gray-600">Test, map, and import your data with confidence</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={currentStep >= 1 ? "default" : "secondary"}>Step 1</Badge>
          <Badge variant={currentStep >= 2 ? "default" : "secondary"}>Step 2</Badge>
          <Badge variant={currentStep >= 3 ? "default" : "secondary"}>Step 3</Badge>
        </div>
      </div>

      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Data Preview</DialogTitle>
          </DialogHeader>
          {testResult && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Showing first 10 rows of {testResult.sampleData.totalRows} total rows
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {testResult.sampleData.headers.map((header, index) => (
                        <TableHead key={index}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testResult.sampleData.sampleData.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {testResult.sampleData.headers.map((header, colIndex) => (
                          <TableCell key={colIndex}>
                            {row[header] || ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImportWorkflow;

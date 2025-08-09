import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  FileText, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  Play,
  Loader2,
  Eye
} from 'lucide-react';

interface CSVData {
  headers: string[];
  sampleData: any[];
  totalRows: number;
  fileName: string;
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

interface ImportResult {
  success: boolean;
  message: string;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const CSVUploadWithMapping: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [dealerId, setDealerId] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Database fields that are supported by the import function
  const getDatabaseFields = () => [
    { value: 'dealer_id', label: 'Dealer ID', type: 'UUID', required: true, supported: true },
    { value: 'vin', label: 'VIN', type: 'TEXT', required: true, supported: true },
    { value: 'make', label: 'Make', type: 'TEXT', required: true, supported: true },
    { value: 'model', label: 'Model', type: 'TEXT', required: true, supported: true },
    { value: 'year', label: 'Year', type: 'INTEGER', required: true, supported: true },
    { value: 'series', label: 'Series', type: 'TEXT', required: false, supported: true },
    { value: 'body_style', label: 'Body Style', type: 'TEXT', required: false, supported: true },
    { value: 'color', label: 'Color', type: 'TEXT', required: false, supported: true },
    { value: 'interior_color', label: 'Interior Color', type: 'TEXT', required: false, supported: true },
    { value: 'odometer', label: 'Odometer', type: 'INTEGER', required: false, supported: true },
    { value: 'mileage', label: 'Mileage', type: 'DECIMAL', required: false, supported: true },
    { value: 'price', label: 'Price', type: 'DECIMAL', required: false, supported: true },
    { value: 'other_price', label: 'Other Price', type: 'DECIMAL', required: false, supported: true },
    { value: 'msrp', label: 'MSRP', type: 'DECIMAL', required: false, supported: true },
    { value: 'features', label: 'Features', type: 'TEXT', required: false, supported: true },
    { value: 'photo_url_list', label: 'Photo URL List', type: 'TEXT', required: false, supported: true },
    { value: 'reference_dealer_id', label: 'Reference Dealer ID', type: 'TEXT', required: false, supported: true },
    { value: 'stock_number', label: 'Stock Number', type: 'TEXT', required: false, supported: true },
    { value: 'certified', label: 'Certified', type: 'BOOLEAN', required: false, supported: true },
    { value: 'engine_type', label: 'Engine Type', type: 'TEXT', required: false, supported: true },
    { value: 'displacement', label: 'Displacement', type: 'TEXT', required: false, supported: true },
    { value: 'transmission', label: 'Transmission', type: 'TEXT', required: false, supported: true },
    { value: 'dealer_discount', label: 'Dealer Discount', type: 'DECIMAL', required: false, supported: true },
    { value: 'consumer_rebate', label: 'Consumer Rebate', type: 'DECIMAL', required: false, supported: true },
    { value: 'dealer_accessories', label: 'Dealer Accessories', type: 'DECIMAL', required: false, supported: true },
    { value: 'total_customer_savings', label: 'Total Customer Savings', type: 'DECIMAL', required: false, supported: true },
    { value: 'total_dealer_rebate', label: 'Total Dealer Rebate', type: 'DECIMAL', required: false, supported: true }
  ];

  // Smart mapping function
  const getSmartMapping = (csvField: string): string => {
    const fieldLower = csvField.toLowerCase();
    
    if (fieldLower.includes('dealer') && fieldLower.includes('id')) return 'dealer_id';
    if (fieldLower.includes('vin')) return 'vin';
    if (fieldLower.includes('make')) return 'make';
    if (fieldLower.includes('model')) return 'model';
    if (fieldLower.includes('year')) return 'year';
    if (fieldLower.includes('series')) return 'series';
    if (fieldLower.includes('body') && fieldLower.includes('style')) return 'body_style';
    if (fieldLower.includes('color') && !fieldLower.includes('interior')) return 'color';
    if (fieldLower.includes('interior') && fieldLower.includes('color')) return 'interior_color';
    if (fieldLower.includes('mileage') || fieldLower.includes('miles')) return 'mileage';
    if (fieldLower.includes('odometer')) return 'odometer';
    if (fieldLower.includes('price') && !fieldLower.includes('msrp') && !fieldLower.includes('other')) return 'price';
    if (fieldLower.includes('other') && fieldLower.includes('price')) return 'other_price';
    if (fieldLower.includes('msrp')) return 'msrp';
    if (fieldLower.includes('feature')) return 'features';
    if (fieldLower.includes('photo') && fieldLower.includes('url') && fieldLower.includes('list')) return 'photo_url_list';
    if (fieldLower.includes('stock') && fieldLower.includes('number')) return 'stock_number';
    if (fieldLower.includes('certified')) return 'certified';
    if (fieldLower.includes('engine') && fieldLower.includes('type')) return 'engine_type';
    if (fieldLower.includes('displacement')) return 'displacement';
    if (fieldLower.includes('transmission')) return 'transmission';
    if (fieldLower.includes('dealer') && fieldLower.includes('discount')) return 'dealer_discount';
    if (fieldLower.includes('consumer') && fieldLower.includes('rebate')) return 'consumer_rebate';
    if (fieldLower.includes('dealer') && fieldLower.includes('accessories')) return 'dealer_accessories';
    if (fieldLower.includes('total') && fieldLower.includes('customer') && fieldLower.includes('savings')) return 'total_customer_savings';
    if (fieldLower.includes('total') && fieldLower.includes('dealer') && fieldLower.includes('rebate')) return 'total_dealer_rebate';
    if (fieldLower.includes('reference') && fieldLower.includes('dealer') && fieldLower.includes('id')) return 'reference_dealer_id';
    
    return '';
  };

  // Get field type based on database field
  const getFieldType = (fieldName: string): 'string' | 'number' | 'date' | 'boolean' | 'json' => {
    const field = getDatabaseFields().find(f => f.value === fieldName);
    if (!field) return 'string';
    
    switch (field.type) {
      case 'INTEGER':
      case 'DECIMAL': return 'number';
      case 'BOOLEAN': return 'boolean';
      case 'DATE': return 'date';
      case 'UUID': return 'string';
      default: return 'string';
    }
  };

  // Check if field is required
  const isRequiredField = (fieldName: string): boolean => {
    const field = getDatabaseFields().find(f => f.value === fieldName);
    return field?.required || false;
  };

  // Load current user on component mount
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
          if (userData.dealer_id) {
            setDealerId(userData.dealer_id);
          }
        }
      } catch (error) {
        console.error('Error loading current user:', error);
      }
    };

    loadCurrentUser();
  }, []);

  const downloadTemplate = () => {
    const headers = [
      'dealer_id',
      'vin',
      'make',
      'model',
      'year',
      'series',
      'body_style',
      'color',
      'interior_color',
      'odometer',
      'price',
      'msrp',
      'features',
      'stock_number',
      'certified',
      'engine_type',
      'transmission'
    ];

    const sampleData = [
      [
        '550e8400-e29b-41d4-a716-446655440000',
        '1HGBH41JXMN109186',
        'Honda',
        'Civic',
        '2023',
        'LX',
        'Sedan',
        'White',
        'Black',
        '15000',
        '22000',
        '24000',
        'Bluetooth, Backup Camera, Apple CarPlay',
        'HON001',
        'true',
        '1.5L Turbo',
        'Automatic'
      ]
    ];

    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vehicle_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Template downloaded",
      description: "CSV template has been downloaded successfully",
    });
  };

  const parseCSV = (csvText: string): { headers: string[], data: any[] } => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length !== headers.length) {
        throw new Error(`Row ${i + 1}: Column count mismatch`);
      }

      const row: any = {};
      headers.forEach((header, index) => {
        const value = values[index];
        if (value && value.toLowerCase() !== 'null' && value !== '') {
          row[header] = value;
        }
      });

      data.push(row);
    }

    return { headers, data };
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File too large",
        description: "File size must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setCsvData(null);
    setFieldMappings([]);
    setResult(null);

    try {
      const csvText = await selectedFile.text();
      const { headers, data } = parseCSV(csvText);

      if (data.length === 0) {
        throw new Error("No valid data found in file");
      }

      const csvDataObj: CSVData = {
        headers,
        sampleData: data.slice(0, 10), // Show first 10 rows as sample
        totalRows: data.length,
        fileName: selectedFile.name
      };

      setCsvData(csvDataObj);

      // Auto-generate field mappings
      const mappings: FieldMapping[] = headers.map((header, index) => {
        const targetField = getSmartMapping(header);
        const isRequired = targetField ? isRequiredField(targetField) : false;
        
        return {
          sourceField: header,
          targetField: targetField || '',
          fieldType: targetField ? getFieldType(targetField) : 'string',
          isRequired,
          isEnabled: targetField !== '',
          defaultValue: '',
          transformationRule: '',
          fieldOrder: index + 1
        };
      });

      setFieldMappings(mappings);

      toast({
        title: "CSV file loaded",
        description: `Found ${headers.length} columns and ${data.length} rows. Auto-mapped ${mappings.filter(m => m.targetField).length} fields.`,
      });

    } catch (error: any) {
      console.error('CSV parsing error:', error);
      toast({
        title: "CSV parsing failed",
        description: error.message || "Failed to parse CSV file",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!file || !csvData) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }



    // Validate field mappings
    const enabledMappings = fieldMappings.filter(fm => fm.isEnabled && fm.targetField);
    if (enabledMappings.length === 0) {
      toast({
        title: "No field mappings",
        description: "Please enable and configure field mappings before importing",
        variant: "destructive",
      });
      return;
    }

    // Check required fields
    const requiredMappings = enabledMappings.filter(fm => fm.isRequired);
    if (requiredMappings.length === 0) {
      toast({
        title: "Missing required fields",
        description: "Please map required fields like VIN, Make, Model, and Year",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      // Simulate progress
      setProgress(25);

      // Read CSV file
      const csvText = await file.text();
      const { data } = parseCSV(csvText);

      setProgress(50);

      // Prepare data for import
      const importData = data.map(row => {
        const mappedRow: any = {};
        
        enabledMappings.forEach(mapping => {
          if (row[mapping.sourceField] !== undefined) {
            mappedRow[mapping.targetField] = row[mapping.sourceField];
          }
        });

        return mappedRow;
      });

      setProgress(75);

      // Call import API
      const response = await fetch('http://localhost:3000/api/import/csv-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          data: importData,
          fieldMappings: enabledMappings
        })
      });

      const result = await response.json();
      setProgress(100);

      if (response.ok && result.success) {
        setResult({
          success: true,
          message: `Import completed successfully`,
          imported: result.data?.imported || 0,
          updated: result.data?.updated || 0,
          skipped: result.data?.skipped || 0,
          failed: result.data?.failed || 0,
          errors: result.data?.errors || []
        });
        setShowResult(true);

        toast({
          title: "Import successful",
          description: `Imported ${result.data?.imported || 0} vehicles`,
        });
      } else {
        throw new Error(result.error || 'Import failed');
      }

    } catch (error: any) {
      console.error('Import error:', error);
      setResult({
        success: false,
        message: error.message || 'Import failed',
        imported: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: [error.message || 'Unknown error occurred']
      });
      setShowResult(true);
      
      toast({
        title: "Import failed",
        description: error.message || "Failed to import vehicles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

      const resetImport = () => {
      setFile(null);
      setCsvData(null);
      setFieldMappings([]);
      setResult(null);
      setShowResult(false);
      setProgress(0);
      // Don't reset dealerId as it should come from the user
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

  const updateFieldMapping = (index: number, updates: Partial<FieldMapping>) => {
    const newMappings = [...fieldMappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    setFieldMappings(newMappings);
  };

  const toggleFieldMapping = (index: number) => {
    updateFieldMapping(index, { isEnabled: !fieldMappings[index].isEnabled });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Direct CSV Upload</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instructions */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              Upload a CSV file and map its columns to vehicle database fields. 
              Download the template to see the required format.
            </AlertDescription>
          </Alert>

          {/* Template Download */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">CSV Template</h4>
              <p className="text-sm text-muted-foreground">
                Download the template with sample data and required headers
              </p>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* Dealer ID Display */}
          <div className="space-y-2">
            <Label htmlFor="dealer-id" className="text-red-600 font-medium">Dealer ID (Auto-populated)</Label>
            <Input
              id="dealer-id"
              value={dealerId || 'Loading...'}
              placeholder="Loading dealer ID..."
              className="font-mono border-red-300 focus:border-red-500 focus:ring-red-500"
              disabled={true}
            />
            {!currentUser && (
              <p className="text-sm text-red-600">Loading user information...</p>
            )}
            {currentUser && !currentUser.dealer_id && (
              <p className="text-sm text-red-600">No dealer ID found for current user</p>
            )}
            {currentUser && currentUser.dealer_id && (
              <p className="text-sm text-green-600">Dealer ID loaded successfully</p>
            )}
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-upload-file">Select CSV File</Label>
            <Input
              id="csv-upload-file"
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={loading}
            />
            {file && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          {/* CSV Preview */}
          {csvData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">CSV Preview</h4>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(true)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Data
                  </Button>
                  <Badge variant="outline">
                    {csvData.headers.length} columns, {csvData.totalRows} rows
                  </Badge>
                </div>
              </div>

              {/* Field Mappings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Field Mappings</h4>
                  <div className="flex space-x-2">
                    <Badge variant="outline">
                      {fieldMappings.filter(m => m.isEnabled && m.targetField).length} mapped
                    </Badge>
                    <Badge variant="outline">
                      {fieldMappings.filter(m => m.isRequired).length} required
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {fieldMappings.map((mapping, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg ${
                        !mapping.targetField || !mapping.isEnabled
                          ? 'border-yellow-200 bg-yellow-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={mapping.isEnabled}
                            onCheckedChange={() => toggleFieldMapping(index)}
                          />
                          <span className="font-medium">{mapping.sourceField}</span>
                          {mapping.isRequired && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {mapping.targetField || 'Unmapped'}
                        </Badge>
                      </div>

                      {mapping.isEnabled && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Target Field</Label>
                            <Select
                              value={mapping.targetField || 'none'}
                              onValueChange={(value) => updateFieldMapping(index, { 
                                targetField: value === 'none' ? '' : value,
                                fieldType: value && value !== 'none' ? getFieldType(value) : 'string',
                                isRequired: value && value !== 'none' ? isRequiredField(value) : false
                              })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select field" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Unmapped</SelectItem>
                                {getDatabaseFields().map(field => (
                                  <SelectItem key={field.value} value={field.value}>
                                    {field.label} {field.required ? '(Required)' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Field Type</Label>
                            <Select
                              value={mapping.fieldType}
                              onValueChange={(value: any) => updateFieldMapping(index, { fieldType: value })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">String</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                                <SelectItem value="json">JSON</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing import...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-2">
            <Button
              onClick={handleImport}
              disabled={!file || !csvData || loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Import Vehicles
                </>
              )}
            </Button>
            {(file || result) && (
              <Button variant="outline" onClick={resetImport} disabled={loading}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CSV Data Preview</DialogTitle>
          </DialogHeader>
          {csvData && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{csvData.totalRows}</div>
                  <div className="text-sm text-gray-600">Total Rows</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{csvData.headers.length}</div>
                  <div className="text-sm text-gray-600">Columns</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {fieldMappings.filter(m => m.isEnabled && m.targetField).length}
                  </div>
                  <div className="text-sm text-gray-600">Mapped Fields</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {fieldMappings.filter(m => m.isRequired).length}
                  </div>
                  <div className="text-sm text-gray-600">Required Fields</div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {csvData.headers.map((header, index) => (
                          <th key={index} className="text-left p-2 font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.sampleData.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b">
                          {csvData.headers.map((header, colIndex) => (
                            <td key={colIndex} className="p-2 max-w-32 truncate">
                              {row[header] || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {result?.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span>Import Results</span>
            </DialogTitle>
          </DialogHeader>

          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {result.imported}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Imported
                  </div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.updated}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Updated
                  </div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {result.skipped}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Skipped
                  </div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {result.failed}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Failed
                  </div>
                </div>
              </div>

              {/* Message */}
              <Alert variant={result.success ? "default" : "destructive"}>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Issues Found:</h4>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {result.errors.map((error, index) => (
                      <div
                        key={index}
                        className="text-sm p-2 border-l-2 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800"
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setShowResult(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CSVUploadWithMapping; 
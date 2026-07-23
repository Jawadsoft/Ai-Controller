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
import { buildApiUrl } from '@/lib/config';

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

  // Same target fields used by FTP / import_vehicle_from_csv
  const getDatabaseFields = () => [
    { value: 'vin', label: 'VIN', type: 'TEXT', required: true, supported: true },
    { value: 'make', label: 'Make', type: 'TEXT', required: true, supported: true },
    { value: 'model', label: 'Model', type: 'TEXT', required: true, supported: true },
    { value: 'year', label: 'Year', type: 'INTEGER', required: true, supported: true },
    { value: 'series', label: 'Series', type: 'TEXT', required: false, supported: true },
    { value: 'new_used', label: 'New/Used', type: 'TEXT', required: false, supported: true },
    { value: 'stock_number', label: 'Stock Number', type: 'TEXT', required: false, supported: true },
    { value: 'body_style', label: 'Body Style', type: 'TEXT', required: false, supported: true },
    { value: 'certified', label: 'Certified', type: 'BOOLEAN', required: false, supported: true },
    { value: 'color', label: 'Color', type: 'TEXT', required: false, supported: true },
    { value: 'interior_color', label: 'Interior Color', type: 'TEXT', required: false, supported: true },
    { value: 'engine_type', label: 'Engine Type', type: 'TEXT', required: false, supported: true },
    { value: 'displacement', label: 'Displacement', type: 'TEXT', required: false, supported: true },
    { value: 'features', label: 'Features', type: 'TEXT', required: false, supported: true },
    { value: 'odometer', label: 'Odometer', type: 'INTEGER', required: false, supported: true },
    { value: 'price', label: 'Price', type: 'DECIMAL', required: false, supported: true },
    { value: 'other_price', label: 'Other Price', type: 'DECIMAL', required: false, supported: true },
    { value: 'photo_url_list', label: 'Photo URL List', type: 'TEXT', required: false, supported: true },
    { value: 'transmission', label: 'Transmission', type: 'TEXT', required: false, supported: true },
    { value: 'msrp', label: 'MSRP', type: 'DECIMAL', required: false, supported: true },
    { value: 'dealer_discount', label: 'Dealer Discount', type: 'DECIMAL', required: false, supported: true },
    { value: 'consumer_rebate', label: 'Consumer Rebate', type: 'DECIMAL', required: false, supported: true },
    { value: 'dealer_accessories', label: 'Dealer Accessories', type: 'DECIMAL', required: false, supported: true },
    { value: 'total_customer_savings', label: 'Total Customer Savings', type: 'DECIMAL', required: false, supported: true },
    { value: 'total_dealer_rebate', label: 'Total Dealer Rebate', type: 'DECIMAL', required: false, supported: true },
    { value: 'reference_dealer_id', label: 'Reference Dealer ID', type: 'TEXT', required: false, supported: true },
    { value: 'description', label: 'Description', type: 'TEXT', required: false, supported: true }
  ];

  // Exact vAuto FTP header → DB field map (same layout as FTP import)
  const VAUTO_FIELD_MAP: Record<string, string> = {
    'DealerId': 'reference_dealer_id',
    'VIN': 'vin',
    'Year': 'year',
    'Make': 'make',
    'Model': 'model',
    'Series': 'series',
    'New/Used': 'new_used',
    'Stock #': 'stock_number',
    'Autowriter Description': 'description',
    'Body': 'body_style',
    'Certified': 'certified',
    'Color': 'color',
    'Interior Color': 'interior_color',
    'Engine': 'engine_type',
    'Disp': 'displacement',
    'Features': 'features',
    'Odometer': 'odometer',
    'Price': 'price',
    'Other Price': 'other_price',
    'Photo Url List': 'photo_url_list',
    'Transmission': 'transmission',
    'MSRP': 'msrp',
    'Dealer Discounted': 'dealer_discount',
    'Consumer Cash': 'consumer_rebate',
    'Dlr Accessories': 'dealer_accessories',
    'Total Customer Incentives': 'total_customer_savings',
    'Total Dealer Rebate': 'total_dealer_rebate'
  };

  // Smart mapping — prefer exact vAuto headers, then fuzzy match
  const getSmartMapping = (csvField: string): string => {
    const trimmed = csvField.trim();
    if (VAUTO_FIELD_MAP[trimmed]) return VAUTO_FIELD_MAP[trimmed];

    const fieldLower = trimmed.toLowerCase();
    if (fieldLower === 'dealerid' || (fieldLower.includes('dealer') && fieldLower.includes('id'))) {
      return 'reference_dealer_id';
    }
    if (fieldLower === 'vin') return 'vin';
    if (fieldLower === 'make') return 'make';
    if (fieldLower === 'model') return 'model';
    if (fieldLower === 'year') return 'year';
    if (fieldLower === 'series') return 'series';
    if (fieldLower === 'new/used' || fieldLower === 'new_used') return 'new_used';
    if (fieldLower === 'stock #' || (fieldLower.includes('stock') && (fieldLower.includes('#') || fieldLower.includes('number')))) {
      return 'stock_number';
    }
    if (fieldLower === 'body' || (fieldLower.includes('body') && fieldLower.includes('style'))) return 'body_style';
    if (fieldLower.includes('interior') && fieldLower.includes('color')) return 'interior_color';
    if (fieldLower === 'color') return 'color';
    if (fieldLower === 'engine' || (fieldLower.includes('engine') && fieldLower.includes('type'))) return 'engine_type';
    if (fieldLower === 'disp' || fieldLower.includes('displacement')) return 'displacement';
    if (fieldLower.includes('feature')) return 'features';
    if (fieldLower.includes('odometer') || fieldLower.includes('mileage') || fieldLower.includes('miles')) return 'odometer';
    if (fieldLower.includes('other') && fieldLower.includes('price')) return 'other_price';
    if (fieldLower === 'price') return 'price';
    if (fieldLower === 'msrp') return 'msrp';
    if (fieldLower.includes('photo') || fieldLower.includes('image')) return 'photo_url_list';
    if (fieldLower.includes('transmission')) return 'transmission';
    if (fieldLower.includes('certified')) return 'certified';
    if (fieldLower.includes('dealer') && (fieldLower.includes('discount') || fieldLower.includes('discounted'))) {
      return 'dealer_discount';
    }
    if (fieldLower.includes('consumer') && (fieldLower.includes('cash') || fieldLower.includes('rebate'))) {
      return 'consumer_rebate';
    }
    if (fieldLower.includes('accessories') || fieldLower === 'dlr accessories') return 'dealer_accessories';
    if (fieldLower.includes('customer') && (fieldLower.includes('incentive') || fieldLower.includes('savings'))) {
      return 'total_customer_savings';
    }
    if (fieldLower.includes('dealer') && fieldLower.includes('rebate')) return 'total_dealer_rebate';
    if (fieldLower.includes('description')) return 'description';
    if (fieldLower === 'certification' || fieldLower === 'vehicle detail link') return '';

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

  // Exact columns from vAuto / supplier CSV (e.g. MP92137_claycooleyhyundaisherman)
  const IMPORT_TEMPLATE_HEADERS = [
    'DealerId',
    'VIN',
    'Year',
    'Make',
    'Model',
    'Series',
    'New/Used',
    'Stock #',
    'Autowriter Description',
    'Body',
    'Certified',
    'Certification',
    'Color',
    'Interior Color',
    'Engine',
    'Disp',
    'Features',
    'Odometer',
    'Price',
    'Other Price',
    'Photo Url List',
    'Transmission',
    'Vehicle Detail Link',
    'MSRP',
    'Dealer Discounted',
    'Consumer Cash',
    'Dlr Accessories',
    'Total Customer Incentives',
    'Total Dealer Rebate'
  ] as const;

  const escapeCsvCell = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const downloadTemplate = () => {
    const headers = [...IMPORT_TEMPLATE_HEADERS];

    // Sample row shaped like the uploaded supplier CSV (shortened long fields)
    const sampleData = [
      [
        'MP92137_claycooleyhyundaisherman',
        '5NMP24G14TH077652',
        '2026',
        'Hyundai',
        'Santa Fe Hybrid',
        'SEL',
        'N',
        'TH077652',
        'Factory MSRP: $40,890 Dealer Discount of $1,200 off MSRP',
        '4D Sport Utility',
        '',
        '',
        'Shimmering Silver',
        'Black',
        'I4',
        'R',
        'Option Group 01|6 Speakers|AM/FM radio: SiriusXM|Air Conditioning',
        '16',
        '36690',
        '',
        'https://example.com/photo1.jpg|https://example.com/photo2.jpg',
        '6-Speed Automatic with Shiftronic',
        '',
        '40890',
        '39690',
        '3000',
        '',
        '3000',
        '0'
      ]
    ];

    // Header style matches uploaded CSV (unquoted names); values quoted when needed
    const csvContent = [
      headers.join(','),
      ...sampleData.map((row) => row.map(escapeCsvCell).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
      description: `Template with ${headers.length} columns (same as supplier/vAuto CSV).`,
    });
  };

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const parseCSV = (csvText: string): { headers: string[], data: any[] } => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    if (headers.length === 0) {
      throw new Error('CSV header row is empty');
    }

    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line).map(v => v.replace(/^"|"$/g, '').trim());
      // Allow trailing empty columns; pad/truncate to header length
      while (values.length < headers.length) values.push('');
      if (values.length > headers.length) {
        // Features / photo lists can contain unescaped commas in bad exports —
        // keep extras joined into the last mapped column when counts drift slightly
        const extras = values.splice(headers.length - 1);
        values[headers.length - 1] = extras.join(',');
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

      // Send original CSV rows (vAuto headers) + mappings — backend transforms like FTP import
      setProgress(75);

      const response = await fetch(buildApiUrl('import/csv-upload'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          data,
          fieldMappings: enabledMappings
        })
      });

      const result = await response.json();
      setProgress(100);

      if (response.ok && result.success) {
        setResult({
          success: true,
          message: `Import completed successfully`,
          imported: result.data?.recordsInserted || result.data?.imported || 0,
          updated: result.data?.recordsUpdated || result.data?.updated || 0,
          skipped: result.data?.recordsSkipped || result.data?.skipped || 0,
          failed: result.data?.recordsFailed || result.data?.failed || 0,
          errors: result.data?.errors || []
        });
        setShowResult(true);

        toast({
          title: "Import successful",
          description: `Inserted ${result.data?.recordsInserted || 0}, updated ${result.data?.recordsUpdated || 0} vehicles`,
        });
      } else {
        throw new Error(result.error || result.details || 'Import failed');
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
              Upload a supplier CSV with the same columns as the template below
              (vAuto / dealersync format). Columns auto-map on upload.
            </AlertDescription>
          </Alert>

          {/* Template Download */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-medium">Vehicle import template</h4>
                <p className="text-sm text-muted-foreground">
                  {IMPORT_TEMPLATE_HEADERS.length} columns — same fields as your uploaded inventory CSV
                </p>
              </div>
              <Button variant="outline" onClick={downloadTemplate} className="shrink-0">
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {IMPORT_TEMPLATE_HEADERS.map((field) => (
                <Badge key={field} variant="secondary" className="text-xs font-normal">
                  {field}
                </Badge>
              ))}
            </div>
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
                  <div className="text-2xl font-bold text-primary">{csvData.totalRows}</div>
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
              <div className="rounded-lg border bg-muted/40 p-3 text-center text-sm">
                <span className="font-medium">
                  {(result.imported || 0) + (result.updated || 0) + (result.skipped || 0)}
                </span>
                {' '}vehicles processed successfully
                {(result.failed || 0) > 0 ? ` (${result.failed} failed)` : ''}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {result.imported}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    New
                  </div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">
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
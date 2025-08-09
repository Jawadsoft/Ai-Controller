import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Settings, Play, Trash2, Plus, Eye, EyeOff, Download, Loader2, Globe, Upload, History, Database, Copy } from 'lucide-react';
import CSVAnalysisModal from './CSVAnalysisModal';

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

// Interface for the form (camelCase)
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
  schedule: {
    frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'monthly';
    timeHour: number;
    timeMinute: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  fieldMappings: Array<{
    sourceField: string;
    targetField: string;
    fieldType: 'string' | 'number' | 'date' | 'boolean' | 'json';
    isRequired: boolean;
    isEnabled?: boolean;
    defaultValue?: string;
    transformationRule?: string;
    fieldOrder: number;
  }>;
  processing: {
    duplicateHandling: 'skip' | 'update' | 'replace';
    batchSize: number;
    maxErrors: number;
    validateData: boolean;
    archiveProcessedFiles: boolean;
    archiveDirectory: string;
  };
}

interface ImportConfigurationProps {
  onEditConfig?: (configId: number) => void;
  onCancel?: () => void;
  preloadedConfig?: ImportConfigResponse | null;
}

const ImportConfiguration: React.FC<ImportConfigurationProps> = ({ onEditConfig, onCancel, preloadedConfig }) => {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ImportConfigResponse[]>([]);
  const [currentConfig, setCurrentConfig] = useState<ImportConfig>(() => {
    return {
      id: undefined,
      configName: '',
      connection: {
        type: 'sftp',
        hostUrl: '',
        port: 22,
        username: '',
        password: '',
        remoteDirectory: '',
        filePattern: '*.csv'
      },
      fileSettings: {
        fileType: 'csv',
        delimiter: ',',
        hasHeader: true,
        encoding: 'utf8',
        dateFormat: 'YYYY-MM-DD'
      },
      schedule: {
        frequency: 'manual',
        timeHour: 0,
        timeMinute: 0
      },
      fieldMappings: [],
      processing: {
        duplicateHandling: 'skip',
        batchSize: 1000,
        maxErrors: 100,
        validateData: true,
        archiveProcessedFiles: false,
        archiveDirectory: '/processed'
      }
    };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isTestingAndDownloading, setIsTestingAndDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    fileName: string;
    progress: number;
    totalSize: number;
    downloadedSize: number;
  } | null>(null);
  const [latestDownloadedFile, setLatestDownloadedFile] = useState<{
    originalName: string;
    localName: string;
    localPath: string;
    size: number;
    sizeFormatted: string;
  } | null>(() => {
    // Try to restore from localStorage
    try {
      const stored = localStorage.getItem('latestDownloadedFile');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [csvData, setCsvData] = useState<any>(null);
  const [showCsvAnalysis, setShowCsvAnalysis] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ImportConfigResponse | null>(null);
  const [isExecutingImport, setIsExecutingImport] = useState(false);
  const [activeTab, setActiveTab] = useState('connection');
  const [editingConfig, setEditingConfig] = useState<ImportConfig | null>(null);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvAnalysisLoading, setCsvAnalysisLoading] = useState(false);
  const [csvAnalysisError, setCsvAnalysisError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTabIndex, setCurrentTabIndex] = useState(0);

  // Tab order as requested: Connection, Test, Field Mappings, Processing, Schedule, File Settings
  const tabOrder = ['connection', 'test', 'mappings', 'processing', 'schedule', 'file'];
  const tabLabels = {
    connection: 'Connection',
    test: 'Test',
    mappings: 'Field Mappings', 
    processing: 'Processing',
    schedule: 'Schedule',
    file: 'File Settings'
  };

  // Helper function to update downloaded file state and persist to localStorage
  const updateLatestDownloadedFile = (fileInfo: typeof latestDownloadedFile) => {
    console.log('Updating latest downloaded file:', fileInfo);
    setLatestDownloadedFile(fileInfo);
    
    // Persist to localStorage
    try {
      if (fileInfo) {
        localStorage.setItem('latestDownloadedFile', JSON.stringify(fileInfo));
      } else {
        localStorage.removeItem('latestDownloadedFile');
      }
    } catch (error) {
      console.error('Failed to save downloaded file info to localStorage:', error);
    }
  };

  // Navigation functions
  const goToNextTab = () => {
    if (currentTabIndex < tabOrder.length - 1) {
      const nextIndex = currentTabIndex + 1;
      setCurrentTabIndex(nextIndex);
      setActiveTab(tabOrder[nextIndex]);
    }
  };

  const goToPreviousTab = () => {
    if (currentTabIndex > 0) {
      const prevIndex = currentTabIndex - 1;
      setCurrentTabIndex(prevIndex);
      setActiveTab(tabOrder[prevIndex]);
    }
  };

  // Update current tab index when active tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const index = tabOrder.indexOf(value);
    if (index !== -1) {
      setCurrentTabIndex(index);
    }
  };

  // Navigation buttons component
  const TabNavigation = ({ className = "" }) => (
    <div className={`flex justify-between items-center pt-4 border-t ${className}`}>
      <Button
        variant="outline"
        onClick={goToPreviousTab}
        disabled={currentTabIndex === 0}
        className="flex items-center gap-2"
      >
        <span>←</span>
        Previous
        {currentTabIndex > 0 && (
          <span className="text-sm text-muted-foreground">
            ({tabLabels[tabOrder[currentTabIndex - 1]]})
          </span>
        )}
      </Button>
      
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{currentTabIndex + 1} of {tabOrder.length}</span>
        <span>•</span>
        <span>{tabLabels[tabOrder[currentTabIndex]]}</span>
      </div>

      <Button
        variant="outline"
        onClick={goToNextTab}
        disabled={currentTabIndex === tabOrder.length - 1}
        className="flex items-center gap-2"
      >
        Next
        {currentTabIndex < tabOrder.length - 1 && (
          <span className="text-sm text-muted-foreground">
            ({tabLabels[tabOrder[currentTabIndex + 1]]})
          </span>
        )}
        <span>→</span>
      </Button>
    </div>
  );

  // Helper function to get all database fields with their types
  // Helper function to check if a field is supported by the import_vehicle_from_csv database function
  const isFieldSupportedByImportFunction = (fieldName: string): boolean => {
    const supportedFields = [
      'dealer_id', 'vin', 'make', 'model', 'series', 'stock_number', 'body_style', 'certified',
      'color', 'interior_color', 'engine_type', 'displacement', 'features', 'odometer', 'mileage', 'price', 
      'other_price', 'transmission', 'msrp', 'dealer_discount', 'consumer_rebate', 'dealer_accessories',
      'total_customer_savings', 'total_dealer_rebate', 'photo_url_list', 'year', 'reference_dealer_id','images'
    ];
    return supportedFields.includes(fieldName);
  };

  // const getDatabaseFields = () => [
  //   // Core vehicle fields (supported by import_vehicle_from_csv function)
  //   { value: 'dealer_id', label: 'Dealer ID', type: 'UUID', required: true, supported: true },
  //   { value: 'vin', label: 'VIN', type: 'TEXT', required: true, supported: true },
  //   { value: 'make', label: 'Make', type: 'TEXT', required: true, supported: true },
  //   { value: 'model', label: 'Model', type: 'TEXT', required: true, supported: true },
  //   { value: 'year', label: 'Year', type: 'INTEGER', required: true, supported: true },
  //   { value: 'series', label: 'Series', type: 'TEXT', required: true, supported: true },
  //   { value: 'body_style', label: 'Body Style', type: 'TEXT', required: true, supported: true },
  //   { value: 'color', label: 'Color', type: 'TEXT', required: true, supported: true },
  //   { value: 'interior_color', label: 'Interior Color', type: 'TEXT', required: true, supported: true },
  //   { value: 'odometer', label: 'Odometer', type: 'INTEGER', required: true, supported: true },
  //   { value: 'price', label: 'Price', type: 'DECIMAL', required: true, supported: true },
  //   { value: 'other_price', label: 'Other Price', type: 'DECIMAL', required: true, supported: true },
  //   { value: 'msrp', label: 'MSRP', type: 'DECIMAL', required: true, supported: true },
  //   { value: 'features', label: 'Features', type: 'TEXT', required: true, supported: true },
  //   { value: 'photo_url_list', label: 'Photo URL List', type: 'TEXT', required: false, supported: true },
  //   { value: 'reference_dealer_id', label: 'Reference Dealer ID', type: 'TEXT', required: true, supported: true },
    
  //   // Additional vehicle details (supported by import_vehicle_from_csv function)
  //   { value: 'stock_number', label: 'Stock Number', type: 'TEXT', required: true, supported: true },
  //   { value: 'certified', label: 'Certified', type: 'BOOLEAN', required: true, supported: true },
  //   { value: 'engine_type', label: 'Engine Type', type: 'TEXT', required: true, supported: true },
  //   { value: 'displacement', label: 'Displacement', type: 'TEXT', required: false, supported: true },
  //   { value: 'transmission', label: 'Transmission', type: 'TEXT', required: true, supported: true },
  //   { value: 'dealer_discount', label: 'Dealer Discount', type: 'DECIMAL', required: true, supported: true },
  //   { value: 'consumer_rebate', label: 'Consumer Rebate', type: 'DECIMAL', required: false, supported: true },
  //   { value: 'dealer_accessories', label: 'Dealer Accessories', type: 'DECIMAL', required: false, supported: true },
  //   { value: 'total_customer_savings', label: 'Total Customer Savings', type: 'DECIMAL', required: false, supported: true },
  //   { value: 'total_dealer_rebate', label: 'Total Dealer Rebate', type: 'DECIMAL', required: false, supported: true },
    
  //   // Fields available in database but NOT supported by import_vehicle_from_csv function
  //   { value: 'mileage', label: 'Mileage (Legacy)', type: 'DECIMAL', required: true, supported: true },
  //   { value: 'images', label: 'Images (Legacy)', type: 'TEXT', required: true, supported: true },
  //   { value: 'status', label: 'Status', type: 'TEXT', required: false, supported: false },
  //   { value: 'import_source', label: 'Import Source', type: 'TEXT', required: false, supported: false },
  //   { value: 'import_date', label: 'Import Date', type: 'TIMESTAMP', required: false, supported: false },
  //   { value: 'created_at', label: 'Created At', type: 'TIMESTAMP', required: false, supported: false },
  //   { value: 'updated_at', label: 'Updated At', type: 'TIMESTAMP', required: false, supported: false }
  // ];

  // Helper function to get smart mapping suggestions
  
  const getDatabaseFields = () => [
    // Core vehicle details (required fields)
    { value: 'dealer_id', label: 'Dealer ID', type: 'UUID', required: true, supported: true },
    { value: 'vin', label: 'VIN', type: 'TEXT', required: true, supported: true },
    { value: 'make', label: 'Make', type: 'TEXT', required: true, supported: true },
    { value: 'model', label: 'Model', type: 'TEXT', required: true, supported: true },
    { value: 'year', label: 'Year', type: 'INTEGER', required: true, supported: true },

    // Vehicle details (optional but commonly used)
    { value: 'series', label: 'Series', type: 'TEXT', required: false, supported: true },
    { value: 'trim', label: 'Trim', type: 'TEXT', required: false, supported: true },
    { value: 'stock_number', label: 'Stock Number', type: 'TEXT', required: false, supported: true },
    { value: 'body_style', label: 'Body Style', type: 'TEXT', required: false, supported: true },
    { value: 'certified', label: 'Certified', type: 'BOOLEAN', required: false, supported: true },

    // Colors
    { value: 'color', label: 'Exterior Color', type: 'TEXT', required: false, supported: true },
    { value: 'interior_color', label: 'Interior Color', type: 'TEXT', required: false, supported: true },

    // Engine & Transmission
    { value: 'engine_type', label: 'Engine Type', type: 'TEXT', required: false, supported: true },
    { value: 'displacement', label: 'Engine Displacement', type: 'TEXT', required: false, supported: true },
    { value: 'transmission', label: 'Transmission', type: 'TEXT', required: false, supported: true },

    // Mileage (both fields available)
    { value: 'mileage', label: 'Mileage (Decimal)', type: 'DECIMAL', required: false, supported: true },
    { value: 'odometer', label: 'Odometer (Integer)', type: 'INTEGER', required: false, supported: true },

    // Pricing
    { value: 'price', label: 'Price', type: 'DECIMAL', required: false, supported: true },
    { value: 'msrp', label: 'MSRP', type: 'DECIMAL', required: false, supported: true },
    { value: 'other_price', label: 'Other Price', type: 'DECIMAL', required: false, supported: true },
    { value: 'dealer_discount', label: 'Dealer Discount', type: 'DECIMAL', required: false, supported: true },
    { value: 'consumer_rebate', label: 'Consumer Rebate', type: 'DECIMAL', required: false, supported: true },
    { value: 'dealer_accessories', label: 'Dealer Accessories', type: 'DECIMAL', required: false, supported: true },
    { value: 'total_customer_savings', label: 'Total Customer Savings', type: 'DECIMAL', required: false, supported: true },
    { value: 'total_dealer_rebate', label: 'Total Dealer Rebate', type: 'DECIMAL', required: false, supported: true },

    // Content & Media
    { value: 'description', label: 'Description', type: 'TEXT', required: false, supported: true },
    { value: 'features', label: 'Features (Array)', type: 'TEXT[]', required: false, supported: true },
    { value: 'photo_url_list', label: 'Photo URLs (Array)', type: 'TEXT[]', required: false, supported: true },
    { value: 'qr_code_url', label: 'QR Code URL', type: 'TEXT', required: false, supported: true },

    // Status & Classification
    { value: 'status', label: 'Status (available/sold/pending)', type: 'TEXT', required: false, supported: true },
    { value: 'new_used', label: 'New/Used', type: 'TEXT', required: true, supported: true },

    // Import tracking
    { value: 'reference_dealer_id', label: 'Reference Dealer ID', type: 'TEXT', required: false, supported: true },
    { value: 'import_source', label: 'Import Source', type: 'TEXT', required: false, supported: true },
    { value: 'import_date', label: 'Import Date', type: 'TIMESTAMP', required: false, supported: true },

    // System fields (usually not mapped from CSV)
    { value: 'id', label: 'ID', type: 'UUID', required: false, supported: false },
    { value: 'created_at', label: 'Created At', type: 'TIMESTAMP', required: false, supported: false },
    { value: 'updated_at', label: 'Updated At', type: 'TIMESTAMP', required: false, supported: false }
  ];
  
  
  const getSmartMapping = (csvField: string): string => {
    const fieldLower = csvField.toLowerCase();
    
    // Only map to fields that are supported by the import_vehicle_from_csv database function
    // Supported fields: dealer_id, vin, make, model, series, stock_number, body_style, certified,
    // color, interior_color, engine_type, displacement, features, odometer, price, other_price,
    // transmission, msrp, dealer_discount, consumer_rebate, dealer_accessories, 
    // total_customer_savings, total_dealer_rebate, photo_url_list, year, reference_dealer_id
    
    // Core vehicle fields (supported by database function)
    if (fieldLower.includes('dealer') && fieldLower.includes('id')) return 'dealer_id';
    if (fieldLower.includes('vin')) return 'vin';
    if (fieldLower.includes('make')) return 'make';
    if (fieldLower.includes('model')) return 'model';
    if (fieldLower.includes('year')) return 'year';
    if (fieldLower.includes('series')) return 'series';
    if (fieldLower.includes('body') && fieldLower.includes('style')) return 'body_style';
    if (fieldLower.includes('color') && !fieldLower.includes('interior')) return 'color';
    if (fieldLower.includes('interior') && fieldLower.includes('color')) return 'interior_color';
    if (fieldLower.includes('mileage')) return 'odometer';
    if (fieldLower.includes('odometer')) return 'odometer';
    if (fieldLower.includes('price') && !fieldLower.includes('msrp') && !fieldLower.includes('other')) return 'price';
    if (fieldLower.includes('other') && fieldLower.includes('price')) return 'other_price';
    if (fieldLower.includes('msrp')) return 'msrp';
    if (fieldLower.includes('feature')) return 'features';
    if (fieldLower.includes('photo') || fieldLower.includes('image') || fieldLower.includes('picture')) return 'photo_url_list';
    
    // Additional vehicle details (supported by database function)
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

  // Helper function to get field type based on database field
  const getFieldType = (fieldName: string): 'string' | 'number' | 'date' | 'boolean' | 'json' => {
    const field = getDatabaseFields().find(f => f.value === fieldName);
    if (!field) return 'string';
    
    switch (field.type) {
      case 'INTEGER':
      case 'DECIMAL': return 'number';
      case 'BOOLEAN': return 'boolean';
      case 'DATE': return 'date';
      case 'UUID': return 'string'; // UUID stored as string in database
      default: return 'string';
    }
  };

  // Helper function to check if field is required
  const isRequiredField = (fieldName: string): boolean => {
    const field = getDatabaseFields().find(f => f.value === fieldName);
    return field?.required || false;
  };

  // Enhanced smart mapping function with better field detection
  // const getEnhancedSmartMapping = (csvField: string): string => {
  //   const fieldLower = csvField.toLowerCase().trim();
    
  //   // Core vehicle fields (high priority)
  //   if (fieldLower.includes('vin') || fieldLower === 'vehicle_id') return 'vin';
  //   if (fieldLower.includes('make') || fieldLower === 'brand') return 'make';
  //   if (fieldLower.includes('model') || fieldLower === 'car_model') return 'model';
  //   if (fieldLower.includes('year') || fieldLower === 'model_year') return 'year';
  //   if (fieldLower.includes('dealer') && fieldLower.includes('id')) return 'dealer_id';
    
  //   // Price fields
  //   if (fieldLower.includes('price') && !fieldLower.includes('msrp') && !fieldLower.includes('other')) return 'price';
  //   if (fieldLower.includes('msrp') || fieldLower.includes('sticker')) return 'msrp';
  //   if (fieldLower.includes('other') && fieldLower.includes('price')) return 'other_price';
    
  //   // Vehicle details
  //   if (fieldLower.includes('stock') && fieldLower.includes('number')) return 'stock_number';
  //   if (fieldLower.includes('series') || fieldLower.includes('trim')) return 'series';
  //   if (fieldLower.includes('body') && fieldLower.includes('style')) return 'body_style';
  //   if (fieldLower.includes('color') && !fieldLower.includes('interior')) return 'color';
  //   if (fieldLower.includes('interior') && fieldLower.includes('color')) return 'interior_color';
  //   if (fieldLower.includes('certified')) return 'certified';
  //   if (fieldLower.includes('engine') && fieldLower.includes('type')) return 'engine_type';
  //   if (fieldLower.includes('displacement')) return 'displacement';
  //   if (fieldLower.includes('transmission')) return 'transmission';
  //   if (fieldLower.includes('mileage') || fieldLower.includes('miles') || fieldLower.includes('odometer')) return 'odometer';
  //   if (fieldLower.includes('feature')) return 'features';
  //   if (fieldLower.includes('photo') || fieldLower.includes('image') || fieldLower.includes('picture')) return 'photo_url_list';
  //   if (fieldLower.includes('reference') && fieldLower.includes('dealer')) return 'reference_dealer_id';
    
  //   // Additional mappings
  //   if (fieldLower.includes('dealer') && fieldLower.includes('discount')) return 'dealer_discount';
  //   if (fieldLower.includes('consumer') && fieldLower.includes('rebate')) return 'consumer_rebate';
  //   if (fieldLower.includes('dealer') && fieldLower.includes('accessories')) return 'dealer_accessories';
  //   if (fieldLower.includes('total') && fieldLower.includes('customer') && fieldLower.includes('savings')) return 'total_customer_savings';
  //   if (fieldLower.includes('total') && fieldLower.includes('dealer') && fieldLower.includes('rebate')) return 'total_dealer_rebate';
    
  //   return '';
  // };
  const getEnhancedSmartMapping = (csvField: string): string => {
    const fieldLower = csvField.toLowerCase().trim();
  
    // Exact matches and high-confidence mappings
    if (fieldLower === 'dealerid') return 'dealer_id';
    if (fieldLower === 'vin') return 'vin';
    if (fieldLower === 'year') return 'year';
    if (fieldLower === 'make') return 'make';
    if (fieldLower === 'model') return 'model';
    if (fieldLower === 'series') return 'series';
    if (fieldLower === 'new/used') return 'status';
    if (fieldLower === 'stock #' || fieldLower.includes('stock')) return 'stock_number';
    if (fieldLower.includes('description')) return 'description';
    if (fieldLower === 'body') return 'body_style';
    if (fieldLower === 'certified') return 'certified';
    if (fieldLower === 'certification') return ''; // No corresponding DB field — skip or handle separately
    if (fieldLower === 'color') return 'color';
    if (fieldLower === 'interior color') return 'interior_color';
    if (fieldLower === 'engine') return 'engine_type';
    if (fieldLower === 'disp') return 'displacement';
    if (fieldLower.includes('feature')) return 'features';
    if (fieldLower === 'odometer') return 'mileage'; // mapped to legacy `mileage`
    if (fieldLower === 'price') return 'price';
    if (fieldLower === 'other price') return 'other_price';
    if (fieldLower === 'photo url list') return 'images'; // mapped to legacy `images`
    if (fieldLower === 'transmission') return 'transmission';
    if (fieldLower === 'vehicle detail link') return 'qr_code_url';
    if (fieldLower === 'msrp' || fieldLower.includes('sticker')) return 'msrp';
    if (fieldLower === 'dealer discounted') return 'dealer_discount';
    if (fieldLower === 'consumer cash') return 'consumer_rebate';
    if (fieldLower === 'dlr accessories') return 'dealer_accessories';
    if (fieldLower === 'total customer incentives') return 'total_customer_savings';
    if (fieldLower === 'total dealer rebate') return 'total_dealer_rebate';
  
    // Fallback: try best-effort pattern matching for unexpected headers
    if (fieldLower.includes('dealer') && fieldLower.includes('id')) return 'dealer_id';
    if (fieldLower.includes('interior') && fieldLower.includes('color')) return 'interior_color';
    if (fieldLower.includes('engine')) return 'engine_type';
    if (fieldLower.includes('displacement') || fieldLower === 'disp') return 'displacement';
    if (fieldLower.includes('odometer') || fieldLower.includes('miles') || fieldLower.includes('mileage')) return 'mileage';
    if (fieldLower.includes('image') || fieldLower.includes('photo')) return 'images';
  
    return ''; // no match found
  };
  
  

  const createNewConfig = (): ImportConfig => {
    setShowPassword(false); // Reset password visibility
    return {
      id: undefined,
      configName: '',
      connection: {
        type: 'sftp',
        hostUrl: '',
        port: 22,
        username: '',
        password: '',
        remoteDirectory: '',
        filePattern: '*.csv'
      },
      fileSettings: {
        fileType: 'csv',
        delimiter: ',',
        hasHeader: true,
        encoding: 'utf8',
        dateFormat: 'YYYY-MM-DD'
      },
      schedule: {
        frequency: 'manual',
        timeHour: 0,
        timeMinute: 0,
        dayOfWeek: undefined,
        dayOfMonth: undefined
      },
      fieldMappings: [],
      processing: {
        duplicateHandling: 'skip',
        batchSize: 1000,
        maxErrors: 100,
        validateData: true,
        archiveProcessedFiles: false,
        archiveDirectory: '/processed'
      }
    };
  };

  const handleNewConfiguration = () => {
    console.log('=== NEW CONFIGURATION CLICKED ===');
    console.log('Current config before:', currentConfig);
    setCurrentConfig(createNewConfig());
    setIsEditing(true);
    setShowCSVModal(false);
    setCsvAnalysisError(null);
    setCsvData(null);
    console.log('=== END NEW CONFIGURATION CLICKED ===');
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  // Handle preloaded config changes
  useEffect(() => {
    if (preloadedConfig && preloadedConfig.config_name) {
      console.log('=== PRELOADED CONFIG DETECTED ===');
      console.log('Preloaded config:', preloadedConfig);
      
      // Convert API response format to form format
      const formConfig: ImportConfig = {
        id: preloadedConfig.id,
        configName: preloadedConfig.config_name,
        connection: {
          type: preloadedConfig.connection_type,
          hostUrl: preloadedConfig.host_url,
          port: preloadedConfig.port,
          username: preloadedConfig.username,
          password: 'Dealeriq2025@', // Don't populate password for security
          remoteDirectory: preloadedConfig.remote_directory,
          filePattern: preloadedConfig.file_pattern
        },
        fileSettings: {
          fileType: preloadedConfig.file_type,
          delimiter: preloadedConfig.delimiter,
          hasHeader: preloadedConfig.has_header,
          encoding: preloadedConfig.encoding,
          dateFormat: preloadedConfig.date_format
        },
        schedule: {
          frequency: preloadedConfig.frequency,
          timeHour: preloadedConfig.time_hour,
          timeMinute: preloadedConfig.time_minute,
          dayOfWeek: preloadedConfig.day_of_week,
          dayOfMonth: preloadedConfig.day_of_month
        },
        fieldMappings: preloadedConfig.fieldMappings?.map(fm => ({
          sourceField: fm.source_field,
          targetField: fm.target_field,
          fieldType: fm.field_type,
          isRequired: fm.is_required,
          isEnabled: true,
          defaultValue: fm.default_value,
          transformationRule: fm.transformation_rule,
          fieldOrder: fm.field_order
        })) || [],
        processing: {
          duplicateHandling: preloadedConfig.duplicate_handling,
          batchSize: preloadedConfig.batch_size,
          maxErrors: preloadedConfig.max_errors,
          validateData: preloadedConfig.validate_data,
          archiveProcessedFiles: preloadedConfig.archive_processed_files,
          archiveDirectory: preloadedConfig.archive_directory
        }
      };
      
      console.log('Converted form config:', formConfig);
      setCurrentConfig(formConfig);
      setIsEditing(true);
      
      console.log('=== END PRELOADED CONFIG SETUP ===');
    } else if (!preloadedConfig) {
      // Reset to default when no preloaded config
      setCurrentConfig(createNewConfig());
      setIsEditing(false);
    }
  }, [preloadedConfig]);

  const loadConfigs = async () => {
    try {
      setIsLoading(true);
      console.log('=== LOADING CONFIGS ===');
      console.log('Auth token:', localStorage.getItem('auth_token') ? 'Present' : 'Missing');
      
      const response = await fetch('http://localhost:3000/api/import/configs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (response.ok) {
        const result = await response.json();
        console.log('API Response:', result);
        console.log('Configs to set:', result.data);
        console.log('Configs length:', result.data?.length || 0);
        setConfigs(result.data || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to load configs:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error loading configs:', error);
    } finally {
      setIsLoading(false);
      console.log('=== END LOADING CONFIGS ===');
    }
  };

  const saveConfig = async () => {
    if (!currentConfig) return;

    try {
      setIsLoading(true);
      // Determine if this is a new config or an update
      const isUpdate = currentConfig.id !== undefined;
      const url = isUpdate ? `http://localhost:3000/api/import/configs/${currentConfig.id}` : 'http://localhost:3000/api/import/configs';
      const method = isUpdate ? 'PUT' : 'POST';

      // Map fieldMappings to use is_required (snake_case)
      const mappedConfig = {
        ...currentConfig,
        fieldMappings: currentConfig.fieldMappings.map(({ isRequired, ...rest }) => ({
          ...rest,
          is_required: isRequired,
        })),
      };

      console.log('Sending config data:', mappedConfig);

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(mappedConfig)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: isUpdate ? "Import configuration updated successfully" : "Import configuration created successfully"
        });
        loadConfigs();
        setCurrentConfig(createNewConfig());
        setIsEditing(false);
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

    // Validate required fields before testing
    if (!currentConfig.connection.hostUrl || !currentConfig.connection.username || !currentConfig.connection.password) {
      const missingFields = [];
      if (!currentConfig.connection.hostUrl) missingFields.push("Host URL");
      if (!currentConfig.connection.username) missingFields.push("Username");
      if (!currentConfig.connection.password) missingFields.push("Password");
      
      const isEditingExisting = currentConfig.id && preloadedConfig;
      const passwordMessage = isEditingExisting && missingFields.includes("Password") 
        ? "Please re-enter the password for security reasons." 
        : "";
      
      toast({
        title: "Missing Information",
        description: `Please fill in: ${missingFields.join(", ")}. ${passwordMessage}`,
        variant: "destructive"
      });
      return;
    }

    try {
      setIsTestingConnection(true);
      
      // Convert camelCase to the format expected by the backend
      const connectionData = {
        connectionType: currentConfig.connection.type,
        hostUrl: currentConfig.connection.hostUrl,
        port: currentConfig.connection.port,
        username: currentConfig.connection.username,
        password: currentConfig.connection.password,
        remoteDirectory: currentConfig.connection.remoteDirectory,
        filePattern: currentConfig.connection.filePattern
      };
      
      console.log('Sending connection data:', connectionData);
      
      const response = await fetch('http://localhost:3000/api/import/test-connection', {
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
        let description = `Connection test successful. Found ${result.filesFound} files.`;
        if (result.availableDirectories && result.availableDirectories.length > 0) {
          description += ` Available directories: ${result.availableDirectories.join(', ')}`;
        }
        toast({
          title: "Success",
          description: description
        });

        // After successful connection, retrieve CSV data for preview
        await retrieveCSVDataAfterConnection(connectionData);
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

  const retrieveCSVDataAfterConnection = async (connectionData: any) => {
    try {
      setCsvAnalysisLoading(true);
      setCsvAnalysisError(null);
      
      console.log('Retrieving CSV data after successful connection:', connectionData);
      
      const response = await fetch('http://localhost:3000/api/import/preview-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(connectionData)
      });

      const result = await response.json();
      console.log('CSV data retrieval response:', result);
      
      if (result.success) {
        // Set the CSV data for the modal
        const csvDataToSet = {
          headers: result.headers,
          sampleData: result.sampleData,
          totalRows: result.totalRows,
          fileName: result.fileName,
          fieldMappings: result.fieldMappings,
          configId: null, // No config ID since this is just a preview
          connectionData: connectionData
        };
        
        setCsvData(csvDataToSet);
        console.log('CSV Data set successfully:', csvDataToSet);
        console.log('CSV Headers:', csvDataToSet.headers);
        console.log('CSV Headers length:', csvDataToSet.headers?.length);
        setShowCSVModal(true);
        
        toast({
          title: "CSV Data Retrieved!",
          description: `Found ${result.totalRows} rows with ${result.headers?.length || 0} columns in ${result.fileName}`,
        });
      } else {
        setCsvAnalysisError(result.details || result.error || "Failed to retrieve CSV data");
        toast({
          title: "CSV Data Retrieval Failed",
          description: result.details || result.error || "Failed to retrieve CSV data",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error retrieving CSV data:', error);
      setCsvAnalysisError(error instanceof Error ? error.message : "Failed to retrieve CSV data");
      toast({
        title: "CSV Data Error",
        description: error instanceof Error ? error.message : "Failed to retrieve CSV data",
        variant: "destructive"
      });
    } finally {
      setCsvAnalysisLoading(false);
    }
  };

  const testConnectionAndDownload = async () => {
    if (!currentConfig?.connection) return;

    // Validate required fields before testing
    if (!currentConfig.connection.hostUrl || !currentConfig.connection.username || !currentConfig.connection.password) {
      const missingFields = [];
      if (!currentConfig.connection.hostUrl) missingFields.push("Host URL");
      if (!currentConfig.connection.username) missingFields.push("Username");
      if (!currentConfig.connection.password) missingFields.push("Password");
      
      const isEditingExisting = currentConfig.id && preloadedConfig;
      const passwordMessage = isEditingExisting && missingFields.includes("Password") 
        ? "Please re-enter the password for security reasons." 
        : "";
      
      toast({
        title: "Missing Information",
        description: `Please fill in: ${missingFields.join(", ")}. ${passwordMessage}`,
        variant: "destructive"
      });
      return;
    }

    try {
      setIsTestingAndDownloading(true);
      setDownloadProgress(null);
      
      // Convert camelCase to the format expected by the backend
      const connectionData = {
        connectionType: currentConfig.connection.type,
        hostUrl: currentConfig.connection.hostUrl,
        port: currentConfig.connection.port,
        username: currentConfig.connection.username,
        password: currentConfig.connection.password,
        remoteDirectory: currentConfig.connection.remoteDirectory,
        filePattern: currentConfig.connection.filePattern
      };
      
      console.log('Sending connection and download data:', connectionData);
      
      // Show initial progress
      toast({
        title: "Connecting...",
        description: `Testing connection to ${currentConfig.connection.hostUrl} and looking for files matching ${currentConfig.connection.filePattern}...`,
        variant: "default"
      });
      
      const response = await fetch('http://localhost:3000/api/import/test-connection-and-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(connectionData)
      });

      const result = await response.json();
      console.log('Test connection and download response:', result);
      
      if (result.success) {
        if (result.downloaded && result.downloadedFile) {
          // Show which file is being downloaded
          toast({
            title: "File Found - Starting Download",
            description: `Downloading: ${result.downloadedFile.originalName} (${result.downloadedFile.sizeFormatted})`,
            variant: "default"
          });
          
          // Show download progress simulation
          setDownloadProgress({
            fileName: result.downloadedFile.originalName,
            progress: 0,
            totalSize: result.downloadedFile.size,
            downloadedSize: 0
          });
          
          // Simulate download progress
          const simulateProgress = () => {
            let progress = 0;
            const interval = setInterval(() => {
              progress += Math.random() * 15 + 5; // Random increment between 5-20%
              if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                
                // Show completion
                setTimeout(() => {
                  setDownloadProgress(null);
                  console.log('=== SETTING LATEST DOWNLOADED FILE ===');
                  console.log('Downloaded file info:', result.downloadedFile);
                  updateLatestDownloadedFile(result.downloadedFile);
                  toast({
                    title: "Success - File Downloaded!",
                    description: `Downloaded ${result.downloadedFile.originalName} (${result.downloadedFile.sizeFormatted}) to uploads/import/. Preview button will now use this file.`,
                    variant: "default"
                  });
                }, 500);
              }
              
              setDownloadProgress(prev => prev ? {
                ...prev,
                progress: Math.min(progress, 100),
                downloadedSize: Math.min(Math.round((progress / 100) * result.downloadedFile.size), result.downloadedFile.size)
              } : null);
            }, 200);
          };
          
          // Start progress simulation after a short delay
          setTimeout(simulateProgress, 500);
          
        } else if (result.filesFound === 0) {
          let description = `Connection successful but no matching files found.`;
          if (result.availableFiles && result.availableFiles.length > 0) {
            description += ` Available files: ${result.availableFiles.map(f => f.name).join(', ')}`;
          }
          toast({
            title: "Connection Successful",
            description: description,
            variant: "default"
          });
        } else {
          toast({
            title: "Connection Successful",
            description: `Found ${result.filesFound} files matching pattern.`,
            variant: "default"
          });
        }
      } else {
        toast({
          title: "Connection or Download Failed",
          description: result.details || result.error || "Connection test and download failed",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error testing connection and downloading:', error);
      toast({
        title: "Error",
        description: "Failed to test connection and download file",
        variant: "destructive"
      });
    } finally {
      setIsTestingAndDownloading(false);
    }
  };

  const previewLocalCSV = async () => {
    if (!latestDownloadedFile) return;

    try {
      setCsvAnalysisLoading(true);
      setCsvAnalysisError(null);
      
      console.log('Previewing local CSV file:', latestDownloadedFile);
      
      const requestBody = {
        localFileName: latestDownloadedFile.localName,
        originalFileName: latestDownloadedFile.originalName
      };
      console.log('Request body:', requestBody);
      
      const response = await fetch('http://localhost:3000/api/import/preview-local-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', response.status, errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Local CSV preview response:', result);
      
      if (result.success) {
        // Set the CSV data for the modal
        const csvDataToSet = {
          headers: result.headers,
          sampleData: result.sampleData,
          totalRows: result.totalRows,
          fileName: result.fileName,
          fieldMappings: result.fieldMappings,
          configId: null, // No config ID since this is just a preview
          isLocalFile: true,
          localFileName: result.localFileName
        };
        
        setCsvData(csvDataToSet);
        console.log('Local CSV Data set successfully:', csvDataToSet);
        setShowCSVModal(true);
        
        toast({
          title: "Local CSV Preview Loaded!",
          description: `Found ${result.totalRows} rows with ${result.headers?.length || 0} columns in ${result.fileName}`,
        });
      } else {
        setCsvAnalysisError(result.details || result.error || "Failed to preview local CSV");
        toast({
          title: "Local CSV Preview Failed",
          description: result.details || result.error || "Failed to preview local CSV",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error previewing local CSV:', error);
      setCsvAnalysisError(error instanceof Error ? error.message : "Failed to preview local CSV");
      toast({
        title: "Local CSV Preview Error",
        description: error instanceof Error ? error.message : "Failed to preview local CSV",
        variant: "destructive"
      });
    } finally {
      setCsvAnalysisLoading(false);
    }
  };

  const previewCSV = async () => {
    console.log('=== PREVIEW CSV CALLED ===');
    console.log('Latest downloaded file:', latestDownloadedFile);
    
    // If we have a recently downloaded file, use it instead of making a new connection
    if (latestDownloadedFile) {
      console.log('Using local file for preview:', latestDownloadedFile.originalName);
      toast({
        title: "Using Downloaded File",
        description: `Previewing local file: ${latestDownloadedFile.originalName}`,
        variant: "default"
      });
      await previewLocalCSV();
      return;
    }

    console.log('No local file available, checking remote connection...');
    
    // Fall back to remote CSV preview
    if (!currentConfig?.connection) {
      toast({
        title: "No Connection or Downloaded File",
        description: "Please configure connection settings or use 'Test & Download' to get a file first.",
        variant: "destructive"
      });
      return;
    }

    // Validate required fields before previewing
    if (!currentConfig.connection.hostUrl || !currentConfig.connection.username || !currentConfig.connection.password) {
      const missingFields = [];
      if (!currentConfig.connection.hostUrl) missingFields.push("Host URL");
      if (!currentConfig.connection.username) missingFields.push("Username");
      if (!currentConfig.connection.password) missingFields.push("Password");
      
      const isEditingExisting = currentConfig.id && preloadedConfig;
      const passwordMessage = isEditingExisting && missingFields.includes("Password") 
        ? "Please re-enter the password for security reasons." 
        : "";
      
      toast({
        title: "Missing Information",
        description: `Please fill in: ${missingFields.join(", ")}. ${passwordMessage}`,
        variant: "destructive"
      });
      return;
    }

    try {
      setCsvAnalysisLoading(true);
      setCsvAnalysisError(null);
      
      // Convert camelCase to the format expected by the backend
      const connectionData = {
        connectionType: currentConfig.connection.type,
        hostUrl: currentConfig.connection.hostUrl,
        port: currentConfig.connection.port,
        username: currentConfig.connection.username,
        password: currentConfig.connection.password,
        remoteDirectory: currentConfig.connection.remoteDirectory,
        filePattern: currentConfig.connection.filePattern
      };
      
      console.log('Sending preview CSV request:', connectionData);
      
      const response = await fetch('http://localhost:3000/api/import/preview-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(connectionData)
      });

      const result = await response.json();
      console.log('Preview CSV response:', result);
      
      if (result.success) {
        // Set the CSV data for the modal
        const csvDataToSet = {
          headers: result.headers,
          sampleData: result.sampleData,
          totalRows: result.totalRows,
          fileName: result.fileName,
          fieldMappings: result.fieldMappings,
          configId: null, // No config ID since this is just a preview
          connectionData: {
            connectionType: currentConfig.connection.type,
            hostUrl: currentConfig.connection.hostUrl,
            port: currentConfig.connection.port,
            username: currentConfig.connection.username,
            password: currentConfig.connection.password,
            remoteDirectory: currentConfig.connection.remoteDirectory,
            filePattern: currentConfig.connection.filePattern
          }
        };
        
        setCsvData(csvDataToSet);
        console.log('CSV Data set successfully:', csvDataToSet);
        console.log('CSV Headers:', csvDataToSet.headers);
        console.log('CSV Headers length:', csvDataToSet.headers?.length);
        setShowCSVModal(true);
        
        toast({
          title: "CSV Preview Successful!",
          description: `Found ${result.totalRows} rows in ${result.fileName}`,
        });
      } else {
        setCsvAnalysisError(result.details || result.error || "Failed to preview CSV");
        toast({
          title: "CSV Preview Failed",
          description: result.details || result.error || "Failed to preview CSV data",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error previewing CSV:', error);
      setCsvAnalysisError(error instanceof Error ? error.message : "Failed to preview CSV");
      toast({
        title: "CSV Preview Error",
        description: error instanceof Error ? error.message : "Failed to preview CSV",
        variant: "destructive"
      });
    } finally {
      setCsvAnalysisLoading(false);
    }
  };

  const executeImport = async (configId: number) => {
    try {
      // Find the config to check field mappings
      const config = configs.find(c => c.id === configId);
      if (!config) {
        toast({
          title: "Configuration Not Found",
          description: "The import configuration could not be found",
          variant: "destructive"
        });
        return;
      }

      // Check if field mappings exist
      if (!config.fieldMappings || config.fieldMappings.length === 0) {
        toast({
          title: "No Field Mappings",
          description: "This configuration has no field mappings. Please edit the configuration and add field mappings before importing.",
          variant: "destructive"
        });
        return;
      }

      // Check if required fields are mapped
      const requiredMappings = config.fieldMappings.filter(fm => fm.is_required);
      if (requiredMappings.length === 0) {
        toast({
          title: "Missing Required Fields",
          description: "No required fields are mapped. Please add mappings for required fields like VIN, Make, Model, and Year.",
          variant: "destructive"
        });
        return;
      }

      // Check if there are any unmatched fields
      const unmatchedFields = config.fieldMappings.filter(fm => !fm.target_field || fm.target_field === '');
      if (unmatchedFields.length > 0) {
        toast({
          title: "Unmatched Fields",
          description: `${unmatchedFields.length} field(s) are not mapped. Please complete all field mappings before importing.`,
          variant: "destructive"
        });
        return;
      }

      setIsExecutingImport(true);
      
      const response = await fetch(`http://localhost:3000/api/import/configs/${configId}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Import Successful",
          description: `Processed ${result.data.recordsProcessed} records. Inserted: ${result.data.recordsInserted}, Updated: ${result.data.recordsUpdated}, Skipped: ${result.data.recordsSkipped}, Failed: ${result.data.recordsFailed}`
        });
      } else {
        toast({
          title: "Import Failed",
          description: result.error || "Import execution failed",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error executing import:', error);
      toast({
        title: "Error",
        description: "Failed to execute import",
        variant: "destructive"
      });
    } finally {
      setIsExecutingImport(false);
    }
  };

  const editConfig = async (config: ImportConfigResponse) => {
    try {
      // Load the full configuration including field mappings
      const response = await fetch(`http://localhost:3000/api/import/configs/${config.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load configuration details');
      }

      const result = await response.json();
      const fullConfig = result.data;

      // Convert API response format to form format
      const formConfig: ImportConfig = {
        id: fullConfig.id,
        configName: fullConfig.config_name,
        connection: {
          type: fullConfig.connection_type || 'sftp',
          hostUrl: fullConfig.host_url || '',
          port: fullConfig.port || 22,
          username: fullConfig.username || '',
          password: fullConfig.password || '', // Load password from API
          remoteDirectory: fullConfig.remote_directory || '/',
          filePattern: fullConfig.file_pattern || '*.csv'
        },
        fileSettings: {
          fileType: fullConfig.file_type || 'csv',
          delimiter: fullConfig.delimiter || ',',
          hasHeader: fullConfig.has_header !== false,
          encoding: fullConfig.encoding || 'UTF-8',
          dateFormat: fullConfig.date_format || 'YYYY-MM-DD'
        },
        schedule: {
          frequency: fullConfig.frequency || 'manual',
          timeHour: fullConfig.time_hour || 0,
          timeMinute: fullConfig.time_minute || 0,
          dayOfWeek: fullConfig.day_of_week,
          dayOfMonth: fullConfig.day_of_month
        },
        fieldMappings: (fullConfig.fieldMappings || []).map((mapping: any) => {
          const dbField = getDatabaseFields().find(f => f.value === mapping.target_field);
          const correctIsRequired = dbField?.required || false;
          
          // Log if there's a mismatch between stored and correct isRequired value
          if (mapping.is_required !== correctIsRequired) {
            console.log(`Loading field mapping: ${mapping.target_field} - stored isRequired=${mapping.is_required}, correct isRequired=${correctIsRequired}`);
          }
          
          return {
            sourceField: mapping.source_field || '',
            targetField: mapping.target_field || '',
            fieldType: mapping.field_type || 'string',
            isRequired: mapping.is_required, // Use the actual stored value from database
            isEnabled: true, // Default to enabled for frontend-only property
            defaultValue: mapping.default_value || '',
            transformationRule: mapping.transformation_rule || '',
            fieldOrder: mapping.field_order || 1
          };
        }),
        processing: {
          duplicateHandling: fullConfig.duplicate_handling || 'skip',
          batchSize: fullConfig.batch_size || 1000,
          maxErrors: fullConfig.max_errors || 100,
          validateData: fullConfig.validate_data !== false,
          archiveProcessedFiles: fullConfig.archive_processed_files !== false,
          archiveDirectory: fullConfig.archive_directory || '/processed'
        }
      };
      
      setCurrentConfig(formConfig);
      setIsEditing(true);
      setShowPassword(false); // Reset password visibility when editing
      
      // Call the onEditConfig prop if provided
      if (onEditConfig) {
        onEditConfig(config.id);
      }
    } catch (error) {
      console.error('Error loading configuration details:', error);
      toast({
        title: "Error",
        description: "Failed to load configuration details",
        variant: "destructive"
      });
    }
  };

  const smartImport = async () => {
    if (!currentConfig) {
      toast({
        title: "No Configuration",
        description: "Please fill in the connection details first",
        variant: "destructive"
      });
      return;
    }

    // Validate required connection fields
    if (!currentConfig.connection.hostUrl || !currentConfig.connection.username || !currentConfig.connection.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in Host URL, Username, and Password before smart import",
        variant: "destructive"
      });
      return;
    }

    // Use configuration name from form, or prompt if empty
    let configName = currentConfig.configName;
    if (!configName) {
      configName = prompt('Enter a name for this import configuration:');
      if (!configName) return;
    }

    try {
      setIsLoading(true);
      
      const connectionData = {
        connectionType: currentConfig.connection.type,
        hostUrl: currentConfig.connection.hostUrl,
        port: currentConfig.connection.port,
        username: currentConfig.connection.username,
        password: currentConfig.connection.password,
        remoteDirectory: currentConfig.connection.remoteDirectory,
        filePattern: currentConfig.connection.filePattern
      };

      console.log('Starting smart import with:', { configName, connectionData });
      
      const response = await fetch('http://localhost:3000/api/import/smart-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ configName, connectionData })
      });

      const result = await response.json();
      console.log('Smart import result:', result);
      
      if (!response.ok) {
        if (response.status === 409) {
          // Configuration already exists
          const existingConfigId = result.existingConfigId;
          
          console.log('Configuration already exists, showing confirmation dialog...');
          
          // Show a more user-friendly message first
          toast({
            title: "Configuration Exists",
            description: `A configuration named "${configName}" already exists. You can edit it or use a different name.`,
            variant: "default"
          });
          
          // Add a small delay to ensure the toast is visible
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const shouldUseExisting = confirm(
            `A configuration named "${configName}" already exists (ID: ${existingConfigId}).\n\nWould you like to edit the existing configuration instead?\n\nClick OK to edit existing configuration\nClick Cancel to use a different name`
          );
          
          console.log('User choice:', shouldUseExisting);
          
          if (shouldUseExisting) {
            console.log('Loading existing configuration for editing...');
            // Load the existing configuration for editing
            const existingConfig = await fetch(`http://localhost:3000/api/import/configs/${existingConfigId}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
              }
            });
            
            if (existingConfig.ok) {
              const existingConfigData = await existingConfig.json();
              console.log('Existing config data loaded:', existingConfigData);
              editConfig(existingConfigData.data);
              toast({
                title: "Configuration Loaded",
                description: "Existing configuration loaded for editing. You can now modify the settings.",
                variant: "default"
              });
            } else {
              console.error('Failed to load existing configuration:', existingConfig.status);
              toast({
                title: "Error Loading Configuration",
                description: "Failed to load existing configuration",
                variant: "destructive"
              });
            }
          } else {
            console.log('User chose to use different name');
            toast({
              title: "Configuration Name Conflict",
              description: "Please use a different configuration name or try Quick Import instead.",
              variant: "destructive"
            });
          }
        } else {
          console.error('Smart import failed with status:', response.status);
          toast({
            title: "Smart Import Failed",
            description: result.error || `HTTP ${response.status}: ${response.statusText}`,
            variant: "destructive"
          });
        }
        return;
      }
      
      if (result.success) {
        toast({
          title: "Smart Import Successful!",
          description: `Configuration created with ${result.data.headers.length} field mappings. File: ${result.data.fileName}`
        });
        
        // Update the current config with the field mappings
        setCurrentConfig({
          ...currentConfig,
          configName: configName,
          fieldMappings: result.data.fieldMappings
        });
        
        // Reload configs to show the new configuration
        loadConfigs();
        
        // Show detailed results in console
        console.log('Field Mappings Created:', result.data.fieldMappings);
        console.log('Sample Data:', result.data.sampleData);
        console.log('Total Rows:', result.data.totalRows);
        
      } else {
        toast({
          title: "Smart Import Failed",
          description: result.error || "Failed to create smart import configuration",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error in smart import:', error);
      toast({
        title: "Error",
        description: "Failed to perform smart import",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const quickImport = async () => {
    if (!currentConfig) {
      toast({
        title: "No Configuration",
        description: "Please fill in the connection details first",
        variant: "destructive"
      });
      return;
    }

    // Validate required connection fields
    if (!currentConfig.connection.hostUrl || !currentConfig.connection.username || !currentConfig.connection.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in Host URL, Username, and Password before quick import",
        variant: "destructive"
      });
      return;
    }

    // Use configuration name from form, or prompt if empty
    let configName = currentConfig.configName;
    if (!configName) {
      configName = prompt('Enter a name for this import configuration:');
      if (!configName) return;
    }

    try {
      setCsvAnalysisLoading(true);
      setCsvAnalysisError(null);
      
      const connectionData = {
        connectionType: currentConfig.connection.type,
        hostUrl: currentConfig.connection.hostUrl,
        port: currentConfig.connection.port,
        username: currentConfig.connection.username,
        password: currentConfig.connection.password,
        remoteDirectory: currentConfig.connection.remoteDirectory,
        filePattern: currentConfig.connection.filePattern
      };

      console.log('Starting quick import with:', { configName, connectionData });
      
      // First, check if a configuration with this name already exists
              const checkResponse = await fetch(`http://localhost:3000/api/import/configs/check-name?name=${encodeURIComponent(configName)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();
        if (checkResult.exists) {
          // Configuration exists, ask user if they want to use it
          const shouldUseExisting = confirm(
            `A configuration named "${configName}" already exists.\n\nWould you like to use the existing configuration for this import?\n\nClick OK to use existing configuration\nClick Cancel to use a different name`
          );
          
          if (shouldUseExisting) {
            // Use existing configuration
            const existingConfig = await fetch(`http://localhost:3000/api/import/configs/${checkResult.configId}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
              }
            });
            
            if (existingConfig.ok) {
              const existingConfigData = await existingConfig.json();
              console.log('Using existing config:', existingConfigData);
              
              // Execute import with existing configuration
              const executeResponse = await fetch(`http://localhost:3000/api/import/configs/${checkResult.configId}/execute`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                  selectedRows: [], // Import all rows
                  fieldMappings: existingConfigData.data.fieldMappings || []
                })
              });

              const executeResult = await executeResponse.json();
              
              if (executeResponse.ok && executeResult.success) {
                toast({
                  title: "Quick Import Successful!",
                  description: `Imported ${executeResult.importedCount || 0} records using existing configuration.`
                });
                loadConfigs(); // Refresh the configs list
              } else {
                toast({
                  title: "Quick Import Failed",
                  description: executeResult.error || "Failed to execute import with existing configuration",
                  variant: "destructive"
                });
              }
            } else {
              toast({
                title: "Error",
                description: "Failed to load existing configuration",
                variant: "destructive"
              });
            }
          } else {
            toast({
              title: "Configuration Name Conflict",
              description: "Please use a different configuration name.",
              variant: "destructive"
            });
          }
        } else {
          // No existing configuration, create a new one and execute
          const createResponse = await fetch('http://localhost:3000/api/import/smart-import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ configName, connectionData })
          });

          const createResult = await createResponse.json();
          
          if (createResponse.ok && createResult.success) {
            // Execute import immediately with the new configuration
            const executeResponse = await fetch(`http://localhost:3000/api/import/configs/${createResult.data.configId}/execute`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
              },
              body: JSON.stringify({
                selectedRows: [], // Import all rows
                fieldMappings: createResult.data.fieldMappings || []
              })
            });

            const executeResult = await executeResponse.json();
            
            if (executeResponse.ok && executeResult.success) {
              toast({
                title: "Quick Import Successful!",
                description: `Created new configuration and imported ${executeResult.importedCount || 0} records.`
              });
              loadConfigs(); // Refresh the configs list
            } else {
              toast({
                title: "Quick Import Failed",
                description: executeResult.error || "Failed to execute import with new configuration",
                variant: "destructive"
              });
            }
          } else {
            toast({
              title: "Quick Import Failed",
              description: createResult.error || "Failed to create configuration for quick import",
              variant: "destructive"
            });
          }
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to check for existing configurations",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Quick import error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setCsvAnalysisLoading(false);
    }
  };

  const handleCSVImport = async (selectedRows: number[], transformedData?: any[]) => {
    try {
      // Validate field mappings before import
      if (!currentConfig.fieldMappings || currentConfig.fieldMappings.length === 0) {
        toast({
          title: "No Field Mappings",
          description: "Please configure field mappings before importing.",
          variant: "destructive"
        });
        return;
      }

      // Check for enabled field mappings with target fields
      const enabledMappings = currentConfig.fieldMappings.filter(fm => 
        fm.isEnabled && fm.targetField && fm.targetField !== ''
      );

      if (enabledMappings.length === 0) {
        toast({
          title: "No Valid Field Mappings",
          description: "Please enable and configure field mappings with target fields before importing.",
          variant: "destructive"
        });
        return;
      }

      // Check for required fields
      const requiredMappings = enabledMappings.filter(fm => fm.isRequired);
      if (requiredMappings.length === 0) {
        toast({
          title: "Missing Required Fields",
          description: "Please map required fields like VIN, Make, Model, and Year before importing.",
          variant: "destructive"
        });
        return;
      }

      setIsExecutingImport(true);
      
      let executeResponse;
      let executeResult;
      
      if (csvData?.configId) {
        // Use existing configuration
        console.log('Executing import with existing configuration:', csvData.configId);
        executeResponse = await fetch(`http://localhost:3000/api/import/configs/${csvData.configId}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            selectedRows,
            fieldMappings: enabledMappings, // Use validated mappings
            transformedData: transformedData || null // Include transformed data if available
          })
        });
      } else {
        // Use preview data (no saved configuration)
        console.log('Executing import from preview data');
        const connectionData = csvData.connectionData || {
          connectionType: currentConfig?.connection?.type || 'sftp',
          hostUrl: currentConfig?.connection?.hostUrl || '',
          port: currentConfig?.connection?.port || 22,
          username: currentConfig?.connection?.username || '',
          password: currentConfig?.connection?.password || '',
          remoteDirectory: currentConfig?.connection?.remoteDirectory || '',
          filePattern: currentConfig?.connection?.filePattern || '*.csv'
        };
        
        executeResponse = await fetch('http://localhost:3000/api/import/preview-execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            connectionData,
            selectedRows,
            fieldMappings: enabledMappings, // Use validated mappings
            csvData,
            transformedData: transformedData || null // Include transformed data if available
          })
        });
      }

      executeResult = await executeResponse.json();
      console.log('Execute import result:', executeResult);
      
      if (!executeResponse.ok) {
        toast({
          title: "Import Execution Failed",
          description: executeResult.error || `HTTP ${executeResponse.status}: ${executeResponse.statusText}`,
          variant: "destructive"
        });
        return;
      }
      
      if (executeResult.success) {
        const data = executeResult.data;
        toast({
          title: "Import Successful!",
          description: `Processed ${data.recordsProcessed} records. Inserted: ${data.recordsInserted}, Updated: ${data.recordsUpdated}, Skipped: ${data.recordsSkipped}, Failed: ${data.recordsFailed}`,
          variant: "default"
        });
        
        // Close the modal and refresh configs
        setShowCSVModal(false);
        setCsvData(null);
        loadConfigs();
      } else {
        toast({
          title: "Import Failed",
          description: executeResult.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Import execution error:', error);
      toast({
        title: "Import Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsExecutingImport(false);
    }
  };

  const deleteConfig = async (configId: number) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:3000/api/import/configs/${configId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        toast({
          title: "Configuration Deleted",
          description: "Import configuration has been deleted successfully",
        });
        loadConfigs();
      } else {
        const result = await response.json();
        toast({
          title: "Delete Failed",
          description: result.error || "Failed to delete configuration",
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

  // Function to fill field mappings array with current mappings
  const fillFieldMappingsFromCurrent = () => {
    try {
      // Validate that field mappings exist
      if (!currentConfig.fieldMappings || currentConfig.fieldMappings.length === 0) {
        toast({
          title: "No Field Mappings",
          description: "No field mappings available to fill the array.",
          variant: "destructive"
        });
        return;
      }

      // Read ALL current field mappings from the mappings tab (including unmatched and disabled ones)
      const allCurrentMappings = [...currentConfig.fieldMappings];

      if (allCurrentMappings.length === 0) {
        toast({
          title: "No Field Mappings",
          description: "No field mappings found in the mappings tab.",
          variant: "destructive"
        });
        return;
      }

      // Keep current isRequired and isEnabled settings without resetting them
      const updatedMappings = allCurrentMappings.map(mapping => {
        const dbField = getDatabaseFields().find(f => f.value === mapping.targetField);
        const correctIsRequired = dbField?.required || false;
        
        // Log if there's a mismatch but don't change the value
        if (mapping.isRequired !== correctIsRequired) {
          console.log(`Field mapping mismatch for ${mapping.targetField}: current=${mapping.isRequired}, database_requires=${correctIsRequired} (keeping current value)`);
        }
        
        return {
          ...mapping,
          // Keep the current isRequired and isEnabled values as they are
          isRequired: mapping.isRequired,
          isEnabled: mapping.isEnabled
        };
      });

      // Update the field mappings array with ALL current mappings from the mappings tab
      setCurrentConfig(prev => ({
        ...prev,
        fieldMappings: updatedMappings
      }));

      // Print the field mappings array to console
      console.log('=== Field Mappings Array Filled from Mappings Tab ===');
      console.log('Total mappings read from mappings tab:', updatedMappings.length);
      console.log('Field mappings array:', updatedMappings);
      console.log('Mappings breakdown:');
      updatedMappings.forEach((mapping, index) => {
        const status = mapping.isEnabled ? 'Enabled' : 'Disabled';
        const targetStatus = mapping.targetField && mapping.targetField !== '' ? 'Mapped' : 'Unmapped';
        console.log(`${index + 1}. ${mapping.sourceField} → ${mapping.targetField || 'UNMAPPED'} (${mapping.fieldType}) - ${status} - ${targetStatus} - Required: ${mapping.isRequired}`);
      });
      console.log('=== End Field Mappings Array ===');

      // Count different types of mappings
      const enabledMappings = updatedMappings.filter(m => m.isEnabled);
      const disabledMappings = updatedMappings.filter(m => !m.isEnabled);
      const mappedMappings = updatedMappings.filter(m => m.targetField && m.targetField !== '');
      const unmappedMappings = updatedMappings.filter(m => !m.targetField || m.targetField === '');
      const requiredMappings = updatedMappings.filter(m => m.isRequired);

      toast({
        title: "Field Mappings Array Updated",
        description: `Successfully filled array with ${updatedMappings.length} field mappings from mappings tab. Enabled: ${enabledMappings.length}, Mapped: ${mappedMappings.length}, Required: ${requiredMappings.length}`,
      });
    } catch (error) {
      console.error('Error filling field mappings array:', error);
      toast({
        title: "Error",
        description: "Failed to fill field mappings array from mappings tab.",
        variant: "destructive"
      });
    }
  };

  const debugFieldMappings = () => {
    console.log('=== DEBUG: Current Field Mappings ===');
    if (!currentConfig.fieldMappings || currentConfig.fieldMappings.length === 0) {
      console.log('No field mappings found');
      return;
    }
    
    currentConfig.fieldMappings.forEach((mapping, index) => {
      const dbField = getDatabaseFields().find(f => f.value === mapping.targetField);
      const correctIsRequired = dbField?.required || false;
      const hasMismatch = mapping.isRequired !== correctIsRequired;
      
      console.log(`${index + 1}. ${mapping.sourceField} → ${mapping.targetField}`);
      console.log(`   - Current isRequired: ${mapping.isRequired}`);
      console.log(`   - Correct isRequired: ${correctIsRequired}`);
      console.log(`   - Has mismatch: ${hasMismatch ? 'YES' : 'NO'}`);
      console.log(`   - Enabled: ${mapping.isEnabled}`);
      console.log(`   - Field Type: ${mapping.fieldType}`);
      console.log('---');
    });
    console.log('=== END DEBUG ===');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Data Import Configuration</h1>
          <p className="text-muted-foreground">
            Configure automated imports from external systems via FTP/SFTP
          </p>
        </div>
        <div className="flex gap-2">
          {preloadedConfig && onCancel && (
            <Button 
              variant="outline" 
              onClick={onCancel} 
              className="flex items-center gap-2"
            >
              ← Back to List
            </Button>
          )}
        <Button onClick={handleNewConfiguration} className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          New Configuration
        </Button>
        </div>
      </div>

      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Import Configuration</CardTitle>
            <CardDescription>
              Configure import settings for external data sources. Use "Smart Import" to auto-detect field mappings, or "Quick Import" to create and execute in one step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="connection">Connection</TabsTrigger>
                <TabsTrigger value="test">Test</TabsTrigger>
                <TabsTrigger value="mappings">Field Mappings</TabsTrigger>
                <TabsTrigger value="processing">Processing</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="file">File Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="connection" className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Fill in the connection details below, then use "Smart Import" to automatically detect and map CSV fields, or "Quick Import" to create and execute the import immediately.
                  </AlertDescription>
                </Alert>
                
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
                      placeholder="e.g., vAuto Import"
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
                        <SelectItem value="sftp">SFTP</SelectItem>
                        <SelectItem value="ftp">FTP</SelectItem>
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
                      placeholder="e.g., 159.65.248.5"
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
                      placeholder={currentConfig.connection.type === 'sftp' ? '22' : '21'}
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
                      placeholder="e.g., dealeriq"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={currentConfig.connection.password}
                        onChange={(e) => setCurrentConfig({
                          ...currentConfig,
                          connection: { ...currentConfig.connection, password: e.target.value }
                        })}
                        placeholder={currentConfig.id ? "Re-enter password to test connection" : "Enter password"}
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
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="remoteDirectory">Remote Directory</Label>
                    <Input
                      id="remoteDirectory"
                      value={currentConfig.connection.remoteDirectory}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        connection: { ...currentConfig.connection, remoteDirectory: e.target.value }
                      })}
                      placeholder="/public/vauto"
                    />
                  </div>
                  <div>
                    <Label htmlFor="filePattern">File Pattern</Label>
                    <Input
                      id="filePattern"
                      value={currentConfig.connection.filePattern}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        connection: { ...currentConfig.connection, filePattern: e.target.value }
                      })}
                      placeholder="*.csv"
                    />
                  </div>
                </div>
                
                <TabNavigation />
              </TabsContent>

              <TabsContent value="file" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fileType">File Type</Label>
                    <Select
                      value={currentConfig.fileSettings.fileType}
                      onValueChange={(value: 'csv' | 'xml' | 'json') => setCurrentConfig({
                        ...currentConfig,
                        fileSettings: { ...currentConfig.fileSettings, fileType: value }
                      })}
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
                    <Label htmlFor="delimiter">Delimiter (CSV)</Label>
                    <Input
                      id="delimiter"
                      value={currentConfig.fileSettings.delimiter}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        fileSettings: { ...currentConfig.fileSettings, delimiter: e.target.value }
                      })}
                      placeholder=","
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="encoding">Encoding</Label>
                    <Input
                      id="encoding"
                      value={currentConfig.fileSettings.encoding}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        fileSettings: { ...currentConfig.fileSettings, encoding: e.target.value }
                      })}
                      placeholder="UTF-8"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <Input
                      id="dateFormat"
                      value={currentConfig.fileSettings.dateFormat}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        fileSettings: { ...currentConfig.fileSettings, dateFormat: e.target.value }
                      })}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="hasHeader"
                    checked={currentConfig.fileSettings.hasHeader}
                    onCheckedChange={(checked) => setCurrentConfig({
                      ...currentConfig,
                      fileSettings: { ...currentConfig.fileSettings, hasHeader: checked }
                    })}
                  />
                  <Label htmlFor="hasHeader">File has header row</Label>
                </div>
                
                <TabNavigation />
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select
                      value={currentConfig.schedule.frequency}
                      onValueChange={(value: 'manual' | 'hourly' | 'daily' | 'weekly' | 'monthly') => setCurrentConfig({
                        ...currentConfig,
                        schedule: { ...currentConfig.schedule, frequency: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Only</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="time">Time</Label>
                    <div className="flex gap-2">
                      <Select
                        value={(currentConfig.schedule.timeHour || 0).toString()}
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
                        value={(currentConfig.schedule.timeMinute || 0).toString()}
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
                
                <TabNavigation />
              </TabsContent>

              <TabsContent value="mappings" className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Map CSV columns to vehicle database fields. The system will automatically transform and validate the data.
                  </AlertDescription>
                </Alert>
                
                {/* Show message when no CSV data is loaded */}
                {!csvData && (
                  <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                    <div className="flex items-center space-x-2">
                      <Upload className="h-5 w-5 text-yellow-600" />
                      <div>
                        <h4 className="font-medium text-yellow-800">No CSV Data Loaded</h4>
                        <p className="text-sm text-yellow-700">
                          You can manually configure field mappings below, or load CSV data by going to the <strong>Connection</strong> tab and clicking <strong>"Preview CSV"</strong> for automatic mapping.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Enhanced CSV Field Detection */}
                {csvData && csvData.headers && csvData.headers.length > 0 && (
                  <div className="p-4 border rounded-lg bg-green-50 border-green-200 mb-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <Database className="h-5 w-5 text-green-600" />
                      <div>
                        <h4 className="font-medium text-green-800">CSV Fields Detected</h4>
                        <p className="text-sm text-green-700">
                          Found {csvData.headers.length} fields in your CSV file. Use smart mapping or configure manually below.
                        </p>
                      </div>
                    </div>
                    
                    {/* CSV Fields Display */}
                    <div className="mb-3">
                      <h5 className="text-sm font-medium text-green-800 mb-2">Available CSV Fields:</h5>
                      <div className="flex flex-wrap gap-2">
                        {csvData.headers.map((field) => (
                          <Badge key={field} variant="outline" className="text-xs bg-white">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {currentConfig.fieldMappings.length === 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm text-yellow-800">
                          💡 <strong>Tip:</strong> Click "Apply Smart Mapping" to automatically map CSV fields to database columns
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Field Mappings Configuration - Always Visible */}
                <div className="p-4 border rounded-lg bg-gray-50">
                  <h4 className="font-medium text-sm mb-4">Field Mappings Configuration</h4>
                  
                  {/* Warning about supported fields */}
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-600 mt-0.5">ℹ️</span>
                      <div className="text-sm text-blue-700">
                        <p className="font-medium mb-1">Import Function Limitation</p>
                        <p>
                          Only certain database fields are supported by the import function. 
                          Fields marked as "Unsupported" will be ignored during import. 
                          For mileage data, use "Odometer/Mileage" field instead of "Mileage".
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Smart Mapping Button */}
                  <div className="flex justify-between items-center mb-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        console.log('Apply Smart Mapping clicked');
                        console.log('CSV Data:', csvData);
                        
                        if (csvData && csvData.headers && csvData.headers.length > 0) {
                          const csvFields = csvData.headers;
                          console.log('CSV Fields found:', csvFields);
                          const existingMappings = currentConfig.fieldMappings || [];
                          
                          // Create new mappings from CSV fields, preserving existing settings where possible
                          const newMappings = csvFields.map((csvField, index) => {
                            const targetField = getEnhancedSmartMapping(csvField) || getSmartMapping(csvField);
                            
                            // Check if this field already exists in current mappings
                            const existingMapping = existingMappings.find(m => m.sourceField === csvField);
                            
                            if (existingMapping) {
                              // Preserve existing mapping settings
                              console.log(`Preserving existing mapping for ${csvField} -> ${existingMapping.targetField} (required: ${existingMapping.isRequired})`);
                              return {
                                ...existingMapping,
                                fieldOrder: index + 1 // Update order but keep other settings
                              };
                            } else {
                              // Create new mapping with default settings
                              const isRequired = targetField ? isRequiredField(targetField) : false;
                              console.log(`Creating new mapping for ${csvField} -> ${targetField} (required: ${isRequired})`);
                              return {
                                sourceField: csvField,
                                targetField: targetField || '', // Keep empty string for unmatched fields
                                fieldType: targetField ? getFieldType(targetField) : 'string',
                                isRequired: true, // Default to required
                                isEnabled: targetField !== '', // Disable unmatched fields by default
                                defaultValue: '',
                                transformationRule: '',
                                fieldOrder: index + 1
                              };
                            }
                          });
                          
                          // Merge with existing mappings that aren't in the CSV
                          const existingMappingsNotInCSV = existingMappings.filter(existing => 
                            !csvFields.includes(existing.sourceField)
                          );
                          
                          const mergedMappings = [...newMappings, ...existingMappingsNotInCSV];
                          
                          setCurrentConfig({
                            ...currentConfig,
                            fieldMappings: mergedMappings
                          });
                          
                          const mappedCount = mergedMappings.filter(m => m.targetField !== '').length;
                          const totalCount = mergedMappings.length;
                          const requiredCount = mergedMappings.filter(m => m.isRequired).length;
                          const unmatchedCount = totalCount - mappedCount;
                          
                          toast({
                            title: "Smart mapping applied",
                            description: `Processed ${totalCount} CSV fields: ${mappedCount} mapped, ${unmatchedCount} unmatched (${requiredCount} required fields enabled)`,
                          });
                        } else {
                          toast({
                            title: "No CSV data",
                            description: "Please load CSV data first to apply smart mapping",
                            variant: "destructive"
                          });
                        }
                      }}
                      disabled={!csvData || !csvData.headers || csvData.headers.length === 0}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Apply Smart Mapping
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCurrentConfig({
                          ...currentConfig,
                          fieldMappings: []
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  </div>
                  
                  {/* Add Field Mapping Button */}
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const newMapping = {
                          sourceField: '',
                          targetField: '',
                          fieldType: 'string' as const,
                          isRequired: true, // Default to required
                          isEnabled: true,
                          defaultValue: '',
                          transformationRule: '',
                          fieldOrder: currentConfig.fieldMappings.length + 1
                        };
                        setCurrentConfig({
                          ...currentConfig,
                          fieldMappings: [...currentConfig.fieldMappings, newMapping]
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field Mapping
                    </Button>
                  </div>
                  
                  {/* Load Field Mappings from FTP Button */}
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          // First load CSV data to get field names
                          await previewCSV();
                          
                          if (csvData && csvData.headers && csvData.headers.length > 0) {
                            const csvFields = csvData.headers;
                            const existingMappings = currentConfig.fieldMappings || [];
                            
                            // Create new mappings from CSV fields, preserving existing settings where possible
                            const newMappings = csvFields.map((csvField, index) => {
                              const targetField = getEnhancedSmartMapping(csvField) || getSmartMapping(csvField);
                              
                              // Check if this field already exists in current mappings
                              const existingMapping = existingMappings.find(m => m.sourceField === csvField);
                              
                              if (existingMapping) {
                                // Preserve existing mapping settings
                                return {
                                  ...existingMapping,
                                  fieldOrder: index + 1 // Update order but keep other settings
                                };
                              } else {
                                // Create new mapping with default settings
                                const isRequired = targetField ? isRequiredField(targetField) : false;
                                                              return {
                                sourceField: csvField,
                                targetField: targetField || '', // Keep empty string for unmatched fields
                                fieldType: targetField ? getFieldType(targetField) : 'string',
                                isRequired: true, // Default to required
                                isEnabled: targetField !== '', // Disable unmatched fields by default
                                defaultValue: '',
                                transformationRule: '',
                                fieldOrder: index + 1
                              };
                              }
                            });
                            
                            // Merge with existing mappings that aren't in the CSV
                            const existingMappingsNotInCSV = existingMappings.filter(existing => 
                              !csvFields.includes(existing.sourceField)
                            );
                            
                            const mergedMappings = [...newMappings, ...existingMappingsNotInCSV];
                            
                            setCurrentConfig({
                              ...currentConfig,
                              fieldMappings: mergedMappings
                            });
                            
                            const mappedCount = mergedMappings.filter(m => m.targetField !== '').length;
                            const totalCount = mergedMappings.length;
                            const requiredCount = mergedMappings.filter(m => m.isRequired).length;
                            const unmatchedCount = totalCount - mappedCount;
                            
                            toast({
                              title: "Field mappings loaded from FTP",
                              description: `Processed ${totalCount} CSV fields: ${mappedCount} mapped, ${unmatchedCount} unmatched (${requiredCount} required fields enabled)`,
                            });
                          } else {
                            toast({
                              title: "No CSV data",
                              description: "Please check your FTP connection and try again",
                              variant: "destructive"
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Error loading field mappings",
                            description: "Failed to connect to FTP or load CSV data",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Load Field Mappings from FTP
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Field Mapping Summary */}
                  {(currentConfig.fieldMappings || []).length > 0 && (
                    <div className="p-4 border rounded-lg bg-blue-50">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-blue-900">Field Mapping Summary</h3>
                        <div className="flex space-x-2">
                          <Badge variant="default" className="text-xs">
                            Total: {currentConfig.fieldMappings.length}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-green-600">
                            Mapped: {currentConfig.fieldMappings.filter(m => m.targetField && m.targetField !== '').length}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-red-600">
                            Unmapped: {currentConfig.fieldMappings.filter(m => !m.targetField || m.targetField === '').length}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={debugFieldMappings}
                            className="text-xs"
                          >
                            Debug
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-blue-700">
                        {currentConfig.fieldMappings.filter(m => !m.targetField || m.targetField === '').length > 0 
                          ? `⚠️ You have ${currentConfig.fieldMappings.filter(m => !m.targetField || m.targetField === '').length} unmatched fields. Please map them before importing.`
                          : '✅ All fields are mapped and ready for import.'
                        }
                      </p>
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fillFieldMappingsFromCurrent}
                          className="text-xs"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Fill Array with Current Mappings
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Show message when no field mappings exist */}
                  {(currentConfig.fieldMappings || []).length === 0 && (
                    <div className="p-4 border rounded-lg bg-gray-50 text-center">
                      <p className="text-gray-600 mb-2">No field mappings configured yet.</p>
                      <p className="text-sm text-gray-500 mb-3">
                        Use "Apply Smart Mapping" to automatically map CSV fields, or click "Add Field Mapping" to add manually.
                      </p>
                      {csvData && csvData.headers && csvData.headers.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Create field mappings from CSV headers
                            const newMappings = csvData.headers.map((header, index) => ({
                              sourceField: header,
                              targetField: '',
                              fieldType: 'string' as const,
                              isRequired: true, // Default to required
                              isEnabled: true,
                              defaultValue: '',
                              transformationRule: '',
                              fieldOrder: index + 1
                            }));
                            
                            setCurrentConfig({
                              ...currentConfig,
                              fieldMappings: newMappings
                            });
                            
                            toast({
                              title: "Field Mappings Created",
                              description: `Created ${newMappings.length} field mappings from CSV headers. Please map them to target fields.`,
                            });
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Create Mappings from CSV Headers
                        </Button>
                      )}
                    </div>
                  )}
                  
                  {(currentConfig.fieldMappings || []).map((mapping, index) => {
                    const isUnmatched = !mapping.targetField || mapping.targetField === '';
                    return (
                      <div key={index}
                        className={`border rounded-lg p-4 space-y-4 ${isUnmatched ? 'border-yellow-300 bg-yellow-50' : ''}`}>
                        {isUnmatched && (
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="outline" className="text-yellow-700 bg-yellow-100 border-yellow-300">
                              ⚠️ Unmatched Field
                            </Badge>
                            <span className="text-sm text-yellow-700">Please select a target field for this CSV column</span>
                          </div>
                        )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Source Field</Label>
                          <Input
                            value={mapping.sourceField}
                            onChange={(e) => {
                              const newMappings = [...currentConfig.fieldMappings];
                              newMappings[index].sourceField = e.target.value;
                              setCurrentConfig({
                                ...currentConfig,
                                fieldMappings: newMappings
                              });
                            }}
                            placeholder="CSV column name"
                          />
                        </div>
                        <div>
                          <Label>Target Field</Label>
                          <Select
                            value={mapping.targetField}
                            onValueChange={(value) => {
                              const newMappings = [...currentConfig.fieldMappings];
                              newMappings[index].targetField = value;
                              newMappings[index].fieldType = getFieldType(value);
                              newMappings[index].isRequired = isRequiredField(value);
                              setCurrentConfig({
                                ...currentConfig,
                                fieldMappings: newMappings
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select database field" />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Supported fields first */}
                              <div className="px-2 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border-b">
                                Supported Fields (will be imported)
                              </div>
                              {getDatabaseFields().filter(field => field.supported).map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                              
                              {/* Unsupported fields with warning */}
                              <div className="px-2 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 border-b">
                                Unsupported Fields (will be ignored)
                              </div>
                              {getDatabaseFields().filter(field => !field.supported).map((field) => (
                                <SelectItem key={field.value} value={field.value} className="text-orange-600">
                                  {field.label} ⚠️
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Warning for unsupported fields */}
                          {mapping.targetField && !isFieldSupportedByImportFunction(mapping.targetField) && (
                            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
                              <div className="flex items-center space-x-2">
                                <span className="text-orange-600">⚠️</span>
                                <span className="text-sm text-orange-700">
                                  This field is not supported by the import function and will be ignored during import.
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Field Type</Label>
                          <Select
                            value={mapping.fieldType}
                            onValueChange={(value: 'string' | 'number' | 'date' | 'boolean' | 'json') => {
                              const newMappings = [...currentConfig.fieldMappings];
                              newMappings[index].fieldType = value;
                              setCurrentConfig({
                                ...currentConfig,
                                fieldMappings: newMappings
                              });
                            }}
                          >
                            <SelectTrigger>
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
                        <div>
                          <Label>Default Value</Label>
                          <Input
                            value={mapping.defaultValue || ''}
                            onChange={(e) => {
                              const newMappings = [...currentConfig.fieldMappings];
                              newMappings[index].defaultValue = e.target.value;
                              setCurrentConfig({
                                ...currentConfig,
                                fieldMappings: newMappings
                              });
                            }}
                            placeholder="Default value"
                          />
                        </div>
                      </div>

                      {/* Enabled/Disabled and Required/Optional Toggles */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={mapping.isEnabled !== false}
                            onCheckedChange={(checked) => {
                              const newMappings = [...currentConfig.fieldMappings];
                              newMappings[index].isEnabled = checked;
                              setCurrentConfig({
                                ...currentConfig,
                                fieldMappings: newMappings
                              });
                            }}
                          />
                          <Label className={`text-xs ${mapping.isEnabled !== false ? 'font-semibold text-green-600' : 'text-gray-600'}`}>
                            {mapping.isEnabled !== false ? 'Enabled' : 'Disabled'}
                          </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={mapping.isRequired}
                            onCheckedChange={(checked) => {
                              const newMappings = [...currentConfig.fieldMappings];
                              newMappings[index].isRequired = checked;
                              setCurrentConfig({
                                ...currentConfig,
                                fieldMappings: newMappings
                              });
                            }}
                          />
                          <Label className={`text-xs ${mapping.isRequired ? 'font-semibold text-red-600' : 'text-gray-600'}`}>
                            {mapping.isRequired ? 'Required' : 'Optional'}
                          </Label>
                          {isRequiredField(mapping.targetField) && !mapping.isRequired && (
                            <Badge variant="destructive" className="text-xs">
                              Should be required
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Delete Button */}
                      <div className="flex items-center justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newMappings = [...currentConfig.fieldMappings];
                            newMappings.splice(index, 1);
                            setCurrentConfig({
                              ...currentConfig,
                              fieldMappings: newMappings
                            });
                          }}
                          className="h-8 px-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newMapping = {
                        sourceField: '',
                        targetField: '',
                        fieldType: 'string' as const,
                        isRequired: false,
                        isEnabled: true,
                        defaultValue: '',
                        transformationRule: '',
                        fieldOrder: currentConfig.fieldMappings.length + 1
                      };
                      setCurrentConfig({
                        ...currentConfig,
                        fieldMappings: [...currentConfig.fieldMappings, newMapping]
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Field Mapping
                  </Button>
                  
                  {/* Save Field Mappings Button - Always Visible */}
                  {(currentConfig.fieldMappings || []).length > 0 && (
                    <div className="flex justify-center mt-4">
                      <Button
                        onClick={saveConfig}
                        disabled={isLoading}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Database className="w-4 h-4 mr-2" />
                        )}
                        Save Field Mappings
                      </Button>
                    </div>
                  )}
                </div>
                
                <TabNavigation />
              </TabsContent>

              <TabsContent value="processing" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duplicateHandling">Duplicate Handling</Label>
                    <Select
                      value={currentConfig.processing.duplicateHandling}
                      onValueChange={(value: 'skip' | 'update' | 'replace') => setCurrentConfig({
                        ...currentConfig,
                        processing: { ...currentConfig.processing, duplicateHandling: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="replace">Replace</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="batchSize">Batch Size</Label>
                    <Input
                      id="batchSize"
                      type="number"
                      value={currentConfig.processing.batchSize}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        processing: { ...currentConfig.processing, batchSize: parseInt(e.target.value) }
                      })}
                      placeholder="1000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maxErrors">Max Errors</Label>
                    <Input
                      id="maxErrors"
                      type="number"
                      value={currentConfig.processing.maxErrors}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        processing: { ...currentConfig.processing, maxErrors: parseInt(e.target.value) }
                      })}
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="archiveDirectory">Archive Directory</Label>
                    <Input
                      id="archiveDirectory"
                      value={currentConfig.processing.archiveDirectory}
                      onChange={(e) => setCurrentConfig({
                        ...currentConfig,
                        processing: { ...currentConfig.processing, archiveDirectory: e.target.value }
                      })}
                      placeholder="/processed"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="validateData"
                    checked={currentConfig.processing.validateData}
                    onCheckedChange={(checked) => setCurrentConfig({
                      ...currentConfig,
                      processing: { ...currentConfig.processing, validateData: checked }
                    })}
                  />
                  <Label htmlFor="validateData">Validate data before import</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="archiveProcessedFiles"
                    checked={currentConfig.processing.archiveProcessedFiles}
                    onCheckedChange={(checked) => setCurrentConfig({
                      ...currentConfig,
                      processing: { ...currentConfig.processing, archiveProcessedFiles: checked }
                    })}
                  />
                  <Label htmlFor="archiveProcessedFiles">Archive processed files</Label>
                </div>
                
                <TabNavigation />
              </TabsContent>

              <TabsContent value="test" className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Test your connection settings before saving the configuration.
                    {currentConfig.id && !currentConfig.connection.password && (
                      <span className="block mt-2 text-amber-600 font-medium">
                        ⚠️ Please re-enter the password in the Connection tab to test the connection.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">💡 Quick Start Guide</h4>
                  <ol className="text-sm text-blue-800 space-y-1">
                    <li>1. <strong>Test Connection</strong> - Verify FTP/SFTP settings work</li>
                    <li>2. <strong>Test & Download</strong> - Download a sample file for analysis</li>
                    <li>3. <strong>Preview CSV</strong> - Analyze headers and data (uses downloaded file if available)</li>
                    <li>4. Configure field mappings and save your configuration</li>
                  </ol>
                </div>
                
                <div className="flex gap-2">
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
                  <Button 
                    onClick={testConnectionAndDownload} 
                    disabled={isTestingAndDownloading}
                    variant="default"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {isTestingAndDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Test & Download
                  </Button>
                  <Button 
                    onClick={previewCSV} 
                    disabled={csvAnalysisLoading}
                    variant={latestDownloadedFile ? "default" : "outline"}
                    className={`flex items-center gap-2 ${latestDownloadedFile ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                  >
                    {csvAnalysisLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : latestDownloadedFile ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <Database className="w-4 h-4" />
                    )}
                    {latestDownloadedFile ? `Preview ${latestDownloadedFile.originalName}` : 'Preview CSV'}
                  </Button>
                </div>

                {/* Downloaded File Indicator */}
                {latestDownloadedFile && !downloadProgress && (
                  <div className="mt-3 p-3 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium text-green-800">
                            Downloaded File Available
                          </span>
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {latestDownloadedFile.originalName} ({latestDownloadedFile.sizeFormatted}) - Click "Preview" to analyze without reconnecting
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateLatestDownloadedFile(null)}
                        className="text-green-700 hover:text-green-900 hover:bg-green-100"
                        title="Clear downloaded file (for testing)"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                )}

                {/* Download Progress Display */}
                {downloadProgress && (
                  <div className="mt-4 p-4 border rounded-lg bg-blue-50 border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Downloading File</span>
                      </div>
                      <span className="text-sm text-blue-700">
                        {downloadProgress.progress}%
                      </span>
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-sm font-medium text-blue-800 mb-1">
                        {downloadProgress.fileName}
                      </div>
                      <div className="text-xs text-blue-600">
                        {(downloadProgress.downloadedSize / 1024).toFixed(2)} KB / {(downloadProgress.totalSize / 1024).toFixed(2)} KB
                      </div>
                    </div>
                    
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${downloadProgress.progress}%` }}
                      />
                    </div>
                  </div>
                )}
                
                <TabNavigation />
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCurrentConfig(createNewConfig());
                  setIsEditing(false);
                  // Call parent's onCancel callback to clear selectedConfig
                  if (onCancel) {
                    onCancel();
                  }
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              
              {/* Save Field Mappings Button - Always visible when mappings exist */}
              {currentConfig.fieldMappings.length > 0 && (
                <Button 
                  onClick={saveConfig} 
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Settings className="w-4 h-4" />
                  )}
                  Save Field Mappings
                </Button>
              )}
              
              <Button onClick={smartImport} disabled={isLoading} variant="secondary">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Smart Import
              </Button>
              <Button onClick={quickImport} disabled={isLoading} variant="secondary">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Quick Import
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
          {/* Only show configuration list if no preloadedConfig is provided */}
          {!preloadedConfig && configs.map((config) => (
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
                    <Badge variant={config.frequency === 'manual' ? 'secondary' : 'default'}>
                      {config.frequency}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => await editConfig(config)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => executeImport(config.id)}
                      disabled={isExecutingImport || !config.fieldMappings || config.fieldMappings.length === 0 || config.fieldMappings.some(fm => !fm.target_field || fm.target_field === '')}
                      title={
                        !config.fieldMappings || config.fieldMappings.length === 0 
                          ? "No field mappings configured. Please edit the configuration and add field mappings first." 
                          : config.fieldMappings.some(fm => !fm.target_field || fm.target_field === '')
                            ? "Some fields are not mapped. Please complete all field mappings before importing."
                            : "Execute import"
                      }
                    >
                      {isExecutingImport ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteConfig(config.id)}
                    >
                      <History className="w-4 h-4" />
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
          
          {/* Show empty state only when no preloadedConfig and no configs */}
          {!preloadedConfig && configs.length === 0 && !isLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Database className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Import Configurations</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first import configuration to start importing data from external systems.
                </p>
                <Button onClick={handleNewConfiguration}>
                  Create Configuration
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* CSV Analysis Modal */}
      <CSVAnalysisModal
        isOpen={showCSVModal}
        onClose={() => {
          setShowCSVModal(false);
          // Navigate to field mappings tab after closing CSV modal
          const mappingsIndex = tabOrder.indexOf('mappings');
          if (mappingsIndex !== -1) {
            setCurrentTabIndex(mappingsIndex);
            setActiveTab('mappings');
          }
        }}
        onImport={handleCSVImport}
        csvData={csvData}
        isLoading={csvAnalysisLoading}
        error={csvAnalysisError}
      />
    </div>
  );
};

export default ImportConfiguration; 
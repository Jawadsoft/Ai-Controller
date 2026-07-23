import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Download, AlertCircle, CheckCircle, X, Info, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/api";

interface ImportResult {
  success: boolean;
  message: string;
  imported: number;
  errors: string[];
}

interface ComparisonResult {
  newVehicles: any[];
  duplicates: any[];
  updates: any[];
  total: number;
  summary: {
    totalInCSV: number;
    totalExisting: number;
    newCount: number;
    duplicateCount: number;
    updateCount: number;
  };
}

interface VehicleImportProps {
  onImportComplete?: () => void;
}

export const VehicleImport = ({ onImportComplete }: VehicleImportProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update' | 'replace'>('skip');
  const { toast } = useToast();

  const downloadTemplate = () => {
    const headers = [
      'vin',
      'make',
      'model', 
      'year',
      'trim',
      'color',
      'mileage',
      'price',
      'description',
      'features',
      'status'
    ];

    const sampleData = [
      [
        '1HGBH41JXMN109186',
        'Honda',
        'Civic',
        '2023',
        'LX',
        'White',
        '15000',
        '22000',
        'Excellent condition, one owner',
        'Bluetooth, Backup Camera, Apple CarPlay',
        'available'
      ],
      [
        '2T1BURHE0JC123456',
        'Toyota',
        'Corolla',
        '2022',
        'LE',
        'Silver',
        '25000',
        '20000',
        'Well maintained, highway miles',
        'Lane Departure Warning, Automatic Emergency Braking',
        'available'
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

  // Custom parser for tab-delimited format with pipe-separated options
  const parseCustomCSV = (csvText: string): any[] => {
    const lines = csvText.split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    // Detect delimiter (tab or comma)
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
    const vehicles = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
      
      const vehicle: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index];
        if (!value || value === '#N/A' || value === '') return;
        
        const headerUpper = header.toUpperCase();
        
        switch (headerUpper) {
          case 'DEALER_ID':
            vehicle.dealer_id = value;
            break;
            
          case 'VIN_NUMBER':
          case 'VIN':
            vehicle.vin = value;
            break;
            
          case 'STOCK_NUMBER':
          case 'STOCK':
            vehicle.stock_number = value;
            break;
            
          case 'OPTIONLIST':
          case 'OPTIONS':
            // Parse pipe-separated options
            vehicle.options_list = value.split('|').map(o => o.trim()).filter(Boolean);
            break;
            
          case 'OPTIONPRICES':
          case 'OPTION_PRICES':
            // Parse pipe-separated prices
            vehicle.options_prices = value.split('|').map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
            break;
            
          case 'MSRP':
            vehicle.msrp = parseFloat(value) || 0;
            break;
            
          case 'ASKINGPRICE':
          case 'ASKING_PRICE':
          case 'PRICE':
            vehicle.price = parseFloat(value) || 0;
            vehicle.asking_price = parseFloat(value) || 0;
            break;
            
          case 'YEAR':
            vehicle.year = parseInt(value) || 0;
            break;
            
          case 'MAKE':
            vehicle.make = value;
            break;
            
          case 'MODEL':
            vehicle.model = value;
            break;
            
          case 'TRIM':
            vehicle.trim = value;
            break;
            
          case 'COLOR':
          case 'EXTERIOR_COLOR':
            vehicle.exterior_color = value;
            break;
            
          case 'MILEAGE':
            vehicle.mileage = parseInt(value) || 0;
            break;
            
          case 'STATUS':
            vehicle.status = value.toLowerCase();
            break;
            
          case 'DESCRIPTION':
            vehicle.description = value;
            break;
            
          default:
            // Store any other fields as-is
            if (value) {
              vehicle[header.toLowerCase()] = value;
            }
        }
      });

      // Combine options with prices into features array
      if (vehicle.options_list && vehicle.options_prices) {
        vehicle.features = vehicle.options_list.map((opt: string, idx: number) => ({
          name: opt,
          price: vehicle.options_prices[idx] || 0
        }));
      } else if (vehicle.options_list) {
        vehicle.features = vehicle.options_list;
      }

      // Debug: Log parsed vehicle data (first 3 rows)
      if (i <= 3) {
        console.log(`📝 Parsed CSV Row ${i}:`, {
          vin: vehicle.vin || 'NO VIN',
          stock_number: vehicle.stock_number || 'NO STOCK',
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          price: vehicle.price,
          allKeys: Object.keys(vehicle)
        });
      }

      // Add if VIN OR Stock Number exists (at least one identifier required)
      if (vehicle.vin || vehicle.stock_number) {
        vehicles.push(vehicle);
      } else {
        console.warn(`⚠️ Row ${i} skipped: No VIN or Stock Number found`);
      }
    }

    console.log(`✅ Parsed ${vehicles.length} vehicles from CSV`);
    return vehicles;
  };

  // Legacy CSV parser (comma-delimited)
  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const vehicles = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length !== headers.length) {
        throw new Error(`Row ${i + 1}: Column count mismatch`);
      }

      const vehicle: any = {};
      headers.forEach((header, index) => {
        const value = values[index];
        if (value && value.toLowerCase() !== 'null' && value !== '') {
          vehicle[header.toLowerCase()] = value;
        }
      });

      if (vehicle.vin) {
        vehicles.push(vehicle);
      }
    }

    return vehicles;
  };

  // Compare CSV data with existing inventory
  const compareWithInventory = async (vehiclesFromCSV: any[]) => {
    try {
      setProgress(20);
      
      // Get existing vehicles from API
      const response = await fetch(buildApiUrl('vehicles?limit=-1'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch existing inventory');
      
      const data = await response.json();
      const existingVehicles = data.vehicles || [];

      console.log('🔍 Inventory Comparison Debug:');
      console.log(`📊 Total existing vehicles in database: ${existingVehicles.length}`);
      console.log(`📊 Total vehicles in CSV: ${vehiclesFromCSV.length}`);

      setProgress(40);

      // Create lookup maps by VIN and Stock Number
      const vinMap = new Map(
        existingVehicles
          .filter((v: any) => v.vin)
          .map((v: any) => [v.vin.toLowerCase().trim(), v])
      );
      
      const stockMap = new Map(
        existingVehicles
          .filter((v: any) => v.stock_number)
          .map((v: any) => [v.stock_number.toLowerCase().trim(), v])
      );

      console.log(`📋 Database Stock Numbers (first 10):`, 
        Array.from(stockMap.keys()).slice(0, 10));
      console.log(`📋 CSV Stock Numbers (first 10):`, 
        vehiclesFromCSV.slice(0, 10).map(v => v.stock_number));

      const newVehicles: any[] = [];
      const duplicates: any[] = [];
      const updates: any[] = [];

      setProgress(60);

      vehiclesFromCSV.forEach((csvVehicle, index) => {
        const vinKey = csvVehicle.vin?.toLowerCase().trim();
        const stockKey = csvVehicle.stock_number?.toLowerCase().trim();

        // Debug logging for first few vehicles
        if (index < 5) {
          console.log(`\n🔎 Checking vehicle ${index + 1}:`);
          console.log(`  CSV Stock: "${csvVehicle.stock_number}" → normalized: "${stockKey}"`);
          console.log(`  CSV VIN: "${csvVehicle.vin}" → normalized: "${vinKey}"`);
          console.log(`  Found by VIN: ${vinKey && vinMap.has(vinKey)}`);
          console.log(`  Found by Stock: ${stockKey && stockMap.has(stockKey)}`);
        }

        // Check for duplicates
        const existingByVIN = vinKey ? vinMap.get(vinKey) : null;
        const existingByStock = stockKey ? stockMap.get(stockKey) : null;
        const existing = existingByVIN || existingByStock;

        if (existing) {
          // Found duplicate
          const matchedBy = existingByVIN ? 'VIN' : 'Stock Number';
          
          // Check for changes
          const priceChanged = csvVehicle.price && csvVehicle.price !== existing.price;
          const msrpChanged = csvVehicle.msrp && csvVehicle.msrp !== existing.msrp;
          const mileageChanged = csvVehicle.mileage && csvVehicle.mileage !== existing.mileage;
          const statusChanged = csvVehicle.status && csvVehicle.status !== existing.status;
          
          const hasChanges = priceChanged || msrpChanged || mileageChanged || statusChanged;

          duplicates.push({
            csv: csvVehicle,
            existing: existing,
            matchedBy: matchedBy,
            hasChanges: hasChanges,
            changes: {
              price: priceChanged ? {
                csv: csvVehicle.price,
                existing: existing.price
              } : null,
              msrp: msrpChanged ? {
                csv: csvVehicle.msrp,
                existing: existing.msrp
              } : null,
              mileage: mileageChanged ? {
                csv: csvVehicle.mileage,
                existing: existing.mileage
              } : null,
              status: statusChanged ? {
                csv: csvVehicle.status,
                existing: existing.status
              } : null
            }
          });

          if (hasChanges) {
            updates.push({
              csv: csvVehicle,
              existing: existing,
              matchedBy: matchedBy,
              changes: {
                price: priceChanged,
                msrp: msrpChanged,
                mileage: mileageChanged,
                status: statusChanged
              }
            });
          }
        } else {
          // New vehicle
          newVehicles.push(csvVehicle);
        }
      });

      setProgress(80);

      const comparisonData: ComparisonResult = {
        newVehicles,
        duplicates,
        updates,
        total: vehiclesFromCSV.length,
        summary: {
          totalInCSV: vehiclesFromCSV.length,
          totalExisting: existingVehicles.length,
          newCount: newVehicles.length,
          duplicateCount: duplicates.length,
          updateCount: updates.length
        }
      };

      setProgress(100);
      return comparisonData;
    } catch (error) {
      console.error('Error comparing inventory:', error);
      throw error;
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    setResult(null);
  };

  const processImport = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      // Read and parse CSV file
      const csvText = await file.text();
      setProgress(10);
      
      // Use custom parser for tab-delimited format
      const vehicleData = parseCustomCSV(csvText);

      if (vehicleData.length === 0) {
        throw new Error("No valid vehicle data found in file");
      }

      toast({
        title: "Analyzing inventory",
        description: `Comparing ${vehicleData.length} vehicles with existing inventory...`,
      });

      // Compare with existing inventory
      const comparison = await compareWithInventory(vehicleData);
      setComparisonResult(comparison);
      setShowComparison(true);

      toast({
        title: "Comparison complete",
        description: `Found ${comparison.newVehicles.length} new vehicles, ${comparison.duplicates.length} duplicates`,
      });

    } catch (error: any) {
      console.error('Import error:', error);
      setResult({
        success: false,
        message: error.message || 'Import failed',
        imported: 0,
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

  const confirmImport = async () => {
    if (!comparisonResult) return;

    setLoading(true);
    setShowComparison(false);

    try {
      // Determine which vehicles to import based on duplicate action
      let vehiclesToImport = [...comparisonResult.newVehicles];

      if (duplicateAction === 'update') {
        // Include duplicates that have changes for update
        vehiclesToImport = [
          ...vehiclesToImport,
          ...comparisonResult.updates.map(u => ({
            ...u.csv,
            id: u.existing.id, // Include existing ID for update
            _action: 'update'
          }))
        ];
      } else if (duplicateAction === 'replace') {
        // Include all duplicates for replacement
        vehiclesToImport = [
          ...vehiclesToImport,
          ...comparisonResult.duplicates.map(d => ({
            ...d.csv,
            id: d.existing.id, // Include existing ID for replacement
            _action: 'replace'
          }))
        ];
      }
      // If 'skip', only new vehicles are imported

      // TODO: Replace with actual API call to your backend
      // Example: POST /api/vehicles/bulk-import
      
      setResult({
        success: true,
        message: `Successfully processed ${vehiclesToImport.length} vehicles. (Import API not yet implemented)`,
        imported: vehiclesToImport.length,
        errors: []
      });
      setShowResult(true);

      toast({
        title: "Import queued",
        description: `${vehiclesToImport.length} vehicles ready for import`,
      });

      if (onImportComplete) {
        onImportComplete();
      }

    } catch (error: any) {
      console.error('Import error:', error);
      setResult({
        success: false,
        message: error.message || 'Import failed',
        imported: 0,
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
    }
  };

  const resetImport = () => {
    setFile(null);
    setResult(null);
    setShowResult(false);
    setComparisonResult(null);
    setShowComparison(false);
    setDuplicateAction('skip');
    setProgress(0);
    // Reset file input
    const fileInput = document.getElementById('vehicle-import-file') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Import Vehicle Inventory</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instructions */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              Import multiple vehicles from a CSV or tab-delimited file. The system will automatically compare with your existing inventory
              and identify duplicates, new vehicles, and price changes before importing.
              <br />
              <strong>Supported formats:</strong> Standard CSV or tab-delimited with fields like VIN_NUMBER, STOCK_NUMBER, MSRP, AskingPrice, OptionList (pipe-separated).
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

          {/* File Upload */}
          <div className="space-y-2">
            <label htmlFor="vehicle-import-file" className="text-sm font-medium">
              Select CSV File
            </label>
            <Input
              id="vehicle-import-file"
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
              onClick={processImport}
              disabled={!file || loading}
              className="flex-1"
            >
              {loading ? "Importing..." : "Import Vehicles"}
            </Button>
            {(file || result) && (
              <Button variant="outline" onClick={resetImport} disabled={loading}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Dialog */}
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <span>Import Comparison - Review Before Importing</span>
            </DialogTitle>
          </DialogHeader>

          {comparisonResult && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total in CSV</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{comparisonResult.total}</div>
                  </CardContent>
                </Card>
                
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-700">New Vehicles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-700">
                      {comparisonResult.newVehicles.length}
                    </div>
                    <p className="text-xs text-green-600">Will be added</p>
                  </CardContent>
                </Card>
                
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-700">Duplicates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-700">
                      {comparisonResult.duplicates.length}
                    </div>
                    <p className="text-xs text-orange-600">Already in inventory</p>
                  </CardContent>
                </Card>
                
                <Card className="border-primary/20 bg-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-primary/90">Updates Available</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary/90">
                      {comparisonResult.updates.length}
                    </div>
                    <p className="text-xs text-primary">Price/data changes</p>
                  </CardContent>
                </Card>
              </div>

              {/* Duplicate Handling Options */}
              {comparisonResult.duplicates.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      <strong>How should we handle duplicates?</strong>
                      <p className="text-sm text-muted-foreground mt-1">
                        Duplicates are matched by VIN or Stock Number
                      </p>
                    </div>
                    <Select value={duplicateAction} onValueChange={(value: any) => setDuplicateAction(value)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip duplicates</SelectItem>
                        <SelectItem value="update">Update changed only</SelectItem>
                        <SelectItem value="replace">Replace all</SelectItem>
                      </SelectContent>
                    </Select>
                  </AlertDescription>
                </Alert>
              )}

              {/* Vehicles with Updates */}
              {comparisonResult.updates.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Vehicles with Changes ({comparisonResult.updates.length})</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN / Stock</TableHead>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>MSRP</TableHead>
                          <TableHead>Asking Price</TableHead>
                          <TableHead>Mileage</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Changes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonResult.updates.slice(0, 10).map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">
                              <div>{item.csv.vin}</div>
                              <div className="text-muted-foreground">{item.csv.stock_number}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {item.csv.year} {item.csv.make} {item.csv.model}
                              </div>
                              <div className="text-xs text-muted-foreground">{item.csv.trim}</div>
                            </TableCell>
                            <TableCell>
                              {item.changes.msrp ? (
                                <div>
                                  <div className="line-through text-muted-foreground text-xs">
                                    ${item.existing.msrp?.toLocaleString()}
                                  </div>
                                  <div className="text-primary font-semibold">
                                    ${item.csv.msrp?.toLocaleString()}
                                  </div>
                                </div>
                              ) : (
                                <div>${item.csv.msrp?.toLocaleString() || 'N/A'}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.changes.price ? (
                                <div>
                                  <div className="line-through text-muted-foreground text-xs">
                                    ${item.existing.price?.toLocaleString()}
                                  </div>
                                  <div className="text-primary font-semibold">
                                    ${item.csv.price?.toLocaleString()}
                                  </div>
                                </div>
                              ) : (
                                <div>${item.csv.price?.toLocaleString()}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.changes.mileage ? (
                                <div>
                                  <div className="line-through text-muted-foreground text-xs">
                                    {item.existing.mileage?.toLocaleString()}
                                  </div>
                                  <div className="text-primary font-semibold">
                                    {item.csv.mileage?.toLocaleString()}
                                  </div>
                                </div>
                              ) : (
                                <div>{item.csv.mileage?.toLocaleString()}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.changes.status ? (
                                <div>
                                  <Badge variant="outline" className="text-xs mb-1">{item.existing.status}</Badge>
                                  <Badge className="text-xs">{item.csv.status}</Badge>
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs">{item.csv.status}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {item.changes.price && <Badge variant="secondary" className="text-xs">Price</Badge>}
                                {item.changes.msrp && <Badge variant="secondary" className="text-xs">MSRP</Badge>}
                                {item.changes.mileage && <Badge variant="secondary" className="text-xs">Miles</Badge>}
                                {item.changes.status && <Badge variant="secondary" className="text-xs">Status</Badge>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {comparisonResult.updates.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center">
                      Showing 10 of {comparisonResult.updates.length} vehicles with changes
                    </p>
                  )}
                </div>
              )}

              {/* New Vehicles Preview */}
              {comparisonResult.newVehicles.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">New Vehicles ({comparisonResult.newVehicles.length})</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN / Stock</TableHead>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>MSRP</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Mileage</TableHead>
                          <TableHead>Options</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonResult.newVehicles.slice(0, 5).map((vehicle, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">
                              <div>{vehicle.vin}</div>
                              <div className="text-muted-foreground">{vehicle.stock_number}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {vehicle.year} {vehicle.make} {vehicle.model}
                              </div>
                              <div className="text-xs text-muted-foreground">{vehicle.trim}</div>
                            </TableCell>
                            <TableCell>${vehicle.msrp?.toLocaleString() || 'N/A'}</TableCell>
                            <TableCell className="font-semibold">${vehicle.price?.toLocaleString()}</TableCell>
                            <TableCell>{vehicle.mileage?.toLocaleString()}</TableCell>
                            <TableCell className="text-xs">
                              {vehicle.options_list?.slice(0, 2).join(', ')}
                              {vehicle.options_list?.length > 2 && ` +${vehicle.options_list.length - 2} more`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {comparisonResult.newVehicles.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center">
                      Showing 5 of {comparisonResult.newVehicles.length} new vehicles
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" onClick={() => setShowComparison(false)}>
                  Cancel
                </Button>
                <div className="flex gap-2">
                  <div className="text-sm text-muted-foreground mr-4">
                    <strong>Will import:</strong> {comparisonResult.newVehicles.length} new
                    {duplicateAction === 'update' && `, update ${comparisonResult.updates.length}`}
                    {duplicateAction === 'replace' && `, replace ${comparisonResult.duplicates.length}`}
                  </div>
                  <Button onClick={confirmImport} disabled={loading}>
                    {loading ? "Importing..." : "Confirm Import"}
                  </Button>
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
                    Vehicles Imported
                  </div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {result.errors.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Errors/Warnings
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
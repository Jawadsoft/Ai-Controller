import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, Download, AlertCircle, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImportResult {
  success: boolean;
  message: string;
  imported: number;
  errors: string[];
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
      const vehicleData = parseCSV(csvText);

      if (vehicleData.length === 0) {
        throw new Error("No valid vehicle data found in file");
      }

      setProgress(100);

      // Placeholder for import functionality
      // This would be replaced with actual API call to your backend
      setResult({
        success: true,
        message: `Import functionality is not yet implemented. ${vehicleData.length} vehicles would be imported.`,
        imported: vehicleData.length,
        errors: []
      });
      setShowResult(true);

      toast({
        title: "Import preview",
        description: `${vehicleData.length} vehicles ready for import (feature not yet implemented)`,
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

  const resetImport = () => {
    setFile(null);
    setResult(null);
    setShowResult(false);
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
              Import multiple vehicles from a CSV file. Download the template to see the required format.
              Supported fields: VIN (required), make, model, year, trim, color, mileage, price, description, features, status.
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
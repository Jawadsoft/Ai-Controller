import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, AlertCircle, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CSVData {
  headers: string[];
  sampleData: any[];
  totalRows: number;
  fileName: string;
  configId: string;
}

interface CSVAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (selectedRows: number[]) => void;
  csvData: CSVData | null;
  isLoading: boolean;
  error: string | null;
}

const CSVAnalysisModal: React.FC<CSVAnalysisModalProps> = ({
  isOpen,
  onClose,
  onImport,
  csvData,
  isLoading,
  error
}) => {
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [showAllData, setShowAllData] = useState(false);
  const { toast } = useToast();

  const getDataToShow = () => {
    if (!csvData) return [];
    const dataToShow = showAllData ? csvData.sampleData : csvData.sampleData.slice(0, 10);
    return dataToShow;
  };

  const handleImportSelected = () => {
    if (selectedRows.length === 0) {
      toast({
        title: "No rows selected",
        description: "Please select at least one row to import",
        variant: "destructive"
      });
      return;
    }
    
    onImport(selectedRows);
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Analyzing CSV Data...
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Connecting to server and analyzing CSV file...</p>
              <Progress value={45} className="mt-4" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Analysis Failed
            </DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!csvData) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Data Preview - {csvData.fileName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">File Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{csvData.totalRows}</div>
                  <div className="text-sm text-gray-600">Total Rows</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{csvData.headers.length}</div>
                  <div className="text-sm text-gray-600">Columns</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{selectedRows.length}</div>
                  <div className="text-sm text-gray-600">Selected Rows</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {csvData.headers.length}
                  </div>
                  <div className="text-sm text-gray-600">Available Fields</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CSV Field Detection */}
          {csvData.headers && csvData.headers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Detected CSV Fields ({csvData.headers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 border rounded-lg bg-blue-50">
                  <div className="flex flex-wrap gap-2">
                    {csvData.headers.map((field) => (
                      <Badge key={field} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Data Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showAllData"
                    checked={showAllData}
                    onCheckedChange={(checked) => setShowAllData(checked as boolean)}
                  />
                  <Label htmlFor="showAllData">Show all data</Label>
                </div>
                <div className="text-sm text-gray-600">
                  Showing {getDataToShow().length} of {csvData.totalRows} rows
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedRows.length === getDataToShow().length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedRows(getDataToShow().map((_, index) => index));
                            } else {
                              setSelectedRows([]);
                            }
                          }}
                        />
                      </TableHead>
                      {csvData.headers.map((header, index) => (
                        <TableHead key={index} className="text-xs">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getDataToShow().map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRows.includes(rowIndex)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRows([...selectedRows, rowIndex]);
                              } else {
                                setSelectedRows(selectedRows.filter(i => i !== rowIndex));
                              }
                            }}
                          />
                        </TableCell>
                        {csvData.headers.map((header, colIndex) => (
                          <TableCell key={colIndex} className="text-xs max-w-32 truncate">
                            {row[header] || ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button 
              variant="outline" 
              onClick={handleImportSelected}
              disabled={selectedRows.length === 0}
            >
              Import Selected ({selectedRows.length})
            </Button>
          </div>
          <div className="text-sm text-gray-600">
            Configure field mappings in the Mappings tab before importing
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CSVAnalysisModal; 
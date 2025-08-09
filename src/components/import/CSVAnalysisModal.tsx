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
import { Loader2, FileText, AlertCircle, Database, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CSVData {
  headers: string[];
  sampleData: any[];
  totalRows: number;
  fileName: string;
  configId: string | null;
  isLocalFile?: boolean;
  localFileName?: string;
  connectionData?: {
    connectionType: string;
    hostUrl: string;
    port: number;
    username: string;
    password: string;
    remoteDirectory: string;
    filePattern: string;
  };
}

interface CSVAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (selectedRows: number[], transformedData?: any[]) => void;
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
  const [isLoadingAllRows, setIsLoadingAllRows] = useState(false);
  const [allRowsData, setAllRowsData] = useState<any[]>([]);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformedData, setTransformedData] = useState<any[]>([]);
  const [isTransformed, setIsTransformed] = useState(false);
  const { toast } = useToast();

  const getDataToShow = () => {
    if (!csvData) return [];
    
    // If we have transformed data, use that first
    if (transformedData.length > 0) {
      return transformedData;
    }
    
    // If we have loaded all rows data, use that
    if (allRowsData.length > 0) {
      return allRowsData;
    }
    
    // Otherwise use sample data
    const dataToShow = showAllData ? csvData.sampleData : csvData.sampleData.slice(0, 10);
    return dataToShow;
  };

  const handleLoadAllRows = async () => {
    if (!csvData) return;
    
    console.log('Frontend: About to send load all rows request');
    console.log('Frontend: csvData:', csvData);
    console.log('Frontend: configId:', csvData.configId);
    console.log('Frontend: fileName:', csvData.fileName);
    
    setIsLoadingAllRows(true);
    try {
          // Call the backend to load all rows
    const requestBody = {
      configId: csvData.configId,
      fileName: csvData.fileName,
      // Include local file information if available
      ...(csvData.isLocalFile && {
        isLocalFile: true,
        localFileName: csvData.localFileName
      }),
      // Include connection data when configId is null (for preview mode)
      ...(csvData.configId === null && csvData.connectionData && {
        connectionData: csvData.connectionData
      })
    };
    console.log('Frontend: Request body:', requestBody);
      
      const response = await fetch(`http://localhost:3000/api/import/load-all-rows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || 'public'}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Failed to load all rows: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setAllRowsData(data.data);
        toast({
          title: "All rows loaded",
          description: `Successfully loaded all ${data.data.length} rows from the CSV file.`,
          variant: "default"
        });
      } else {
        throw new Error(data.error || 'Failed to load all rows');
      }
    } catch (error) {
      console.error('Error loading all rows:', error);
      toast({
        title: "Error loading all rows",
        description: error instanceof Error ? error.message : 'Failed to load all rows from CSV',
        variant: "destructive"
      });
    } finally {
      setIsLoadingAllRows(false);
    }
  };

  const handleTransformData = async () => {
    if (!csvData) return;
    
    console.log('Frontend: About to send transform data request');
    console.log('Frontend: csvData:', csvData);
    
    setIsTransforming(true);
    try {
      // Call the backend to transform data
      const requestBody = {
        configId: csvData.configId,
        fileName: csvData.fileName,
        // Include local file information if available
        ...(csvData.isLocalFile && {
          isLocalFile: true,
          localFileName: csvData.localFileName
        }),
        // Include connection data when configId is null (for preview mode)
        ...(csvData.configId === null && csvData.connectionData && {
          connectionData: csvData.connectionData
        })
      };
      console.log('Frontend: Transform request body:', requestBody);
      
      const response = await fetch(`http://localhost:3000/api/import/transform-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || 'public'}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Failed to transform data: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTransformedData(data.data);
        setIsTransformed(true);
        toast({
          title: "Data Transformed Successfully",
          description: `Successfully transformed ${data.data.length} rows. Applied: ${data.transformationsApplied ? data.transformationsApplied.join(', ') : 'various transformations'}.`,
          variant: "default"
        });
      } else {
        throw new Error(data.error || 'Failed to transform data');
      }
    } catch (error) {
      console.error('Error transforming data:', error);
      toast({
        title: "Error transforming data",
        description: error instanceof Error ? error.message : 'Failed to transform data',
        variant: "destructive"
      });
    } finally {
      setIsTransforming(false);
    }
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
    
    // If we have transformed data, pass it along with the selected row indices
    if (isTransformed && transformedData.length > 0) {
      console.log('Importing with transformed data:', transformedData.length, 'rows');
      onImport(selectedRows, transformedData);
    } else {
      console.log('Importing with original data');
      onImport(selectedRows);
    }
  };

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedRows([]);
      setShowAllData(false);
      setAllRowsData([]);
    }
  }, [isOpen]);

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

  const currentData = getDataToShow();
  const isShowingAllRows = allRowsData.length > 0;

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
                {isShowingAllRows && (
                  <Badge variant="default" className="ml-2">
                    All Rows Loaded
                  </Badge>
                )}
                {isTransformed && (
                  <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-800">
                    Data Transformed
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showAllData"
                      checked={showAllData}
                      onCheckedChange={(checked) => setShowAllData(checked as boolean)}
                      disabled={isShowingAllRows}
                    />
                    <Label htmlFor="showAllData">Show all sample data</Label>
                  </div>
                  
                  <div className="flex gap-2">
                    {!isShowingAllRows && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLoadAllRows}
                        disabled={isLoadingAllRows}
                        className="flex items-center gap-2"
                      >
                        {isLoadingAllRows ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        Load All Rows ({csvData.totalRows})
                      </Button>
                    )}
                    
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleTransformData}
                      disabled={isTransforming || isTransformed}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                      {isTransforming ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Database className="h-4 w-4" />
                      )}
                      Transform Data
                    </Button>
                    
                    {isTransformed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTransformedData([]);
                          setIsTransformed(false);
                          toast({
                            title: "Transformations Cleared",
                            description: "Showing original data without transformations.",
                            variant: "default"
                          });
                        }}
                        className="flex items-center gap-2 text-gray-600"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Showing {currentData.length} of {csvData.totalRows} rows
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedRows.length === currentData.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedRows(currentData.map((_, index) => index));
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
                    {currentData.map((row, rowIndex) => (
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
              
              {isShowingAllRows && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    ✅ All {csvData.totalRows} rows have been loaded successfully. You can now select and import any combination of rows.
                  </p>
                </div>
              )}
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
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  History, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  Eye,
  RefreshCw,
  Download,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { buildApiUrl } from '../../lib/config';

interface ImportHistoryItem {
  id: number;
  config_name: string;
  import_status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  file_name: string;
  file_size: number;
  records_processed: number;
  records_inserted: number;
  records_updated: number;
  records_skipped: number;
  records_failed: number;
  error_message: string;
  started_at: string;
  completed_at: string;
  created_at: string;
}

interface ImportError {
  id: number;
  row_number: number;
  field_name: string;
  error_message: string;
  raw_data: string;
  import_status: string;
  file_name: string;
  import_date: string;
  created_at: string;
}

const ImportHistory: React.FC = () => {
  const { toast } = useToast();
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingErrors, setIsLoadingErrors] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [showErrorsDialog, setShowErrorsDialog] = useState(false);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      console.log('Loading import history...');
      const response = await fetch(buildApiUrl('import/history'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      console.log('Import history response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Import history result:', result);
        setHistory(result.data || []);
        console.log('Set history with', result.data?.length || 0, 'records');
      } else {
        const errorText = await response.text();
        console.error('Failed to load import history:', response.status, errorText);
        toast({
          title: "Error",
          description: "Failed to load import history",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading import history:', error);
      toast({
        title: "Error",
        description: "Failed to load import history",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadErrors = async (historyId: number) => {
    try {
      setIsLoadingErrors(true);
      console.log('Loading import errors for history ID:', historyId);
      const response = await fetch(buildApiUrl(`import/errors/${historyId}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      console.log('Import errors response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Import errors result:', result);
        setErrors(result.data || []);
        console.log('Set errors with', result.data?.length || 0, 'records');
      } else {
        const errorText = await response.text();
        console.error('Failed to load import errors:', response.status, errorText);
        toast({
          title: "Error",
          description: "Failed to load import errors",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading import errors:', error);
      toast({
        title: "Error",
        description: "Failed to load import errors",
        variant: "destructive"
      });
    } finally {
      setIsLoadingErrors(false);
    }
  };

  const handleViewErrors = (historyId: number) => {
    setSelectedHistoryId(historyId);
    setShowErrorsDialog(true);
    loadErrors(historyId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      running: 'secondary',
      pending: 'outline',
      cancelled: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <History className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Import History</h2>
        </div>
        <Button onClick={loadHistory} disabled={isLoading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading import history...
        </div>
      ) : history.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Import History</h3>
              <p className="text-gray-500">No import operations have been performed yet.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(item.import_status)}
                    <div>
                      <CardTitle className="text-lg">{item.config_name}</CardTitle>
                      <CardDescription className="flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>{item.file_name}</span>
                        <span>•</span>
                        <span>{formatFileSize(item.file_size)}</span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(item.import_status)}
                    {item.records_failed > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewErrors(item.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Errors ({item.records_failed})
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{item.records_processed}</div>
                    <div className="text-sm text-gray-500">Processed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{item.records_inserted}</div>
                    <div className="text-sm text-gray-500">Inserted</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{item.records_updated}</div>
                    <div className="text-sm text-gray-500">Updated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{item.records_skipped}</div>
                    <div className="text-sm text-gray-500">Skipped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{item.records_failed}</div>
                    <div className="text-sm text-gray-500">Failed</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>Started: {formatDate(item.started_at)}</span>
                    </div>
                    {item.completed_at && (
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4" />
                        <span>Completed: {formatDate(item.completed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {item.error_message && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Error:</strong> {item.error_message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Errors Dialog */}
      <Dialog open={showErrorsDialog} onOpenChange={setShowErrorsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span>Import Errors</span>
            </DialogTitle>
            <DialogDescription>
              Detailed error information for the selected import operation
            </DialogDescription>
          </DialogHeader>

          {isLoadingErrors ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading errors...
            </div>
          ) : errors.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Errors Found</h3>
              <p className="text-gray-500">This import operation completed without any errors.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                {errors.map((error, index) => (
                  <Card key={error.id} className="border-red-200 bg-red-50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm text-red-800">
                          Row {error.row_number}
                          {error.field_name && ` • Field: ${error.field_name}`}
                        </CardTitle>
                        <Badge variant="destructive" className="text-xs">
                          Error #{index + 1}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-red-800 mb-1">Error Message:</h4>
                          <p className="text-sm text-red-700 bg-red-100 p-2 rounded">
                            {error.error_message}
                          </p>
                        </div>
                        
                        {error.raw_data && (
                          <div>
                            <h4 className="font-medium text-red-800 mb-1">Raw Data:</h4>
                            <div className="text-xs bg-white p-2 rounded border max-h-32 overflow-auto">
                              <pre className="whitespace-pre-wrap">{error.raw_data}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImportHistory;

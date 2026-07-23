import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertTriangle, X, Download, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { vehiclesAPI } from '@/lib/api';

interface CarfaxReport {
  id: string;
  report_url: string;
  report_date: string;
  uploaded_at: string;
  uploaded_by: string;
  accident_count: number;
  service_records: number;
  owners: number;
  title_issues: boolean;
  odometer_rollback: boolean;
  structural_damage: boolean;
  airbag_deployment: boolean;
  flood_damage: boolean;
  lemon_title: boolean;
  manufacturer_recall: boolean;
  previous_rental: boolean;
  previous_taxi: boolean;
  previous_police: boolean;
  previous_fleet: boolean;
  previous_lease: boolean;
  previous_corporate: boolean;
  previous_government: boolean;
  previous_auction: boolean;
  previous_repo: boolean;
  previous_salvage: boolean;
  previous_fire: boolean;
  previous_hail: boolean;
  previous_theft: boolean;
  previous_vandalism: boolean;
  previous_water: boolean;
  previous_other: boolean;
  certified_pre_owned: boolean;
  personal_vehicle: boolean;
  commercial_vehicle: boolean;
  needs_manual_review?: boolean;
  summary: string;
  notes: string;
  uploaded_by_name?: string;
}

interface CarfaxUploadProps {
  vehicleId: string;
  onUploadComplete?: () => void;
}

export const CarfaxUpload: React.FC<CarfaxUploadProps> = ({ vehicleId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reports, setReports] = useState<CarfaxReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load existing CARFAX reports
  React.useEffect(() => {
    loadCarfaxReports();
  }, [vehicleId]);

  const loadCarfaxReports = async () => {
    try {
      setLoading(true);
      const response = await vehiclesAPI.getCarfaxReports(vehicleId);
      if (response.success) {
        setReports(response.reports || []);
      }
    } catch (error: any) {
      console.error('Error loading CARFAX reports:', error);
      setError('Failed to load CARFAX reports');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Invalid file type',
          description: 'Please select a PDF file',
          variant: 'destructive',
        });
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 10MB',
          variant: 'destructive',
        });
        return;
      }
      
      uploadCarfaxReport(file);
    }
  };

  const uploadCarfaxReport = async (file: File) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      const formData = new FormData();
      formData.append('carfax', file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await vehiclesAPI.uploadCarfax(vehicleId, formData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.success) {
        if (response.needs_manual_review) {
          toast({
            title: 'CARFAX Report Uploaded',
            description: 'PDF stored successfully, but could not be auto-parsed (image-based PDF). Please review the report manually.',
            variant: 'default',
          });
        } else {
          toast({
            title: 'CARFAX Report Uploaded',
            description: 'PDF uploaded and parsed successfully',
          });
        }
        
        // Reload reports
        await loadCarfaxReports();
        
        // Call completion callback
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Error uploading CARFAX report:', error);
      setError(error.message || 'Failed to upload CARFAX report');
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload CARFAX report',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const deleteCarfaxReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this CARFAX report?')) {
      return;
    }

    try {
      await vehiclesAPI.deleteCarfaxReport(reportId);
      toast({
        title: 'CARFAX Report Deleted',
        description: 'Report deleted successfully',
      });
      
      // Reload reports
      await loadCarfaxReports();
    } catch (error: any) {
      console.error('Error deleting CARFAX report:', error);
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete CARFAX report',
        variant: 'destructive',
      });
    }
  };

  const downloadCarfaxReport = (reportUrl: string) => {
    window.open(reportUrl, '_blank');
  };

  const getStatusBadge = (report: CarfaxReport) => {
    if (report.needs_manual_review) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Manual Review Required</Badge>;
    }

    const issues = [];
    
    if (report.accident_count > 0) issues.push('Accidents');
    if (report.title_issues) issues.push('Title Issues');
    if (report.structural_damage) issues.push('Structural Damage');
    if (report.flood_damage) issues.push('Flood Damage');
    if (report.airbag_deployment) issues.push('Airbag Deployment');
    if (report.lemon_title) issues.push('Lemon Title');
    if (report.odometer_rollback) issues.push('Odometer Rollback');
    
    if (issues.length === 0) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Clean History</Badge>;
    } else if (issues.length <= 2) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Minor Issues</Badge>;
    } else {
      return <Badge variant="destructive">Major Issues</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CARFAX Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-b-2 border-primary rounded-full"></div>
            <span className="ml-2">Loading CARFAX reports...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          CARFAX Reports
        </CardTitle>
        <CardDescription>
          Upload and manage CARFAX vehicle history reports
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Section */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
            onClick={(e) => e.stopPropagation()}
          />
          
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          
          <h3 className="text-lg font-medium mb-2">Upload CARFAX Report</h3>
          <p className="text-gray-600 mb-4">
            Select a PDF file to upload. Text-based PDFs are auto-parsed; image/scanned PDFs are stored for manual review.
          </p>
          
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            className="mb-2"
            type="button"
          >
            {uploading ? 'Uploading...' : 'Select PDF File'}
          </Button>
          
          {uploading && (
            <div className="mt-4">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-gray-600 mt-2">
                Uploading and parsing PDF... {uploadProgress}%
              </p>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Reports List */}
        {reports.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-medium">Previous Reports ({reports.length})</h4>
            {reports.map((report) => (
              <div key={report.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      CARFAX Report - {new Date(report.uploaded_at).toLocaleDateString()}
                    </span>
                    {getStatusBadge(report)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        downloadCarfaxReport(report.report_url);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteCarfaxReport(report.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {report.needs_manual_review && (
                  <Alert className="mb-2 border-orange-200 bg-orange-50">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-700 text-sm">
                      This PDF is image-based and could not be auto-parsed. Open the report to review it manually.
                    </AlertDescription>
                  </Alert>
                )}

                {report.summary && (
                  <p className="text-sm text-gray-600 mb-2">{report.summary}</p>
                )}
                
                {/* Vehicle Attributes */}
                {(report.certified_pre_owned || report.personal_vehicle || report.commercial_vehicle) && (
                  <div className="mb-3 p-2 bg-primary/10 rounded-lg">
                    <h5 className="text-sm font-medium text-primary mb-2">Vehicle Attributes</h5>
                    <div className="flex flex-wrap gap-2">
                      {report.certified_pre_owned && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          ⭐ Certified Pre-Owned
                        </Badge>
                      )}
                      {report.personal_vehicle && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          🏠 Personal Vehicle
                        </Badge>
                      )}
                      {report.commercial_vehicle && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          🏢 Commercial Vehicle
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Accidents:</span>
                    <span className="font-medium">{report.accident_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Service Records:</span>
                    <span className="font-medium">{report.service_records}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Owners:</span>
                    <span className="font-medium">{report.owners}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Uploaded:</span>
                    <span className="font-medium">
                      {report.uploaded_by_name || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No CARFAX reports uploaded yet</p>
            <p className="text-sm">Upload a PDF to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

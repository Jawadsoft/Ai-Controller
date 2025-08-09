import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { QrCode, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vehiclesAPI } from "@/lib/api";

interface BulkActionsProps {
  selectedVehicles: string[];
  onClearSelection: () => void;
  onRefresh: () => void;
}

interface QRGenerationResult {
  vehicleId: string;
  success: boolean;
  error?: string;
  qrCodeUrl?: string;
}

export const BulkActions = ({ selectedVehicles, onClearSelection, onRefresh }: BulkActionsProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<QRGenerationResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();

  const generateQRCodes = async () => {
    setIsGenerating(true);
    setProgress(0);
    setResults([]);
    setShowResults(true);

    try {
      const response = await vehiclesAPI.generateBulkQRCodes(selectedVehicles);
      
      if (response.success && response.results) {
        const allResults: QRGenerationResult[] = response.results.map((result: any) => ({
          vehicleId: result.vehicleId,
          success: result.success,
          error: result.error,
          qrCodeUrl: result.qrCodeUrl
        }));

        setResults(allResults);
        setProgress(100);

        const successCount = allResults.filter(r => r.success).length;
        toast({
          title: "QR Code Generation Complete",
          description: `Successfully generated QR codes for ${successCount} out of ${selectedVehicles.length} vehicles`,
        });

        // Refresh the vehicle list to show updated QR codes
        onRefresh();
      } else {
        throw new Error("Failed to generate QR codes");
      }

    } catch (error: any) {
      console.error("Error in bulk QR generation:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR codes",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const validateQRCodes = async () => {
    setIsValidating(true);
    
    try {
      // Placeholder for QR code validation
      toast({
        title: "QR Code Validation",
        description: "QR code validation feature is not yet implemented",
      });
      
    } catch (error: any) {
      console.error("Error validating QR codes:", error);
      toast({
        title: "Error",
        description: "Failed to validate QR codes",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  if (selectedVehicles.length === 0) return null;

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Bulk Actions
            <Badge variant="secondary">
              {selectedVehicles.length} selected
            </Badge>
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClearSelection}
            disabled={isGenerating || isValidating}
          >
            Clear Selection
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button 
            onClick={generateQRCodes}
            disabled={isGenerating || isValidating}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating QR Codes...
              </>
            ) : (
              <>
                <QrCode className="h-4 w-4 mr-2" />
                Generate QR Codes ({selectedVehicles.length})
              </>
            )}
          </Button>
          
          <Button 
            variant="outline"
            onClick={validateQRCodes}
            disabled={isGenerating || isValidating}
            className="flex-1"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Validate QR Codes
              </>
            )}
          </Button>
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Generating QR codes...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Results Display */}
        {showResults && results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Generation Results:</h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {results.map((result, index) => (
                <div key={result.vehicleId} className="flex items-center gap-2 text-sm">
                  {result.success ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <X className="h-3 w-3 text-red-500" />
                  )}
                  <span className="font-mono text-xs">
                    Vehicle {index + 1}
                  </span>
                  {result.error && (
                    <span className="text-red-500 text-xs">{result.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
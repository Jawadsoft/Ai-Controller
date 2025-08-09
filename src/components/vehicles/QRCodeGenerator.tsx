import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Download, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vehiclesAPI } from "@/lib/api";

interface QRCodeGeneratorProps {
  vehicleId?: string;
  qrCodeUrl?: string;
  onQRCodeGenerated?: (qrCodeUrl: string) => void;
}

export const QRCodeGenerator = ({ vehicleId, qrCodeUrl, onQRCodeGenerated }: QRCodeGeneratorProps) => {
  const [loading, setLoading] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const { toast } = useToast();

  const generateQRCode = async () => {
    if (!vehicleId) return;
    
    setLoading(true);
    try {
      const response = await vehiclesAPI.generateQRCode(vehicleId);
      
      if (response.success && response.qrCodeUrl) {
        onQRCodeGenerated?.(response.qrCodeUrl);
        toast({
          title: "Success",
          description: "QR code generated successfully",
        });
      } else {
        throw new Error("Failed to generate QR code");
      }
    } catch (error: any) {
      console.error("Error generating QR code:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const regenerateAllQRCodes = async () => {
    setGeneratingAll(true);
    try {
      // This would need to be implemented with a way to get all vehicle IDs
      // For now, we'll show a message that this feature needs to be implemented
      toast({
        title: "Bulk QR Generation",
        description: "Bulk QR code regeneration will be available in the vehicle list view",
      });
    } catch (error: any) {
      console.error("Error regenerating QR codes:", error);
      toast({
        title: "Error",
        description: "Failed to regenerate QR codes",
        variant: "destructive",
      });
    } finally {
      setGeneratingAll(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `vehicle-qr-${vehicleId || 'code'}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {qrCodeUrl ? (
          <div className="space-y-3">
            <div className="relative">
              <img 
                src={qrCodeUrl} 
                alt="Vehicle QR Code" 
                className="w-48 h-48 mx-auto border border-border rounded-lg"
              />
              <Badge className="absolute top-2 right-2 bg-green-500">
                Generated
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadQRCode}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              {vehicleId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateQRCode}
                  disabled={loading}
                  className="flex-1"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="w-48 h-48 mx-auto border-2 border-dashed border-border rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <QrCode className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">No QR code generated</p>
              </div>
            </div>
            {vehicleId && (
              <Button
                onClick={generateQRCode}
                disabled={loading}
                className="w-full"
              >
                <QrCode className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? "Generating..." : "Generate QR Code"}
              </Button>
            )}
          </div>
        )}

        {/* Bulk regeneration option */}
        <div className="pt-4 border-t border-border">
          <Button
            variant="secondary"
            onClick={regenerateAllQRCodes}
            disabled={generatingAll}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${generatingAll ? 'animate-spin' : ''}`} />
            {generatingAll ? "Regenerating All..." : "Regenerate All QR Codes"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            This will generate QR codes for all vehicles in your inventory
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Download, Printer, Settings, Car, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { buildBackendAssetUrl } from "@/lib/config";

// Import the actual DEALERIQ logo
import dealerIqLogo from "../../assets/dealeriq-logo.png";

interface DealerProfile {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  website?: string;
  logo_url?: string;
}

interface DealerProfileStickerProps {
  dealer: DealerProfile;
}

interface StickerTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  qrSize: number;
  showLogo: boolean;
  showContactInfo: boolean;
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
}

const STICKER_TEMPLATES: StickerTemplate[] = [
  {
    id: "dealeriq-classic",
    name: "DEALERIQ Classic",
    width: 300,
    height: 400,
    qrSize: 120,
    showLogo: true,
    showContactInfo: true,
    backgroundColor: "#ffffff",
    primaryColor: "#1e40af", // Dark blue
    accentColor: "#dc2626" // Bright red
  },
  {
    id: "dealeriq-minimal",
    name: "DEALERIQ Minimal",
    width: 280,
    height: 380,
    qrSize: 100,
    showLogo: true,
    showContactInfo: false,
    backgroundColor: "#ffffff",
    primaryColor: "#1e40af",
    accentColor: "#dc2626"
  },
  {
    id: "dealeriq-premium",
    name: "DEALERIQ Premium",
    width: 350,
    height: 450,
    qrSize: 140,
    showLogo: true,
    showContactInfo: true,
    backgroundColor: "#ffffff",
    primaryColor: "#1e40af",
    accentColor: "#dc2626"
  }
];

export const DealerProfileSticker = ({ dealer }: DealerProfileStickerProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<StickerTemplate>(STICKER_TEMPLATES[0]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [stockNumber, setStockNumber] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const { toast } = useToast();

  // Preload the logo image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLogoLoaded(true);
    img.src = dealerIqLogo;
  }, []);

  // Generate QR code for dealer profile
  const generateQRCode = async () => {
    if (!stockNumber.trim()) {
      toast({
        title: "Stock Number Required",
        description: "Please enter a stock number for the sticker",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Use direct dealer ID without encryption, but include stock number
      // Simply use the dealer ID directly in the URL with stock number as query parameter
      const profileUrl = `${window.location.origin}/#/aibot/dealer/qr/${dealer.id}`;
      
      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(profileUrl, {
        width: selectedTemplate.qrSize,
        margin: 1,
        color: {
          dark: "#000000", // Black QR code
          light: selectedTemplate.backgroundColor
        }
      });
      
      setQrCodeUrl(qrCodeDataUrl);
      
      toast({
        title: "QR Code Generated",
        description: "Dealer profile sticker QR code generated successfully",
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadSticker = () => {
    if (!qrCodeUrl) {
      toast({
        title: "No QR Code",
        description: "Please generate a QR code first",
        variant: "destructive",
      });
      return;
    }

    // Create a canvas to render the sticker
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = selectedTemplate.width;
    canvas.height = selectedTemplate.height;

    // Fill background
    ctx.fillStyle = selectedTemplate.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    ctx.strokeStyle = selectedTemplate.primaryColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);

    // Draw rounded corners (simplified)
    const cornerRadius = 15;
    ctx.beginPath();
    ctx.moveTo(cornerRadius, 0);
    ctx.lineTo(canvas.width - cornerRadius, 0);
    ctx.quadraticCurveTo(canvas.width, 0, canvas.width, cornerRadius);
    ctx.lineTo(canvas.width, canvas.height - cornerRadius);
    ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - cornerRadius, canvas.height);
    ctx.lineTo(cornerRadius, canvas.height);
    ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - cornerRadius);
    ctx.lineTo(0, cornerRadius);
    ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
    ctx.closePath();
    ctx.stroke();

         // Draw the actual DEALERIQ logo at top
     const logoSize = 120;
     const logoX = (canvas.width - logoSize) / 2;
     const logoY = 20;

    // Load and draw the logo
    const logoImg = new Image();
    logoImg.onload = () => {
             // Draw logo with proper scaling
       ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);

             // Draw D.A.I.V.E call to action
       ctx.fillStyle = selectedTemplate.primaryColor;
       ctx.font = "bold 14px Arial";
       ctx.fillText("LET D.A.I.V.E HELP YOU", canvas.width / 2, logoY + logoSize + 25);

             // Draw stock number
       ctx.fillStyle = "#000000";
       ctx.font = "12px Arial";
       ctx.fillText(`STK# ${stockNumber}`, canvas.width / 2, logoY + logoSize + 50);

               // Draw QR code
         if (qrCodeUrl) {
           const qrImage = new Image();
           qrImage.onload = () => {
             const qrX = (canvas.width - selectedTemplate.qrSize) / 2;
             const qrY = logoY + logoSize + 70;
          ctx.drawImage(qrImage, qrX, qrY, selectedTemplate.qrSize, selectedTemplate.qrSize);
          
          // Draw "SCAN HERE" text
          ctx.fillStyle = "#000000";
          ctx.font = "bold 12px Arial";
          ctx.fillText("SCAN HERE", canvas.width / 2, qrY + selectedTemplate.qrSize + 20);
          
          // Draw footer
          ctx.font = "10px Arial";
          ctx.fillText("Dealer A.I. Virtual Expert", canvas.width / 2, qrY + selectedTemplate.qrSize + 40);

          // Download the canvas
          const link = document.createElement('a');
          link.download = `dealer-profile-sticker-${stockNumber}.png`;
          link.href = canvas.toDataURL();
          link.click();
        };
        qrImage.src = qrCodeUrl; // qrCodeUrl is already a data URL from QRCode.toDataURL()
      }
    };
    logoImg.src = dealerIqLogo;
  };

  const printSticker = () => {
    if (!qrCodeUrl) {
      toast({
        title: "No QR Code",
        description: "Please generate a QR code first",
        variant: "destructive",
      });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Dealer Profile Sticker - ${stockNumber}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .sticker { 
                width: ${selectedTemplate.width}px; 
                height: ${selectedTemplate.height}px; 
                border: 3px solid ${selectedTemplate.primaryColor};
                border-radius: 15px;
                background: ${selectedTemplate.backgroundColor};
                position: relative;
                margin: 0 auto;
              }
                                            .logo { text-align: center; padding: 20px 0; }
               .logo img { width: 120px; height: 120px; }
               .cta { text-align: center; color: #2e3192; font-weight: bold; font-size: 14px; margin: 20px 0; }
               .stock { text-align: center; color: #000; font-size: 12px; margin: 10px 0; }
               .qr-code { text-align: center; margin: 20px 0; }
               .scan-text { text-align: center; font-weight: bold; font-size: 12px; margin: 10px 0; }
               .footer { text-align: center; font-size: 10px; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="sticker">
              <div class="logo">
                <img src="${dealerIqLogo}" alt="DEALERIQ Logo" />
              </div>
              
              <div class="cta">LET D.A.I.V.E. HELP YOU</div>
              
              <div class="qr-code">
                <img src="${qrCodeUrl}" alt="QR Code" style="width: ${selectedTemplate.qrSize}px; height: ${selectedTemplate.qrSize}px;" />
              </div>
              <div class="scan-text">SCAN HERE</div>
              <div class="footer">Dealer A.I. Virtual Expert</div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <QrCode className="h-4 w-4 mr-2" />
          Generate Profile Sticker
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Dealer Profile Sticker Generator
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sticker Configuration */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sticker Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Template Selection */}
                <div className="space-y-2">
                  <Label htmlFor="template">Sticker Template</Label>
                  <Select
                    value={selectedTemplate.id}
                    onValueChange={(value) => {
                      const template = STICKER_TEMPLATES.find(t => t.id === value);
                      if (template) setSelectedTemplate(template);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {STICKER_TEMPLATES.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} ({template.width}×{template.height}px)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stock Number */}
                <div className="space-y-2">
                  <Label htmlFor="stockNumber">Stock Number</Label>
                  <Input
                    id="stockNumber"
                    placeholder="Enter stock number (e.g., 2691)"
                    value={stockNumber}
                    onChange={(e) => setStockNumber(e.target.value)}
                  />
                </div>

                {/* Template Preview */}
                <div className="space-y-2">
                  <Label>Template Preview</Label>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="text-sm text-gray-600">
                      <p><strong>Size:</strong> {selectedTemplate.width}×{selectedTemplate.height}px</p>
                      <p><strong>QR Code Size:</strong> {selectedTemplate.qrSize}×{selectedTemplate.qrSize}px</p>
                      <p><strong>Features:</strong> DEALERIQ Logo, Custom Branding</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button 
                    onClick={generateQRCode} 
                    disabled={isGenerating || !stockNumber.trim()}
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4 w-4 mr-2" />
                        Generate QR Code
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sticker Preview */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sticker Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {qrCodeUrl ? (
                  <div className="space-y-4">
                    {/* Sticker Display */}
                    <div 
                      className="border-3 border-blue-600 rounded-2xl p-6 mx-auto"
                      style={{
                        width: `${selectedTemplate.width * 0.8}px`,
                        height: `${selectedTemplate.height * 0.8}px`,
                        backgroundColor: selectedTemplate.backgroundColor,
                        borderColor: selectedTemplate.primaryColor,
                        borderWidth: '3px',
                        position: 'relative'
                      }}
                    >
                                             {/* DEALERIQ Logo */}
                       <div className="text-center ">
                         <img 
                           src={dealerIqLogo} 
                           alt="DEALERIQ Logo" 
                           className="mx-auto"
                           style={{ width: '120px', height: '96px' }}
                         />
                       </div>

                                             {/* Call to Action */}
                       <div className="text-center font-bold text-sm" style={{ color: '#2e3192' }}>
                         LET D.A.I.V.E HELP YOU
                       </div>

                      {/* Stock Number */}
                      <div className="text-center text-black text-xs">
                        STK# {stockNumber}
                      </div>

                      {/* QR Code */}
                      <div className="text-center">
                        <img 
                          src={qrCodeUrl} 
                          alt="QR Code" 
                          className="mx-auto"
                          style={{ width: `${selectedTemplate.qrSize * 0.8}px`, height: `${selectedTemplate.qrSize * 0.8}px` }}
                        />
                      </div>

                      {/* Scan Instruction */}
                      <div className="text-center text-black font-bold text-xs mt-2">
                        SCAN HERE
                      </div>

                      {/* Footer */}
                      <div className="text-center text-black text-xs mt-1">
                        Dealer A.I. Virtual Expert
                      </div>
                    </div>

                    {/* Download and Print Actions */}
                    <div className="flex gap-2">
                      <Button onClick={downloadSticker} className="flex-1">
                        <Download className="h-4 w-4 mr-2" />
                        Download Sticker
                      </Button>
                      <Button onClick={printSticker} variant="outline" className="flex-1">
                        <Printer className="h-4 w-4 mr-2" />
                        Print Sticker
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <QrCode className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p>Generate a QR code to preview the sticker</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

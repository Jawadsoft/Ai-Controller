import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Download, Printer, Settings, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vehiclesAPI } from "@/lib/api";

interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  trim?: string;
  color?: string;
  mileage?: number;
  price?: number;
  status: string;
  qr_code_url?: string;
  dealer_name?: string;
}

interface QRCodeStickerModalProps {
  vehicles: Vehicle[];
  onGenerateQR?: (vehicleId: string) => void;
  onRefresh?: () => void;
}

interface StickerTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  qrSize: number;
  showVehicleInfo: boolean;
  showDealerInfo: boolean;
  showPrice: boolean;
  backgroundColor: string;
  textColor: string;
}

const STICKER_TEMPLATES: StickerTemplate[] = [
  {
    id: "dealeriq",
    name: "DEALERIQ Style",
    width: 300,
    height: 400,
    qrSize: 120,
    showVehicleInfo: true,
    showDealerInfo: true,
    showPrice: true,
    backgroundColor: "#ffffff",
    textColor: "#000000"
  },
  {
    id: "small",
    name: "Small Sticker (2\" x 1.5\")",
    width: 200,
    height: 150,
    qrSize: 80,
    showVehicleInfo: true,
    showDealerInfo: false,
    showPrice: false,
    backgroundColor: "#ffffff",
    textColor: "#000000"
  },
  {
    id: "medium",
    name: "Medium Sticker (3\" x 2\")",
    width: 300,
    height: 200,
    qrSize: 120,
    showVehicleInfo: true,
    showDealerInfo: true,
    showPrice: false,
    backgroundColor: "#ffffff",
    textColor: "#000000"
  },
  {
    id: "large",
    name: "Large Sticker (4\" x 3\")",
    width: 400,
    height: 300,
    qrSize: 160,
    showVehicleInfo: true,
    showDealerInfo: true,
    showPrice: true,
    backgroundColor: "#ffffff",
    textColor: "#000000"
  },
  {
    id: "window",
    name: "Window Sticker (3\" x 4\")",
    width: 300,
    height: 400,
    qrSize: 140,
    showVehicleInfo: true,
    showDealerInfo: true,
    showPrice: true,
    backgroundColor: "#ffffff",
    textColor: "#000000"
  },
  {
    id: "custom",
    name: "Custom Size",
    width: 300,
    height: 200,
    qrSize: 120,
    showVehicleInfo: true,
    showDealerInfo: true,
    showPrice: true,
    backgroundColor: "#ffffff",
    textColor: "#000000"
  }
];

export const QRCodeStickerModal = ({ vehicles, onGenerateQR, onRefresh }: QRCodeStickerModalProps) => {
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<StickerTemplate>(STICKER_TEMPLATES[0]);
  const [customSettings, setCustomSettings] = useState({
    width: 300,
    height: 200,
    qrSize: 120,
    showVehicleInfo: true,
    showDealerInfo: true,
    showPrice: true,
    backgroundColor: "#ffffff",
    textColor: "#000000"
  });
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const { toast } = useToast();

  const formatPrice = (price?: number) => {
    if (!price) return "Price not set";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const handleSelectVehicle = (vehicleId: string, checked: boolean) => {
    if (checked) {
      setSelectedVehicles([...selectedVehicles, vehicleId]);
    } else {
      setSelectedVehicles(selectedVehicles.filter(id => id !== vehicleId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVehicles(vehicles.map(v => v.id));
    } else {
      setSelectedVehicles([]);
    }
  };

  const generateQRCodeForVehicle = async (vehicleId: string) => {
    try {
      await vehiclesAPI.generateQRCode(vehicleId);
      toast({
        title: "QR Code Generated",
        description: "QR code has been generated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive",
      });
    }
  };

  const generateStickers = async () => {
    if (selectedVehicles.length === 0) {
      toast({
        title: "No Vehicles Selected",
        description: "Please select at least one vehicle to generate stickers",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Generate QR codes for vehicles that don't have them
      const vehiclesWithoutQR = selectedVehicles.filter(id => {
        const vehicle = vehicles.find(v => v.id === id);
        return vehicle && !vehicle.qr_code_url;
      });

      if (vehiclesWithoutQR.length > 0) {
        toast({
          title: "Generating QR Codes",
          description: `Generating QR codes for ${vehiclesWithoutQR.length} vehicle(s) that don't have them...`,
        });

        // Use bulk QR generation for better performance
        try {
          const bulkResult = await vehiclesAPI.generateBulkQRCodes(vehiclesWithoutQR);
          
          if (bulkResult.success) {
            toast({
              title: "QR Codes Generated",
              description: `Successfully generated QR codes for ${bulkResult.results.filter(r => r.success).length} vehicle(s)`,
            });
          } else {
            throw new Error("Bulk QR generation failed");
          }
        } catch (error) {
          console.error("Bulk QR generation failed, falling back to individual generation:", error);
          
          // Fallback to individual generation
          let successCount = 0;
          for (const vehicleId of vehiclesWithoutQR) {
            try {
              await generateQRCodeForVehicle(vehicleId);
              successCount++;
            } catch (error) {
              console.error(`Failed to generate QR code for vehicle ${vehicleId}:`, error);
            }
          }
          
          if (successCount > 0) {
            toast({
              title: "QR Codes Generated",
              description: `Generated QR codes for ${successCount} vehicle(s)`,
            });
          }
        }
      }

      // Refresh the vehicles list to get updated QR codes before creating stickers
      if (onRefresh) {
        await onRefresh();
      }

      // Create printable sticker layout
      const stickerHTML = createStickerHTML();
      
      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>QR Code Stickers</title>
              <style>
                body { 
                  margin: 0; 
                  padding: 40px; 
                  font-family: Arial, sans-serif; 
                  background-color: #f5f5f5;
                }
                .sticker-page { 
                  page-break-after: always; 
                  margin-bottom: 40px;
                  padding: 20px;
                }
                .sticker-grid { 
                  display: grid; 
                  grid-template-columns: repeat(auto-fit, minmax(${selectedTemplate.width + 40}px, 1fr));
                  gap: 40px;
                  justify-items: center;
                  align-items: start;
                  padding: 20px;
                }
                @media print {
                  body { 
                    margin: 0; 
                    background-color: white;
                    padding: 20px;
                  }
                  .sticker-page { 
                    page-break-after: always; 
                    margin-bottom: 20px;
                    padding: 10px;
                  }
                  .sticker-grid { 
                    gap: 30px;
                    padding: 15px;
                  }
                }
              </style>
            </head>
            <body>
              ${stickerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
      }

      toast({
        title: "Stickers Generated",
        description: `Generated stickers for ${selectedVehicles.length} vehicle(s)`,
      });
    } catch (error) {
      console.error("Error generating stickers:", error);
      toast({
        title: "Error",
        description: "Failed to generate stickers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

    const createStickerHTML = () => {
    const selectedVehicleData = vehicles.filter(v => selectedVehicles.includes(v.id));
    
    return selectedVehicleData.map((vehicle, index) => {
      const template = selectedTemplate.id === 'custom' ? customSettings : selectedTemplate;
      
      // Calculate footer height based on template size
      const footerHeight = Math.max(50, template.height * 0.15); // Minimum 50px or 15% of height
      const bottomPadding = footerHeight + 16; // Footer height + extra padding
      
      return `
        <div class="sticker-page">
          <div class="sticker-grid">
            <div style="
              width: ${template.width}px; 
              height: ${template.height}px; 
              background-color: white; 
              border: 5px solid #1e3a8a; 
              padding: 16px 16px ${bottomPadding}px 16px; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: space-between;
              font-family: Arial, sans-serif;
              color: #1a1a1a;
              box-shadow: 0 4px 8px rgba(0,0,0,0.15);
              border-radius: 12px;
              margin: 20px;
              position: relative;
              overflow: hidden;
            ">
              <!-- Car Icon at Top -->
              <div style="
                width: ${Math.min(60, template.width * 0.2)}px; 
                height: ${Math.min(30, template.height * 0.08)}px; 
                margin-bottom: 12px;
                position: relative;
              ">
                <svg width="${Math.min(60, template.width * 0.2)}" height="${Math.min(30, template.height * 0.08)}" viewBox="0 0 60 30" style="display: block;">
                  <!-- Car body outline -->
                  <path d="M5 15 L15 15 L20 8 L40 8 L45 15 L55 15 L55 20 L50 22 L45 22 L40 25 L20 25 L15 22 L10 22 L5 20 Z" 
                        fill="none" stroke="#1a1a1a" stroke-width="1"/>
                  <!-- Front half (orange) -->
                  <path d="M5 15 L15 15 L20 8 L40 8 L45 15 L45 20 L40 22 L15 22 L10 20 L5 20 Z" 
                        fill="#ff6b35"/>
                  <!-- Back half (blue) -->
                  <path d="M45 15 L55 15 L55 20 L50 22 L45 22 L45 20 Z" 
                        fill="#1e3a8a"/>
                  <!-- Wheels -->
                  <circle cx="18" cy="22" r="3" fill="#1a1a1a"/>
                  <circle cx="42" cy="22" r="3" fill="#1a1a1a"/>
                  <!-- Small QR codes in car -->
                  <rect x="22" y="10" width="4" height="4" fill="#1a1a1a"/>
                  <rect x="28" y="10" width="4" height="4" fill="#1a1a1a"/>
                  <rect x="22" y="16" width="4" height="4" fill="#1a1a1a"/>
                  <rect x="28" y="16" width="4" height="4" fill="#1a1a1a"/>
                </svg>
              </div>
              
              <!-- DEALERIQ Logo -->
              <div style="text-align: center; margin-bottom: 8px;">
                <div style="font-size: ${Math.max(14, template.width * 0.06)}px; font-weight: bold; letter-spacing: 1px;">
                  <span style="color: #1e3a8a;">DEALER</span><span style="color: #dc2626;">IQ</span>
                </div>
                <div style="font-size: ${Math.max(8, template.width * 0.035)}px; color: #6b7280; margin-top: 2px;">
                  Selling Cars Just Got Smarter
                </div>
              </div>
              
              <!-- D.A.I.V.E Header -->
              <div style="text-align: center; margin-bottom: 12px;">
                <div style="font-size: ${Math.max(12, template.width * 0.045)}px; font-weight: bold; color: #1e3a8a;">
                  LET <span style="color: #dc2626;">D.A.I.V.E</span> HELP YOU
                </div>
              </div>
              
              <!-- Stock Number -->
              <div style="text-align: center; margin-bottom: 8px;">
                <div style="font-size: ${Math.max(9, template.width * 0.035)}px; color: #6b7280;">
                  STK# ${vehicle.id.slice(-4)}
                </div>
              </div>
              
              <!-- QR Code Section -->
              <div style="text-align: center; margin-bottom: 16px;">
                ${vehicle.qr_code_url ? `
                  <img src="${window.location.origin}${vehicle.qr_code_url}" 
                       style="width: ${template.qrSize}px; height: ${template.qrSize}px; border: 1px solid #e5e7eb;" 
                       alt="QR Code" />
                ` : `
                  <div style="
                    width: ${template.qrSize}px; 
                    height: ${template.qrSize}px; 
                    background-color: #f3f4f6; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                  ">
                    <span style="font-size: 10px; color: #6b7280; text-align: center;">No QR Code<br/>Available</span>
                  </div>
                `}
              </div>
              
              <!-- Scan Here Text -->
              <div style="text-align: center; margin-bottom: 6px;">
                <div style="font-size: ${Math.max(10, template.width * 0.04)}px; font-weight: bold; color: #1e3a8a;">
                  SCAN HERE
                </div>
              </div>
              
              <!-- Vehicle Information Section -->
              ${template.showVehicleInfo ? `
                <div style="text-align: center; margin-bottom: 6px;">
                  <div style="font-weight: bold; font-size: ${Math.max(12, template.width * 0.045)}px; margin-bottom: 2px; color: #1a1a1a;">
                    ${vehicle.year} ${vehicle.make} ${vehicle.model}
                  </div>
                  ${vehicle.trim ? `<div style="font-size: ${Math.max(8, template.width * 0.035)}px; color: #6b7280; margin-bottom: 1px;">${vehicle.trim}</div>` : ''}
                  ${vehicle.color ? `<div style="font-size: ${Math.max(7, template.width * 0.03)}px; color: #6b7280; margin-bottom: 1px;">Color: ${vehicle.color}</div>` : ''}
                  ${vehicle.mileage ? `<div style="font-size: ${Math.max(7, template.width * 0.03)}px; color: #6b7280; margin-bottom: 1px;">Mileage: ${vehicle.mileage.toLocaleString()} miles</div>` : ''}
                </div>
              ` : ''}
              
              <!-- Dealer Information Section -->
              ${template.showDealerInfo && vehicle.dealer_name ? `
                <div style="text-align: center; margin-bottom: 4px;">
                  <div style="font-weight: bold; font-size: ${Math.max(8, template.width * 0.035)}px; color: #1a1a1a;">${vehicle.dealer_name}</div>
                </div>
              ` : ''}
              
              <!-- Price Section -->
              ${template.showPrice && vehicle.price ? `
                <div style="text-align: center; margin-bottom: 4px;">
                  <div style="font-size: ${Math.max(14, template.width * 0.05)}px; font-weight: bold; color: #dc2626; margin-bottom: 2px;">
                    ${formatPrice(vehicle.price)}
                  </div>
                </div>
              ` : ''}
              
              <!-- Bottom Line with Text -->
              <div style="
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background-color: #1e3a8a;
                padding: 12px 0;
                text-align: center;
                height: ${footerHeight}px;
                display: flex;
                flex-direction: column;
                justify-content: center;
              ">
                <div style="font-size: ${Math.max(10, template.width * 0.04)}px; font-weight: bold; color: white; margin-bottom: 2px;">
                  SCAN HERE
                </div>
                <div style="font-size: ${Math.max(8, template.width * 0.035)}px; font-weight: bold; color: white;">
                  Dealer A.I. Virtual Expert
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  const getVehiclesNeedingQR = () => {
    return selectedVehicles.filter(id => {
      const vehicle = vehicles.find(v => v.id === id);
      return vehicle && !vehicle.qr_code_url;
    });
  };

  const downloadStickers = () => {
    const stickerHTML = createStickerHTML();
    const blob = new Blob([`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code Stickers</title>
          <style>
            body { 
              margin: 0; 
              padding: 40px; 
              font-family: Arial, sans-serif; 
              background-color: #f5f5f5;
            }
            .sticker-page { 
              page-break-after: always; 
              margin-bottom: 40px;
              padding: 20px;
            }
            .sticker-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(${selectedTemplate.width + 40}px, 1fr));
              gap: 40px;
              justify-items: center;
              align-items: start;
              padding: 20px;
            }
            @media print {
              body { 
                margin: 0; 
                background-color: white;
                padding: 20px;
              }
              .sticker-page { 
                page-break-after: always; 
                margin-bottom: 20px;
                padding: 10px;
              }
              .sticker-grid { 
                gap: 30px;
                padding: 15px;
              }
            }
          </style>
        </head>
        <body>
          ${stickerHTML}
        </body>
      </html>
    `], { type: 'text/html' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qr-code-stickers.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Stickers Downloaded",
      description: "QR code stickers have been downloaded",
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2">
          <QrCode className="h-4 w-4" />
          <span>Generate QR Stickers</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <QrCode className="h-5 w-5" />
            <span>QR Code Sticker Generator</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vehicle Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Select Vehicles</span>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedVehicles.length === vehicles.length && vehicles.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">Select All</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex items-center space-x-3 p-2 border rounded">
                    <Checkbox
                      checked={selectedVehicles.includes(vehicle.id)}
                      onCheckedChange={(checked) => handleSelectVehicle(vehicle.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        VIN: {vehicle.vin}
                      </div>
                    </div>
                                         <div className="flex items-center space-x-2">
                       {vehicle.qr_code_url ? (
                         <Badge variant="default" className="text-xs">QR Ready</Badge>
                       ) : (
                         <Badge variant="destructive" className="text-xs">Needs QR</Badge>
                       )}
                       <Badge variant={vehicle.status === 'available' ? 'default' : 'secondary'}>
                         {vehicle.status}
                       </Badge>
                     </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Template Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Sticker Template</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Template Size</Label>
                <Select
                  value={selectedTemplate.id}
                  onValueChange={(value) => {
                    const template = STICKER_TEMPLATES.find(t => t.id === value);
                    if (template) {
                      setSelectedTemplate(template);
                      if (value === 'custom') {
                        setCustomSettings({
                          width: template.width,
                          height: template.height,
                          qrSize: template.qrSize,
                          showVehicleInfo: template.showVehicleInfo,
                          showDealerInfo: template.showDealerInfo,
                          showPrice: template.showPrice,
                          backgroundColor: template.backgroundColor,
                          textColor: template.textColor
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STICKER_TEMPLATES.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate.id === 'custom' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Width (px)</Label>
                      <Input
                        type="number"
                        value={customSettings.width}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, width: parseInt(e.target.value) || 300 }))}
                      />
                    </div>
                    <div>
                      <Label>Height (px)</Label>
                      <Input
                        type="number"
                        value={customSettings.height}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, height: parseInt(e.target.value) || 200 }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>QR Code Size (px)</Label>
                    <Input
                      type="number"
                      value={customSettings.qrSize}
                      onChange={(e) => setCustomSettings(prev => ({ ...prev, qrSize: parseInt(e.target.value) || 120 }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Background Color</Label>
                      <Input
                        type="color"
                        value={customSettings.backgroundColor}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Text Color</Label>
                      <Input
                        type="color"
                        value={customSettings.textColor}
                        onChange={(e) => setCustomSettings(prev => ({ ...prev, textColor: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={customSettings.showVehicleInfo}
                        onCheckedChange={(checked) => setCustomSettings(prev => ({ ...prev, showVehicleInfo: checked as boolean }))}
                      />
                      <Label>Show Vehicle Information</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={customSettings.showDealerInfo}
                        onCheckedChange={(checked) => setCustomSettings(prev => ({ ...prev, showDealerInfo: checked as boolean }))}
                      />
                      <Label>Show Dealer Information</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={customSettings.showPrice}
                        onCheckedChange={(checked) => setCustomSettings(prev => ({ ...prev, showPrice: checked as boolean }))}
                      />
                      <Label>Show Price</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview */}
              <div className="border rounded p-4">
                <Label>Preview</Label>
                <div className="mt-2 flex justify-center">
                  <div
                    style={{
                      width: Math.min(selectedTemplate.width, 200),
                      height: Math.min(selectedTemplate.height, 150),
                      backgroundColor: selectedTemplate.backgroundColor,
                      border: '1px solid #ccc',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '8px'
                    }}
                  >
                    <div style={{ width: Math.min(selectedTemplate.qrSize, 60), height: Math.min(selectedTemplate.qrSize, 60), backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}></div>
                    {selectedTemplate.showVehicleInfo && (
                      <div style={{ textAlign: 'center', marginTop: '5px' }}>
                        <div style={{ fontWeight: 'bold' }}>2024 Toyota Camry</div>
                        <div style={{ fontSize: '6px' }}>VIN: 1HGBH41JXMN109186</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

                 {/* Warning for vehicles without QR codes */}
         {getVehiclesNeedingQR().length > 0 && (
           <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
             <div className="flex items-center">
               <div className="flex-shrink-0">
                 <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                 </svg>
               </div>
               <div className="ml-3">
                 <p className="text-sm text-yellow-800">
                   <strong>Note:</strong> {getVehiclesNeedingQR().length} selected vehicle(s) don't have QR codes. 
                   QR codes will be automatically generated when you print stickers.
                 </p>
               </div>
             </div>
           </div>
         )}

         {/* Action Buttons */}
         <div className="flex justify-between items-center pt-4 border-t">
           <div className="text-sm text-muted-foreground">
             {selectedVehicles.length} vehicle(s) selected
             {(() => {
               const vehiclesNeedingQR = getVehiclesNeedingQR();
               return vehiclesNeedingQR.length > 0 ? (
                 <span className="ml-2 text-destructive">
                   • {vehiclesNeedingQR.length} need QR codes
                 </span>
               ) : null;
             })()}
           </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={downloadStickers}
              disabled={selectedVehicles.length === 0 || loading}
            >
              <Download className="h-4 w-4 mr-2" />
              Download HTML
            </Button>
                                     <Button
              variant="accent"
              onClick={generateStickers}
              disabled={selectedVehicles.length === 0 || loading}
            >
              <Printer className="h-4 w-4 mr-2" />
              {loading ? "Generating..." : (() => {
                const vehiclesNeedingQR = getVehiclesNeedingQR();
                return vehiclesNeedingQR.length > 0 ? "Generate QR & Print" : "Print Stickers";
              })()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, FileText, Printer, Settings, Car, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vehiclesAPI } from "@/lib/api";
import { buildBackendAssetUrl } from "@/lib/config";
import { useAuth } from "@/hooks/useAuth";

// Import the actual DEALERIQ logo
import dealerIqLogo from "../../assets/dealeriq-logo.png";

interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  stock_number?: string;
  trim?: string;
  color?: string;
  mileage?: number;
  price?: number;
  status: string;
  qr_code_url?: string;
  dealer_name?: string;
  sticker_generation_status?: string;
  sticker_generated_at?: string;
  sticker_printed_at?: string;
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
    id: "letter-size-6pack",
    name: "Letter Size - 6 Pack (Auto Width x 3-1/2\" each)",
    width: 350, // Auto width - will adjust to page
    height: 336, // 3.5" at 96 DPI
    qrSize: 100,
    showVehicleInfo: true,
    showDealerInfo: true,
    showPrice: true,
    backgroundColor: "#ffffff",
    textColor: "#000000"
  },
  {
    id: "dealeriq-classic",
    name: "DEALERIQ Classic",
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
    id: "dealeriq-minimal",
    name: "DEALERIQ Minimal",
    width: 280,
    height: 380,
    qrSize: 100,
    showVehicleInfo: true,
    showDealerInfo: false,
    showPrice: false,
    backgroundColor: "#ffffff",
    textColor: "#000000"
  },
  {
    id: "dealeriq-premium",
    name: "DEALERIQ Premium",
    width: 350,
    height: 450,
    qrSize: 140,
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
    id: "phomemo-75x75",
    name: "Phomemo 75mm × 75mm (Single)",
    width: 283,
    height: 283,
    qrSize: 130,
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
  const { user } = useAuth();
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<StickerTemplate>(
    STICKER_TEMPLATES.find(t => t.id === 'phomemo-75x75') || STICKER_TEMPLATES[0]
  );
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
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [showPrintedVehicles, setShowPrintedVehicles] = useState(false);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [fetchingVehicles, setFetchingVehicles] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Check if user can print labels (all roles except sales)
  const canPrintLabels = user?.staffRole !== 'sales';

  // Fetch vehicles from backend with sticker status filter
  const fetchVehiclesWithFilter = async (stickerStatus: string = 'generated', search: string = '') => {
    setFetchingVehicles(true);
    try {
      console.log('Fetching vehicles with filter:', { stickerStatus, search });
      
      const response = await vehiclesAPI.getAll({
        sticker_status: stickerStatus,
        search: search,
        limit: -1, // Get all vehicles
        inventory_status: 'available' // Only available vehicles
      });
      
      console.log('API response:', response);
      console.log('Response data length:', response.data?.length || 0);
      
      // Filter vehicles that have both price and stock number set
      const eligibleVehicles = response.data.filter((vehicle: Vehicle) => 
        vehicle.price && 
        vehicle.price > 0 && 
        vehicle.stock_number && 
        vehicle.stock_number.trim() !== ''
      );
      
      console.log('Eligible vehicles after filtering:', eligibleVehicles.length);
      console.log('Sample eligible vehicles:', eligibleVehicles.slice(0, 3));
      
      setFilteredVehicles(eligibleVehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast({
        title: "Error",
        description: "Failed to fetch vehicles",
        variant: "destructive",
      });
    } finally {
      setFetchingVehicles(false);
    }
  };

  // Initial load - fetch generated vehicles
  useEffect(() => {
    fetchVehiclesWithFilter('generated');
  }, []);

  // Filter by sticker status - show generated only by default, or include printed if toggled
  const getStickerStatusFilter = () => {
    if (showPrintedVehicles) {
      return 'generated,printed'; // Show both generated and printed vehicles
    } else {
      return 'generated'; // Show only generated vehicles (default)
    }
  };

  // Preload the logo image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLogoLoaded(true);
    img.src = dealerIqLogo;
  }, []);

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
      setSelectedVehicles(filteredVehicles.map(v => v.id));
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
      // Refresh the vehicle list after generating QR code
      fetchVehiclesWithFilter(getStickerStatusFilter(), searchTerm);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive",
      });
    }
  };

  const togglePrintedVehicles = () => {
    const newShowPrintedVehicles = !showPrintedVehicles;
    setShowPrintedVehicles(newShowPrintedVehicles);
    setSelectedVehicles([]); // Clear selections when changing filter
    
    // Determine the filter based on the new state
    const newFilter = newShowPrintedVehicles ? 'generated,printed' : 'generated';
    
    // Fetch vehicles with new filter
    fetchVehiclesWithFilter(newFilter, searchTerm);
  };

  const refreshVehicles = () => {
    setSelectedVehicles([]); // Clear selections when refreshing
    fetchVehiclesWithFilter(getStickerStatusFilter(), searchTerm);
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      fetchVehiclesWithFilter(getStickerStatusFilter(), value);
    }, 500);
    
    setSearchTimeout(timeout);
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

    // Open the print window synchronously here (before any awaits) so iOS Safari
    // does not block it — Safari only allows window.open inside a direct user-gesture.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups for this site in your browser settings, then try again.",
        variant: "destructive",
      });
      return;
    }
    // Show a temporary loading page while we prepare the sticker content
    printWindow.document.write('<html><head><title>QR Code Stickers</title></head><body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><p style="font-size:18px;color:#555;">Preparing stickers, please wait...</p></body></html>');

    setLoading(true);
    try {
      // Generate QR codes for vehicles that don't have them
      const vehiclesWithoutQR = selectedVehicles.filter(id => {
        const vehicle = filteredVehicles.find(v => v.id === id);
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
      
      // Write the final sticker content into the already-opened window
      if (printWindow) {
        // Check if using letter-size or phomemo template
        const isLetterSize = selectedTemplate.id === 'letter-size-6pack';
        const isPhomemoPrint = selectedTemplate.id === 'phomemo-75x75';
        
        printWindow.document.open();
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>QR Code Stickers</title>
              <style>
                @page {
                  size: ${isPhomemoPrint ? '75mm 75mm' : isLetterSize ? '8.5in 11in' : 'auto'};
                  margin: ${isPhomemoPrint ? '3mm' : '0'};
                }
                body { 
                  margin: 0; 
                  padding: ${isPhomemoPrint ? '0' : isLetterSize ? '0.05in' : '5px'}; 
                  padding-top: ${isPhomemoPrint ? '0' : '0.7in'}; 
                  font-family: Arial, sans-serif; 
                  background-color: ${isPhomemoPrint ? 'white' : '#f5f5f5'};
                }
                .sticker-page { 
                  page-break-after: always; 
                  margin: 0;
                  padding: 0;
                  width: ${isPhomemoPrint ? '75mm' : '8.5in'};
                  height: ${isPhomemoPrint ? '75mm' : '11in'};
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                }
                .sticker-page:last-child { page-break-after: avoid; }
                .sticker-grid { 
                  display: grid; 
                  ${isLetterSize ? 
                    `grid-template-columns: repeat(2, 1fr);
                     grid-template-rows: repeat(3, 3.4in);
                     gap: 0.66in;
                     row-gap: 0.4in;
                     width: 99%;
                     height: 11in;
                     padding: 0;
                     box-sizing: border-box;` :
                    `grid-template-columns: repeat(auto-fit, minmax(${selectedTemplate.width + 40}px, 1fr));
                     gap: 40px;`
                  }
                  justify-items: center;
                  align-items: center;
                  justify-content: center;
                  align-content: center;
                }
                @media print {
                  body { 
                    margin: 0; 
                    background-color: white;
                    padding: 0;
                  }
                  .sticker-page { 
                    page-break-after: always; 
                    margin: 0;
                    padding: 0;
                    width: ${isPhomemoPrint ? '75mm' : '8.5in'};
                    height: ${isPhomemoPrint ? '75mm' : '11in'};
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                  }
                  .sticker-page:last-child { page-break-after: avoid; }
                  .sticker-grid { 
                    gap: 0.66in;
                    row-gap: 0.4in;
                    padding: 0;
                    ${isLetterSize ? 
                      `grid-template-columns: repeat(2, 1fr);
                       grid-template-rows: repeat(3, 3.4in);
                       width: 99%;
                       height: 11in;
                       justify-content: center;
                       align-content: center;` : ''
                    }
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

      // Mark stickers as printed after generating them
      await markStickersAsPrinted(selectedVehicles);

      toast({
        title: "Stickers Generated",
        description: `Generated stickers for ${selectedVehicles.length} vehicle(s) and marked as printed`,
      });
    } catch (error) {
      console.error("Error generating stickers:", error);
      // Close the pre-opened window if sticker generation failed
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
      toast({
        title: "Error",
        description: "Failed to generate stickers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markStickersAsPrinted = async (vehicleIds: string[]) => {
    try {
      console.log('Marking stickers as printed for vehicles:', vehicleIds);
      
      // Mark each vehicle as printed using vehiclesAPI
      const results = await Promise.allSettled(
        vehicleIds.map(async (vehicleId) => {
          try {
            const result = await vehiclesAPI.markStickerPrinted(vehicleId);
            console.log(`Successfully marked vehicle ${vehicleId} as printed:`, result);
            return { vehicleId, success: true, result };
          } catch (error) {
            console.error(`Error marking vehicle ${vehicleId} as printed:`, error);
            return { vehicleId, success: false, error: error.message };
          }
        })
      );

      // Count successes and failures
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

      console.log(`Mark stickers as printed results: ${successful} successful, ${failed} failed`);

      if (failed > 0) {
        toast({
          title: "Partial Success",
          description: `Marked ${successful} stickers as printed, ${failed} failed`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Marked ${successful} stickers as printed`,
        });
      }
      
      // Refresh the vehicle list to show updated status
      fetchVehiclesWithFilter(getStickerStatusFilter(), searchTerm);
      
    } catch (error) {
      console.error("Error marking stickers as printed:", error);
      toast({
        title: "Error",
        description: "Failed to mark stickers as printed",
        variant: "destructive",
      });
    }
  };

    const createStickerHTML = () => {
    const selectedVehicleData = filteredVehicles.filter(v => selectedVehicles.includes(v.id));
    const isLetterSize = selectedTemplate.id === 'letter-size-6pack';
    const isPhomemo = selectedTemplate.id === 'phomemo-75x75';

    if (isPhomemo) {
      return selectedVehicleData.map((vehicle) => {
        return `
          <div class="sticker-page">
            <div style="
              width: 69mm;
              height: 69mm;
              background-color: #ffffff;
              border: 2px solid #1e40af;
              padding: 3mm 3mm 3mm 3mm;
              margin-top: 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              font-family: Arial, sans-serif;
              color: #000000;
              border-radius: 4mm;
              box-sizing: border-box;
              overflow: hidden;
            ">
              <div style="text-align: center;">
                <img src="${dealerIqLogo}" alt="DEALERIQ" style="width: 18mm; height: 12mm;" />
              </div>
              <div style="font-size: 7pt; font-weight: bold; color: #1e40af; text-align: center;">
                LET D.A.I.V.E. HELP YOU
              </div>
              <div style="font-size: 6pt; text-align: center;">
                STK# ${vehicle.stock_number || vehicle.id.slice(-4)}
              </div>
              <div style="text-align: center;">
                ${vehicle.qr_code_url ? `
                  <img crossOrigin="anonymous"
                    src="${buildBackendAssetUrl(vehicle.qr_code_url)}?t=${Date.now()}"
                    style="width: 25mm; height: 25mm; border: 1px solid #e5e7eb;" alt="QR Code" />
                ` : `
                  <div style="width:25mm;height:25mm;background:#f3f4f6;border:1px solid #d1d5db;
                    display:flex;align-items:center;justify-content:center;font-size:6pt;color:#6b7280;text-align:center;">
                    No QR
                  </div>
                `}
              </div>
              <div style="font-size: 6pt; font-weight: bold; text-align: center;">SCAN HERE</div>
              <div style="font-size: 7pt; font-weight: bold; text-align: center;">
                ${vehicle.year} ${vehicle.make} ${vehicle.model}
              </div>
              ${vehicle.price ? `
                <div style="font-size: 7pt; font-weight: bold; color: #dc2626; text-align: center;">
                  ${formatPrice(vehicle.price)}
                </div>
              ` : ''}
              <div style="font-size: 5pt; text-align: center; color: #000000;">
                Dealer A.I. Virtual Expert
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else if (isLetterSize) {
      // Group vehicles into pages of 6 for letter-size layout
      const pages = [];
      for (let i = 0; i < selectedVehicleData.length; i += 6) {
        pages.push(selectedVehicleData.slice(i, i + 6));
      }
      
      return pages.map((pageVehicles, pageIndex) => {
        const template = selectedTemplate.id === 'custom' ? customSettings : selectedTemplate;
        
        const stickersHTML = pageVehicles.map((vehicle) => {
          return `
            <div style="
              width: 80%; 
              height: 3.4in; 
              background-color: ${template.backgroundColor}; 
               border: 2px solid #1e40af; 
              padding: 0.03in; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: space-between;
              font-family: Arial, sans-serif;
              color: #000000;
              border-radius: 8px;
              border-top-right-radius: 32px;   /* increased */
              border-bottom-left-radius: 32px; /* increased */
              position: relative;
              overflow: hidden;
              box-sizing: border-box;
              transform: rotate(90deg);
            ">
              <!-- DEALERIQ Logo at Top -->
              <div style="text-align: center; margin-bottom: 0.01in;margin-top: 0.2in;">
                <img 
                  src="${dealerIqLogo}" 
                  alt="DEALERIQ Logo" 
                  style="width: 1.1in; height: 0.9in; margin-bottom: 0.01in;"
                />
              </div>
              
              <!-- D.A.I.V.E Call to Action -->
              <div style="text-align: center; margin-bottom: 0.015in;">
                <div style="font-size: 16px; font-weight: bold; color: #1e40af;">
                  LET D.A.I.V.E. HELP YOU
                </div>
              </div>
              
              <!-- Stock Number -->
              <div style="text-align: center; margin-bottom: 0.015in;">
                <div style="font-size: 11px; color: #000000;">
                  STK# ${vehicle.stock_number || vehicle.id.slice(-4)}
                </div>
              </div>
              
              <!-- QR Code Section -->
              <div style="text-align: center; margin-bottom: 0.02in;">
                ${vehicle.qr_code_url ? `
                  <img 
                      crossOrigin="anonymous" 
                       src="${buildBackendAssetUrl(vehicle.qr_code_url)}?t=${Date.now()}" 
                       style="width: 1in; height: 1in; border: 1px solid #e5e7eb;" 
                       alt="QR Code" />
                ` : `
                  <div style="
                    width: 1.0in; 
                    height: 1.0in; 
                    background-color: #f3f4f6; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                  ">
                    <span style="font-size: 9px; color: #6b7280; text-align: center;">No QR Code<br/>Available</span>
                  </div>
                `}
              </div>
              
              <!-- Scan Here Text -->
              <div style="text-align: center; margin-bottom: 0.015in;">
                <div style="font-size: 11px; font-weight: bold; color: #000000;">
                  SCAN HERE
                </div>
              </div>
              
              <!-- Vehicle Information Section -->
              ${template.showVehicleInfo ? `
                <div style="text-align: center; margin-bottom: 0.008in;">
                  <div style="font-weight: bold; font-size: 14px; margin-bottom: 0.008in; color: #000000;">
                    ${vehicle.year} ${vehicle.make} ${vehicle.model}
                  </div>
                </div>
              ` : ''}
              
              <!-- Dealer Information Section -->
              ${template.showDealerInfo && vehicle.dealer_name ? `
                <div style="text-align: center; margin-bottom: 0.008in;">
                  <div style="font-weight: bold; font-size: 9px; color: #000000;">${vehicle.dealer_name}</div>
                </div>
              ` : ''}
              
              <!-- Price Section -->
              ${template.showPrice && vehicle.price ? `
                <div style="text-align: center; margin-bottom: 0.008in;">
                  <div style="font-size: 13px; font-weight: bold; color: #dc2626; margin-bottom: 0.008in;">
                    ${formatPrice(vehicle.price)}
                  </div>
                </div>
              ` : ''}
              
              <!-- Footer -->
              <div style="text-align: center; margin-top: auto;">
                <div style="font-size: 9px; color: #000000;">
                  Dealer A.I. Virtual Expert
                </div>
              </div>
            </div>
          `;
        }).join('');
        
        return `
          <div class="sticker-page">
            <div class="sticker-grid">
              ${stickersHTML}
            </div>
          </div>
        `;
      }).join('');
    } else {
      // Original layout for other templates
      return selectedVehicleData.map((vehicle, index) => {
        const template = selectedTemplate.id === 'custom' ? customSettings : selectedTemplate;
        
        return `
          <div class="sticker-page">
            <div class="sticker-grid">
              <div style="
                width: ${template.width}px; 
                height: ${template.height}px; 
                background-color: ${template.backgroundColor}; 
                border: 3px solid #1e40af; 
                padding: 20px; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: space-between;
                font-family: Arial, sans-serif;
                color: #000000;
                border-radius: 15px;
                margin: 20px;
                position: relative;
                overflow: hidden;
                transform: rotate(90deg);
              ">
                <!-- DEALERIQ Logo at Top -->
                <div style="text-align: center; margin-bottom: 8px;">
                  <img 
                    src="${dealerIqLogo}" 
                    alt="DEALERIQ Logo" 
                    style="width: 144px; height: 115px; margin-bottom: 8px;"
                  />
                </div>
                
                <!-- D.A.I.V.E Call to Action -->
                <div style="text-align: center; margin-bottom: 8px;">
                  <div style="font-size: 18px; font-weight: bold; color: #1e40af;">
                    LET D.A.I.V.E. HELP YOU
                  </div>
                </div>
                
                <!-- Stock Number -->
                <div style="text-align: center; margin-bottom: 8px;">
                  <div style="font-size: 12px; color: #000000;">
                    STK# ${vehicle.stock_number || vehicle.id.slice(-4)}
                  </div>
                </div>
                
                <!-- QR Code Section -->
                <div style="text-align: center; margin-bottom: 16px;">
                  ${vehicle.qr_code_url ? `
                    <img 
                        crossOrigin="anonymous" 
                         src="${buildBackendAssetUrl(vehicle.qr_code_url)}?t=${Date.now()}" 
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
                  <div style="font-size: 12px; font-weight: bold; color: #000000;">
                    SCAN HERE
                  </div>
                </div>
                
                <!-- Vehicle Information Section -->
                ${template.showVehicleInfo ? `
                  <div style="text-align: center; margin-bottom: 6px;">
                    <div style="font-weight: bold; font-size: 16px; margin-bottom: 2px; color: #000000;">
                      ${vehicle.year} ${vehicle.make} ${vehicle.model}
                    </div>
                    ${vehicle.trim ? `<div style="font-size: 10px; color: #6b7280; margin-bottom: 1px;">${vehicle.trim}</div>` : ''}
                    ${vehicle.mileage ? `<div style="font-size: 9px; color: #6b7280; margin-bottom: 1px;">Mileage: ${vehicle.mileage.toLocaleString()} miles</div>` : ''}
                  </div>
                ` : ''}
                
                <!-- Dealer Information Section -->
                ${template.showDealerInfo && vehicle.dealer_name ? `
                  <div style="text-align: center; margin-bottom: 4px;">
                    <div style="font-weight: bold; font-size: 10px; color: #000000;">${vehicle.dealer_name}</div>
                  </div>
                ` : ''}
                
                <!-- Price Section -->
                ${template.showPrice && vehicle.price ? `
                  <div style="text-align: center; margin-bottom: 4px;">
                    <div style="font-size: 14px; font-weight: bold; color: #dc2626; margin-bottom: 2px;">
                      ${formatPrice(vehicle.price)}
                    </div>
                  </div>
                ` : ''}
                
                <!-- Footer -->
                <div style="text-align: center; margin-top: auto;">
                  <div style="font-size: 10px; color: #000000;">
                    Dealer A.I. Virtual Expert
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  };

  const getVehiclesNeedingQR = () => {
    return selectedVehicles.filter(id => {
      const vehicle = filteredVehicles.find(v => v.id === id);
      return vehicle && !vehicle.qr_code_url;
    });
  };

  // Fetch any image URL and return a base64 data URL so PDFs are self-contained
  const fetchAsBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return url;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  };

  const generatePDF = async () => {
    if (selectedVehicles.length === 0) {
      toast({
        title: "No Vehicles Selected",
        description: "Please select at least one vehicle to generate a PDF",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const isLetterSize = selectedTemplate.id === 'letter-size-6pack';
      const isPhomemoPDF = selectedTemplate.id === 'phomemo-75x75';

      // Build initial HTML with normal URLs
      let stickerHTML = createStickerHTML();

      // Collect all unique image src URLs in the HTML and replace with base64
      // so html-pdf-node doesn't need to make any network requests
      const srcRegex = /src="(https?:\/\/[^"]+)"/g;
      const urlsToEmbed = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = srcRegex.exec(stickerHTML)) !== null) {
        urlsToEmbed.add(match[1]);
      }

      // Also embed the logo (it may be a relative Vite asset path)
      const logoAbsolute = dealerIqLogo.startsWith('http')
        ? dealerIqLogo
        : `${window.location.origin}${dealerIqLogo}`;
      urlsToEmbed.add(logoAbsolute);

      // Fetch all images in parallel and build a replacement map
      const entries = await Promise.all(
        Array.from(urlsToEmbed).map(async (url) => [url, await fetchAsBase64(url)] as [string, string])
      );
      const base64Map = new Map(entries);

      // Replace all src URLs with base64 data URLs
      stickerHTML = stickerHTML.replace(srcRegex, (_full, url) => {
        const b64 = base64Map.get(url);
        return b64 ? `src="${b64}"` : `src="${url}"`;
      });
      // Also replace the logo path (may not be http-prefixed in the HTML)
      if (!dealerIqLogo.startsWith('http')) {
        const logoB64 = base64Map.get(logoAbsolute);
        if (logoB64) {
          stickerHTML = stickerHTML.split(`src="${dealerIqLogo}"`).join(`src="${logoB64}"`);
        }
      }

      // Build a minimal full HTML document for the PDF renderer
      const fullHTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      @page {
        margin: ${isPhomemoPDF ? '8mm 3mm 3mm 3mm' : '0'};
      }
      html, body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
        background-color: white;
      }
      .sticker-page {
        page-break-after: always;
        break-after: page;
        margin: 0;
        padding: 0;
        width: ${isPhomemoPDF ? '75mm' : '8.5in'};
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }
      .sticker-page:first-child {
        page-break-before: avoid;
        break-before: avoid;
      }
      .sticker-page:last-child {
        page-break-after: avoid;
        break-after: avoid;
      }
      .sticker-grid {
        display: grid;
        ${isLetterSize
          ? `grid-template-columns: repeat(2, 1fr);
             grid-template-rows: repeat(3, 3.4in);
             gap: 0.66in;
             row-gap: 0.4in;
             width: 99%;
             height: 11in;
             padding: 0;
             box-sizing: border-box;`
          : `grid-template-columns: repeat(auto-fit, minmax(${selectedTemplate.width + 40}px, 1fr));
             gap: 40px;`
        }
        justify-items: center;
        align-items: center;
        justify-content: center;
        align-content: center;
      }
    </style>
  </head>
  <body>${stickerHTML}</body>
</html>`;

      const pdfBlob = await vehiclesAPI.generateStickerPDF({
        html: fullHTML,
        ...(isPhomemoPDF ? { pageWidth: '75mm', pageHeight: '75mm' } : {}),
      });

      // Trigger browser download
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-stickers-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: `Generated PDF for ${selectedVehicles.length} vehicle(s)`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="flex shrink-0 items-center gap-2 whitespace-nowrap"
          disabled={!canPrintLabels}
          title={!canPrintLabels ? "Label printing is restricted for sales staff" : "Generate QR code stickers for vehicles"}
        >
          <QrCode className="h-4 w-4 shrink-0" />
          <span className="hidden md:inline">Generate QR Stickers</span>
          <span className="md:hidden">QR Stickers</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex flex-col w-[95vw] max-w-6xl max-h-[90vh] overflow-hidden p-4 sm:p-6 gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle className="flex items-center space-x-2">
            <QrCode className="h-5 w-5" />
            <span>QR Code Sticker Generator</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 -mr-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vehicle Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between text-sm">
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold">Select Vehicles ({filteredVehicles.length} available)</span>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Input
                      placeholder="Search vehicles..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="h-6 px-2 text-xs w-full sm:w-40"
                    />
                    <Button
                      variant={showPrintedVehicles ? "default" : "outline"}
                      size="sm"
                      onClick={togglePrintedVehicles}
                      disabled={fetchingVehicles}
                      className="h-6 px-2 text-xs shrink-0"
                    >
                      {showPrintedVehicles ? "Generated Only" : "Include Printed"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshVehicles}
                      disabled={fetchingVehicles}
                      className="h-6 px-2 text-xs flex items-center gap-1 shrink-0"
                    >
                      <RefreshCw className={`h-3 w-3 ${fetchingVehicles ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </Button>
                    {fetchingVehicles && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <div className="animate-spin h-3 w-3 border-b border-current rounded-full" />
                        <span>Loading...</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Checkbox
                    checked={selectedVehicles.length === filteredVehicles.length && filteredVehicles.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">Select All</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto overflow-x-hidden">
              {filteredVehicles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {fetchingVehicles ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin h-5 w-5 border-b-2 border-primary rounded-full" />
                      <span>Loading vehicles...</span>
                    </div>
                  ) : (
                    <>
                      <p>No vehicles found with QR codes ready for printing.</p>
                      <p className="text-sm mt-2">
                        {showPrintedVehicles 
                          ? "No vehicles have generated or printed QR codes." 
                          : "No vehicles have generated QR codes. Try including printed vehicles or generate QR codes first."
                        }
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-center p-1.5 border rounded text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Checkbox
                        checked={selectedVehicles.includes(vehicle.id)}
                        onCheckedChange={(checked) => handleSelectVehicle(vehicle.id, checked as boolean)}
                        className="shrink-0 h-3.5 w-3.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate text-xs">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          VIN: {vehicle.vin}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 pl-6 sm:pl-0 shrink-0">
                      {vehicle.sticker_generation_status === 'printed' && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-green-600 hover:bg-green-700">
                          ✓ Printed
                        </Badge>
                      )}
                      {vehicle.sticker_generation_status === 'generated' && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                          QR Ready
                        </Badge>
                      )}
                      {vehicle.sticker_generation_status === 'not_generated' && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                          Needs QR
                        </Badge>
                      )}
                      <Badge variant={vehicle.status === 'available' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 h-4">
                        {vehicle.status}
                      </Badge>
                    </div>
                  </div>
                  ))}
                </div>
              )}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    {/* Show DEALERIQ logo preview */}
                    <img 
                      src={dealerIqLogo} 
                      alt="DEALERIQ Logo Preview" 
                      style={{ 
                        width: Math.min(60, selectedTemplate.width * 0.22), 
                        height: Math.min(48, selectedTemplate.height * 0.14),
                        marginBottom: '5px'
                      }} 
                    />
                    
                    {/* Show actual QR code if a vehicle is selected and has QR code */}
                    {selectedVehicles.length > 0 ? (() => {
                      const selectedVehicle = filteredVehicles.find(v => v.id === selectedVehicles[0]);
                      return selectedVehicle?.qr_code_url ? (
                        <img 
                          crossOrigin="anonymous"
                          src={`${buildBackendAssetUrl(selectedVehicle.qr_code_url)}?t=${Date.now()}`} 
                          alt="QR Code Preview" 
                          style={{ 
                            width: Math.min(selectedTemplate.qrSize, 80), 
                            height: Math.min(selectedTemplate.qrSize, 80),
                            border: '1px solid #ccc'
                          }} 
                        />
                      ) : (
                        <div style={{ 
                          width: Math.min(selectedTemplate.qrSize, 80), 
                          height: Math.min(selectedTemplate.qrSize, 80), 
                          backgroundColor: '#f0f0f0', 
                          border: '1px solid #ccc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '7px',
                          textAlign: 'center'
                        }}>
                          No QR Code
                        </div>
                      );
                    })() : (
                      <div style={{ 
                        width: Math.min(selectedTemplate.qrSize, 80), 
                        height: Math.min(selectedTemplate.qrSize, 80), 
                        backgroundColor: '#f0f0f0', 
                        border: '1px solid #ccc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '7px',
                        textAlign: 'center'
                      }}>
                        Select Vehicle
                      </div>
                    )}
                    
                    {selectedTemplate.showVehicleInfo && selectedVehicles.length > 0 && (() => {
                      const selectedVehicle = filteredVehicles.find(v => v.id === selectedVehicles[0]);
                      return selectedVehicle ? (
                        <div style={{ textAlign: 'center', marginTop: '5px' }}>
                          <div style={{ fontWeight: 'bold' }}>{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</div>
                          <div style={{ fontSize: '6px' }}>VIN: {selectedVehicle.vin}</div>
                        </div>
                      ) : null;
                    })()}
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

        </div>

         {/* Sticky action bar */}
         <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center pt-4 mt-4 border-t bg-background">
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
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={generatePDF}
              disabled={selectedVehicles.length === 0 || loading}
              className="w-full sm:w-auto"
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate PDF
            </Button>
            <Button
              variant="accent"
              onClick={generateStickers}
              disabled={selectedVehicles.length === 0 || loading}
              className="w-full sm:w-auto"
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

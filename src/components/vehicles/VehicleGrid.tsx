import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Car, Edit, Trash2, QrCode, Download, Image, Upload } from "lucide-react";
import type { Vehicle } from "@/types/vehicle";
import { BASE_URL } from "@/lib/config";
import { useAuth } from "@/hooks/useAuth";

// Helper function to clean corrupted image URLs
const cleanImageUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return url;
  
  // Remove @ symbol at the beginning
  let cleanedUrl = url.startsWith('@') ? url.slice(1) : url;
  
  // Remove any base URL prefix if present (dynamic approach)
  try {
    const baseUrl = new URL(BASE_URL);
    const baseUrlString = `${baseUrl.protocol}//${baseUrl.host}`;
    
    if (cleanedUrl.includes(baseUrlString + '/')) {
      // Extract the actual URL after the base URL prefix
      const parts = cleanedUrl.split(baseUrlString + '/');
      if (parts.length > 1) {
        cleanedUrl = parts[1];
      }
    }
  } catch (e) {
    // If BASE_URL is not a valid URL, fall back to checking for common patterns
    console.warn('Invalid BASE_URL, falling back to pattern matching:', BASE_URL);
    
    // Check for common URL patterns that might be prefixed
    const urlPatterns = [
      /https?:\/\/[^\/]+\/(.+)/,  // Match any domain followed by path
      /app\.[^\/]+\/(.+)/,        // Match app.domain.com/pattern
    ];
    
    for (const pattern of urlPatterns) {
      const match = cleanedUrl.match(pattern);
      if (match && match[1]) {
        cleanedUrl = match[1];
        break;
      }
    }
  }
  
  // Decode URL encoding
  try {
    cleanedUrl = decodeURIComponent(cleanedUrl);
  } catch (e) {
    // If decoding fails, keep the original
    console.warn('Failed to decode URL:', cleanedUrl);
  }
  
  // Remove any remaining curly braces that might be left
  cleanedUrl = cleanedUrl.replace(/^\{|\}$/g, '');
  
  // Ensure it's a valid URL
  if (cleanedUrl.startsWith('http://') || cleanedUrl.startsWith('https://')) {
    return cleanedUrl;
  }
  
  // If it doesn't start with http, it might be a relative path
  return cleanedUrl;
};

// Helper function to parse photo_url_list (handles both array and PostgreSQL string formats)
const parsePhotoUrlList = (photoUrlList: string[] | string | null | undefined): string[] => {
  if (!photoUrlList) return [];
  
  if (Array.isArray(photoUrlList)) {
    return photoUrlList
      .filter(url => url && typeof url === 'string')
      .map(url => cleanImageUrl(url))
      .filter(url => url); // Remove any empty URLs after cleaning
  }
  
  if (typeof photoUrlList === 'string') {
    // Handle PostgreSQL array string format: {"url1","url2","url3"}
    if (photoUrlList.startsWith('{') && photoUrlList.endsWith('}')) {
      const content = photoUrlList.slice(1, -1); // Remove { and }
      return content.split(',')
        .map(url => url.trim().replace(/"/g, ''))
        .map(url => cleanImageUrl(url))
        .filter(url => url); // Remove any empty URLs after cleaning
    }
    // Handle comma-separated string
    return photoUrlList.split(',')
      .map(url => url.trim())
      .map(url => cleanImageUrl(url))
      .filter(url => url); // Remove any empty URLs after cleaning
  }
  
  return [];
};

// Vehicle Image Component with error handling
const VehicleImage = ({ vehicle, images }: { vehicle: Vehicle; images: string[] }) => {
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const handleImageError = () => {
    if (currentImageIndex < images.length - 1) {
      // Try next image
      setCurrentImageIndex(currentImageIndex + 1);
    } else {
      // All images failed, show error
      setImageError(true);
    }
  };

  if (images.length > 0 && !imageError) {
    return (
      <div className="aspect-video w-full overflow-hidden relative">
        <img
          src={images[currentImageIndex]}
          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
        {images.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            +{images.length - 1} more
          </div>
        )}
      </div>
    );
  } else if (imageError) {
    return (
      <div className="aspect-video w-full bg-red-50 flex flex-col items-center justify-center relative border border-red-200">
        <Car className="h-12 w-12 text-red-400 mb-2" />
        <span className="text-xs text-red-600 font-medium">Image Error</span>
        <Badge variant="destructive" className="absolute top-2 right-2 text-xs">
          Error
        </Badge>
      </div>
    );
  } else {
    return (
      <div className="aspect-video w-full bg-muted flex flex-col items-center justify-center relative">
        <Car className="h-12 w-12 text-muted-foreground mb-2" />
        <span className="text-xs text-muted-foreground">No images</span>
        <Badge variant="outline" className="absolute top-2 right-2 text-xs">
          Missing
        </Badge>
      </div>
    );
  }
};

interface VehicleGridProps {
  vehicles: Vehicle[];
  selectedVehicles: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicleId: string) => void;
  onGenerateQR: (vehicleId: string) => void;
  onDownloadQR: (qrCodeUrl: string, vehicleId: string) => void;
  onDownloadImages: (vehicleId: string) => void;
  onUploadImages: (vehicleId: string, files: FileList) => void;
  onMarkStickerPrinted: (vehicleId: string) => void;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

export const VehicleGrid = ({ 
  vehicles, 
  selectedVehicles, 
  onSelectionChange, 
  onEdit, 
  onDelete, 
  onGenerateQR, 
  onDownloadQR,
  onDownloadImages,
  onUploadImages,
  onMarkStickerPrinted,
  pagination
}: VehicleGridProps) => {
  const { user } = useAuth();
  
  // Check if user can print labels (all roles except sales)
  const canPrintLabels = user?.staffRole !== 'sales';
  
  const formatPrice = (price?: number) => {
    if (!price) return "Price not set";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const getSerialNumber = (index: number) => {
    if (!pagination) return index + 1;
    
    // If showing all vehicles (limit = -1), SNO starts from 1
    if (pagination.limit === -1) {
      return index + 1;
    }
    
    // Calculate SNO based on current page and limit
    return ((pagination.page - 1) * pagination.limit) + index + 1;
  };

  const hasExternalImages = (photoUrlList?: string[] | string) => {
    const images = parsePhotoUrlList(photoUrlList);
    if (images.length === 0) return false;
    return images.some(img => img.startsWith('http://') || img.startsWith('https://'));
  };

  const hasImages = (photoUrlList?: string[] | string) => {
    const images = parsePhotoUrlList(photoUrlList);
    return images.length > 0;
  };

  const handleImageUpload = (vehicleId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onUploadImages(vehicleId, files);
      // Reset the input so the same file can be selected again
      event.target.value = '';
    }
  };

  const handleSelectVehicle = (vehicleId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedVehicles, vehicleId]);
    } else {
      onSelectionChange(selectedVehicles.filter(id => id !== vehicleId));
    }
  };

  if (vehicles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Car className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No vehicles found</h3>
          <p className="text-muted-foreground text-center mb-4">
            Try adjusting your search or filter criteria.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Vehicle Count Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {pagination ? (
            pagination.limit === -1 ? (
              `Showing all ${vehicles.length} vehicles`
            ) : (
              `Showing ${vehicles.length} vehicles (Page ${pagination.page} of ${Math.ceil(pagination.total / pagination.limit)})`
            )
          ) : (
            `Showing ${vehicles.length} vehicles`
          )}
        </div>
        <div className="text-sm font-medium text-primary">
          SNO Range: {vehicles.length > 0 ? `${getSerialNumber(0)} - ${getSerialNumber(vehicles.length - 1)}` : '0'}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map((vehicle, index) => (
        <Card key={vehicle.id} className="hover:shadow-md transition-shadow overflow-hidden relative">
          {/* Selection Checkbox */}
          <div className="absolute top-4 left-4 z-10">
            <Checkbox
              checked={selectedVehicles.includes(vehicle.id)}
              onCheckedChange={(checked) => handleSelectVehicle(vehicle.id, checked as boolean)}
              className="bg-white shadow-md"
            />
          </div>


          {/* Vehicle Image */}
          <VehicleImage vehicle={vehicle} images={parsePhotoUrlList(vehicle.photo_url_list)} />

          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </CardTitle>
                {vehicle.trim && (
                  <CardDescription className="text-sm">{vehicle.trim}</CardDescription>
                )}
                {vehicle.stock_number && (
                  <div className="mt-1">
                    <Badge variant="outline" className="text-xs font-mono">
                      Stock: {vehicle.stock_number}
                    </Badge>
                  </div>
                )}
              </div>
              <Badge
                variant={
                  vehicle.status === "available"
                    ? "default"
                    : vehicle.status === "sold"
                    ? "secondary"
                    : "outline"
                }
              >
                {vehicle.status}
              </Badge>
            </div>
            
            {/* Sticker Status Badges */}
            <div className="flex flex-wrap gap-1 mt-2">
              {vehicle.sticker_generation_status === 'printed' && (
                <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                  ✓ Sticker Printed
                </Badge>
              )}
              {vehicle.sticker_generation_status === 'generated' && (
                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                  QR Generated
                </Badge>
              )}
              {vehicle.sticker_generation_status === 'not_generated' && (
                <Badge variant="destructive" className="text-xs">
                  No Sticker
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Stock #:</span>
                <p className="font-semibold text-primary">{vehicle.stock_number || "Not assigned"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">VIN:</span>
                <p className="font-mono text-xs">{vehicle.vin}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <p>{vehicle.vehicle_type || "Not specified"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Color:</span>
                <p>{vehicle.color || "Not specified"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Mileage:</span>
                <p>{vehicle.mileage ? vehicle.mileage.toLocaleString() + " miles" : "Not specified"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Price:</span>
                <p className="font-semibold">{formatPrice(vehicle.price)}</p>
              </div>
            </div>

            {vehicle.features && vehicle.features.length > 0 && (
              <div>
                <span className="text-muted-foreground text-sm">Features:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {vehicle.features.slice(0, 3).map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {vehicle.features.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{vehicle.features.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(vehicle)}
                  className="flex-1"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                {vehicle.qr_code_url ? (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => onDownloadQR(vehicle.qr_code_url!, vehicle.id)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    QR Code
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => onGenerateQR(vehicle.id)}
                  >
                    <QrCode className="h-3 w-3 mr-1" />
                    Generate QR
                  </Button>
                )}
                
                {/* Mark as Printed Button - only show for generated but not printed stickers and if user can print labels */}
                {vehicle.qr_code_url && vehicle.sticker_generation_status === 'generated' && canPrintLabels && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    onClick={() => onMarkStickerPrinted(vehicle.id)}
                  >
                    ✓ Mark Printed
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(vehicle.id)}
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {/* Upload Images Button - Always show for missing images, or as additional option */}
              {!hasImages(vehicle.photo_url_list) ? (
                <div className="w-full">
                  <input
                    type="file"
                    id={`upload-${vehicle.id}`}
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(vehicle.id, e)}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById(`upload-${vehicle.id}`)?.click()}
                    className="w-full bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    title="Upload images for this vehicle"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Upload Images
                  </Button>
                </div>
              ) : (
                <div className="w-full space-y-2">
                  <input
                    type="file"
                    id={`upload-${vehicle.id}`}
                    multiple
                    accept="image/*"
                    onChange={(e) => handleImageUpload(vehicle.id, e)}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById(`upload-${vehicle.id}`)?.click()}
                    className="w-full"
                    title="Upload more images for this vehicle"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Add Images
                  </Button>
                  {hasExternalImages(vehicle.photo_url_list) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDownloadImages(vehicle.id)}
                      className="w-full bg-primary/10 hover:bg-primary/15 text-primary/90 border-primary/20"
                      title="Download external images to local server"
                    >
                      <Image className="h-3 w-3 mr-1" />
                      Download Images
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
};
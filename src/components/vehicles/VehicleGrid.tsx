import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Car, Edit, Trash2, QrCode, Download, Image } from "lucide-react";
import type { Vehicle } from "@/types/vehicle";

// Helper function to parse photo_url_list (now properly an array)
const parsePhotoUrlList = (photoUrlList: string[] | null | undefined): string[] => {
  if (!photoUrlList || !Array.isArray(photoUrlList)) return [];
  return photoUrlList.filter(url => url && typeof url === 'string');
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
}

export const VehicleGrid = ({ 
  vehicles, 
  selectedVehicles, 
  onSelectionChange, 
  onEdit, 
  onDelete, 
  onGenerateQR, 
  onDownloadQR,
  onDownloadImages 
}: VehicleGridProps) => {
  const formatPrice = (price?: number) => {
    if (!price) return "Price not set";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const hasExternalImages = (photoUrlList?: string[]) => {
    const images = parsePhotoUrlList(photoUrlList);
    if (images.length === 0) return false;
    return images.some(img => img.startsWith('http://') || img.startsWith('https://'));
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {vehicles.map((vehicle) => (
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
          {(() => {
            const images = parsePhotoUrlList(vehicle.photo_url_list);
            return images.length > 0 ? (
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={images[0]}
                  alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="aspect-video w-full bg-muted flex items-center justify-center">
                <Car className="h-12 w-12 text-muted-foreground" />
              </div>
            );
          })()}

          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </CardTitle>
                {vehicle.trim && (
                  <CardDescription className="text-sm">{vehicle.trim}</CardDescription>
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
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">VIN:</span>
                <p className="font-mono text-xs">{vehicle.vin}</p>
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(vehicle.id)}
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {hasExternalImages(vehicle.photo_url_list) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDownloadImages(vehicle.id)}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                  title="Download external images to local server"
                >
                  <Image className="h-3 w-3 mr-1" />
                  Download Images
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
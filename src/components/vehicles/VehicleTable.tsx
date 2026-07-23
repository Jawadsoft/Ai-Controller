import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash2, ChevronUp, ChevronDown, Upload, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Vehicle } from "@/types/vehicle";
import { useAuth } from "@/hooks/useAuth";

interface VehicleTableProps {
  vehicles: Vehicle[];
  selectedVehicles: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicleId: string) => void;
  onRefresh: () => void;
  onDownloadImages: (vehicleId: string) => void;
  onUploadImages: (vehicleId: string, files: FileList) => void;
  onMarkStickerPrinted: (vehicleId: string) => void;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

type SortField = 'make' | 'model' | 'year' | 'price' | 'mileage' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';

export const VehicleTable = ({ vehicles, selectedVehicles, onSelectionChange, onEdit, onDelete, onRefresh, onDownloadImages, onUploadImages, onMarkStickerPrinted, pagination }: VehicleTableProps) => {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Check if user can print labels (all roles except sales)
  const canPrintLabels = user?.staffRole !== 'sales';

  const formatPrice = (price?: number) => {
    if (!price) return "Not set";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const formatMileage = (mileage?: number) => {
    if (!mileage) return "Not specified";
    return mileage.toLocaleString() + " miles";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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

  // Helper function to parse photo_url_list (handles both array and PostgreSQL string formats)
  const parsePhotoUrlList = (photoUrlList: string[] | string | null | undefined): string[] => {
    if (!photoUrlList) return [];
    
    if (Array.isArray(photoUrlList)) {
      return photoUrlList.filter(url => url && typeof url === 'string');
    }
    
    if (typeof photoUrlList === 'string') {
      // Handle PostgreSQL array string format: {"url1","url2","url3"}
      if (photoUrlList.startsWith('{') && photoUrlList.endsWith('}')) {
        const content = photoUrlList.slice(1, -1); // Remove { and }
        return content.split(',').map(url => url.trim().replace(/"/g, '')).filter(url => url);
      }
      // Handle comma-separated string
      return photoUrlList.split(',').map(url => url.trim()).filter(url => url);
    }
    
    return [];
  };

  const hasImages = (photoUrlList?: string[] | string) => {
    const images = parsePhotoUrlList(photoUrlList);
    return images.length > 0;
  };

  const hasExternalImages = (photoUrlList?: string[] | string) => {
    const images = parsePhotoUrlList(photoUrlList);
    if (images.length === 0) return false;
    return images.some(img => img.startsWith('http://') || img.startsWith('https://'));
  };

  const handleImageUpload = (vehicleId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onUploadImages(vehicleId, files);
      // Reset the input so the same file can be selected again
      event.target.value = '';
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedVehicles = useMemo(() => {
    return [...vehicles].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Convert to comparable values
      if (sortField === 'created_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [vehicles, sortField, sortDirection]);



  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(sortedVehicles.map(v => v.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectVehicle = (vehicleId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedVehicles, vehicleId]);
    } else {
      onSelectionChange(selectedVehicles.filter(id => id !== vehicleId));
    }
  };

  const isAllSelected = sortedVehicles.length > 0 && sortedVehicles.every(v => selectedVehicles.includes(v.id));
  const isPartiallySelected = selectedVehicles.length > 0 && !isAllSelected;

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-semibold text-left justify-start"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
      )}
    </Button>
  );

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
      
      <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead className="w-16">SNO</TableHead>
            <TableHead>
              <SortButton field="make">Vehicle</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="year">Year</SortButton>
            </TableHead>
            <TableHead>Stock #</TableHead>
            <TableHead>VIN</TableHead>
            <TableHead>Dealer</TableHead>
            <TableHead>
              <SortButton field="status">Status</SortButton>
            </TableHead>
            <TableHead>Sticker</TableHead>
            <TableHead>
              <SortButton field="price">Price</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="mileage">Mileage</SortButton>
            </TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Features</TableHead>
            <TableHead>
              <SortButton field="created_at">Added</SortButton>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedVehicles.map((vehicle, index) => (
            <TableRow key={vehicle.id} className="hover:bg-muted/50">
              <TableCell>
                <Checkbox
                  checked={selectedVehicles.includes(vehicle.id)}
                  onCheckedChange={(checked) => handleSelectVehicle(vehicle.id, checked as boolean)}
                />
              </TableCell>
              <TableCell className="font-medium text-primary">
                {getSerialNumber(index)}
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">
                    {vehicle.make} {vehicle.model}
                  </div>
                  {vehicle.trim && (
                    <div className="text-sm text-muted-foreground">{vehicle.trim}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>{vehicle.year}</TableCell>
              <TableCell>
                <span className="font-semibold text-primary">
                  {vehicle.stock_number || "Not assigned"}
                </span>
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {vehicle.vin}
                </code>
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {vehicle.dealer_name || "Not assigned"}
                </span>
              </TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {vehicle.sticker_generation_status === 'printed' && (
                    <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                      ✓ Printed
                    </Badge>
                  )}
                  {vehicle.sticker_generation_status === 'generated' && (
                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                      QR Ready
                    </Badge>
                  )}
                  {vehicle.sticker_generation_status === 'not_generated' && (
                    <Badge variant="destructive" className="text-xs">
                      No Sticker
                    </Badge>
                  )}
                  {/* Mark as Printed Button for generated stickers - only if user can print labels */}
                  {vehicle.qr_code_url && vehicle.sticker_generation_status === 'generated' && canPrintLabels && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs h-6 px-2 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                      onClick={() => onMarkStickerPrinted(vehicle.id)}
                    >
                      ✓ Mark Printed
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium">
                {formatPrice(vehicle.price)}
              </TableCell>
              <TableCell>{formatMileage(vehicle.mileage)}</TableCell>
              <TableCell>{vehicle.color || "Not specified"}</TableCell>
              <TableCell>{vehicle.vehicle_type || "Not specified"}</TableCell>
              <TableCell>
                {vehicle.features && vehicle.features.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {vehicle.features.slice(0, 2).map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {vehicle.features.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{vehicle.features.length - 2}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">None</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(vehicle.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(vehicle)}
                    className="h-8 w-8 p-0"
                    title="Edit vehicle"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  {!hasImages(vehicle.photo_url_list) ? (
                    <div className="relative">
                      <input
                        type="file"
                        id={`upload-table-${vehicle.id}`}
                        multiple
                        accept="image/*"
                        onChange={(e) => handleImageUpload(vehicle.id, e)}
                        className="hidden"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => document.getElementById(`upload-table-${vehicle.id}`)?.click()}
                        className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
                        title="Upload images"
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        id={`upload-table-${vehicle.id}`}
                        multiple
                        accept="image/*"
                        onChange={(e) => handleImageUpload(vehicle.id, e)}
                        className="hidden"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => document.getElementById(`upload-table-${vehicle.id}`)?.click()}
                        className="h-8 w-8 p-0"
                        title="Add more images"
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {hasExternalImages(vehicle.photo_url_list) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDownloadImages(vehicle.id)}
                      className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                      title="Download external images"
                    >
                      <Image className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(vehicle.id)}
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    title="Delete vehicle"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {sortedVehicles.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No vehicles found matching your filters
        </div>
      )}
      </div>
    </div>
  );
};
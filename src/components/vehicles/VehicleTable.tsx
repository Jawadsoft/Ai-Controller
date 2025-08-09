import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Vehicle } from "@/types/vehicle";

interface VehicleTableProps {
  vehicles: Vehicle[];
  selectedVehicles: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicleId: string) => void;
  onRefresh: () => void;
  onDownloadImages: (vehicleId: string) => void;
}

type SortField = 'make' | 'model' | 'year' | 'price' | 'mileage' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';

export const VehicleTable = ({ vehicles, selectedVehicles, onSelectionChange, onEdit, onDelete, onRefresh, onDownloadImages }: VehicleTableProps) => {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { toast } = useToast();

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
            <TableHead>
              <SortButton field="make">Vehicle</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="year">Year</SortButton>
            </TableHead>
            <TableHead>VIN</TableHead>
            <TableHead>Dealer</TableHead>
            <TableHead>
              <SortButton field="status">Status</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="price">Price</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="mileage">Mileage</SortButton>
            </TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Features</TableHead>
            <TableHead>
              <SortButton field="created_at">Added</SortButton>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedVehicles.map((vehicle) => (
            <TableRow key={vehicle.id} className="hover:bg-muted/50">
              <TableCell>
                <Checkbox
                  checked={selectedVehicles.includes(vehicle.id)}
                  onCheckedChange={(checked) => handleSelectVehicle(vehicle.id, checked as boolean)}
                />
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
              <TableCell className="font-medium">
                {formatPrice(vehicle.price)}
              </TableCell>
              <TableCell>{formatMileage(vehicle.mileage)}</TableCell>
              <TableCell>{vehicle.color || "Not specified"}</TableCell>
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
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(vehicle.id)}
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
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
  );
};
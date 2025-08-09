import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, RotateCcw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  new_used: string;
  trim?: string;
  color?: string;
  mileage?: number;
  price?: number;
  description?: string;
  features?: string[];
  photo_url_list?: string[]; // Now properly TEXT[] type in database
  status: string;
  qr_code_url?: string;
  dealer_name?: string;
  created_at: string;
}

interface Filters {
  search: string;
  status: string;
  make: string;
  yearFrom: string;
  yearTo: string;
  priceFrom: string;
  priceTo: string;
  mileageFrom: string;
  mileageTo: string;
  color: string;
  features: string[];
}

interface VehicleFiltersProps {
  vehicles: Vehicle[];
  onFiltersChange: (filteredVehicles: Vehicle[]) => void;
}

export const VehicleFilters = ({ vehicles, onFiltersChange }: VehicleFiltersProps) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "all",
    make: "all",
    yearFrom: "",
    yearTo: "",
    priceFrom: "",
    priceTo: "",
    mileageFrom: "",
    mileageTo: "",
    color: "all",
    features: [],
  });

  // Extract unique values for filter options
  const uniqueMakes = [...new Set(vehicles.map(v => v.make))].sort();
  const uniqueColors = [...new Set(vehicles.map(v => v.color).filter(Boolean))].sort();
  const allFeatures = [...new Set(vehicles.flatMap(v => v.features || []))].sort();
  const currentYear = new Date().getFullYear();

  const applyFilters = () => {
    let filtered = vehicles;

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        vehicle =>
          vehicle.make.toLowerCase().includes(searchLower) ||
          vehicle.model.toLowerCase().includes(searchLower) ||
          vehicle.vin.toLowerCase().includes(searchLower) ||
          (vehicle.trim && vehicle.trim.toLowerCase().includes(searchLower))
      );
    }

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter(vehicle => vehicle.status === filters.status);
    }

    // Make filter
    if (filters.make !== "all") {
      filtered = filtered.filter(vehicle => vehicle.make === filters.make);
    }

    // Year range filter
    if (filters.yearFrom) {
      filtered = filtered.filter(vehicle => vehicle.year >= parseInt(filters.yearFrom));
    }
    if (filters.yearTo) {
      filtered = filtered.filter(vehicle => vehicle.year <= parseInt(filters.yearTo));
    }

    // Price range filter
    if (filters.priceFrom) {
      filtered = filtered.filter(vehicle => (vehicle.price || 0) >= parseFloat(filters.priceFrom));
    }
    if (filters.priceTo) {
      filtered = filtered.filter(vehicle => (vehicle.price || 0) <= parseFloat(filters.priceTo));
    }

    // Mileage range filter
    if (filters.mileageFrom) {
      filtered = filtered.filter(vehicle => (vehicle.mileage || 0) >= parseInt(filters.mileageFrom));
    }
    if (filters.mileageTo) {
      filtered = filtered.filter(vehicle => (vehicle.mileage || 0) <= parseInt(filters.mileageTo));
    }

    // Color filter
    if (filters.color !== "all") {
      filtered = filtered.filter(vehicle => vehicle.color === filters.color);
    }

    // Features filter
    if (filters.features.length > 0) {
      filtered = filtered.filter(vehicle => 
        filters.features.every(feature => 
          vehicle.features?.includes(feature)
        )
      );
    }

    onFiltersChange(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [filters, vehicles]);

  const updateFilter = (key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      search: "",
      status: "all",
      make: "all",
      yearFrom: "",
      yearTo: "",
      priceFrom: "",
      priceTo: "",
      mileageFrom: "",
      mileageTo: "",
      color: "all",
      features: [],
    });
  };

  const removeFeature = (featureToRemove: string) => {
    setFilters(prev => ({
      ...prev,
      features: prev.features.filter(f => f !== featureToRemove)
    }));
  };

  const addFeature = (feature: string) => {
    if (!filters.features.includes(feature)) {
      setFilters(prev => ({
        ...prev,
        features: [...prev.features, feature]
      }));
    }
  };

  const activeFiltersCount = Object.entries(filters).reduce((count, [key, value]) => {
    if (key === 'search' && value) return count + 1;
    if (key === 'features' && value.length > 0) return count + value.length;
    if (typeof value === 'string' && value && !value.includes('all')) return count + 1;
    return count;
  }, 0);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </CardTitle>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by make, model, VIN, or trim..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="make">Make</Label>
            <Select value={filters.make} onValueChange={(value) => updateFilter('make', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Makes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Makes</SelectItem>
                {uniqueMakes.map(make => (
                  <SelectItem key={make} value={make}>{make}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Filters */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="p-0 h-auto">
              Advanced Filters
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Year Range */}
            <div>
              <Label>Year Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="From"
                  min="1900"
                  max={currentYear + 1}
                  value={filters.yearFrom}
                  onChange={(e) => updateFilter('yearFrom', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="To"
                  min="1900"
                  max={currentYear + 1}
                  value={filters.yearTo}
                  onChange={(e) => updateFilter('yearTo', e.target.value)}
                />
              </div>
            </div>

            {/* Price Range */}
            <div>
              <Label>Price Range ($)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Min Price"
                  min="0"
                  value={filters.priceFrom}
                  onChange={(e) => updateFilter('priceFrom', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max Price"
                  min="0"
                  value={filters.priceTo}
                  onChange={(e) => updateFilter('priceTo', e.target.value)}
                />
              </div>
            </div>

            {/* Mileage Range */}
            <div>
              <Label>Mileage Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Min Mileage"
                  min="0"
                  value={filters.mileageFrom}
                  onChange={(e) => updateFilter('mileageFrom', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max Mileage"
                  min="0"
                  value={filters.mileageTo}
                  onChange={(e) => updateFilter('mileageTo', e.target.value)}
                />
              </div>
            </div>

            {/* Color */}
            <div>
              <Label htmlFor="color">Color</Label>
              <Select value={filters.color} onValueChange={(value) => updateFilter('color', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Colors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colors</SelectItem>
                  {uniqueColors.map(color => (
                    <SelectItem key={color} value={color}>{color}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Features */}
            <div>
              <Label>Features</Label>
              <Select onValueChange={addFeature}>
                <SelectTrigger>
                  <SelectValue placeholder="Add feature filter..." />
                </SelectTrigger>
                <SelectContent>
                  {allFeatures
                    .filter(feature => !filters.features.includes(feature))
                    .map(feature => (
                      <SelectItem key={feature} value={feature}>{feature}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {filters.features.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {filters.features.map(feature => (
                    <Badge key={feature} variant="secondary" className="text-sm">
                      {feature}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-1 h-auto p-0"
                        onClick={() => removeFeature(feature)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
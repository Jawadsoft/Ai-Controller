import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, RotateCcw, CheckCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { parseVehicleSearch, isCombinedVehicleSearch } from "@/lib/smartSearchParser";

interface Filters {
  search: string;
  make: string;
  model: string;
  year: string;
  status: string;
  inventory_status: string;
  new_used: string;
  stock_number: string;
  vehicle_type: string;
  feature_search: string;
  min_price: string;
  max_price: string;
  sort_by: string;
  sort_order: string;
}

interface VehicleFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Partial<Filters>) => void;
  onFilterBlur: () => void;
  onClearFilters: () => void;
  totalCount: number;
  loading?: boolean;
}

export const VehicleFilters = ({ filters, onFiltersChange, onFilterBlur, onClearFilters, totalCount, loading = false }: VehicleFiltersProps) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [parsedFields, setParsedFields] = useState<{
    make: string;
    model: string;
    year: string;
    stock_number: string;
  }>({
    make: '',
    model: '',
    year: '',
    stock_number: ''
  });
  const [showParsedFields, setShowParsedFields] = useState(false);

  const updateFilter = (key: keyof Filters, value: any) => {
    onFiltersChange({ [key]: value });
  };

  // Sentinel used in SelectItem because Radix UI forbids value=""
  const ALL_VALUE = '__all__';

  // For select dropdowns, trigger API call immediately
  // Convert the "__all__" sentinel back to empty string before storing
  const updateFilterAndSearch = (key: keyof Filters, value: any) => {
    const resolved = value === ALL_VALUE ? '' : value;
    onFiltersChange({ [key]: resolved });
    onFilterBlur();
  };

  // Convert a stored filter value to the SelectItem value (empty → sentinel)
  const toSelectValue = (value: string) => value === '' ? ALL_VALUE : value;

  // Handle smart search parsing
  const handleSearchChange = (value: string) => {
    updateFilter('search', value);
    
    // Check if this looks like a combined vehicle search
    if (isCombinedVehicleSearch(value)) {
      const parsed = parseVehicleSearch(value);
      setParsedFields({
        make: parsed.make,
        model: parsed.model,
        year: parsed.year,
        stock_number: parsed.stock_number
      });
      setShowParsedFields(true);
    } else {
      setShowParsedFields(false);
    }
  };

  // Apply parsed fields to individual filters
  const applyParsedFields = () => {
    const updates: Partial<Filters> = {};
    
    if (parsedFields.make) updates.make = parsedFields.make;
    if (parsedFields.model) updates.model = parsedFields.model;
    if (parsedFields.year) updates.year = parsedFields.year;
    if (parsedFields.stock_number) updates.stock_number = parsedFields.stock_number;
    
    if (Object.keys(updates).length > 0) {
      onFiltersChange(updates);
      onFilterBlur();
    }
    
    setShowParsedFields(false);
  };

  // Clear parsed fields
  const clearParsedFields = () => {
    setParsedFields({ make: '', model: '', year: '', stock_number: '' });
    setShowParsedFields(false);
  };

  const activeFiltersCount = Object.entries(filters).reduce((count, [key, value]) => {
    if (key === 'search' && value) return count + 1;
    if (key === 'sort_by' || key === 'sort_order') return count; // Don't count sort fields
    if (typeof value === 'string' && value && value !== '') return count + 1;
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
            <span className="text-sm text-muted-foreground ml-2">
              ({totalCount} vehicles)
            </span>
            {loading && (
              <div className="flex items-center ml-2">
                <div className="animate-spin h-4 w-4 border-b-2 border-primary rounded-full"></div>
                <span className="text-xs text-muted-foreground ml-2">Filtering...</span>
              </div>
            )}
          </CardTitle>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="relative">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search: 'Hyundai Santa Fe 2024 STK123', VIN, stock..."
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onBlur={onFilterBlur}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Try: "Hyundai Santa Fe 2024 STK123" or "Toyota Camry 2023" or "STK001"
            </p>
            
            {/* Smart Search Parsing Results */}
            {showParsedFields && (
              <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Smart Search Detected</span>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={applyParsedFields}
                      className="h-6 px-2 text-xs"
                    >
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearParsedFields}
                      className="h-6 px-2 text-xs"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {parsedFields.make && (
                    <div className="flex items-center space-x-1">
                      <span className="text-primary font-medium">Make:</span>
                      <Badge variant="secondary" className="text-xs">{parsedFields.make}</Badge>
                    </div>
                  )}
                  {parsedFields.model && (
                    <div className="flex items-center space-x-1">
                      <span className="text-primary font-medium">Model:</span>
                      <Badge variant="secondary" className="text-xs">{parsedFields.model}</Badge>
                    </div>
                  )}
                  {parsedFields.year && (
                    <div className="flex items-center space-x-1">
                      <span className="text-primary font-medium">Year:</span>
                      <Badge variant="secondary" className="text-xs">{parsedFields.year}</Badge>
                    </div>
                  )}
                  {parsedFields.stock_number && (
                    <div className="flex items-center space-x-1">
                      <span className="text-primary font-medium">Stock:</span>
                      <Badge variant="secondary" className="text-xs">{parsedFields.stock_number}</Badge>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="make">Make</Label>
            <Input
              id="make"
              placeholder="Make"
              value={filters.make}
              onChange={(e) => updateFilter('make', e.target.value)}
              onBlur={onFilterBlur}
            />
          </div>

          <div>
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              placeholder="Model"
              value={filters.model}
              onChange={(e) => updateFilter('model', e.target.value)}
              onBlur={onFilterBlur}
            />
          </div>

          <div>
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              type="number"
              placeholder="Year"
              value={filters.year}
              onChange={(e) => updateFilter('year', e.target.value)}
              onBlur={onFilterBlur}
            />
          </div>

          <div>
            <Label htmlFor="stock_number">Stock Number</Label>
            <Input
              id="stock_number"
              placeholder="Stock #"
              value={filters.stock_number}
              onChange={(e) => updateFilter('stock_number', e.target.value)}
              onBlur={onFilterBlur}
            />
          </div>

          <div>
            <Label htmlFor="feature_search">Feature Search</Label>
            <Input
              id="feature_search"
              placeholder="e.g. Sunroof, Bluetooth..."
              value={filters.feature_search}
              onChange={(e) => updateFilter('feature_search', e.target.value)}
              onBlur={onFilterBlur}
            />
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="inventory_status">Inventory Status</Label>
                <Select value={toSelectValue(filters.inventory_status)} onValueChange={(value) => updateFilterAndSearch('inventory_status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="removed">Removed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="new_used">New/Used</Label>
                <Select value={toSelectValue(filters.new_used)} onValueChange={(value) => updateFilterAndSearch('new_used', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All</SelectItem>
                    <SelectItem value="N">New</SelectItem>
                    <SelectItem value="U">Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="vehicle_type">Vehicle Type</Label>
                <Select value={toSelectValue(filters.vehicle_type)} onValueChange={(value) => updateFilterAndSearch('vehicle_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All Types</SelectItem>
                    <SelectItem value="SUV">SUV</SelectItem>
                    <SelectItem value="Sedan">Sedan</SelectItem>
                    <SelectItem value="Truck">Truck</SelectItem>
                    <SelectItem value="Van">Van</SelectItem>
                    <SelectItem value="Minivan">Minivan</SelectItem>
                    <SelectItem value="Coupe">Coupe</SelectItem>
                    <SelectItem value="Wagon">Wagon</SelectItem>
                    <SelectItem value="Convertible">Convertible</SelectItem>
                    <SelectItem value="Hatchback">Hatchback</SelectItem>
                    <SelectItem value="Pickup">Pickup</SelectItem>
                    <SelectItem value="Crossover">Crossover</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sort_by">Sort By</Label>
                <Select value={filters.sort_by} onValueChange={(value) => updateFilterAndSearch('sort_by', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Date Added</SelectItem>
                    <SelectItem value="make">Make</SelectItem>
                    <SelectItem value="model">Model</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="mileage">Mileage</SelectItem>
                  </SelectContent>
                </Select>
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
                  value={filters.min_price}
                  onChange={(e) => updateFilter('min_price', e.target.value)}
                  onBlur={onFilterBlur}
                />
                <Input
                  type="number"
                  placeholder="Max Price"
                  min="0"
                  value={filters.max_price}
                  onChange={(e) => updateFilter('max_price', e.target.value)}
                  onBlur={onFilterBlur}
                />
              </div>
            </div>

            {/* Sort Order */}
            <div>
              <Label htmlFor="sort_order">Sort Order</Label>
              <Select value={filters.sort_order} onValueChange={(value) => updateFilterAndSearch('sort_order', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DESC">Descending</SelectItem>
                  <SelectItem value="ASC">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
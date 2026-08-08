import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { setupDevCacheClearing } from "@/lib/devCacheUtils";
import TopNavigation from "@/components/layout/TopNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { VehicleImport } from "@/components/vehicles/VehicleImport";
import { VehicleTable } from "@/components/vehicles/VehicleTable";
import { VehicleGrid } from "@/components/vehicles/VehicleGrid";
import { VehicleFilters } from "@/components/vehicles/VehicleFilters";
import { BulkActions } from "@/components/vehicles/BulkActions";
import { QRCodeStickerModal } from "@/components/vehicles/QRCodeStickerModal";
import { Car, Plus, Search, Edit, Trash2, QrCode, Upload, LogOut, Download, Grid, List, RefreshCw, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vehiclesAPI } from "@/lib/api";
import { clearDevCache } from "@/lib/devCacheUtils";
import { buildApiUrl, downloadBackendAsset } from "@/lib/config";
import type { Vehicle } from "@/types/vehicle";

const Vehicles = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isCorrectingFeatures, setIsCorrectingFeatures] = useState(false);
  const [isUpdatingTrimType, setIsUpdatingTrimType] = useState(false);
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    make: '',
    model: '',
    year: '',
    status: '',
    inventory_status: 'available', // Default to show only available vehicles
    sticker_status: '', // Filter by sticker status: printed, generated, not_generated, or empty for all
    new_used: '',
    stock_number: '',
    vehicle_type: '',
    feature_search: '',
    min_price: '',
    max_price: '',
    sort_by: 'created_at',
    sort_order: 'DESC'
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchVehicles(1, filters, true); // Initial load
    }
  }, [user]);


  // Setup development cache clearing
  useEffect(() => {
    setupDevCacheClearing();
  }, []);

  const fetchVehicles = async (page = pagination.page, newFilters = filters, isInitialLoad = false, customLimit = null) => {
    try {
      // Only show full page loading on initial load
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setFilterLoading(true);
      }
      
      const response = await vehiclesAPI.getAll({
        page,
        limit: customLimit !== null ? customLimit : pagination.limit,
        ...newFilters
      });
      
      setVehicles(response.data);
      setPagination(response.pagination);
      
      // Only show toast for initial load or when there are results
      if (isInitialLoad && response.data.length > 0) {
        const limit = customLimit !== null ? customLimit : pagination.limit;
        const description = limit === -1 
          ? `Successfully loaded all ${response.data.length} vehicle(s)`
          : `Successfully loaded ${response.data.length} vehicle(s) (Page ${response.pagination.page} of ${response.pagination.totalPages})`;
        
        toast({
          title: "Vehicles loaded",
          description,
        });
      }
    } catch (error: any) {
      console.error("Error fetching vehicles:", error);
      toast({
        title: "Error",
        description: "Failed to fetch vehicles",
        variant: "destructive",
      });
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setFilterLoading(false);
      }
    }
  };

  const deleteVehicle = async (vehicleId: string) => {
    if (!confirm("Are you sure you want to delete this vehicle?")) return;

    try {
      await vehiclesAPI.delete(vehicleId);
      // Refresh the current page after deletion
      await fetchVehicles();
      toast({
        title: "Success",
        description: "Vehicle deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting vehicle:", error);
      toast({
        title: "Error",
        description: "Failed to delete vehicle",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out",
      });
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Sign out error",
        description: "Failed to sign out properly",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return "Price not set";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const generateQRCode = async (vehicleId: string) => {
    try {
      const response = await vehiclesAPI.generateQRCode(vehicleId);
      
      if (response.success && response.qrCodeUrl) {
        // Update the vehicle in the local state
        setVehicles(prev => prev.map(v => 
          v.id === vehicleId ? { ...v, qr_code_url: response.qrCodeUrl } : v
        ));
        
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
    }
  };

  const downloadQRCode = async (qrCodeUrl: string, vehicleId: string) => {
    try {
      await downloadBackendAsset(qrCodeUrl, `vehicle-qr-${vehicleId}.png`);
      toast({
        title: "QR Code Downloaded",
        description: "QR code has been downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Download Error",
        description: "QR file not found — try Regenerate QR first",
        variant: "destructive",
      });
    }
  };

  const clearCache = async () => {
    try {
      // Use the enhanced development cache clearing
      await clearDevCache(toast);
      
      // Refresh the vehicles data
      await fetchVehicles(1, filters, false);
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Cache Clear Error",
        description: "Failed to clear cache completely",
        variant: "destructive",
      });
    }
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchVehicles(newPage, filters, false);
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
    fetchVehicles(1, filters, false, newLimit);
  };

  // Filter handlers
  const handleFiltersChange = (newFilters: Partial<typeof filters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when filters change
    // Note: API call will be triggered by onBlur events
  };

  // Handle filter blur (when user finishes typing and leaves field)
  // Accept optional updated filters to avoid stale state issues
  const handleFilterBlur = (updatedFilters?: Partial<typeof filters>) => {
    const filtersToUse = updatedFilters ? { ...filters, ...updatedFilters } : filters;
    fetchVehicles(1, filtersToUse, false); // Filter load, not initial
  };

  const clearFilters = () => {
    const defaultFilters = {
      search: '',
      make: '',
      model: '',
      year: '',
      status: '',
      inventory_status: 'available', // Default to show only available vehicles
      sticker_status: '', // Reset sticker status filter
      new_used: '',
      stock_number: '',
      vehicle_type: '',
      feature_search: '',
      min_price: '',
      max_price: '',
      sort_by: 'created_at',
      sort_order: 'DESC'
    };
    setFilters(defaultFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    // Immediately fetch with cleared filters
    fetchVehicles(1, defaultFilters, false);
  };

  const correctFeatureFormat = async () => {
    if (!confirm("This will correct the format of features for all vehicles in the database. This may take a while. Continue?")) {
      return;
    }

    setIsCorrectingFeatures(true);
    try {
      const response = await fetch(buildApiUrl('vehicles/correct-features'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to correct feature formats');
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Feature Format Corrected",
          description: `Successfully updated ${result.updatedCount} vehicles with corrected feature formats`,
        });

        // Refresh vehicles to show updated data
        await fetchVehicles(1, filters, false);
      } else {
        throw new Error(result.error || 'Failed to correct feature formats');
      }
    } catch (error: any) {
      console.error("Error correcting feature formats:", error);
      
      // Try to get more detailed error information
      let errorMessage = "Failed to correct feature formats";
      if (error.message) {
        errorMessage = error.message;
      } else if (error.details) {
        errorMessage = error.details;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCorrectingFeatures(false);
    }
  };

  const downloadVehicleImages = async (vehicleId: string) => {
    try {
      const response = await fetch(buildApiUrl(`vehicles/${vehicleId}/download-images`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download vehicle images');
      }

      const result = await response.json();
      
      toast({
        title: "Images Downloaded",
        description: `Successfully downloaded ${result.downloadedCount} images for this vehicle`,
      });

      // Refresh vehicles to show updated data
      await fetchVehicles(1, filters, false);
    } catch (error: any) {
      console.error("Error downloading vehicle images:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to download vehicle images",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    try {
      // Define CSV headers - using only properties that exist in Vehicle type
      const headers = [
        'Stock Number', 'VIN', 'Year', 'Make', 'Model', 'Trim', 'Type',
        'Price', 'Mileage', 'Color', 
        'Status', 'New/Used', 'Features', 'Description', 
        'Created Date'
      ];

      // Map vehicles to CSV rows
      const csvRows = vehicles.map(vehicle => [
        vehicle.stock_number || '',
        vehicle.vin || '',
        vehicle.year || '',
        vehicle.make || '',
        vehicle.model || '',
        vehicle.trim || '',
        vehicle.vehicle_type || '',
        vehicle.price || '',
        vehicle.mileage || '',
        vehicle.color || '',
        vehicle.status || '',
        vehicle.new_used || '',
        (vehicle.features || []).join('; ') || '',
        vehicle.description?.replace(/"/g, '""') || '', // Escape quotes
        new Date(vehicle.created_at).toLocaleDateString()
      ]);

      // Build CSV content
      const csvContent = [
        headers.join(','),
        ...csvRows.map(row => 
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `vehicles_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `Exported ${vehicles.length} vehicle(s) to CSV`,
      });
    } catch (error: any) {
      console.error("Error exporting to CSV:", error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export vehicles to CSV",
        variant: "destructive",
      });
    }
  };

  const updateVehicleTrimType = async () => {
    if (!confirm("This will update trim and type data for all vehicles. This may take a while. Continue?")) {
      return;
    }

    setIsUpdatingTrimType(true);
    try {
      const response = await vehiclesAPI.updateTrimType();
      
      toast({
        title: "Vehicle Data Updated",
        description: `Successfully updated ${response.stats.updatedType} vehicle types and ${response.stats.updatedTrim} vehicle trims`,
      });

      // Refresh vehicles to show updated data
      await fetchVehicles(1, filters, false);
    } catch (error: any) {
      console.error("Error updating vehicle trim and type:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update vehicle trim and type data",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingTrimType(false);
    }
  };

  const uploadVehicleImages = async (vehicleId: string, files: FileList) => {
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('images', file);
      });

      const response = await vehiclesAPI.uploadImages(vehicleId, formData);
      
      toast({
        title: "Images Uploaded",
        description: `Successfully uploaded ${files.length} image(s) for this vehicle`,
      });

      // Refresh vehicles to show updated data
      await fetchVehicles(1, filters, false);
    } catch (error: any) {
      console.error("Error uploading vehicle images:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload vehicle images",
        variant: "destructive",
      });
    }
  };

  const markStickerAsPrinted = async (vehicleId: string) => {
    try {
      const response = await fetch(buildApiUrl(`vehicles/${vehicleId}/mark-sticker-printed`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to mark sticker as printed');
      }

      toast({
        title: "Success",
        description: "Sticker marked as printed",
      });

      // Refresh vehicles to show updated data
      await fetchVehicles(1, filters, false);
    } catch (error: any) {
      console.error("Error marking sticker as printed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark sticker as printed",
        variant: "destructive",
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin  h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNavigation />

      {/* ── Page Header ── */}
      <div className="bg-white border-b shadow-sm px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Car className="h-4 w-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-gray-900 leading-tight">Vehicle Inventory</h1>
              <p className="text-xs text-gray-500 leading-tight">Manage inventory and track sales</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="border-orange-200 text-orange-600 hover:bg-orange-50 gap-1 text-xs px-2 h-8 hidden sm:flex"
              onClick={updateVehicleTrimType} disabled={isUpdatingTrimType}>
              <Settings className="h-3 w-3" />{isUpdatingTrimType ? 'Updating…' : 'Update Trim & Type'}
            </Button>
            <Button variant="outline" size="sm" className="border-orange-200 text-orange-600 hover:bg-orange-50 h-8 w-8 p-0 sm:hidden"
              onClick={updateVehicleTrimType} disabled={isUpdatingTrimType}>
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <div className="flex border border-gray-200 rounded-lg p-0.5 bg-gray-50">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-orange-500 hover:bg-orange-600 text-white h-7 w-7 p-0' : 'h-7 w-7 p-0 text-gray-500'}>
                <Grid className="h-3.5 w-3.5" />
              </Button>
              <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm"
                onClick={() => setViewMode('table')}
                className={viewMode === 'table' ? 'bg-orange-500 hover:bg-orange-600 text-white h-7 w-7 p-0' : 'h-7 w-7 p-0 text-gray-500'}>
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-5">
        {/* Page Header Actions */}
        <div className="flex flex-col gap-3 mb-4">

          {/* ── Filter toggles (pill style) ── */}
          <div className="flex flex-col gap-2">
            {/* Inventory status */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400 w-14 flex-shrink-0">Show:</span>
              <div className="flex bg-gray-100 rounded-full p-0.5 gap-0.5">
                {(['available', 'sold', ''] as const).map((val) => {
                  const label = val === 'available' ? 'Available' : val === 'sold' ? 'Sold' : 'All';
                  const active = filters.inventory_status === val;
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        setFilters(prev => ({ ...prev, inventory_status: val }));
                        fetchVehicles(1, { ...filters, inventory_status: val }, false);
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all whitespace-nowrap ${
                        active
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sticker status */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400 w-14 flex-shrink-0">Stickers:</span>
              <div className="flex flex-wrap bg-gray-100 rounded-full p-0.5 gap-0.5">
                {([
                  { val: 'printed', label: 'Printed' },
                  { val: 'generated', label: 'Generated' },
                  { val: 'not_generated', label: 'No Sticker' },
                  { val: '', label: 'All' },
                ] as const).map(({ val, label }) => {
                  const active = filters.sticker_status === val;
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        setFilters(prev => ({ ...prev, sticker_status: val }));
                        fetchVehicles(1, { ...filters, sticker_status: val }, false);
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all whitespace-nowrap ${
                        active
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Action buttons (visually distinct) ── */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
            <QRCodeStickerModal 
              vehicles={vehicles}
              onGenerateQR={generateQRCode}
              onRefresh={fetchVehicles}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={exportToCSV}
              disabled={vehicles.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>

            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-gray-300 text-gray-700 hover:bg-gray-50">
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Import Vehicle Inventory</DialogTitle>
                </DialogHeader>
                <VehicleImport
                  onImportComplete={() => {
                    setShowImportDialog(false);
                    fetchVehicles();
                  }}
                />
              </DialogContent>
            </Dialog>

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs gap-1.5 bg-gray-800 hover:bg-gray-900 text-white">
                  <Plus className="h-3.5 w-3.5" />
                  Add Vehicle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Vehicle</DialogTitle>
                </DialogHeader>
                <VehicleForm
                  onSuccess={() => {
                    setShowAddDialog(false);
                    fetchVehicles();
                  }}
                  onCancel={() => setShowAddDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <VehicleFilters 
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onFilterBlur={handleFilterBlur}
          onClearFilters={clearFilters}
          totalCount={pagination.total}
          loading={filterLoading}
        />

        {/* Bulk Actions */}
        <BulkActions
          selectedVehicles={selectedVehicles}
          onClearSelection={() => setSelectedVehicles([])}
          onRefresh={() => fetchVehicles(1, filters, false)}
        />

        {/* Vehicle Content */}
        <div className="relative">
          {filterLoading && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-sm rounded-lg">
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-5 w-5 border-b-2 border-primary rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Updating results...</span>
                </div>
              </div>
            </div>
          )}
          
          {viewMode === 'table' ? (
            <VehicleTable
              vehicles={vehicles}
              selectedVehicles={selectedVehicles}
              onSelectionChange={setSelectedVehicles}
              onEdit={setEditingVehicle}
              onDelete={deleteVehicle}
              onRefresh={() => fetchVehicles(1, filters, false)}
              onDownloadImages={downloadVehicleImages}
              onUploadImages={uploadVehicleImages}
              onMarkStickerPrinted={markStickerAsPrinted}
              pagination={pagination}
            />
          ) : (
          <VehicleGrid
            vehicles={vehicles}
            selectedVehicles={selectedVehicles}
            onSelectionChange={setSelectedVehicles}
            onEdit={setEditingVehicle}
            onDelete={deleteVehicle}
            onGenerateQR={generateQRCode}
            onDownloadQR={downloadQRCode}
            onDownloadImages={downloadVehicleImages}
            onUploadImages={uploadVehicleImages}
            onMarkStickerPrinted={markStickerAsPrinted}
            pagination={pagination}
          />
          )}
        </div>

        {/* Pagination Controls */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Show</span>
              <Select value={pagination.limit.toString()} onValueChange={(value) => handleLimitChange(parseInt(value))}>
                <SelectTrigger className={`w-16 h-8 text-xs ${pagination.limit === -1 ? 'bg-primary/10 border-primary/20' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="-1">All</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {pagination.limit === -1 ? '' : 'per page'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {pagination.limit === -1 ? (
                `Showing all ${pagination.total} vehicles`
              ) : (
                `${((pagination.page - 1) * pagination.limit) + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`
              )}
            </div>
          </div>
          
          {pagination.limit !== -1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPrevPage}
                className="h-8 text-xs px-2.5"
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={pagination.page === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 p-0 text-xs ${pagination.page === pageNum ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNextPage}
                className="h-8 text-xs px-2.5"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Edit Vehicle Dialog */}
      <Dialog open={!!editingVehicle} onOpenChange={() => setEditingVehicle(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vehicle</DialogTitle>
          </DialogHeader>
          {editingVehicle && (
            <VehicleForm
              vehicle={editingVehicle}
              onSuccess={() => {
                setEditingVehicle(null);
                fetchVehicles();
              }}
              onCancel={() => setEditingVehicle(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vehicles;
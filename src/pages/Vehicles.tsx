import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { setupDevCacheClearing } from "@/lib/devCacheUtils";
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
import type { Vehicle } from "@/types/vehicle";

const Vehicles = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isCorrectingFeatures, setIsCorrectingFeatures] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchVehicles();
    }
  }, [user]);

  // Setup development cache clearing
  useEffect(() => {
    setupDevCacheClearing();
  }, []);

  const fetchVehicles = async () => {
    try {
      const data = await vehiclesAPI.getAll();
      setVehicles(data);
      setFilteredVehicles(data);
      
      if (data.length > 0) {
        toast({
          title: "Vehicles loaded",
          description: `Successfully loaded ${data.length} vehicle(s)`,
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
      setLoading(false);
    }
  };

  const deleteVehicle = async (vehicleId: string) => {
    if (!confirm("Are you sure you want to delete this vehicle?")) return;

    try {
      await vehiclesAPI.delete(vehicleId);
      setVehicles(vehicles.filter(v => v.id !== vehicleId));
      setFilteredVehicles(filteredVehicles.filter(v => v.id !== vehicleId));
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
        setFilteredVehicles(prev => prev.map(v => 
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

  const downloadQRCode = (qrCodeUrl: string, vehicleId: string) => {
    try {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `vehicle-qr-${vehicleId}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "QR Code Downloaded",
        description: "QR code has been downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Download Error",
        description: "Failed to download QR code",
        variant: "destructive",
      });
    }
  };

  const clearCache = async () => {
    try {
      // Use the enhanced development cache clearing
      await clearDevCache(toast);
      
      // Refresh the vehicles data
      await fetchVehicles();
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Cache Clear Error",
        description: "Failed to clear cache completely",
        variant: "destructive",
      });
    }
  };

  const correctFeatureFormat = async () => {
    if (!confirm("This will correct the format of features for all vehicles in the database. This may take a while. Continue?")) {
      return;
    }

    setIsCorrectingFeatures(true);
    try {
      const response = await fetch('/api/vehicles/correct-features', {
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
      
      toast({
        title: "Feature Format Corrected",
        description: `Successfully updated ${result.updatedCount} vehicles with corrected feature formats`,
      });

      // Refresh vehicles to show updated data
      await fetchVehicles();
    } catch (error: any) {
      console.error("Error correcting feature formats:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to correct feature formats",
        variant: "destructive",
      });
    } finally {
      setIsCorrectingFeatures(false);
    }
  };

  const downloadVehicleImages = async (vehicleId: string) => {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/download-images`, {
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
      await fetchVehicles();
    } catch (error: any) {
      console.error("Error downloading vehicle images:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to download vehicle images",
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Car className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">DealerIQ</h1>
            <span className="text-muted-foreground text-sm">/ Vehicles</span>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearCache}
              className="flex items-center space-x-1"
              title="Clear cache and refresh data"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Clear Cache</span>
            </Button>
            {process.env.NODE_ENV === 'development' && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => {
                  if (confirm('Force reload page and clear all cache?')) {
                    window.location.reload();
                  }
                }}
                className="flex items-center space-x-1"
                title="Force reload for development"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Dev Reload</span>
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={correctFeatureFormat}
              disabled={isCorrectingFeatures}
              className="flex items-center space-x-1"
              title="Correct feature formats in database"
            >
              {isCorrectingFeatures ? (
                <div className="animate-spin h-3 w-3 border-b border-current rounded-full" />
              ) : (
                <Settings className="h-3 w-3" />
              )}
              <span>{isCorrectingFeatures ? 'Correcting...' : 'Fix Features'}</span>
            </Button>

            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
            <span className="text-xs text-muted-foreground">
              {user.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center space-x-1"
            >
              <LogOut className="h-3 w-3" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">Vehicle Inventory</h2>
            <p className="text-sm text-muted-foreground">
              Manage your vehicle inventory and track sales
            </p>
          </div>
          <div className="flex space-x-3">
            <div className="flex border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-8"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <QRCodeStickerModal 
              vehicles={filteredVehicles}
              onGenerateQR={generateQRCode}
              onRefresh={fetchVehicles}
            />
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>Import CSV</span>
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
                <Button variant="accent" className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Vehicle</span>
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
          vehicles={vehicles} 
          onFiltersChange={(filtered) => {
            setFilteredVehicles(filtered);
            // Clear selections when filters change
            setSelectedVehicles(prev => prev.filter(id => filtered.some(v => v.id === id)));
          }} 
        />

        {/* Bulk Actions */}
        <BulkActions
          selectedVehicles={selectedVehicles}
          onClearSelection={() => setSelectedVehicles([])}
          onRefresh={fetchVehicles}
        />

        {/* Vehicle Content */}
        {viewMode === 'table' ? (
          <VehicleTable
            vehicles={filteredVehicles}
            selectedVehicles={selectedVehicles}
            onSelectionChange={setSelectedVehicles}
            onEdit={setEditingVehicle}
            onDelete={deleteVehicle}
            onRefresh={fetchVehicles}
            onDownloadImages={downloadVehicleImages}
          />
        ) : (
          <VehicleGrid
            vehicles={filteredVehicles}
            selectedVehicles={selectedVehicles}
            onSelectionChange={setSelectedVehicles}
            onEdit={setEditingVehicle}
            onDelete={deleteVehicle}
            onGenerateQR={generateQRCode}
            onDownloadQR={downloadQRCode}
            onDownloadImages={downloadVehicleImages}
          />
        )}
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
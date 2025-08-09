
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vehiclesAPI, dealersAPI } from "@/lib/api";
import { ImageUpload } from "./ImageUpload";
import { QRCodeGenerator } from "./QRCodeGenerator";

const vehicleSchema = z.object({
  // Required fields (mandatory)
  vin: z.string().min(17, "VIN must be 17 characters").max(17, "VIN must be 17 characters"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().min(1900, "Invalid year").max(new Date().getFullYear() + 1, "Invalid year"),
  status: z.enum(["available", "sold", "pending"]),
  new_used: z.enum(["new", "used"]),
  
  // Important fields (high priority)
  stock_number: z.string().optional(),
  series: z.string().optional(),
  trim: z.string().optional(),
  body_style: z.string().optional(),
  color: z.string().optional(),
  interior_color: z.string().optional(),
  mileage: z.number().min(0, "Mileage must be positive").optional(),
  odometer: z.number().min(0, "Odometer must be positive").optional(),
  price: z.number().min(0, "Price must be positive").optional(),
  msrp: z.number().min(0, "MSRP must be positive").optional(),
  
  // Technical specifications
  engine_type: z.string().optional(),
  displacement: z.string().optional(),
  transmission: z.string().optional(),
  certified: z.boolean().optional(),
  
  // Pricing and financial fields
  dealer_discount: z.number().min(0, "Dealer discount must be positive").optional(),
  consumer_rebate: z.number().min(0, "Consumer rebate must be positive").optional(),
  dealer_accessories: z.number().min(0, "Dealer accessories must be positive").optional(),
  total_customer_savings: z.number().min(0, "Total customer savings must be positive").optional(),
  total_dealer_rebate: z.number().min(0, "Total dealer rebate must be positive").optional(),
  other_price: z.number().min(0, "Other price must be positive").optional(),
  
  // Additional information
  description: z.string().optional(),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface VehicleFormProps {
  vehicle?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const VehicleForm = ({ vehicle, onSuccess, onCancel }: VehicleFormProps) => {
  const [features, setFeatures] = useState<string[]>(vehicle?.features || []);
  const [images, setImages] = useState<string[]>(vehicle?.photo_url_list || []);
  const [newFeature, setNewFeature] = useState("");
  const [loading, setLoading] = useState(false);
  const [dealerInfo, setDealerInfo] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>(vehicle?.qr_code_url || "");
  const { toast } = useToast();

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vin: vehicle?.vin || "",
      make: vehicle?.make || "",
      model: vehicle?.model || "",
      year: vehicle?.year || new Date().getFullYear(),
      status: vehicle?.status || "available",
      new_used: vehicle?.new_used || "used",
      stock_number: vehicle?.stock_number || "",
      series: vehicle?.series || "",
      trim: vehicle?.trim || "",
      body_style: vehicle?.body_style || "",
      color: vehicle?.color || "",
      interior_color: vehicle?.interior_color || "",
      mileage: vehicle?.mileage ? parseFloat(vehicle.mileage.toString()) : undefined,
      odometer: vehicle?.odometer ? parseInt(vehicle.odometer.toString()) : undefined,
      price: vehicle?.price ? parseFloat(vehicle.price.toString()) : undefined,
      msrp: vehicle?.msrp ? parseFloat(vehicle.msrp.toString()) : undefined,
      engine_type: vehicle?.engine_type || "",
      displacement: vehicle?.displacement || "",
      transmission: vehicle?.transmission || "",
      certified: vehicle?.certified || false,
      dealer_discount: vehicle?.dealer_discount ? parseFloat(vehicle.dealer_discount.toString()) : undefined,
      consumer_rebate: vehicle?.consumer_rebate ? parseFloat(vehicle.consumer_rebate.toString()) : undefined,
      dealer_accessories: vehicle?.dealer_accessories ? parseFloat(vehicle.dealer_accessories.toString()) : undefined,
      total_customer_savings: vehicle?.total_customer_savings ? parseFloat(vehicle.total_customer_savings.toString()) : undefined,
      total_dealer_rebate: vehicle?.total_dealer_rebate ? parseFloat(vehicle.total_dealer_rebate.toString()) : undefined,
      other_price: vehicle?.other_price ? parseFloat(vehicle.other_price.toString()) : undefined,
      description: vehicle?.description || "",
    },
  });

  // Fetch dealer info when component mounts
  useEffect(() => {
    fetchDealerInfo();
  }, []);

  const fetchDealerInfo = async () => {
    try {
      const dealer = await dealersAPI.getProfile();
      setDealerInfo(dealer);
    } catch (error: any) {
      console.error("Error fetching dealer info:", error);
      if (error.message.includes('404') || error.message.includes('not found')) {
        toast({
          title: "Dealer Profile Required",
          description: "Please complete your dealer profile before adding vehicles. Go to Profile → Dealer Information.",
          variant: "destructive",
        });
      }
    }
  };

  const addFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature.trim())) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature("");
    }
  };

  const removeFeature = (featureToRemove: string) => {
    setFeatures(features.filter(feature => feature !== featureToRemove));
  };

  const onSubmit = async (data: VehicleFormData) => {
    setLoading(true);
    try {
      // Ensure we have dealer info
      if (!dealerInfo) {
        await fetchDealerInfo();
        if (!dealerInfo) {
          throw new Error("Dealer profile not found. Please complete your dealer profile first.");
        }
      }

      const vehicleData = {
        vin: data.vin,
        make: data.make,
        model: data.model,
        year: data.year,
        status: data.status,
        new_used: data.new_used,
        stock_number: data.stock_number || null,
        series: data.series || null,
        trim: data.trim || null,
        body_style: data.body_style || null,
        color: data.color || null,
        interior_color: data.interior_color || null,
        mileage: data.mileage || null,
        odometer: data.odometer || null,
        price: data.price || null,
        msrp: data.msrp || null,
        engine_type: data.engine_type || null,
        displacement: data.displacement || null,
        transmission: data.transmission || null,
        certified: data.certified || false,
        dealer_discount: data.dealer_discount || null,
        consumer_rebate: data.consumer_rebate || null,
        dealer_accessories: data.dealer_accessories || null,
        total_customer_savings: data.total_customer_savings || null,
        total_dealer_rebate: data.total_dealer_rebate || null,
        other_price: data.other_price || null,
        description: data.description || null,
        dealer_id: dealerInfo.id,
        features: features.length > 0 ? features : null,
        photo_url_list: images.length > 0 ? images : null,
      };

      console.log("Saving vehicle with dealer_id:", dealerInfo.id);

      let createdVehicle;
      if (vehicle?.id) {
        createdVehicle = await vehiclesAPI.update(vehicle.id, vehicleData);
      } else {
        createdVehicle = await vehiclesAPI.create(vehicleData);
      }

      // If we have temporary images and this is a new vehicle, upload them
      if (!vehicle?.id && createdVehicle && images.length > 0) {
        const tempImages = images.filter(img => img.startsWith('blob:'));
        if (tempImages.length > 0) {
          // Upload temporary images to the newly created vehicle
          for (const tempImage of tempImages) {
            try {
              // Convert blob URL back to file
              const response = await fetch(tempImage);
              const blob = await response.blob();
              const file = new File([blob], 'image.jpg', { type: blob.type });
              
              const formData = new FormData();
              formData.append('images', file);
              
              await vehiclesAPI.uploadImages(createdVehicle.id, formData);
            } catch (error) {
              console.error('Error uploading temporary image:', error);
            }
          }
        }
      }

      toast({
        title: "Success",
        description: vehicle?.id ? "Vehicle updated successfully" : "Vehicle added successfully",
      });

      onSuccess?.();
    } catch (error: any) {
      console.error("Error saving vehicle:", error);
      
      // Handle specific error cases
      if (error.message?.includes("dealer profile")) {
        toast({
          title: "Dealer Profile Required",
          description: "Please complete your dealer profile before adding vehicles.",
          variant: "destructive",
        });
      } else if (error.code === "23503") {
        toast({
          title: "Database Error",
          description: "Unable to link vehicle to dealer. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to save vehicle",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{vehicle?.id ? "Edit Vehicle" : "Add New Vehicle"}</span>
          {dealerInfo && (
            <div className="text-sm text-muted-foreground">
              For: {dealerInfo.business_name}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Required Fields Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-red-600">Required Fields *</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VIN *</FormLabel>
                      <FormControl>
                        <Input placeholder="17-character VIN" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="sold">Sold</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="new_used"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="used">Used</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="make"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Make *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Toyota" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Camry" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="2024" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Important Fields Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600">Important Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="stock_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., H0102718" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="series"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Series</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Grand Touring" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trim</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., LE, XLE" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="body_style"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Body Style</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 2D Convertible" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exterior Color</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Red" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interior_color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interior Color</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Auburn" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mileage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mileage</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1"
                          placeholder="0" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="odometer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Odometer</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Technical Specifications Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-green-600">Technical Specifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="engine_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Engine Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., I4" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displacement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Displacement</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., R" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transmission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transmission</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 6-Speed Manual" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="certified"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Certified Vehicle</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Pricing Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-600">Pricing Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="25000.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="msrp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MSRP ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="28000.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dealer_discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dealer Discount ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="2000.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="consumer_rebate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Consumer Rebate ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="1000.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dealer_accessories"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dealer Accessories ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="500.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="total_customer_savings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Customer Savings ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="3000.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="total_dealer_rebate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Dealer Rebate ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="1500.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="other_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Price ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="24000.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Vehicle description and additional details..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Features Section */}
            <div className="space-y-3">
              <FormLabel>Features</FormLabel>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a feature..."
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                />
                <Button type="button" onClick={addFeature} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {features.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {features.map((feature, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
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

            {/* Image Upload Section */}
            <ImageUpload
              vehicleId={vehicle?.id}
              existingImages={images}
              onImagesChange={setImages}
              maxImages={10}
            />

            {/* QR Code Generation Section */}
            <QRCodeGenerator
              vehicleId={vehicle?.id}
              qrCodeUrl={qrCodeUrl}
              onQRCodeGenerated={setQrCodeUrl}
            />

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading || !dealerInfo}>
                {loading ? "Saving..." : (vehicle?.id ? "Update Vehicle" : "Add Vehicle")}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>

            {!dealerInfo && (
              <div className="text-sm text-muted-foreground mt-2">
                Loading dealer information...
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

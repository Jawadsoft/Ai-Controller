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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Phone, Mail, MapPin, Calendar, Save, Upload, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddressLookup } from "./AddressLookup";
import { dealersAPI } from "@/lib/api";

const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" }, { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" }, { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" }, { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" }
];

const dealerSchema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  contact_name: z.string().min(1, "Contact name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().min(5, "ZIP code must be at least 5 digits"),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  description: z.string().optional(),
  license_number: z.string().optional(),
  established_year: z.number().min(1900, "Invalid year").max(new Date().getFullYear(), "Invalid year").optional(),
});

type DealerFormData = z.infer<typeof dealerSchema>;

interface DealerProfile extends DealerFormData {
  id: string;
  user_id: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

interface DealerProfileFormProps {
  dealer?: DealerProfile;
  onSave?: (dealer: DealerProfile) => void;
  showHeader?: boolean;
}

export const DealerProfileForm = ({ dealer, onSave, showHeader = true }: DealerProfileFormProps) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(dealer?.logo_url || "");
  const { toast } = useToast();

  const form = useForm<DealerFormData>({
    resolver: zodResolver(dealerSchema),
    defaultValues: {
      business_name: dealer?.business_name || "",
      contact_name: dealer?.contact_name || "",
      email: dealer?.email || "",
      phone: dealer?.phone || "",
      address: dealer?.address || "",
      city: dealer?.city || "",
      state: dealer?.state || "",
      zip_code: dealer?.zip_code || "",
      website: dealer?.website || "",
      description: dealer?.description || "",
      license_number: dealer?.license_number || "",
      established_year: dealer?.established_year || undefined,
    },
  });

  const uploadLogo = async (file: File): Promise<string | null> => {
    try {
      // Placeholder for logo upload functionality
      // This would be replaced with actual upload to your backend
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;
      
      // Create a temporary URL for preview (this won't persist)
      const tempUrl = URL.createObjectURL(file);
      
      toast({
        title: "Logo Upload",
        description: `Logo upload feature not yet implemented. File: ${fileName}`,
      });
      
      return tempUrl;
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload logo",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({
        title: "File too large",
        description: "Logo must be less than 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const newLogoUrl = await uploadLogo(file);
    if (newLogoUrl) {
      setLogoUrl(newLogoUrl);
    }
    setUploading(false);
    event.target.value = '';
  };

  const onSubmit = async (data: DealerFormData) => {
    setLoading(true);
    try {
      const dealerData = {
        business_name: data.business_name,
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
        website: data.website || null,
        description: data.description || null,
        license_number: data.license_number || null,
        established_year: data.established_year || null,
        logo_url: logoUrl || null,
      };

      const result = await dealersAPI.updateProfile(dealerData);

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      onSave?.(result);
    } catch (error: any) {
      console.error("Error saving dealer profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (businessName: string) => {
    return businessName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAddressSelect = (address: {
    address: string;
    city: string;
    state: string;
    zip_code: string;
  }) => {
    // Update form values with the selected address
    form.setValue("address", address.address);
    form.setValue("city", address.city);
    form.setValue("state", address.state);
    form.setValue("zip_code", address.zip_code);
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>{dealer?.id ? "Edit Dealer Profile" : "Complete Your Dealer Profile"}</span>
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Business Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Logo Upload Section */}
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={logoUrl} alt="Business logo" />
                    <AvatarFallback className="text-lg">
                      {form.watch("business_name") ? getInitials(form.watch("business_name")) : "DL"}
                    </AvatarFallback>
                  </Avatar>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Business Logo</h4>
                  <p className="text-sm text-muted-foreground">
                    Upload your dealership logo (max 2MB)
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => document.getElementById('logo-upload')?.click()}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {logoUrl ? "Change Logo" : "Upload Logo"}
                    </Button>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="business_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC Auto Sales" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contact@abcauto.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://www.abcauto.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="license_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dealer License Number</FormLabel>
                      <FormControl>
                        <Input placeholder="DL123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center space-x-2">
                  <MapPin className="h-4 w-4" />
                  <span>Business Address</span>
                </h4>
                
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address *</FormLabel>
                      <FormControl>
                        <AddressLookup
                          onAddressSelect={handleAddressSelect}
                          placeholder="Start typing your business address..."
                          initialValue={field.value}
                          onManualChange={(value) => field.onChange(value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <FormControl>
                          <Input placeholder="New York" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state.value} value={state.value}>
                                {state.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zip_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code *</FormLabel>
                        <FormControl>
                          <Input placeholder="10001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h4 className="font-medium">Additional Information</h4>
                
                <FormField
                  control={form.control}
                  name="established_year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year Established</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="2020" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell customers about your dealership, specialties, and what makes you unique..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button type="submit" disabled={loading || uploading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Saving..." : (dealer?.id ? "Update Profile" : "Save Profile")}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
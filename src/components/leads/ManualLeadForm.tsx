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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, User, Car } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { leadsAPI, dealersAPI, vehiclesAPI } from "@/lib/api";

const leadSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  customer_email: z.string().email("Invalid email address"),
  customer_phone: z.string().optional(),
  vehicle_id: z.string().min(1, "Please select a vehicle"),
  message: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "proposal", "closed", "lost"]).default("new"),
  interest_level: z.enum(["low", "medium", "high"]).default("medium"),
  follow_up_date: z.date().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  price?: number;
  status: string;
}

interface ManualLeadFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ManualLeadForm = ({ onSuccess, onCancel }: ManualLeadFormProps) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [dealerInfo, setDealerInfo] = useState<any>(null);
  const { toast } = useToast();

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      vehicle_id: "",
      message: "",
      status: "new",
      interest_level: "medium",
    },
  });

  useEffect(() => {
    fetchVehicles();
    fetchDealerInfo();
  }, []);

  const fetchDealerInfo = async () => {
    try {
      const dealer = await dealersAPI.getProfile();
      setDealerInfo(dealer);
    } catch (error: any) {
      console.error("Error fetching dealer info:", error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const data = await vehiclesAPI.getAll();
      setVehicles(data.filter((v: any) => v.status === "available"));
    } catch (error: any) {
      console.error("Error fetching vehicles:", error);
      toast({
        title: "Error",
        description: "Failed to load vehicles",
        variant: "destructive",
      });
    } finally {
      setVehiclesLoading(false);
    }
  };

  const onSubmit = async (data: LeadFormData) => {
    setLoading(true);
    try {
      // Ensure we have dealer info
      if (!dealerInfo) {
        await fetchDealerInfo();
        if (!dealerInfo) {
          throw new Error("Dealer profile not found. Please complete your dealer profile first.");
        }
      }

      const leadData = {
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone || null,
        vehicle_id: data.vehicle_id,
        dealer_id: dealerInfo.id, // Add the required dealer_id
        message: data.message || null,
        status: data.status,
        interest_level: data.interest_level,
        // Note: You might want to add a follow_up_date field to the database schema
      };

      await leadsAPI.create(leadData);

      toast({
        title: "Success",
        description: "Lead created successfully",
      });

      form.reset();
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating lead:", error);
      
      // Handle specific error cases
      if (error.message?.includes("dealer profile")) {
        toast({
          title: "Dealer Profile Required",
          description: "Please complete your dealer profile before adding leads.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create lead",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Add New Lead Manually
          </div>
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
            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customer_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customer_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="john@example.com" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customer_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input 
                          type="tel" 
                          placeholder="+1 (555) 123-4567" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicle_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Interest *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a vehicle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vehiclesLoading ? (
                            <SelectItem value="loading" disabled>
                              Loading vehicles...
                            </SelectItem>
                          ) : vehicles.length === 0 ? (
                            <SelectItem value="no-vehicles" disabled>
                              No available vehicles
                            </SelectItem>
                          ) : (
                            vehicles.map((vehicle) => (
                              <SelectItem key={vehicle.id} value={vehicle.id}>
                                <div className="flex items-center justify-between w-full">
                                  <span>
                                    {vehicle.year} {vehicle.make} {vehicle.model}
                                  </span>
                                  {vehicle.price && (
                                    <span className="text-muted-foreground ml-2">
                                      {formatPrice(vehicle.price)}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Message/Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Customer inquiry details, requirements, or notes..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Lead Management */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Lead Management</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="proposal">Proposal Sent</SelectItem>
                          <SelectItem value="closed">Closed Won</SelectItem>
                          <SelectItem value="lost">Closed Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interest_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select interest level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="follow_up_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Follow-up Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading || !dealerInfo}>
                {loading ? "Creating Lead..." : "Create Lead"}
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
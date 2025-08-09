import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Eye, Edit, Trash2, Phone, Mail, Calendar, User, ChevronUp, ChevronDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { leadsAPI } from "@/lib/api";

interface Lead {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  message?: string;
  vehicle_id: string;
  status: string;
  interest_level: string;
  created_at: string;
  updated_at: string;
  // Joined vehicle data
  vehicle?: {
    year: number;
    make: string;
    model: string;
    price?: number;
  };
}

interface LeadsTableProps {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
  onRefresh: () => void;
}

type SortField = 'customer_name' | 'status' | 'interest_level' | 'created_at';
type SortDirection = 'asc' | 'desc';

const leadUpdateSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "proposal", "closed", "lost"]),
  interest_level: z.enum(["low", "medium", "high"]),
  notes: z.string().optional(),
});

type LeadUpdateData = z.infer<typeof leadUpdateSchema>;

export const LeadsTable = ({ leads, onEdit, onDelete, onRefresh }: LeadsTableProps) => {
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const { toast } = useToast();

  const form = useForm<LeadUpdateData>({
    resolver: zodResolver(leadUpdateSchema),
    defaultValues: {
      status: "new",
      interest_level: "low",
      notes: "",
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedLeads = () => {
    return [...leads].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

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
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatPrice = (price?: number) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'default';
      case 'contacted': return 'secondary';
      case 'qualified': return 'outline';
      case 'proposal': return 'default';
      case 'closed': return 'default';
      case 'lost': return 'destructive';
      default: return 'secondary';
    }
  };

  const getInterestColor = (level: string) => {
    switch (level) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const handleUpdate = async (data: LeadUpdateData) => {
    if (!selectedLead) return;

    try {
      await leadsAPI.update(selectedLead.id, {
        status: data.status,
        interest_level: data.interest_level,
      });

      toast({
        title: "Success",
        description: "Lead updated successfully",
      });

      setShowUpdateDialog(false);
      onRefresh();
    } catch (error: any) {
      console.error("Error updating lead:", error);
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    }
  };

  const openUpdateDialog = (lead: Lead) => {
    setSelectedLead(lead);
    form.reset({
      status: lead.status as any,
      interest_level: lead.interest_level as any,
      notes: "",
    });
    setShowUpdateDialog(true);
  };

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

  const sortedLeads = getSortedLeads();

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton field="customer_name">Customer</SortButton>
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Vehicle Interest</TableHead>
              <TableHead>
                <SortButton field="status">Status</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="interest_level">Interest Level</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="created_at">Date</SortButton>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeads.map((lead) => (
              <TableRow key={lead.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{lead.customer_name}</div>
                      {lead.message && (
                        <div className="text-sm text-muted-foreground truncate max-w-48">
                          "{lead.message}"
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm">
                      <Mail className="h-3 w-3" />
                      <span className="truncate max-w-48">{lead.customer_email}</span>
                    </div>
                    {lead.customer_phone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{lead.customer_phone}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {lead.vehicle ? (
                    <div>
                      <div className="font-medium">
                        {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatPrice(lead.vehicle.price)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Vehicle not found</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusColor(lead.status)}>
                    {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getInterestColor(lead.interest_level)}>
                    {lead.interest_level.charAt(0).toUpperCase() + lead.interest_level.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(lead.created_at)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openUpdateDialog(lead)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(lead.id)}
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
        {sortedLeads.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No leads found
          </div>
        )}
      </div>

      {/* Update Lead Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Lead</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
                <div className="bg-muted p-3 rounded-lg">
                  <h4 className="font-medium">{selectedLead.customer_name}</h4>
                  <p className="text-sm text-muted-foreground">{selectedLead.customer_email}</p>
                  {selectedLead.vehicle && (
                    <p className="text-sm">
                      Interested in: {selectedLead.vehicle.year} {selectedLead.vehicle.make} {selectedLead.vehicle.model}
                    </p>
                  )}
                </div>

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
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add notes about this lead..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4">
                  <Button type="submit">Update Lead</Button>
                  <Button type="button" variant="outline" onClick={() => setShowUpdateDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
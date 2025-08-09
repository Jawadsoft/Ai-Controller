import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, RotateCcw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  vehicle?: {
    year: number;
    make: string;
    model: string;
    price?: number;
  };
}

interface Filters {
  search: string;
  status: string;
  interestLevel: string;
  dateFrom: string;
  dateTo: string;
}

interface LeadFiltersProps {
  leads: Lead[];
  onFiltersChange: (filteredLeads: Lead[]) => void;
}

export const LeadFilters = ({ leads, onFiltersChange }: LeadFiltersProps) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "all",
    interestLevel: "all",
    dateFrom: "",
    dateTo: "",
  });

  const applyFilters = () => {
    let filtered = leads;

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        lead =>
          lead.customer_name.toLowerCase().includes(searchLower) ||
          lead.customer_email.toLowerCase().includes(searchLower) ||
          (lead.customer_phone && lead.customer_phone.toLowerCase().includes(searchLower)) ||
          (lead.message && lead.message.toLowerCase().includes(searchLower)) ||
          (lead.vehicle && 
            `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}`.toLowerCase().includes(searchLower))
      );
    }

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter(lead => lead.status === filters.status);
    }

    // Interest level filter
    if (filters.interestLevel !== "all") {
      filtered = filtered.filter(lead => lead.interest_level === filters.interestLevel);
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(lead => new Date(lead.created_at) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(lead => new Date(lead.created_at) <= toDate);
    }

    onFiltersChange(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [filters, leads]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      search: "",
      status: "all",
      interestLevel: "all",
      dateFrom: "",
      dateTo: "",
    });
  };

  const activeFiltersCount = Object.entries(filters).reduce((count, [key, value]) => {
    if (key === 'search' && value) return count + 1;
    if (typeof value === 'string' && value && !value.includes('all')) return count + 1;
    return count;
  }, 0);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Lead Filters
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
                placeholder="Search customers, vehicles, emails..."
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
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal Sent</SelectItem>
                <SelectItem value="closed">Closed Won</SelectItem>
                <SelectItem value="lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="interestLevel">Interest Level</Label>
            <Select value={filters.interestLevel} onValueChange={(value) => updateFilter('interestLevel', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Interest Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Interest Levels</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
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
            {/* Date Range */}
            <div>
              <Label>Date Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  placeholder="From Date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                />
                <Input
                  type="date"
                  placeholder="To Date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
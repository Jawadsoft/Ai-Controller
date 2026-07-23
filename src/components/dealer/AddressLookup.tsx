import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AddressResult {
  place_name: string;
  center: [number, number];
  address: string;
  city: string;
  state: string;
  zip_code: string;
  formatted_address: string;
}

interface AddressLookupProps {
  onAddressSelect: (address: {
    address: string;
    city: string;
    state: string;
    zip_code: string;
  }) => void;
  onManualChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  initialValue?: string;
}

export const AddressLookup = ({ 
  onAddressSelect, 
  onManualChange,
  placeholder = "Start typing an address...",
  className = "",
  initialValue = ""
}: AddressLookupProps) => {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const { toast } = useToast();

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        resultsRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        !resultsRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddresses = async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      // Placeholder for address lookup functionality
      // This would be replaced with actual address lookup API
      toast({
        title: "Address Lookup",
        description: "Address lookup feature is not yet implemented. Please enter address manually.",
      });
      
      setResults([]);
      setShowResults(false);
      setSelectedIndex(-1);

    } catch (error: any) {
      console.error('Address lookup error:', error);
      toast({
        title: "Address lookup failed",
        description: "Please try typing your address manually",
        variant: "destructive",
      });
      setResults([]);
      setShowResults(false);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = (searchQuery: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      searchAddresses(searchQuery);
    }, 300);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Update the form field with manual input
    if (onManualChange) {
      onManualChange(value);
    }
    
    debouncedSearch(value);
  };

  const handleSelectAddress = (result: AddressResult) => {
    setQuery(result.formatted_address);
    setShowResults(false);
    setSelectedIndex(-1);
    
    onAddressSelect({
      address: result.address,
      city: result.city,
      state: result.state,
      zip_code: result.zip_code,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectAddress(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const getCurrentLocationAddress = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support geolocation",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // Placeholder for location-based address lookup
    toast({
      title: "Location Lookup",
      description: "Location-based address lookup feature is not yet implemented.",
    });
    
    setLoading(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) {
                setShowResults(true);
              }
            }}
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        
        <Button
          type="button"
          variant="outline"
          onClick={getCurrentLocationAddress}
          disabled={loading}
          className="shrink-0"
        >
          <MapPin className="h-4 w-4" />
        </Button>
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <Card 
          ref={resultsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto"
        >
          <div className="p-1">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 cursor-pointer rounded-md transition-colors ${
                  index === selectedIndex 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-muted'
                }`}
                onClick={() => handleSelectAddress(result)}
              >
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {result.address}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {result.city}, {result.state} {result.zip_code}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* No results message */}
      {showResults && results.length === 0 && query.length >= 3 && !loading && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1">
          <div className="p-3 text-center text-sm text-muted-foreground">
            No addresses found. Try a different search or enter manually.
          </div>
        </Card>
      )}
    </div>
  );
};
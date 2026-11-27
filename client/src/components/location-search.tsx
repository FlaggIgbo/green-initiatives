import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/use-translation";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationValue extends Coordinates {
  address: string;
}

interface GeocodeSuggestion {
  lat: string;
  lon: string;
  display_name: string;
}

interface LocationSearchProps {
  onLocationSelect: (location: LocationValue | null) => void;
  placeholder?: string;
  className?: string;
  initialValue?: string;
}

export function LocationSearch({
  onLocationSelect,
  placeholder,
  className,
  initialValue = "",
}: LocationSearchProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(initialValue);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Trigger search when debounced value changes
  useEffect(() => {
    if (debouncedSearch.length < 3 || initialValue === debouncedSearch) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/map/search?q=${encodeURIComponent(debouncedSearch)}`);
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedSearch, initialValue]);

  const handleSelect = (suggestion: GeocodeSuggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    const address = suggestion.display_name;

    setSearch(address);
    setShowSuggestions(false);
    onLocationSelect({ lat, lng, address });
  };

  const handleClear = () => {
    setSearch("");
    setSuggestions([]);
    onLocationSelect(null);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="location-search-input"
          placeholder={placeholder || t.projects.marketplace.search.placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className="pl-10 pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
            onClick={handleClear}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-[1000] mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-left"
              onClick={() => handleSelect(suggestion)}
            >
              <MapPin className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <span className="truncate">{suggestion.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

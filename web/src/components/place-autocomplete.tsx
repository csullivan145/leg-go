import { useCallback, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useConfig } from '@/hooks/queries/use-config';
import { cn } from '@/lib/utils';

export interface SelectedPlace {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  place_id: string;
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface PlaceAutocompleteProps {
  value: string;
  onChange: (name: string) => void;
  onSelect: (place: SelectedPlace) => void;
  placeholder?: string;
  className?: string;
  /** Extra context to bias results (e.g. parent location city name) */
  bias?: string;
}

export function PlaceAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  bias,
}: PlaceAutocompleteProps) {
  const { data: config } = useConfig();
  const apiKey = config?.googleMapsApiKey ?? null;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(
    (input: string) => {
      if (!apiKey) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const q = input.trim();
      if (q.length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
            },
            body: JSON.stringify({
              input: bias ? `${q} ${bias}` : q,
              includeQueryPredictions: false,
            }),
          });
          if (!res.ok) {
            setSuggestions([]);
            return;
          }
          const data = (await res.json()) as {
            suggestions?: Array<{
              placePrediction?: {
                placeId: string;
                structuredFormat?: {
                  mainText?: { text: string };
                  secondaryText?: { text: string };
                };
                text?: { text: string };
              };
            }>;
          };
          const items: Suggestion[] = (data.suggestions ?? [])
            .map((s) => s.placePrediction)
            .filter((p): p is NonNullable<typeof p> => !!p)
            .map((p) => ({
              placeId: p.placeId,
              mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
              secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
            }));
          setSuggestions(items);
          setOpen(items.length > 0);
          setActiveIdx(-1);
        } catch {
          setSuggestions([]);
        }
      }, 250);
    },
    [apiKey, bias],
  );

  const handleChange = (next: string) => {
    onChange(next);
    fetchSuggestions(next);
  };

  const pick = async (suggestion: Suggestion) => {
    if (!apiKey) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setOpen(false);
    setSuggestions([]);

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(suggestion.placeId)}`,
        {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
          },
        },
      );
      if (!res.ok) return;
      const place = (await res.json()) as {
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      };
      const name = place.displayName?.text ?? suggestion.mainText;
      onSelect({
        name,
        address: place.formattedAddress ?? '',
        lat: place.location?.latitude ?? null,
        lng: place.location?.longitude ?? null,
        place_id: place.id ?? suggestion.placeId,
      });
    } catch {
      // ignore — user still has the typed name
    }
  };

  // If no API key, just render a plain input (graceful fallback)
  if (!apiKey) {
    return (
      <Input
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className="relative">
      <Input
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, -1));
          } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            pick(suggestions[activeIdx]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-lg max-h-64 overflow-auto">
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              className={cn(
                'flex items-start gap-2 px-3 py-2 text-sm cursor-pointer',
                i === activeIdx ? 'bg-accent' : 'hover:bg-accent/60',
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="font-medium truncate">{s.mainText}</p>
                {s.secondaryText && (
                  <p className="text-xs text-muted-foreground truncate">{s.secondaryText}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

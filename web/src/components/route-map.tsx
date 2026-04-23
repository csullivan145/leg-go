import { useEffect, useRef } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { useConfig } from '@/hooks/queries/use-config';
import type { Leg } from '@leg-go/shared';

interface LegWithGeo extends Leg {
  lat: number | null;
  lng: number | null;
}

interface RouteMapProps {
  legs: LegWithGeo[];
  onSelectLeg?: (legId: string) => void;
}

export function RouteMap({ legs, onSelectLeg }: RouteMapProps) {
  const { data: config } = useConfig();
  const apiKey = config?.googleMapsApiKey ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  const locationLegs = legs
    .filter((l) => l.type === 'location' && l.lat != null && l.lng != null)
    .sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;

    let cancelled = false;
    setOptions({ key: apiKey, v: 'weekly' });

    (async () => {
      const [{ Map: GMap, Polyline }, { AdvancedMarkerElement }, { LatLngBounds }] = await Promise.all([
        importLibrary('maps'),
        importLibrary('marker'),
        importLibrary('core'),
      ]);

      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        const first = locationLegs[0];
        mapRef.current = new GMap(containerRef.current, {
          zoom: first ? 5 : 2,
          center: first && first.lat != null && first.lng != null
            ? { lat: first.lat, lng: first.lng }
            : { lat: 20, lng: 0 },
          mapId: 'leggo-route-map',
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
      }

      // Clear previous markers / polyline
      for (const m of markersRef.current) m.map = null;
      markersRef.current = [];
      if (polylineRef.current) polylineRef.current.setMap(null);
      polylineRef.current = null;

      if (locationLegs.length === 0) return;

      const bounds = new LatLngBounds();
      const path: google.maps.LatLngLiteral[] = [];

      locationLegs.forEach((leg, i) => {
        if (leg.lat == null || leg.lng == null) return;
        const position = { lat: leg.lat, lng: leg.lng };
        bounds.extend(position);
        path.push(position);

        const pin = document.createElement('div');
        pin.className =
          'h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow ring-2 ring-background cursor-pointer';
        pin.textContent = String(i + 1);
        pin.title = leg.name ?? '';

        const marker = new AdvancedMarkerElement({
          map: mapRef.current!,
          position,
          content: pin,
          title: leg.name ?? undefined,
        });
        marker.addListener('click', () => onSelectLeg?.(leg.id));
        markersRef.current.push(marker);
      });

      polylineRef.current = new Polyline({
        path,
        geodesic: true,
        strokeColor: '#C2410C',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: mapRef.current!,
      });

      if (locationLegs.length === 1) {
        mapRef.current!.setCenter(path[0]);
        mapRef.current!.setZoom(10);
      } else {
        mapRef.current!.fitBounds(bounds, 48);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiKey, locationLegs, onSelectLeg]);

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        Map unavailable — Google Maps API key is not configured.
      </div>
    );
  }

  if (locationLegs.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No mapped locations yet. Pick locations from the autocomplete to plot them on the map.
      </div>
    );
  }

  return <div ref={containerRef} className="h-[480px] rounded-xl border border-border/60 overflow-hidden" />;
}

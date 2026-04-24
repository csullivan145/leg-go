import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { Plane, Train, Ship, Car, Bus } from 'lucide-react';
import { useConfig } from '@/hooks/queries/use-config';
import type { Leg, TransportType } from '@leg-go/shared';

interface LegWithGeo extends Leg {
  lat: number | null;
  lng: number | null;
}

interface RouteMapProps {
  legs: LegWithGeo[];
  onSelectLeg?: (legId: string) => void;
}

const transportIcons: Record<TransportType, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  train: Train,
  ferry: Ship,
  car: Car,
  bus: Bus,
};

export function RouteMap({ legs, onSelectLeg }: RouteMapProps) {
  const { data: config } = useConfig();
  const apiKey = config?.googleMapsApiKey ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const rootsRef = useRef<Root[]>([]);

  const sortedLegs = [...legs].sort((a, b) => a.order - b.order);
  const locationLegs = sortedLegs.filter(
    (l) => l.type === 'location' && l.lat != null && l.lng != null,
  );

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

      // Clear previous markers / polyline / react roots
      for (const m of markersRef.current) m.map = null;
      markersRef.current = [];
      for (const r of rootsRef.current) r.unmount();
      rootsRef.current = [];
      if (polylineRef.current) polylineRef.current.setMap(null);
      polylineRef.current = null;

      if (locationLegs.length === 0) return;

      const bounds = new LatLngBounds();
      const path: google.maps.LatLngLiteral[] = [];

      // Location pins — numbered
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

      // Connecting polyline in route order
      polylineRef.current = new Polyline({
        path,
        geodesic: true,
        strokeColor: '#C2410C',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: mapRef.current!,
      });

      // Midpoint transport icons — one per consecutive-location pair
      for (let i = 0; i < locationLegs.length - 1; i++) {
        const from = locationLegs[i];
        const to = locationLegs[i + 1];
        if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) continue;

        const travel = sortedLegs.find(
          (l) => l.type === 'travel' && l.order > from.order && l.order < to.order,
        );
        if (!travel?.transport_type) continue;

        const Icon = transportIcons[travel.transport_type];
        if (!Icon) continue;

        const midDiv = document.createElement('div');
        midDiv.className =
          'h-7 w-7 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow cursor-pointer';
        const root = createRoot(midDiv);
        root.render(<Icon className="h-3.5 w-3.5 text-primary" />);
        rootsRef.current.push(root);

        const mid = {
          lat: (from.lat + to.lat) / 2,
          lng: (from.lng + to.lng) / 2,
        };

        const marker = new AdvancedMarkerElement({
          map: mapRef.current!,
          position: mid,
          content: midDiv,
          title: travel.name ?? undefined,
        });
        marker.addListener('click', () => onSelectLeg?.(travel.id));
        markersRef.current.push(marker);
      }

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
  }, [apiKey, locationLegs, sortedLegs, onSelectLeg]);

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

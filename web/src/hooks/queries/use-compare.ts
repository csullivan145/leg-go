import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { routeKeys } from './use-routes';

export interface RouteCompareRow {
  route_id: string;
  route_name: string;
  flights_from_home: number;
  in_region_transport: number;
  car_rental: number;
  accommodation: number;
  activities: number;
  trip_total: number;
  offset: number;
  out_of_pocket: number;
  flight_count: number;
  ferry_count: number;
  total_travel_hours: string;
}

export interface CompareData {
  routes: RouteCompareRow[];
  offset: number;
}

export function useCompare(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'compare'],
    queryFn: async () => {
      const res = await api.get<{ comparison: Array<{
        route: { id: string; name: string; status: string };
        costs: { flights: number; ferries: number; trains: number; otherTransport: number; accommodation: number; carRental: number; activities: number; total: number };
        convenience: { flightCount: number; ferryCount: number; trainCount: number; totalTransportLegs: number; totalTravelMinutes: number; locationCount: number };
      }>; totalOffset: number }>(`/api/trips/${tripId}/compare`);
      return {
        routes: res.comparison.map((c) => ({
          route_id: c.route.id,
          route_name: c.route.name,
          flights_from_home: c.costs.flights,
          in_region_transport: c.costs.ferries + c.costs.trains + c.costs.otherTransport,
          car_rental: c.costs.carRental,
          accommodation: c.costs.accommodation,
          activities: c.costs.activities,
          trip_total: c.costs.total,
          offset: res.totalOffset,
          out_of_pocket: c.costs.total - res.totalOffset,
          flight_count: c.convenience.flightCount,
          ferry_count: c.convenience.ferryCount,
          total_travel_hours: (() => {
            const m = c.convenience.totalTravelMinutes;
            if (m === 0) return '—';
            const h = Math.floor(m / 60);
            const mins = m % 60;
            return h > 0 ? `${h}h ${mins}m` : `${mins}m`;
          })(),
        })),
        offset: res.totalOffset,
      } as CompareData;
    },
    enabled: !!tripId,
  });
}

export function usePickWinner(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeId: string) =>
      api.patch(`/api/trips/${tripId}/routes/${routeId}`, { status: 'winner' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: routeKeys.all(tripId) });
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'compare'] });
    },
  });
}

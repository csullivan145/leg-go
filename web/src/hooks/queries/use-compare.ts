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
    queryFn: () => api.get<CompareData>(`/api/trips/${tripId}/compare`),
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

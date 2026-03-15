import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface BudgetCategory {
  flights: number;
  accommodation: number;
  transport: number;
  car_rental: number;
  activities: number;
}

export interface BudgetLocation {
  name: string;
  nights: number;
  accommodation: number;
  transport: number;
  total: number;
}

export interface BudgetRoute {
  id: string;
  name: string;
  status: string;
}

export interface BudgetSummary {
  trip_total: number;
  offset: number;
  out_of_pocket: number;
  by_category: BudgetCategory;
  by_location: BudgetLocation[];
  selected_route: BudgetRoute;
  routes: BudgetRoute[];
}

export function useBudget(tripId: string, routeId?: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'budget', routeId ?? 'default'],
    queryFn: async () => {
      const url = routeId
        ? `/api/trips/${tripId}/budget?routeId=${routeId}`
        : `/api/trips/${tripId}/budget`;
      const res = await api.get<{ budget: {
        tripTotal: number;
        offset: number;
        outOfPocket: number;
        byCategory: { flights: number; inRegionTransport: number; accommodation: number; carRental: number; activities: number };
        byLocation: Array<{ name: string | null; nights: number; accommodation: number; carRental: number; dayTrips: number; total: number }>;
        route: { id: string; name: string; status: string };
        routes: Array<{ id: string; name: string; status: string }>;
      } }>(url);
      const b = res.budget;
      return {
        trip_total: b.tripTotal,
        offset: b.offset,
        out_of_pocket: b.outOfPocket,
        by_category: {
          flights: b.byCategory.flights,
          transport: b.byCategory.inRegionTransport,
          accommodation: b.byCategory.accommodation,
          car_rental: b.byCategory.carRental,
          activities: b.byCategory.activities,
        },
        by_location: b.byLocation.map((loc) => ({
          name: loc.name ?? 'Unknown',
          nights: loc.nights,
          accommodation: loc.accommodation,
          transport: loc.carRental + loc.dayTrips,
          total: loc.total,
        })),
        selected_route: b.route,
        routes: b.routes,
      } as BudgetSummary;
    },
    enabled: !!tripId,
  });
}

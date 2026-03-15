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

export interface BudgetSummary {
  trip_total: number;
  offset: number;
  out_of_pocket: number;
  by_category: BudgetCategory;
  by_location: BudgetLocation[];
}

export function useBudget(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'budget'],
    queryFn: () => api.get<BudgetSummary>(`/api/trips/${tripId}/budget`),
    enabled: !!tripId,
  });
}

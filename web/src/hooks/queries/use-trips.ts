import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Trip } from '@leg-go/shared';

export const tripKeys = {
  all: ['trips'] as const,
  detail: (id: string) => ['trips', id] as const,
};

export function useTrips() {
  return useQuery({
    queryKey: tripKeys.all,
    queryFn: () => api.get<{ trips: Trip[] }>('/api/trips').then((r) => r.trips),
  });
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: () => api.get<{ trip: Trip; routes: unknown[]; role: string }>(`/api/trips/${id}`).then((r) => ({ ...r.trip, routes: r.routes, role: r.role })),
    enabled: !!id,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Trip>) => api.post<Trip>('/api/trips', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
}

export function useUpdateTrip(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Trip>) => api.patch<Trip>(`/api/trips/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tripKeys.all });
      qc.invalidateQueries({ queryKey: tripKeys.detail(id) });
    },
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/trips/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.all }),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Route } from '@leg-go/shared';

export const routeKeys = {
  all: (tripId: string) => ['trips', tripId, 'routes'] as const,
  detail: (tripId: string, routeId: string) => ['trips', tripId, 'routes', routeId] as const,
};

export function useRoutes(tripId: string) {
  return useQuery({
    queryKey: routeKeys.all(tripId),
    queryFn: () => api.get<Route[]>(`/api/trips/${tripId}/routes`),
    enabled: !!tripId,
  });
}

export function useRoute(tripId: string, routeId: string) {
  return useQuery({
    queryKey: routeKeys.detail(tripId, routeId),
    queryFn: () => api.get<Route & { legs: unknown[] }>(`/api/trips/${tripId}/routes/${routeId}`),
    enabled: !!tripId && !!routeId,
  });
}

export function useCreateRoute(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      api.post<Route>(`/api/trips/${tripId}/routes`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: routeKeys.all(tripId) }),
  });
}

export function useUpdateRoute(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, ...body }: { routeId: string } & Partial<Route>) =>
      api.patch<Route>(`/api/trips/${tripId}/routes/${routeId}`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: routeKeys.all(tripId) });
      qc.invalidateQueries({ queryKey: routeKeys.detail(tripId, vars.routeId) });
    },
  });
}

export function useDeleteRoute(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeId: string) => api.delete(`/api/trips/${tripId}/routes/${routeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: routeKeys.all(tripId) }),
  });
}

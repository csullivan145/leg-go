import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TripOffset {
  id: string;
  trip_id: string;
  amount: number;
  description: string;
}

export function useOffsets(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'offsets'],
    queryFn: () => api.get<{ offsets: TripOffset[] }>(`/api/trips/${tripId}/offsets`).then((r) => r.offsets),
    enabled: !!tripId,
  });
}

export function useCreateOffset(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { amount: number; description: string }) =>
      api.post(`/api/trips/${tripId}/offsets`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'offsets'] });
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'budget'] });
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'compare'] });
    },
  });
}

export function useUpdateOffset(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ offsetId, ...body }: { offsetId: string; amount?: number; description?: string }) =>
      api.patch(`/api/offsets/${offsetId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'offsets'] });
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'budget'] });
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'compare'] });
    },
  });
}

export function useDeleteOffset(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offsetId: string) => api.delete(`/api/offsets/${offsetId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'offsets'] });
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'budget'] });
      qc.invalidateQueries({ queryKey: ['trips', tripId, 'compare'] });
    },
  });
}

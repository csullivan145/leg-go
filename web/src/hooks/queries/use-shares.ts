import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TripShare } from '@leg-go/shared';

export interface ShareWithUser extends TripShare {
  user: { id: string; name: string; email: string; avatar_url: string | null };
}

const shareKeys = {
  all: (tripId: string) => ['trips', tripId, 'shares'] as const,
};

export function useShares(tripId: string) {
  return useQuery({
    queryKey: shareKeys.all(tripId),
    queryFn: () => api.get<{ shares: ShareWithUser[] }>(`/api/trips/${tripId}/shares`).then((r) => r.shares),
    enabled: !!tripId,
  });
}

export function useCreateShare(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: 'viewer' | 'editor' }) =>
      api.post<TripShare>(`/api/trips/${tripId}/shares`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.all(tripId) }),
  });
}

export function useUpdateShare(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shareId, role }: { shareId: string; role: 'viewer' | 'editor' }) =>
      api.patch<TripShare>(`/api/shares/${shareId}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.all(tripId) }),
  });
}

export function useDeleteShare(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => api.delete(`/api/shares/${shareId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.all(tripId) }),
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { LegPayment } from '@leg-go/shared';
import { routeKeys } from './use-routes';

export function useCreatePayment(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ legId, ...body }: { legId: string; amount: number; date: string; note?: string | null }) =>
      api.post<LegPayment>(`/api/legs/${legId}/payments`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: routeKeys.detail(tripId, routeId) });
      qc.invalidateQueries({ queryKey: routeKeys.all(tripId) });
    },
  });
}

export function useDeletePayment(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => api.delete(`/api/payments/${paymentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: routeKeys.detail(tripId, routeId) });
      qc.invalidateQueries({ queryKey: routeKeys.all(tripId) });
    },
  });
}

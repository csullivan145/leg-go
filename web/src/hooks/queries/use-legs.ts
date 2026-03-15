import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Leg, Accommodation, DayTrip, Activity, CarRental } from '@leg-go/shared';
import { routeKeys } from './use-routes';

function invalidateRoute(qc: ReturnType<typeof useQueryClient>, tripId: string, routeId: string) {
  qc.invalidateQueries({ queryKey: routeKeys.detail(tripId, routeId) });
  qc.invalidateQueries({ queryKey: routeKeys.all(tripId) });
}

export function useCreateLeg(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Leg>) => api.post<Leg>(`/api/routes/${routeId}/legs`, body),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

export function useUpdateLeg(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ legId, ...body }: { legId: string } & Partial<Leg>) =>
      api.patch<Leg>(`/api/legs/${legId}`, body),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

export function useDeleteLeg(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (legId: string) => api.delete(`/api/legs/${legId}`),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

export function useReorderLeg(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ legId, order }: { legId: string; order: number }) =>
      api.post(`/api/legs/${legId}/reorder`, { order }),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

// Accommodation
export function useUpsertAccommodation(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ legId, ...body }: { legId: string } & Partial<Accommodation>) =>
      api.post<Accommodation>(`/api/legs/${legId}/accommodation`, body),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

export function useUpdateAccommodation(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accommodationId, ...body }: { accommodationId: string } & Partial<Accommodation>) =>
      api.patch<Accommodation>(`/api/accommodation/${accommodationId}`, body),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

// Day trips
export function useCreateDayTrip(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ legId, ...body }: { legId: string } & Partial<DayTrip>) =>
      api.post<DayTrip>(`/api/legs/${legId}/daytrips`, body),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

export function useUpdateDayTrip(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dayTripId, ...body }: { dayTripId: string } & Partial<DayTrip>) =>
      api.patch<DayTrip>(`/api/daytrips/${dayTripId}`, body),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

export function useDeleteDayTrip(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dayTripId: string) => api.delete(`/api/daytrips/${dayTripId}`),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

// Activities
export function useCreateActivity(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ legId, ...body }: { legId: string } & Partial<Activity>) =>
      api.post<Activity>(`/api/legs/${legId}/activities`, body),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

export function useUpdateActivity(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, ...body }: { activityId: string } & Partial<Activity>) =>
      api.patch<Activity>(`/api/activities/${activityId}`, body),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

export function useDeleteActivity(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (activityId: string) => api.delete(`/api/activities/${activityId}`),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

// Car rentals
export function useCreateCarRental(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ legId, ...body }: { legId: string } & Partial<CarRental>) =>
      api.post<CarRental>(`/api/legs/${legId}/carrental`, body),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

export function useUpdateCarRental(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ carRentalId, ...body }: { carRentalId: string } & Partial<CarRental>) =>
      api.patch<CarRental>(`/api/carrental/${carRentalId}`, body),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

export function useDeleteCarRental(tripId: string, routeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (carRentalId: string) => api.delete(`/api/carrental/${carRentalId}`),
    onSuccess: () => invalidateRoute(qc, tripId, routeId),
  });
}

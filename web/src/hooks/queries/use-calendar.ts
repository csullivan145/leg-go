import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type CalendarEventType = 'travel' | 'check_in' | 'check_out' | 'day_trip' | 'activity' | 'idea';

export interface CalendarEvent {
  type: CalendarEventType;
  label: string;
  status?: string;
  time?: string;
  booking_id?: string;
  company?: string;
  duration?: string;
  amenities?: string[];
  address?: string;
  transport_type?: 'flight' | 'train' | 'ferry' | 'car' | 'bus' | null;
  cost?: number | null;
}

export interface CalendarDay {
  date: string;
  location: string | null;
  is_transition: boolean;
  events: CalendarEvent[];
}

export type CalendarData = CalendarDay[];

export function useCalendar(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'calendar'],
    queryFn: () => api.get<{ calendar: CalendarData }>(`/api/trips/${tripId}/calendar`).then((r) => r.calendar),
    enabled: !!tripId,
  });
}

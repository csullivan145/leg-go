import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  format,
  isSameDay,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { useCalendar } from '@/hooks/queries/use-calendar';
import { cn } from '@/lib/utils';
import type { CalendarDay, CalendarEvent } from '@/hooks/queries/use-calendar';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function eventPillClass(type: CalendarEvent['type'], status?: string): string {
  if (type === 'travel') return 'bg-red-100 text-red-800 border-red-200';
  if (type === 'check_in' || type === 'check_out') return 'bg-green-100 text-green-800 border-green-200';
  if (type === 'day_trip') {
    if (status === 'idea') return 'border border-dashed border-gray-400 text-gray-600 bg-transparent';
    return 'bg-orange-100 text-orange-800 border-orange-200';
  }
  if (type === 'activity') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (type === 'idea') return 'border border-dashed border-gray-400 text-gray-600 bg-transparent';
  return 'bg-gray-100 text-gray-700';
}

function CalendarCell({
  day,
  calendarDay,
  tripId,
}: {
  day: Date;
  calendarDay?: CalendarDay;
  tripId: string;
}) {
  const dateStr = format(day, 'yyyy-MM-dd');
  const isTransition = calendarDay?.is_transition ?? false;
  const events = calendarDay?.events ?? [];

  return (
    <Link
      to={`/trips/${tripId}/calendar/${dateStr}`}
      className={cn(
        'block min-h-[80px] p-1.5 border border-border rounded-lg hover:bg-accent/50 transition-colors',
        isTransition && 'bg-yellow-50',
      )}
    >
      <div className="text-xs font-medium mb-1 text-muted-foreground">{format(day, 'd')}</div>
      {calendarDay?.location && (
        <div className="text-xs text-muted-foreground truncate mb-1">{calendarDay.location}</div>
      )}
      <div className="space-y-0.5">
        {events.slice(0, 3).map((ev, i) => (
          <div
            key={i}
            className={cn(
              'text-xs px-1.5 py-0.5 rounded border truncate',
              eventPillClass(ev.type, ev.status),
            )}
          >
            {ev.label}
          </div>
        ))}
        {events.length > 3 && (
          <div className="text-xs text-muted-foreground pl-1">+{events.length - 3} more</div>
        )}
      </div>
    </Link>
  );
}

export default function CalendarPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const { data: calendarData, isLoading } = useCalendar(tripId!);

  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });

  const calendarByDate = new Map<string, CalendarDay>();
  calendarData?.forEach((d) => calendarByDate.set(d.date, d));

  const currentLocation = days
    .map((d) => calendarByDate.get(format(d, 'yyyy-MM-dd'))?.location)
    .find(Boolean);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to={`/trips/${tripId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Trip
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Calendar</h1>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-semibold text-sm">{currentLocation || 'No location'}</p>
          <p className="text-xs text-muted-foreground">
            {format(weekStart, 'MMM d')} – {format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const calDay = calendarByDate.get(dateStr);
              return (
                <CalendarCell key={dateStr} day={day} calendarDay={calDay} tripId={tripId!} />
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" />
              Travel
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" />
              Check-in/out
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-orange-100 border border-orange-200 inline-block" />
              Day trip
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-100 border border-blue-200 inline-block" />
              Activity
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-dashed border-gray-400 inline-block" />
              Idea
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-yellow-50 border border-yellow-200 inline-block" />
              Transition
            </span>
          </div>
        </>
      )}
    </div>
  );
}

import { Link, useParams } from 'react-router';
import { ArrowLeft, Plane, Clock, MapPin, WashingMachine, UtensilsCrossed, Car, Calendar, Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCalendar } from '@/hooks/queries/use-calendar';
import { cn } from '@/lib/utils';
import type { CalendarDay, CalendarEvent } from '@/hooks/queries/use-calendar';

const amenityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  washer: WashingMachine,
  kitchen: UtensilsCrossed,
  parking: Car,
};

function EventSection({ title, events, type }: { title: string; events: CalendarEvent[]; type: string }) {
  const filtered = events.filter((e) => e.type === type || (type === 'check' && (e.type === 'check_in' || e.type === 'check_out')));
  if (filtered.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-2">
        {filtered.map((ev, i) => (
          <Card key={i}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm">{ev.label}</p>
                {ev.status && (
                  <Badge variant="outline" className={cn('text-xs', ev.status === 'confirmed' ? 'border-orange-400 text-orange-600' : 'border-dashed')}>
                    {ev.status}
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {ev.time && <span><Clock className="h-3 w-3 inline mr-0.5" />{ev.time}</span>}
                {ev.duration && <span>Duration: {ev.duration}</span>}
                {ev.company && <span>· {ev.company}</span>}
                {ev.booking_id && <span>· #{ev.booking_id}</span>}
                {ev.address && <span><MapPin className="h-3 w-3 inline mr-0.5" />{ev.address}</span>}
              </div>
              {ev.amenities && ev.amenities.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {ev.amenities.map((a) => {
                    const Icon = amenityIcons[a];
                    return Icon ? (
                      <span key={a} className="flex items-center gap-0.5 text-xs text-muted-foreground capitalize">
                        <Icon className="h-3 w-3" />{a}
                      </span>
                    ) : (
                      <span key={a} className="text-xs text-muted-foreground capitalize">{a}</span>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DayDetailPage() {
  const { tripId, date } = useParams<{ tripId: string; date: string }>();
  const { data: calendarData, isLoading } = useCalendar(tripId!);

  const calDay = calendarData?.find((d) => d.date === date);
  const parsedDate = date ? parseISO(date) : new Date();

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );

  const events = calDay?.events ?? [];
  const travelEvents = events.filter((e) => e.type === 'travel');
  const checkEvents = events.filter((e) => e.type === 'check_in' || e.type === 'check_out');
  const dayTripEvents = events.filter((e) => e.type === 'day_trip' || e.type === 'idea');
  const activityEvents = events.filter((e) => e.type === 'activity');

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
        <Link to={`/trips/${tripId}/calendar`}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Calendar
        </Link>
      </Button>

      {/* Location banner */}
      <div
        className={cn(
          'rounded-xl p-4 mb-6 text-white',
          calDay?.is_transition
            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
            : 'bg-gradient-to-r from-primary to-primary/80',
        )}
      >
        <p className="text-sm font-medium opacity-80">{format(parsedDate, 'EEEE, MMMM d, yyyy')}</p>
        <p className="text-xl font-bold mt-0.5">{calDay?.location ?? 'No location'}</p>
        {calDay?.is_transition && (
          <Badge className="mt-1 bg-white/20 text-white border-0 text-xs">Transition Day</Badge>
        )}
      </div>

      {events.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">Nothing scheduled for this day.</p>
      ) : (
        <div className="space-y-5">
          {travelEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Travel</h3>
              <div className="space-y-2">
                {travelEvents.map((ev, i) => (
                  <Card key={i}>
                    <CardContent className="py-3 px-4">
                      <p className="font-medium text-sm">{ev.label}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {ev.time && <span><Clock className="h-3 w-3 inline mr-0.5" />{ev.time}</span>}
                        {ev.duration && <span>· {ev.duration}</span>}
                        {ev.company && <span>· {ev.company}</span>}
                        {ev.booking_id && <span>· #{ev.booking_id}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {checkEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Accommodation</h3>
              <div className="space-y-2">
                {checkEvents.map((ev, i) => (
                  <Card key={i}>
                    <CardContent className="py-3 px-4">
                      <p className="font-medium text-sm">{ev.label}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {ev.time && <span><Clock className="h-3 w-3 inline mr-0.5" />{ev.time}</span>}
                        {ev.address && <span><MapPin className="h-3 w-3 inline mr-0.5" />{ev.address}</span>}
                      </div>
                      {ev.amenities && ev.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {ev.amenities.map((a) => {
                            const Icon = amenityIcons[a];
                            return (
                              <span key={a} className="flex items-center gap-0.5 text-xs text-muted-foreground capitalize">
                                {Icon ? <Icon className="h-3 w-3" /> : null}{a}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {dayTripEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Day Trips</h3>
              <div className="space-y-2">
                {dayTripEvents.map((ev, i) => (
                  <Card key={i}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{ev.label}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            ev.status === 'confirmed' ? 'border-orange-400 text-orange-600' : 'border-dashed',
                          )}
                        >
                          {ev.status ?? 'idea'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activityEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Activities</h3>
              <div className="space-y-2">
                {activityEvents.map((ev, i) => (
                  <Card key={i}>
                    <CardContent className="py-3 px-4">
                      <p className="font-medium text-sm">{ev.label}</p>
                      {ev.time && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3 inline mr-0.5" />{ev.time}
                        </p>
                      )}
                      {ev.booking_id && (
                        <p className="text-xs text-muted-foreground mt-0.5">Booking: #{ev.booking_id}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

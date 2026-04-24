import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Plus,
  Plane,
  Train,
  Ship,
  Car,
  Bus,
  ChevronDown,
  ChevronUp,
  Trash2,
  MapPin,
  List,
  CalendarDays,
  Copy,
  AlertTriangle,
  Map,
  Trophy,
  Lock,
  LockOpen,
  CircleCheck,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { useRoute, useRoutes, useDeleteRoute, useUpdateRoute } from '@/hooks/queries/use-routes';
import { useOffsets } from '@/hooks/queries/use-offsets';
import { useTrip } from '@/hooks/queries/use-trips';
import { RouteTimeline } from '@/components/route-timeline';
import { CurrencyConverter } from '@/components/currency-converter';
import { PlaceAutocomplete } from '@/components/place-autocomplete';
import { BookingDrop, type BookingDropResult } from '@/components/booking-drop';
import { RouteMap } from '@/components/route-map';
import { PaymentsSection } from '@/components/payments-section';
import {
  useCreateLeg,
  useUpdateLeg,
  useDeleteLeg,
  useUpsertAccommodation,
  useCreateDayTrip,
  useUpdateDayTrip,
  useDeleteDayTrip,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
  useCopyLeg,
} from '@/hooks/queries/use-legs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Leg, Accommodation, DayTrip, Activity, LegPayment, TransportType } from '@leg-go/shared';

const transportIcons: Record<TransportType, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  train: Train,
  ferry: Ship,
  car: Car,
  bus: Bus,
};

const transportLabels: Record<TransportType, string> = {
  flight: 'Flight',
  train: 'Train',
  ferry: 'Ferry',
  car: 'Car',
  bus: 'Bus',
};

function getNights(l: { nights?: number | null; start_date?: string | null; end_date?: string | null }) {
  if (l.nights != null && l.nights > 0) return l.nights;
  if (l.start_date && l.end_date) {
    const diff = differenceInDays(parseISO(l.end_date), parseISO(l.start_date));
    return diff > 0 ? diff : 0;
  }
  return 0;
}

function getLocationDateWarning(
  prev: { name?: string | null; end_date?: string | null },
  curr: { name?: string | null; start_date?: string | null },
): { kind: 'gap' | 'overlap'; days: number; message: string } | null {
  if (!prev.end_date || !curr.start_date) return null;
  const diff = differenceInDays(parseISO(curr.start_date), parseISO(prev.end_date));
  const prevName = prev.name || 'previous stop';
  const currName = curr.name || 'next stop';
  if (diff > 0) {
    return {
      kind: 'gap',
      days: diff,
      message: `Missing ${diff} day${diff === 1 ? '' : 's'} between ${prevName} and ${currName} — extend one of these stays or add a stop`,
    };
  }
  if (diff < 0) {
    const overlap = Math.abs(diff);
    return {
      kind: 'overlap',
      days: overlap,
      message: `${overlap}-day overlap between ${prevName} and ${currName} — one of these is too long`,
    };
  }
  return null;
}

function getTravelDateWarning(
  travel: { name?: string | null; start_date?: string | null; end_date?: string | null },
  prev: { name?: string | null; end_date?: string | null } | null,
  next: { name?: string | null; start_date?: string | null } | null,
): { message: string } | null {
  if (!travel.start_date) return null;
  const travelName = travel.name || 'Travel';
  if (prev?.end_date && travel.start_date !== prev.end_date) {
    const diff = differenceInDays(parseISO(travel.start_date), parseISO(prev.end_date));
    const prevName = prev.name || 'the previous stop';
    if (diff > 0) {
      return {
        message: `${travelName} departs ${diff} day${diff === 1 ? '' : 's'} after ${prevName} ends`,
      };
    }
    if (diff < 0) {
      return {
        message: `${travelName} departs before ${prevName} ends`,
      };
    }
  }
  const arrivalDate = travel.end_date ?? travel.start_date;
  if (next?.start_date && arrivalDate && arrivalDate !== next.start_date) {
    const diff = differenceInDays(parseISO(next.start_date), parseISO(arrivalDate));
    const nextName = next.name || 'the next stop';
    if (diff > 0) {
      return {
        message: `${travelName} arrives ${diff} day${diff === 1 ? '' : 's'} before ${nextName} begins`,
      };
    }
    if (diff < 0) {
      return {
        message: `${travelName} arrives after ${nextName} begins`,
      };
    }
  }
  return null;
}

interface LegWithDetails extends Leg {
  accommodation?: Accommodation | null;
  day_trips?: DayTrip[];
  activities?: Activity[];
  payments?: LegPayment[];
}

interface RouteDetail {
  id: string;
  name: string;
  status: string;
  legs: LegWithDetails[];
}

function CopyToRouteMenu({
  legId,
  tripId,
  routeId,
  otherRoutes,
}: {
  legId: string;
  tripId: string;
  routeId: string;
  otherRoutes: { id: string; name: string }[];
}) {
  const copyLeg = useCopyLeg(tripId, routeId);

  if (otherRoutes.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Copy to route">
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {otherRoutes.map((r) => (
          <DropdownMenuItem
            key={r.id}
            onClick={() => copyLeg.mutate({ legId, targetRouteIds: [r.id] })}
          >
            Copy to {r.name}
          </DropdownMenuItem>
        ))}
        {otherRoutes.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => copyLeg.mutate({ legId, targetRouteIds: otherRoutes.map((r) => r.id) })}
            >
              Copy to all routes
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotesField({
  register,
  hasExistingNote,
}: {
  register: ReturnType<ReturnType<typeof useForm>['register']>;
  hasExistingNote: boolean;
}) {
  const [open, setOpen] = useState(hasExistingNote);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-dashed border-border/60 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add note
      </button>
    );
  }

  return (
    <div>
      <Label className="text-xs">Notes</Label>
      <Textarea className="text-sm min-h-0 h-14" {...register} />
    </div>
  );
}

function DayTripRow({
  dayTrip,
  tripId,
  routeId,
}: {
  dayTrip: DayTrip;
  tripId: string;
  routeId: string;
}) {
  const [editing, setEditing] = useState(false);
  const updateDayTrip = useUpdateDayTrip(tripId, routeId);
  const deleteDayTrip = useDeleteDayTrip(tripId, routeId);
  const form = useForm({
    defaultValues: {
      destination_name: dayTrip.destination_name,
      date: dayTrip.date ?? '',
      status: dayTrip.status,
    },
  });

  if (editing) {
    return (
      <form
        onSubmit={form.handleSubmit(async (v) => {
          await updateDayTrip.mutateAsync({ dayTripId: dayTrip.id, ...v } as never);
          setEditing(false);
        })}
        className="flex flex-wrap gap-2 py-1.5 border-b border-border/40 items-center"
      >
        <Input
          className="h-8 text-sm flex-1 min-w-32"
          placeholder="Destination"
          autoFocus
          {...form.register('destination_name', { required: true })}
        />
        <Input className="h-8 text-sm w-36" type="date" {...form.register('date')} />
        <Select
          value={form.watch('status')}
          onValueChange={(v) => form.setValue('status', v as 'idea' | 'confirmed')}
        >
          <SelectTrigger className="h-8 w-28 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="idea">Idea</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" variant="outline" disabled={updateDayTrip.isPending}>
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            form.reset({
              destination_name: dayTrip.destination_name,
              date: dayTrip.date ?? '',
              status: dayTrip.status,
            });
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-border/40">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-left hover:text-primary transition-colors"
      >
        {dayTrip.destination_name}
        {dayTrip.date && ` · ${format(parseISO(dayTrip.date), 'MMM d')}`}
      </button>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            dayTrip.status === 'confirmed' ? 'border-primary/40 text-primary' : 'border-dashed',
          )}
        >
          {dayTrip.status}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive"
          onClick={() => deleteDayTrip.mutate(dayTrip.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
  tripId,
  routeId,
}: {
  activity: Activity;
  tripId: string;
  routeId: string;
}) {
  const [editing, setEditing] = useState(false);
  const updateActivity = useUpdateActivity(tripId, routeId);
  const deleteActivity = useDeleteActivity(tripId, routeId);
  const form = useForm({
    defaultValues: {
      name: activity.name,
      date: activity.date ?? '',
      time: activity.time ?? '',
    },
  });

  if (editing) {
    return (
      <form
        onSubmit={form.handleSubmit(async (v) => {
          await updateActivity.mutateAsync({
            activityId: activity.id,
            name: v.name,
            date: v.date || null,
            time: v.time || null,
          } as never);
          setEditing(false);
        })}
        className="flex flex-wrap gap-2 py-1.5 border-b border-border/40 items-center"
      >
        <Input
          className="h-8 text-sm flex-1 min-w-32"
          placeholder="Activity name"
          autoFocus
          {...form.register('name', { required: true })}
        />
        <Input className="h-8 text-sm w-36" type="date" {...form.register('date')} />
        <Input className="h-8 text-sm w-28" type="time" {...form.register('time')} />
        <Button type="submit" size="sm" variant="outline" disabled={updateActivity.isPending}>
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            form.reset({
              name: activity.name,
              date: activity.date ?? '',
              time: activity.time ?? '',
            });
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-border/40">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-left hover:text-primary transition-colors"
      >
        {activity.name}
        {activity.date && ` · ${format(parseISO(activity.date), 'MMM d')}`}
        {activity.time && ` at ${activity.time}`}
      </button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-destructive"
        onClick={() => deleteActivity.mutate(activity.id)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

function TravelLegCard({
  leg,
  tripId,
  routeId,
  index,
  otherRoutes,
  confirmedMode = false,
}: {
  leg: LegWithDetails;
  tripId: string;
  routeId: string;
  index: number;
  otherRoutes: { id: string; name: string }[];
  confirmedMode?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const updateLeg = useUpdateLeg(tripId, routeId);
  const deleteLeg = useDeleteLeg(tripId, routeId);
  const locked = confirmedMode && leg.purchased;

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      transport_type: leg.transport_type ?? 'flight',
      cost: leg.cost ?? 0,
      duration: leg.duration ?? '',
      stops: leg.stops ?? '',
      company: leg.company ?? '',
      booking_id: leg.booking_id ?? '',
      start_date: leg.start_date ?? '',
      end_date: leg.end_date ?? '',
      departure_time: leg.departure_time ?? '',
      arrival_time: leg.arrival_time ?? '',
      departure_location: leg.departure_location ?? '',
      arrival_location: leg.arrival_location ?? '',
      notes: leg.notes ?? '',
    },
  });

  const transportType = watch('transport_type') as TransportType;
  const Icon = transportIcons[transportType] ?? Plane;

  const onSubmit = async (values: Record<string, unknown>) => {
    await updateLeg.mutateAsync({
      legId: leg.id,
      ...values,
      cost: values.cost ? Number(values.cost) : null,
      stops: values.stops ? Number(values.stops) : null,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
    } as never);
    setExpanded(false);
  };

  return (
    <div className="relative flex justify-center my-2 pl-11">
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-all',
          locked
            ? 'bg-primary/10 border-primary/40 text-foreground'
            : leg.transport_type
              ? 'bg-card border-border/60 hover:border-primary/30'
              : 'border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/40',
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{leg.transport_type ? transportLabels[leg.transport_type] : 'Travel'}</span>
        {leg.cost != null && <span className="text-muted-foreground tabular-nums">${leg.cost.toLocaleString()}</span>}
        {leg.duration && <span className="text-muted-foreground">· {leg.duration}</span>}
        {locked && <Lock className="h-3 w-3 text-primary" />}
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </div>

      {expanded && (
        <Card className="absolute top-full mt-2 z-10 w-full max-w-lg shadow-lg border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {locked && <Lock className="h-3.5 w-3.5 text-primary" />}
              {locked ? 'Booked — locked' : 'Edit Travel Leg'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <fieldset disabled={locked} className="contents">
              <BookingDrop
                onExtracted={(data) => {
                  const opts = { shouldDirty: true, shouldTouch: true } as const;
                  if (data.transport_type) setValue('transport_type', data.transport_type, opts);
                  if (data.cost != null) setValue('cost', data.cost as never, opts);
                  if (data.duration) setValue('duration', data.duration, opts);
                  if (data.stops != null) setValue('stops', data.stops as never, opts);
                  if (data.company) setValue('company', data.company, opts);
                  if (data.booking_id) setValue('booking_id', data.booking_id, opts);
                  if (data.start_date) setValue('start_date', data.start_date, opts);
                  if (data.end_date) setValue('end_date', data.end_date, opts);
                  if (data.departure_time) setValue('departure_time', data.departure_time, opts);
                  if (data.arrival_time) setValue('arrival_time', data.arrival_time, opts);
                  if (data.departure_location) setValue('departure_location', data.departure_location, opts);
                  if (data.arrival_location) setValue('arrival_location', data.arrival_location, opts);
                }}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Transport Type *</Label>
                  <Select
                    value={transportType}
                    onValueChange={(v) => setValue('transport_type', v as TransportType)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(transportLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Cost ($) *</Label>
                  <div className="flex items-center gap-1">
                    <Input className="h-8 text-sm" type="number" step="0.01" {...register('cost')} />
                    <CurrencyConverter
                      onConvert={(usd) => setValue('cost', usd)}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Departure Date</Label>
                  <Input className="h-8 text-sm" type="date" {...register('start_date')} />
                </div>
                <div>
                  <Label className="text-xs">Arrival Date</Label>
                  <Input className="h-8 text-sm" type="date" {...register('end_date')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Departure Time</Label>
                  <Input className="h-8 text-sm" type="time" {...register('departure_time')} />
                </div>
                <div>
                  <Label className="text-xs">Arrival Time</Label>
                  <Input className="h-8 text-sm" type="time" {...register('arrival_time')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Duration</Label>
                  <Input className="h-8 text-sm" placeholder="2h 30min" {...register('duration')} />
                </div>
                <div>
                  <Label className="text-xs">Stops</Label>
                  <Input className="h-8 text-sm" type="number" {...register('stops')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Company</Label>
                  <Input className="h-8 text-sm" placeholder="e.g. SeaJets" {...register('company')} />
                </div>
                <div>
                  <Label className="text-xs">Booking ID</Label>
                  <Input className="h-8 text-sm" placeholder="FQ45NXCM8" {...register('booking_id')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">From</Label>
                  <Input className="h-8 text-sm" placeholder="Airport/station" {...register('departure_location')} />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input className="h-8 text-sm" placeholder="Airport/station" {...register('arrival_location')} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea className="text-sm min-h-0 h-16" {...register('notes')} />
              </div>
              </fieldset>
              <PaymentsSection
                legId={leg.id}
                tripId={tripId}
                routeId={routeId}
                payments={leg.payments ?? []}
                totalCost={leg.cost ?? null}
              />
              <div className="flex gap-2 justify-end items-center flex-wrap">
                {confirmedMode && (
                  <Button
                    type="button"
                    variant={locked ? 'outline' : 'secondary'}
                    size="sm"
                    onClick={async () => {
                      if (leg.purchased) {
                        await updateLeg.mutateAsync({ legId: leg.id, purchased: false } as never);
                      } else {
                        await handleSubmit(async (values) => {
                          await updateLeg.mutateAsync({
                            legId: leg.id,
                            ...values,
                            cost: values.cost ? Number(values.cost) : null,
                            stops: values.stops ? Number(values.stops) : null,
                            start_date: values.start_date || null,
                            end_date: values.end_date || null,
                            purchased: true,
                          } as never);
                        })();
                        setExpanded(false);
                      }
                    }}
                    disabled={updateLeg.isPending}
                    className="mr-auto"
                  >
                    {locked ? (
                      <>
                        <LockOpen className="h-3.5 w-3.5 mr-1" />
                        Unmark booked
                      </>
                    ) : (
                      <>
                        <CircleCheck className="h-3.5 w-3.5 mr-1" />
                        Mark as booked
                      </>
                    )}
                  </Button>
                )}
                {!locked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteLeg.mutate(leg.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {!locked && <CopyToRouteMenu legId={leg.id} tripId={tripId} routeId={routeId} otherRoutes={otherRoutes} />}
                <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(false)}>
                  {locked ? 'Close' : 'Cancel'}
                </Button>
                {!locked && (
                  <Button type="submit" size="sm" disabled={updateLeg.isPending}>
                    Save
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LocationLegCard({
  leg,
  tripId,
  routeId,
  index,
  defaultExpanded = false,
  otherRoutes,
  confirmedMode = false,
}: {
  leg: LegWithDetails;
  tripId: string;
  routeId: string;
  index: number;
  defaultExpanded?: boolean;
  otherRoutes: { id: string; name: string }[];
  confirmedMode?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const updateLeg = useUpdateLeg(tripId, routeId);
  const deleteLeg = useDeleteLeg(tripId, routeId);
  const locked = confirmedMode && leg.purchased;
  const upsertAccommodation = useUpsertAccommodation(tripId, routeId);
  const createDayTrip = useCreateDayTrip(tripId, routeId);
  const deleteDayTrip = useDeleteDayTrip(tripId, routeId);
  const createActivity = useCreateActivity(tripId, routeId);
  const deleteActivity = useDeleteActivity(tripId, routeId);

  const legForm = useForm({
    defaultValues: {
      name: leg.name ?? '',
      start_date: leg.start_date ?? '',
      end_date: leg.end_date ?? '',
      notes: leg.notes ?? '',
      lat: leg.lat ?? null,
      lng: leg.lng ?? null,
      place_id: leg.place_id ?? null,
    },
  });

  const accForm = useForm({
    defaultValues: {
      name: leg.accommodation?.name ?? '',
      address: leg.accommodation?.address ?? '',
      lat: leg.accommodation?.lat ?? null,
      lng: leg.accommodation?.lng ?? null,
      place_id: leg.accommodation?.place_id ?? null,
      cost_per_night: leg.accommodation?.cost_per_night ?? '',
      total_cost: leg.accommodation?.total_cost ?? '',
      check_in_time: leg.accommodation?.check_in_time ?? '',
      check_out_time: leg.accommodation?.check_out_time ?? '',
      amenities: {
        washer: leg.accommodation?.amenities?.includes('washer') ?? false,
        kitchen: leg.accommodation?.amenities?.includes('kitchen') ?? false,
        parking: leg.accommodation?.amenities?.includes('parking') ?? false,
      },
      notes: leg.accommodation?.notes ?? '',
    },
  });

  const dayTripForm = useForm({ defaultValues: { destination_name: '', date: '', status: 'idea' as const } });
  const activityForm = useForm({ defaultValues: { name: '', date: '' } });
  // Live nights count based on current form values (not the saved leg),
  // so cost-per-night <-> total auto-sync works on an unsaved location.
  const getLiveNights = () =>
    getNights({
      nights: leg.nights,
      start_date: legForm.getValues('start_date') || leg.start_date || null,
      end_date: legForm.getValues('end_date') || leg.end_date || null,
    });
  const [addingDayTrip, setAddingDayTrip] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);

  const onSaveLeg = async (values: Record<string, unknown>) => {
    await updateLeg.mutateAsync({ legId: leg.id, ...values } as never);
  };

  const onSaveAccommodation = async (values: Record<string, unknown>) => {
    const amenities: string[] = [];
    const am = values.amenities as Record<string, boolean>;
    if (am.washer) amenities.push('washer');
    if (am.kitchen) amenities.push('kitchen');
    if (am.parking) amenities.push('parking');
    const cpn = values.cost_per_night as number;
    const tc = values.total_cost as number;
    const costPerNight = typeof cpn === 'number' && !isNaN(cpn) ? cpn : null;
    const totalCost = typeof tc === 'number' && !isNaN(tc) ? tc : null;
    await upsertAccommodation.mutateAsync({
      legId: leg.id,
      name: values.name || null,
      address: values.address || null,
      lat: (values.lat as number | null) ?? null,
      lng: (values.lng as number | null) ?? null,
      place_id: (values.place_id as string | null) ?? null,
      cost_per_night: costPerNight,
      total_cost: totalCost,
      check_in_time: values.check_in_time || null,
      check_out_time: values.check_out_time || null,
      amenities,
      notes: values.notes || null,
    } as never);
  };

  return (
    <div className="relative">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
            {index + 1}
          </div>
          <div className="w-px bg-border/60 flex-1 min-h-4" />
        </div>
        <div className={cn(
          'flex-1 py-3 px-4 rounded-xl border bg-card',
          locked ? 'border-primary/40 bg-primary/5' : 'border-border/60',
        )}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {expanded ? (
                <>
                  <PlaceAutocomplete
                    className="h-8 text-base font-semibold"
                    placeholder="Location name"
                    value={legForm.watch('name') ?? ''}
                    onChange={(v) => legForm.setValue('name', v, { shouldDirty: true })}
                    onSelect={(place) => {
                      legForm.setValue('name', place.name, { shouldDirty: true });
                      legForm.setValue('lat', place.lat, { shouldDirty: true });
                      legForm.setValue('lng', place.lng, { shouldDirty: true });
                      legForm.setValue('place_id', place.place_id, { shouldDirty: true });
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <div className="w-36">
                      <DatePicker
                        value={legForm.watch('start_date')}
                        onChange={(date) => legForm.setValue('start_date', date)}
                        placeholder="Start"
                      />
                    </div>
                    <span className="text-muted-foreground text-xs">–</span>
                    <div className="w-36">
                      <DatePicker
                        value={legForm.watch('end_date')}
                        onChange={(date) => legForm.setValue('end_date', date)}
                        placeholder="End"
                      />
                    </div>
                    {leg.nights != null && leg.nights > 0 && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">· {leg.nights} nights</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    {leg.name || 'Unnamed Location'}
                    {locked && <Lock className="h-3.5 w-3.5 text-primary" />}
                  </h3>
                  {leg.start_date && leg.end_date && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(leg.start_date), 'MMM d')} –{' '}
                      {format(parseISO(leg.end_date), 'MMM d, yyyy')}
                      {leg.nights != null && ` · ${leg.nights} nights`}
                    </p>
                  )}
                </>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-muted-foreground shrink-0">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {leg.accommodation && !expanded && (() => {
            const acc = leg.accommodation!;
            const nights = getNights(leg);
            const nightly = acc.cost_per_night ?? (acc.total_cost != null && nights > 0 ? acc.total_cost / nights : null);
            const total = acc.total_cost ?? (acc.cost_per_night != null && nights > 0 ? acc.cost_per_night * nights : null);
            let costLine = '';
            if (nightly != null && total != null) {
              costLine = ` · $${nightly.toLocaleString(undefined, { maximumFractionDigits: 2 })}/night ($${total.toLocaleString(undefined, { maximumFractionDigits: 2 })} total)`;
            } else if (nightly != null) {
              costLine = ` · $${nightly.toLocaleString(undefined, { maximumFractionDigits: 2 })}/night`;
            } else if (total != null) {
              costLine = ` · $${total.toLocaleString(undefined, { maximumFractionDigits: 2 })} total`;
            }
            return (
              <p className="text-xs text-muted-foreground mt-2">
                {acc.name}{costLine}
              </p>
            );
          })()}

          {expanded && (
            <div className="pt-3 space-y-4">
              <fieldset disabled={locked} className="contents">
              <NotesField register={legForm.register('notes')} hasExistingNote={!!leg.notes} />

              <Separator className="bg-border/60" />

              {/* Accommodation */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Accommodation</h4>
                <div className="space-y-3">
                  <BookingDrop
                    onExtracted={(data: BookingDropResult) => {
                      if (data.city) legForm.setValue('name', data.city, { shouldDirty: true });
                      if (data.name) accForm.setValue('name', data.name, { shouldDirty: true });
                      if (data.address) accForm.setValue('address', data.address, { shouldDirty: true });
                      if (data.check_in_time) accForm.setValue('check_in_time', data.check_in_time, { shouldDirty: true });
                      if (data.check_out_time) accForm.setValue('check_out_time', data.check_out_time, { shouldDirty: true });
                      if (data.total_cost != null) accForm.setValue('total_cost', data.total_cost as never, { shouldDirty: true });
                      if (data.cost_per_night != null) accForm.setValue('cost_per_night', data.cost_per_night as never, { shouldDirty: true });
                      if (data.check_in_date) legForm.setValue('start_date', data.check_in_date, { shouldDirty: true });
                      if (data.check_out_date) legForm.setValue('end_date', data.check_out_date, { shouldDirty: true });
                    }}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <PlaceAutocomplete
                        className="h-8 text-sm"
                        placeholder="Airbnb / Hotel name"
                        value={accForm.watch('name') ?? ''}
                        onChange={(v) => accForm.setValue('name', v, { shouldDirty: true })}
                        onSelect={(place) => {
                          accForm.setValue('name', place.name, { shouldDirty: true });
                          accForm.setValue('address', place.address, { shouldDirty: true });
                          accForm.setValue('lat', place.lat, { shouldDirty: true });
                          accForm.setValue('lng', place.lng, { shouldDirty: true });
                          accForm.setValue('place_id', place.place_id, { shouldDirty: true });
                        }}
                        bias={leg.name ?? undefined}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Address</Label>
                      <Input className="h-8 text-sm" {...accForm.register('address')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">$/night</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-8 text-sm"
                          type="number"
                          step="0.01"
                          {...accForm.register('cost_per_night', {
                            valueAsNumber: true,
                            onChange: (e) => {
                              const nights = getLiveNights();
                              const val = parseFloat(e.target.value);
                              if (nights > 0 && !isNaN(val)) {
                                accForm.setValue('total_cost', +(val * nights).toFixed(2), { shouldDirty: true });
                              }
                            },
                          })}
                        />
                        <CurrencyConverter
                          onConvert={(usd) => {
                            accForm.setValue('cost_per_night', usd, { shouldDirty: true });
                            const nights = getLiveNights();
                            if (nights > 0) {
                              accForm.setValue('total_cost', +(usd * nights).toFixed(2), { shouldDirty: true });
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Total cost</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-8 text-sm"
                          type="number"
                          step="0.01"
                          {...accForm.register('total_cost', {
                            valueAsNumber: true,
                            onChange: (e) => {
                              const nights = getLiveNights();
                              const val = parseFloat(e.target.value);
                              if (nights > 0 && !isNaN(val)) {
                                accForm.setValue('cost_per_night', +(val / nights).toFixed(2), { shouldDirty: true });
                              }
                            },
                          })}
                        />
                        <CurrencyConverter
                          onConvert={(usd) => {
                            accForm.setValue('total_cost', usd, { shouldDirty: true });
                            const nights = getLiveNights();
                            if (nights > 0) {
                              accForm.setValue('cost_per_night', +(usd / nights).toFixed(2), { shouldDirty: true });
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Check-in time</Label>
                      <Input className="h-8 text-sm" type="time" {...accForm.register('check_in_time')} />
                    </div>
                    <div>
                      <Label className="text-xs">Check-out time</Label>
                      <Input className="h-8 text-sm" type="time" {...accForm.register('check_out_time')} />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    {(['washer', 'kitchen', 'parking'] as const).map((amenity) => (
                      <label key={amenity} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          {...accForm.register(`amenities.${amenity}`)}
                        />
                        <span className="capitalize">{amenity}</span>
                      </label>
                    ))}
                  </div>
                  <NotesField register={accForm.register('notes')} hasExistingNote={!!leg.accommodation?.notes} />
                </div>
              </div>
              </fieldset>

              <Separator className="bg-border/60" />

              {/* Day trips */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Day Trips</h4>
                {leg.day_trips?.map((dt) => (
                  <DayTripRow key={dt.id} dayTrip={dt} tripId={tripId} routeId={routeId} />
                ))}
                {addingDayTrip ? (
                  <form
                    onSubmit={dayTripForm.handleSubmit(async (v) => {
                      await createDayTrip.mutateAsync({ legId: leg.id, ...v } as never);
                      dayTripForm.reset({ destination_name: '', date: '', status: 'idea' });
                      setAddingDayTrip(false);
                    })}
                    className="flex gap-2 mt-2"
                  >
                    <Input className="h-8 text-sm" placeholder="Destination" autoFocus {...dayTripForm.register('destination_name', { required: true })} />
                    <Input className="h-8 text-sm w-36" type="date" {...dayTripForm.register('date')} />
                    <Button type="submit" size="sm" variant="outline" disabled={createDayTrip.isPending}>
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        dayTripForm.reset({ destination_name: '', date: '', status: 'idea' });
                        setAddingDayTrip(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingDayTrip(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-2 rounded-md border border-dashed border-border/60 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add day trip
                  </button>
                )}
              </div>

              <Separator className="bg-border/60" />

              {/* Activities */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Activities</h4>
                {leg.activities?.map((act) => (
                  <ActivityRow key={act.id} activity={act} tripId={tripId} routeId={routeId} />
                ))}
                {addingActivity ? (
                  <form
                    onSubmit={activityForm.handleSubmit(async (v) => {
                      await createActivity.mutateAsync({ legId: leg.id, ...v } as never);
                      activityForm.reset({ name: '', date: '' });
                      setAddingActivity(false);
                    })}
                    className="flex gap-2 mt-2"
                  >
                    <Input className="h-8 text-sm" placeholder="Activity name" autoFocus {...activityForm.register('name', { required: true })} />
                    <Input className="h-8 text-sm w-36" type="date" {...activityForm.register('date')} />
                    <Button type="submit" size="sm" variant="outline" disabled={createActivity.isPending}>
                      Add
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        activityForm.reset({ name: '', date: '' });
                        setAddingActivity(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingActivity(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-2 rounded-md border border-dashed border-border/60 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add activity
                  </button>
                )}
              </div>

              <Separator className="bg-border/60" />

              <PaymentsSection
                legId={leg.id}
                tripId={tripId}
                routeId={routeId}
                payments={leg.payments ?? []}
                totalCost={
                  leg.accommodation?.total_cost ??
                  (leg.accommodation?.cost_per_night != null && getLiveNights() > 0
                    ? +(leg.accommodation.cost_per_night * getLiveNights()).toFixed(2)
                    : null)
                }
              />
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex gap-1 items-center">
                  {confirmedMode && (
                    <Button
                      type="button"
                      variant={locked ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={async () => {
                        if (leg.purchased) {
                          await updateLeg.mutateAsync({ legId: leg.id, purchased: false } as never);
                        } else {
                          await legForm.handleSubmit(async (values) => {
                            await updateLeg.mutateAsync({ legId: leg.id, ...values, purchased: true } as never);
                          })();
                          await accForm.handleSubmit(onSaveAccommodation)();
                          setExpanded(false);
                        }
                      }}
                      disabled={updateLeg.isPending || upsertAccommodation.isPending}
                    >
                      {locked ? (
                        <>
                          <LockOpen className="h-3.5 w-3.5 mr-1" />
                          Unmark booked
                        </>
                      ) : (
                        <>
                          <CircleCheck className="h-3.5 w-3.5 mr-1" />
                          Mark as booked
                        </>
                      )}
                    </Button>
                  )}
                  {!locked && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteLeg.mutate(leg.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remove
                      </Button>
                      <CopyToRouteMenu legId={leg.id} tripId={tripId} routeId={routeId} otherRoutes={otherRoutes} />
                    </>
                  )}
                </div>
                {!locked && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={updateLeg.isPending || upsertAccommodation.isPending}
                    onClick={async () => {
                      await legForm.handleSubmit(onSaveLeg)();
                      await accForm.handleSubmit(onSaveAccommodation)();
                      setExpanded(false);
                    }}
                  >
                    {updateLeg.isPending || upsertAccommodation.isPending ? 'Saving…' : 'Save'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RouteEditorPage() {
  const { tripId, routeId } = useParams<{ tripId: string; routeId: string }>();
  const { data: route, isLoading } = useRoute(tripId!, routeId!) as { data: RouteDetail | undefined; isLoading: boolean };
  const { data: trip } = useTrip(tripId!);
  const { data: allRoutes } = useRoutes(tripId!);
  const { data: offsets } = useOffsets(tripId!);
  const createLeg = useCreateLeg(tripId!, routeId!);
  const updateLeg = useUpdateLeg(tripId!, routeId!);
  const updateDayTrip = useUpdateDayTrip(tripId!, routeId!);
  const deleteRoute = useDeleteRoute(tripId!);
  const updateRoute = useUpdateRoute(tripId!);
  const navigate = useNavigate();
  const otherRoutes = (allRoutes ?? []).filter((r: { id: string }) => r.id !== routeId).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }));
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'map'>('list');
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newlyCreatedLegId, setNewlyCreatedLegId] = useState<string | null>(null);

  const handleAddLocation = async () => {
    const result = (await createLeg.mutateAsync({ type: 'location' } as never)) as unknown as { leg: { id: string } } | { id: string };
    const newId = 'leg' in result ? result.leg.id : result.id;
    setNewlyCreatedLegId(newId);
  };

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );

  if (!route) return <div className="text-center py-16 text-muted-foreground">Route not found</div>;

  const legs = route.legs ?? [];
  const locationLegs = legs.filter((l) => l.type === 'location');
  const transportCost = legs.filter((l) => l.type === 'travel').reduce((s, l) => s + (l.cost ?? 0), 0);

  const getAccCost = (l: LegWithDetails) => {
    if (l.accommodation?.total_cost != null) return l.accommodation.total_cost;
    const nights = getNights(l);
    if (l.accommodation?.cost_per_night != null && nights > 0) {
      return l.accommodation.cost_per_night * nights;
    }
    return 0;
  };
  const accCost = locationLegs.reduce((s, l) => s + getAccCost(l), 0);
  const totalCost = transportCost + accCost;

  let locationIndex = 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          {route.status === 'winner' ? (
            <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
              <Link to={`/trips/${tripId}`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Trip
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
              <Link to={`/trips/${tripId}/routes`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Routes
              </Link>
            </Button>
          )}
          <div>
            {route.status === 'winner' && (
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-primary font-semibold">
                <Trophy className="h-3 w-3" />
                Current Route
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight">{route.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 border border-border/60 rounded-lg p-0.5">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('timeline')}
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'map' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setViewMode('map')}
            >
              <Map className="h-4 w-4" />
            </Button>
          </div>
          {route.status === 'winner' && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                updateRoute.mutate({ routeId: route.id, status: 'draft' as never })
              }
              disabled={updateRoute.isPending}
            >
              Cancel confirmation
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete route"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete route?</DialogTitle>
            <DialogDescription>
              This permanently deletes &ldquo;{route.name}&rdquo; and all of its legs. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteRoute.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteRoute.mutate(routeId!, {
                  onSuccess: () => {
                    setDeleteOpen(false);
                    navigate(`/trips/${tripId}/routes`);
                  },
                })
              }
              disabled={deleteRoute.isPending}
            >
              {deleteRoute.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewMode === 'timeline' && trip?.start_date && trip?.end_date ? (
        <div className="mb-8">
          <RouteTimeline
            legs={legs}
            tripStartDate={trip.start_date}
            tripEndDate={trip.end_date}
            onUpdateLeg={async (legId, startDate, endDate) => {
              await updateLeg.mutateAsync({ legId, start_date: startDate, end_date: endDate } as never);
            }}
            onUpdateDayTrip={async (dayTripId, date) => {
              await updateDayTrip.mutateAsync({ dayTripId, date } as never);
            }}
            onSelectLeg={(legId) => setSelectedLegId(legId)}
          />
        </div>
      ) : viewMode === 'timeline' ? (
        <div className="text-center py-16 text-muted-foreground mb-8">
          <p>Set trip start and end dates to use the timeline view.</p>
        </div>
      ) : null}

      {viewMode === 'map' && (
        <div className="mb-8">
          <RouteMap legs={legs} onSelectLeg={(legId) => setSelectedLegId(legId)} />
        </div>
      )}

      {viewMode === 'list' && (
        <>
          {legs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-3 opacity-20" strokeWidth={1.5} />
              <p>No locations yet. Add your first stop.</p>
            </div>
          ) : (
            <div className="relative">
              {(() => {
                const sorted = [...legs].sort((a, b) => a.order - b.order);
                const elements: React.ReactNode[] = [];
                let locationIndex = 0;

                const addPlaceholder = (key: string, label: string, insertOrder: number, startDate?: string | null, endDate?: string | null) => {
                  elements.push(
                    <div key={key} className="relative flex justify-center my-2 pl-11">
                      <button
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-dashed border-muted-foreground/30 bg-muted/10 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-all cursor-pointer"
                        onClick={async () => {
                          await createLeg.mutateAsync({
                            type: 'travel',
                            name: label,
                            order: insertOrder,
                            start_date: startDate ?? null,
                            end_date: endDate ?? null,
                          } as never);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add transport: {label}
                      </button>
                    </div>,
                  );
                };

                // Home → first location placeholder (if first leg is a location)
                if (sorted.length > 0 && sorted[0].type === 'location') {
                  const first = sorted[0];
                  addPlaceholder('travel-to-first', `Home → ${first.name}`, first.order, null, first.start_date);
                }

                let prevLocation: LegWithDetails | null = null;
                sorted.forEach((leg, i) => {
                  // Check if we need a placeholder between previous location and this location
                  if (leg.type === 'location' && i > 0 && sorted[i - 1].type === 'location') {
                    const prev = sorted[i - 1];
                    addPlaceholder(`travel-gap-${i}`, `${prev.name} → ${leg.name}`, leg.order, prev.end_date, leg.start_date);
                  }

                  if (leg.type === 'location' && prevLocation) {
                    const warning = getLocationDateWarning(prevLocation, leg);
                    if (warning) {
                      const tone =
                        warning.kind === 'gap'
                          ? 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300'
                          : 'border-yellow-500/40 bg-yellow-400/15 text-yellow-900 dark:text-yellow-200';
                      elements.push(
                        <div
                          key={`warn-${leg.id}`}
                          className={cn(
                            'mx-1 my-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                            tone,
                          )}
                          role="alert"
                        >
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span className="leading-snug">{warning.message}</span>
                        </div>,
                      );
                    }
                  }

                  if (leg.type === 'travel') {
                    elements.push(
                      <TravelLegCard
                        key={leg.id}
                        leg={leg}
                        tripId={tripId!}
                        routeId={routeId!}
                        index={i}
                        otherRoutes={otherRoutes}
                        confirmedMode={route.status === 'winner'}
                      />,
                    );
                    const nextLoc = sorted.slice(i + 1).find((l) => l.type === 'location') as LegWithDetails | undefined;
                    const travelWarning = getTravelDateWarning(leg, prevLocation, nextLoc ?? null);
                    if (travelWarning) {
                      const TransportIcon = leg.transport_type ? transportIcons[leg.transport_type] : null;
                      elements.push(
                        <div
                          key={`travel-warn-${leg.id}`}
                          className={cn(
                            'mx-1 my-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                            'border-yellow-500/40 bg-yellow-400/15 text-yellow-900 dark:text-yellow-200',
                          )}
                          role="alert"
                        >
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          {TransportIcon && <TransportIcon className="h-4 w-4 mt-0.5 shrink-0" />}
                          <span className="leading-snug">{travelWarning.message}</span>
                        </div>,
                      );
                    }
                  } else {
                    elements.push(
                      <LocationLegCard
                        key={`${leg.id}-${leg.accommodation?.total_cost ?? ''}-${leg.accommodation?.cost_per_night ?? ''}`}
                        leg={leg}
                        tripId={tripId!}
                        routeId={routeId!}
                        index={locationIndex++}
                        defaultExpanded={leg.id === newlyCreatedLegId}
                        otherRoutes={otherRoutes}
                        confirmedMode={route.status === 'winner'}
                      />,
                    );
                    prevLocation = leg;
                  }
                });

                // Last location → Home placeholder (if last leg is a location)
                if (sorted.length > 0 && sorted[sorted.length - 1].type === 'location') {
                  const last = sorted[sorted.length - 1];
                  addPlaceholder('travel-from-last', `${last.name} → Home`, last.order + 1, last.end_date, null);
                }

                return elements;
              })()}
            </div>
          )}

          <div className="mt-4">
            <Button
              onClick={handleAddLocation}
              disabled={createLeg.isPending}
              variant="outline"
              className="w-full border-dashed border-border/60 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createLeg.isPending ? 'Adding…' : 'Add Location'}
            </Button>
          </div>

          {legs.length > 0 && (() => {
            const totalOffset = (offsets ?? []).reduce((sum, o) => sum + o.amount, 0);
            const outOfPocket = totalCost - totalOffset;
            return (
              <div className="mt-8 py-4 px-5 rounded-xl border border-border/60 bg-card">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Running Totals</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Transport</p>
                    <p className="font-bold tabular-nums">${transportCost.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Accommodation</p>
                    <p className="font-bold tabular-nums">${accCost.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Route Total</p>
                    <p className="font-bold tabular-nums">${totalCost.toLocaleString()}</p>
                  </div>
                </div>
                {totalOffset > 0 && (
                  <div className="grid grid-cols-3 gap-4 text-sm mt-3 pt-3 border-t border-border/60">
                    <div>
                      <p className="text-muted-foreground text-xs">Offset</p>
                      <p className="font-bold text-green-700 tabular-nums">-${totalOffset.toLocaleString()}</p>
                    </div>
                    <div />
                    <div>
                      <p className="text-muted-foreground text-xs">Out of Pocket</p>
                      <p className="font-bold text-lg tabular-nums">${outOfPocket.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Leg detail dialog (from calendar double-click) */}
      {selectedLegId && (() => {
        const selectedLeg = legs.find((l) => l.id === selectedLegId) as LegWithDetails | undefined;
        if (!selectedLeg || selectedLeg.type !== 'location') return null;
        const idx = locationLegs.indexOf(selectedLeg);
        return (
          <Dialog open={true} onOpenChange={(open) => { if (!open) setSelectedLegId(null); }}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedLeg.name || 'Unnamed Location'}</DialogTitle>
              </DialogHeader>
              <LocationLegCard
                key={`dialog-${selectedLeg.id}-${selectedLeg.accommodation?.total_cost ?? ''}`}
                leg={selectedLeg}
                tripId={tripId!}
                routeId={routeId!}
                index={idx >= 0 ? idx : 0}
                defaultExpanded
                otherRoutes={otherRoutes}
              />
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}

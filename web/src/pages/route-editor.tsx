import { useState } from 'react';
import { Link, useParams } from 'react-router';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { useRoute, useRoutes } from '@/hooks/queries/use-routes';
import { useOffsets } from '@/hooks/queries/use-offsets';
import { useTrip } from '@/hooks/queries/use-trips';
import { RouteTimeline } from '@/components/route-timeline';
import {
  useCreateLeg,
  useUpdateLeg,
  useDeleteLeg,
  useUpsertAccommodation,
  useCreateDayTrip,
  useUpdateDayTrip,
  useDeleteDayTrip,
  useCreateActivity,
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
import type { Leg, Accommodation, DayTrip, Activity, TransportType } from '@leg-go/shared';

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

interface LegWithDetails extends Leg {
  accommodation?: Accommodation | null;
  day_trips?: DayTrip[];
  activities?: Activity[];
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

function TravelLegCard({
  leg,
  tripId,
  routeId,
  index,
  otherRoutes,
}: {
  leg: LegWithDetails;
  tripId: string;
  routeId: string;
  index: number;
  otherRoutes: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const updateLeg = useUpdateLeg(tripId, routeId);
  const deleteLeg = useDeleteLeg(tripId, routeId);

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
    <div className="relative flex justify-center my-1">
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-all',
          leg.transport_type
            ? 'bg-card border-border/60 hover:border-primary/30'
            : 'border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/40',
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{leg.transport_type ? transportLabels[leg.transport_type] : 'Travel'}</span>
        {leg.cost != null && <span className="text-muted-foreground tabular-nums">${leg.cost.toLocaleString()}</span>}
        {leg.duration && <span className="text-muted-foreground">· {leg.duration}</span>}
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </div>

      {expanded && (
        <Card className="absolute top-full mt-2 z-10 w-full max-w-lg shadow-lg border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Edit Travel Leg</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
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
                  <Input className="h-8 text-sm" type="number" step="0.01" {...register('cost')} />
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
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => deleteLeg.mutate(leg.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <CopyToRouteMenu legId={leg.id} tripId={tripId} routeId={routeId} otherRoutes={otherRoutes} />
                <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={updateLeg.isPending}>
                  Save
                </Button>
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
}: {
  leg: LegWithDetails;
  tripId: string;
  routeId: string;
  index: number;
  defaultExpanded?: boolean;
  otherRoutes: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const updateLeg = useUpdateLeg(tripId, routeId);
  const deleteLeg = useDeleteLeg(tripId, routeId);
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
    },
  });

  const accForm = useForm({
    defaultValues: {
      name: leg.accommodation?.name ?? '',
      address: leg.accommodation?.address ?? '',
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
        <div className="flex-1 mb-2 py-3 px-4 rounded-xl border border-border/60 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">{leg.name || 'Unnamed Location'}</h3>
              {leg.start_date && leg.end_date && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(parseISO(leg.start_date), 'MMM d')} –{' '}
                  {format(parseISO(leg.end_date), 'MMM d, yyyy')}
                  {leg.nights != null && ` · ${leg.nights} nights`}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
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
              {/* Location details */}
              <form onSubmit={legForm.handleSubmit(onSaveLeg)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Location Name</Label>
                    <Input className="h-8 text-sm" {...legForm.register('name')} />
                  </div>
                  <div />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Start Date</Label>
                    <DatePicker
                      value={legForm.watch('start_date')}
                      onChange={(date) => legForm.setValue('start_date', date)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End Date</Label>
                    <DatePicker
                      value={legForm.watch('end_date')}
                      onChange={(date) => legForm.setValue('end_date', date)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea className="text-sm min-h-0 h-14" {...legForm.register('notes')} />
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex gap-1">
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
                  </div>
                  <Button type="submit" size="sm" disabled={updateLeg.isPending}>
                    Save Location
                  </Button>
                </div>
              </form>

              <Separator className="bg-border/60" />

              {/* Accommodation */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Accommodation</h4>
                <form onSubmit={accForm.handleSubmit(onSaveAccommodation)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input className="h-8 text-sm" placeholder="Airbnb / Hotel name" {...accForm.register('name')} />
                    </div>
                    <div>
                      <Label className="text-xs">Address</Label>
                      <Input className="h-8 text-sm" {...accForm.register('address')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">$/night</Label>
                      <Input className="h-8 text-sm" type="number" step="0.01" {...accForm.register('cost_per_night', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label className="text-xs">Total cost</Label>
                      <Input className="h-8 text-sm" type="number" step="0.01" {...accForm.register('total_cost', { valueAsNumber: true })} />
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
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Textarea className="text-sm min-h-0 h-14" {...accForm.register('notes')} />
                  </div>
                  <Button type="submit" size="sm" disabled={upsertAccommodation.isPending}>
                    Save Accommodation
                  </Button>
                </form>
              </div>

              <Separator className="bg-border/60" />

              {/* Day trips */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Day Trips</h4>
                {leg.day_trips?.map((dt) => (
                  <div key={dt.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40">
                    <span>
                      {dt.destination_name}
                      {dt.date && ` · ${format(parseISO(dt.date), 'MMM d')}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          dt.status === 'confirmed' ? 'border-primary/40 text-primary' : 'border-dashed',
                        )}
                      >
                        {dt.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => deleteDayTrip.mutate(dt.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                <form
                  onSubmit={dayTripForm.handleSubmit(async (v) => {
                    await createDayTrip.mutateAsync({ legId: leg.id, ...v } as never);
                    dayTripForm.reset({ destination_name: '', date: '', status: 'idea' });
                  })}
                  className="flex gap-2 mt-2"
                >
                  <Input className="h-8 text-sm" placeholder="Destination" {...dayTripForm.register('destination_name', { required: true })} />
                  <Input className="h-8 text-sm w-36" type="date" {...dayTripForm.register('date')} />
                  <Button type="submit" size="sm" variant="outline" disabled={createDayTrip.isPending}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>

              <Separator className="bg-border/60" />

              {/* Activities */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Activities</h4>
                {leg.activities?.map((act) => (
                  <div key={act.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40">
                    <span>
                      {act.name}
                      {act.date && ` · ${format(parseISO(act.date), 'MMM d')}`}
                      {act.time && ` at ${act.time}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive"
                      onClick={() => deleteActivity.mutate(act.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <form
                  onSubmit={activityForm.handleSubmit(async (v) => {
                    await createActivity.mutateAsync({ legId: leg.id, ...v } as never);
                    activityForm.reset({ name: '', date: '' });
                  })}
                  className="flex gap-2 mt-2"
                >
                  <Input className="h-8 text-sm" placeholder="Activity name" {...activityForm.register('name', { required: true })} />
                  <Input className="h-8 text-sm w-36" type="date" {...activityForm.register('date')} />
                  <Button type="submit" size="sm" variant="outline" disabled={createActivity.isPending}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </form>
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
  const otherRoutes = (allRoutes ?? []).filter((r: { id: string }) => r.id !== routeId).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }));
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const addLocationForm = useForm({
    defaultValues: { name: '', start_date: '', end_date: '' },
  });

  const onAddLocation = async (values: { name: string; start_date: string; end_date: string }) => {
    await createLeg.mutateAsync({
      type: 'location',
      name: values.name,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
    } as never);
    setAddLocationOpen(false);
    addLocationForm.reset();
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
          <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
            <Link to={`/trips/${tripId}/routes`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Routes
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{route.name}</h1>
        </div>
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
        </div>
      </div>

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
                    <div key={key} className="relative flex justify-center my-1">
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

                sorted.forEach((leg, i) => {
                  // Check if we need a placeholder between previous location and this location
                  if (leg.type === 'location' && i > 0 && sorted[i - 1].type === 'location') {
                    const prev = sorted[i - 1];
                    addPlaceholder(`travel-gap-${i}`, `${prev.name} → ${leg.name}`, leg.order, prev.end_date, leg.start_date);
                  }

                  if (leg.type === 'travel') {
                    elements.push(
                      <TravelLegCard key={leg.id} leg={leg} tripId={tripId!} routeId={routeId!} index={i} otherRoutes={otherRoutes} />,
                    );
                  } else {
                    elements.push(
                      <LocationLegCard key={`${leg.id}-${leg.accommodation?.total_cost ?? ''}-${leg.accommodation?.cost_per_night ?? ''}`} leg={leg} tripId={tripId!} routeId={routeId!} index={locationIndex++} otherRoutes={otherRoutes} />,
                    );
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

      <div className="mt-4">
        <Button onClick={() => setAddLocationOpen(true)} variant="outline" className="w-full border-dashed border-border/60 text-muted-foreground hover:text-foreground">
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
        <Dialog open={addLocationOpen} onOpenChange={setAddLocationOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Location</DialogTitle>
            </DialogHeader>
            <form onSubmit={addLocationForm.handleSubmit(onAddLocation)} className="space-y-4">
              <div>
                <Label htmlFor="loc-name">Location Name</Label>
                <Input
                  id="loc-name"
                  placeholder="e.g. Lisbon, Porto, Sardinia"
                  {...addLocationForm.register('name', { required: true })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <DatePicker
                    value={addLocationForm.watch('start_date')}
                    onChange={(date) => addLocationForm.setValue('start_date', date)}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <DatePicker
                    value={addLocationForm.watch('end_date')}
                    onChange={(date) => addLocationForm.setValue('end_date', date)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createLeg.isPending}>
                {createLeg.isPending ? 'Adding...' : 'Add Location'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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

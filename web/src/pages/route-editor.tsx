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
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useRoute } from '@/hooks/queries/use-routes';
import {
  useCreateLeg,
  useUpdateLeg,
  useDeleteLeg,
  useUpsertAccommodation,
  useCreateDayTrip,
  useDeleteDayTrip,
  useCreateActivity,
  useDeleteActivity,
} from '@/hooks/queries/use-legs';
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

function TravelLegCard({
  leg,
  tripId,
  routeId,
  index,
}: {
  leg: LegWithDetails;
  tripId: string;
  routeId: string;
  index: number;
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
    await updateLeg.mutateAsync({ legId: leg.id, ...values } as never);
    setExpanded(false);
  };

  return (
    <div className="relative flex justify-center my-1">
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer hover:bg-accent text-sm transition-colors',
          leg.transport_type ? 'bg-white border-border' : 'border-dashed border-muted-foreground/50 bg-muted/30',
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{leg.transport_type ? transportLabels[leg.transport_type] : 'Travel'}</span>
        {leg.cost != null && <span className="text-muted-foreground">${leg.cost.toLocaleString()}</span>}
        {leg.duration && <span className="text-muted-foreground">· {leg.duration}</span>}
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </div>

      {expanded && (
        <Card className="absolute top-full mt-2 z-10 w-full max-w-lg shadow-lg">
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
                  <Input className="h-8 text-sm" type="number" {...register('cost')} />
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
                  <Label className="text-xs">Departure time</Label>
                  <Input className="h-8 text-sm" type="time" {...register('departure_time')} />
                </div>
                <div>
                  <Label className="text-xs">Arrival time</Label>
                  <Input className="h-8 text-sm" type="time" {...register('arrival_time')} />
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
}: {
  leg: LegWithDetails;
  tripId: string;
  routeId: string;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
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
    await upsertAccommodation.mutateAsync({
      legId: leg.id,
      ...values,
      amenities,
    } as never);
  };

  return (
    <div className="relative">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
            {index + 1}
          </div>
          <div className="w-0.5 bg-border flex-1 min-h-4" />
        </div>
        <Card className="flex-1 mb-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{leg.name || 'Unnamed Location'}</CardTitle>
                {leg.start_date && leg.end_date && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(leg.start_date), 'MMM d')} –{' '}
                    {format(new Date(leg.end_date), 'MMM d, yyyy')}
                    {leg.nights != null && ` · ${leg.nights} nights`}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          {leg.accommodation && !expanded && (
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                🏠 {leg.accommodation.name}
                {leg.accommodation.total_cost != null &&
                  ` · $${leg.accommodation.total_cost.toLocaleString()}`}
              </p>
            </CardContent>
          )}

          {expanded && (
            <CardContent className="pt-0 space-y-4">
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
                    <Input className="h-8 text-sm" type="date" {...legForm.register('start_date')} />
                  </div>
                  <div>
                    <Label className="text-xs">End Date</Label>
                    <Input className="h-8 text-sm" type="date" {...legForm.register('end_date')} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea className="text-sm min-h-0 h-14" {...legForm.register('notes')} />
                </div>
                <div className="flex justify-between items-center">
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
                  <Button type="submit" size="sm" disabled={updateLeg.isPending}>
                    Save Location
                  </Button>
                </div>
              </form>

              <Separator />

              {/* Accommodation */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Accommodation</h4>
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
                      <Input className="h-8 text-sm" type="number" {...accForm.register('cost_per_night')} />
                    </div>
                    <div>
                      <Label className="text-xs">Total cost</Label>
                      <Input className="h-8 text-sm" type="number" {...accForm.register('total_cost')} />
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

              <Separator />

              {/* Day trips */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Day Trips</h4>
                {leg.day_trips?.map((dt) => (
                  <div key={dt.id} className="flex items-center justify-between text-sm py-1 border-b">
                    <span>
                      {dt.destination_name}
                      {dt.date && ` · ${format(new Date(dt.date), 'MMM d')}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          dt.status === 'confirmed' ? 'border-orange-400 text-orange-600' : 'border-dashed',
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

              <Separator />

              {/* Activities */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Activities</h4>
                {leg.activities?.map((act) => (
                  <div key={act.id} className="flex items-center justify-between text-sm py-1 border-b">
                    <span>
                      {act.name}
                      {act.date && ` · ${format(new Date(act.date), 'MMM d')}`}
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
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function RouteEditorPage() {
  const { tripId, routeId } = useParams<{ tripId: string; routeId: string }>();
  const { data: route, isLoading } = useRoute(tripId!, routeId!) as { data: RouteDetail | undefined; isLoading: boolean };
  const createLeg = useCreateLeg(tripId!, routeId!);

  const addLocation = async () => {
    await createLeg.mutateAsync({ type: 'location' } as never);
  };

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );

  if (!route) return <div className="text-center py-12 text-muted-foreground">Route not found</div>;

  const legs = route.legs ?? [];
  const locationLegs = legs.filter((l) => l.type === 'location');
  const totalCost = legs.reduce((s, l) => s + (l.cost ?? 0), 0);
  const transportCost = legs.filter((l) => l.type === 'travel').reduce((s, l) => s + (l.cost ?? 0), 0);
  const accCost = locationLegs.reduce((s, l) => s + (l.accommodation?.total_cost ?? 0), 0);

  let locationIndex = 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to={`/trips/${tripId}/routes`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Routes
          </Link>
        </Button>
        <h1 className="text-xl font-bold">{route.name}</h1>
      </div>

      {legs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No locations yet. Add your first stop.</p>
        </div>
      ) : (
        <div className="relative">
          {legs.map((leg) => {
            if (leg.type === 'location') {
              const idx = locationIndex++;
              return (
                <LocationLegCard key={leg.id} leg={leg} tripId={tripId!} routeId={routeId!} index={idx} />
              );
            } else {
              return (
                <TravelLegCard key={leg.id} leg={leg} tripId={tripId!} routeId={routeId!} index={0} />
              );
            }
          })}
        </div>
      )}

      <div className="mt-4">
        <Button onClick={addLocation} variant="outline" className="w-full" disabled={createLeg.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      {legs.length > 0 && (
        <Card className="mt-6">
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3">Running Totals</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Transport</p>
                <p className="font-bold">${transportCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Accommodation</p>
                <p className="font-bold">${accCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Route Total</p>
                <p className="font-bold text-lg">${totalCost.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

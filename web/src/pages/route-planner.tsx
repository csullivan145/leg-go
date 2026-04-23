import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Plus, Trophy, ArrowRight, Plane, Train, Ship, Car, Bus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRoutes, useCreateRoute } from '@/hooks/queries/use-routes';
import { useCompare, usePickWinner } from '@/hooks/queries/use-compare';
import { cn } from '@/lib/utils';
import type { Route, Leg, TransportType } from '@leg-go/shared';

const transportIcons: Record<TransportType, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  train: Train,
  ferry: Ship,
  car: Car,
  bus: Bus,
};

interface RouteWithLegs extends Route {
  legs?: Leg[];
  transport_total?: number;
  accommodation_total?: number;
  route_total?: number;
}

const routeStatusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  winner: 'bg-green-700/10 text-green-700',
  rejected: 'bg-destructive/10 text-destructive',
};

function RouteCard({ route, tripId }: { route: RouteWithLegs; tripId: string }) {
  const legs = route.legs ?? [];
  const locationLegs = legs.filter((l) => l.type === 'location');
  const travelLegs = legs.filter((l) => l.type === 'travel');

  return (
    <Link to={`/trips/${tripId}/routes/${route.id}`} className="block group">
      <div className="flex items-center gap-4 py-4 px-5 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-sm transition-all">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-base font-semibold truncate">{route.name}</h3>
            {route.status === 'winner' && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
            <Badge className={cn('text-[11px] capitalize font-medium shrink-0', routeStatusStyles[route.status])}>
              {route.status}
            </Badge>
          </div>

          {legs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-sm mb-2">
              {locationLegs.map((loc, i) => (
                <div key={loc.id} className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1">
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    <span className="font-medium">{loc.name}</span>
                    {loc.nights != null && (
                      <span className="text-muted-foreground text-xs">({loc.nights}n)</span>
                    )}
                  </span>
                  {i < locationLegs.length - 1 && (
                    <span className="text-muted-foreground/50">→</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-2">No locations added yet</p>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {travelLegs.length > 0 && (
              <span>
                Transport:{' '}
                <span className="font-medium text-foreground tabular-nums">
                  ${travelLegs.reduce((s, l) => s + (l.cost ?? 0), 0).toLocaleString()}
                </span>
              </span>
            )}
            {locationLegs.length > 0 && (
              <span>
                Total:{' '}
                <span className="font-medium text-foreground tabular-nums">
                  ${legs.reduce((s, l) => s + (l.cost ?? 0), 0).toLocaleString()}
                </span>
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
      </div>
    </Link>
  );
}

function CompareTab({ tripId }: { tripId: string }) {
  const { data, isLoading } = useCompare(tripId);
  const pickWinner = usePickWinner(tripId);

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );

  if (!data || data.routes.length === 0)
    return (
      <p className="text-center py-12 text-muted-foreground">No routes to compare yet.</p>
    );

  const routes = data.routes;

  const minVal = (key: keyof (typeof routes)[0]) =>
    Math.min(...routes.map((r) => Number(r[key] ?? Infinity)));

  const rows: { label: string; key: keyof (typeof routes)[0] }[] = [
    { label: 'Flights from home', key: 'flights_from_home' },
    { label: 'In-region transport', key: 'in_region_transport' },
    { label: 'Car rental', key: 'car_rental' },
    { label: 'Accommodation', key: 'accommodation' },
    { label: 'Activities', key: 'activities' },
    { label: 'Trip total', key: 'trip_total' },
    { label: 'Offset', key: 'offset' },
    { label: 'Out of pocket', key: 'out_of_pocket' },
  ];

  const convenienceRows: { label: string; key: keyof (typeof routes)[0] }[] = [
    { label: 'Flight count', key: 'flight_count' },
    { label: 'Ferry count', key: 'ferry_count' },
    { label: 'Total travel time', key: 'total_travel_hours' },
  ];

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm border-collapse min-w-[400px]">
        <thead>
          <tr>
            <th className="text-left py-3 pr-4 font-medium text-muted-foreground text-xs uppercase tracking-wide w-40">Route</th>
            {routes.map((r) => (
              <th key={r.route_id} className="text-center py-3 px-3 font-semibold">
                <div>{r.route_name}</div>
                {r.route_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1.5 h-7 text-xs"
                    onClick={() => pickWinner.mutate(r.route_id)}
                    disabled={pickWinner.isPending}
                  >
                    <Trophy className="h-3 w-3 mr-1" />
                    Pick Winner
                  </Button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, key }) => {
            const min = minVal(key);
            return (
              <tr key={key} className="border-t border-border/60">
                <td className="py-2.5 pr-4 text-muted-foreground">{label}</td>
                {routes.map((r) => {
                  const val = r[key];
                  const isNum = typeof val === 'number';
                  const isLowest = isNum && val === min && val > 0;
                  return (
                    <td
                      key={r.route_id}
                      className={cn(
                        'text-center py-2.5 px-3 font-medium tabular-nums',
                        isLowest && 'text-green-700 bg-green-700/5 rounded',
                      )}
                    >
                      {isNum ? `$${val.toLocaleString()}` : String(val ?? '—')}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="border-t-2 border-border">
            <td colSpan={routes.length + 1} className="py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Convenience
            </td>
          </tr>
          {convenienceRows.map(({ label, key }) => (
            <tr key={key} className="border-t border-border/60">
              <td className="py-2.5 pr-4 text-muted-foreground">{label}</td>
              {routes.map((r) => (
                <td key={r.route_id} className="text-center py-2.5 px-3 tabular-nums">
                  {String(r[key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RoutePlannerPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { data: routes, isLoading } = useRoutes(tripId!);
  const createRoute = useCreateRoute(tripId!);
  const [open, setOpen] = useState(false);
  const form = useForm<{ name: string }>({ defaultValues: { name: '' } });

  const onSubmit = async (values: { name: string }) => {
    await createRoute.mutateAsync({ name: values.name });
    setOpen(false);
    form.reset();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-8">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
          <Link to={`/trips/${tripId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Trip
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Route Planner</h1>
      </div>

      <Tabs defaultValue="routes">
        <TabsList className="mb-6">
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
        </TabsList>

        <TabsContent value="routes">
          <div className="flex justify-end mb-4">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Route
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Route</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="routeName">Route Name</Label>
                    <Input
                      id="routeName"
                      placeholder="e.g. Lisbon-Porto-Sardinia"
                      {...form.register('name', { required: true })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createRoute.isPending}>
                    {createRoute.isPending ? 'Creating...' : 'Create Route'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : routes?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No routes yet. Add your first route to start planning.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {routes?.map((route) => (
                <RouteCard key={route.id} route={route as RouteWithLegs} tripId={tripId!} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compare">
          <CompareTab tripId={tripId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

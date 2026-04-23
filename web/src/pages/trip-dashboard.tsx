import { Link, useParams } from 'react-router';
import { Map, Calendar, DollarSign, Users, ArrowLeft, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrip } from '@/hooks/queries/use-trips';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  planning: 'bg-primary/10 text-primary',
  active: 'bg-green-700/10 text-green-700',
  completed: 'bg-muted text-muted-foreground',
};

const navItems = [
  {
    title: 'Route Planner',
    description: 'Create and compare alternative routes',
    icon: Map,
    href: 'routes',
  },
  {
    title: 'Calendar',
    description: 'Week-by-week travel companion view',
    icon: Calendar,
    href: 'calendar',
  },
  {
    title: 'Budget',
    description: 'Cost breakdown by category and location',
    icon: DollarSign,
    href: 'budget',
  },
  {
    title: 'Sharing',
    description: 'Invite viewers and editors to your trip',
    icon: Users,
    href: 'sharing',
  },
];

export default function TripDashboardPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { data: trip, isLoading } = useTrip(tripId!);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!trip) return <div className="text-center py-16 text-muted-foreground">Trip not found</div>;

  return (
    <div>
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            My Trips
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{trip.name}</h1>
            {(trip.start_date || trip.end_date) && (
              <p className="text-muted-foreground mt-1.5 text-sm">
                {trip.start_date ? format(parseISO(trip.start_date), 'MMM d, yyyy') : '?'}
                {' — '}
                {trip.end_date ? format(parseISO(trip.end_date), 'MMM d, yyyy') : '?'}
              </p>
            )}
          </div>
          <Badge className={cn('capitalize text-sm font-medium', statusStyles[trip.status])}>
            {trip.status}
          </Badge>
        </div>
        {trip.description && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{trip.description}</p>
        )}
      </div>

      <div className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} to={`/trips/${tripId}/${item.href}`} className="block group">
              <div className="flex items-center gap-4 py-4 px-5 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-sm transition-all">
                <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

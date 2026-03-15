import { Link, useParams } from 'react-router';
import { Map, Calendar, DollarSign, Users, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrip } from '@/hooks/queries/use-trips';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  planning: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
};

const navCards = [
  {
    title: 'Route Planner',
    description: 'Create and compare alternative routes',
    icon: Map,
    href: 'routes',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    title: 'Calendar',
    description: 'Week-by-week travel companion view',
    icon: Calendar,
    href: 'calendar',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    title: 'Budget',
    description: 'Cost breakdown by category and location',
    icon: DollarSign,
    href: 'budget',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    title: 'Sharing',
    description: 'Invite viewers and editors to your trip',
    icon: Users,
    href: 'sharing',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
];

export default function TripDashboardPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { data: trip, isLoading } = useTrip(tripId!);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!trip) return <div className="text-center py-12 text-muted-foreground">Trip not found</div>;

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            My Trips
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{trip.name}</h1>
            {(trip.start_date || trip.end_date) && (
              <p className="text-muted-foreground mt-1 text-sm">
                {trip.start_date ? format(parseISO(trip.start_date), 'MMM d, yyyy') : '?'}
                {' — '}
                {trip.end_date ? format(parseISO(trip.end_date), 'MMM d, yyyy') : '?'}
              </p>
            )}
          </div>
          <Badge className={cn('capitalize text-sm', statusColors[trip.status])}>
            {trip.status}
          </Badge>
        </div>
        {trip.description && (
          <p className="mt-2 text-sm text-muted-foreground">{trip.description}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {navCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} to={`/trips/${tripId}/${card.href}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className={cn('p-3 rounded-xl', card.bg)}>
                    <Icon className={cn('h-6 w-6', card.color)} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{card.title}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{card.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

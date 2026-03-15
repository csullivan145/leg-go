import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { useTrips, useCreateTrip } from '@/hooks/queries/use-trips';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  planning: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
};

interface TripFormValues {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
}

export default function TripsPage() {
  const { data: trips, isLoading } = useTrips();
  const createTrip = useCreateTrip();
  const [open, setOpen] = useState(false);

  const form = useForm<TripFormValues>({
    defaultValues: { name: '', description: '', start_date: '', end_date: '' },
  });

  const onSubmit = async (values: TripFormValues) => {
    await createTrip.mutateAsync({
      name: values.name,
      description: values.description || null,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
    } as never);
    setOpen(false);
    form.reset();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Trips</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Trip
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Trip</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Trip Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Europe Summer 2026"
                  {...form.register('name', { required: true })}
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What's this trip about?"
                  {...form.register('description')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <DatePicker
                    value={form.watch('start_date')}
                    onChange={(date) => form.setValue('start_date', date)}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <DatePicker
                    value={form.watch('end_date')}
                    onChange={(date) => form.setValue('end_date', date)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createTrip.isPending}>
                {createTrip.isPending ? 'Creating...' : 'Create Trip'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : trips?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No trips yet</p>
          <p className="text-sm mt-1">Create your first trip to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips?.map((trip) => (
            <Link key={trip.id} to={`/trips/${trip.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{trip.name}</CardTitle>
                    <Badge className={cn('shrink-0 text-xs capitalize', statusColors[trip.status])}>
                      {trip.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {trip.description && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{trip.description}</p>
                  )}
                  {(trip.start_date || trip.end_date) && (
                    <p className="text-xs text-muted-foreground">
                      {trip.start_date ? format(parseISO(trip.start_date), 'MMM d, yyyy') : '?'}
                      {' — '}
                      {trip.end_date ? format(parseISO(trip.end_date), 'MMM d, yyyy') : '?'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

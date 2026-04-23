import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, MapPin, ArrowRight, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { useTrips, useCreateTrip, useDeleteTrip } from '@/hooks/queries/use-trips';
import type { Trip } from '@leg-go/shared';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  planning: 'bg-primary/10 text-primary',
  active: 'bg-green-700/10 text-green-700',
  completed: 'bg-muted text-muted-foreground',
};

interface TripFormValues {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
}

function TripCard({ trip }: { trip: Trip }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteTrip = useDeleteTrip();

  return (
    <>
      <Link to={`/trips/${trip.id}`} className="block group">
        <div className="flex items-center justify-between py-4 px-5 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-sm transition-all">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-1">
              <h2 className="text-base font-semibold truncate">{trip.name}</h2>
              <Badge className={cn('shrink-0 text-[11px] capitalize font-medium', statusStyles[trip.status])}>
                {trip.status}
              </Badge>
            </div>
            {trip.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-0.5">{trip.description}</p>
            )}
            {(trip.start_date || trip.end_date) && (
              <p className="text-xs text-muted-foreground/70">
                {trip.start_date ? format(parseISO(trip.start_date), 'MMM d, yyyy') : '?'}
                {' — '}
                {trip.end_date ? format(parseISO(trip.end_date), 'MMM d, yyyy') : '?'}
              </p>
            )}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 ml-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive focus-visible:opacity-100 transition-opacity shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirmOpen(true);
            }}
            aria-label={`Delete trip ${trip.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 ml-2" />
        </div>
      </Link>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete trip?</DialogTitle>
            <DialogDescription>
              This permanently deletes &ldquo;{trip.name}&rdquo; along with all its routes, legs, and shared access. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleteTrip.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteTrip.mutate(trip.id, { onSuccess: () => setConfirmOpen(false) })
              }
              disabled={deleteTrip.isPending}
            >
              {deleteTrip.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
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
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Trips</h1>
          <p className="text-muted-foreground text-sm mt-1">Plan, compare, and track your travels.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
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
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : trips?.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MapPin className="h-10 w-10 mx-auto mb-4 opacity-20" strokeWidth={1.5} />
          <p className="text-lg font-medium text-foreground/60">No trips yet</p>
          <p className="text-sm mt-1">Create your first trip to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips?.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}

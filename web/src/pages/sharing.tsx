import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Plus, Trash2, UserCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useShares, useCreateShare, useUpdateShare, useDeleteShare } from '@/hooks/queries/use-shares';
import { useAuth } from '@/providers/auth-provider';
import { useTrip } from '@/hooks/queries/use-trips';
import { cn } from '@/lib/utils';

const roleColors = {
  owner: 'bg-purple-100 text-purple-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-700',
};

export default function SharingPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const { data: trip } = useTrip(tripId!);
  const { data: shares, isLoading } = useShares(tripId!);
  const createShare = useCreateShare(tripId!);
  const updateShare = useUpdateShare(tripId!);
  const deleteShare = useDeleteShare(tripId!);
  const [open, setOpen] = useState(false);

  const isOwner = trip?.owner_id === user?.id;

  const form = useForm<{ email: string; role: 'viewer' | 'editor' }>({
    defaultValues: { email: '', role: 'viewer' },
  });
  const [selectedRole, setSelectedRole] = useState<'viewer' | 'editor'>('viewer');

  const onSubmit = async (values: { email: string; role: 'viewer' | 'editor' }) => {
    await createShare.mutateAsync({ email: values.email, role: selectedRole });
    setOpen(false);
    form.reset();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to={`/trips/${tripId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Trip
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Sharing</h1>
      </div>

      <div className="flex justify-end mb-4">
        {isOwner && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite to Trip</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="friend@example.com"
                    {...form.register('email', { required: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'viewer' | 'editor')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer — read-only access</SelectItem>
                      <SelectItem value="editor">Editor — can edit routes and details</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createShare.isPending}>
                  {createShare.isPending ? 'Inviting...' : 'Send Invite'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Owner card */}
      {trip && (
        <Card className="mb-3">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCircle className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {user?.id === trip.owner_id ? user.name : 'Trip Owner'}
                </p>
                {user?.id === trip.owner_id && (
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                )}
              </div>
            </div>
            <Badge className={cn('text-xs', roleColors.owner)}>owner</Badge>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : shares?.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground text-sm">
          No one else has access. Invite collaborators above.
        </p>
      ) : (
        <div className="space-y-3">
          {shares?.map((share) => (
            <Card key={share.id}>
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserCircle className="h-8 w-8 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{share.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{share.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isOwner ? (
                    <>
                      <Select
                        value={share.role}
                        onValueChange={(v) =>
                          updateShare.mutate({ shareId: share.id, role: v as 'viewer' | 'editor' })
                        }
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={() => deleteShare.mutate(share.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Badge className={cn('text-xs capitalize', roleColors[share.role])}>
                      {share.role}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

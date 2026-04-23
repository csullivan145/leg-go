import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBudget } from '@/hooks/queries/use-budget';
import { useOffsets, useCreateOffset, useUpdateOffset, useDeleteOffset } from '@/hooks/queries/use-offsets';

const categoryLabels: Record<string, string> = {
  flights: 'Flights',
  accommodation: 'Accommodation',
  transport: 'Transport',
  car_rental: 'Car Rental',
  activities: 'Activities',
};

const categoryAccents: Record<string, string> = {
  flights: 'bg-primary',
  accommodation: 'bg-purple-600',
  transport: 'bg-amber-600',
  car_rental: 'bg-yellow-600',
  activities: 'bg-green-700',
};

export default function BudgetPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const { data: budget, isLoading } = useBudget(tripId!, selectedRouteId);
  const { data: offsets } = useOffsets(tripId!);
  const createOffset = useCreateOffset(tripId!);
  const updateOffset = useUpdateOffset(tripId!);
  const deleteOffset = useDeleteOffset(tripId!);
  const [addingOffset, setAddingOffset] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [offsetAmount, setOffsetAmount] = useState('');
  const [offsetDesc, setOffsetDesc] = useState('');

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );

  const maxCategory = budget
    ? Math.max(...Object.values(budget.by_category))
    : 1;

  return (
    <div>
      <div className="flex items-center gap-2 mb-8">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
          <Link to={`/trips/${tripId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Trip
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
      </div>

      {budget && budget.routes.length > 1 && (
        <div className="mb-6">
          <Select
            value={selectedRouteId ?? budget.selected_route.id}
            onValueChange={(v) => setSelectedRouteId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select route" />
            </SelectTrigger>
            <SelectContent>
              {budget.routes.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}{r.status === 'winner' ? ' (Winner)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!budget ? (
        <p className="text-center py-16 text-muted-foreground">No budget data yet. Add routes with costs to see totals.</p>
      ) : (
        <div className="space-y-8">
          {/* Stat row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="py-4 px-5 rounded-xl border border-border/60 bg-card">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Trip Total</p>
              <p className="text-2xl font-bold tracking-tight">${budget.trip_total.toLocaleString()}</p>
            </div>
            <div className="py-4 px-5 rounded-xl border border-border/60 bg-card">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Offset</p>
              <p className="text-2xl font-bold tracking-tight text-green-700">-${budget.offset.toLocaleString()}</p>
            </div>
            <div className="py-4 px-5 rounded-xl border border-border/60 bg-card">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Out of Pocket</p>
              <p className="text-2xl font-bold tracking-tight">${budget.out_of_pocket.toLocaleString()}</p>
            </div>
          </div>

          {/* Offsets */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Offsets</h2>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setAddingOffset(true);
                  setOffsetAmount('');
                  setOffsetDesc('');
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/60">
              {addingOffset && (
                <div className="flex gap-2 items-end p-3">
                  <div className="flex-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      className="h-8 text-sm"
                      placeholder="e.g. Flight credit"
                      value={offsetDesc}
                      onChange={(e) => setOffsetDesc(e.target.value)}
                    />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Amount ($)</Label>
                    <Input
                      className="h-8 text-sm"
                      type="number"
                      step="0.01"
                      value={offsetAmount}
                      onChange={(e) => setOffsetAmount(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={createOffset.isPending}
                    onClick={async () => {
                      if (!offsetAmount || !offsetDesc) return;
                      await createOffset.mutateAsync({ amount: Number(offsetAmount), description: offsetDesc });
                      setAddingOffset(false);
                    }}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingOffset(false)}>
                    Cancel
                  </Button>
                </div>
              )}
              {offsets && offsets.length > 0 ? (
                offsets.map((o) =>
                  editingId === o.id ? (
                    <div key={o.id} className="flex gap-2 items-end p-3">
                      <div className="flex-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                          className="h-8 text-sm"
                          value={offsetDesc}
                          onChange={(e) => setOffsetDesc(e.target.value)}
                        />
                      </div>
                      <div className="w-28">
                        <Label className="text-xs">Amount ($)</Label>
                        <Input
                          className="h-8 text-sm"
                          type="number"
                          step="0.01"
                          value={offsetAmount}
                          onChange={(e) => setOffsetAmount(e.target.value)}
                        />
                      </div>
                      <Button
                        size="sm"
                        className="h-8"
                        disabled={updateOffset.isPending}
                        onClick={async () => {
                          await updateOffset.mutateAsync({
                            offsetId: o.id,
                            amount: Number(offsetAmount),
                            description: offsetDesc,
                          });
                          setEditingId(null);
                        }}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div key={o.id} className="flex items-center justify-between py-3 px-4 group">
                      <span className="text-sm">{o.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-700">${o.amount.toLocaleString()}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            setEditingId(o.id);
                            setOffsetAmount(String(o.amount));
                            setOffsetDesc(o.description);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => deleteOffset.mutate(o.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ),
                )
              ) : !addingOffset ? (
                <p className="text-sm text-muted-foreground text-center py-4">No offsets yet. Add credits, rewards, or reimbursements.</p>
              ) : null}
            </div>
          </section>

          {/* By Category */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">By Category</h2>
            <div className="space-y-4">
              {(Object.entries(budget.by_category) as [string, number][]).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium">{categoryLabels[key] ?? key}</span>
                    <span className="tabular-nums">${value.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${categoryAccents[key] ?? 'bg-muted-foreground/40'} transition-all`}
                      style={{ width: `${maxCategory > 0 ? (value / maxCategory) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* By Location */}
          {budget.by_location && budget.by_location.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">By Location</h2>
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Location</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Nights</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Accommodation</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Transport</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budget.by_location.map((loc, i) => (
                        <tr key={i} className="border-b border-border/40 last:border-0">
                          <td className="py-3 px-4 font-medium">{loc.name}</td>
                          <td className="py-3 px-4 text-right text-muted-foreground tabular-nums">{loc.nights}</td>
                          <td className="py-3 px-4 text-right tabular-nums">${loc.accommodation.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right tabular-nums">${loc.transport.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-semibold tabular-nums">${loc.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

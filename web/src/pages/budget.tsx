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

const categoryColors: Record<string, string> = {
  flights: 'bg-blue-500',
  accommodation: 'bg-purple-500',
  transport: 'bg-orange-500',
  car_rental: 'bg-yellow-500',
  activities: 'bg-green-500',
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
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );

  const maxCategory = budget
    ? Math.max(...Object.values(budget.by_category))
    : 1;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to={`/trips/${tripId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Trip
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Budget</h1>
      </div>

      {budget && budget.routes.length > 1 && (
        <div className="mb-4">
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
        <p className="text-center py-12 text-muted-foreground">No budget data yet. Add routes with costs to see totals.</p>
      ) : (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium">Trip Total</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-bold">${budget.trip_total.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium">Offset</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-bold text-green-600">-${budget.offset.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground font-medium">Out of Pocket</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-bold">${budget.out_of_pocket.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Offsets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Offsets</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAddingOffset(true);
                  setOffsetAmount('');
                  setOffsetDesc('');
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {addingOffset && (
                <div className="flex gap-2 items-end border rounded-md p-2 bg-muted/30">
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
                    <div key={o.id} className="flex gap-2 items-end border rounded-md p-2 bg-muted/30">
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
                    <div key={o.id} className="flex items-center justify-between py-1.5 px-1 group">
                      <span className="text-sm">{o.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-600">${o.amount.toLocaleString()}</span>
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
                <p className="text-sm text-muted-foreground text-center py-2">No offsets yet. Add credits, rewards, or reimbursements.</p>
              ) : null}
            </CardContent>
          </Card>

          {/* By Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.entries(budget.by_category) as [string, number][]).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{categoryLabels[key] ?? key}</span>
                    <span className="font-medium">${value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${categoryColors[key] ?? 'bg-gray-400'} transition-all`}
                      style={{ width: `${maxCategory > 0 ? (value / maxCategory) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* By Location */}
          {budget.by_location && budget.by_location.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By Location</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-muted-foreground">Location</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Nights</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Accommodation</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Transport</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budget.by_location.map((loc, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-medium">{loc.name}</td>
                          <td className="py-2 text-right text-muted-foreground">{loc.nights}</td>
                          <td className="py-2 text-right">${loc.accommodation.toLocaleString()}</td>
                          <td className="py-2 text-right">${loc.transport.toLocaleString()}</td>
                          <td className="py-2 text-right font-semibold">${loc.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

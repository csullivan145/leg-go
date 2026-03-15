import { Link, useParams } from 'react-router';
import { ArrowLeft, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBudget } from '@/hooks/queries/use-budget';

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
  const { data: budget, isLoading } = useBudget(tripId!);

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

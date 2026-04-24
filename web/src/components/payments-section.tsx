import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreatePayment, useDeletePayment } from '@/hooks/queries/use-payments';
import type { LegPayment } from '@leg-go/shared';

interface PaymentsSectionProps {
  legId: string;
  tripId: string;
  routeId: string;
  payments: LegPayment[];
  totalCost: number | null;
  disabled?: boolean;
}

export function PaymentsSection({
  legId,
  tripId,
  routeId,
  payments,
  totalCost,
  disabled = false,
}: PaymentsSectionProps) {
  const createPayment = useCreatePayment(tripId, routeId);
  const deletePayment = useDeletePayment(tripId, routeId);
  const [adding, setAdding] = useState(false);
  const form = useForm({
    defaultValues: { amount: '' as number | '', date: '', note: '' },
  });

  const paid = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const remaining = totalCost != null ? totalCost - paid : null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</h4>
        {totalCost != null && (
          <div className="text-xs text-muted-foreground tabular-nums">
            Paid <span className="font-semibold text-foreground">${paid.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            {remaining != null && (
              <>
                {' · '}
                Left{' '}
                <span className={'font-semibold ' + (remaining <= 0 ? 'text-green-700' : 'text-foreground')}>
                  ${remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {payments
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between text-sm py-1.5 border-b border-border/40"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-medium tabular-nums">${p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              {p.date && (
                <span className="text-xs text-muted-foreground">{format(parseISO(p.date), 'MMM d, yyyy')}</span>
              )}
              {p.note && (
                <span className="text-xs text-muted-foreground truncate">{p.note}</span>
              )}
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive"
                onClick={() => deletePayment.mutate(p.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}

      {!disabled && (adding ? (
        <form
          onSubmit={form.handleSubmit(async (v) => {
            const amount = typeof v.amount === 'number' ? v.amount : parseFloat(String(v.amount));
            if (isNaN(amount) || !v.date) return;
            await createPayment.mutateAsync({
              legId,
              amount,
              date: v.date,
              note: v.note?.trim() ? v.note.trim() : null,
            });
            form.reset({ amount: '', date: '', note: '' });
            setAdding(false);
          })}
          className="flex gap-2 mt-2 items-start flex-wrap"
        >
          <Input
            className="h-8 text-sm w-28"
            type="number"
            step="0.01"
            placeholder="Amount"
            autoFocus
            {...form.register('amount', { valueAsNumber: true, required: true })}
          />
          <Input
            className="h-8 text-sm w-36"
            type="date"
            {...form.register('date', { required: true })}
          />
          <Input
            className="h-8 text-sm flex-1 min-w-32"
            placeholder="Note (e.g. Deposit)"
            {...form.register('note')}
          />
          <Button type="submit" size="sm" variant="outline" disabled={createPayment.isPending}>
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              form.reset({ amount: '', date: '', note: '' });
              setAdding(false);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-2 rounded-md border border-dashed border-border/60 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add payment / deposit
        </button>
      ))}
    </div>
  );
}

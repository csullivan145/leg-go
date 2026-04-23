import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFxRate } from '@/hooks/queries/use-fx';

const CURRENCIES = [
  'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'MXN', 'NZD',
  'INR', 'THB', 'KRW', 'SGD', 'HKD', 'BRL', 'SEK', 'NOK', 'DKK', 'PLN',
] as const;

const LS_KEY = 'leggo:last-fx-currency';

interface CurrencyConverterProps {
  onConvert: (usd: number) => void;
  className?: string;
}

export function CurrencyConverter({ onConvert, className }: CurrencyConverterProps) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<string>(() => {
    if (typeof window === 'undefined') return 'EUR';
    return window.localStorage.getItem(LS_KEY) || 'EUR';
  });
  const [amount, setAmount] = useState('');
  const rate = useFxRate(currency, 'USD');
  const parsed = parseFloat(amount);
  const usd = !isNaN(parsed) && rate.data ? parsed * rate.data : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={'h-8 px-2 text-muted-foreground hover:text-foreground ' + (className ?? '')}
          aria-label="Convert from another currency"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-3">
          <p className="text-xs font-medium">Convert to USD</p>
          <div className="flex gap-2">
            <Select
              value={currency}
              onValueChange={(v) => {
                setCurrency(v);
                window.localStorage.setItem(LS_KEY, v);
              }}
            >
              <SelectTrigger className="h-8 w-24 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.01"
              placeholder="Amount"
              className="h-8 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="text-sm text-center">
            {rate.isLoading ? (
              <span className="text-muted-foreground">Loading rate…</span>
            ) : rate.isError ? (
              <span className="text-destructive">Rate unavailable</span>
            ) : usd != null ? (
              <span className="font-semibold">≈ ${usd.toFixed(2)} USD</span>
            ) : (
              <span className="text-muted-foreground text-xs">
                1 {currency} = ${rate.data?.toFixed(4) ?? '?'}
              </span>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={usd == null}
            onClick={() => {
              if (usd != null) {
                onConvert(Number(usd.toFixed(2)));
                setAmount('');
                setOpen(false);
              }
            }}
          >
            Use ${usd != null ? usd.toFixed(2) : ''} USD
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

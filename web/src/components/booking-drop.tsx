import { useEffect, useRef, useState } from 'react';
import { Upload, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const LOADING_MESSAGES = [
  'Reading the document…',
  'Looking for dates…',
  'Pulling out the address…',
  'Finding the booking total…',
  'Almost done…',
];

export interface BookingDropResult {
  name?: string | null;
  city?: string | null;
  address?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  total_cost?: number | null;
  cost_per_night?: number | null;
  booking_id?: string | null;
  booking_link?: string | null;
  nights?: number | null;
}

interface BookingDropProps {
  onExtracted: (data: BookingDropResult) => void;
  className?: string;
}

export function BookingDrop({ onExtracted, className }: BookingDropProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageIdx, setMessageIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) {
      setMessageIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setMessageIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [loading]);

  async function upload(file: File) {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isImage && !isPdf) {
      setError('Please drop an image or PDF.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/parse/booking', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(body.error || 'Extraction failed');
      }
      const { data } = (await res.json()) as { data: BookingDropResult };
      onExtracted(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border-2 border-dashed px-3 py-3 text-center transition-colors cursor-pointer',
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-border/60 hover:border-primary/40 hover:bg-muted/30',
        loading && 'pointer-events-none border-primary/60 bg-primary/5',
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void upload(file);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = '';
        }}
      />
      {loading && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/15 to-transparent bg-[length:200%_100%] animate-[shimmer_1.8s_linear_infinite]" />
      )}
      <div className="relative flex items-center justify-center gap-2 text-xs">
        {loading ? (
          <>
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span className="text-foreground font-medium tabular-nums">
              {LOADING_MESSAGES[messageIdx]}
            </span>
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              Drop a booking confirmation (image or PDF) to fill these fields
            </span>
          </>
        )}
      </div>
      {error && <p className="relative text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

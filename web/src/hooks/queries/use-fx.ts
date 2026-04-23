import { useQuery } from '@tanstack/react-query';

export function useFxRate(from: string, to: string = 'USD') {
  return useQuery({
    queryKey: ['fx', from, to],
    queryFn: async (): Promise<number> => {
      if (from === to) return 1;
      const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Rate unavailable');
      const data = (await res.json()) as { rates: Record<string, number> };
      const rate = data.rates?.[to];
      if (typeof rate !== 'number') throw new Error('Rate missing');
      return rate;
    },
    enabled: !!from && !!to,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });
}

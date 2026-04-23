import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Config {
  googleMapsApiKey: string | null;
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<Config>('/api/config'),
    staleTime: Infinity,
  });
}

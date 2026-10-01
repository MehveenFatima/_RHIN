import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Dashboards poll so that a report synced on a field worker's phone shows up for officers without a reload. */
const LIVE = { refetchInterval: 15_000, refetchOnWindowFocus: true } as const;

export const useHealth = () => useQuery({ queryKey: ["health"], queryFn: api.health, staleTime: 60_000, retry: 1 });
export const useAlerts = () => useQuery({ queryKey: ["alerts"], queryFn: api.alerts, ...LIVE });
export const useStats = () => useQuery({ queryKey: ["stats"], queryFn: api.stats, ...LIVE });
export const useTrends = () => useQuery({ queryKey: ["trends"], queryFn: () => api.trends(7), ...LIVE });
export const useTopVillages = () => useQuery({ queryKey: ["top-villages"], queryFn: () => api.topVillages(7), ...LIVE });
export const usePlans = () => useQuery({ queryKey: ["plans"], queryFn: api.plans, ...LIVE });

/** Wrap a mutation so every dashboard query is refreshed after it succeeds. */
export function useApiMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

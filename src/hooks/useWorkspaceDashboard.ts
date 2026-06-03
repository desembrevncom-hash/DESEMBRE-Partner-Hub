import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceExecutionData } from "@/types/workspace";
import { useAuth } from "@/hooks/useAuth";

const CACHE_KEY = "workspace_execution_data";
const CACHE_TTL_MS = 0; // Disable cache to always show fresh metrics

interface CacheItem {
  timestamp: number;
  data: WorkspaceExecutionData;
}

export function useWorkspaceDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<WorkspaceExecutionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(
    async (forceRefresh = false) => {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        // Check cache first if not forced
        if (!forceRefresh) {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsedCache: CacheItem = JSON.parse(cached);
            if (Date.now() - parsedCache.timestamp < CACHE_TTL_MS) {
              setData(parsedCache.data);
              setLoading(false);
              return;
            }
          }
        }

        // Fetch from RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "get_workspace_execution_dashboard",
        );

        if (rpcError) throw rpcError;

        const parsedData = rpcData as WorkspaceExecutionData;
        setData(parsedData);

        // Save to cache
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            data: parsedData,
          }),
        );
      } catch (err: any) {
        console.error("Error fetching workspace execution dashboard:", err);
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchDashboardData(true),
  };
}

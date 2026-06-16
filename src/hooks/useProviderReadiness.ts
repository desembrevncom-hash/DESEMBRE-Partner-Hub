import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProviderAccount, ProviderTemplateMapping, ProviderReadinessLog } from "@/types/marketing-provider";

export function useProviderReadiness() {
  const queryClient = useQueryClient();

  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ["m6-provider-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_provider_accounts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProviderAccount[];
    }
  });

  const getAccountMappings = (accountId: string) => useQuery({
    queryKey: ["m6-provider-mappings", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_provider_template_mappings").select("*").eq("provider_account_id", accountId);
      if (error) throw error;
      return data as ProviderTemplateMapping[];
    },
    enabled: !!accountId
  });

  const getAuditLogs = (entityId: string) => useQuery({
    queryKey: ["m6-provider-logs", entityId],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_provider_readiness_logs").select("*").eq("entity_id", entityId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProviderReadinessLog[];
    },
    enabled: !!entityId
  });

  return {
    accounts,
    loadingAccounts,
    getAccountMappings,
    getAuditLogs
  };
}

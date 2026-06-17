import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UpdateConsentPayload, BulkImportPayload, ConsentHistoryRecord, ConsentSummary } from "@/types/marketing_m8";

export function useM8ConsentRegistry() {
  const [loading, setLoading] = useState(false);

  const updateConsent = async (payload: UpdateConsentPayload) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("m8_update_customer_consent", payload);
      if (error) throw error;
      toast.success("Consent updated successfully");
      return data;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update consent");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const bulkImportConsent = async (payload: BulkImportPayload) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("m8_bulk_import_consent", payload);
      if (error) throw error;
      if (payload.p_dry_run) {
        toast.success("Dry-run completed");
      } else {
        toast.success("Bulk import completed successfully");
      }
      return data;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Bulk import failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getHistory = async (customerId: string): Promise<ConsentHistoryRecord[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("m8_get_customer_consent_history", {
        p_customer_id: customerId,
      });
      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load consent history");
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getSummary = async (customerId: string): Promise<ConsentSummary[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("m8_get_customer_consent_summary", {
        p_customer_id: customerId,
      });
      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load consent summary");
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    updateConsent,
    bulkImportConsent,
    getHistory,
    getSummary,
  };
}

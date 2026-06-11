import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ManualReviewJob {
  id: string;
  customer_id: string;
  raw_url: string;
  status: 'pending' | 'resolved' | 'failed' | 'manual_review_required' | 'duplicate_candidate' | 'ignored';
  created_at: string;
  customers?: {
    id: string;
    name: string;
    phone: string | null;
    owner_sale_id: string | null;
  };
  auto_resolve_status?: 'not_attempted' | 'queued' | 'resolving' | 'resolved' | 'failed' | 'timeout' | 'rate_limited' | 'disabled' | 'cached' | 'skipped_invalid_type' | 'duplicate_detected';
  duplicate_social_profile_id?: string | null;
  duplicate_profile?: {
    customer_id: string;
    customers?: {
      id: string;
      name: string;
      phone: string | null;
    };
  } | null;
  auto_resolve_attempts?: number;
  last_auto_resolve_at?: string | null;
  last_auto_resolve_error?: string | null;
}

export function useCustomerFacebookIdentityQuery(customerId: string) {
  return useQuery({
    queryKey: ["facebook-identity", customerId],
    queryFn: async () => {
      // Fetch social profiles
      const { data: profiles } = await supabase
        .from("customer_social_profiles")
        .select("*")
        .eq("customer_id", customerId)
        .eq("platform", "facebook");
        
      // Fetch jobs
      const { data: jobs } = await supabase
        .from("facebook_identity_resolution_jobs")
        .select(`
          *,
          duplicate_profile:customer_social_profiles!duplicate_social_profile_id (
            customer_id,
            customers!customer_id (id, name, phone)
          )
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      // Fetch resolver results for debug
      const { data: results } = await supabase
        .from("facebook_uid_resolver_results")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      return { profiles: profiles || [], jobs: jobs || [], results: results || [] };
    },
    enabled: !!customerId,
    refetchInterval: (query) => {
      const hasPending = query.state.data?.jobs?.some((j: any) => j.status === "manual_review_required");
      return hasPending ? 3000 : false;
    },
  });
}

export function useManualReviewJobsQuery() {
  return useQuery({
    queryKey: ["facebook-identity-manual-review-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_identity_resolution_jobs")
        .select(`
          id,
          customer_id,
          raw_url,
          status,
          created_at,
          auto_resolve_status,
          auto_resolve_attempts,
          last_auto_resolve_at,
          last_auto_resolve_error,
          duplicate_social_profile_id,
          duplicate_profile:customer_social_profiles!duplicate_social_profile_id (
            customer_id,
            customers!customer_id (
              id,
              name,
              phone
            )
          ),
          customers!customer_id (
            id,
            name,
            phone,
            owner_sale_id
          )
        `)
        .in("status", ["manual_review_required", "duplicate_candidate"])
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data || []) as unknown as ManualReviewJob[];
    },
  });
}

export interface ResolveManualJobPayload {
  jobId: string;
  numericUid?: string | null;
  status: 'resolved' | 'failed' | 'ignored' | 'duplicate_candidate';
  note?: string | null;
  facebookName?: string | null;
}

export function useResolveManualReviewJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ResolveManualJobPayload) => {
      const { data, error } = await supabase.rpc("resolve_facebook_identity_manual_review", {
        p_job_id: payload.jobId,
        p_numeric_uid: payload.numericUid || null,
        p_status: payload.status,
        p_note: payload.note || null,
        p_facebook_display_name: payload.facebookName || null,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facebook-identity-manual-review-jobs"] });
    },
  });
}

export function useTriggerAutoResolveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("resolve-facebook-uid", {
        body: { job_id: jobId },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.error) {
        throw new Error(data.error + (data.stack ? "\\n" + data.stack : ""));
      }

      // Check if Edge Function returned an error in the payload
      if (data && data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facebook-identity-manual-review-jobs"] });
    },
  });
}

export function useApplyFacebookNameMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, name }: { customerId: string; name: string }) => {
      const cleanName = name.trim();

      // Get current customer name state
      const { data: current, error: fetchError } = await supabase
        .from("customers")
        .select("name, contact_name")
        .eq("id", customerId)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const updates: any = {
        contact_name: cleanName,
      };

      const currentName = current.name || "";
      const isNameEmptyOrUrl =
        !currentName.trim() ||
        currentName.includes("facebook.com") ||
        currentName.includes("http") ||
        currentName.includes("profile.php");

      if (isNameEmptyOrUrl) {
        updates.name = cleanName;
      }

      const { data, error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", customerId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ["contact-channels", variables.customerId] });
      window.dispatchEvent(new Event("customer_timeline_refresh"));
      window.dispatchEvent(new CustomEvent("customer_updated", { detail: { id: variables.customerId } }));
    },
  });
}

export function useFetchMissingFacebookNameMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, rawUrl }: { customerId: string; rawUrl: string }) => {
      // 1. Find if a job already exists for this raw_url
      const { data: existingJobs } = await supabase
        .from("facebook_identity_resolution_jobs")
        .select("id, status")
        .eq("customer_id", customerId)
        .eq("raw_url", rawUrl)
        .order("created_at", { ascending: false })
        .limit(1);

      let jobId = existingJobs?.[0]?.id;

      // 2. If no job, create one
      if (!jobId) {
        const { data: newJob, error: insertError } = await supabase
          .from("facebook_identity_resolution_jobs")
          .insert({
            customer_id: customerId,
            raw_url: rawUrl,
            status: "manual_review_required",
          })
          .select("id")
          .single();
          
        if (insertError) throw new Error("Could not create resolution job: " + insertError.message);
        jobId = newJob.id;
      } else {
        // If job exists but is resolved, reset it so we can run edge function again
        await supabase
          .from("facebook_identity_resolution_jobs")
          .update({ status: "manual_review_required" })
          .eq("id", jobId);
      }

      // 3. Trigger edge function
      const { data, error } = await supabase.functions.invoke("resolve-facebook-uid", {
        body: { job_id: jobId },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["facebook-identity", variables.customerId] });
    },
  });
}

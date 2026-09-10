import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_BRANDING, type BrandSettings } from "@/config/branding";

export interface BrandingData {
  siteName: string;
  headerLogoUrl: string;
  logoMarkUrl: string;
  faviconUrl: string;
  appleTouchIconUrl: string;
  updatedAt?: string;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useBranding(): BrandingData {
  const [settings, setSettings] = useState<BrandSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBranding = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchErr } = await supabase
        .from("brand_settings" as any)
        .select("id, site_name, header_logo_url, logo_mark_url, favicon_url, apple_touch_icon_url, updated_at")
        .eq("id", "default")
        .maybeSingle();

      // Check system_settings for legacy uploaded logo as secondary fallback
      let systemLogoLight: string | null = null;
      try {
        const { data: sysData } = await supabase
          .from("system_settings" as any)
          .select("logo_light_url")
          .maybeSingle();
        if (sysData?.logo_light_url && typeof sysData.logo_light_url === "string") {
          systemLogoLight = sysData.logo_light_url.trim();
        }
      } catch {
        // Ignore error
      }

      if (fetchErr) {
        // Safe fallback - do not crash public page if table or DB has an issue
        console.warn("[useBranding] Warning fetching brand settings, using fallback:", fetchErr.message);
        setSettings({
          ...DEFAULT_BRANDING,
          header_logo_url: systemLogoLight || DEFAULT_BRANDING.header_logo_url,
          logo_mark_url: systemLogoLight || DEFAULT_BRANDING.logo_mark_url,
        });
      } else if (data) {
        const merged: BrandSettings = {
          id: data.id || DEFAULT_BRANDING.id,
          site_name: data.site_name?.trim() || DEFAULT_BRANDING.site_name,
          header_logo_url: data.header_logo_url?.trim() || systemLogoLight || DEFAULT_BRANDING.header_logo_url,
          logo_mark_url: data.logo_mark_url?.trim() || systemLogoLight || DEFAULT_BRANDING.logo_mark_url,
          favicon_url: data.favicon_url?.trim() || systemLogoLight || DEFAULT_BRANDING.favicon_url,
          apple_touch_icon_url: data.apple_touch_icon_url?.trim() || systemLogoLight || DEFAULT_BRANDING.apple_touch_icon_url,
          updated_at: data.updated_at,
        };
        setSettings(merged);
      } else {
        setSettings({
          ...DEFAULT_BRANDING,
          header_logo_url: systemLogoLight || DEFAULT_BRANDING.header_logo_url,
          logo_mark_url: systemLogoLight || DEFAULT_BRANDING.logo_mark_url,
        });
      }
    } catch (err: any) {
      console.warn("[useBranding] Error in branding hook, using default fallback:", err);
      setError(err);
      setSettings(DEFAULT_BRANDING);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  return {
    siteName: settings.site_name,
    headerLogoUrl: settings.header_logo_url || DEFAULT_BRANDING.header_logo_url!,
    logoMarkUrl: settings.logo_mark_url || DEFAULT_BRANDING.logo_mark_url!,
    faviconUrl: settings.favicon_url || DEFAULT_BRANDING.favicon_url!,
    appleTouchIconUrl: settings.apple_touch_icon_url || DEFAULT_BRANDING.apple_touch_icon_url!,
    updatedAt: settings.updated_at,
    loading,
    error,
    refetch: fetchBranding,
  };
}

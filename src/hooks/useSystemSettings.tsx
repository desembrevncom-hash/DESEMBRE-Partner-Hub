import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setPricingSettings } from "@/lib/pricing";

type SystemSettings = {
  vatRate: number;
  defaultDiscount: number;
  companyName: string;
  supportPhone: string;
  supportEmail: string;
  leadOverdueDays: number;
  pilotModeEnabled: boolean;
  routingNearKm: number;
  routingCityKm: number;
  routingFarKm: number;
  reloadSettings: () => void;
};

const defaultSettings: SystemSettings = {
  vatRate: 0.1, // Default 10%
  defaultDiscount: 0.35, // Default 35%
  companyName: "DESEMBRE VIETNAM",
  supportPhone: "1900 6868",
  supportEmail: "support@desembre.vn",
  leadOverdueDays: 3,
  pilotModeEnabled: true,
  routingNearKm: 10,
  routingCityKm: 30,
  routingFarKm: 80,
  reloadSettings: () => {},
};

const SettingsContext = createContext<SystemSettings>(defaultSettings);

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);

  const fetchSettings = () => {
    supabase
      .from("system_settings")
      .select("*")
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data) {
          const vat = (data.vat_rate ?? 10) / 100;
          const discount = (data.default_discount ?? 35) / 100;
          setSettings((prev) => ({
            ...prev,
            vatRate: vat,
            defaultDiscount: discount,
            companyName: data.company_name || defaultSettings.companyName,
            supportPhone: data.support_phone || defaultSettings.supportPhone,
            supportEmail: data.support_email || defaultSettings.supportEmail,
            leadOverdueDays: data.lead_overdue_days ?? defaultSettings.leadOverdueDays,
            pilotModeEnabled: data.pilot_mode_enabled ?? defaultSettings.pilotModeEnabled,
            routingNearKm: data.routing_near_km ?? defaultSettings.routingNearKm,
            routingCityKm: data.routing_city_km ?? defaultSettings.routingCityKm,
            routingFarKm: data.routing_far_km ?? defaultSettings.routingFarKm,
          }));
          setPricingSettings(vat, discount);
        }
      });
  };

  useEffect(() => {
    fetchSettings();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        fetchSettings();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SettingsContext.Provider value={{ ...settings, reloadSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSystemSettings() {
  return useContext(SettingsContext);
}

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
};

const defaultSettings: SystemSettings = {
  vatRate: 0.1, // Default 10%
  defaultDiscount: 0.35, // Default 35%
  companyName: "DESEMBRE VIETNAM",
  supportPhone: "1900 6868",
  supportEmail: "support@desembre.vn",
  leadOverdueDays: 3,
};

const SettingsContext = createContext<SystemSettings>(defaultSettings);

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);

  useEffect(() => {
    supabase.from('system_settings').select('*').maybeSingle()
      .then(({ data }) => {
        if (data) {
          const vat = (data.vat_rate || 10) / 100;
          const discount = (data.default_discount || 35) / 100;
          setSettings({
            vatRate: vat,
            defaultDiscount: discount,
            companyName: data.company_name || defaultSettings.companyName,
            supportPhone: data.support_phone || defaultSettings.supportPhone,
            supportEmail: data.support_email || defaultSettings.supportEmail,
            leadOverdueDays: data.lead_overdue_days ?? defaultSettings.leadOverdueDays,
          });
          setPricingSettings(vat, discount);
        }
      });
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSystemSettings() {
  return useContext(SettingsContext);
}

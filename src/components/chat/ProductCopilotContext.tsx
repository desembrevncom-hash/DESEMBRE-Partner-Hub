import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerContextData {
  currentCustomerId: string;
  customerName: string;
  city?: string;
  stage?: string;
  tags?: string[];
  primaryConcern?: string;
  lastInteractionSummary?: string;
}

export interface CopilotSettings {
  enabled: boolean;
  sale_enabled: boolean;
  admin_enabled: boolean;
  require_context: boolean;
  daily_limit: number;
}

export interface QuickReply {
  id: string;
  title: string;
  prompt: string;
  category: string;
  requires_context: boolean;
  sort_order: number;
}

interface ProductCopilotContextType {
  customerContext: CustomerContextData | null;
  setCustomerContext: (context: CustomerContextData | null) => void;
  settings: CopilotSettings | null;
  quickReplies: QuickReply[];
}

const ProductCopilotContext = createContext<ProductCopilotContextType | undefined>(undefined);

export function ProductCopilotProvider({ children }: { children: ReactNode }) {
  const [customerContext, setCustomerContext] = useState<CustomerContextData | null>(null);
  const [settings, setSettings] = useState<CopilotSettings | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: aiSettings } = await supabase.rpc('get_ai_settings_masked');
        if (aiSettings) {
          setSettings({
            enabled: aiSettings.product_copilot_enabled ?? true,
            sale_enabled: aiSettings.product_copilot_sale_enabled ?? true,
            admin_enabled: aiSettings.product_copilot_admin_enabled ?? true,
            require_context: aiSettings.product_copilot_require_context ?? false,
            daily_limit: aiSettings.product_copilot_daily_limit ?? 50,
          });
        }
        
        const { data: qrData } = await supabase
          .from('product_copilot_quick_replies')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
          
        if (qrData) {
          setQuickReplies(qrData as QuickReply[]);
        }
      } catch (err) {
        console.error('Failed to fetch copilot settings:', err);
      }
    };
    
    fetchSettings();
  }, []);

  return (
    <ProductCopilotContext.Provider value={{ customerContext, setCustomerContext, settings, quickReplies }}>
      {children}
    </ProductCopilotContext.Provider>
  );
}

export function useCopilotContext() {
  const context = useContext(ProductCopilotContext);
  if (context === undefined) {
    throw new Error('useCopilotContext must be used within a ProductCopilotProvider');
  }
  return context;
}

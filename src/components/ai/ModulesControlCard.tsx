// src/components/ai/ModulesControlCard.tsx
import React from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ModuleSettings {
  module_product_tutor: boolean;
  module_rewrite: boolean;
  module_customer_summary: boolean;
  module_sales_assistant: boolean;
}

interface Props {
  settings: ModuleSettings | null;
  onChange?: (updated: Partial<ModuleSettings>) => void;
}

export const ModulesControlCard: React.FC<Props> = ({ settings, onChange }) => {
  if (!settings) return null;

  const toggle = (key: keyof ModuleSettings) => {
    onChange?.({ [key]: !settings[key] });
  };

  const modules: { key: keyof ModuleSettings; label: string; description: string }[] = [
    { key: "module_product_tutor", label: "Product Tutor", description: "AI training & product knowledge embedding" },
    { key: "module_rewrite", label: "Rewrite Suggestions", description: "AI rewrites sales suggestions" },
    { key: "module_customer_summary", label: "Customer Summary", description: "AI generates customer overview" },
    { key: "module_sales_assistant", label: "Sales Assistant", description: "AI sales assistant full pipeline" },
  ];

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-800">Modules Control</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {modules.map((mod) => (
          <div key={mod.key} className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-700">{mod.label}</span>
              <p className="text-xs text-slate-400">{mod.description}</p>
            </div>
            <Switch
              checked={settings[mod.key]}
              onCheckedChange={() => toggle(mod.key)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ModulesControlCard;

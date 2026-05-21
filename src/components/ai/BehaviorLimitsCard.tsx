// src/components/ai/BehaviorLimitsCard.tsx
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Settings {
  max_tokens: number | null;
  temperature: number | null;
  daily_token_limit: number | null;
  monthly_cost_limit: number | null;
  system_tone: string;
}

interface Props {
  settings: Settings | null;
  onChange: (updated: Partial<Settings>) => void;
  disabled?: boolean;
  loading?: boolean;
}

export const BehaviorLimitsCard: React.FC<Props> = ({
  settings,
  onChange,
  disabled = false,
  loading = false,
}) => {
  if (!settings) return null;

  const updateField = (field: keyof Settings, value: any) => {
    onChange({ [field]: value });
  };

  const toneOptions = [
    { value: "professional_spa", label: "Professional (SPA)" },
    { value: "luxury", label: "Luxury" },
    { value: "friendly_telesale", label: "Friendly Telesale" },
    { value: "clinical", label: "Clinical" },
  ];

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-800">Behavior & Limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Max Tokens */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-slate-600" htmlFor="maxTokens">
            Max Tokens
          </Label>
          <Input
            id="maxTokens"
            type="number"
            min={1}
            value={settings.max_tokens ?? ""}
            disabled={disabled || loading}
            className="w-[120px]"
            onChange={e =>
              updateField("max_tokens", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </div>
        {/* Temperature */}
        <div className="flex flex-col space-y-2">
          <Label className="text-sm font-medium text-slate-600" htmlFor="temperature">
            Temperature (0‑1)
          </Label>
          <div className="flex items-center space-x-4">
            <Slider
              id="temperature"
              min={0}
              max={1}
              step={0.01}
              value={[settings.temperature ?? 0]}
              disabled={disabled || loading}
              onValueChange={vals => updateField("temperature", vals[0])}
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={settings.temperature ?? ""}
              disabled={disabled || loading}
              className="w-[80px]"
              onChange={e => {
                const val = e.target.value === "" ? null : Number(e.target.value);
                if (val === null || (val >= 0 && val <= 1)) {
                  updateField("temperature", val);
                }
              }}
            />
          </div>
        </div>
        {/* Daily Token Limit */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-slate-600" htmlFor="dailyTokenLimit">
            Daily Token Limit
          </Label>
          <Input
            id="dailyTokenLimit"
            type="number"
            min={0}
            value={settings.daily_token_limit ?? ""}
            disabled={disabled || loading}
            className="w-[120px]"
            placeholder="optional"
            onChange={e =>
              updateField(
                "daily_token_limit",
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
          />
        </div>
        {/* Monthly Cost Limit */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-slate-600" htmlFor="monthlyCostLimit">
            Monthly Cost Limit
          </Label>
          <Input
            id="monthlyCostLimit"
            type="number"
            min={0}
            value={settings.monthly_cost_limit ?? ""}
            disabled={disabled || loading}
            className="w-[120px]"
            placeholder="optional"
            onChange={e =>
              updateField(
                "monthly_cost_limit",
                e.target.value === "" ? null : Number(e.target.value)
              )
            }
          />
        </div>
        {/* System Tone */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-slate-600" htmlFor="systemTone">
            System Tone
          </Label>
          <Select
            value={settings.system_tone}
            disabled={disabled || loading}
            onValueChange={value => updateField("system_tone", value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select tone" />
            </SelectTrigger>
            <SelectContent>
              {toneOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default BehaviorLimitsCard;

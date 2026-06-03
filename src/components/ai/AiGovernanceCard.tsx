import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ShieldAlert } from "lucide-react";

interface AiGovernanceCardProps {
  settings: any;
  onChange: (updated: Partial<any>) => void;
}

export default function AiGovernanceCard({ settings, onChange }: AiGovernanceCardProps) {
  if (!settings) return null;

  return (
    <Card className="border-rose-200 shadow-md">
      <CardHeader className="bg-rose-50 border-b border-rose-100 rounded-t-xl">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <div>
            <CardTitle className="text-rose-900">AI Governance & Safety</CardTitle>
            <CardDescription className="text-rose-700">
              Kiểm soát các công tắc an toàn trước khi mở public
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-0.5">
            <Label className="text-base font-bold text-slate-900">Global AI Enable</Label>
            <p className="text-xs text-slate-500">
              Bật/tắt toàn bộ tính năng AI trên toàn hệ thống (Master Switch).
            </p>
          </div>
          <Switch
            checked={settings.ai_enabled || false}
            onCheckedChange={(checked) => onChange({ ai_enabled: checked })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
            <div className="space-y-0.5">
              <Label>Customer Suggestions</Label>
              <p className="text-[10px] text-slate-500">Gợi ý hành động tiếp theo</p>
            </div>
            <Switch
              checked={settings.ai_customer_suggestions_enabled || false}
              onCheckedChange={(checked) => onChange({ ai_customer_suggestions_enabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
            <div className="space-y-0.5">
              <Label>Sales Assistant (Chat)</Label>
              <p className="text-[10px] text-slate-500">Trợ lý ảo chat với sale</p>
            </div>
            <Switch
              checked={settings.ai_sales_assistant_enabled || false}
              onCheckedChange={(checked) => onChange({ ai_sales_assistant_enabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
            <div className="space-y-0.5">
              <Label>RAG / Product Tutor</Label>
              <p className="text-[10px] text-slate-500">Tra cứu tri thức sản phẩm</p>
            </div>
            <Switch
              checked={settings.ai_rag_enabled || false}
              onCheckedChange={(checked) => onChange({ ai_rag_enabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
            <div className="space-y-0.5">
              <Label>AI Rewrite / Compose</Label>
              <p className="text-[10px] text-slate-500">Viết lại tin nhắn/Email</p>
            </div>
            <Switch
              checked={settings.ai_rewrite_enabled || false}
              onCheckedChange={(checked) => onChange({ ai_rewrite_enabled: checked })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div className="space-y-2">
            <Label>Daily Usage Limit</Label>
            <Input
              type="number"
              value={settings.ai_daily_limit || 0}
              onChange={(e) => onChange({ ai_daily_limit: parseInt(e.target.value) || 0 })}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">
              Số lần gọi AI tối đa mỗi ngày toàn hệ thống
            </p>
          </div>
          <div className="space-y-2">
            <Label>Cache Duration (Minutes)</Label>
            <Input
              type="number"
              value={settings.ai_cache_minutes || 0}
              onChange={(e) => onChange({ ai_cache_minutes: parseInt(e.target.value) || 0 })}
              className="w-full"
            />
            <p className="text-[10px] text-slate-500">Thời gian lưu cache kết quả RAG/Suggestion</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

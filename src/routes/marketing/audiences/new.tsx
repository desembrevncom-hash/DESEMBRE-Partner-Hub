// @ts-nocheck
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getAudienceStats } from "@/lib/marketing/segmentRules";
import { FilterRulesJson, SegmentRule, AudienceStats, MarketingVisibility } from "@/lib/marketing/types";
import { Loader2, Save, Users, AlertTriangle, PhoneOff, MailX, AlertCircle, Plus } from "lucide-react";

export const Route = createFileRoute("/marketing/audiences/new")({
  component: AudienceBuilderNewPage,
});

const DEFAULT_RULE: SegmentRule = { field: "has_valid_phone", operator: "equals", value: true };

function AudienceBuilderNewPage() {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [stats, setStats] = useState<AudienceStats | null>(null);
  const [rules, setRules] = useState<FilterRulesJson>({
    group: { type: "AND", rules: [{ ...DEFAULT_RULE }] }
  });
  
  // Save Modal State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<MarketingVisibility>("private");
  const [saving, setSaving] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    evaluateRules();
  }, [rules, customers]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase.from("customers").select("*");
      if (error) throw error;
      setCustomers(data || []);
    } catch (e: any) {
      toast.error("Failed to load customers: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const evaluateRules = () => {
    if (customers.length === 0) return;
    setEvaluating(true);
    setTimeout(() => {
      try {
        const newStats = getAudienceStats(customers, rules);
        setStats(newStats);
      } catch (e) {
        console.error(e);
      } finally {
        setEvaluating(false);
      }
    }, 100);
  };

  const handleAddRule = () => {
    setRules(prev => ({
      group: {
        ...prev.group,
        rules: [...prev.group.rules, { ...DEFAULT_RULE }]
      }
    }));
  };

  const handleUpdateRule = (index: number, updates: Partial<SegmentRule>) => {
    setRules(prev => {
      const newRules = [...prev.group.rules];
      newRules[index] = { ...newRules[index], ...updates } as SegmentRule;
      return { group: { ...prev.group, rules: newRules } };
    });
  };

  const handleRemoveRule = (index: number) => {
    setRules(prev => {
      const newRules = [...prev.group.rules];
      newRules.splice(index, 1);
      return { group: { ...prev.group, rules: newRules } };
    });
  };

  const handleSave = async () => {
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        visibility,
        filter_rules_json: rules,
        created_by: user?.id,
        last_preview_count: stats?.matched_customers || 0,
        last_previewed_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from("marketing_segments").insert([payload]).select().single();
      if (error) throw error;
      toast.success("Segment saved successfully!");
      navigate({ to: `/marketing/audiences/${data.id}` });
    } catch (e: any) {
      toast.error("Failed to save segment: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tạo nhóm khách hàng</h1>
          <p className="text-muted-foreground mt-2">
            Tạo điều kiện lọc khách hàng để xuất tệp marketing.
          </p>
          <p className="text-sm font-medium text-amber-600 mt-1">
            Dùng bộ lọc này để tạo tệp khách hàng trước khi export. Hệ thống chưa gửi tin nhắn tự động.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Rule Builder */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Điều kiện lọc khách hàng</CardTitle>
              <CardDescription>Khách hàng phải thỏa mãn tất cả điều kiện bên dưới.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rules.group.rules.map((rule: any, i: number) => (
                <div key={i} className="flex flex-col sm:flex-row gap-3 items-end bg-muted/30 p-3 rounded-lg border">
                  <div className="flex-1 space-y-1">
                    <Label>Trường dữ liệu</Label>
                    <Select value={rule.field} onValueChange={(val) => handleUpdateRule(i, { field: val as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stage">Giai đoạn</SelectItem>
                        <SelectItem value="source">Nguồn</SelectItem>
                        <SelectItem value="province">Tỉnh/Thành phố</SelectItem>
                        <SelectItem value="has_valid_phone">Có số điện thoại hợp lệ</SelectItem>
                        <SelectItem value="has_zalo_capable_phone">Có thể liên hệ Zalo</SelectItem>
                        <SelectItem value="has_email">Có email</SelectItem>
                        <SelectItem value="phone_is_facebook_uid">Dữ liệu là Facebook UID, không phải SĐT</SelectItem>
                        <SelectItem value="phone_possibly_missing_leading_zero">SĐT có thể thiếu số 0 đầu</SelectItem>
                        <SelectItem value="UNASSIGNED">Chưa có người phụ trách</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label>Điều kiện</Label>
                    <Select value={rule.operator} onValueChange={(val) => handleUpdateRule(i, { operator: val as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">Bằng</SelectItem>
                        <SelectItem value="not_equals">Khác</SelectItem>
                        <SelectItem value="contains">Chứa</SelectItem>
                        <SelectItem value="exists">Có dữ liệu</SelectItem>
                        <SelectItem value="not_exists">Không có dữ liệu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label>Giá trị</Label>
                    {rule.operator === "equals" && typeof rule.value === "boolean" ? (
                      <Select value={String(rule.value)} onValueChange={(val) => handleUpdateRule(i, { value: val === "true" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Có</SelectItem>
                          <SelectItem value="false">Không</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input 
                        value={rule.value || ""} 
                        onChange={(e) => handleUpdateRule(i, { value: e.target.value })} 
                        disabled={["exists", "not_exists"].includes(rule.operator)}
                      />
                    )}
                  </div>
                  <Button variant="destructive" size="icon" onClick={() => handleRemoveRule(i)}>
                    &times;
                  </Button>
                </div>
              ))}
              
              <Button variant="outline" onClick={handleAddRule} className="w-full border-dashed border-primary/50 text-primary hover:bg-primary/5">
                <Plus className="mr-2 h-4 w-4" /> Thêm điều kiện
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Xem trước kết quả ({stats?.sample.length || 0} khách mẫu)</CardTitle>
            </CardHeader>
            <CardContent>
              {evaluating ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : stats?.sample.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3">Tên khách hàng</th>
                        <th className="px-4 py-3">Số điện thoại</th>
                        <th className="px-4 py-3">Cảnh báo dữ liệu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stats.sample.map(c => (
                        <tr key={c.id}>
                          <td className="px-4 py-3 font-medium">{c.name || c.contact_name || "Khách chưa có tên"}</td>
                          <td className="px-4 py-3">{c.phone || "-"}</td>
                          <td className="px-4 py-3">
                            {getWarnings(c).map((w: string, i: number) => (
                              <Badge key={i} variant="destructive" className="mr-1 text-[10px]">{w}</Badge>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground py-4 text-center">Không có khách hàng nào thỏa mãn điều kiện này.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Stats & Save */}
        <div className="space-y-6 lg:sticky lg:top-24 h-max">
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle>Thống kê nhóm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {evaluating ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  <div className="bg-background rounded-lg p-4 border text-center">
                    <p className="text-sm text-muted-foreground">Khách phù hợp</p>
                    <p className="text-4xl font-bold text-primary">{stats?.matched_customers || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">trong tổng số {stats?.total_customers || 0} khách</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex flex-col bg-background p-2 rounded border">
                      <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3"/> Có thể gọi</span>
                      <span className="font-semibold">{stats?.callable_count || 0}</span>
                    </div>
                    <div className="flex flex-col bg-background p-2 rounded border">
                      <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3"/> Có thể Zalo</span>
                      <span className="font-semibold">{stats?.zalo_count || 0}</span>
                    </div>
                  </div>
                  
                  {stats && stats.data_quality_issue_count > 0 && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20 text-sm mt-4">
                      <div className="flex items-center gap-2 font-medium mb-1">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Cảnh báo dữ liệu ({stats.data_quality_issue_count})</span>
                      </div>
                      <ul className="list-disc pl-5 text-xs opacity-90 space-y-1 mt-2">
                        {Object.entries(stats.skipped_reasons).map(([reason, count]) => (
                          <li key={reason}>{reason}: {count}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lưu nhóm khách hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-[11px] font-medium text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 mb-2 leading-relaxed">
                <AlertCircle className="w-3 h-3 inline mr-1 mb-[2px]" />
                Module này chỉ tạo nhóm và xuất file, không gửi chiến dịch.
              </div>
              <div className="space-y-2">
                <Label>Tên nhóm khách hàng</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Khách hàng VIP Hà Nội" />
              </div>
              <div className="space-y-2">
                <Label>Mô tả</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả thêm (không bắt buộc)..." />
              </div>
              <div className="space-y-2">
                <Label>Quyền hiển thị</Label>
                <Select value={visibility} onValueChange={(val) => setVisibility(val as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Riêng tư, chỉ mình tôi</SelectItem>
                    {(isAdmin || isSubAdmin) && <SelectItem value="public_to_org">Công khai trong hệ thống</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={saving || !name}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Lưu nhóm khách hàng
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper to get warnings for the preview table
function getWarnings(customer: any) {
  const warnings = [];
  if (!customer.phone) warnings.push("THIẾU SĐT");
  else if (customer.phone.length > 12 && customer.phone.startsWith("100")) warnings.push("FB UID KHÔNG PHẢI SĐT");
  else if (customer.phone.length === 9 && !customer.phone.startsWith("0")) warnings.push("CÓ THỂ THIẾU SỐ 0");
  if (!customer.email) warnings.push("THIẾU EMAIL");
  if (!customer.owner_sale_id && !customer.owner_tele_id) warnings.push("UNASSIGNED");
  return warnings;
}

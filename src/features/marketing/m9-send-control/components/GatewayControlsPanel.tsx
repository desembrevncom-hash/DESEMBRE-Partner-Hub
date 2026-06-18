import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { m9SendControlApi } from "../api/m9SendControlApi";
import { ShieldAlert, Loader2 } from "lucide-react";

export function GatewayControlsPanel() {
  const [controls, setControls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isProduction = import.meta.env.VITE_APP_ENV === "production";

  useEffect(() => {
    fetchControls();
  }, []);

  const fetchControls = async () => {
    try {
      setLoading(true);
      const data = await m9SendControlApi.getGatewayControls();
      setControls(data || []);
    } catch (e: any) {
      toast.error(`Lỗi tải cấu hình gateway: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (scope: string, enabled: boolean) => {
    if (isProduction && enabled) {
      toast.error("Safety Blocked: Môi trường Production nghiêm cấm bật gateway_enabled=true (Chặn gửi tin nhắn thật).");
      return;
    }
    
    try {
      const reason = "Thao tác tay trên UI";
      await m9SendControlApi.toggleGatewayControl(scope, enabled, reason);
      toast.success(`Cập nhật Gateway: Gateway cho phạm vi '${scope}' hiện đang ${enabled ? "BẬT" : "TẮT"}`);
      await fetchControls();
    } catch (e: any) {
      toast.error(`Lỗi cập nhật gateway: ${e.message}`);
    }
  };

  return (
    <Card className="border-red-200">
      <CardHeader className="bg-red-50 border-b border-red-100 pb-4">
        <CardTitle className="text-lg font-bold text-red-800 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" /> Bảng Điều khiển Gateway (Cổng gửi tin)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : controls.length > 0 ? (
          <div className="space-y-6">
            {controls.map((control) => (
              <div key={control.scope} className="flex items-center justify-between p-4 rounded-xl border border-red-100 bg-white">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{control.scope}</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium max-w-sm">
                    Bật công tắc này sẽ cho phép hệ thống gọi API kết nối ra bên ngoài (Provider).
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Switch
                    checked={control.gateway_enabled}
                    onCheckedChange={(checked) => handleToggle(control.scope, checked)}
                    className="data-[state=checked]:bg-red-600"
                  />
                  <span className={`text-xs font-bold px-2 py-1 rounded-md ${control.gateway_enabled ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                    {control.gateway_enabled ? 'ĐANG BẬT (NGUY HIỂM)' : 'ĐÃ TẮT (AN TOÀN)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chưa có cấu hình gateway nào.</p>
        )}
      </CardContent>
    </Card>
  );
}

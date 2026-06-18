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
      toast.error(`Error fetching gateway controls: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (scope: string, enabled: boolean) => {
    if (isProduction && enabled) {
      toast.error("Safety Blocked: Production Environment strictly forbids gateway_enabled=true.");
      return;
    }
    
    try {
      const reason = "Manual UI Toggle";
      await m9SendControlApi.toggleGatewayControl(scope, enabled, reason);
      toast.success(`Gateway updated: Gateway for ${scope} is now ${enabled ? "enabled" : "disabled"}`);
      await fetchControls();
    } catch (e: any) {
      toast.error(`Error updating gateway: ${e.message}`);
    }
  };

  return (
    <Card className="border-red-200">
      <CardHeader className="bg-red-50 border-b border-red-100 pb-4">
        <CardTitle className="text-lg font-bold text-red-800 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" /> Gateway Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : controls.length > 0 ? (
          <div className="space-y-6">
            {controls.map((c) => (
              <div key={c.scope} className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 uppercase">{c.scope}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Rate Limit: {c.rate_limit_per_minute}/min</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold ${c.gateway_enabled ? "text-emerald-600" : "text-slate-400"}`}>
                    {c.gateway_enabled ? "ENABLED" : "DISABLED"}
                  </span>
                  <Switch
                    checked={c.gateway_enabled}
                    disabled={isProduction && !c.gateway_enabled}
                    onCheckedChange={(val) => handleToggle(c.scope, val)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No gateway controls found.</p>
        )}
      </CardContent>
    </Card>
  );
}

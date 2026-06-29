import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, ShieldAlert, Mail, MessageCircle, AlertTriangle, History, Info, Loader2 } from "lucide-react";

export function CustomerMarketingPreferencesPanel({ customerId }: { customerId: string }) {
  const [preferences, setPreferences] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Edit state
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [zaloOptIn, setZaloOptIn] = useState(false);
  const [globalOptOut, setGlobalOptOut] = useState(false);
  const [source, setSource] = useState("admin_panel");

  useEffect(() => {
    fetchData();
  }, [customerId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: prefData, error: prefError } = await supabase
        .from("customer_marketing_preferences")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();

      if (prefError) throw prefError;

      const { data: eventData, error: eventError } = await supabase
        .from("customer_consent_events")
        .select("*")
        .eq("customer_id", customerId)
        .order("occurred_at", { ascending: false });

      if (eventError) throw eventError;

      setPreferences(prefData);
      setEvents(eventData || []);
      
      if (prefData) {
        setEmailOptIn(prefData.email_opt_in);
        setZaloOptIn(prefData.zalo_opt_in);
        setGlobalOptOut(prefData.global_opt_out);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const actorId = user?.id;

      // Upsert preferences
      const { error: prefError } = await supabase
        .from("customer_marketing_preferences")
        .upsert({
          customer_id: customerId,
          email_opt_in: emailOptIn,
          zalo_opt_in: zaloOptIn,
          global_opt_out: globalOptOut,
          last_source: source,
          last_updated_by: actorId,
          last_updated_at: new Date().toISOString()
        });

      if (prefError) throw prefError;

      // Insert event
      const oldState = preferences ? {
        email_opt_in: preferences.email_opt_in,
        zalo_opt_in: preferences.zalo_opt_in,
        global_opt_out: preferences.global_opt_out
      } : {};

      const newState = {
        email_opt_in: emailOptIn,
        zalo_opt_in: zaloOptIn,
        global_opt_out: globalOptOut
      };

      const { error: eventError } = await supabase
        .from("customer_consent_events")
        .insert({
          customer_id: customerId,
          action: "preference_update",
          channel: "global",
          source: source,
          old_state: oldState,
          new_state: newState,
          actor_id: actorId
        });

      if (eventError) throw eventError;

      alert("Preferences updated successfully");
      await fetchData();
    } catch (error: any) {
      alert("Error updating preferences: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  const isMissing = !preferences;

  return (
    <div className="space-y-6 font-sans">
      <Card className="p-6 rounded-3xl border border-slate-200 shadow-sm bg-white">
        <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-500" /> Marketing Preferences & Consent
        </h3>

        {isMissing && (
          <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm">No Preferences Found</h4>
              <p className="text-xs text-amber-800 mt-1">
                This customer has no consent record. All marketing systems will <strong>fail-closed</strong> and block sends until explicitly opted in.
              </p>
            </div>
          </div>
        )}

        {globalOptOut && !isMissing && (
          <div className="mb-6 p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-rose-900 text-sm">Global Opt-Out Active</h4>
              <p className="text-xs text-rose-800 mt-1">
                This customer has opted out of ALL marketing. All channels are blocked.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <Label className="font-bold text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500" /> Email Marketing
                </Label>
                <p className="text-xs text-slate-500 mt-1">Receive promotional emails</p>
              </div>
              <Switch checked={emailOptIn} onCheckedChange={setEmailOptIn} />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <Label className="font-bold text-slate-700 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-500" /> Zalo Marketing
                </Label>
                <p className="text-xs text-slate-500 mt-1">Receive Zalo ZNS/OA messages</p>
              </div>
              <Switch checked={zaloOptIn} onCheckedChange={setZaloOptIn} />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <Label className="font-bold text-slate-700 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" /> Global Opt-Out
                </Label>
                <p className="text-xs text-slate-500 mt-1">Block ALL marketing channels instantly</p>
              </div>
              <Switch checked={globalOptOut} onCheckedChange={setGlobalOptOut} className="data-[state=checked]:bg-rose-600" />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold text-slate-500 uppercase">Update Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="mt-1.5 w-full bg-white">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_panel">Admin Panel (Internal)</SelectItem>
                  <SelectItem value="customer_preference_center">Customer Portal</SelectItem>
                  <SelectItem value="verbal_request">Verbal Request / Call</SelectItem>
                  <SelectItem value="paper_form">Paper Form</SelectItem>
                  <SelectItem value="manual_import">Manual Import</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400 mt-1.5">Required for compliance audit trail.</p>
            </div>
            
            <Button onClick={handleUpdate} disabled={updating} className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold">
              {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Preferences
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 rounded-3xl border border-slate-200 shadow-sm bg-white">
        <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2 uppercase tracking-wider">
          <History className="w-4 h-4" /> Consent History Log
        </h3>
        
        {events.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4 italic">No consent history found.</p>
        ) : (
          <div className="space-y-4">
            {events.map((ev) => (
              <div key={ev.id} className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Info className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-bold text-slate-800 uppercase">{ev.action.replace(/_/g, " ")}</p>
                    <span className="text-xs text-slate-400 font-mono">{new Date(ev.occurred_at).toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Source</span>
                      <p className="text-xs text-slate-700 font-mono mt-0.5">{ev.source}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Channel</span>
                      <p className="text-xs text-slate-700 font-mono mt-0.5">{ev.channel}</p>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-white rounded border border-slate-100 text-[10px] font-mono text-slate-500 overflow-x-auto">
                    <span className="font-bold text-slate-400">Old:</span> {JSON.stringify(ev.old_state)}<br/>
                    <span className="font-bold text-indigo-400">New:</span> {JSON.stringify(ev.new_state)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

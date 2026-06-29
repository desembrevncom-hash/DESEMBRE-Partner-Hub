import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Mail, AlertTriangle, XCircle, MousePointerClick, FolderOpen, Send, Loader2, CheckCircle } from "lucide-react";
import { aggregateCampaignAnalytics, AnalyticsJobRow, AnalyticsEventRow, AnalyticsFilter } from "@/lib/marketing/campaignAnalytics";

export const Route = createFileRoute("/marketing/analytics")({
  component: MarketingAnalyticsPage,
});

function MarketingAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, any>>({});
  
  // Filters
  const [filterSandbox, setFilterSandbox] = useState<AnalyticsFilter["sandbox_mode"]>("all");
  
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [filterSandbox]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Jobs
      const { data: jobs, error: jobsError } = await supabase
        .from("marketing_send_jobs")
        .select("id, campaign_id, status, provider_error_message, safety_result");

      if (jobsError) throw jobsError;

      // 2. Fetch Events
      const { data: events, error: eventsError } = await supabase
        .from("marketing_send_job_events")
        .select("job_id, event_type");

      if (eventsError) throw eventsError;

      // 3. Aggregate
      const aggregated = aggregateCampaignAnalytics(
        jobs as AnalyticsJobRow[], 
        events as AnalyticsEventRow[],
        { sandbox_mode: filterSandbox }
      );
      
      setData(aggregated);
    } catch (e) {
      console.error("Error fetching analytics data", e);
    } finally {
      setLoading(false);
    }
  };

  const formatPct = (val: number) => `${(val * 100).toFixed(1)}%`;

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <ActivityIcon className="w-8 h-8 text-blue-600" />
            Campaign Analytics v2
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Aggregated real-time telemetry from marketing send jobs and provider events.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-sm font-bold text-slate-500 ml-2">Mode:</span>
          <div className="flex gap-1">
            <Button 
              variant={filterSandbox === "all" ? "default" : "ghost"} 
              size="sm"
              className={filterSandbox === "all" ? "bg-slate-800 text-white" : "text-slate-600"}
              onClick={() => setFilterSandbox("all")}
            >
              All
            </Button>
            <Button 
              variant={filterSandbox === "non_sandbox_only" ? "default" : "ghost"} 
              size="sm"
              className={filterSandbox === "non_sandbox_only" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-slate-600"}
              onClick={() => setFilterSandbox("non_sandbox_only")}
            >
              Non-Sandbox
            </Button>
            <Button 
              variant={filterSandbox === "sandbox_only" ? "default" : "ghost"} 
              size="sm"
              className={filterSandbox === "sandbox_only" ? "bg-amber-600 text-white hover:bg-amber-700" : "text-slate-600"}
              onClick={() => setFilterSandbox("sandbox_only")}
            >
              Sandbox Only
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
          <p className="font-bold">Aggregating telemetry...</p>
        </div>
      ) : Object.keys(data).length === 0 ? (
        <div className="py-20 text-center bg-slate-50 rounded-3xl border border-slate-200 border-dashed">
          <ActivityIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700">No Data Found</h3>
          <p className="text-slate-500">There are no marketing send jobs matching the current filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(data).map(([key, bucket]) => (
            <div key={key} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
              <div 
                className="p-6 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
                onClick={() => setExpandedCampaign(expandedCampaign === key ? null : key)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {bucket.campaign_id || "Unassigned / QA Sandbox"}
                    </h2>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 font-mono">
                        {bucket.non_sandbox_jobs_count} Non-Sandbox
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 font-mono">
                        {bucket.sandbox_jobs_count} Sandbox
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex gap-8 items-center">
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sent</p>
                    <p className="text-xl font-black text-slate-800">{bucket.sent_jobs}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Delivered</p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-xl font-black text-emerald-600">{bucket.delivered_unique_jobs}</p>
                      <span className="text-xs font-bold text-emerald-600/70">({formatPct(bucket.delivery_rate)})</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Open Rate</p>
                    <p className="text-xl font-black text-blue-600">{formatPct(bucket.open_rate)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">CTR</p>
                    <p className="text-xl font-black text-purple-600">{formatPct(bucket.click_rate)}</p>
                  </div>
                </div>
              </div>

              {expandedCampaign === key && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-6 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Unique Events vs Total Events */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <ActivityIcon className="w-4 h-4" /> Funnel & Engagement
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                          <span className="font-bold text-slate-600 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500"/> Delivered</span>
                          <div className="text-right">
                            <span className="font-black text-emerald-600">{bucket.delivered_unique_jobs}</span>
                            <span className="text-xs text-slate-400 ml-2">unique</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                          <span className="font-bold text-slate-600 flex items-center gap-2"><Mail className="w-4 h-4 text-blue-500"/> Opened</span>
                          <div className="text-right">
                            <span className="font-black text-blue-600">{bucket.opened_unique_jobs}</span>
                            <span className="text-xs text-slate-400 ml-2">({bucket.opened_events} total)</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                          <span className="font-bold text-slate-600 flex items-center gap-2"><MousePointerClick className="w-4 h-4 text-purple-500"/> Clicked</span>
                          <div className="text-right">
                            <span className="font-black text-purple-600">{bucket.clicked_unique_jobs}</span>
                            <span className="text-xs text-slate-400 ml-2">({bucket.clicked_events} total)</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-500">Click-to-Open Rate (CTOR)</span>
                          <span className="font-black text-slate-700">{formatPct(bucket.click_to_open_rate)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Risk & Failures */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" /> Risks & Failures
                      </h3>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 bg-white rounded-lg border border-red-100 shadow-sm text-center">
                          <p className="text-xs font-bold text-slate-500 mb-1">Bounce Rate</p>
                          <p className="text-lg font-black text-red-600">{formatPct(bucket.bounce_rate)}</p>
                          <p className="text-xs text-slate-400">{bucket.bounced_unique_jobs} jobs</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg border border-orange-100 shadow-sm text-center">
                          <p className="text-xs font-bold text-slate-500 mb-1">Complaint Rate</p>
                          <p className="text-lg font-black text-orange-600">{formatPct(bucket.complaint_rate)}</p>
                          <p className="text-xs text-slate-400">{bucket.complained_unique_jobs} jobs</p>
                        </div>
                      </div>

                      {Object.keys(bucket.failure_reasons).length > 0 ? (
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <div className="bg-slate-50 p-2 border-b border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase px-2">Failure Reasons</p>
                          </div>
                          <ul className="divide-y divide-slate-100">
                            {Object.entries(bucket.failure_reasons).map(([reason, count]) => (
                              <li key={reason} className="p-3 flex justify-between items-start">
                                <span className="text-sm font-mono text-red-600 break-words pr-4">{reason}</span>
                                <Badge variant="secondary" className="bg-red-50 text-red-700 shrink-0">{count as number}</Badge>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 text-center text-emerald-700 text-sm font-bold flex items-center justify-center gap-2">
                          <ShieldCheck className="w-4 h-4" /> No failures or bounces recorded
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple icon for header
function ActivityIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

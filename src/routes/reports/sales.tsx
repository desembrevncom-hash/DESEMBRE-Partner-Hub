import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SalesWeeklyTab } from "@/components/reports/SalesWeeklyTab";
import { SalesMonthlyTab } from "@/components/reports/SalesMonthlyTab";
import { SalesOpportunitiesTab } from "@/components/reports/SalesOpportunitiesTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Target, CalendarDays, LineChart } from "lucide-react";

export const Route = createFileRoute("/reports/sales")({
  component: SalesReportPage,
});

function SalesReportPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("weekly");

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <Link
                to="/"
                className="hover:text-primary inline-flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Trang chủ
              </Link>
              <span>/</span>
              <span className="text-slate-800">Báo cáo Sales</span>
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                🎯 Báo cáo Hiệu suất Bán hàng
              </h1>
              <span className="text-xs text-slate-500 hidden sm:inline-block border-l border-slate-200 pl-3">
                Theo dõi KPI và quản lý cơ hội
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 mt-6 space-y-8 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <div className="bg-white p-2 rounded-xl border border-slate-200 inline-block">
            <TabsList className="bg-transparent gap-2">
              <TabsTrigger 
                value="weekly"
                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-sm px-6"
              >
                <LineChart className="w-4 h-4 mr-2" />
                Báo cáo Tuần
              </TabsTrigger>
              <TabsTrigger 
                value="monthly"
                className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm px-6"
              >
                <CalendarDays className="w-4 h-4 mr-2" />
                Báo cáo Tháng
              </TabsTrigger>
              <TabsTrigger 
                value="opportunities"
                className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-sm px-6"
              >
                <Target className="w-4 h-4 mr-2" />
                Cơ hội Bán hàng
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="weekly" className="mt-0 outline-none">
            <SalesWeeklyTab />
          </TabsContent>
          
          <TabsContent value="monthly" className="mt-0 outline-none">
            <SalesMonthlyTab />
          </TabsContent>

          <TabsContent value="opportunities" className="mt-0 outline-none">
            <SalesOpportunitiesTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

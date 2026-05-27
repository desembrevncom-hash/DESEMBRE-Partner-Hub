import React from "react";
import { 
  Activity, 
  MessageCircle, 
  CheckSquare, 
  AlertCircle, 
  Package, 
  DollarSign, 
  FileText 
} from "lucide-react";

interface CustomerMiniKpiProps {
  customer: any;
  tasks?: any[];
  orders?: any[];
  interactions?: any[];
}

export const CustomerMiniKpi: React.FC<CustomerMiniKpiProps> = ({ 
  customer, 
  tasks = [], 
  orders = [],
  interactions = []
}) => {
  const totalInteractions = interactions?.length || customer.total_interactions || 0;
  
  // Calculate most used platform from interactions
  const platformCounts = interactions.reduce((acc: any, curr: any) => {
    if (curr.platform) {
      acc[curr.platform] = (acc[curr.platform] || 0) + 1;
    }
    return acc;
  }, {});
  const mostUsedPlatform = Object.entries(platformCounts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "Chưa có";

  const openTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress").length;
  const overdueTasks = tasks.filter(t => 
    (t.status === "pending" || t.status === "in_progress") && 
    t.due_date && 
    new Date(t.due_date) < new Date()
  ).length;

  const totalOrders = orders?.length || customer.total_orders || 0;
  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || customer.total_revenue || 0;
  const lastQuoteAt = customer.last_quote_at;

  const KpiItem = ({ icon: Icon, label, value, valueClass = "" }: any) => (
    <div className="flex flex-col p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-bold ${valueClass}`}>{value}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiItem 
        icon={Activity} 
        label="Tương tác" 
        value={totalInteractions} 
      />
      <KpiItem 
        icon={MessageCircle} 
        label="Kênh chính" 
        value={mostUsedPlatform} 
        valueClass="capitalize"
      />
      <KpiItem 
        icon={CheckSquare} 
        label="Công việc (Mở)" 
        value={openTasks} 
      />
      <KpiItem 
        icon={AlertCircle} 
        label="Quá hạn" 
        value={overdueTasks}
        valueClass={overdueTasks > 0 ? "text-destructive" : "text-emerald-500"} 
      />
      <KpiItem 
        icon={Package} 
        label="Đơn hàng" 
        value={totalOrders} 
      />
      <KpiItem 
        icon={DollarSign} 
        label="Doanh thu" 
        value={new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(totalRevenue)} 
        valueClass="text-emerald-600 dark:text-emerald-400"
      />
      <KpiItem 
        icon={FileText} 
        label="Báo giá gần nhất" 
        value={lastQuoteAt ? new Date(lastQuoteAt).toLocaleDateString("vi-VN") : "Chưa có"} 
      />
    </div>
  );
};

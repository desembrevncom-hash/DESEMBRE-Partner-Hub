import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo } from "react";
import { 
  Loader2, 
  ChevronLeft, 
  Phone, 
  MapPin, 
  Building2, 
  UserCircle, 
  ShieldCheck, 
  Zap, 
  Target, 
  Users, 
  FileText, 
  Plus,
  MessageCircle,
  Activity,
  ChevronRight,
  Sparkles,
  Edit3,
  Star,
  Clock,
  Filter,
  CheckCircle2,
  Package,
  Calendar,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  getLifecycleConfig, 
  getStaffName, 
  getCareModelLabel 
} from "@/lib/customerOwnership";
import { toast } from "sonner";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { TemplateDispatcher } from "@/components/marketing/TemplateDispatcher";

export const Route = createFileRoute("/customers/$id")({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Activity Log State
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: 'note', content: '' });
  const [filterType, setFilterType] = useState<string>("all");

  // Template Dispatcher State
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);

  // Fetch Core Data
  useEffect(() => {
    async function fetchCustomer() {
      if (!id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching customer:", error);
        toast.error("Không thể tải thông tin khách hàng");
      } else {
        setCustomer(data);
      }
      setLoading(false);
    }
    fetchCustomer();
    fetchActivities();
  }, [id]);

  // Fetch Activities
  const fetchActivities = async () => {
    if (!id) return;
    setLoadingActivities(true);
    try {
      const { data, error } = await supabase
        .from("customer_activities")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (data) setActivities(data);
    } catch (e) {
      console.log("Activities fetch error", e);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleAddActivity = async () => {
    if (!newActivity.content.trim()) {
      toast.error("Vui lòng nhập nội dung tương tác");
      return;
    }
    try {
      const { error } = await supabase.from("customer_activities").insert([{
        customer_id: id,
        user_id: user?.id,
        activity_type: newActivity.type,
        content: newActivity.content,
      }]);
      
      if (!error) {
        setNewActivity({ ...newActivity, content: '' });
        fetchActivities();
        toast.success("Đã lưu hoạt động");
      } else {
        throw error;
      }
    } catch (e) {
      toast.error("Lỗi khi lưu hoạt động");
    }
  };

  const filteredActivities = useMemo(() => {
    if (filterType === "all") return activities;
    return activities.filter(a => a.activity_type === filterType);
  }, [activities, filterType]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-3.5 h-3.5" />;
      case 'meeting': return <Users className="w-3.5 h-3.5" />;
      case 'message': return <MessageCircle className="w-3.5 h-3.5" />;
      case 'order': return <Package className="w-3.5 h-3.5" />;
      default: return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'call': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'meeting': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'message': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'order': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const renderStatusBadge = (stage: string) => {
    const config = getLifecycleConfig(stage);
    return (
      <Badge variant="outline" className={`text-[10px] font-black px-2.5 py-0.5 ${config.bg} ${config.text} ${config.border} rounded-lg`}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Đang tải hồ sơ khách hàng...</p>
      </div>
    );
  }

  if (!customer) return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50">
      <AlertCircle className="w-12 h-12 text-slate-200 mb-4" />
      <h2 className="text-lg font-bold text-slate-900">Không tìm thấy khách hàng</h2>
      <Button onClick={() => navigate({ to: "/customers" })} className="mt-4">Quay lại danh sách</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* TOP NAVIGATION & ACTIONS */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-2xl h-12 w-12 bg-white shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
              onClick={() => navigate({ to: "/customers" })}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{customer.facility_name || customer.name}</h1>
                {renderStatusBadge(customer.lifecycle_stage)}
                {customer.is_vip && <Badge className="bg-amber-100 text-amber-700 border-none text-[10px] font-black"><Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" /> VIP</Badge>}
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span className="flex items-center gap-1.5"><UserCircle className="w-4 h-4" /> {customer.name}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {customer.city}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Button 
              variant="outline" 
              onClick={() => setIsTemplateOpen(true)}
              className="rounded-xl border-slate-200 font-black text-[10px] text-indigo-600 bg-white shadow-sm hover:bg-indigo-50 h-10 px-6 uppercase tracking-widest border-indigo-100/50"
            >
              <MessageCircle className="mr-2 h-3.5 w-3.5" /> Gửi tin nhắn
            </Button>
            <Button variant="outline" className="rounded-xl border-slate-200 font-black text-[10px] text-slate-600 bg-white shadow-sm hover:bg-slate-50 h-10 px-6 uppercase tracking-widest">
              <Phone className="mr-2 h-3.5 w-3.5" /> Gọi điện
            </Button>
            <Button className="rounded-xl font-black text-[10px] bg-slate-900 hover:bg-black shadow-lg shadow-slate-200 h-10 px-8 transition-all uppercase tracking-widest">
              <Plus className="mr-2 h-3.5 w-3.5" /> Lên đơn mới
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* LEFT COLUMN: INSIGHTS & PROFILE */}
          <div className="space-y-8">
            <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-5 px-8">
                <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                   <Activity className="w-4 h-4 text-indigo-500" /> Chỉ số sức khỏe khách hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-5 bg-slate-50 rounded-[24px] border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Đơn hàng</p>
                    <p className="text-2xl font-black text-slate-900">{customer.total_orders_count || 0}</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-[24px] border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Mức hạng</p>
                    <p className="text-2xl font-black text-slate-900">A+</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                            <Clock className="w-4 h-4" />
                         </div>
                         <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Tương tác cuối</p>
                            <p className="text-xs font-black text-slate-700 mt-0.5">{customer.last_order_at ? format(new Date(customer.last_order_at), "dd/MM/yyyy") : "Chưa rõ"}</p>
                         </div>
                      </div>
                      <Badge variant="outline" className="bg-white text-indigo-600 border-indigo-200 font-black text-[9px]">99+ NGÀY</Badge>
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="py-5 px-8 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">Hồ sơ đối tác</CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-slate-900"><Edit3 className="w-4 h-4" /></Button>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="flex items-start gap-5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shrink-0 shadow-sm">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Địa chỉ vận hành</p>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">{customer.address || "Chưa cập nhật"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shrink-0 shadow-sm">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Liên hệ trực tiếp</p>
                    <p className="text-xs font-black text-slate-900 tracking-tight">{customer.phone || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shrink-0 shadow-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Quy mô cơ sở</p>
                    <p className="text-xs font-bold text-slate-700">{customer.bed_count || 0} Giường • {customer.staff_count || 0} Nhân sự</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: TIMELINE & TABS */}
          <div className="lg:col-span-2 space-y-8">
            <Tabs defaultValue="timeline" className="w-full">
              <TabsList className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/60 shadow-sm mb-8 h-auto inline-flex w-auto sticky top-24 z-20">
                <TabsTrigger value="timeline" className="rounded-xl px-8 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all">
                   <Activity className="mr-2 h-4 w-4" /> Nhật ký
                </TabsTrigger>
                <TabsTrigger value="ownership" className="rounded-xl px-8 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all">
                   <Target className="mr-2 h-4 w-4" /> Tuyến Sale
                </TabsTrigger>
                <TabsTrigger value="orders" className="rounded-xl px-8 py-3 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all">
                   <Package className="mr-2 h-4 w-4" /> Đơn hàng
                </TabsTrigger>
              </TabsList>

              {/* TIMELINE CONTENT */}
              <TabsContent value="timeline" className="mt-0 space-y-8 outline-none">
                {/* Elite Activity Form */}
                <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white border border-indigo-100/50 shadow-indigo-100/20">
                  <CardContent className="p-6">
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                      {[
                        { id: 'note', label: 'GHI CHÚ', icon: FileText, color: 'text-slate-500' },
                        { id: 'call', label: 'GỌI ĐIỆN', icon: Phone, color: 'text-amber-500' },
                        { id: 'meeting', label: 'GẶP MẶT', icon: Users, color: 'text-purple-500' },
                        { id: 'message', label: 'ZALO', icon: MessageCircle, color: 'text-indigo-500' },
                      ].map((type) => (
                        <Button 
                          key={type.id}
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewActivity({ ...newActivity, type: type.id })}
                          className={`rounded-xl text-[10px] font-black h-10 px-5 transition-all ${newActivity.type === type.id ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-400'}`}
                        >
                          <type.icon className={`mr-2 h-4 w-4 ${newActivity.type === type.id ? 'text-white' : type.color}`} /> {type.label}
                        </Button>
                      ))}
                    </div>
                    <textarea 
                      className="w-full min-h-[140px] bg-slate-50 rounded-[24px] p-6 text-sm focus:ring-0 focus:bg-white border-2 border-transparent focus:border-slate-100 transition-all placeholder:text-slate-400 font-medium resize-none shadow-inner"
                      placeholder="Ghi lại kết quả tư vấn, lý do khách chưa chốt đơn hoặc các lưu ý phục vụ CSKH..."
                      value={newActivity.content}
                      onChange={(e) => setNewActivity({ ...newActivity, content: e.target.value })}
                    />
                    <div className="flex items-center justify-between mt-6">
                      <div className="flex items-center gap-3">
                         <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-50"></div>
                         <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Live Synchronization</p>
                      </div>
                      <Button onClick={handleAddActivity} className="rounded-xl px-10 font-black text-xs bg-slate-900 hover:bg-black h-11 shadow-xl shadow-slate-200 hover:scale-105 transition-all uppercase tracking-widest">
                        Lưu nhật ký
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* VISUAL TIMELINE AXIS */}
                <div className="space-y-8">
                   <div className="flex items-center justify-between px-4">
                      <div className="flex items-center gap-3">
                         <Filter className="w-4 h-4 text-slate-400" />
                         <div className="flex gap-2">
                            {['all', 'call', 'order', 'message', 'note'].map(t => (
                               <button 
                                  key={t}
                                  onClick={() => setFilterType(t)}
                                  className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${filterType === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                               >
                                  {t === 'all' ? 'TẤT CẢ' : t}
                               </button>
                            ))}
                         </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{filteredActivities.length} Hoạt động</p>
                   </div>

                   <div className="relative pl-10 space-y-10 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-slate-200 before:via-slate-100 before:to-transparent before:content-['']">
                    {loadingActivities ? (
                      <div className="py-20 text-center flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 animate-spin text-slate-200" />
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Retrieving History...</p>
                      </div>
                    ) : filteredActivities.length > 0 ? (
                      filteredActivities.map((activity) => (
                        <div key={activity.id} className="relative animate-in fade-in slide-in-from-left-4 duration-500">
                          {/* Timeline Bullet Icon */}
                          <div className={`absolute -left-[43px] top-0 w-11 h-11 rounded-2xl border-4 border-[#f8fafc] shadow-lg flex items-center justify-center z-10 transition-transform hover:scale-110 ${getActivityColor(activity.activity_type)}`}>
                            {getActivityIcon(activity.activity_type)}
                          </div>
                          
                          <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative border-l-4 border-l-transparent hover:border-l-slate-900">
                            <div className="flex items-center justify-between mb-4">
                               <div className="flex items-center gap-4">
                                 <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em]">
                                   {activity.activity_type === 'note' ? 'Hệ thống ghi chú' : `Nhật ký ${activity.activity_type}`}
                                 </span>
                                 <span className="text-[10px] text-slate-300 font-bold flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full">
                                   <Clock className="w-3 h-3" /> {format(new Date(activity.created_at), "HH:mm · dd/MM/yyyy", { locale: vi })}
                                 </span>
                               </div>
                               <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-200 hover:text-slate-900 rounded-xl"><Edit3 className="w-4 h-4" /></Button>
                               </div>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap pl-1">
                              {activity.content}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-24 text-center flex flex-col items-center justify-center bg-white rounded-[40px] border-2 border-dashed border-slate-100 mx-4">
                         <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center text-slate-100 mb-6 shadow-inner">
                            <Activity className="w-12 h-12" />
                         </div>
                         <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Chưa có dữ liệu tương tác</h3>
                         <p className="text-xs text-slate-400 mt-3 max-w-[300px] leading-relaxed font-medium">
                           Mọi hoạt động từ gọi điện, nhắn tin cho đến đơn hàng sẽ được hiển thị tại đây để bạn tiện theo dõi.
                         </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* OWNERSHIP TAB */}
              <TabsContent value="ownership" className="outline-none">
                <Card className="rounded-[40px] border-none shadow-sm bg-white p-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-8">
                         <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                            <Target className="w-5 h-5 text-indigo-500" /> Mô hình quản trị Lead
                         </h4>
                         <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
                            <div className="flex justify-between items-center">
                               <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">CHẾ ĐỘ CHĂM SÓC</span>
                               <Badge className="bg-slate-900 text-white border-none font-black text-[9px] uppercase px-4 py-1.5 rounded-full">{getCareModelLabel(customer.care_model)}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                               <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">NGUỒN DỮ LIỆU</span>
                               <Badge variant="outline" className="text-slate-600 border-slate-200 bg-white font-black text-[9px] uppercase px-4 py-1.5 rounded-full">{customer.customer_channel || "OFFLINE"}</Badge>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic border-t border-slate-200 pt-4 mt-4">
                               Phân tuyến này tự động điều phối quyền truy cập dữ liệu giữa Sale và Telesale để tối ưu hóa quy trình bán hàng.
                            </p>
                         </div>
                      </div>
                      <div className="space-y-8">
                         <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                            <Users className="w-5 h-5 text-indigo-500" /> Đội ngũ phụ trách
                         </h4>
                         <div className="space-y-4">
                            <div className="flex items-center gap-5 p-6 bg-white border border-slate-100 rounded-[28px] hover:shadow-lg transition-all group">
                               <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-black border border-indigo-100 shadow-sm group-hover:scale-105 transition-transform uppercase">S</div>
                               <div className="flex-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Direct Sale</p>
                                  <p className="text-sm font-black text-slate-900">{getStaffName(customer.owner_sale_id) || "Chưa phân công"}</p>
                               </div>
                               <Button variant="ghost" size="icon" className="rounded-xl"><ChevronRight className="w-5 h-5 text-slate-300" /></Button>
                            </div>
                            <div className="flex items-center gap-5 p-6 bg-white border border-slate-100 rounded-[28px] hover:shadow-lg transition-all group">
                               <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-sm font-black border border-rose-100 shadow-sm group-hover:scale-105 transition-transform uppercase">T</div>
                               <div className="flex-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Telesale Hub</p>
                                  <p className="text-sm font-black text-slate-900">{getStaffName(customer.owner_tele_id) || "Chưa phân công"}</p>
                               </div>
                               <Button variant="ghost" size="icon" className="rounded-xl"><ChevronRight className="w-5 h-5 text-slate-300" /></Button>
                            </div>
                         </div>
                      </div>
                   </div>
                </Card>
              </TabsContent>

              {/* ORDERS TAB (SKELETON) */}
              <TabsContent value="orders" className="outline-none">
                 <Card className="rounded-[40px] border-none shadow-sm bg-white p-24 text-center border border-slate-100">
                    <div className="w-28 h-28 rounded-full bg-slate-50 flex items-center justify-center text-slate-100 mx-auto mb-8 shadow-inner">
                       <Package className="w-14 h-14" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.3em] mb-4">Lịch sử giao dịch</h3>
                    <p className="text-xs text-slate-400 max-w-[360px] mx-auto leading-relaxed font-medium">
                      Toàn bộ lịch sử mua hàng, công nợ và tình trạng vận chuyển sẽ được hiển thị tại đây để Sale nắm bắt sức mua của Spa.
                    </p>
                    <Button variant="outline" className="mt-10 rounded-xl font-black text-[10px] border-slate-200 uppercase tracking-widest h-11 px-8">Đồng bộ dữ liệu</Button>
                 </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <TemplateDispatcher 
        customer={customer} 
        isOpen={isTemplateOpen} 
        onClose={() => setIsTemplateOpen(false)} 
      />
    </div>
  );
}

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { 
  Building2, 
  Phone, 
  UserCircle, 
  MapPin, 
  Calendar, 
  History, 
  Package, 
  Star,
  Clock,
  Target,
  Sparkles,
  Info,
  ChevronRight,
  Loader2,
  Trophy,
  Activity,
  Plus,
  Send,
  CalendarCheck
} from "lucide-react";
import { 
  getCustomerChannelLabel, 
  getCustomerDistanceLabel, 
  getCareModelLabel 
} from "@/lib/customerOwnership";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";

interface CustomerPreviewDrawerProps {
  customer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getStaffName: (id?: string | null) => string;
}

export const CustomerPreviewDrawer: React.FC<CustomerPreviewDrawerProps> = ({
  customer,
  open,
  onOpenChange,
  getStaffName
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [activities, setActivities] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const [noteForm, setNoteForm] = useState({
    activity_type: "note",
    title: "",
    content: "",
    next_follow_up_at: ""
  });

  useEffect(() => {
    if (open && customer?.id) {
      fetchCustomerDetails();
    }
  }, [open, customer?.id]);

  const fetchCustomerDetails = async () => {
    setLoading(true);
    try {
      const [activitiesRes, ordersRes, eventsRes] = await Promise.all([
        supabase
          .from("customer_activities")
          .select("*")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("*")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("event_registrations")
          .select("*, company_events(*)")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(1)
      ]);

      if (activitiesRes.data) setActivities(activitiesRes.data);
      if (ordersRes.data) setOrders(ordersRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
    } catch (error) {
      console.error("Error fetching customer details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteForm.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề ghi chú");
      return;
    }

    setSubmitting(true);
    try {
      const { error: actError } = await supabase
        .from("customer_activities")
        .insert([{
          customer_id: customer.id,
          created_by: user?.id,
          activity_type: noteForm.activity_type,
          title: noteForm.title,
          content: noteForm.content,
          next_follow_up_at: noteForm.next_follow_up_at || null
        }]);

      if (actError) throw actError;

      // Nếu có ngày hẹn tiếp theo, đồng bộ vào bảng customers
      if (noteForm.next_follow_up_at) {
        await supabase
          .from("customers")
          .update({ 
            next_follow_up_at: noteForm.next_follow_up_at,
            last_contacted_at: new Date().toISOString()
          })
          .eq("id", customer.id);
      } else {
        // Cập nhật ngày tương tác gần nhất
        await supabase
          .from("customers")
          .update({ last_contacted_at: new Date().toISOString() })
          .eq("id", customer.id);
      }

      toast.success("Đã lưu ghi chú chăm sóc");
      setAddingNote(false);
      setNoteForm({
        activity_type: "note",
        title: "",
        content: "",
        next_follow_up_at: ""
      });
      fetchCustomerDetails();
    } catch (error: any) {
      toast.error("Lỗi: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!customer) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Chưa có";
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: vi });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col h-full border-l border-slate-200 shadow-2xl">
        {/* HEADER SECTION */}
        <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Building2 className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-3">
            <div className="flex items-start justify-between">
              <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-[10px] uppercase tracking-wider font-bold">
                {customer.status || "NEW"}
              </Badge>
              <div className="flex gap-1">
                {customer.potential_level === "hot" && <Badge className="bg-red-500 text-white border-none text-[10px]">HOT 🔥</Badge>}
                {customer.potential_level === "warm" && <Badge className="bg-amber-500 text-white border-none text-[10px]">WARM</Badge>}
              </div>
            </div>
            
            <div className="space-y-1">
              <h2 className="text-xl font-black tracking-tight">{customer.business_name || customer.facility_name || "Spa tự do"}</h2>
              <p className="text-white/70 text-sm flex items-center gap-1.5 font-medium">
                <UserCircle className="w-4 h-4 text-emerald-400" /> {customer.contact_name || customer.name}
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-white/80">
                <Phone className="w-3.5 h-3.5 text-emerald-400" /> {customer.phone || "—"}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/80">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> {customer.city || "N/A"}
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8 pb-12">
            
            {/* OWNERSHIP SECTION */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Target className="w-4 h-4 text-primary" /> Tuyến chăm sóc & Quyền sở hữu
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Kênh</div>
                  <div className="text-xs font-bold text-slate-700">{getCustomerChannelLabel(customer.customer_channel)}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Khoảng cách</div>
                  <div className="text-xs font-bold text-slate-700">{getCustomerDistanceLabel(customer.customer_distance_type)}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 col-span-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Mô hình chăm sóc</div>
                  <div className="text-xs font-bold text-slate-700">{getCareModelLabel(customer.care_model)}</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">Sale phụ trách</div>
                  <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <UserCircle className="w-3.5 h-3.5" /> {getStaffName(customer.owner_sale_id)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 space-y-1">
                  <div className="text-[10px] font-bold text-amber-600 uppercase">Tele hỗ trợ</div>
                  <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <UserCircle className="w-3.5 h-3.5" /> {getStaffName(customer.owner_tele_id)}
                  </div>
                </div>
              </div>
            </section>

            {/* SUMMARY STATS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Trophy className="w-4 h-4 text-primary" /> Hiệu quả & Tóm tắt
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 grid grid-cols-2 gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-primary/60 uppercase">Tổng doanh số</div>
                    <div className="text-lg font-black text-primary">{formatCurrency(customer.total_order_amount || 0)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-primary/60 uppercase">Số đơn hàng</div>
                    <div className="text-lg font-black text-primary">{customer.total_orders_count || 0}</div>
                  </div>
                </div>
                
                <div className="p-3 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <History className="w-3 h-3" /> Liên hệ gần nhất
                  </div>
                  <div className="text-xs font-medium text-slate-600">{formatDate(customer.last_contacted_at)}</div>
                </div>
                <div className="p-3 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Lịch hẹn tiếp theo
                  </div>
                  <div className="text-xs font-bold text-red-600">{formatDate(customer.next_follow_up_at)}</div>
                </div>
              </div>
            </section>

            {/* TIMELINE ACTIVITIES */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Activity className="w-4 h-4 text-primary" /> Lịch sử chăm sóc (Timeline)
                </div>
                <button 
                  onClick={() => setAddingNote(!addingNote)}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                >
                  <Plus className="w-3 h-3" /> {addingNote ? "Hủy" : "Thêm ghi chú"}
                </button>
              </div>

              {addingNote && (
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Loại hoạt động</Label>
                      <Select 
                        value={noteForm.activity_type} 
                        onValueChange={(v) => setNoteForm({ ...noteForm, activity_type: v })}
                      >
                        <SelectTrigger className="h-8 text-[11px] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="note">Ghi chú (Note)</SelectItem>
                          <SelectItem value="call">Cuộc gọi (Call)</SelectItem>
                          <SelectItem value="zalo_message">Zalo Message</SelectItem>
                          <SelectItem value="direct_visit">Gặp trực tiếp</SelectItem>
                          <SelectItem value="handoff">Chuyển giao (Handoff)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 col-span-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Hẹn tiếp theo</Label>
                      <Input 
                        type="datetime-local" 
                        value={noteForm.next_follow_up_at}
                        onChange={(e) => setNoteForm({ ...noteForm, next_follow_up_at: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Tiêu đề ngắn <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="VD: Khách quan tâm máy Laser..."
                        value={noteForm.title}
                        onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Nội dung chi tiết</Label>
                      <Textarea 
                        placeholder="Nhập chi tiết nội dung trao đổi..."
                        value={noteForm.content}
                        onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                        className="min-h-[80px] text-[11px] bg-white"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleAddNote} 
                    disabled={submitting}
                    className="w-full h-9 text-xs font-bold bg-primary hover:bg-primary/90"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-3.5 h-3.5 mr-2" />}
                    Lưu hoạt động chăm sóc
                  </Button>
                </div>
              )}
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-4 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {activities.map((act) => (
                    <div key={act.id} className="relative pl-8 group">
                      <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-white border-2 border-primary/20 flex items-center justify-center group-hover:border-primary transition-colors">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black text-slate-900">{act.title}</span>
                          <span className="text-[9px] text-slate-400">{formatDate(act.created_at)}</span>
                        </div>
                        {act.content && <p className="text-[11px] text-slate-500 line-clamp-2">{act.content}</p>}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[8px] h-4 bg-slate-50">{act.activity_type}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Chưa có lịch sử chăm sóc nào</p>
                </div>
              )}
            </section>

            {/* RECENT ORDERS */}
            {orders.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Package className="w-4 h-4 text-primary" /> Đơn hàng gần đây
                </div>
                <div className="space-y-2">
                  {orders.map((ord) => (
                    <div key={ord.id} className="p-3 rounded-xl border border-slate-100 bg-white flex items-center justify-between hover:border-primary/20 transition-all cursor-pointer group">
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Mã đơn: #{ord.id.slice(0, 8)}</div>
                        <div className="text-xs font-bold text-slate-700">{formatCurrency(ord.total_amount || 0)}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge className="text-[9px] h-4">{ord.status}</Badge>
                        <div className="text-[9px] text-slate-400">{formatDate(ord.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* RECENT EVENTS */}
            {events.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Star className="w-4 h-4 text-amber-500" /> Sự kiện & Hội thảo
                </div>
                {events.map((ev) => (
                  <div key={ev.id} className="p-4 rounded-2xl bg-amber-50 border border-amber-100 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="font-bold text-xs text-amber-900">{ev.company_events?.title || "Sự kiện Desembre"}</div>
                      <Badge className="bg-amber-500 text-white border-none text-[8px] uppercase">{ev.status}</Badge>
                    </div>
                    <div className="text-[10px] text-amber-700/70 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {formatDate(ev.company_events?.start_time)}
                    </div>
                  </div>
                ))}
              </section>
            )}

          </div>
        </ScrollArea>

        {/* FOOTER ACTIONS */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-3">
          <button 
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
            onClick={() => onOpenChange(false)}
          >
            Đóng xem nhanh
          </button>
          <button 
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-all"
            onClick={() => {/* Chuyển sang trang chi tiết sau này */}}
          >
            Hồ sơ chi tiết <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

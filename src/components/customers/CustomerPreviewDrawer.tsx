import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CustomerUpsellIntel } from "./CustomerUpsellIntel";
import { CustomerKnowledgeUpsell } from "./CustomerKnowledgeUpsell";
import { ProductKnowledgeBook } from "./ProductKnowledgeBook";
import { CustomerAISummary } from "./CustomerAISummary";
import { CustomerContactChannels } from "./CustomerContactChannels";
import { CustomerContacts } from "./CustomerContacts";
import { CustomerTimelineFeed } from "./timeline/CustomerTimelineFeed";
import { CustomerAiSuggestions } from "./ai/CustomerAiSuggestions";
import { AISuggestionCard } from "../ai/AISuggestionCard";
import { CustomerMiniKpi } from "./CustomerMiniKpi";
import { CustomerRiskSummary } from "./CustomerRiskSummary";
import { CustomerAutomationStatus } from "./CustomerAutomationStatus";
import { generateSuggestions } from "@/lib/aiSuggestionEngine";
import { AdminCustomerInsights } from "./AdminCustomerInsights";
import { SaleCustomerInsights } from "./SaleCustomerInsights";
import { AssignStaffDialog } from "./AssignStaffDialog";
import { DataHealthBadge } from "@/components/customers/DataHealthBadge";
import { getCustomerDataHealth } from "@/lib/customers/dataHealth";
import {
  Sheet,
  SheetContent,
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
  CalendarCheck,
  CheckSquare,
  UserCheck,
  MessageCircle,
  Copy,
  AlertTriangle,
  PhoneCall,
  Video,
  FileText,
  MoreHorizontal,
  Play,
  Check,
  PhoneOff,
  UserX,
  Heart,
  CalendarClock,
  ArrowRightLeft,
  Navigation,
  Crosshair,
  Camera,
  CheckCircle2,
  Trash2
} from "lucide-react";
import { 
  getCustomerChannelLabel, 
  getCustomerDistanceLabel, 
  getCareModelLabel
} from "@/lib/customerOwnership";
import { getSuggestedNextAction } from "@/lib/operationalRules";
import { buildStaffMap, getStaffDisplayName, StaffMap } from "@/lib/staffDisplay";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskActionDialog } from "@/components/workspace/TaskActionDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  hasValidCoordinates, 
  buildGoogleMapsSearchUrl, 
  buildGoogleMapsDirectionsUrl,
  calculateDistanceMeters,
  isWithinRadius,
  parseGoogleMapsUrlToCoordinates
} from "@/lib/geo";
import { 
  getDistanceTypeFromMeters, 
  getRecommendedRoutingByDistance 
} from "@/lib/customerRouting";
import { 
  isFeatureEnabledForUser 
} from "@/lib/pilotMode";
import { CommunicationLaunchers } from "./CommunicationLaunchers";
import { FocusInteractionPanel } from "./FocusInteractionPanel";
import { useCopilotContext } from "../chat/ProductCopilotContext";
import { useSystemSettings } from "@/hooks/useSystemSettings";

const drawerCache: Record<string, { data: any, timestamp: number }> = {};

interface CustomerPreviewDrawerProps {
  customer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuickAction?: "note" | "task" | "followup" | null;
  staffMap?: StaffMap;
  onNextCustomer?: () => void;
}

export const CustomerPreviewDrawer: React.FC<CustomerPreviewDrawerProps> = ({
  customer: customerProp,
  open,
  onOpenChange,
  initialQuickAction,
  staffMap,
  onNextCustomer
}) => {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const settings = useSystemSettings();
  const navigate = useNavigate();
  const { setCustomerContext } = useCopilotContext();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [currentGps, setCurrentGps] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [checkinNote, setCheckinNote] = useState("");
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [showCheckinDialog, setShowCheckinDialog] = useState(false);
  const [checkinPhotos, setCheckinPhotos] = useState<File[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  const compressPhoto = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], `${file.name.replace(/\.[^/.]+$/, "")}.webp`, {
                  type: "image/webp",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            "image/webp",
            0.75
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };
  
  const [showEditLocationDialog, setShowEditLocationDialog] = useState(false);
  const [editLocationMethod, setEditLocationMethod] = useState<"gps" | "manual" | "url">("gps");
  const [editLocationForm, setEditLocationForm] = useState({
    latitude: "",
    longitude: "",
    url: "",
    accuracy: null as number | null
  });
  const [editLocationSubmitting, setEditLocationSubmitting] = useState(false);
  const [companyLocation, setCompanyLocation] = useState<any | null>(null);
  const [companyLocationLoading, setCompanyLocationLoading] = useState(false);
  
  const [activeCustomer, setActiveCustomer] = useState<any | null>(null);
  const customer = activeCustomer || customerProp || {};
  
  const [localStaffMap, setLocalStaffMap] = useState<StaffMap>({});
  
  const combinedStaffMap = useMemo(() => {
    return {
      ...staffMap,
      ...localStaffMap
    };
  }, [staffMap, localStaffMap]);

  useEffect(() => {
    if (!open) return;
    const ids = [
      customer?.owner_sale_id,
      customer?.owner_tele_id,
      customer?.assigned_sale_id,
      customer?.assigned_telesale_id,
      customer?.created_by,
      customer?.updated_by
    ].filter(Boolean) as string[];
    
    const missingIds = ids.filter(id => !combinedStaffMap[id]);
    if (missingIds.length > 0) {
      const fetchProfiles = async () => {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, display_name, email")
            .in("id", missingIds);
          if (!error && data) {
            setLocalStaffMap(prev => ({
              ...prev,
              ...buildStaffMap(data)
            }));
          }
        } catch (err) {
          console.error("Error fetching missing profiles in drawer:", err);
        }
      };
      fetchProfiles();
    }
  }, [open, customer?.owner_sale_id, customer?.owner_tele_id, customer?.assigned_sale_id, customer?.assigned_telesale_id, customer?.created_by, customer?.updated_by, staffMap]);

  const [activities, setActivities] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [userCommAccounts, setUserCommAccounts] = useState<any[]>([]);
  const [customerChannels, setCustomerChannels] = useState<any[]>([]);
  const [interactionSummary, setInteractionSummary] = useState<any>(null);

  // Task Actions
  const [taskAction, setTaskAction] = useState<{ task: any; action: string } | null>(null);

  // Quick Action Toggles
  const [quickAction, setQuickAction] = useState<null | "note" | "task" | "followup">(null);

  // Form states
  const [noteForm, setNoteForm] = useState({
    activity_type: "note",
    title: "",
    content: "",
    next_follow_up_at: ""
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    due_at: "",
    priority: "normal"
  });

  const [followupForm, setFollowupForm] = useState({
    title: "",
    starts_at: "",
    event_type: "meeting",
    location: "Online / Tại Spa khách hàng",
    description: ""
  });

  // Timeline Filters
  const [timelineFilter, setTimelineFilter] = useState<string>("all");

  useEffect(() => {
    if (open && customerProp?.id) {
      setActiveCustomer(null);
      setQuickAction(initialQuickAction || null);
      setTimelineFilter("all");
      setCurrentGps(null);
      setCheckinNote("");
      setShowCheckinDialog(false);
      fetchCustomerDetails();

      // Set copilot context
      setCustomerContext({
        currentCustomerId: customerProp.id,
        customerName: customerProp.contact_name || customerProp.name || customerProp.full_name || "Khách hàng",
        city: customerProp.city || customerProp.province,
        stage: customerProp.lifecycle_stage || customerProp.status,
      });
    } else {
      setActiveCustomer(null);
      setCustomerContext(null);
    }
    
    // Clear on unmount
    return () => {
      setCustomerContext(null);
    };
  }, [open, customerProp?.id, initialQuickAction]);

  // Generate AI Suggestions using Rule Engine
  const actionSuggestions = useMemo(() => {
    if (!customerProp?.id) return [];
    return generateSuggestions({
      customer: activeCustomer || customerProp,
      orders,
      items: orderItems,
      activities,
      tasks
    });
  }, [customerProp?.id, activeCustomer, orders, orderItems, activities, tasks]);

  const fetchCustomerDetails = async () => {
    if (!customerProp?.id) return;
    
    // Check Cache (valid for 60s)
    const cacheKey = customerProp.id;
    if (drawerCache[cacheKey] && Date.now() - drawerCache[cacheKey].timestamp < 60000) {
      const cached = drawerCache[cacheKey].data;
      setActiveCustomer(cached.activeCustomer);
      setActivities(cached.activities);
      setOrders(cached.orders);
      setEvents(cached.events);
      setTasks(cached.tasks);
      setAppointments(cached.appointments);
      setUserCommAccounts(cached.userCommAccounts);
      setCustomerChannels(cached.customerChannels);
      setInteractionSummary(cached.interactionSummary);
      setOrderItems(cached.orderItems);
      setCompanyLocation(cached.companyLocation);
      return;
    }

    setLoading(true);
    
    // Check if we need to load base profile details
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerProp.id)
        .single();
      if (!error && data) {
        setActiveCustomer({ ...customerProp, ...data });
      }
    } catch (err) {
      console.error("Error loading customer base profile:", err);
    }

    const fetchActivities = async () => {
      try {
        const { data, error } = await supabase
          .from("customer_activities")
          .select("*")
          .eq("customer_id", customerProp.id)
          .order("created_at", { ascending: false });
        if (!error && data) setActivities(data);
      } catch (err) {
        console.error("Error fetching activities:", err);
      }
    };

    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("customer_id", customerProp.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (!error && data) setOrders(data);
      } catch (err) {
        console.error("Error fetching orders:", err);
      }
    };

    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from("event_registrations")
          .select("*, company_events(*)")
          .eq("customer_id", customerProp.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (!error && data) setEvents(data);
      } catch (err) {
        console.error("Error fetching events:", err);
      }
    };

    const fetchCommData = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: accounts } = await supabase
            .from("user_communication_accounts")
            .select("*")
            .eq("user_id", userData.user.id);
          if (accounts) setUserCommAccounts(accounts);
        }

        const { data: channels } = await supabase
          .from("customer_contact_channels")
          .select("*")
          .eq("customer_id", customerProp.id);
        if (channels) setCustomerChannels(channels);

        const { data: summary } = await supabase.rpc("get_customer_interaction_summary", {
          p_customer_id: customerProp.id
        });
        if (summary) setInteractionSummary(summary);
      } catch (err) {
        console.error("Error fetching comm data:", err);
      }
    };

    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from("customer_tasks")
          .select("*")
          .eq("customer_id", customerProp.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (!error && data) setTasks(data || []);
      } catch (err) {
        console.error("Error fetching tasks:", err);
      }
    };

    const fetchAppointments = async () => {
      try {
        const { data, error } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("customer_id", customerProp.id)
          .order("starts_at", { ascending: false })
          .limit(5);
        if (!error && data) setAppointments(data || []);
      } catch (err) {
        console.error("Error fetching appointments:", err);
      }
    };

    const fetchOrderItems = async () => {
      try {
        const { data: customerOrders } = await supabase
          .from("orders")
          .select("id")
          .eq("customer_id", customerProp.id);
        
        if (customerOrders && customerOrders.length > 0) {
          const orderIds = customerOrders.map((o: any) => o.id);
          const { data: itemsData, error } = await supabase
            .from("order_items")
            .select("*, order:orders(created_at, status)")
            .in("order_id", orderIds);
          if (!error && itemsData) {
            setOrderItems(itemsData);
          }
        } else {
          setOrderItems([]);
        }
      } catch (err) {
        console.error("Error fetching order items:", err);
      }
    };

    const fetchCompanyLocation = async () => {
      setCompanyLocationLoading(true);
      try {
        const { data, error } = await supabase
          .from("company_locations")
          .select("*")
          .eq("is_default", true)
          .eq("is_active", true)
          .limit(1)
          .single();
        if (!error && data) {
          setCompanyLocation(data);
        }
      } catch (err) {
        console.error("Error fetching company location:", err);
      } finally {
        setCompanyLocationLoading(false);
      }
    };

    await Promise.all([
      fetchActivities(),
      fetchOrders(),
      fetchEvents(),
      fetchTasks(),
      fetchCommData()
    ]).finally(() => {
      fetchAppointments();
      fetchOrderItems();
      fetchCompanyLocation();
    });
    
    setLoading(false);
    
    // Store in cache
    drawerCache[customerProp.id] = {
      timestamp: Date.now(),
      data: {
        activeCustomer: customer,
        activities,
        orders,
        events,
        tasks,
        appointments,
        userCommAccounts,
        customerChannels,
        interactionSummary,
        orderItems,
        companyLocation
      }
    };
    
    window.dispatchEvent(new Event('customer_timeline_refresh'));
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

      // Update follow up and contacted timestamp on customer
      const updates: any = { last_contacted_at: new Date().toISOString() };
      if (noteForm.next_follow_up_at) {
        updates.next_follow_up_at = noteForm.next_follow_up_at;
      }
      
      await supabase.from("customers").update(updates).eq("id", customer.id);

      toast.success("Đã ghi nhận hoạt động chăm sóc!");
      setNoteForm({
        activity_type: "note",
        title: "",
        content: "",
        next_follow_up_at: ""
      });
      setQuickAction(null);
      fetchCustomerDetails();
    } catch (err: any) {
      toast.error("Lỗi thêm hoạt động: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề công việc");
      return;
    }
    if (!taskForm.due_at) {
      toast.error("Vui lòng chọn hạn chót");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("customer_tasks")
        .insert([{
          customer_id: customer.id,
          title: taskForm.title,
          due_at: taskForm.due_at,
          priority: taskForm.priority,
          status: "pending",
          assigned_to: user?.id,
          task_type: "call"
        }]);

      if (error) throw error;

      await supabase
        .from("customer_activities")
        .insert([{
          customer_id: customer.id,
          created_by: user?.id,
          activity_type: "task_created",
          title: "Đã giao việc mới (Task)",
          content: `Tiêu đề: ${taskForm.title} - Hạn chót: ${formatDate(taskForm.due_at)}`
        }]);

      toast.success("Đã tạo việc cần làm thành công!");
      setTaskForm({
        title: "",
        due_at: "",
        priority: "normal"
      });
      setQuickAction(null);
      fetchCustomerDetails();
    } catch (err: any) {
      toast.error("Lỗi tạo công việc: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateFollowup = async () => {
    if (!followupForm.title.trim()) {
      toast.error("Vui lòng nhập nội dung buổi hẹn");
      return;
    }
    if (!followupForm.starts_at) {
      toast.error("Vui lòng chọn thời gian bắt đầu");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("calendar_events")
        .insert([{
          customer_id: customer.id,
          title: followupForm.title,
          starts_at: followupForm.starts_at,
          ends_at: new Date(new Date(followupForm.starts_at).getTime() + 60 * 60 * 1000).toISOString(),
          description: `Địa điểm: ${followupForm.location}\n${followupForm.description}`,
          assigned_sale_id: customer.owner_sale_id || user?.id,
          owner_user_id: user?.id,
          created_by: user?.id,
          visibility: "private",
          event_type: followupForm.event_type
        }]);

      if (error) throw error;

      // Log activity
      await supabase
        .from("customer_activities")
        .insert([{
          customer_id: customer.id,
          created_by: user?.id,
          activity_type: "follow_up",
          title: "Lên lịch hẹn chăm sóc (Follow-up)",
          content: `Đã lên lịch hẹn: "${followupForm.title}" - Thời gian: ${new Date(followupForm.starts_at).toLocaleString('vi-VN')} - Địa điểm: ${followupForm.location || "Chưa rõ"}`
        }]);

      const assignedUser = customer.owner_sale_id || user?.id;
      if (assignedUser && assignedUser !== user?.id) {
        await supabase.rpc('create_notification_safe', {
          p_recipient_user_id: assignedUser,
          p_notification_type: 'event_upcoming',
          p_title: 'Lịch hẹn mới',
          p_message: `Bạn được phân công lịch hẹn: ${followupForm.title}`,
          p_customer_id: customer.id,
          p_actor_user_id: user?.id,
          p_deep_link: `/customers?id=${customer.id}`
        });
      }

      toast.success("Đã lên lịch hẹn thành công!");
      window.dispatchEvent(new Event('customer_timeline_refresh'));

      setFollowupForm({
        title: "",
        starts_at: "",
        event_type: "meeting",
        location: "Online / Tại Spa khách hàng",
        description: ""
      });
      setQuickAction(null);
      fetchCustomerDetails();
    } catch (err: any) {
      toast.error("Lỗi tạo lịch hẹn: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyMessage = () => {
    const text = `Kính gửi anh/chị ${customer.contact_name || customer.name || 'chủ Spa'}, Desembre xin phép gửi thông tin hỗ trợ...`;
    navigator.clipboard.writeText(text);
    toast.success("Đã copy tin nhắn mẫu!");
  };

  const handlePinCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị Geolocation.");
      return;
    }

    setPinning(true);
    const geoToastId = toast.loading("Đang xác định tọa độ GPS hiện tại...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        toast.dismiss(geoToastId);
        setPinning(false);
        const { latitude, longitude, accuracy } = position.coords;

        const confirmPin = window.confirm(
          `Tìm thấy vị trí hiện tại với độ chính xác +/- ${Math.round(accuracy)} mét.\n\n` +
          `Bạn có đồng ý dùng vị trí này làm tọa độ định vị cho khách hàng không?`
        );

        if (!confirmPin) return;

        try {
          // 1. Update customer location in DB
          const { error: updateErr } = await supabase
            .from("customers")
            .update({
              latitude,
              longitude,
              geo_source: "gps_checkin",
              geo_verified_at: new Date().toISOString(),
              geo_verified_by: user?.id
            })
            .eq("id", customer.id);

          if (updateErr) throw updateErr;

          // 2. Create customer activity log
          const { error: actErr } = await supabase
            .from("customer_activities")
            .insert({
              customer_id: customer.id,
              created_by: user?.id,
              activity_type: "note",
              title: "Đã ghim vị trí khách hàng",
              content: `Toạ độ GPS được ghim trực tiếp: vĩ độ ${latitude.toFixed(6)}, kinh độ ${longitude.toFixed(6)} (Độ chính xác: +/- ${Math.round(accuracy)}m).`
            });

          if (actErr) throw actErr;

          toast.success("Đã cập nhật vị trí khách hàng thành công!");
          fetchCustomerDetails();
        } catch (err: any) {
          toast.error("Lỗi cập nhật tọa độ: " + err.message);
        }
      },
      (error) => {
        toast.dismiss(geoToastId);
        setPinning(false);
        console.error("Lỗi định vị Geolocation:", error);
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Không được cấp quyền vị trí (Vui lòng cho phép quyền truy cập GPS).");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Không lấy được GPS (Vui lòng bật định vị trên thiết bị).");
            break;
          case error.TIMEOUT:
            toast.error("Thời gian định vị GPS quá hạn.");
            break;
          default:
            toast.error("Lỗi định vị hoặc trình duyệt không hỗ trợ.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleGetGpsForCheckin = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị Geolocation.");
      return;
    }

    setGpsLoading(true);
    const toastId = toast.loading("Đang xác định vị trí của bạn để check-in...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        toast.dismiss(toastId);
        setGpsLoading(false);
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentGps({ latitude, longitude, accuracy });
        if (!showCheckinDialog) {
          setCheckinNote("");
        }
        setShowCheckinDialog(true);
        toast.success("Đã định vị vị trí GPS thành công!");
      },
      (error) => {
        toast.dismiss(toastId);
        setGpsLoading(false);
        console.error("Lỗi định vị check-in:", error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Không được cấp quyền vị trí. Vui lòng cho phép trình duyệt truy cập GPS.");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Không lấy được tín hiệu GPS. Vui lòng kiểm tra cài đặt định vị.");
            break;
          case error.TIMEOUT:
            toast.error("Thời gian định vị GPS quá hạn.");
            break;
          default:
            toast.error("Không lấy được vị trí GPS hiện tại.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleCheckIn = async () => {
    if (!currentGps) {
      toast.error("Thiếu tọa độ định vị GPS hiện tại.");
      return;
    }

    const hasCoords = hasValidCoordinates(customer);
    let distance: number | null = null;
    let isValid = false;

    if (hasCoords) {
      distance = calculateDistanceMeters(
        currentGps.latitude,
        currentGps.longitude,
        Number(customer.latitude),
        Number(customer.longitude)
      );
      isValid = isWithinRadius(distance, 200);
    }

    // Require note for exceptions (no coordinates or out of range)
    if ((!hasCoords || !isValid) && !checkinNote.trim()) {
      toast.error("Vui lòng nhập lý do check-in ngoại lệ (khoảng cách > 200m hoặc chưa định vị Spa).");
      return;
    }

    setCheckinSubmitting(true);
    const toastId = toast.loading("Đang ghi nhận lượt check-in...");

    try {
      // 1. Insert customer_visit_checkins and fetch created row ID
      const { data: checkinData, error: checkinErr } = await supabase
        .from("customer_visit_checkins")
        .insert({
          customer_id: customer.id,
          checked_in_by: user?.id,
          latitude: currentGps.latitude,
          longitude: currentGps.longitude,
          accuracy_meters: currentGps.accuracy,
          customer_latitude: hasCoords ? Number(customer.latitude) : null,
          customer_longitude: hasCoords ? Number(customer.longitude) : null,
          distance_meters: distance,
          is_valid_location: isValid,
          valid_radius_meters: 200,
          note: checkinNote
        })
        .select("id")
        .single();

      if (checkinErr) throw checkinErr;
      if (!checkinData) throw new Error("Không thể khởi tạo mã check-in.");

      // 2. Upload photos if any selected
      const uploadedPaths: string[] = [];
      const photoMetadataRecords: any[] = [];

      if (checkinPhotos.length > 0) {
        toast.loading("Đang nén và tải lên ảnh minh chứng...", { id: toastId });

        for (let i = 0; i < checkinPhotos.length; i++) {
          const originalFile = checkinPhotos[i];
          const compressedFile = await compressPhoto(originalFile);

          const photoId = crypto.randomUUID();
          // relative path to bucket: {customer_id}/{checkin_id}/{photo_id}.webp
          const storagePath = `${customer.id}/${checkinData.id}/${photoId}.webp`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("visit-photos")
            .upload(storagePath, compressedFile, {
              cacheControl: "3600",
              upsert: false
            });

          if (uploadErr) {
            // Rollback already uploaded files
            for (const path of uploadedPaths) {
              await supabase.storage.from("visit-photos").remove([path]);
            }
            // Cascade delete the check-in record
            await supabase.from("customer_visit_checkins").delete().eq("id", checkinData.id);
            throw new Error(`Lỗi tải ảnh lên Storage: ${uploadErr.message}`);
          }

          uploadedPaths.push(storagePath);

          // Get image dimensions
          const dimensions = await new Promise<{ width: number; height: number } | null>((resolve) => {
            const r = new FileReader();
            r.readAsDataURL(compressedFile);
            r.onload = (e) => {
              const im = new Image();
              im.src = e.target?.result as string;
              im.onload = () => resolve({ width: im.width, height: im.height });
              im.onerror = () => resolve(null);
            };
            r.onerror = () => resolve(null);
          });

          photoMetadataRecords.push({
            id: photoId,
            checkin_id: checkinData.id,
            customer_id: customer.id,
            uploaded_by: user?.id,
            storage_bucket: "visit-photos",
            storage_path: storagePath,
            file_name: originalFile.name,
            mime_type: compressedFile.type,
            file_size_bytes: compressedFile.size,
            width: dimensions?.width || null,
            height: dimensions?.height || null,
            photo_type: i === 0 ? "storefront" : "other"
          });
        }

        // Insert metadata records into public.customer_visit_photos
        const { error: metaErr } = await supabase
          .from("customer_visit_photos")
          .insert(photoMetadataRecords);

        if (metaErr) {
          // Metadata fail rollback: Delete uploaded storage files
          for (const path of uploadedPaths) {
            await supabase.storage.from("visit-photos").remove([path]);
          }
          // Delete inserted check-in record to maintain transaction consistency
          await supabase.from("customer_visit_checkins").delete().eq("id", checkinData.id);
          throw new Error(`Lỗi lưu thông tin ảnh vào DB: ${metaErr.message}`);
        }
      }

      // 3. Insert customer_activities (direct_visit)
      const distanceLabel = distance !== null ? `${Math.round(distance)}m` : "Chưa xác định";
      const statusLabel = isValid ? "Đúng vị trí (< 200m)" : "Ngoại lệ (Sai lệch hoặc chưa ghim)";
      const { error: actErr } = await supabase
        .from("customer_activities")
        .insert({
          customer_id: customer.id,
          created_by: user?.id,
          activity_type: "direct_visit",
          title: `Check-in tại khách hàng${isValid ? "" : " (Ngoại lệ)"}`,
          content: `Nhân viên check-in: ${user?.email || "Staff"}\nKhoảng cách: ${distanceLabel}\nTrạng thái: ${statusLabel}\nSố ảnh đính kèm: ${checkinPhotos.length}\nGhi chú: ${checkinNote || "Không có"}`,
          metadata: { checkin_id: checkinData.id }
        });

      if (actErr) throw actErr;

      // 4. Update customer last interaction metadata
      await supabase
        .from("customers")
        .update({
          last_owner_activity_at: new Date().toISOString()
        })
        .eq("id", customer.id);

      toast.dismiss(toastId);
      toast.success("Check-in và lưu ảnh minh chứng thành công!");
      setShowCheckinDialog(false);
      setCurrentGps(null);
      setCheckinNote("");
      setCheckinPhotos([]); // Reset files
      fetchCustomerDetails();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Không thể hoàn tất check-in: " + err.message);
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const handleGetGpsForEdit = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt không hỗ trợ Geolocation.");
      return;
    }
    toast.loading("Đang lấy tọa độ GPS...", { id: "gps_edit" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss("gps_edit");
        setEditLocationForm(prev => ({
          ...prev,
          latitude: pos.coords.latitude.toString(),
          longitude: pos.coords.longitude.toString(),
          accuracy: pos.coords.accuracy
        }));
        toast.success("Đã lấy tọa độ GPS thành công");
      },
      (err) => {
        toast.dismiss("gps_edit");
        toast.error("Không thể lấy tọa độ: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePreviewUrl = () => {
    if (!editLocationForm.url.trim()) return;
    const coords = parseGoogleMapsUrlToCoordinates(editLocationForm.url);
    if (coords) {
      setEditLocationForm(prev => ({
        ...prev,
        latitude: coords.latitude.toString(),
        longitude: coords.longitude.toString()
      }));
      toast.success("Đã trích xuất tọa độ thành công!");
    } else {
      toast.error("Không thể trích xuất tọa độ từ URL/Text này. Vui lòng kiểm tra lại định dạng.");
    }
  };

  const handleSaveLocation = async () => {
    const lat = parseFloat(editLocationForm.latitude);
    const lng = parseFloat(editLocationForm.longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error("Tọa độ không hợp lệ.");
      return;
    }

    if (editLocationMethod === "gps" && editLocationForm.accuracy && editLocationForm.accuracy > 1000) {
      const confirm = window.confirm("Độ chính xác vị trí rất thấp (> 1000m). Bạn có chắc chắn muốn lưu?");
      if (!confirm) return;
    }

    let geoSource = "manual";
    if (editLocationMethod === "gps") geoSource = "gps_checkin";
    if (editLocationMethod === "url") geoSource = "google_maps_url";

    setEditLocationSubmitting(true);
    try {
      const { error: updateErr } = await supabase
        .from("customers")
        .update({
          latitude: lat,
          longitude: lng,
          geo_source: geoSource,
          geo_verified_at: new Date().toISOString(),
          geo_verified_by: user?.id
        })
        .eq("id", customer.id);

      if (updateErr) throw updateErr;

      let content = `Nguồn cập nhật: ${editLocationMethod === "gps" ? "GPS trực tiếp" : editLocationMethod === "url" ? "Link Google Maps" : "Nhập tay"}\nToạ độ: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      if (editLocationMethod === "gps" && editLocationForm.accuracy) {
        content += `\nĐộ chính xác: +/- ${Math.round(editLocationForm.accuracy)}m`;
      }

      const { error: actErr } = await supabase
        .from("customer_activities")
        .insert({
          customer_id: customer.id,
          created_by: user?.id,
          activity_type: "note",
          title: "Cập nhật vị trí khách hàng",
          content: content
        });

      if (actErr) throw actErr;

      toast.success("Cập nhật vị trí thành công!");
      setShowEditLocationDialog(false);
      fetchCustomerDetails();
    } catch (err: any) {
      toast.error("Lỗi cập nhật vị trí: " + err.message);
    } finally {
      setEditLocationSubmitting(false);
    }
  };

  const handleApplyRouting = async (suggested: any, distance: number) => {
    const confirm = window.confirm("Áp dụng gợi ý phân tuyến cho khách này?");
    if (!confirm) return;

    try {
      const { error: updateErr } = await supabase
        .from("customers")
        .update({
          customer_distance_type: suggested.distanceType,
          customer_channel: suggested.customerChannel,
          care_model: suggested.careModel
        })
        .eq("id", customer.id);
      
      if (updateErr) throw updateErr;

      const content = `Khoảng cách tính được: ${Math.round(distance)} mét\n\nPhân tuyến cũ:\n- Khoảng cách: ${customer.customer_distance_type || 'Chưa có'}\n- Kênh: ${customer.customer_channel || 'Chưa có'}\n- Mô hình: ${customer.care_model || 'Chưa có'}\n\nPhân tuyến mới:\n- Khoảng cách: ${suggested.distanceType}\n- Kênh: ${suggested.customerChannel}\n- Mô hình: ${suggested.careModel}`;
      
      const { error: actErr } = await supabase
        .from("customer_activities")
        .insert({
          customer_id: customer.id,
          created_by: user?.id,
          activity_type: "note",
          title: "Cập nhật phân tuyến theo khoảng cách",
          content: content
        });

      if (actErr) throw actErr;

      toast.success("Áp dụng gợi ý thành công!");
      fetchCustomerDetails();
    } catch (err: any) {
      toast.error("Lỗi áp dụng gợi ý: " + err.message);
    }
  };

  const handleRevoke = async () => {
    const confirm = window.confirm("Bạn có chắc chắn muốn thu hồi khách hàng này?\nKhách hàng sẽ bị xóa Sale/Tele phụ trách và đưa về kho chung.");
    if (!confirm) return;

    const toastId = toast.loading("Đang thu hồi khách hàng...");
    try {
      const { error } = await supabase
        .from("customers")
        .update({
          owner_sale_id: null,
          owner_tele_id: null,
          care_model: "sale_owned"
        })
        .eq("id", customer.id);

      if (error) throw error;

      await supabase.from("customer_activities").insert({
        customer_id: customer.id,
        activity_type: "handoff",
        title: "Thu hồi khách hàng",
        content: "Admin đã thu hồi khách hàng về kho chung (Chưa phân công).",
        created_by: user?.id
      });

      toast.success("Đã thu hồi khách hàng thành công!", { id: toastId });
      
      // Update local context
      if (typeof fetchCustomerDetails === "function") {
        fetchCustomerDetails();
        window.dispatchEvent(new Event('refresh_customers_list'));
      } else {
        // Fallback reload
        window.location.reload();
      }
    } catch (err: any) {
      toast.error("Không thể thu hồi: " + err.message, { id: toastId });
    }
  };

  const getCareModelWarning = () => {
    if (!customer.care_model) return "Chưa xác lập mô hình hỗ trợ.";
    if ((customer.care_model === "sale_only" || customer.care_model === "direct_sale") && !customer.owner_sale_id) {
      return "Mô hình Sale: Thiếu Sale phụ trách.";
    }
    if (customer.care_model === "tele_qualified_then_sale" || customer.care_model === "both" || customer.care_model === "joint") {
      if (!customer.owner_tele_id && !customer.owner_sale_id) {
        return "Mô hình phối hợp: Thiếu cả Tele hỗ trợ và Sale phụ trách.";
      }
      if (!customer.owner_tele_id) {
        return "Mô hình phối hợp: Thiếu Tele hỗ trợ phụ trách.";
      }
      if (!customer.owner_sale_id) {
        return "Mô hình phối hợp: Thiếu Sale phụ trách.";
      }
    }
    return null;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Chưa có";
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: vi });
  };

  const getDayKey = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      
      if (d.toDateString() === today.toDateString()) return "Hôm nay";
      if (d.toDateString() === yesterday.toDateString()) return "Hôm qua";
      return format(d, "dd 'tháng' MM, yyyy", { locale: vi });
    } catch {
      return "Khác";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="w-3.5 h-3.5 text-blue-500" />;
      case "zalo_message":
        return <MessageCircle className="w-3.5 h-3.5 text-sky-500" />;
      case "direct_visit":
        return <MapPin className="w-3.5 h-3.5 text-orange-500" />;
      case "online_consultation":
        return <Video className="w-3.5 h-3.5 text-purple-500" />;
      case "quote_sent":
        return <FileText className="w-3.5 h-3.5 text-teal-500" />;
      case "order_created":
        return <Package className="w-3.5 h-3.5 text-emerald-500" />;
      case "check_in":
        return <Clock className="w-3.5 h-3.5 text-rose-500" />;
      case "handoff":
        return <UserCheck className="w-3.5 h-3.5 text-amber-500" />;
      case "event_registered":
        return <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-50" />;
      case "task_created":
        return <Plus className="w-3.5 h-3.5 text-indigo-500" />;
      case "task_completed":
        return <Check className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const mergedTimeline = useMemo(() => {
    let list: any[] = [];
    
    // Add activities
    activities.forEach(act => {
      list.push({
        id: act.id,
        type: act.activity_type || 'note',
        title: act.title || 'Ghi chú chăm sóc',
        content: act.content,
        created_at: act.created_at,
        raw: act
      });
    });

    // Add orders as order_created activities
    orders.forEach(ord => {
      list.push({
        id: `order-${ord.id}`,
        type: 'order_created',
        title: `Đã tạo đơn hàng #${ord.order_no || ord.id.slice(0, 8)}`,
        content: `Trị giá: ${formatCurrency(ord.total || ord.total_amount || 0)} · Trạng thái: ${ord.status || 'Chờ duyệt'}`,
        created_at: ord.created_at,
        raw: ord
      });
    });

    // Add event registrations as event activities
    events.forEach(ev => {
      list.push({
        id: `event-${ev.id}`,
        type: 'event_registered',
        title: `Đăng ký sự kiện: ${ev.company_events?.title || 'Sự kiện Desembre'}`,
        content: `Trạng thái tham gia: ${ev.status || 'Đăng ký thành công'}`,
        created_at: ev.created_at,
        raw: ev
      });
    });

    // Sort by created_at descending
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply filter
    if (timelineFilter !== "all") {
      list = list.filter(item => {
        if (timelineFilter === "event") return item.type === "event_registered";
        return item.type === timelineFilter;
      });
    }

    return list;
  }, [activities, orders, events, timelineFilter]);

  // Group timeline by day key
  const groupedTimeline = useMemo(() => {
    const map: Record<string, any[]> = {};
    mergedTimeline.forEach(item => {
      const key = getDayKey(item.created_at);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [mergedTimeline]);

  if (!customer.id) return null;

  const warning = getCareModelWarning();

  const getLifecycleBadgeColor = (stage: string) => {
    switch (stage) {
      case "new_lead": return "bg-sky-50 text-sky-700 border-sky-200";
      case "assigned": return "bg-blue-50 text-blue-700 border-blue-200";
      case "contacted": return "bg-amber-50 text-amber-700 border-amber-200";
      case "qualified": return "bg-purple-50 text-purple-700 border-purple-200";
      case "proposal": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "won": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "lost": return "bg-rose-50 text-rose-700 border-rose-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getPotentialBadgeColor = (level: string) => {
    switch (level) {
      case "hot": return "bg-red-500 text-white";
      case "warm": return "bg-amber-500 text-white";
      case "cold": return "bg-blue-400 text-white";
      default: return "bg-slate-300 text-slate-700";
    }
  };

  const staffNameSale = getStaffDisplayName(customer.owner_sale_id, combinedStaffMap);
  const staffNameTele = getStaffDisplayName(customer.owner_tele_id, combinedStaffMap);

  const needsRouting = hasValidCoordinates(customer) && (
    !customer.customer_channel || 
    !customer.customer_distance_type || 
    !customer.care_model
  );

  const suggestedAction = getSuggestedNextAction(customer);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col h-full border-l border-slate-200 shadow-2xl">
        
        {/* HEADER SECTION (UPGRADED TO QUICK AXIS CENTER) */}
        <div className="bg-slate-900 text-white p-6 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Building2 className="w-32 h-32" />
          </div>
          
          <div className="relative z-10 space-y-4">
            {/* BADGES & PHONE */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`border-none rounded-full px-2.5 py-0.5 text-[9px] font-black tracking-wider uppercase ${getLifecycleBadgeColor(customer.lifecycle_stage || customer.status)}`}>
                  {customer.lifecycle_stage || customer.status || "Mới"}
                </Badge>
                {customer.potential_level && (
                  <Badge className={`border-none rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${getPotentialBadgeColor(customer.potential_level)}`}>
                    {customer.potential_level === "hot" ? "HOT 🔥" : customer.potential_level.toUpperCase()}
                  </Badge>
                )}
                {needsRouting && (
                  <Badge className="border-none rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase bg-amber-500 hover:bg-amber-600 text-white animate-pulse">
                    Cần phân tuyến
                  </Badge>
                )}
              </div>
              
              {customer.phone && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  {customer.phone}
                </div>
              )}
            </div>

            {/* CUSTOMER NAME AND FACILITY */}
            <div className="space-y-1 min-w-0">
              <h2 className="text-xl font-black tracking-tight leading-snug flex items-center gap-2">
                <span className="truncate" title={customer.contact_name || customer.name || "Khách hàng mới"}>
                  {customer.contact_name || customer.name || "Khách hàng mới"}
                </span>
                {suggestedAction && (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 uppercase tracking-widest whitespace-nowrap shrink-0">
                    {suggestedAction}
                  </span>
                )}
              </h2>
              <p className="text-white/80 text-sm flex items-center gap-1.5 font-bold">
                <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {customer.business_name || customer.facility_name || "Spa Tự Do"}
              </p>
            </div>

            <Separator className="bg-white/10" />

            {/* UPGRADED GRID DATA ATTACHED IN THE HEADER FOR 30s ASSESSMENT */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 text-[11px] font-medium text-white/70">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Tuyến CS / Khoảng cách</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {getCustomerChannelLabel(customer.customer_channel)} &middot; {getCustomerDistanceLabel(customer.customer_distance_type)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Mô hình hỗ trợ</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  {getCareModelLabel(customer.care_model)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Sale phụ trách</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  {staffNameSale}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Tele hỗ trợ</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {staffNameTele}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-8 pb-12">
            
            {/* FOCUS INTERACTION PANEL */}
            <FocusInteractionPanel 
              customer={customer} 
              onNextCustomer={onNextCustomer} 
            />

            {/* QUICK ACTIONS */}
            <div className="grid grid-cols-3 gap-2">
              <Button 
                onClick={() => setQuickAction(quickAction === 'note' ? null : 'note')} 
                variant={quickAction === 'note' ? 'default' : 'outline'} 
                className={`text-xs h-9 ${quickAction === 'note' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Ghi Chú
              </Button>
              <Button 
                onClick={() => setQuickAction(quickAction === 'task' ? null : 'task')} 
                variant={quickAction === 'task' ? 'default' : 'outline'} 
                className={`text-xs h-9 ${quickAction === 'task' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1" /> Giao Task
              </Button>
              <Button 
                onClick={() => setQuickAction(quickAction === 'followup' ? null : 'followup')} 
                variant={quickAction === 'followup' ? 'default' : 'outline'} 
                className={`text-xs h-9 ${quickAction === 'followup' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                <Calendar className="w-3.5 h-3.5 mr-1" /> Hẹn Lịch
              </Button>
            </div>

            {/* SECTION: DATA HEALTH */}
            {(() => {
               const health = getCustomerDataHealth(activeCustomer ?? customer);
               return (
                 <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-sm space-y-3">
                   <div className="flex items-center justify-between">
                     <h3 className="text-[12px] font-black text-slate-800 uppercase flex items-center gap-2">
                       <Activity className="w-4 h-4 text-slate-500" /> Sức khỏe dữ liệu
                     </h3>
                     <DataHealthBadge customer={activeCustomer ?? customer} mode="compact" />
                   </div>
                   {health.severity === 'ok' ? (
                     <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                       <Check className="w-4 h-4" /> Dữ liệu khách hàng ổn định
                     </div>
                   ) : (
                     <ul className="space-y-1.5">
                       {health.reasons.map((r, i) => (
                         <li key={i} className="text-[11px] font-medium text-slate-600 flex items-start gap-1.5 bg-white p-2 rounded-lg border border-slate-100 shadow-3xs">
                           <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${health.severity === 'danger' ? 'text-rose-500' : 'text-amber-500'}`} />
                           {r}
                         </li>
                       ))}
                     </ul>
                   )}
                 </div>
               );
            })()}

            {/* SECTION: CORE INFO */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
              <h3 className="text-[12px] font-black text-slate-800 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
                <Info className="w-4 h-4 text-slate-500" /> Thông tin chính
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Khách hàng</span>
                  <div className="text-[11px] font-bold text-slate-900 break-words">{customer.contact_name || customer.name || "Chưa có"}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Cơ sở / Doanh nghiệp</span>
                  <div className="text-[11px] font-bold text-slate-900 break-words">{customer.business_name || customer.facility_name || "Chưa có"}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Điện thoại</span>
                  <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                    {customer.phone ? <><Phone className="w-3 h-3 text-emerald-500"/>{customer.phone}</> : "Chưa có"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Email</span>
                  <div className="text-[11px] font-bold text-slate-900 break-words">{customer.email || "Chưa có"}</div>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Địa chỉ</span>
                  <div className="text-[11px] font-bold text-slate-900 break-words">{[customer.address, customer.city].filter(Boolean).join(", ") || "Chưa có"}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Nguồn khách</span>
                  <div className="text-[11px] font-bold text-slate-900">{customer.customer_channel || customer.source || "Chưa rõ"}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Giai đoạn chăm sóc</span>
                  <div className="text-[11px] font-bold text-slate-900">{customer.lifecycle_stage || customer.status || "Chưa có"}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Người phụ trách</span>
                  <div className="text-[11px] font-bold text-slate-900">{getStaffDisplayName(customer.owner_sale_id || customer.owner_tele_id, combinedStaffMap) || "Chưa có"}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Ngày tạo</span>
                  <div className="text-[11px] font-bold text-slate-900">{customer.created_at ? format(new Date(customer.created_at), 'dd/MM/yyyy HH:mm', { locale: vi }) : "Chưa có"}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Cập nhật cuối</span>
                  <div className="text-[11px] font-bold text-slate-900">{customer.updated_at ? format(new Date(customer.updated_at), 'dd/MM/yyyy HH:mm', { locale: vi }) : "Chưa có"}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Liên hệ lần cuối</span>
                  <div className="text-[11px] font-bold text-slate-900">{customer.last_contacted_at ? format(new Date(customer.last_contacted_at), 'dd/MM/yyyy HH:mm', { locale: vi }) : "Chưa có"}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Tương tác hệ thống cuối</span>
                  <div className="text-[11px] font-bold text-slate-900">{customer.last_activity_at ? format(new Date(customer.last_activity_at), 'dd/MM/yyyy HH:mm', { locale: vi }) : "Chưa có"}</div>
                </div>
              </div>
            </div>

            {/* SECTION: CONSENT & TAGS */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
                <h3 className="text-[12px] font-black text-slate-800 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
                  <MessageCircle className="w-4 h-4 text-slate-500" /> Marketing Consent
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600">Email</span>
                    <Badge variant="outline" className="text-[9px] bg-white text-slate-500 border-slate-200">Chưa có dữ liệu consent</Badge>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600">Zalo OA</span>
                    <Badge variant="outline" className="text-[9px] bg-white text-slate-500 border-slate-200">Chưa có dữ liệu consent</Badge>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
                <h3 className="text-[12px] font-black text-slate-800 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Target className="w-4 h-4 text-slate-500" /> Phân loại (Tags)
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {customer.tags && Array.isArray(customer.tags) && customer.tags.length > 0 ? (
                    customer.tags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400 italic">Chưa có tag</span>
                  )}
                </div>
              </div>
            </div>

            {/* CARE MODEL WARNING */}
            {warning && (
              <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-rose-800 text-[11px] font-medium leading-relaxed shadow-3xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-bold">Cần phân công:</span> {warning}
                </div>
              </div>
            )}

            {/* SECTION B — INTELLIGENCE ZONE */}
            <section className="space-y-4">
              {isAdmin || isSubAdmin ? (
                <AdminCustomerInsights 
                  customer={customer}
                  onAssignSale={() => setShowAssignDialog(true)}
                  onAssignTele={() => setShowAssignDialog(true)}
                  onRevoke={handleRevoke}
                  onAdminNote={() => setQuickAction('note')}
                />
              ) : (
                <SaleCustomerInsights 
                  customer={customer}
                  interactionSummary={interactionSummary}
                  onQuickAction={(val: any) => setQuickAction(val)}
                  onCreateOrder={() => {
                    onOpenChange(false);
                    navigate({ to: "/orders/new", search: { customerId: customer.id } });
                  }}
                />
              )}

              {/* Action forms moved up for immediate visibility */}
              {quickAction === "note" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-primary" /> THÊM GHI CHÚ CHĂM SÓC
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
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
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Hẹn cuộc gọi tiếp</Label>
                      <Input 
                        type="datetime-local" 
                        value={noteForm.next_follow_up_at}
                        onChange={(e) => setNoteForm({ ...noteForm, next_follow_up_at: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Tiêu đề ghi chú <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="VD: Khách quan tâm dòng tế bào gốc EGF..."
                        value={noteForm.title}
                        onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Chi tiết trao đổi</Label>
                      <Textarea 
                        placeholder="Nội dung cụ thể trao đổi với chủ Spa..."
                        value={noteForm.content}
                        onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                        className="min-h-[70px] text-[11px] bg-white"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleAddNote} 
                    disabled={submitting}
                    className="w-full h-8 text-[11px] font-bold"
                  >
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Send className="w-3 h-3 mr-2" />}
                    Lưu ghi chú
                  </Button>
                </div>
              )}

              {quickAction === "task" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-primary" /> ĐẶT TASK GỌI LẠI / LIÊN HỆ
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Tiêu đề công việc <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="VD: Gọi điện chốt hợp đồng, báo giá chiết khấu..."
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Hạn chót (Due Date) <span className="text-red-500">*</span></Label>
                      <Input 
                        type="datetime-local" 
                        value={taskForm.due_at}
                        onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Độ ưu tiên</Label>
                      <Select 
                        value={taskForm.priority} 
                        onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}
                      >
                        <SelectTrigger className="h-8 text-[11px] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Thấp</SelectItem>
                          <SelectItem value="normal">Trung bình</SelectItem>
                          <SelectItem value="high">Cao 🔥</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button 
                    onClick={handleCreateTask} 
                    disabled={submitting}
                    className="w-full h-8 text-[11px] font-bold bg-primary hover:bg-primary/95"
                  >
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                    Tạo việc cần làm
                  </Button>
                </div>
              )}

              {quickAction === "followup" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                    <CalendarCheck className="w-3.5 h-3.5 text-primary" /> HẸN LỊCH GẶP / LỊCH CHĂM SÓC
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Tên sự kiện / Nội dung gặp <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="VD: Gặp trực tiếp Demo sản phẩm..."
                        value={followupForm.title}
                        onChange={(e) => setFollowupForm({ ...followupForm, title: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Thời gian bắt đầu <span className="text-red-500">*</span></Label>
                      <Input 
                        type="datetime-local" 
                        value={followupForm.starts_at}
                        onChange={(e) => setFollowupForm({ ...followupForm, starts_at: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Loại sự kiện</Label>
                      <Select 
                        value={followupForm.event_type} 
                        onValueChange={(v) => setFollowupForm({ ...followupForm, event_type: v })}
                      >
                        <SelectTrigger className="h-8 text-[11px] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meeting">Lịch hẹn (Meeting)</SelectItem>
                          <SelectItem value="follow_up">Follow-up</SelectItem>
                          <SelectItem value="check_in">Đặt check-in</SelectItem>
                          <SelectItem value="customer_visit">Thăm khách</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Địa điểm</Label>
                      <Input 
                        placeholder="Online / Spa khách..."
                        value={followupForm.location}
                        onChange={(e) => setFollowupForm({ ...followupForm, location: e.target.value })}
                        className="h-8 text-[11px] bg-white"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Ghi chú thêm</Label>
                      <Textarea 
                        placeholder="Nội dung thảo luận hoặc chuẩn bị..."
                        value={followupForm.description}
                        onChange={(e) => setFollowupForm({ ...followupForm, description: e.target.value })}
                        className="min-h-[50px] text-[11px] bg-white"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleCreateFollowup} 
                    disabled={submitting}
                    className="w-full h-8 text-[11px] font-bold bg-primary hover:bg-primary/95"
                  >
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Calendar className="w-3.5 h-3.5 mr-1.5" />}
                    Đặt lịch hẹn
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                <CustomerRiskSummary customer={customer} />
                <CustomerMiniKpi customer={customer} interactions={activities} tasks={tasks} orders={orders} />
              </div>
            </section>

            {/* SECONDARY SECTION */}
            <details className="group border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-sm">
              <summary className="p-3 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-100 flex items-center justify-between outline-none">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" /> Vị trí & Tự động hóa
                </div>
                <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="p-4 bg-white space-y-6 border-t border-slate-200">
                <CustomerAutomationStatus customerId={customer.id} />
                
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-[11px] uppercase tracking-wider">
                      Vị trí khách hàng
                    </div>
                <button
                  onClick={() => setShowEditLocationDialog(true)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <MapPin className="w-3 h-3" />
                  Sửa vị trí
                </button>
              </div>

              {hasValidCoordinates(customer) ? (
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/80 space-y-3.5 shadow-3xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">Đã có tọa độ định vị</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-150 px-2.5 py-0.5 rounded-full shadow-3xs">
                      GPS: {Number(customer.latitude).toFixed(5)}, {Number(customer.longitude).toFixed(5)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={buildGoogleMapsSearchUrl(customer)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 shadow-3xs transition-all hover:scale-102"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-slate-500" />
                      Mở Google Maps
                    </a>
                    <a
                      href={buildGoogleMapsDirectionsUrl(customer)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-slate-900 hover:bg-black text-[11px] font-black text-white shadow-md shadow-slate-100 transition-all hover:scale-102"
                    >
                      <Navigation className="w-3.5 h-3.5 text-white animate-pulse" />
                      Chỉ đường đi
                    </a>
                  </div>

                  <div className="pt-3.5 border-t border-emerald-100/80">
                    <button
                      onClick={handleGetGpsForCheckin}
                      disabled={gpsLoading}
                      className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-[11px] font-black text-white shadow-lg shadow-emerald-100 transition-all hover:scale-102"
                    >
                      {gpsLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                      Check-in tại Spa
                    </button>
                  </div>

                  {companyLocationLoading ? (
                    <div className="pt-3.5 border-t border-emerald-100/80 flex items-center justify-center p-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    </div>
                  ) : companyLocation ? (
                    (() => {
                      const distMeters = calculateDistanceMeters(
                        Number(customer.latitude),
                        Number(customer.longitude),
                        Number(companyLocation.latitude),
                        Number(companyLocation.longitude)
                      );
                      const distKm = (distMeters / 1000).toFixed(1);
                      const suggested = getRecommendedRoutingByDistance(distMeters, {
                        nearKm: settings.routingNearKm,
                        cityKm: settings.routingCityKm,
                        farKm: settings.routingFarKm
                      });
                      const isSame = suggested.customerChannel === customer.customer_channel && 
                                     suggested.careModel === customer.care_model && 
                                     suggested.distanceType === customer.customer_distance_type;

                      return (
                        <div className="pt-3.5 border-t border-emerald-100/80 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700">Cách {companyLocation.name}:</span>
                            <span className="text-[11px] font-black text-emerald-600">{distKm} km</span>
                          </div>
                          
                          <div className="bg-white rounded-lg p-2.5 border border-emerald-100 space-y-2 relative">
                            {isSame ? (
                              <Badge className="absolute -top-2 -right-2 text-[8px] bg-emerald-500 hover:bg-emerald-600 border-none">Phân tuyến hiện tại đã phù hợp</Badge>
                            ) : (
                              <Badge className="absolute -top-2 -right-2 text-[8px] bg-amber-500 hover:bg-amber-600 border-none animate-pulse">Có gợi ý mới</Badge>
                            )}
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-500 font-medium">Khoảng cách gợi ý:</span>
                              <span className="font-bold text-slate-700">{getCustomerDistanceLabel(suggested.distanceType)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-500 font-medium">Gợi ý tuyến:</span>
                              <span className="font-bold text-slate-700">{getCustomerChannelLabel(suggested.customerChannel)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-500 font-medium">Mô hình gợi ý:</span>
                              <span className="font-bold text-slate-700">{getCareModelLabel(suggested.careModel)}</span>
                            </div>
                          </div>

                          {(isAdmin || isSubAdmin) && (
                            <button
                              onClick={() => handleApplyRouting(suggested, distMeters)}
                              className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-[10px] font-bold text-white shadow-sm transition-all"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                              Áp dụng gợi ý phân tuyến
                            </button>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="pt-3.5 border-t border-emerald-100/80">
                      <div className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        Chưa cấu hình văn phòng mặc định.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-150 space-y-3.5 shadow-3xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-350" />
                      <span className="text-[11px] font-black text-slate-550 uppercase tracking-wider">Chưa có tọa độ định vị</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-start gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      Khách chưa có tọa độ chính xác, Google Maps sẽ tìm theo địa chỉ/tên cơ sở.<br/>
                      <span className="font-bold text-amber-700">Chưa thể tính khoảng cách — cần ghim vị trí khách.</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handlePinCurrentLocation}
                      disabled={pinning}
                      className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-primary hover:bg-primary/95 disabled:bg-slate-200 text-[11px] font-black text-white shadow-lg shadow-primary/10 transition-all hover:scale-102"
                    >
                      {pinning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 text-white" />
                      )}
                      Ghim vị trí hiện tại
                    </button>
                    <a
                      href={buildGoogleMapsSearchUrl(customer)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 shadow-3xs transition-all hover:scale-102"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-slate-500" />
                      Tìm địa chỉ Spa
                    </a>
                  </div>

                  <div className="pt-3.5 border-t border-slate-200">
                    <button
                      onClick={handleGetGpsForCheckin}
                      disabled={gpsLoading}
                      className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-dashed border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 transition-all hover:scale-102"
                    >
                      {gpsLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      Check-in ngoại lệ (Chưa định vị Spa)
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </details>

        {/* CUSTOMER CONTACTS SECTION */}
        <section className="space-y-4">
          <CustomerContacts customerId={customer.id} />
        </section>

        {/* CONTACT CHANNELS & REMARKETING SECTION */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Target className="w-4 h-4 text-primary" /> Kênh liên hệ & Remarketing
                </div>
              </div>
              <CustomerContactChannels customerId={customer.id} />
            </section>

            {/* AI SUGGESTIONS SECTION */}
            <CustomerAiSuggestions customerId={customer.id} />

            {/* QUICK ACTIONS & COMMUNICATION */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-primary" /> Hành động & Giao tiếp
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    onOpenChange(false);
                    navigate({ to: "/orders/new", search: { customerId: customer.id } });
                  }}
                  className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold transition-all"
                >
                  <Package className="w-4 h-4" />
                  Tạo đơn hàng mới
                </button>
              </div>

              <CommunicationLaunchers 
                customerId={customer.id}
                customerName={customer.name || customer.full_name}
                customerPhone={customer.phone}
                customerEmail={customer.email}
                customerCity={customer.city || customer.province}
                userAccounts={userCommAccounts}
                customerChannels={customerChannels}
                interactionSummary={interactionSummary}
                quickAction={quickAction}
                setQuickAction={(val: any) => setQuickAction(val)}
              />

              {/* Action forms moved to top intelligence zone */}
            </section>

            {/* INTEL & UPSELL SECTION */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-pulse" /> Phân tích & Upsell thông minh
              </div>
              <CustomerUpsellIntel 
                orders={orders} 
                items={orderItems} 
                totalSpend={orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)} 
              />
              <CustomerKnowledgeUpsell 
                customer={customer}
                orders={orders}
                items={orderItems}
              />
            </section>

            {/* ACTION SUGGESTIONS (Phase 6.2) */}
            {actionSuggestions.length > 0 && isFeatureEnabledForUser("ai_suggestion", user?.id) && (
              <section className="space-y-4">
                <AISuggestionCard suggestions={actionSuggestions} customerId={customer.id} />
              </section>
            )}

            {/* NEW TIMELINE P2 */}
            <details className="group border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-sm">
              <summary className="p-3 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-100 flex items-center justify-between outline-none">
                <div className="flex items-center gap-2 uppercase tracking-wider">
                  <Activity className="w-4 h-4 text-indigo-500" /> Lịch sử tương tác
                </div>
                <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="bg-white p-4 border-t border-slate-200">
                {activities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <History className="w-8 h-8 text-slate-300 mb-2" />
                    <span className="text-[11px] font-medium text-slate-500">Chưa có lịch sử chăm sóc</span>
                  </div>
                ) : (
                  <CustomerTimelineFeed customerId={customer.id} />
                )}
              </div>
            </details>


            {/* PRODUCT KNOWLEDGE BOOK */}
            {isFeatureEnabledForUser("product_knowledge_qa", user?.id) && (
              <section className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-indigo-600 font-black text-sm uppercase tracking-widest">
                  <Sparkles className="w-4 h-4" /> Cẩm nang sản phẩm
                </div>
                <ProductKnowledgeBook />
              </section>
            )}

            {/* AI CUSTOMER SUMMARY */}
            {isFeatureEnabledForUser("ai_summary", user?.id) && (
              <section className="space-y-4 pt-4 border-t border-slate-100">
                <CustomerAISummary 
                  customerId={customer.id}
                  customerName={customer.name}
                />
              </section>
            )}

            {/* RECENT ORDERS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Package className="w-4 h-4 text-primary" /> Đơn hàng gần đây
              </div>
              {orders.length > 0 ? (
                <div className="space-y-2">
                  {orders.map((ord) => (
                    <div 
                      key={ord.id} 
                      onClick={() => {
                        onOpenChange(false);
                        navigate({ to: "/orders/$id", params: { id: ord.id } });
                      }}
                      className="p-3.5 rounded-xl border border-slate-150 bg-white flex items-center justify-between hover:border-primary/20 transition-all cursor-pointer group shadow-3xs"
                    >
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Mã đơn: #{ord.order_no || ord.id.slice(0, 8)}</div>
                        <div className="text-xs font-black text-slate-800">{formatCurrency(ord.total || ord.total_amount || 0)}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge className="text-[9px] h-4 bg-slate-100 text-slate-700 border-none font-bold uppercase">{ord.status || 'Chờ duyệt'}</Badge>
                        <div className="text-[9px] text-slate-450">{formatDate(ord.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Chưa có đơn hàng
                </div>
              )}
            </section>

            {/* RECENT APPOINTMENTS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Calendar className="w-4 h-4 text-primary" /> Lịch hẹn gần đây
              </div>
              {appointments.length > 0 ? (
                <div className="space-y-2">
                  {appointments.map((app) => (
                    <div key={app.id} className="p-3.5 rounded-xl border border-slate-150 bg-white flex items-center justify-between shadow-3xs">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-800 leading-snug">{app.title}</div>
                        <div className="text-[10px] text-slate-450 font-bold flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> {app.location || "Online"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-black text-indigo-650 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                          {formatDate(app.starts_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Chưa có lịch hẹn
                </div>
              )}
            </section>

            {/* RECENT TASKS WITH QUICK ACTION DROPDOWNS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <CheckSquare className="w-4 h-4 text-primary" /> Việc cần làm (Tasks)
              </div>
              {tasks.length > 0 ? (
                <div className="space-y-2">
                  {tasks.map((tsk) => (
                    <div key={tsk.id} className="p-3.5 rounded-xl border border-slate-150 bg-white flex items-center justify-between hover:border-primary/20 transition-all shadow-3xs">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-800 leading-snug">{tsk.title}</div>
                        {tsk.due_at && (
                          <div className="text-[9px] text-slate-400 font-medium">Hạn chót: {formatDate(tsk.due_at)}</div>
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Badge variant="outline" className={`text-[9px] h-4 font-bold border-none uppercase ${
                            tsk.status === 'completed' ? 'bg-emerald-500 text-white' :
                            tsk.status === 'in_progress' ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {tsk.status === 'completed' ? 'Hoàn thành' : tsk.status === 'in_progress' ? 'Đang xử lý' : 'Chưa chạy'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="shrink-0 flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg hover:bg-slate-100">
                              <MoreHorizontal className="w-4 h-4 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "start" })}>
                              <Play className="w-3.5 h-3.5 mr-2 text-blue-500" /> Bắt đầu xử lý
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "completed" })}>
                              <Check className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Hoàn thành
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "no_answer" })}>
                              <PhoneOff className="w-3.5 h-3.5 mr-2 text-red-500" /> Không nghe máy
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "wrong_number" })}>
                              <UserX className="w-3.5 h-3.5 mr-2 text-slate-500" /> Sai số
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "interested" })}>
                              <Heart className="w-3.5 h-3.5 mr-2 text-pink-500" /> Khách quan tâm
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "call_back_later" })}>
                              <CalendarClock className="w-3.5 h-3.5 mr-2 text-amber-500" /> Hẹn gọi lại
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTaskAction({ task: tsk, action: "transfer_to_sale" })}>
                              <ArrowRightLeft className="w-3.5 h-3.5 mr-2 text-indigo-500" /> Cần chuyển Sale
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Chưa có việc cần làm
                </div>
              )}
            </section>

            {/* RECENT EVENTS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Star className="w-4 h-4 text-amber-500" /> Sự kiện đã đăng ký
              </div>
              {events.length > 0 ? (
                <div className="space-y-2">
                  {events.map((ev) => (
                    <div key={ev.id} className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-100/70 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="font-bold text-xs text-amber-900 leading-relaxed">{ev.company_events?.title || "Sự kiện Desembre"}</div>
                        <Badge className="bg-amber-500 text-white border-none text-[8px] font-bold uppercase">{ev.status || 'Thành công'}</Badge>
                      </div>
                      <div className="text-[10px] text-amber-700/80 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" /> {formatDate(ev.company_events?.starts_at)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Chưa có sự kiện
                </div>
              )}
            </section>

          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-3 shadow-md">
          <button 
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-white border border-slate-250 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-3xs"
            onClick={() => onOpenChange(false)}
          >
            Đóng xem nhanh
          </button>
          <button 
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition-all shadow-3xs"
            onClick={() => {
              navigate({ to: "/customers/$id", params: { id: customer.id } });
              onOpenChange(false);
            }}
          >
            Hồ sơ chi tiết <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </SheetContent>

      <TaskActionDialog 
        taskAction={taskAction}
        onClose={() => setTaskAction(null)}
        onSuccess={() => {
          fetchCustomerDetails();
        }}
      />

      <Dialog open={showCheckinDialog} onOpenChange={setShowCheckinDialog}>
        <DialogContent className="max-w-md w-[calc(100%-32px)] rounded-2xl p-5 gap-4 max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600 animate-pulse" />
              HOÀN TẤT CHECK-IN THỰC ĐỊA
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              Hệ thống sẽ lưu lại tọa độ thực địa của bạn để đối chiếu với địa chỉ định vị của Spa.
            </DialogDescription>
          </DialogHeader>

          {currentGps && (
            <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Độ chính xác GPS</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">+/- {Math.round(currentGps.accuracy)} mét</span>
                  <button 
                    onClick={handleGetGpsForCheckin}
                    disabled={gpsLoading}
                    className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 border border-primary/20 px-2 py-0.5 rounded bg-white"
                  >
                    {gpsLoading ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Crosshair className="w-2.5 h-2.5" />
                    )}
                    Thử lại vị trí
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Tọa độ thực tế</span>
                <span className="font-mono text-slate-800">{currentGps.latitude.toFixed(5)}, {currentGps.longitude.toFixed(5)}</span>
              </div>
              
              {hasValidCoordinates(customer) ? (
                <>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Khoảng cách đến Spa</span>
                    <span className="font-bold text-slate-800">
                      {Math.round(calculateDistanceMeters(
                        currentGps.latitude,
                        currentGps.longitude,
                        Number(customer.latitude),
                        Number(customer.longitude)
                      ))} mét
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Trạng thái vị trí</span>
                    {isWithinRadius(
                      calculateDistanceMeters(
                        currentGps.latitude,
                        currentGps.longitude,
                        Number(customer.latitude),
                        Number(customer.longitude)
                      ),
                      200
                    ) ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Hợp lệ (&lt; 200m)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-100 text-[10px] animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Ngoại lệ (&gt; 200m)
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Trạng thái vị trí</span>
                  <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Chưa ghim Spa (Ngoại lệ)
                  </span>
                </div>
              )}
            </div>
          )}

          {currentGps && currentGps.accuracy > 150 && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[11px] font-bold flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Độ chính xác GPS thấp ({Math.round(currentGps.accuracy)}m &gt; 150m). Vui lòng đứng gần vị trí khách hơn hoặc nhập ghi chú ngoại lệ.</span>
            </div>
          )}

          {/* Form ghi chú check-in */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Nội dung / Lý do check-in {(!hasValidCoordinates(customer) || (currentGps && !isWithinRadius(calculateDistanceMeters(currentGps.latitude, currentGps.longitude, Number(customer.latitude), Number(customer.longitude)), 200))) && <span className="text-red-500">* (Bắt buộc vì check-in ngoại lệ)</span>}
            </Label>
            <Textarea
              placeholder="Nhập ghi chú viếng thăm khách hàng (VD: Trao đổi chương trình chiết khấu mới, gửi mẫu thử...)"
              value={checkinNote}
              onChange={(e) => setCheckinNote(e.target.value)}
              className="min-h-[80px] text-xs"
            />
          </div>

          {/* Tải ảnh minh chứng check-in (Tối đa 2 ảnh) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Ảnh minh chứng ({checkinPhotos.length}/2)
              </Label>
              <span className="text-[9px] font-semibold text-slate-400">
                JPEG, PNG, WebP (Tối đa 1.5MB)
              </span>
            </div>
            
            {checkinPhotos.length < 2 ? (
              <div className="relative">
                <input
                  type="file"
                  id="checkin-photo-upload"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      const selectedFiles = Array.from(e.target.files);
                      const totalFiles = checkinPhotos.length + selectedFiles.length;
                      
                      if (totalFiles > 2) {
                        toast.error("Mỗi lần check-in chỉ được tải tối đa 2 ảnh.");
                        return;
                      }
                      
                      const oversized = selectedFiles.some(f => f.size > 1500000);
                      if (oversized) {
                        toast.error("File ảnh quá lớn. Dung lượng tối đa là 1.5MB.");
                        return;
                      }

                      setCheckinPhotos(prev => [...prev, ...selectedFiles]);
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="checkin-photo-upload"
                  className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/10 cursor-pointer transition-all text-center group"
                >
                  <Camera className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                  <span className="text-[11px] font-black text-slate-600 group-hover:text-emerald-700 transition-colors">
                    Chụp ảnh hoặc Chọn ảnh minh chứng
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400 leading-none">
                    Khuyến nghị: 1 ảnh storefront (mặt tiền)
                  </span>
                </label>
              </div>
            ) : (
              <div className="py-2 px-3 rounded-xl bg-emerald-50/30 border border-emerald-100/50 text-[10px] font-black text-emerald-700 flex items-center gap-1.5 justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đã chọn đủ số lượng ảnh tối đa (2/2)
              </div>
            )}

            {/* Xem trước ảnh (Previews) */}
            {checkinPhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {checkinPhotos.map((file, idx) => {
                  const url = URL.createObjectURL(file);
                  return (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-900 shadow-sm">
                      <img
                        src={url}
                        alt={`Preview ${idx + 1}`}
                        className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
                        onLoad={() => URL.revokeObjectURL(url)}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-between p-2">
                        <span className="text-[9px] font-black text-white px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-3xs">
                          {idx === 0 ? "Ảnh 1 (Mặt tiền)" : "Ảnh 2 (Bổ sung)"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setCheckinPhotos(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow transition-all hover:scale-105"
                          title="Xóa ảnh"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-3.5 sm:space-x-0 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCheckinDialog(false);
                setCurrentGps(null);
                setCheckinNote("");
                setCheckinPhotos([]);
              }}
              className="w-full text-xs font-bold"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={handleCheckIn}
              disabled={checkinSubmitting}
              className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {checkinSubmitting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                  Đang gửi...
                </>
              ) : (
                "Xác nhận Check-in"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditLocationDialog} onOpenChange={setShowEditLocationDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Cập nhật vị trí khách hàng
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              Chọn cách cập nhật tọa độ phù hợp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-md transition-colors ${editLocationMethod === "gps" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setEditLocationMethod("gps")}
              >
                GPS Hiện tại
              </button>
              <button 
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-md transition-colors ${editLocationMethod === "url" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setEditLocationMethod("url")}
              >
                Link Google Maps
              </button>
              <button 
                className={`flex-1 text-[11px] font-bold py-1.5 rounded-md transition-colors ${editLocationMethod === "manual" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setEditLocationMethod("manual")}
              >
                Nhập tay
              </button>
            </div>

            {editLocationMethod === "gps" && (
              <div className="space-y-3">
                <Button onClick={handleGetGpsForEdit} variant="outline" className="w-full text-xs font-bold border-dashed border-slate-300">
                  <MapPin className="w-3.5 h-3.5 mr-2 text-primary" />
                  Lấy toạ độ GPS hiện tại
                </Button>
                
                {editLocationForm.latitude && editLocationForm.longitude && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Vĩ độ (Lat):</span>
                      <span className="font-bold">{editLocationForm.latitude}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Kinh độ (Lng):</span>
                      <span className="font-bold">{editLocationForm.longitude}</span>
                    </div>
                    {editLocationForm.accuracy && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Độ chính xác:</span>
                        <span className={`font-bold ${editLocationForm.accuracy > 200 ? 'text-red-500' : 'text-emerald-500'}`}>
                          +/- {Math.round(editLocationForm.accuracy)}m
                        </span>
                      </div>
                    )}
                    
                    {editLocationForm.accuracy && editLocationForm.accuracy > 200 && (
                      <div className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded flex items-start gap-1.5 mt-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        Vị trí có độ chính xác thấp, không nên dùng để ghim khách.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {editLocationMethod === "url" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Link Google Maps hoặc Toạ độ text</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="VD: https://goo.gl/maps/... hoặc 10.123, 106.456" 
                      value={editLocationForm.url}
                      onChange={(e) => setEditLocationForm({...editLocationForm, url: e.target.value})}
                      className="text-xs bg-white"
                    />
                    <Button onClick={handlePreviewUrl} variant="secondary" className="text-xs shrink-0 font-bold px-3">
                      Kiểm tra
                    </Button>
                  </div>
                </div>
                
                {editLocationForm.latitude && editLocationForm.longitude && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-between">
                    <div className="text-xs font-medium text-emerald-800">
                      Lat: {editLocationForm.latitude}<br/>
                      Lng: {editLocationForm.longitude}
                    </div>
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                )}
              </div>
            )}

            {editLocationMethod === "manual" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Vĩ độ (Latitude)</Label>
                  <Input 
                    placeholder="VD: 10.762622" 
                    value={editLocationForm.latitude}
                    onChange={(e) => setEditLocationForm({...editLocationForm, latitude: e.target.value})}
                    className="text-xs bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kinh độ (Longitude)</Label>
                  <Input 
                    placeholder="VD: 106.660172" 
                    value={editLocationForm.longitude}
                    onChange={(e) => setEditLocationForm({...editLocationForm, longitude: e.target.value})}
                    className="text-xs bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-3 sm:space-x-0">
            <Button variant="outline" onClick={() => setShowEditLocationDialog(false)} className="w-full text-xs font-bold">
              Hủy
            </Button>
            <Button onClick={handleSaveLocation} disabled={editLocationSubmitting || !editLocationForm.latitude || !editLocationForm.longitude} className="w-full text-xs font-bold">
              {editLocationSubmitting && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Lưu vị trí
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Staff Dialog */}
      {showAssignDialog && (
        <AssignStaffDialog
          isOpen={showAssignDialog}
          onClose={() => setShowAssignDialog(false)}
          customer={customer}
          onSuccess={() => {
            fetchCustomerDetails();
            window.dispatchEvent(new Event('refresh_customers_list'));
          }}
        />
      )}
    </Sheet>
  );
};

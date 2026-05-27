import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus, Loader2, Phone, UserCircle, Building2, Map,
  Zap, Link as LinkIcon, ExternalLink,
  ChevronsUpDown, Check, Info, BadgeAlert,
  ClipboardPaste, Wand2, CheckCircle2, XCircle, AlertCircle, X
} from "lucide-react";
import { normalizePhone } from "@/lib/phone";
import { VIETNAM_PROVINCES, stripAccents, findProvinceByName } from "@/lib/vietnamProvinces";
import { createLeadAssignedAutomation } from "@/lib/automation";
import { Badge } from "@/components/ui/badge";
import { checkPhoneNumberDuplicate } from "@/lib/customerPhone";
import { createContactChannel } from "@/lib/contactChannels";

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddCustomerDialog({ open, onOpenChange, onSuccess }: AddCustomerDialogProps) {
  const { user, isSale, isTeleLead, isAdmin, isSubAdmin } = useAuth();
  const [saving, setSaving] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);

  const [form, setForm] = useState({
    facility_name: "",
    name: "",
    phone: "",
    city: "",
    source: "FACEBOOK",
    note: "",
    primary_channel_type: "facebook",
    primary_channel_value: "",
  });

  // --- QUICK PASTE STATES ---
  const [showPaste, setShowPaste] = useState(false);
  const [pasteMode, setPasteMode] = useState<"auto" | "pipeline">("auto");
  const [pasteText, setPasteText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  const [previewDuplicateInfo, setPreviewDuplicateInfo] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setForm({
        facility_name: "",
        name: "",
        phone: "",
        city: "",
        source: "FACEBOOK",
        note: "",
        primary_channel_type: "facebook",
        primary_channel_value: "",
      });
      setDuplicateInfo(null);
      setIsCheckingPhone(false);
      setShowPaste(false);
      setPasteText("");
      setParsedPreview(null);
      setPreviewDuplicateInfo(null);
    }
  }, [open]);

  const handleOpenCustomer = (id: string) => {
    // Tắt modal và emit sự kiện mở drawer
    onOpenChange(false);
    window.dispatchEvent(new CustomEvent('open-customer-preview', { detail: { customerId: id } }));
  };

  const checkPhoneDuplicate = async (phoneStr: string, isPreview = false) => {
    const normPhone = normalizePhone(phoneStr);
    if (!normPhone || normPhone.length < 9) {
      if (isPreview) setPreviewDuplicateInfo(null);
      else setDuplicateInfo(null);
      return false;
    }
    
    setIsCheckingPhone(true);
    try {
      const { data: existing, error: checkErr } = await supabase
        .from("customers")
        .select("id, name, facility_name, owner_sale_id, owner_tele_id, lifecycle_stage")
        .eq("normalized_phone", normPhone)
        .is("deleted_at", null)
        .limit(1);

      if (checkErr) throw checkErr;

      if (existing && existing.length > 0) {
        const c = existing[0];
        let ownerName = "Chưa phân bổ";
        const ownerId = c.owner_sale_id || c.owner_tele_id;
        
        if (ownerId) {
          const { data: p } = await supabase.from("profiles").select("display_name, email").eq("id", ownerId).single();
          if (p) ownerName = p.display_name || p.email || ownerName;
        }

        if (isPreview) setPreviewDuplicateInfo({ ...c, ownerName });
        else setDuplicateInfo({ ...c, ownerName });
        return true;
      }
      if (isPreview) setPreviewDuplicateInfo(null);
      else setDuplicateInfo(null);
      return false;
    } catch (err) {
      console.error("Duplicate check error:", err);
      return false;
    } finally {
      setIsCheckingPhone(false);
    }
  };

  // --- PASTE LOGIC ---
  const parseLeadPipeline = (text: string) => {
    const parts = text.split('|').map(s => s.trim());
    const phone = parts[0] || '';
    const facility_name = parts[1] || '';
    const contact_name = parts[2] || '';
    const city = parts[3] || '';
    const channel_value = parts[4] || '';
    const note = parts[5] || '';
    
    let channel_type = 'facebook';
    const valLower = channel_value.toLowerCase();
    if (valLower.includes('zalo') || /^[0-9]+$/.test(valLower)) channel_type = 'zalo';
    else if (valLower.includes('tiktok')) channel_type = 'tiktok';
    else if (valLower.includes('@')) channel_type = 'email';
    else if (valLower.includes('http') && !valLower.includes('fb') && !valLower.includes('facebook') && !valLower.includes('tiktok')) channel_type = 'website';

    const confidence = (phone.length >= 9 && (facility_name || contact_name)) ? 'high' : 'low';

    return { phone, facility_name, name: contact_name, city, primary_channel_type: channel_type, primary_channel_value: channel_value, note, confidence };
  };

  const parseLeadAuto = (text: string) => {
    let t = text;
    let phone = '';
    let email = '';
    let channel_value = '';
    let channel_type = 'facebook';
    let city = '';
    
    // phone
    const phoneRegex = /(0|84|\+84)[3|5|7|8|9][0-9]{8}\b/g;
    const phones = t.match(phoneRegex);
    if (phones && phones.length > 0) {
      phone = phones[0];
      t = t.replace(phone, '').trim();
    }

    // email
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const emails = t.match(emailRegex);
    if (emails && emails.length > 0) {
      email = emails[0];
      t = t.replace(email, '').trim();
      if (!channel_value) {
        channel_value = email;
        channel_type = 'email';
      }
    }

    // urls
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/[^\s]*)/gi;
    const urls = t.match(urlRegex);
    if (urls && urls.length > 0) {
      const u = urls[0];
      t = t.replace(u, '').trim();
      if (!channel_value) {
        channel_value = u;
        const uLow = u.toLowerCase();
        if (uLow.includes('zalo')) channel_type = 'zalo';
        else if (uLow.includes('tiktok')) channel_type = 'tiktok';
        else if (uLow.includes('fb') || uLow.includes('facebook')) channel_type = 'facebook';
        else channel_type = 'website';
      }
    }

    // city
    const tLow = stripAccents(t.toLowerCase());
    for (const p of VIETNAM_PROVINCES) {
      const pLow = stripAccents(p.toLowerCase());
      const alias = stripAccents((findProvinceByName(pLow) || '').toLowerCase());
      if (tLow.includes(pLow)) {
        city = p;
        t = t.replace(new RegExp(pLow, 'i'), '').replace(new RegExp(p, 'i'), '').trim();
        break;
      }
      if (alias && tLow.includes(alias)) {
        city = p;
        t = t.replace(new RegExp(alias, 'i'), '').trim();
        break;
      }
    }

    // remaining chunks
    const chunks = t.split(/[\n|]+/).map(s => s.trim()).filter(s => s.length > 0);
    let facility_name = '';
    let contact_name = '';
    let note = '';

    if (chunks.length > 0) facility_name = chunks[0];
    if (chunks.length > 1) contact_name = chunks[1];
    if (chunks.length > 2) note = chunks.slice(2).join(', ');

    const confidence = (phone.length >= 9 && (facility_name || contact_name)) ? 'high' : 'low';

    return { phone, facility_name, name: contact_name, city, primary_channel_type: channel_type, primary_channel_value: channel_value, note, confidence };
  };

  const handleParse = async () => {
    if (!pasteText.trim()) return;
    setPreviewDuplicateInfo(null);
    const res = pasteMode === 'auto' ? parseLeadAuto(pasteText) : parseLeadPipeline(pasteText);
    setParsedPreview(res);
    if (res.phone) {
      await checkPhoneDuplicate(res.phone, true);
    }
  };

  const handleApplyPreview = () => {
    if (previewDuplicateInfo) {
      toast.error("Không thể áp dụng vì Số điện thoại đã tồn tại!");
      return;
    }
    if (!parsedPreview.phone) {
      toast.error("Không tìm thấy Số điện thoại, vui lòng kiểm tra lại text đã dán.");
      return;
    }
    
    setForm(prev => ({
      ...prev,
      phone: parsedPreview.phone || prev.phone,
      facility_name: parsedPreview.facility_name || prev.facility_name,
      name: parsedPreview.name || prev.name,
      city: parsedPreview.city || prev.city,
      primary_channel_type: parsedPreview.primary_channel_type || prev.primary_channel_type,
      primary_channel_value: parsedPreview.primary_channel_value || prev.primary_channel_value,
      note: parsedPreview.note ? (prev.note ? prev.note + '\n' + parsedPreview.note : parsedPreview.note) : prev.note,
    }));
    
    setDuplicateInfo(null); // It will be checked again onBlur or Save
    setShowPaste(false);
    setPasteText("");
    setParsedPreview(null);
    toast.success("Đã điền thông tin vào form!");
  };


  const handleSave = async () => {
    if (!form.phone.trim()) {
      toast.error("Vui lòng nhập số điện thoại (Bắt buộc)");
      return;
    }

    if (!form.facility_name.trim() && !form.name.trim()) {
      toast.error("Vui lòng nhập Tên cơ sở hoặc Tên liên hệ");
      return;
    }

    setSaving(true);
    setDuplicateInfo(null);

    const normPhone = normalizePhone(form.phone);
    if (!normPhone) {
      toast.error("Số điện thoại không hợp lệ.");
      setSaving(false);
      return;
    }

    try {
      // 1. Double check duplicate just in case
      const isDup = await checkPhoneDuplicate(form.phone, false);
      if (isDup) {
        toast.error("Số điện thoại này đã tồn tại trong hệ thống.");
        setSaving(false);
        return;
      }

      // 2. Prepare payload
      let defaultOwnerSaleId = null;
      let defaultOwnerTeleId = null;
      if (isSale) defaultOwnerSaleId = user?.id;
      if (isTeleLead) defaultOwnerTeleId = user?.id;

      const payload: any = {
        facility_name: form.facility_name.trim(),
        name: form.name.trim(),
        contact_name: form.name.trim(),
        business_name: form.facility_name.trim(),
        phone: form.phone.trim(),
        normalized_phone: normPhone,
        city: form.city,
        source: form.source,
        note: form.note.trim(),
        owner_sale_id: defaultOwnerSaleId,
        owner_tele_id: defaultOwnerTeleId,
        created_by: user?.id,
        status: "new",
        lifecycle_stage: "new_lead",
      };

      // 3. Create customer
      const { data: newCustomer, error: insertErr } = await supabase
        .from("customers")
        .insert([payload])
        .select()
        .single();

      if (insertErr) {
        // Fallback for race conditions
        if (insertErr.code === "23505") {
          toast.error("Số điện thoại này đã tồn tại trên hệ thống. Vui lòng thử lại!");
        } else {
          toast.error("Lỗi khi tạo KH: " + insertErr.message);
        }
        setSaving(false);
        return;
      }

      // 3b. Log lead_created activity (fire-and-forget — never blocks main flow)
      supabase.from('customer_activities').insert({
        customer_id: newCustomer.id,
        type: 'lead_created',
        activity_type: 'lead_created',
        title: 'Lead được tạo',
        content: `Lead tạo bởi ${user?.email || 'hệ thống'} (${isSale ? 'Sale' : isTeleLead ? 'Tele' : 'Admin/Ops'}). Nguồn: ${form.source}. ${!newCustomer.owner_sale_id && !newCustomer.owner_tele_id ? 'Chưa phân tuyến — đang chờ trong Incoming Queue.' : 'Đã gán cho nhân viên.'}`,
        created_by: user?.id,
      }).then(({ error: actErr }: { error: any }) => {
        if (actErr) console.warn('[AddCustomerDialog] lead_created activity insert failed:', actErr.message);
      });

      // Trigger automation manually since we removed standard form owner inputs 
      // but we still have default assigns for Sale/Tele
      if (newCustomer.owner_sale_id) {
         await createLeadAssignedAutomation(
           newCustomer.id, 
           newCustomer.facility_name || newCustomer.name, 
           newCustomer.owner_sale_id, 
           user?.email || "Hệ thống",
           user?.id || ""
         );
      } else if (newCustomer.owner_tele_id) {
         await createLeadAssignedAutomation(
           newCustomer.id, 
           newCustomer.facility_name || newCustomer.name, 
           newCustomer.owner_tele_id, 
           user?.email || "Hệ thống",
           user?.id || ""
         );
      }

      // 4. Handle Primary Channel
      const scope = (isAdmin || isSubAdmin) ? "official" : "private";
      
      // Create Phone Channel (always created)
      try {
        await createContactChannel({
          customerId: newCustomer.id,
          channelType: 'phone',
          value: form.phone.trim(),
          scope,
          is_primary: form.primary_channel_type === 'phone',
          channel_purpose: 'sales',
          user
        });
      } catch (phoneErr: any) {
        toast.warning("Khách đã tạo, nhưng không lưu được kênh SĐT: " + phoneErr.message);
      }

      if (form.primary_channel_type !== "phone" && form.primary_channel_value.trim()) {
        // Create selected primary channel
        try {
          const { error: resErr } = await createContactChannel({
              customerId: newCustomer.id,
              channelType: form.primary_channel_type,
              value: form.primary_channel_value.trim(),
              scope,
              is_primary: true,
              channel_purpose: "sales",
              user
          });
          if (resErr) throw resErr;
          toast.success("Thêm khách hàng thành công!");
        } catch (err: any) {
          toast.warning("Khách đã tạo, nhưng kênh liên hệ chính chưa lưu được: " + err.message);
        }
      } else {
        toast.success("Thêm khách hàng thành công!");
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();

    } catch (err: any) {
      toast.error("Lỗi hệ thống: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden rounded-[28px] border-none shadow-2xl">
        <DialogHeader className="px-8 pt-8 pb-6 bg-slate-900 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 backdrop-blur-md">
                <Zap className="w-6 h-6 text-indigo-400 fill-indigo-400/20" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight">Thêm Khách Nhanh</DialogTitle>
                <p className="text-slate-400 text-xs font-bold mt-1">Tạo Lead & Khách hàng mới nhanh chóng</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPaste(!showPaste)}
              className={`rounded-xl border-slate-700 font-bold text-xs h-9 px-4 transition-all ${showPaste ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700' : 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800'}`}
            >
              <ClipboardPaste className="w-4 h-4 mr-2" />
              {showPaste ? 'Đóng Dán Nhanh' : 'Dán Nhanh Lead'}
            </Button>
          </div>
        </DialogHeader>

        <div className="p-8 bg-slate-50 overflow-y-auto max-h-[60vh]">

          {/* QUICK PASTE SECTION */}
          {showPaste && (
            <div className="mb-8 p-5 bg-white border border-indigo-100 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-extrabold text-indigo-800 uppercase tracking-widest flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-indigo-500" />
                  Dán chuỗi văn bản
                </Label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${pasteMode === 'auto' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setPasteMode('auto')}
                  >
                    Tự Động Nhận Diện
                  </button>
                  <button
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${pasteMode === 'pipeline' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setPasteMode('pipeline')}
                  >
                    Theo Mẫu ( | )
                  </button>
                </div>
              </div>
              <Textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={pasteMode === 'auto' ? "Nhập bất kỳ đoạn chat, thông tin khách hàng nào. VD: Khách Lan Anh 0912345678 HN quan tâm giảm béo..." : "SĐT | Tên Spa | Người liên hệ | Tỉnh/TP | Kênh liên hệ | Ghi chú"}
                className="text-sm min-h-[80px] rounded-xl border-slate-200 focus:ring-indigo-200 focus:border-indigo-400 mb-3 bg-slate-50"
              />
              <div className="flex gap-2 justify-end">
                {pasteText && (
                  <Button variant="ghost" size="sm" onClick={() => { setPasteText(""); setParsedPreview(null); setPreviewDuplicateInfo(null); }} className="text-slate-500 hover:text-rose-600 rounded-xl">
                    Xóa
                  </Button>
                )}
                <Button size="sm" onClick={handleParse} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-xl font-bold px-5">
                  Phân tích
                </Button>
              </div>

              {parsedPreview && (
                <div className="mt-5 border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                  <div className="bg-slate-200/50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preview Phân Tích</span>
                    {parsedPreview.confidence === 'high' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-[10px] border-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Độ tin cậy cao</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 text-[10px] border-none"><AlertCircle className="w-3 h-3 mr-1" /> Cần kiểm tra lại</Badge>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-slate-400 text-xs">SĐT:</span> <span className="font-mono font-bold">{parsedPreview.phone || <span className="text-rose-400 italic">Trống</span>}</span></div>
                      <div><span className="text-slate-400 text-xs">Spa:</span> <span className="font-bold">{parsedPreview.facility_name || '-'}</span></div>
                      <div><span className="text-slate-400 text-xs">Liên hệ:</span> <span>{parsedPreview.name || '-'}</span></div>
                      <div><span className="text-slate-400 text-xs">Khu vực:</span> <span>{parsedPreview.city || '-'}</span></div>
                      <div className="col-span-2"><span className="text-slate-400 text-xs">Kênh:</span> <Badge variant="outline" className="ml-1 uppercase text-[10px]">{parsedPreview.primary_channel_type}</Badge> <span className="text-slate-600 ml-1">{parsedPreview.primary_channel_value}</span></div>
                      <div className="col-span-2"><span className="text-slate-400 text-xs">Ghi chú:</span> <span className="text-slate-600 italic">{parsedPreview.note || '-'}</span></div>
                    </div>

                    {previewDuplicateInfo && (
                      <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-sm">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                          <div>
                            <h4 className="text-xs font-bold text-rose-800">Số điện thoại này đã tồn tại!</h4>
                            <p className="text-[10px] text-rose-600 mt-0.5">Thuộc về khách hàng <b>{previewDuplicateInfo.facility_name || previewDuplicateInfo.name}</b> (Phụ trách: {previewDuplicateInfo.ownerName})</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="bg-white p-3 border-t border-slate-100 flex justify-end">
                    <Button 
                      size="sm" 
                      onClick={handleApplyPreview} 
                      disabled={!!previewDuplicateInfo}
                      className="rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 shadow-md text-white px-6"
                    >
                      ÁP DỤNG VÀO FORM DƯỚI
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {duplicateInfo && (
            <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-top-4">
              <div className="flex items-start gap-3">
                <BadgeAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-rose-800">Số điện thoại này đã tồn tại!</h4>
                  <p className="text-xs text-rose-600 mt-1">
                    Hệ thống chặn việc tạo trùng lặp. Dưới đây là thông tin khách hàng đang sở hữu số điện thoại này:
                  </p>
                  <div className="mt-3 bg-white p-3 rounded-xl border border-rose-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Khách hàng:</span>
                      <span className="text-xs font-bold text-slate-800">{duplicateInfo.facility_name || duplicateInfo.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Phụ trách:</span>
                      <Badge variant="outline" className="text-[10px] font-bold border-indigo-200 text-indigo-700 bg-indigo-50">
                        👤 {duplicateInfo.ownerName}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Trạng thái:</span>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {duplicateInfo.lifecycle_stage}
                      </Badge>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full mt-4 h-9 text-xs font-bold border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                    onClick={() => handleOpenCustomer(duplicateInfo.id)}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    MỞ HỒ SƠ KHÁCH HÀNG NÀY
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-5">
              
              {/* SĐT - Bắt buộc đầu tiên */}
              <div className="space-y-2 col-span-2">
                <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                  <Phone className="w-3.5 h-3.5 text-indigo-500" /> Số điện thoại <span className="text-rose-500 text-sm">*</span>
                  {isCheckingPhone && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin ml-1" />}
                </Label>
                <Input
                  value={form.phone}
                  onChange={(e) => {
                    setForm({ ...form, phone: e.target.value });
                    if (duplicateInfo) setDuplicateInfo(null);
                  }}
                  onBlur={() => checkPhoneDuplicate(form.phone, false)}
                  placeholder="Nhập SĐT..."
                  className={`text-sm h-11 rounded-2xl bg-white shadow-sm font-mono transition-all placeholder:text-slate-300
                    ${duplicateInfo ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-200/60 focus:ring-primary/20 focus:border-primary'}`}
                />
              </div>

              {/* Tên KH */}
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                  <Building2 className="w-3.5 h-3.5 text-primary/70" /> Tên cơ sở (Spa/Clinic)
                </Label>
                <Input
                  value={form.facility_name}
                  onChange={(e) => setForm({ ...form, facility_name: e.target.value })}
                  placeholder="VD: Desembre Spa..."
                  className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                />
              </div>
              
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                  <UserCircle className="w-3.5 h-3.5 text-primary/70" /> Người liên hệ
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Chị Lan Anh"
                  className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
                />
              </div>
              
              {/* Tỉnh thành phố */}
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                  <Map className="w-3.5 h-3.5 text-primary/70" /> Tỉnh / Thành phố
                </Label>
                <Popover open={cityOpen} onOpenChange={(o) => { setCityOpen(o); if (!o) setCitySearch(""); }}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      aria-expanded={cityOpen}
                      className="w-full text-sm h-11 rounded-2xl border border-slate-200/60 bg-white shadow-sm px-3 flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                      <span className={form.city ? "text-slate-800 font-medium" : "text-slate-400"}>
                        {form.city || "Chọn khu vực..."}
                      </span>
                      <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 rounded-2xl shadow-xl border border-slate-100" style={{ width: "var(--radix-popover-trigger-width)" }}>
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/80">
                      <Map className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                      <input
                        autoFocus
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        placeholder="Gõ để tìm kiếm..."
                        className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-300 text-slate-800"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {(() => {
                        const q = stripAccents(citySearch);
                        const matched = VIETNAM_PROVINCES.filter((p) => {
                          if (!q) return true;
                          const alias = findProvinceByName(citySearch);
                          if (alias === p) return true;
                          return stripAccents(p).includes(q);
                        });
                        if (matched.length === 0) return <div className="py-4 text-center text-xs text-slate-400">Không tìm thấy</div>;
                        return matched.map((province) => (
                          <button
                            key={province}
                            type="button"
                            onClick={() => {
                              setForm({ ...form, city: province });
                              setCitySearch("");
                              setCityOpen(false);
                            }}
                            className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                          >
                            <Check className={`w-3.5 h-3.5 shrink-0 ${form.city === province ? "opacity-100 text-indigo-600" : "opacity-0"}`} />
                            <span className={`font-medium ${form.city === province ? "text-indigo-700" : "text-slate-700"}`}>{province}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Nguồn lead */}
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                  <LinkIcon className="w-3.5 h-3.5 text-primary/70" /> Nguồn Lead
                </Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger className="text-sm h-11 rounded-2xl border-slate-200/60 bg-white shadow-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                    <SelectItem value="FACEBOOK">Facebook</SelectItem>
                    <SelectItem value="ZALO">Zalo</SelectItem>
                    <SelectItem value="TIKTOK">TikTok</SelectItem>
                    <SelectItem value="HOTLINE">Hotline/Gọi</SelectItem>
                    <SelectItem value="REFERRAL">Giới thiệu</SelectItem>
                    <SelectItem value="WEBSITE">Website</SelectItem>
                    <SelectItem value="OTHER">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Kênh liên hệ chính */}
              <div className="col-span-2 bg-white rounded-2xl border border-indigo-100 p-4 shadow-sm relative overflow-hidden mt-2">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400"></div>
                <Label className="text-[11px] font-extrabold text-indigo-800 uppercase tracking-widest flex items-center gap-2 mb-3 ml-2">
                  Kênh liên hệ chính 
                  <Info className="w-3.5 h-3.5 text-indigo-400" />
                </Label>
                
                <div className="flex flex-col sm:flex-row gap-3 ml-2">
                  <Select value={form.primary_channel_type} onValueChange={(v) => setForm({ ...form, primary_channel_type: v, primary_channel_value: "" })}>
                    <SelectTrigger className="w-full sm:w-[140px] text-sm h-11 rounded-xl bg-slate-50 border-slate-200 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">📞 Gọi/SMS</SelectItem>
                      <SelectItem value="zalo">💬 Zalo</SelectItem>
                      <SelectItem value="facebook">📘 Facebook</SelectItem>
                      <SelectItem value="email">📧 Email</SelectItem>
                      <SelectItem value="tiktok">🎵 TikTok</SelectItem>
                      <SelectItem value="website">🌐 Website</SelectItem>
                    </SelectContent>
                  </Select>

                  {form.primary_channel_type === "phone" ? (
                    <div className="flex-1 h-11 px-3 flex items-center bg-slate-50 rounded-xl border border-slate-200 border-dashed text-sm text-slate-500 font-medium">
                      Tự động dùng SĐT ở trên
                    </div>
                  ) : (
                    <Input
                      value={form.primary_channel_value}
                      onChange={(e) => setForm({ ...form, primary_channel_value: e.target.value })}
                      placeholder={`Nhập ${form.primary_channel_type} (Link / ID)...`}
                      className="flex-1 text-sm h-11 rounded-xl bg-white border-slate-200 shadow-sm"
                    />
                  )}
                </div>
              </div>

              {/* Ghi chú */}
              <div className="space-y-2 col-span-2 mt-2">
                <Label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest px-1">
                  Nhu cầu / Ghi chú nhanh
                </Label>
                <Textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Khách quan tâm đến sản phẩm gì? Tình trạng ra sao?"
                  className="text-sm min-h-[80px] rounded-2xl border-slate-200/60 bg-white shadow-sm focus:ring-primary/20 focus:border-primary transition-all resize-none p-3"
                />
              </div>

            </div>
          </div>
        </div>

        <DialogFooter className="px-8 py-5 bg-white border-t border-slate-100 flex items-center justify-end gap-3 rounded-b-[28px]">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            disabled={saving} 
            className="text-xs h-10 px-6 rounded-xl font-bold text-slate-500"
          >
            Hủy bỏ
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || duplicateInfo !== null} 
            className="text-xs h-10 px-8 rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            TẠO KHÁCH NHANH
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

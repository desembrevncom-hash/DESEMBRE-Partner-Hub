import { useState, useMemo } from "react";
import {
  Send,
  Copy,
  MessageCircle,
  Mail,
  FileText,
  Search,
  CheckCircle2,
  Sparkles,
  Zap,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Template {
  id: string;
  title: string;
  category: string;
  content: string;
  type: "sms" | "email" | "zalo";
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "welcome",
    title: "Chào mừng Lead mới",
    category: "Giai đoạn: Mới",
    type: "zalo",
    content:
      "Chào {{customer_name}} từ {{facility_name}}, em là {{sale_name}} từ Desembre Việt Nam. Rất vui được kết nối với anh/chị để hỗ trợ về các dòng dược mỹ phẩm cao cấp cho Spa mình. Em xin phép gửi Profile công ty để anh/chị tham khảo trước nhé!",
  },
  {
    id: "quote-followup",
    title: "Theo dõi Báo giá",
    category: "Giai đoạn: Báo giá",
    type: "zalo",
    content:
      "Dạ anh/chị {{customer_name}} ơi, không biết anh/chị đã xem qua bản báo giá các bộ sản phẩm Nám/Mụn em gửi hôm qua chưa ạ? Nếu có chỗ nào cần điều chỉnh chiết khấu hoặc số lượng cho {{facility_name}}, anh/chị cứ bảo em nhé!",
  },
  {
    id: "post-purchase",
    title: "Check-in sau mua (7 ngày)",
    category: "Giai đoạn: Chăm sóc",
    type: "zalo",
    content:
      "Chào anh/chị {{customer_name}}, bộ sản phẩm Spa mình nhập tuần trước dùng khách phản hồi thế nào rồi ạ? Em gửi thêm quy trình kỹ thuật chuẩn của hãng để kỹ thuật viên nhà mình tham khảo thêm nhé. Cần hỗ trợ gì cứ nhắn em ạ!",
  },
  {
    id: "promotion",
    title: "Chương trình Ưu đãi VIP",
    category: "Khách thân thiết",
    type: "zalo",
    content:
      "Tin vui cho {{facility_name}} đây ạ! Desembre đang có chương trình tri ân dành riêng cho các chủ Spa thân thiết. Khi nhập đơn hàng trong tháng này, anh/chị sẽ được tặng thêm bộ kit Demo trị giá 2.5tr. Số lượng có hạn nên em nhắn anh/chị ưu tiên trước ạ!",
  },
];

interface TemplateDispatcherProps {
  customer: any;
  isOpen: boolean;
  onClose: () => void;
}

export function TemplateDispatcher({ customer, isOpen, onClose }: TemplateDispatcherProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saleName] = useState("Thái"); // Mock sale name, should come from auth

  const filteredTemplates = useMemo(() => {
    return DEFAULT_TEMPLATES.filter(
      (t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase()),
    );
  }, [search]);

  const selectedTemplate = useMemo(() => {
    return DEFAULT_TEMPLATES.find((t) => t.id === selectedId);
  }, [selectedId]);

  const processedContent = useMemo(() => {
    if (!selectedTemplate) return "";
    return selectedTemplate.content
      .replace(/{{customer_name}}/g, customer?.name || "Anh/Chị")
      .replace(/{{facility_name}}/g, customer?.facility_name || "Spa mình")
      .replace(/{{sale_name}}/g, saleName);
  }, [selectedTemplate, customer, saleName]);

  const handleCopy = () => {
    navigator.clipboard.writeText(processedContent);
    toast.success("Đã sao chép nội dung tin nhắn");
  };

  const handleSendZalo = () => {
    toast.error("Tính năng Gửi ZNS qua API bị khóa trong bản M4.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] rounded-[40px] border-none shadow-2xl p-0 overflow-hidden bg-white">
        <div className="grid grid-cols-1 md:grid-cols-5 h-[600px]">
          {/* LEFT: TEMPLATE LIST */}
          <div className="md:col-span-2 bg-slate-50/50 border-r border-slate-100 flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-white">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">
                Thư viện Mẫu
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Tìm mẫu tin nhắn..."
                  className="pl-9 h-10 rounded-xl border-slate-100 bg-slate-50 text-[11px] font-bold"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
              {filteredTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left p-4 rounded-2xl transition-all border ${
                    selectedId === t.id
                      ? "bg-white border-slate-900 shadow-lg shadow-slate-100"
                      : "border-transparent hover:bg-white hover:border-slate-100"
                  }`}
                >
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-wider mb-1">
                    {t.category}
                  </p>
                  <p className="text-[11px] font-black text-slate-900 leading-tight">{t.title}</p>
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: PREVIEW & ACTIONS */}
          <div className="md:col-span-3 flex flex-col bg-white">
            <DialogHeader className="p-8 border-b border-slate-50">
              <DialogTitle className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> Xem trước tin nhắn
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 p-8">
              {selectedId ? (
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 relative group">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Badge className="bg-white text-slate-400 border-slate-100 text-[8px] font-black">
                        PREVIEW MODE
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {processedContent}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                    <Zap className="w-3 h-3 text-amber-500" /> Các biến tự động:
                    <Badge variant="outline" className="text-[9px] border-slate-200">
                      Tên khách
                    </Badge>
                    <Badge variant="outline" className="text-[9px] border-slate-200">
                      Tên Spa
                    </Badge>
                    <Badge variant="outline" className="text-[9px] border-slate-200">
                      Tên Sale
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                  <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-100">
                    <FileText className="w-10 h-10" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Chọn một mẫu để bắt đầu
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="p-8 bg-slate-50/50 border-t border-slate-100 gap-3">
              <Button
                variant="ghost"
                onClick={handleCopy}
                disabled={!selectedId}
                className="rounded-xl font-black text-[10px] text-slate-500 h-12 uppercase tracking-widest"
              >
                <Copy className="w-4 h-4 mr-2" /> Sao chép
              </Button>
              <Button
                onClick={handleSendZalo}
                disabled={!selectedId}
                className="rounded-xl bg-slate-900 hover:bg-black font-black text-[10px] text-white h-12 flex-1 shadow-xl shadow-slate-200 uppercase tracking-widest"
              >
                Gửi qua Zalo <MessageCircle className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

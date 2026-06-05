import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Save, Plus, AlertTriangle } from "lucide-react";
import { DocumentTemplatePreview } from "./DocumentTemplatePreview";
import { useAuth } from "@/hooks/useAuth";

type TemplateType = "quotation" | "product_sales_sheet" | "product_catalog_a4" | "customer_consultation_sheet";

interface DocumentTemplate {
  id: string;
  template_type: TemplateType;
  name: string;
  description: string | null;
  html_template: string | null;
  status: string;
}

export const DocumentTemplateManager: React.FC = () => {
  const { roles } = useAuth();
  const isAdmin = roles.some(r => ["admin", "sub_admin"].includes(r));
  
  const [activeTab, setActiveTab] = useState<TemplateType>("quotation");
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("document_templates")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (error) {
      toast.error("Lỗi khi tải danh sách mẫu tài liệu");
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreateNew = () => {
    const newTemplate: DocumentTemplate = {
      id: "new",
      template_type: activeTab,
      name: "Mẫu mới chưa lưu",
      description: "",
      html_template: "<h1>{{company.name}}</h1>\n<p>Xin chào {{customer.name}}</p>",
      status: "draft"
    };
    setEditingTemplate(newTemplate);
  };

  const handleSave = async () => {
    if (!editingTemplate || !isAdmin) return;
    setSaving(true);
    
    try {
      const payload = {
        template_type: editingTemplate.template_type,
        name: editingTemplate.name,
        description: editingTemplate.description,
        html_template: editingTemplate.html_template,
        status: editingTemplate.status,
      };

      if (editingTemplate.id === "new") {
        const { error } = await supabase.from("document_templates").insert(payload);
        if (error) throw error;
        toast.success("Đã tạo mẫu thành công");
      } else {
        const { error } = await supabase.from("document_templates").update(payload).eq("id", editingTemplate.id);
        if (error) throw error;
        toast.success("Đã cập nhật mẫu thành công");
      }
      
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error("Lỗi khi lưu: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter(t => t.template_type === activeTab);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
        {[
          { id: "quotation", label: "Báo giá" },
          { id: "product_sales_sheet", label: "Product Sales Sheet" },
          { id: "product_catalog_a4", label: "Catalog A4" },
          { id: "customer_consultation_sheet", label: "Phiếu tư vấn" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as TemplateType);
              setEditingTemplate(null);
            }}
            className={`px-6 py-4 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id 
                ? "border-blue-600 text-blue-700 bg-white" 
                : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: List or Edit Form */}
        <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white overflow-y-auto relative">
          {editingTemplate ? (
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg text-slate-800">
                  {editingTemplate.id === "new" ? "Tạo mẫu mới" : "Chỉnh sửa mẫu"}
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditingTemplate(null)}
                    className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Hủy
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? "Đang lưu..." : "Lưu mẫu"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Tên mẫu</label>
                <input 
                  type="text" 
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Trạng thái</label>
                <select 
                  value={editingTemplate.status}
                  onChange={(e) => setEditingTemplate({...editingTemplate, status: e.target.value})}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="draft">Bản nháp (Draft)</option>
                  <option value="approved">Đã duyệt (Approved)</option>
                  <option value="archived">Lưu trữ (Archived)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                  <span>HTML Template</span>
                  <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded text-[10px]">
                    <AlertTriangle className="w-3 h-3" />
                    Chỉ dành cho quản trị kỹ thuật
                  </div>
                </label>
                <textarea 
                  value={editingTemplate.html_template || ""}
                  onChange={(e) => setEditingTemplate({...editingTemplate, html_template: e.target.value})}
                  disabled={!isAdmin}
                  className="w-full flex-1 min-h-[300px] px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs"
                  placeholder="<h1>{{company.name}}</h1>..."
                />
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Danh sách mẫu ({filteredTemplates.length})
                </h3>
                {isAdmin && (
                  <button 
                    onClick={handleCreateNew}
                    className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
                    title="Thêm mẫu mới"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="text-center py-8 text-slate-400">Đang tải...</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                  <p className="text-sm text-slate-500">Chưa có mẫu tài liệu nào.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredTemplates.map(t => (
                    <div 
                      key={t.id} 
                      className="flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm rounded-xl cursor-pointer transition-all"
                      onClick={() => setEditingTemplate(t)}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-800">{t.name}</span>
                        <span className="text-xs text-slate-400 mt-1">Trạng thái: <span className="font-medium">{t.status}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Preview */}
        <div className="w-1/2 bg-slate-100 relative">
          {editingTemplate ? (
            <DocumentTemplatePreview 
              htmlTemplate={editingTemplate.html_template || ""} 
              templateType={editingTemplate.template_type} 
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">
              Chọn hoặc tạo một mẫu để xem trước
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

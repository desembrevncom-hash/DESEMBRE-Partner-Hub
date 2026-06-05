import { createFileRoute } from "@tanstack/react-router";
import { DocumentTemplateManager } from "@/components/admin/templates/DocumentTemplateManager";

export const Route = createFileRoute("/admin/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 relative overflow-hidden">
      <div className="flex-none p-4 lg:p-6 pb-4">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
          Quản lý Mẫu Tài Liệu (Template Center)
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Thiết kế và quản lý các mẫu HTML để in báo giá, product sales sheet chuẩn A4.
        </p>
      </div>
      
      <div className="flex-1 p-4 lg:p-6 pt-0 overflow-hidden">
        <DocumentTemplateManager />
      </div>
    </div>
  );
}

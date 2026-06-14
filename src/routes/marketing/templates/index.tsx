import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, FileText, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/marketing/templates/")({
  component: TemplatesList,
});

function TemplatesList() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: templates, isLoading, error } = useQuery({
    queryKey: ["marketing_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredTemplates = templates?.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.channel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* HEADER SECTION */}
      <div className="bg-white border-b border-slate-100">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold mb-3">
                <FileText className="w-3.5 h-3.5" /> Content Library
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Thư viện Mẫu</h1>
              <p className="text-sm font-medium text-slate-500 mt-2 max-w-xl">
                Quản lý các mẫu tin nhắn, email và kịch bản chăm sóc khách hàng đa kênh.
              </p>
            </div>
            <Link to="/marketing/templates/new">
              <Button className="rounded-xl h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-200 transition-all hover:scale-105">
                <PlusCircle className="mr-2 h-4 w-4" />
                Tạo mẫu mới
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 mt-8 space-y-8">
        <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="p-8 pb-4 border-b border-slate-50 bg-white/50 backdrop-blur-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  Danh sách mẫu tin
                </CardTitle>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Hiển thị tất cả các mẫu tin đang có trong hệ thống
                </p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Tìm kiếm mẫu..."
                  className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-500 font-medium text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-400">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4" />
                <p className="font-medium text-sm">Đang tải dữ liệu...</p>
              </div>
            ) : error ? (
              <div className="p-16 text-center text-red-500 flex flex-col items-center bg-red-50/30">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p className="font-bold">Không thể tải dữ liệu.</p>
                <p className="text-sm opacity-80 mt-1 font-medium">
                  Lỗi: {(error as any)?.message || "Chưa rõ nguyên nhân"}
                </p>
              </div>
            ) : filteredTemplates?.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center bg-slate-50/30">
                <div className="bg-white p-5 rounded-full mb-4 shadow-sm border border-slate-100">
                  <FileText className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-1">Chưa có mẫu nào</h3>
                <p className="text-sm font-medium text-slate-500 mb-6 max-w-sm">
                  Bạn chưa tạo mẫu tin nhắn nào hoặc không tìm thấy kết quả phù hợp.
                </p>
                <Link to="/marketing/templates/new">
                  <Button variant="outline" className="rounded-xl font-bold text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700">Tạo mẫu ngay</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b-0 hover:bg-slate-50/80">
                      <TableHead className="px-8 py-5 text-left h-auto">Tên mẫu</TableHead>
                      <TableHead className="px-8 py-5 h-auto">Kênh</TableHead>
                      <TableHead className="px-8 py-5 h-auto">Trạng thái</TableHead>
                      <TableHead className="px-8 py-5 text-right h-auto">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-50 font-medium">
                    {filteredTemplates?.map((template) => (
                      <TableRow key={template.id} className="hover:bg-slate-50/50 transition-all group border-b-slate-50">
                        <TableCell className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="font-black text-[13px] text-slate-900">{template.name}</span>
                            {template.subject && (
                              <span className="text-[11px] font-semibold text-slate-400 mt-1 truncate max-w-md">
                                {template.subject}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-8 py-5">
                          <Badge variant="outline" className="bg-white border-slate-200 text-slate-600 uppercase text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md">
                            {template.channel.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-8 py-5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            template.status === "active" ? "bg-emerald-100 text-emerald-700" :
                            template.status === "draft" ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {template.status === "active" ? "Hoạt động" : template.status === "draft" ? "Bản nháp" : "Lưu trữ"}
                          </span>
                        </TableCell>
                        <TableCell className="px-8 py-5 text-right">
                          <Link to={`/marketing/templates/${template.id}`}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="rounded-xl font-bold text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                              Chi tiết
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

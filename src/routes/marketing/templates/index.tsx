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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thư viện Mẫu</h1>
          <p className="text-muted-foreground mt-1">
            Quản lý các mẫu tin nhắn, email và kịch bản chăm sóc khách hàng.
          </p>
        </div>
        <Link to="/marketing/templates/new">
          <Button className="bg-primary hover:bg-primary/90 text-white shadow-md">
            <PlusCircle className="mr-2 h-4 w-4" />
            Tạo mẫu mới
          </Button>
        </Link>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-500" />
              Danh sách mẫu tin
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Tìm kiếm mẫu..."
                className="pl-8 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center p-12 text-slate-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
              Đang tải dữ liệu...
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-500 flex flex-col items-center">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">Không thể tải dữ liệu.</p>
              <p className="text-sm opacity-80 mt-1">
                Lỗi: {(error as any)?.message || "Chưa rõ nguyên nhân"}
              </p>
            </div>
          ) : filteredTemplates?.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center">
              <div className="bg-slate-100 p-4 rounded-full mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">Chưa có mẫu nào</h3>
              <p className="text-slate-500 mb-6 max-w-sm">
                Bạn chưa tạo mẫu tin nhắn nào hoặc không tìm thấy kết quả phù hợp.
              </p>
              <Link to="/marketing/templates/new">
                <Button variant="outline">Tạo mẫu ngay</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-600">Tên mẫu</TableHead>
                    <TableHead className="font-semibold text-slate-600">Kênh</TableHead>
                    <TableHead className="font-semibold text-slate-600">Trạng thái</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates?.map((template) => (
                    <TableRow key={template.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="text-slate-900">{template.name}</span>
                          {template.subject && (
                            <span className="text-xs text-slate-500 mt-1 truncate max-w-md">
                              {template.subject}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50 uppercase text-[10px] tracking-wider">
                          {template.channel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={template.status === "active" ? "default" : template.status === "draft" ? "secondary" : "destructive"}
                          className={template.status === "active" ? "bg-emerald-500" : ""}
                        >
                          {template.status === "active" ? "Hoạt động" : template.status === "draft" ? "Bản nháp" : "Lưu trữ"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/marketing/templates/${template.id}`}>
                          <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
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
  );
}

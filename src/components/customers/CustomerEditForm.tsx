import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VIETNAM_PROVINCES } from "@/lib/vietnamProvinces";
import {
  getEditableFields,
  CustomerPermissionContext,
} from "@/lib/customers/customerPermissions";
import { updateCustomerProfile } from "@/lib/customers/updateCustomerProfile";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Customer = Database["public"]["Tables"]["customers"]["Row"];

const formSchema = z.object({
  business_name: z.string().optional(),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  district: z.string().optional(),
  note: z.string().optional(),
  status: z.string().optional(),
  lifecycle_stage: z.string().optional(),
  potential_level: z.string().optional(),
  source: z.string().optional(),
  facebook: z.string().optional(),
  zalo: z.string().optional(),
  owner_sale_id: z.string().optional(),
  owner_tele_id: z.string().optional(),
  historical_revenue_total: z.string().optional(),
  historical_order_count: z.string().optional(),
  historical_last_purchase_at: z.string().optional(),
  historical_revenue_note: z.string().optional(),
  historical_revenue_source: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CustomerEditFormProps {
  customer: Customer;
  permissionCtx: CustomerPermissionContext;
  onSaved?: (updatedCustomer: Customer) => void;
  onCancel?: () => void;
}

export function CustomerEditForm({
  customer,
  permissionCtx,
  onSaved,
  onCancel,
}: CustomerEditFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    reasonNeeded: boolean;
    phoneChanged: boolean;
    emailChanged: boolean;
    pendingValues: FormValues | null;
    reasonText: string;
  }>({
    isOpen: false,
    reasonNeeded: false,
    phoneChanged: false,
    emailChanged: false,
    pendingValues: null,
    reasonText: "",
  });

  const editableFields = getEditableFields(customer, permissionCtx);
  const canEdit = (field: string) => editableFields.includes(field);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      business_name: customer.business_name || "",
      contact_name: customer.contact_name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      city: customer.city || "",
      address: customer.address || "",
      district: customer.district || "",
      note: customer.note || "",
      status: customer.status || "",
      lifecycle_stage: customer.lifecycle_stage || "",
      potential_level: customer.potential_level || "",
      source: customer.source || "",
      facebook: customer.facebook || "",
      zalo: customer.zalo || "",
      owner_sale_id: customer.owner_sale_id || "",
      owner_tele_id: customer.owner_tele_id || "",
      historical_revenue_total: (customer as any).historical_revenue_total?.toString() || "",
      historical_order_count: (customer as any).historical_order_count?.toString() || "",
      historical_last_purchase_at: (customer as any).historical_last_purchase_at || "",
      historical_revenue_note: (customer as any).historical_revenue_note || "",
      historical_revenue_source: (customer as any).historical_revenue_source || "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    // Check if phone or email actually changed
    const phoneChanged = values.phone?.trim() !== (customer.phone || "");
    const emailChanged = values.email?.trim() !== (customer.email || "");

    // Check if reason is needed (Admin changing ownership or historical data)
    let reasonNeeded = false;
    if (permissionCtx.isAdmin) {
      if (
        values.owner_sale_id !== (customer.owner_sale_id || "") ||
        values.owner_tele_id !== (customer.owner_tele_id || "") ||
        values.historical_revenue_total !== ((customer as any).historical_revenue_total?.toString() || "") ||
        values.historical_order_count !== ((customer as any).historical_order_count?.toString() || "") ||
        values.historical_last_purchase_at !== ((customer as any).historical_last_purchase_at || "") ||
        values.historical_revenue_note !== ((customer as any).historical_revenue_note || "") ||
        values.historical_revenue_source !== ((customer as any).historical_revenue_source || "")
      ) {
        reasonNeeded = true;
      }
    }

    if (phoneChanged || emailChanged || reasonNeeded) {
      setConfirmDialog({
        isOpen: true,
        reasonNeeded,
        phoneChanged,
        emailChanged,
        pendingValues: values,
        reasonText: "",
      });
      return;
    }

    await executeUpdate(values);
  };

  const executeUpdate = async (values: FormValues, reason?: string) => {
    setIsSubmitting(true);
    const res = await updateCustomerProfile({
      customerId: customer.id,
      originalCustomer: customer,
      formValues: values,
      permissionCtx,
      reason,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    if (res.data) {
      toast.success("Cập nhật thông tin khách hàng thành công!");
      onSaved?.(res.data);
    } else {
      toast.error(res.error || "Có lỗi xảy ra khi cập nhật hồ sơ khách hàng.");
    }
  };

  const handleConfirmSubmit = () => {
    if (confirmDialog.reasonNeeded && !confirmDialog.reasonText.trim()) {
      toast.error("Vui lòng nhập lý do thay đổi.");
      return;
    }
    setConfirmDialog({ ...confirmDialog, isOpen: false });
    if (confirmDialog.pendingValues) {
      executeUpdate(confirmDialog.pendingValues, confirmDialog.reasonText);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {canEdit("business_name") && (
              <FormField
                control={form.control}
                name="business_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên doanh nghiệp / Spa</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập tên..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("contact_name") && (
              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên người liên hệ</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập tên..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("phone") && (
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Số điện thoại</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập số điện thoại..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("email") && (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập email..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("city") && (
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tỉnh/Thành phố</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn Tỉnh/Thành phố" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VIETNAM_PROVINCES.map((province) => (
                          <SelectItem key={province} value={province}>
                            {province}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("district") && (
              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quận/Huyện</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập quận/huyện..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("address") && (
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Địa chỉ chi tiết</FormLabel>
                    <FormControl>
                      <Input placeholder="Số nhà, tên đường..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("status") && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trạng thái</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn trạng thái" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Mới">Mới</SelectItem>
                        <SelectItem value="Đang chăm sóc">Đang chăm sóc</SelectItem>
                        <SelectItem value="Đã chốt">Đã chốt</SelectItem>
                        <SelectItem value="Không tiềm năng">Không tiềm năng</SelectItem>
                        <SelectItem value="Sai thông tin">Sai thông tin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("lifecycle_stage") && (
              <FormField
                control={form.control}
                name="lifecycle_stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giai đoạn vòng đời</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn giai đoạn" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Lead">Lead</SelectItem>
                        <SelectItem value="MQL">MQL</SelectItem>
                        <SelectItem value="SQL">SQL</SelectItem>
                        <SelectItem value="Customer">Customer</SelectItem>
                        <SelectItem value="Churned">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("potential_level") && (
              <FormField
                control={form.control}
                name="potential_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mức độ tiềm năng</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn mức độ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="High">Cao (High)</SelectItem>
                        <SelectItem value="Medium">Trung bình (Medium)</SelectItem>
                        <SelectItem value="Low">Thấp (Low)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {canEdit("source") && (
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nguồn</FormLabel>
                    <FormControl>
                      <Input placeholder="Nguồn khách hàng..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("facebook") && (
              <FormField
                control={form.control}
                name="facebook"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facebook</FormLabel>
                    <FormControl>
                      <Input placeholder="Link Facebook..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("zalo") && (
              <FormField
                control={form.control}
                name="zalo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zalo</FormLabel>
                    <FormControl>
                      <Input placeholder="SĐT Zalo..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("owner_sale_id") && (
              <FormField
                control={form.control}
                name="owner_sale_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Người phụ trách (Sale)</FormLabel>
                    <FormControl>
                      <Input placeholder="UUID..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {canEdit("owner_tele_id") && (
              <FormField
                control={form.control}
                name="owner_tele_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Người phụ trách (Telesale)</FormLabel>
                    <FormControl>
                      <Input placeholder="UUID..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          {canEdit("note") && (
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Nhập ghi chú..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Nhóm trường Historical - Chỉ admin thấy */}
          {(canEdit("historical_revenue_total") || canEdit("historical_order_count")) && (
            <div className="border p-4 rounded-md space-y-4 bg-slate-50">
              <h4 className="font-semibold text-slate-800">Dữ liệu Lịch sử (Admin)</h4>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {canEdit("historical_revenue_total") && (
                  <FormField
                    control={form.control}
                    name="historical_revenue_total"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tổng doanh thu lịch sử</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {canEdit("historical_order_count") && (
                  <FormField
                    control={form.control}
                    name="historical_order_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số đơn hàng lịch sử</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {canEdit("historical_last_purchase_at") && (
                  <FormField
                    control={form.control}
                    name="historical_last_purchase_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ngày mua hàng cuối</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {canEdit("historical_revenue_source") && (
                  <FormField
                    control={form.control}
                    name="historical_revenue_source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nguồn dữ liệu</FormLabel>
                        <FormControl>
                          <Input placeholder="M55 Import, KiotViet..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              {canEdit("historical_revenue_note") && (
                <FormField
                  control={form.control}
                  name="historical_revenue_note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ghi chú dữ liệu lịch sử</FormLabel>
                      <FormControl>
                        <Textarea placeholder="..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Form>

      <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, isOpen: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận thay đổi quan trọng</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.phoneChanged && "Bạn đang thay đổi số điện thoại của khách hàng. Việc này có thể ảnh hưởng đến đăng nhập hoặc liên lạc."}
              {confirmDialog.emailChanged && " Bạn đang thay đổi email của khách hàng."}
              {confirmDialog.reasonNeeded && " Vui lòng nhập lý do (Bắt buộc) vì bạn đang thay đổi người phụ trách hoặc dữ liệu lịch sử."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {confirmDialog.reasonNeeded && (
            <div className="py-4">
              <label className="block text-sm font-medium mb-1">Lý do thay đổi <span className="text-red-500">*</span></label>
              <Textarea 
                placeholder="VD: Cập nhật doanh số theo yêu cầu kế toán..."
                value={confirmDialog.reasonText}
                onChange={(e) => setConfirmDialog({...confirmDialog, reasonText: e.target.value})}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit}>
              Xác nhận lưu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

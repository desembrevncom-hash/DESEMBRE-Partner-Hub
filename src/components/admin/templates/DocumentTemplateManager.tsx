import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  FileText, 
  Save, 
  Plus, 
  AlertTriangle, 
  Trash2, 
  Copy, 
  Check, 
  RotateCcw, 
  HelpCircle, 
  BookOpen, 
  Info, 
  FileSpreadsheet, 
  Heart, 
  Sparkles,
  Eye,
  FileCode,
  LayoutTemplate
} from "lucide-react";
import { DocumentTemplatePreview } from "./DocumentTemplatePreview";
import { useAuth } from "@/hooks/useAuth";
import { validateTemplateVariables } from "@/lib/documentTemplates";

type TemplateType = "quotation" | "product_sales_sheet" | "product_catalog_a4" | "customer_consultation_sheet";

interface DocumentTemplate {
  id: string;
  template_type: TemplateType;
  name: string;
  description: string | null;
  html_template: string | null;
  status: string;
}

// Predefined default HTML templates matching our premium A4 styling
const DEFAULT_PRESETS: Record<TemplateType, { name: string; description: string; html: string }> = {
  quotation: {
    name: "Mẫu báo giá chuyên nghiệp (Desembre)",
    description: "Bảng báo giá chuẩn A4 tích hợp vòng lặp sản phẩm, tạm tính và VAT.",
    html: `<div style="font-family: 'Inter', sans-serif; padding: 25px; color: #1e293b; max-width: 100%;">
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px;">
    <div>
      <h1 style="font-size: 22px; font-weight: 800; color: #3b82f6; margin: 0;">{{company.name}}</h1>
      <p style="font-size: 11px; color: #64748b; margin: 5px 0 0 0;">Mã báo giá: <strong>{{quotation.code}}</strong> | Ngày lập: {{quotation.date}}</p>
    </div>
    <div style="text-align: right;">
      <h2 style="font-size: 18px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: 1px;">BẢNG BÁO GIÁ</h2>
      <p style="font-size: 10px; color: #94a3b8; margin: 2px 0 0 0; text-transform: uppercase;">DESEMBRE BEAUTY</p>
    </div>
  </div>
  
  <!-- Customer Info -->
  <div style="margin-bottom: 20px; font-size: 12px; line-height: 1.6; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr;">
    <div>Khách hàng: <strong>{{customer.name}}</strong></div>
    <div style="text-align: right;">Nhân viên lập: <strong>{{sales.name}}</strong> ({{sales.email}})</div>
  </div>

  <!-- Items Table -->
  <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
    <thead>
      <tr style="background: #2563eb; color: #ffffff; text-transform: uppercase;">
        <th style="padding: 8px 10px; border: 1px solid #2563eb; text-align: left; font-weight: 700;">Sản phẩm</th>
        <th style="padding: 8px 10px; border: 1px solid #2563eb; text-align: center; font-weight: 700; width: 80px;">Quy cách</th>
        <th style="padding: 8px 10px; border: 1px solid #2563eb; text-align: right; font-weight: 700; width: 100px;">Đơn giá</th>
        <th style="padding: 8px 10px; border: 1px solid #2563eb; text-align: center; font-weight: 700; width: 50px;">SL</th>
        <th style="padding: 8px 10px; border: 1px solid #2563eb; text-align: right; font-weight: 700; width: 110px;">Thành tiền</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr style="border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s;">
        <td style="padding: 8px 10px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">{{product_name}}</td>
        <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; text-align: center; color: #64748b;">{{size}}</td>
        <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; text-align: right; font-weight: 500;">{{unit_price}}</td>
        <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; text-align: center;">{{quantity}}</td>
        <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #1e40af;">{{line_total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <!-- Calculation Summary -->
  <div style="width: 45%; margin-left: 55%; font-size: 12px; line-height: 1.8; margin-bottom: 30px;">
    <div style="display: flex; justify-content: space-between;">
      <span style="color: #64748b;">Tạm tính:</span>
      <strong style="color: #334155;">{{subtotal}}</strong>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span style="color: #64748b;">Thuế (VAT):</span>
      <strong style="color: #334155;">{{vat}}</strong>
    </div>
    <div style="display: flex; justify-content: space-between; border-top: 2px solid #e2e8f0; padding-top: 6px; margin-top: 6px; font-size: 14px; color: #2563eb;">
      <span>Tổng thanh toán:</span>
      <strong style="font-size: 16px; font-weight: 800;">{{total}}</strong>
    </div>
  </div>

  <!-- Note/Signature -->
  <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 15px;">
    <div>
      <p style="margin: 0;">Báo giá có hiệu lực trong vòng 30 ngày kể từ ngày lập.</p>
      <p style="margin: 3px 0 0 0;">Mọi thắc mắc vui lòng liên hệ: {{sales.email}}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 0; font-style: italic;">Cảm ơn Quý khách đã tin tưởng lựa chọn Desembre!</p>
    </div>
  </div>
</div>`
  },
  product_sales_sheet: {
    name: "Mẫu Sales Sheet sản phẩm chuẩn A4",
    description: "Tài liệu đào tạo A4 đẹp mắt cho Sales với đầy đủ công dụng, bảng giá và phân khúc khách hàng.",
    html: `<div style="font-family: 'Inter', sans-serif; max-width: 100%; color: #1e293b; padding: 5px;">
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px;">
    <div>
      <span style="font-size: 10px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.1em;">PRODUCT SALES SHEET</span>
      <h1 style="font-size: 22px; font-weight: 900; margin: 4px 0 0 0; color: #0f172a; text-transform: uppercase; line-height: 1.2;">{{product.name}}</h1>
      <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0;">Thương hiệu: <strong>{{product.brand_name}}</strong> | Danh mục: <strong>{{product.category_name}}</strong></p>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: 1px;">DESEMBRE</div>
      <div style="font-size: 8px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; font-weight: 700;">Premium Cosmetics</div>
    </div>
  </div>

  <!-- Content Grid -->
  <div style="display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 20px; margin-bottom: 15px;">
    <!-- Left Column: Image & Pricing -->
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <div style="background: #f8fafc; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #e2e8f0; min-height: 150px; display: flex; align-items: center; justify-content: center;">
        <img src="{{product.image_url}}" alt="{{product.name}}" style="max-width: 100%; max-height: 140px; object-fit: contain;" />
      </div>

      <div style="background: #ffffff; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0;">
        <h3 style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 8px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; letter-spacing: 0.5px;">BẢNG GIÁ SẢN PHẨM</h3>
        <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
          <thead>
            <tr style="color: #64748b; font-weight: 700; text-align: left;">
              <th style="padding: 4px 0;">Kênh</th>
              <th style="padding: 4px 0;">Dung tích</th>
              <th style="padding: 4px 0; text-align: right;">Giá niêm yết</th>
            </tr>
          </thead>
          <tbody>
            {{#each variants}}
            <tr style="border-top: 1px solid #f1f5f9; color: #334155;">
              <td style="padding: 5px 0; font-weight: 600; text-transform: uppercase; font-size: 9px; color: #475569;">{{channel}}</td>
              <td style="padding: 5px 0;">{{size_label}}</td>
              <td style="padding: 5px 0; text-align: right; font-weight: 800; color: #2563eb;">{{price}}</td>
            </tr>
            {{/each}}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Right Column: Product Knowledge -->
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <div style="background: #eff6ff; border-left: 3px solid #2563eb; border-radius: 0 6px 6px 0; padding: 10px 12px;">
        <p style="margin: 0; font-size: 11px; line-height: 1.4; color: #1e3a8a; font-style: italic;">
          {{product.short_description}}
        </p>
      </div>

      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">CÔNG DỤNG NỔI BẬT</h4>
        <div style="font-size: 10px; line-height: 1.4; color: #334155; white-space: pre-line;">{{knowledge.benefits}}</div>
      </div>

      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">LOẠI DA PHÙ HỢP</h4>
        <div style="font-size: 10px; line-height: 1.4; color: #334155;">{{knowledge.skin_types}}</div>
      </div>

      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">HƯỚNG DẪN SỬ DỤNG</h4>
        <div style="font-size: 10px; line-height: 1.4; color: #334155; white-space: pre-line;">{{knowledge.usage}}</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        <div>
          <h4 style="font-size: 10px; font-weight: 800; color: #d97706; margin: 0 0 2px 0; text-transform: uppercase;">LƯU Ý TƯ VẤN</h4>
          <div style="font-size: 9px; line-height: 1.3; color: #451a03; white-space: pre-line;">{{knowledge.sales_notes}}</div>
        </div>
        <div>
          <h4 style="font-size: 10px; font-weight: 800; color: #dc2626; margin: 0 0 2px 0; text-transform: uppercase;">CHỐNG CHỈ ĐỊNH</h4>
          <div style="font-size: 9px; line-height: 1.3; color: #450a0a; white-space: pre-line;">{{knowledge.warnings}}</div>
        </div>
      </div>
    </div>
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8;">
    <div>Tài liệu lưu hành nội bộ Desembre | Tạo lúc {{generated_at}}</div>
    <div>Trang 1/1</div>
  </div>
</div>`
  },
  product_catalog_a4: {
    name: "Mẫu Catalog dạng lưới A4",
    description: "Catalog in A4 chứa danh mục lưới 2 cột hiển thị hàng loạt sản phẩm.",
    html: `<div style="font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; max-width: 100%;">
  <!-- Header -->
  <div style="border-bottom: 3px solid #10b981; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <h1 style="font-size: 20px; font-weight: 900; color: #059669; margin: 0; letter-spacing: 0.5px;">CATALOG SẢN PHẨM</h1>
      <p style="font-size: 10px; color: #64748b; margin: 3px 0 0 0;">Bảng danh mục sản phẩm lưu hành đối tác Desembre</p>
    </div>
    <div style="font-size: 14px; font-weight: 900; color: #0f172a; letter-spacing: 1px;">DESEMBRE</div>
  </div>

  <!-- Product Grid -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
    {{#each products}}
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; display: flex; gap: 12px; background: #ffffff; transition: box-shadow 0.2s;">
      <div style="width: 70px; height: 70px; flex-shrink: 0; background: #f8fafc; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #f1f5f9;">
        <img src="{{image_url}}" alt="{{name}}" style="max-width: 60px; max-height: 60px; object-fit: contain;" />
      </div>
      <div style="display: flex; flex-direction: column; justify-content: space-between; flex-grow: 1;">
        <div>
          <h4 style="margin: 0; font-size: 11px; font-weight: 700; color: #0f172a; line-height: 1.3;">{{name}}</h4>
          <span style="font-size: 8px; color: #059669; font-weight: 700; text-transform: uppercase; margin-top: 2px; display: inline-block;">{{brand}}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px;">
          <span style="font-size: 9px; color: #64748b;">{{size}}</span>
          <span style="font-size: 11px; font-weight: 800; color: #2563eb;">{{price}}</span>
        </div>
      </div>
    </div>
    {{/each}}
  </div>

  <!-- Footer -->
  <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 9px; color: #94a3b8;">
    <span>Tài liệu nội bộ Desembre Việt Nam &bull; Giá niêm yết chưa áp dụng chiết khấu đại lý.</span>
  </div>
</div>`
  },
  customer_consultation_sheet: {
    name: "Mẫu Phiếu tư vấn phác đồ chuẩn",
    description: "Hồ sơ da liễu kê đơn sản phẩm routine hàng ngày cho khách hàng Spa.",
    html: `<div style="font-family: 'Inter', sans-serif; padding: 25px; color: #1e293b; max-width: 100%;">
  <!-- Header -->
  <div style="border-bottom: 3px solid #8b5cf6; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <h1 style="font-size: 20px; font-weight: 900; color: #7c3aed; margin: 0; letter-spacing: 0.5px;">PHIẾU TƯ VẤN & PHÁC ĐỒ</h1>
      <p style="font-size: 10px; color: #64748b; margin: 3px 0 0 0;">Thiết lập routine điều trị da chuyên sâu Desembre</p>
    </div>
    <div style="font-size: 11px; color: #64748b; text-align: right;">
      <div>Mã phiếu: <strong>{{sheet.code}}</strong></div>
      <div>Ngày lập: {{sheet.date}}</div>
    </div>
  </div>

  <!-- Customer profile -->
  <div style="background: #fdfbf7; border: 1px solid #f5e1c8; border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 11px; line-height: 1.6;">
    <h3 style="margin: 0 0 10px 0; font-size: 12px; color: #b45309; text-transform: uppercase; font-weight: 800; border-bottom: 1px solid #f5e1c8; padding-bottom: 4px;">Thông tin khách hàng</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <div>Họ và tên: <strong>{{customer.name}}</strong></div>
      <div>Điện thoại: {{customer.phone}}</div>
      <div style="grid-column: span 2;">Tình trạng da: <strong>{{customer.skin_condition}}</strong></div>
      <div style="grid-column: span 2;">Chuyên viên tư vấn: <strong>{{consultant.name}}</strong></div>
    </div>
  </div>

  <!-- Routine Table -->
  <div style="margin-bottom: 20px;">
    <h3 style="margin: 0 0 10px 0; font-size: 12px; color: #7c3aed; text-transform: uppercase; font-weight: 800;">Routine chăm sóc da khuyên dùng</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
      <thead>
        <tr style="background: #f5f3ff; color: #7c3aed; border-bottom: 2px solid #ddd;">
          <th style="padding: 8px; text-align: left; font-weight: 700; width: 80px;">Bước</th>
          <th style="padding: 8px; text-align: left; font-weight: 700; width: 200px;">Sản phẩm</th>
          <th style="padding: 8px; text-align: left; font-weight: 700;">Hướng dẫn sử dụng</th>
        </tr>
      </thead>
      <tbody>
        {{#each routine}}
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px; font-weight: 600; color: #6d28d9;">{{step}}</td>
          <td style="padding: 8px;"><strong>{{product_name}}</strong></td>
          <td style="padding: 8px; color: #4b5563; line-height: 1.4;">{{usage}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  <!-- Notes -->
  <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 12px; font-size: 11px; color: #5b21b6; line-height: 1.5; margin-bottom: 25px;">
    <strong>Lưu ý từ chuyên viên:</strong> {{notes}}
  </div>
</div>`
  }
};

// Variable description maps for reference sidebar
const VARIABLE_MAPS: Record<TemplateType, Array<{ name: string; desc: string; isLoop?: boolean }>> = {
  quotation: [
    { name: "company.name", desc: "Tên công ty phát hành" },
    { name: "customer.name", desc: "Họ tên khách hàng nhận" },
    { name: "quotation.code", desc: "Mã số bảng báo giá" },
    { name: "quotation.date", desc: "Ngày tạo báo giá" },
    { name: "subtotal", desc: "Số tiền tạm tính" },
    { name: "vat", desc: "Thuế giá trị gia tăng" },
    { name: "total", desc: "Tổng cộng tiền thanh toán" },
    { name: "sales.name", desc: "Tên nhân viên lập" },
    { name: "sales.email", desc: "Email nhân viên lập" },
    { name: "#each items", desc: "Mở đầu vòng lặp sản phẩm báo giá (phải đóng bằng /each)", isLoop: true },
    { name: "product_name", desc: "Tên sản phẩm (trong vòng lặp items)" },
    { name: "image_url", desc: "Ảnh sản phẩm (trong vòng lặp items)" },
    { name: "size", desc: "Dung tích/quy cách (trong vòng lặp items)" },
    { name: "unit_price", desc: "Đơn giá (trong vòng lặp items)" },
    { name: "quantity", desc: "Số lượng (trong vòng lặp items)" },
    { name: "line_total", desc: "Thành tiền (trong vòng lặp items)" },
  ],
  product_sales_sheet: [
    { name: "product.name", desc: "Tên hiển thị sản phẩm" },
    { name: "product.brand_name", desc: "Tên thương hiệu" },
    { name: "product.category_name", desc: "Tên danh mục" },
    { name: "product.image_url", desc: "Link ảnh sản phẩm" },
    { name: "product.short_description", desc: "Mô tả ngắn" },
    { name: "knowledge.benefits", desc: "Công dụng nổi bật (danh sách)" },
    { name: "knowledge.skin_types", desc: "Loại da phù hợp (danh sách)" },
    { name: "knowledge.usage", desc: "Hướng dẫn sử dụng (danh sách)" },
    { name: "knowledge.sales_notes", desc: "Lưu ý tư vấn (danh sách)" },
    { name: "knowledge.warnings", desc: "Chống chỉ định (danh sách)" },
    { name: "generated_at", desc: "Thời gian tạo" },
    { name: "#each variants", desc: "Mở đầu vòng lặp giá sản phẩm (phải đóng bằng /each)", isLoop: true },
    { name: "channel", desc: "Kênh phân phối: retail hoặc salon (trong loop)" },
    { name: "size_label", desc: "Dung tích sản phẩm (trong loop)" },
    { name: "price", desc: "Đơn giá tương ứng (trong loop)" },
  ],
  product_catalog_a4: [
    { name: "#each products", desc: "Mở đầu vòng lặp danh mục sản phẩm (phải đóng bằng /each)", isLoop: true },
    { name: "name", desc: "Tên sản phẩm (trong loop)" },
    { name: "brand", desc: "Thương hiệu (trong loop)" },
    { name: "size", desc: "Dung tích sản phẩm (trong loop)" },
    { name: "price", desc: "Đơn giá niêm yết (trong loop)" },
    { name: "image_url", desc: "Link ảnh sản phẩm (trong loop)" },
  ],
  customer_consultation_sheet: [
    { name: "sheet.code", desc: "Mã số phiếu tư vấn" },
    { name: "sheet.date", desc: "Ngày lập phiếu tư vấn" },
    { name: "customer.name", desc: "Tên khách hàng" },
    { name: "customer.phone", desc: "Số điện thoại" },
    { name: "customer.skin_condition", desc: "Tình trạng da hiện tại" },
    { name: "consultant.name", desc: "Chuyên viên tư vấn phụ trách" },
    { name: "notes", desc: "Ghi chú/lưu ý từ chuyên viên" },
    { name: "#each routine", desc: "Mở đầu vòng lặp Routine chăm sóc da gợi ý", isLoop: true },
    { name: "step", desc: "Thứ tự bước (ví dụ: Sáng 1, Tối 2)" },
    { name: "product_name", desc: "Tên sản phẩm khuyên dùng" },
    { name: "usage", desc: "Hướng dẫn sử dụng tương ứng" },
  ]
};

export const DocumentTemplateManager: React.FC = () => {
  const { roles } = useAuth();
  const isAdmin = roles.some(r => ["admin", "sub_admin"].includes(r));
  
  const [activeTab, setActiveTab] = useState<TemplateType>("quotation");
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Tab configurations
  const TAB_CONFIGS = [
    { id: "quotation" as TemplateType, label: "Báo giá", icon: FileSpreadsheet, color: "text-blue-500 hover:text-blue-600 border-blue-500 bg-blue-50" },
    { id: "product_sales_sheet" as TemplateType, label: "Product Sales Sheet", icon: FileText, color: "text-indigo-500 hover:text-indigo-600 border-indigo-500 bg-indigo-50" },
    { id: "product_catalog_a4" as TemplateType, label: "Catalog A4", icon: BookOpen, color: "text-emerald-500 hover:text-emerald-600 border-emerald-500 bg-emerald-50" },
    { id: "customer_consultation_sheet" as TemplateType, label: "Phiếu tư vấn", icon: Heart, color: "text-purple-500 hover:text-purple-600 border-purple-500 bg-purple-50" }
  ];

  const activeTabConfig = TAB_CONFIGS.find(t => t.id === activeTab)!;

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      toast.error("Lỗi khi tải danh sách mẫu tài liệu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreateNew = () => {
    const newTemplate: DocumentTemplate = {
      id: "new",
      template_type: activeTab,
      name: `Mẫu ${activeTabConfig.label} mới`,
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
        description: editingTemplate.description || "",
        html_template: editingTemplate.html_template,
        status: editingTemplate.status,
      };

      if (editingTemplate.id === "new") {
        const { error } = await supabase.from("document_templates").insert(payload);
        if (error) throw error;
        toast.success("Tạo mẫu mới thành công!");
      } else {
        const { error } = await supabase
          .from("document_templates")
          .update(payload)
          .eq("id", editingTemplate.id);
        if (error) throw error;
        toast.success("Cập nhật mẫu tài liệu thành công!");
      }
      
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error("Lỗi khi lưu: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa mẫu "${name}" không?`)) return;

    try {
      const { error } = await supabase.from("document_templates").delete().eq("id", id);
      if (error) throw error;
      toast.success("Xóa mẫu tài liệu thành công!");
      if (editingTemplate?.id === id) {
        setEditingTemplate(null);
      }
      fetchTemplates();
    } catch (err: any) {
      toast.error("Lỗi khi xóa: " + err.message);
    }
  };

  const handleLoadPreset = () => {
    if (!editingTemplate) return;
    const preset = DEFAULT_PRESETS[editingTemplate.template_type];
    if (preset && confirm("Hành động này sẽ thay thế toàn bộ nội dung HTML hiện tại bằng mẫu thiết kế mặc định. Bạn có muốn tiếp tục?")) {
      setEditingTemplate({
        ...editingTemplate,
        name: preset.name,
        description: preset.description,
        html_template: preset.html
      });
      toast.success("Đã tải mẫu mặc định thành công!");
    }
  };

  const handleCopyVar = (variable: string) => {
    const format = variable.startsWith("#each") ? `{{${variable}}}\n\n{{/${variable.split(" ")[1]}}}` : `{{${variable}}}`;
    navigator.clipboard.writeText(format);
    setCopiedVar(variable);
    toast.success(`Đã sao chép: ${format}`);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const filteredTemplates = templates.filter(t => t.template_type === activeTab);

  // Live validation validation
  const validationReport = editingTemplate 
    ? validateTemplateVariables(editingTemplate.html_template || "", editingTemplate.template_type)
    : { valid: true, missing: [] };

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      
      {/* Tab Navigation header */}
      <div className="flex border-b border-slate-200 bg-white px-2 overflow-x-auto scrollbar-none gap-1 py-1">
        {TAB_CONFIGS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setEditingTemplate(null);
              }}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                isActive 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Section: List or Editor form */}
        <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white overflow-y-auto">
          {editingTemplate ? (
            <div className="p-5 flex flex-col gap-5 flex-1">
              
              {/* Editor Toolbar */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                    <LayoutTemplate className="w-4 h-4 text-indigo-600" />
                    {editingTemplate.id === "new" ? "Tạo mẫu mới" : "Chỉnh sửa thiết kế"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
                    Loại: {activeTabConfig.label}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (confirm("Hủy chỉnh sửa? Mọi thay đổi chưa lưu sẽ bị mất.")) {
                        setEditingTemplate(null);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Hủy
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving ? "Đang lưu..." : "Lưu mẫu"}
                    </button>
                  )}
                </div>
              </div>

              {/* Template Parameters Form */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Tên mẫu</label>
                  <input 
                    type="text" 
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-medium"
                    placeholder="Nhập tên mẫu..."
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Trạng thái</label>
                  <select 
                    value={editingTemplate.status}
                    onChange={(e) => setEditingTemplate({...editingTemplate, status: e.target.value})}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800 font-medium"
                  >
                    <option value="draft">Bản nháp (Draft)</option>
                    <option value="approved">Đã phê duyệt (Approved)</option>
                    <option value="archived">Lưu trữ (Archived)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Mô tả mẫu</label>
                <textarea 
                  value={editingTemplate.description || ""}
                  onChange={(e) => setEditingTemplate({...editingTemplate, description: e.target.value})}
                  disabled={!isAdmin}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 min-h-[50px]"
                  placeholder="Nhập mô tả ngắn cho mẫu tài liệu này..."
                />
              </div>

              {/* Preset Loading trigger */}
              {isAdmin && (
                <div className="flex justify-between items-center bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                    <span className="text-[11px] font-semibold text-indigo-900">
                      Có sẵn thiết kế mẫu chuẩn Desembre cho loại này
                    </span>
                  </div>
                  <button
                    onClick={handleLoadPreset}
                    className="px-2.5 py-1 text-[10px] font-extrabold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition-colors"
                  >
                    Nạp mẫu mặc định
                  </button>
                </div>
              )}

              {/* Code Editor and variables Helper layout */}
              <div className="flex flex-1 gap-4 overflow-hidden min-h-[350px]">
                
                {/* HTML Editor box */}
                <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <FileCode className="w-3.5 h-3.5 text-slate-400" />
                      HTML Code
                    </label>
                    
                    {!validationReport.valid && (
                      <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Thiếu biến bắt buộc
                      </span>
                    )}
                  </div>
                  <textarea 
                    value={editingTemplate.html_template || ""}
                    onChange={(e) => setEditingTemplate({...editingTemplate, html_template: e.target.value})}
                    disabled={!isAdmin}
                    className="w-full flex-grow px-3 py-2 border border-slate-900 rounded-xl outline-none font-mono text-xs leading-relaxed bg-slate-950 text-emerald-400 selection:bg-slate-800 selection:text-white"
                    placeholder="Nhập mã HTML của bạn tại đây..."
                    style={{ whiteSpace: 'pre', overflowX: 'auto' }}
                  />
                </div>

                {/* Variables Reference Panel */}
                <div className="w-[180px] flex flex-col gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3 overflow-y-auto">
                  <div className="flex items-center gap-1 border-b border-slate-200 pb-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">Bản đồ biến</span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-semibold leading-normal">
                    Click vào biến để sao chép tag điền tự động.
                  </p>
                  
                  <div className="flex flex-col gap-1.5 mt-1">
                    {VARIABLE_MAPS[editingTemplate.template_type]?.map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleCopyVar(item.name)}
                        className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                          copiedVar === item.name 
                            ? "bg-emerald-50 border-emerald-300 scale-95" 
                            : item.isLoop 
                              ? "bg-indigo-50/50 hover:bg-indigo-100 border-indigo-100" 
                              : "bg-white hover:bg-slate-100 border-slate-200"
                        }`}
                        title={item.desc}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold font-mono truncate max-w-[140px] ${
                            item.isLoop ? "text-indigo-700" : "text-slate-800"
                          }`}>
                            {item.name}
                          </span>
                          {copiedVar === item.name ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-[8px] text-slate-400 mt-0.5 truncate leading-tight">
                          {item.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="p-5">
              
              {/* Header List toolbar */}
              <div className="flex items-center justify-between mb-5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-indigo-600" />
                  Danh sách mẫu ({filteredTemplates.length})
                </h3>
                {isAdmin && (
                  <button 
                    onClick={handleCreateNew}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm mẫu
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold">Đang tải danh sách mẫu...</span>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-slate-200 border-dashed p-6">
                  <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Chưa có mẫu thiết kế nào</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[240px] mx-auto">
                    Hiện chưa có mẫu nào cho loại này. Hãy nhấp nút "Thêm mẫu" phía trên để khởi tạo mẫu mới.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredTemplates.map(t => (
                    <div 
                      key={t.id} 
                      className="group flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-xl cursor-pointer transition-all"
                      onClick={() => setEditingTemplate(t)}
                    >
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="font-extrabold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {t.name}
                        </span>
                        {t.description && (
                          <span className="text-[10px] text-slate-400 line-clamp-1">
                            {t.description}
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            t.status === "approved" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : t.status === "draft"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}>
                            {t.status}
                          </span>
                          
                          {/* Variables validation indicator */}
                          {t.html_template && (
                            <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${
                              validateTemplateVariables(t.html_template, t.template_type).valid
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                : "bg-red-50 text-red-700 border border-red-100"
                            }`}>
                              {validateTemplateVariables(t.html_template, t.template_type).valid 
                                ? "Cấu trúc biến hợp lệ" 
                                : "Lỗi biến bắt buộc"}
                            </span>
                          )}
                        </div>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(t.id, t.name);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-all ml-2"
                          title="Xóa mẫu này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Section: Visual Preview */}
        <div className="w-1/2 bg-slate-100 flex flex-col overflow-hidden relative">
          
          <div className="flex-none bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between z-10">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-600" />
              Live Preview A4
            </span>
            {editingTemplate && (
              <span className="text-[9px] font-bold text-slate-400">
                Hiển thị dựa trên dữ liệu mẫu ({editingTemplate.template_type})
              </span>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            {editingTemplate ? (
              <DocumentTemplatePreview 
                htmlTemplate={editingTemplate.html_template || ""} 
                templateType={editingTemplate.template_type} 
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-slate-50/50">
                <LayoutTemplate className="w-12 h-12 text-slate-300 stroke-[1.5] mb-2" />
                <span className="text-xs font-extrabold text-slate-700">Chưa chọn mẫu thiết kế</span>
                <span className="text-[10px] text-slate-400 mt-1 max-w-[220px]">
                  Vui lòng chọn một mẫu từ danh sách hoặc tạo mẫu mới để hiển thị giao diện xem trước.
                </span>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

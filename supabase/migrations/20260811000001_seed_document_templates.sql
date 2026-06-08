-- Migration: Seed Document Templates
-- Phase: v1.4.1T.1

INSERT INTO public.document_templates (id, template_type, name, description, html_template, status, is_default, version)
VALUES
  (
    'd1a11111-1111-1111-1111-111111111111', 
    'quotation', 
    'Mẫu báo giá chuyên nghiệp (Desembre)', 
    'Bảng báo giá chuẩn A4 tích hợp vòng lặp sản phẩm, tạm tính và VAT.', 
    '<div style="font-family: ''Inter'', sans-serif; padding: 25px; color: #1e293b; max-width: 100%;">
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
</div>', 
    'approved', 
    true, 
    1
  ),
  (
    'd1a22222-2222-2222-2222-222222222222', 
    'product_sales_sheet', 
    'Mẫu Sales Sheet sản phẩm chuẩn A4', 
    'Tài liệu đào tạo A4 đẹp mắt cho Sales với đầy đủ công dụng, bảng giá và phân khúc khách hàng.', 
    '<div style="font-family: ''Inter'', sans-serif; max-width: 100%; color: #1e293b; padding: 5px;">
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
    <div>{{footer_note}}</div>
    <div>Tài liệu lưu hành nội bộ | Desembre VN</div>
  </div>
</div>', 
    'approved', 
    true, 
    1
  ),
  (
    'd1a33333-3333-3333-3333-333333333333', 
    'product_catalog_a4', 
    'Mẫu Catalog dạng lưới A4', 
    'Catalog in A4 chứa danh mục lưới 2 cột hiển thị hàng loạt sản phẩm.', 
    '<div style="font-family: ''Inter'', sans-serif; padding: 20px; color: #1e293b; max-width: 100%;">
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
</div>', 
    'approved', 
    true, 
    1
  ),
  (
    'd1a44444-4444-4444-4444-444444444444', 
    'customer_consultation_sheet', 
    'Mẫu Phiếu tư vấn phác đồ chuẩn', 
    'Hồ sơ da liễu kê đơn sản phẩm routine hàng ngày cho khách hàng Spa.', 
    '<div style="font-family: ''Inter'', sans-serif; padding: 25px; color: #1e293b; max-width: 100%;">
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
</div>', 
    'approved', 
    true, 
    1
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  html_template = EXCLUDED.html_template,
  status = EXCLUDED.status,
  is_default = EXCLUDED.is_default;

-- Migration: Upsert product_sales_sheet_premium_v1 and product_sales_sheet_premium_v2
-- Uses ON CONFLICT (id) DO UPDATE SET html_template to always write the latest HTML.
-- NOTE: ON CONFLICT (name) requires a unique constraint on name which may not exist.
--       Using ON CONFLICT (id) is safer since UUIDs are hardcoded.
-- Safe to run multiple times (idempotent).

-- 1. Upsert v1 (with DESEMBRE / Luxury Cosmetics logo in top-right)
INSERT INTO public.document_templates (
  id, template_type, name, description, html_template, status, is_default, version
) VALUES (
  'd1a22222-2222-2222-2222-222222222222',
  'product_sales_sheet',
  'product_sales_sheet_premium_v1',
  'Mau Product Sales Sheet cao cap dang 2 cot - co logo chu goc phai.',
  '<div style="font-family: ''Inter'', sans-serif; max-width: 100%; color: #1e293b; line-height: 1.4; padding: 5px;">
  <!-- Premium Header -->
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px;">
    <div>
      <span style="font-size: 9px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.15em; background: #eff6ff; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe;">THÔNG TIN SẢN PHẨM</span>
      <h1 style="font-size: 20px; font-weight: 900; margin: 6px 0 2px 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">{{product.name}}</h1>
      <p style="font-size: 11px; color: #64748b; margin: 0;">Thương hiệu: <strong style="color: #1e3a8a;">{{product.brand_name}}</strong> | Danh mục: <strong>{{product.category_name}}</strong></p>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 18px; font-weight: 900; color: #1e3a8a; letter-spacing: 1px; line-height: 1;">DESEMBRE</div>
      <div style="font-size: 8px; color: #94a3b8; margin-top: 3px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Luxury Cosmetics</div>
    </div>
  </div>

  <!-- Content Structure -->
  <div style="display: grid; grid-template-columns: 1.25fr 1.75fr; gap: 18px;">
    <!-- Left Panel: Product Image and Pricing Table -->
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <!-- Styled Product Frame -->
      <div style="background: #ffffff; border-radius: 12px; padding: 12px; text-align: center; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); min-height: 180px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;">
        {{#if product.image_url}}
          <img src="{{product.image_url}}" alt="{{product.name}}" style="max-width: 100%; max-height: 160px; object-fit: contain;" />
        {{else}}
          <!-- Fallback image block -->
          <div style="font-size: 11px; color: #94a3b8; font-weight: 600; display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <svg style="width: 32px; height: 32px; stroke: #cbd5e1; fill: none; stroke-width: 1.5;" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            Không có hình ảnh
          </div>
        {{/if}}
      </div>

      <!-- Pricing Info Block -->
      <div style="background: #ffffff; border-radius: 12px; padding: 14px; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
        <h3 style="font-size: 11px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin: 0 0 10px 0; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 5px; letter-spacing: 0.5px; display: flex; justify-content: space-between;">
          <span>BẢNG GIÁ SẢN PHẨM</span>
          <span style="color: #64748b; font-size: 9px; font-weight: 500;">VND</span>
        </h3>
        
        {{#if variants}}
        <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
          <thead>
            <tr style="color: #64748b; font-weight: 700; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-transform: uppercase;">
              <th style="padding: 5px 0;">Kênh</th>
              <th style="padding: 5px 0; text-align: center;">Quy cách</th>
              <th style="padding: 5px 0; text-align: right;">Giá niêm yết</th>
            </tr>
          </thead>
          <tbody>
            {{#each variants}}
            <tr style="border-top: 1px solid #f8fafc; color: #334155;">
              <td style="padding: 6px 0; font-weight: 700; text-transform: uppercase; font-size: 8.5px; color: #1e3a8a;">{{channel}}</td>
              <td style="padding: 6px 0; text-align: center; font-weight: 600;">{{size_label}}</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #0f172a; font-mono: true;">{{price}}</td>
            </tr>
            {{/each}}
          </tbody>
        </table>
        {{else}}
          <div style="font-size: 9.5px; color: #94a3b8; text-align: center; padding: 10px 0; font-style: italic;">
            Chưa có bảng giá đã duyệt.
          </div>
        {{/if}}
      </div>
    </div>

    <!-- Right Panel: AI Product Knowledge Base -->
    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 10.5px;">
      <!-- Hero Product Quote -->
      <div style="background: #eff6ff; border-left: 4px solid #1e3a8a; border-radius: 0 8px 8px 0; padding: 10px 14px; border-top: 1px solid #dbeafe; border-right: 1px solid #dbeafe; border-bottom: 1px solid #dbeafe;">
        <p style="margin: 0; font-size: 11px; line-height: 1.4; color: #1e3a8a; font-style: italic; font-weight: 500;">
          {{product.short_description}}
        </p>
      </div>

      <!-- Core Features -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">CÔNG DỤNG NỔI BẬT</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.benefits}}</div>
      </div>

      <!-- Key Ingredients & Functions (Canonical) -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">THÀNH PHẦN CHÍNH &amp; CHỨC NĂNG</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.key_ingredients}}</div>
      </div>

      {{#if knowledge.show_ingredient_highlights}}
      <!-- Ingredient Highlights (Only shown if key ingredients & functions is missing) -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">THÀNH PHẦN NỔI BẬT</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.ingredient_highlights}}</div>
      </div>
      {{/if}}

      <!-- Full Ingredients -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">THÀNH PHẦN ĐẦY ĐỦ</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line; font-size: 9px;">{{knowledge.full_ingredients}}</div>
      </div>

      <!-- Skin Compatibility -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">LOẠI DA PHÙ HỢP</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.skin_types}}</div>
      </div>

      <!-- Usage Instructions -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">HƯỚNG DẪN SỬ DỤNG</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.usage}}</div>
      </div>

      <!-- Advisory & Warnings -->
      {{#if knowledge.sales_notes}}
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 4px;">
        <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #d97706; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fde68a; padding-bottom: 2px;">LƯU Ý TƯ VẤN</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #78350f; white-space: pre-line; font-weight: 500;">{{knowledge.sales_notes}}</div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fca5a5; padding-bottom: 2px;">CẢNH BÁO / CHỐNG CHỈ ĐỊNH</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #7f1d1d; white-space: pre-line; font-weight: 500;">{{knowledge.warnings}}</div>
        </div>
      </div>
      {{else}}
      <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 4px;">
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fca5a5; padding-bottom: 2px;">CẢNH BÁO / CHỐNG CHỈ ĐỊNH</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #7f1d1d; white-space: pre-line; font-weight: 500;">{{knowledge.warnings}}</div>
        </div>
      </div>
      {{/if}}
    </div>
  </div>

  <!-- Footer Info block -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; font-weight: 500;">
    <div>{{footer_note}} | Tạo lúc: {{generated_at}}</div>
    <div>Trang 1/1</div>
  </div>

</div>',
  'approved', true, 1
)
ON CONFLICT (id) DO UPDATE SET
  html_template = EXCLUDED.html_template,
  template_type = EXCLUDED.template_type,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  is_default = EXCLUDED.is_default,
  version = EXCLUDED.version,
  updated_at = now();

-- 2. Upsert v2 (same as v1 but without DESEMBRE / Luxury Cosmetics logo block)
INSERT INTO public.document_templates (
  id, template_type, name, description, html_template, status, is_default, version
) VALUES (
  'd1a22222-2222-2222-2222-222222222223',
  'product_sales_sheet',
  'product_sales_sheet_premium_v2',
  'Ban customer-facing A4 khong co logo chu goc phai.',
  '<div style="font-family: ''Inter'', sans-serif; max-width: 100%; color: #1e293b; line-height: 1.4; padding: 5px;">
  <!-- Premium Header (No right text logo) -->
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px;">
    <div>
      <span style="font-size: 9px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.15em; background: #eff6ff; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe;">THÔNG TIN SẢN PHẨM</span>
      <h1 style="font-size: 20px; font-weight: 900; margin: 6px 0 2px 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">{{product.name}}</h1>
      <p style="font-size: 11px; color: #64748b; margin: 0;">Thương hiệu: <strong style="color: #1e3a8a;">{{product.brand_name}}</strong> | Danh mục: <strong>{{product.category_name}}</strong></p>
    </div>
  </div>

  <!-- Content Structure -->
  <div style="display: grid; grid-template-columns: 1.25fr 1.75fr; gap: 18px;">
    <!-- Left Panel: Product Image and Pricing Table -->
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <!-- Styled Product Frame -->
      <div style="background: #ffffff; border-radius: 12px; padding: 12px; text-align: center; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); min-height: 180px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;">
        {{#if product.image_url}}
          <img src="{{product.image_url}}" alt="{{product.name}}" style="max-width: 100%; max-height: 160px; object-fit: contain;" />
        {{else}}
          <!-- Fallback image block -->
          <div style="font-size: 11px; color: #94a3b8; font-weight: 600; display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <svg style="width: 32px; height: 32px; stroke: #cbd5e1; fill: none; stroke-width: 1.5;" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            Không có hình ảnh
          </div>
        {{/if}}
      </div>

      <!-- Pricing Info Block -->
      <div style="background: #ffffff; border-radius: 12px; padding: 14px; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
        <h3 style="font-size: 11px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin: 0 0 10px 0; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 5px; letter-spacing: 0.5px; display: flex; justify-content: space-between;">
          <span>BẢNG GIÁ SẢN PHẨM</span>
          <span style="color: #64748b; font-size: 9px; font-weight: 500;">VND</span>
        </h3>
        
        {{#if variants}}
        <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
          <thead>
            <tr style="color: #64748b; font-weight: 700; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-transform: uppercase;">
              <th style="padding: 5px 0;">Kênh</th>
              <th style="padding: 5px 0; text-align: center;">Quy cách</th>
              <th style="padding: 5px 0; text-align: right;">Giá niêm yết</th>
            </tr>
          </thead>
          <tbody>
            {{#each variants}}
            <tr style="border-top: 1px solid #f8fafc; color: #334155;">
              <td style="padding: 6px 0; font-weight: 700; text-transform: uppercase; font-size: 8.5px; color: #1e3a8a;">{{channel}}</td>
              <td style="padding: 6px 0; text-align: center; font-weight: 600;">{{size_label}}</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #0f172a; font-mono: true;">{{price}}</td>
            </tr>
            {{/each}}
          </tbody>
        </table>
        {{else}}
          <div style="font-size: 9.5px; color: #94a3b8; text-align: center; padding: 10px 0; font-style: italic;">
            Chưa có bảng giá đã duyệt.
          </div>
        {{/if}}
      </div>
    </div>

    <!-- Right Panel: AI Product Knowledge Base -->
    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 10.5px;">
      <!-- Hero Product Quote -->
      <div style="background: #eff6ff; border-left: 4px solid #1e3a8a; border-radius: 0 8px 8px 0; padding: 10px 14px; border-top: 1px solid #dbeafe; border-right: 1px solid #dbeafe; border-bottom: 1px solid #dbeafe;">
        <p style="margin: 0; font-size: 11px; line-height: 1.4; color: #1e3a8a; font-style: italic; font-weight: 500;">
          {{product.short_description}}
        </p>
      </div>

      <!-- Core Features -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">CÔNG DỤNG NỔI BẬT</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.benefits}}</div>
      </div>

      <!-- Key Ingredients & Functions (Canonical) -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">THÀNH PHẦN CHÍNH &amp; CHỨC NĂNG</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.key_ingredients}}</div>
      </div>

      {{#if knowledge.show_ingredient_highlights}}
      <!-- Ingredient Highlights (Only shown if key ingredients & functions is missing) -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">THÀNH PHẦN NỔI BẬT</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.ingredient_highlights}}</div>
      </div>
      {{/if}}

      <!-- Full Ingredients -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">THÀNH PHẦN ĐẦY ĐỦ</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line; font-size: 9px;">{{knowledge.full_ingredients}}</div>
      </div>

      <!-- Skin Compatibility -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">LOẠI DA PHÙ HỢP</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.skin_types}}</div>
      </div>

      <!-- Usage Instructions -->
      <div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">HƯỚNG DẪN SỬ DỤNG</h4>
        <div style="line-height: 1.45; color: #334155; white-space: pre-line;">{{knowledge.usage}}</div>
      </div>

      <!-- Advisory & Warnings -->
      {{#if knowledge.sales_notes}}
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 4px;">
        <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #d97706; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fde68a; padding-bottom: 2px;">LƯU Ý TƯ VẤN</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #78350f; white-space: pre-line; font-weight: 500;">{{knowledge.sales_notes}}</div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fca5a5; padding-bottom: 2px;">CẢNH BÁO / CHỐNG CHỈ ĐỊNH</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #7f1d1d; white-space: pre-line; font-weight: 500;">{{knowledge.warnings}}</div>
        </div>
      </div>
      {{else}}
      <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 4px;">
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fca5a5; padding-bottom: 2px;">CẢNH BÁO / CHỐNG CHỈ ĐỊNH</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #7f1d1d; white-space: pre-line; font-weight: 500;">{{knowledge.warnings}}</div>
        </div>
      </div>
      {{/if}}
    </div>
  </div>

  <!-- Footer Info block -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; font-weight: 500;">
    <div>{{footer_note}} | Tạo lúc: {{generated_at}}</div>
    <div>Trang 1/1</div>
  </div>

</div>',
  'approved', false, 2
)
ON CONFLICT (id) DO UPDATE SET
  html_template = EXCLUDED.html_template,
  template_type = EXCLUDED.template_type,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  is_default = EXCLUDED.is_default,
  version = EXCLUDED.version,
  updated_at = now();
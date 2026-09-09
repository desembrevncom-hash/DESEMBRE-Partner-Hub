import type { SalesSheetViewModel } from "./salesSheetViewModel";

/**
 * Single rendering pipeline for Sales Sheet live preview, PDF export, and saved version snapshot.
 * Guarantees zero raw Handlebars {{ }} placeholders remain in the returned HTML string.
 */
export function renderSalesSheetHtml(
  viewModel: SalesSheetViewModel,
  audience: "customer" | "internal" = "customer",
): string {
  const isCustomer = audience === "customer";

  // Top badge text & style
  const topBadgeText = isCustomer ? "THÔNG TIN SẢN PHẨM" : "TÀI LIỆU ĐÀO TẠO NỘI BỘ";
  const topBadgeStyle = isCustomer
    ? "color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.15em; background: #eff6ff; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe;"
    : "color: #b45309; text-transform: uppercase; letter-spacing: 0.15em; background: #fef3c7; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde68a;";

  // Price section title
  const priceTitle = isCustomer ? "BẢNG GIÁ SẢN PHẨM" : "BẢNG GIÁ ĐỐI TÁC";

  // Footer note
  const rawFooter = viewModel.footer_note || "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam.";
  const footerNote = isCustomer
    ? rawFooter.replace(/Tài liệu lưu hành nội bộ/gi, "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam")
    : rawFooter;

  // Escape HTML helper
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // Format list items as bullets HTML
  const renderList = (items: string[]) => {
    const validItems = items.filter(
      (item) => typeof item === "string" && item.trim() && item.trim() !== "Chưa có thông tin trong tài liệu nguồn."
    );
    if (validItems.length === 0) return "";
    return validItems
      .map((item) => `<div style="margin-bottom: 3px;">• ${escapeHtml(item)}</div>`)
      .join("");
  };

  // 1. Header HTML
  const headerHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px;">
      <div>
        <span style="font-size: 9px; font-weight: 800; ${topBadgeStyle}">${topBadgeText}</span>
        <h1 style="font-size: 20px; font-weight: 900; margin: 6px 0 2px 0; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">${escapeHtml(viewModel.product.name)}</h1>
        <p style="font-size: 11px; color: #64748b; margin: 0;">Thương hiệu: <strong style="color: #1e3a8a;">${escapeHtml(viewModel.product.brand_name)}</strong> | Danh mục: <strong>${escapeHtml(viewModel.product.category_name)}</strong></p>
      </div>
      ${
        !viewModel.hideBrandLogo
          ? `<div style="text-align: right;">
              <div style="font-size: 18px; font-weight: 900; color: #1e3a8a; letter-spacing: 1px; line-height: 1;">DESEMBRE</div>
              <div style="font-size: 8px; color: #94a3b8; margin-top: 3px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Luxury Cosmetics</div>
            </div>`
          : ""
      }
    </div>
  `;

  // 2. Image Frame HTML
  const imageHtml = viewModel.product.image_url
    ? `<img src="${escapeHtml(viewModel.product.image_url)}" alt="${escapeHtml(viewModel.product.name)}" style="max-width: 100%; max-height: 160px; object-fit: contain;" />`
    : `<div style="font-size: 11px; color: #94a3b8; font-weight: 600; display: flex; flex-direction: column; align-items: center; gap: 6px;">
        <svg style="width: 32px; height: 32px; stroke: #cbd5e1; fill: none; stroke-width: 1.5;" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        Không có hình ảnh
      </div>`;

  // 3. Pricing Table HTML
  const variantsRows = viewModel.variants
    .map(
      (v) => `
        <tr style="border-top: 1px solid #f8fafc; color: #334155;">
          <td style="padding: 6px 0; font-weight: 700; text-transform: uppercase; font-size: 8.5px; color: #1e3a8a;">${escapeHtml(v.channel)}</td>
          <td style="padding: 6px 0; text-align: center; font-weight: 600;">${escapeHtml(v.size_label)}</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 800; color: #0f172a;">${escapeHtml(v.price)}</td>
        </tr>
      `
    )
    .join("");

  const pricingTableHtml =
    viewModel.variants.length > 0
      ? `<table style="width: 100%; font-size: 10px; border-collapse: collapse;">
          <thead>
            <tr style="color: #64748b; font-weight: 700; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 9px; text-transform: uppercase;">
              <th style="padding: 5px 0;">Kênh</th>
              <th style="padding: 5px 0; text-align: center;">Quy cách</th>
              <th style="padding: 5px 0; text-align: right;">Giá niêm yết</th>
            </tr>
          </thead>
          <tbody>
            ${variantsRows}
          </tbody>
        </table>`
      : `<div style="font-size: 9.5px; color: #94a3b8; text-align: center; padding: 10px 0; font-style: italic;">
          Chưa có bảng giá đã duyệt.
        </div>`;

  // 4. Right Panel Sections
  const quoteSectionHtml = viewModel.product.short_description
    ? `<div style="background: #eff6ff; border-left: 4px solid #1e3a8a; border-radius: 0 8px 8px 0; padding: 10px 14px; border-top: 1px solid #dbeafe; border-right: 1px solid #dbeafe; border-bottom: 1px solid #dbeafe;">
        <p style="margin: 0; font-size: 11px; line-height: 1.4; color: #1e3a8a; font-style: italic; font-weight: 500;">
          ${escapeHtml(viewModel.product.short_description)}
        </p>
      </div>`
    : "";

  const benefitsHtml = renderList(viewModel.benefits);
  const benefitsSectionHtml = benefitsHtml
    ? `<div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">CÔNG DỤNG NỔI BẬT</h4>
        <div style="line-height: 1.45; color: #334155;">${benefitsHtml}</div>
      </div>`
    : "";

  const ingredientsHtml = renderList(viewModel.ingredients);
  const ingredientsSectionHtml = ingredientsHtml
    ? `<div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">THÀNH PHẦN CHÍNH &amp; CHỨC NĂNG</h4>
        <div style="line-height: 1.45; color: #334155;">${ingredientsHtml}</div>
      </div>`
    : "";

  const fullIngredientsSectionHtml =
    !isCustomer && viewModel.full_ingredients
      ? `<div>
          <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">THÀNH PHẦN ĐẦY ĐỦ</h4>
          <div style="line-height: 1.45; color: #334155; font-size: 9px;">${escapeHtml(viewModel.full_ingredients)}</div>
        </div>`
      : "";

  const skinTypesHtml = renderList(viewModel.skin_types);
  const skinTypesSectionHtml = skinTypesHtml
    ? `<div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">LOẠI DA PHÙ HỢP</h4>
        <div style="line-height: 1.45; color: #334155;">${skinTypesHtml}</div>
      </div>`
    : "";

  const usageHtml = renderList(viewModel.usageInstructions);
  const usageSectionHtml = usageHtml
    ? `<div>
        <h4 style="font-size: 11px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">HƯỚNG DẪN SỬ DỤNG</h4>
        <div style="line-height: 1.45; color: #334155;">${usageHtml}</div>
      </div>`
    : "";

  // Advisory & Warnings blocks
  const warningsHtml = renderList(viewModel.warnings);
  const salesNotesHtml = !isCustomer ? renderList(viewModel.sales_notes) : "";

  let advisorySectionHtml = "";
  if (!isCustomer && salesNotesHtml && warningsHtml) {
    advisorySectionHtml = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 4px;">
        <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #d97706; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fde68a; padding-bottom: 2px;">LƯU Ý TƯ VẤN</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #78350f; font-weight: 500;">${salesNotesHtml}</div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fca5a5; padding-bottom: 2px;">CẢNH BÁO / CHỐNG CHỈ ĐỊNH</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #7f1d1d; font-weight: 500;">${warningsHtml}</div>
        </div>
      </div>
    `;
  } else if (!isCustomer && salesNotesHtml) {
    advisorySectionHtml = `
      <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 4px;">
        <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #d97706; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fde68a; padding-bottom: 2px;">LƯU Ý TƯ VẤN</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #78350f; font-weight: 500;">${salesNotesHtml}</div>
        </div>
      </div>
    `;
  } else if (warningsHtml) {
    advisorySectionHtml = `
      <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 4px;">
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 8px;">
          <h4 style="font-size: 9.5px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #fca5a5; padding-bottom: 2px;">CẢNH BÁO / CHỐNG CHỈ ĐỊNH</h4>
          <div style="font-size: 9px; line-height: 1.4; color: #7f1d1d; font-weight: 500;">${warningsHtml}</div>
        </div>
      </div>
    `;
  }

  // 5. Complete Layout HTML
  const finalHtml = `
<div style="font-family: 'Inter', sans-serif; max-width: 100%; color: #1e293b; line-height: 1.4; padding: 5px;">
  ${headerHtml}
  <div style="display: grid; grid-template-columns: 1.25fr 1.75fr; gap: 18px;">
    <!-- Left Panel -->
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="background: #ffffff; border-radius: 12px; padding: 12px; text-align: center; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); min-height: 180px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;">
        ${imageHtml}
      </div>
      <div style="background: #ffffff; border-radius: 12px; padding: 14px; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
        <h3 style="font-size: 11px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin: 0 0 10px 0; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 5px; letter-spacing: 0.5px; display: flex; justify-content: space-between;">
          <span>${priceTitle}</span>
          <span style="color: #64748b; font-size: 9px; font-weight: 500;">VND</span>
        </h3>
        ${pricingTableHtml}
      </div>
    </div>
    <!-- Right Panel -->
    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 10.5px;">
      ${quoteSectionHtml}
      ${benefitsSectionHtml}
      ${ingredientsSectionHtml}
      ${fullIngredientsSectionHtml}
      ${skinTypesSectionHtml}
      ${usageSectionHtml}
      ${advisorySectionHtml}
    </div>
  </div>
  <!-- Footer -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #94a3b8; font-weight: 500;">
    <div>${escapeHtml(footerNote)} | Tạo lúc: ${escapeHtml(viewModel.generated_at)}</div>
    <div>Trang 1/1</div>
  </div>
</div>
  `.trim();

  // Guard check: Output MUST NOT contain raw Handlebars tags {{
  if (finalHtml.includes("{{")) {
    throw new Error("Template chưa được render hoàn chỉnh (vẫn còn raw template placeholders).");
  }

  return finalHtml;
}

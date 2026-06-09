export function escapeTemplateValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return ""; // Skip objects in simple replacement
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeRenderedHtml(html: string): string {
  // Basic sanitization: remove script tags and inline event handlers
  // Note: For a production app, a robust library like DOMPurify is recommended.
  let sanitized = html;

  // Remove <script> tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove onEvent attributes (e.g., onclick, onerror)
  sanitized = sanitized.replace(/ on\w+="[^"]*"/gi, "");
  sanitized = sanitized.replace(/ on\w+='[^']*'/gi, "");
  sanitized = sanitized.replace(/ on\w+=\S+/gi, "");

  // Prevent javascript: pseudo-protocol in href/src
  sanitized = sanitized.replace(/href\s*=\s*(['"]?)javascript:[^>]*>/gi, "href=$1#>");
  sanitized = sanitized.replace(/src\s*=\s*(['"]?)javascript:[^>]*>/gi, "src=$1#>");

  return sanitized;
}

export function formatCurrencyVND(amount: number | string): string {
  const num = Number(amount);
  if (isNaN(num)) return "0đ";
  return new Intl.NumberFormat("vi-VN").format(Math.round(num)) + "đ";
}

export function resolveFallbackImage(): string {
  // Fallback NO IMG text or an embedded base64 gray block
  return "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22200%22%20height%3D%22200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20200%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_18e9d3d3a0e%20text%20%7B%20fill%3A%23999%3Bfont-weight%3Anormal%3Bfont-family%3Avar(--bs-font-sans-serif)%2C%20sans-serif%3Bfont-size%3A14pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_18e9d3d3a0e%22%3E%3Crect%20width%3D%22200%22%20height%3D%22200%22%20fill%3D%22%23eeeeee%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2267.8984375%22%20y%3D%22105.7484375%22%3ENO%20IMG%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E";
}

export function resolveProductImage(url?: string | null): string {
  if (!url || url.trim() === "") {
    return resolveFallbackImage();
  }
  return url;
}

/**
 * Basic template renderer supporting {{variable.name}} and {{#each arrayName}}...{{/each}}.
 */
function renderTemplateContent(template: string, data: any, rootData: any = data): string {
  let result = template;

  // 1. Process {{#each ...}} ... {{/each}} (innermost first)
  let lastEachResult = "";
  while (result !== lastEachResult) {
    lastEachResult = result;
    result = result.replace(
      /\{\{#each\s+([a-zA-Z0-9_.]+)\}\}((?:(?!\{\{#each\b)[\s\S])*?)\{\{\/each\}\}/g,
      (match, arrayPath, blockContent) => {
        let arrayData = getNestedValue(data, arrayPath);
        if (arrayData === undefined && data !== rootData) {
          arrayData = getNestedValue(rootData, arrayPath);
        }
        if (!Array.isArray(arrayData)) return "";

        return arrayData
          .map((item) => {
            return renderTemplateContent(blockContent, item, rootData);
          })
          .join("");
      },
    );
  }

  // 2. Process {{#if ...}} ... {{/if}} (innermost first to support nesting)
  let lastIfResult = "";
  while (result !== lastIfResult) {
    lastIfResult = result;
    result = result.replace(
      /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}((?:(?!\{\{#if\b)[\s\S])*?)\{\{\/if\}\}/g,
      (match, conditionPath, blockContent) => {
        let value = getNestedValue(data, conditionPath);
        if (value === undefined && data !== rootData) {
          value = getNestedValue(rootData, conditionPath);
        }
        let isTrue = false;
        if (value) {
          if (Array.isArray(value)) {
            isTrue = value.length > 0;
          } else {
            isTrue = true;
          }
        }
        const elseParts = blockContent.split(/\{\{else\}\}/);
        const trueBlock = elseParts[0] || "";
        const falseBlock = elseParts[1] || "";
        return isTrue ? trueBlock : falseBlock;
      },
    );
  }

  // 3. Process flat variables {{variable.name}}
  result = result.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, path) => {
    let val = getNestedValue(data, path);
    if (val === undefined && data !== rootData) {
      val = getNestedValue(rootData, path);
    }
    return escapeTemplateValue(val);
  });

  return result;
}

export function renderTemplate(
  htmlTemplate: string | null | undefined,
  data: Record<string, any>,
): string {
  if (!htmlTemplate) return "";
  const rendered = renderTemplateContent(htmlTemplate, data);
  return sanitizeRenderedHtml(rendered);
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const p of parts) {
    if (current == null) return undefined;
    current = current[p];
  }
  return current;
}

export interface TemplateAuditResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingRequiredVars: string[];
}

export function auditTemplate(htmlTemplate: string, templateType: string): TemplateAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequiredVars: string[] = [];

  const content = htmlTemplate || "";

  // 1. Check matching each / each loops
  const eachStarts = (content.match(/\{\{#each\s+([a-zA-Z0-9_.]+)\}\}/g) || []).length;
  const eachEnds = (content.match(/\{\{\/each\}\}/g) || []).length;
  if (eachStarts !== eachEnds) {
    errors.push(
      `Số lượng thẻ mở vòng lặp {{#each}} (${eachStarts}) và đóng {{/each}} (${eachEnds}) không khớp nhau.`,
    );
  }

  // 2. Check unclosed curly braces
  const openBraces = (content.match(/\{\{/g) || []).length;
  const closeBraces = (content.match(/\}\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(
      `Số lượng thẻ mở {{ (${openBraces}) và thẻ đóng }} (${closeBraces}) không khớp nhau.`,
    );
  }

  // 3. Check for script tags or events
  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(content)) {
    warnings.push(
      "Mã chứa thẻ <script>. Thẻ script sẽ tự động bị lược bỏ khi kết xuất vì lý do an toàn.",
    );
  }
  if (/ on\w+=/gi.test(content)) {
    warnings.push(
      "Mã chứa các thuộc tính sự kiện inline (vd: onclick, onerror). Chúng sẽ bị lược bỏ.",
    );
  }

  // 4. Print safety check
  if (content.includes("box-shadow:") && !content.includes("box-shadow: none")) {
    if (
      /box-shadow:\s*[^;]*rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.[3-9]/gi.test(content) ||
      /box-shadow:\s*[^;]*\b[1-9][0-9]px/gi.test(content)
    ) {
      warnings.push(
        "Thiết kế sử dụng đổ bóng (box-shadow) đậm. Đổ bóng quá đậm có thể không hiển thị đẹp khi in A4 trắng đen.",
      );
    }
  }

  // 5. Check missing required variables
  const validation = validateTemplateVariables(content, templateType);
  if (!validation.valid) {
    missingRequiredVars.push(...validation.missing);
    errors.push(`Thiếu các biến bắt buộc: ${validation.missing.map((m) => `{{${m}}}`).join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingRequiredVars,
  };
}

export function validateTemplateVariables(
  htmlTemplate: string,
  templateType: string,
): { valid: boolean; missing: string[] } {
  // Extract all {{var}} ignoring #each and /each
  const regex = /\{\{(?!#each|\/each)([^}]+)\}\}/g;
  const matches = [...(htmlTemplate || "").matchAll(regex)];
  const variablesFound = matches.map((m) => m[1].trim());

  let required: string[] = [];
  if (templateType === "quotation") {
    required = ["company.name", "quotation.code", "customer.name", "total"];
  } else if (templateType === "product_sales_sheet") {
    required = ["product.name", "product.brand_name"];
  } else if (templateType === "product_catalog_a4") {
    required = ["products"];
  } else if (templateType === "customer_consultation_sheet") {
    required = ["customer.name", "routine"];
  }

  const missing = required.filter(
    (r) => !variablesFound.some((v) => v === r || v.startsWith(r + ".")),
  );
  return {
    valid: missing.length === 0,
    missing,
  };
}

export function getTemplateSampleData(templateType: string): any {
  if (templateType === "quotation") {
    return {
      company: { name: "CÔNG TY TNHH VẺ ĐẸP DESEMBRE" },
      quotation: { code: "BG-2026-0001", date: new Date().toLocaleDateString("vi-VN") },
      customer: { name: "Nguyễn Văn A" },
      items: [
        {
          product_name: "DESEMBRE MILK ESSENTIAL CLEANSER",
          image_url: "", // will trigger fallback in raw HTML if they use resolveProductImage, but since we are templating we just provide the string
          size: "150ml",
          unit_price: "650,000đ",
          quantity: 2,
          line_total: "1,300,000đ",
        },
        {
          product_name: "DESEMBRE DERMA SCIENCE WATER CLEANSER",
          image_url: "https://example.com/mock.jpg",
          size: "1000ml",
          unit_price: "1,400,000đ",
          quantity: 1,
          line_total: "1,400,000đ",
        },
      ],
      subtotal: "2,700,000đ",
      vat: "0đ",
      total: "2,700,000đ",
      sales: { name: "Nhân viên Telesale 1", email: "sale1@desembre.vn" },
    };
  }

  if (templateType === "product_sales_sheet") {
    return {
      product: {
        name: "DESEMBRE MILK ESSENTIAL CLEANSER",
        brand_name: "Desembre",
        category_name: "Làm sạch",
        image_url: "", // will test empty
        product_code: "DS-001",
      },
      variants: [
        { channel: "retail", sku: "DS001R", size_label: "150ml", price: "650,000đ" },
        { channel: "salon", sku: "DS001S", size_label: "1000ml", price: "1,650,000đ" },
      ],
      knowledge: {
        benefits: "- Làm sạch sâu\n- Không gây khô da\n- Duy trì độ ẩm",
        skin_types: "Mọi loại da",
        usage: "Lấy một lượng vừa đủ massage lên mặt 1-2 phút, sau đó rửa sạch.",
        sales_notes: "Sản phẩm best-seller, dễ upsell cho khách mới.",
        warnings: "Tránh tiếp xúc trực tiếp với mắt.",
      },
      generated_at: new Date().toLocaleString("vi-VN"),
      knowledge_version: 1,
    };
  }

  if (templateType === "product_catalog_a4") {
    return {
      products: [
        {
          name: "DESEMBRE MILK ESSENTIAL CLEANSER",
          brand: "Desembre",
          size: "150ml",
          price: "650,000đ",
          image_url: "",
        },
        {
          name: "DESEMBRE DERMA SCIENCE WATER CLEANSER",
          brand: "Desembre",
          size: "1000ml",
          price: "1,400,000đ",
          image_url: "",
        },
        {
          name: "DESEMBRE EGF LIFTING TOX AMPOULE",
          brand: "Desembre",
          size: "10ml x 10",
          price: "2,800,000đ",
          image_url: "",
        },
        {
          name: "DESEMBRE AGING SCIENCE AGE SHIELD CREAM",
          brand: "Desembre",
          size: "50g",
          price: "1,200,000đ",
          image_url: "",
        },
      ],
    };
  }

  if (templateType === "customer_consultation_sheet") {
    return {
      sheet: { code: "PT-2026-8899", date: new Date().toLocaleDateString("vi-VN") },
      customer: {
        name: "Nguyễn Thị B",
        phone: "0901234567",
        skin_condition: "Da hỗn hợp thiên dầu, nhạy cảm, mụn ẩn",
      },
      consultant: { name: "Chuyên viên Nguyễn Hồng" },
      routine: [
        {
          step: "Sáng 1",
          product_name: "DESEMBRE MILK ESSENTIAL CLEANSER",
          usage: "Rửa mặt nhẹ nhàng với nước ấm",
        },
        {
          step: "Sáng 2",
          product_name: "DESEMBRE DERMA SCIENCE PEELING GEL",
          usage: "Tẩy tế bào chết 2 lần/tuần",
        },
        {
          step: "Tối 1",
          product_name: "DESEMBRE EGF LIFTING TOX AMPOULE",
          usage: "Thoa 3-4 giọt massage nhẹ nhàng toàn mặt",
        },
      ],
      notes: "Cần chú ý bôi kem chống nắng đều đặn. Tránh tự ý nặn mụn tại nhà.",
    };
  }

  return {};
}

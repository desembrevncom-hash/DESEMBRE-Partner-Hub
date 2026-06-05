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
  sanitized = sanitized.replace(/href\s*=\s*(['"]?)javascript:[^>]*>/gi, 'href=$1#>');
  sanitized = sanitized.replace(/src\s*=\s*(['"]?)javascript:[^>]*>/gi, 'src=$1#>');
  
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
export function renderTemplate(htmlTemplate: string | null | undefined, data: Record<string, any>): string {
  if (!htmlTemplate) return "";
  
  let result = htmlTemplate;

  // 1. Process {{#each array}} ... {{/each}}
  const eachRegex = /\{\{#each\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  result = result.replace(eachRegex, (match, arrayPath, content) => {
    const arrayData = getNestedValue(data, arrayPath);
    if (!Array.isArray(arrayData)) return "";
    
    return arrayData.map(item => {
      // For each item, replace {{field}} with item[field]
      return content.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (itemMatch: string, itemPath: string) => {
        let val = getNestedValue(item, itemPath);
        // Fallback to root data if not found in item (for global vars inside loops)
        if (val === undefined) {
           val = getNestedValue(data, itemPath);
        }
        return escapeTemplateValue(val);
      });
    }).join("");
  });

  // 2. Process flat {{variable.name}}
  result = result.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, path) => {
    const val = getNestedValue(data, path);
    return escapeTemplateValue(val);
  });

  return sanitizeRenderedHtml(result);
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

export function validateTemplateVariables(htmlTemplate: string, templateType: string): { valid: boolean; missing: string[] } {
  // Extract all {{var}} ignoring #each and /each
  const regex = /\{\{(?!#each|\/each)([^}]+)\}\}/g;
  const matches = [...(htmlTemplate || "").matchAll(regex)];
  const variablesFound = matches.map(m => m[1].trim());

  let required: string[] = [];
  if (templateType === "quotation") {
    required = ["company.name", "quotation.code", "customer.name", "total"];
  } else if (templateType === "product_sales_sheet") {
    required = ["product.name", "product.brand_name"];
  }
  
  const missing = required.filter(r => !variablesFound.some(v => v === r || v.startsWith(r + ".")));
  return {
    valid: missing.length === 0,
    missing
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
          line_total: "1,300,000đ"
        },
        {
          product_name: "DESEMBRE DERMA SCIENCE WATER CLEANSER",
          image_url: "https://example.com/mock.jpg",
          size: "1000ml",
          unit_price: "1,400,000đ",
          quantity: 1,
          line_total: "1,400,000đ"
        }
      ],
      subtotal: "2,700,000đ",
      vat: "0đ",
      total: "2,700,000đ",
      sales: { name: "Nhân viên Telesale 1", email: "sale1@desembre.vn" }
    };
  }

  if (templateType === "product_sales_sheet") {
    return {
      product: {
        name: "DESEMBRE MILK ESSENTIAL CLEANSER",
        brand_name: "Desembre",
        category_name: "Làm sạch",
        image_url: "", // will test empty
        product_code: "DS-001"
      },
      variants: [
        { channel: "retail", sku: "DS001R", size_label: "150ml", price: "650,000đ" },
        { channel: "salon", sku: "DS001S", size_label: "1000ml", price: "1,650,000đ" }
      ],
      knowledge: {
        benefits: "- Làm sạch sâu\n- Không gây khô da\n- Duy trì độ ẩm",
        skin_types: "Mọi loại da",
        usage: "Lấy một lượng vừa đủ massage lên mặt 1-2 phút, sau đó rửa sạch.",
        sales_notes: "Sản phẩm best-seller, dễ upsell cho khách mới.",
        warnings: "Tránh tiếp xúc trực tiếp với mắt."
      },
      generated_at: new Date().toLocaleString("vi-VN"),
      knowledge_version: 1
    };
  }

  return {};
}

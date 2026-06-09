import { describe, it, expect } from "vitest";
import {
  auditTemplate,
  validateTemplateVariables,
  renderTemplate,
  getTemplateSampleData,
} from "../src/lib/documentTemplates";

describe("Document Templates Module", () => {
  describe("validateTemplateVariables", () => {
    it("should pass quotation templates with all required variables", () => {
      const html = "<div>{{company.name}} {{quotation.code}} {{customer.name}} {{total}}</div>";
      const result = validateTemplateVariables(html, "quotation");
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it("should catch missing variables in quotation template", () => {
      const html = "<div>{{company.name}} {{customer.name}}</div>";
      const result = validateTemplateVariables(html, "quotation");
      expect(result.valid).toBe(false);
      expect(result.missing).toContain("quotation.code");
      expect(result.missing).toContain("total");
    });

    it("should pass product sales sheet with required variables", () => {
      const html = "<div>{{product.name}} {{product.brand_name}}</div>";
      const result = validateTemplateVariables(html, "product_sales_sheet");
      expect(result.valid).toBe(true);
    });
  });

  describe("auditTemplate", () => {
    it("should pass valid premium template structure", () => {
      const html = "<div>{{company.name}} {{quotation.code}} {{customer.name}} {{total}}</div>";
      const audit = auditTemplate(html, "quotation");
      expect(audit.valid).toBe(true);
      expect(audit.errors).toHaveLength(0);
      expect(audit.warnings).toHaveLength(0);
    });

    it("should catch mismatched each/each loop tags", () => {
      const html = "<div>{{#each items}} {{product_name}}</div>"; // missing {{/each}}
      const audit = auditTemplate(html, "quotation");
      expect(audit.valid).toBe(false);
      expect(audit.errors.some((e) => e.includes("each"))).toBe(true);
    });

    it("should catch unclosed curly braces", () => {
      const html = "<div>{{company.name {{total}}</div>"; // unmatched double braces
      const audit = auditTemplate(html, "quotation");
      expect(audit.valid).toBe(false);
      expect(audit.errors.some((e) => e.includes("không khớp"))).toBe(true);
    });

    it("should warn about dangerous script tags", () => {
      const html =
        "<div>{{company.name}} {{quotation.code}} {{customer.name}} {{total}} <script>alert(1)</script></div>";
      const audit = auditTemplate(html, "quotation");
      expect(audit.warnings.some((w) => w.includes("script"))).toBe(true);
    });

    it("should warn about heavy print-unfriendly box shadows", () => {
      const html =
        "<div style='box-shadow: 10px 10px 15px rgba(0,0,0,0.5);'>{{product.name}} {{product.brand_name}}</div>";
      const audit = auditTemplate(html, "product_sales_sheet");
      expect(audit.warnings.some((w) => w.includes("box-shadow") || w.includes("đổ bóng"))).toBe(
        true,
      );
    });
  });

  describe("renderTemplate", () => {
    it("should render simple variables", () => {
      const html = "<h1>{{company.name}}</h1>";
      const data = { company: { name: "Test Company" } };
      const rendered = renderTemplate(html, data);
      expect(rendered).toBe("<h1>Test Company</h1>");
    });

    it("should render loops with #each", () => {
      const html = "<ul>{{#each items}}<li>{{name}}: {{price}}</li>{{/each}}</ul>";
      const data = {
        items: [
          { name: "Item A", price: "10k" },
          { name: "Item B", price: "20k" },
        ],
      };
      const rendered = renderTemplate(html, data);
      expect(rendered).toBe("<ul><li>Item A: 10k</li><li>Item B: 20k</li></ul>");
    });

    it("should sanitize output removing scripts and onload attributes", () => {
      const html = "<div onload='bad()'>{{company.name}}<script>alert('hack')</script></div>";
      const data = { company: { name: "Safe" } };
      const rendered = renderTemplate(html, data);
      expect(rendered).toBe("<div>Safe</div>");
    });

    it("should render true block of {{#if}} if condition is truthy", () => {
      const html = "<div>{{#if hasImage}}Image exists{{else}}No image{{/if}}</div>";
      const data = { hasImage: true };
      const rendered = renderTemplate(html, data);
      expect(rendered).toBe("<div>Image exists</div>");
    });

    it("should render false block of {{#if}} if condition is falsy", () => {
      const html = "<div>{{#if hasImage}}Image exists{{else}}No image{{/if}}</div>";
      const data = { hasImage: false };
      const rendered = renderTemplate(html, data);
      expect(rendered).toBe("<div>No image</div>");
    });

    it("should support nested {{#if}} and loop integration", () => {
      const html =
        "<div>{{#if showList}}<ul>{{#each items}}{{#if active}}<li>{{name}}</li>{{/if}}{{/each}}</ul>{{/if}}</div>";
      const data = {
        showList: true,
        items: [
          { name: "A", active: true },
          { name: "B", active: false },
          { name: "C", active: true },
        ],
      };
      const rendered = renderTemplate(html, data);
      expect(rendered).toBe("<div><ul><li>A</li><li>C</li></ul></div>");
    });
  });

  describe("getTemplateSampleData", () => {
    it("should return sample data objects with required structure", () => {
      const sample = getTemplateSampleData("quotation");
      expect(sample).toHaveProperty("company.name");
      expect(sample).toHaveProperty("quotation.code");
      expect(sample).toHaveProperty("customer.name");
      expect(sample).toHaveProperty("total");
    });
  });

  describe("Client-Side Version Resolution (Defensive Loading)", () => {
    it("should select the version with is_current === true", () => {
      const sheets = [
        { id: "1", version: 1, is_current: false, created_at: "2026-06-08T00:00:00Z" },
        { id: "2", version: 2, is_current: true, created_at: "2026-06-08T01:00:00Z" },
        { id: "3", version: 3, is_current: false, created_at: "2026-06-08T02:00:00Z" },
      ];

      const selected = sheets.find((s) => s.is_current === true) || sheets[0];
      expect(selected.id).toBe("2");
    });

    it("should sort and fallback to latest version and created_at if is_current is missing/undefined", () => {
      const sheets = [
        { id: "1", version: 1, created_at: "2026-06-08T00:00:00Z" },
        { id: "3", version: 3, created_at: "2026-06-08T02:00:00Z" },
        { id: "2", version: 2, created_at: "2026-06-08T01:00:00Z" },
      ];

      const sorted = [...sheets].sort((a, b) => {
        const currentA = a.is_current === true ? 1 : 0;
        const currentB = b.is_current === true ? 1 : 0;
        if (currentA !== currentB) return currentB - currentA;

        const vA = typeof a.version === "number" ? a.version : 1;
        const vB = typeof b.version === "number" ? b.version : 1;
        if (vA !== vB) return vB - vA;

        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      expect(sorted[0].id).toBe("3");
    });
  });
});

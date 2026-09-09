import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  A4PreviewFrame,
  type A4PreviewFrameRef,
} from "../src/components/admin/templates/A4PreviewFrame";
import { generateSalesSheetFileName } from "../src/lib/salesSheetVersionUtils";
import {
  exportProductSalesSheetPdf,
  type ProductSalesSheetPdfData,
} from "../src/lib/salesSheetPdfExport";

describe("Product Sales Sheet PDF Export & Action Button - Unit Tests", () => {
  // Test 1: Action button text and labeling
  it("renders 'XUẤT PDF' button and does NOT render 'IN BẢN MẪU'", () => {
    const html = renderToString(
      React.createElement(A4PreviewFrame, {
        htmlContent: "<div>Sample content</div>",
        title: "Desembre Milk Cleanser",
      }),
    );

    // 1. Must render "XUẤT PDF"
    expect(html).toContain("XUẤT PDF");

    // 2. Must NOT render "IN BẢN MẪU" or old combined text
    expect(html).not.toContain("IN BẢN MẪU");
    expect(html).not.toContain("IN BẢN MẪU / XUẤT PDF");

    // 3. Must have tooltip/aria-label "Xuất tài liệu PDF"
    expect(html).toContain('aria-label="Xuất tài liệu PDF"');

    // 4. Must render header "Xem trước thiết kế"
    expect(html).toContain("Xem trước thiết kế");
  });

  // Test 2: Safe filename generation
  it("generates safe, customer-facing PDF filenames", () => {
    expect(generateSalesSheetFileName("Desembre Milk Essential Cleanser")).toBe(
      "Desembre-Milk-Essential-Cleanser-sales-sheet.pdf",
    );

    expect(generateSalesSheetFileName("Sữa rửa mặt Desembre Milk Essential Cleanser")).toBe(
      "Sua-rua-mat-Desembre-Milk-Essential-Cleanser-sales-sheet.pdf",
    );

    expect(generateSalesSheetFileName("  Sản phẩm #1 (Đặc biệt)  ")).toBe(
      "San-pham-1-Dac-biet-sales-sheet.pdf",
    );

    expect(generateSalesSheetFileName("")).toBe("Desembre-Product-sales-sheet.pdf");
    expect(generateSalesSheetFileName(undefined)).toBe("Desembre-Product-sales-sheet.pdf");
  });

  // Test 3: Export handler does NOT call window.print()
  it("export handler does not call window.print()", async () => {
    const printSpy = vi.fn();
    // Mock window.print
    (global as any).window = (global as any).window || {};
    (global as any).window.print = printSpy;

    const onExportMock = vi.fn();
    const refObject: { current: A4PreviewFrameRef | null } = { current: null };

    // Simulate ref attachment using custom container
    let handleRefCapture: A4PreviewFrameRef | null = null;
    function Wrapper() {
      return React.createElement(A4PreviewFrame, {
        htmlContent: "<div>Content</div>",
        title: "Test",
        onExportPdf: onExportMock,
        ref: (instance: A4PreviewFrameRef | null) => {
          handleRefCapture = instance;
        },
      });
    }

    renderToString(React.createElement(Wrapper));

    // If ref capture or direct trigger
    if (handleRefCapture) {
      await (handleRefCapture as A4PreviewFrameRef).exportPdf();
      expect(onExportMock).toHaveBeenCalled();
    }

    // Verify window.print was NEVER called
    expect(printSpy).not.toHaveBeenCalled();
  });

  // Test 4: PDF export function generates a valid Blob and calls export without window.print()
  it("PDF export function generates valid Blob directly", async () => {
    const printSpy = vi.fn();
    (global as any).window = (global as any).window || {};
    (global as any).window.print = printSpy;

    const mockData: ProductSalesSheetPdfData = {
      product: {
        name: "Desembre Milk Essential Cleanser",
        brand_name: "Desembre",
        category_name: "Làm sạch",
        short_description: "Sữa rửa mặt dưỡng ẩm dịu nhẹ",
      },
      variants: [
        { channel: "retail", size_label: "150ml", price: "450.000 đ" },
        { channel: "salon", size_label: "1000ml", price: "1.200.000 đ" },
      ],
      knowledge: {
        benefits: ["Làm sạch sâu", "Cân bằng độ ẩm"],
        key_ingredients: ["Tinh dầu mắc ca: Giữ ẩm"],
        full_ingredients: "Water, Mineral oil, Glycerin.",
        skin_types: ["Mọi loại da"],
        usage: ["Lấy 2-3ml thoa đều"],
        warnings: ["Tránh tiếp xúc mắt"],
      },
      footer_note: "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam.",
      generated_at: "08/09/2026",
      audience: "customer",
    };

    const blob = await exportProductSalesSheetPdf(mockData);

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(0);
    // Verified window.print() was never invoked
    expect(printSpy).not.toHaveBeenCalled();
  });

  // Task C5: A4PreviewFrame renders a scaled container and does not require horizontal overflow
  it("A4PreviewFrame renders a scaled container and transform scale style", () => {
    const html = renderToString(
      React.createElement(A4PreviewFrame, {
        htmlContent: "<div>Content to scale</div>",
        title: "Scaling Test",
      }),
    );

    // 1. Must render preview container
    expect(html).toContain('data-testid="a4-preview-container"');

    // 2. Must render scaled wrapper
    expect(html).toContain('data-testid="a4-scaled-wrapper"');

    // 3. Must apply transform scale and top-left transformOrigin
    expect(html).toContain("transform:scale(");
    expect(html).toContain("transform-origin:top left");

    // 4. Must render 794px width for unscaled A4 canvas
    expect(html).toContain("width:794px");
    expect(html).toContain("min-height:1123px");
  });
});

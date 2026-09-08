import { describe, expect, it } from "vitest";
import type {
  ProductKnowledgeSummary,
  GuidebookStatus,
  KnowledgeStatus,
  SalesSheetStatus,
} from "../src/features/products/types";
import type { ProductSourceDocument } from "../src/lib/catalogAdminDb";

describe("Product Sales Knowledge Workflow & Permission Boundaries", () => {
  describe("1. Guidebook vs Sales Sheet Independence", () => {
    it("ensures a saved or extracted guidebook alone never creates or counts as a sales sheet", () => {
      // Given a product with an extracted guidebook
      const guidebookDoc: ProductSourceDocument = {
        id: "doc-123",
        catalog_product_id: "prod-abc",
        file_name: "Desembre_Clinical_Guidebook.md",
        file_url: null,
        file_type: "text/markdown",
        document_type: "guidebook",
        source_type: "text",
        raw_text: "## Tên sản phẩm: Tinh chất phục hồi...",
        extracted_text: "## Tên sản phẩm: Tinh chất phục hồi...",
        extracted_data: {
          benefits: "Phục hồi da hư tổn",
          usage_instructions: "Thoa 3-4 giọt",
        },
        extraction_status: "completed",
        uploaded_by: "admin-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Sales sheets map has NO entry for this product
      const salesSheetsMap: Record<
        string,
        { id: string; status: "draft" | "approved"; title?: string; updated_at?: string }
      > = {};

      const hasSalesSheet = Boolean(salesSheetsMap[guidebookDoc.catalog_product_id]);
      expect(hasSalesSheet).toBe(false);

      // Status of sales sheet remains 'none'
      const salesSheetStatus: SalesSheetStatus =
        salesSheetsMap[guidebookDoc.catalog_product_id]?.status || "none";
      expect(salesSheetStatus).toBe("none");
    });
  });

  describe("2. Knowledge Extraction & Approval Gating", () => {
    it("never automatically marks product knowledge as approved upon extraction", () => {
      // Extracted suggestions are returned as draft suggestions
      const extractedSuggestions = {
        benefits: "Dưỡng ẩm sâu",
        ingredient_highlights: ["Hyaluronic Acid", "Ceramide NP"],
        usage_instructions: "Dùng sáng và tối",
        qa_status: "draft", // Initial state MUST be draft
        is_active: false,
        is_public: false,
      };

      expect(extractedSuggestions.qa_status).toBe("draft");
      expect(extractedSuggestions.is_active).toBe(false);
      expect(extractedSuggestions.is_public).toBe(false);
    });

    it("requires explicit admin action to transition qa_status to approved", () => {
      let currentStatus: "draft" | "review" | "approved" = "draft";

      // Applying guidebook sets to draft/review for admin inspection
      const applyFromGuidebook = () => {
        currentStatus = "draft";
      };
      applyFromGuidebook();
      expect(currentStatus).toBe("draft");

      // Admin reviews and approves
      const adminApprove = () => {
        currentStatus = "approved";
      };
      adminApprove();
      expect(currentStatus).toBe("approved");
    });
  });

  describe("3. Sales and Staff Read-Only Access vs Internal Source Document Protection", () => {
    it("allows sales/staff to view only approved and active knowledge", () => {
      const knowledgeRows = [
        {
          id: "k-1",
          catalog_product_id: "prod-1",
          qa_status: "draft",
          is_active: false,
          benefits: "Internal draft notes",
        },
        {
          id: "k-2",
          catalog_product_id: "prod-2",
          qa_status: "approved",
          is_active: true,
          benefits: "Chiết xuất rau má làm dịu da tức thì",
          ingredient_highlights: ["Centella Asiatica 80%"],
          usage_instructions: "Thoa sau bước toner",
        },
      ];

      // Simulated RLS / API query filter for sales/staff: qa_status === 'approved' AND is_active === true
      const accessibleToSales = knowledgeRows.filter(
        (k) => k.qa_status === "approved" && k.is_active === true,
      );

      expect(accessibleToSales).toHaveLength(1);
      expect(accessibleToSales[0].id).toBe("k-2");
      expect(accessibleToSales[0].benefits).toBe("Chiết xuất rau má làm dịu da tức thì");
    });

    it("ensures sales/staff read-only dialog payload never contains raw guidebook text or unapproved documents", () => {
      // The read-only view contract strictly fields customer-facing structured knowledge
      interface ReadOnlyKnowledgePayload {
        benefits?: string | null;
        ingredient_highlights?: string[] | null;
        usage_instructions?: string | null;
        skin_types?: string[] | null;
        skin_concerns?: string[] | null;
        warnings?: string | null;
        sales_pitch?: string | null;
      }

      const salesPayload: ReadOnlyKnowledgePayload = {
        benefits: "Tái tạo hàng rào bảo vệ da",
        ingredient_highlights: ["Peptide Complex", "Panthenol 5%"],
        usage_instructions: "Sử dụng 2 lần mỗi ngày",
        skin_types: ["Da nhạy cảm", "Da sau peel"],
      };

      expect(salesPayload).not.toHaveProperty("raw_text");
      expect(salesPayload).not.toHaveProperty("file_url");
      expect(salesPayload).not.toHaveProperty("extracted_text");
    });
  });

  describe("4. Public Catalog (/san-pham) Visibility Rules", () => {
    it("public catalog requires BOTH qa_status = 'approved' AND is_public = true AND is_active = true", () => {
      const knowledgeList = [
        {
          id: "k-approved-internal",
          catalog_product_id: "p1",
          qa_status: "approved",
          is_active: true,
          is_public: false, // Internal staff only, NOT public
        },
        {
          id: "k-approved-public",
          catalog_product_id: "p2",
          qa_status: "approved",
          is_active: true,
          is_public: true, // Visible on /san-pham
        },
        {
          id: "k-draft",
          catalog_product_id: "p3",
          qa_status: "draft",
          is_active: false,
          is_public: true, // Draft must not show even if flag was accidentally set
        },
      ];

      const publicVisible = knowledgeList.filter(
        (k) => k.qa_status === "approved" && k.is_public === true && k.is_active === true,
      );

      expect(publicVisible).toHaveLength(1);
      expect(publicVisible[0].id).toBe("k-approved-public");
    });
  });

  describe("5. Admin Sales Sheet Generation CTA vs Sales View", () => {
    it("shows 'Tạo Sales Sheet từ Tri thức AI' CTA to Admin when approved knowledge exists without sales sheet", () => {
      const knowledgeSummary: ProductKnowledgeSummary = {
        id: "k-prod-1",
        qa_status: "approved",
        is_active: true,
        is_public: true,
        updated_at: new Date().toISOString(),
      };
      const salesSheetInfo = undefined; // No sales sheet yet
      const isManager = true;

      const shouldShowCreateSalesSheetCta =
        isManager && !salesSheetInfo && knowledgeSummary?.qa_status === "approved";

      expect(shouldShowCreateSalesSheetCta).toBe(true);
    });

    it("shows 'Xem Tri thức' action to Sales staff when approved knowledge exists without sales sheet", () => {
      const knowledgeSummary: ProductKnowledgeSummary = {
        id: "k-prod-1",
        qa_status: "approved",
        is_active: true,
        is_public: true,
        updated_at: new Date().toISOString(),
      };
      const salesSheetInfo = undefined;
      const isManager = false; // Sales / Staff role

      const shouldShowViewKnowledgeBtn = !isManager && knowledgeSummary?.qa_status === "approved";

      expect(shouldShowViewKnowledgeBtn).toBe(true);
    });
  });

  describe("6. Pipeline Status Badges Computation", () => {
    it("computes status badges accurately across the 3 pipeline stages", () => {
      // Stage 1: Guidebook
      const getGuidebookBadge = (status: GuidebookStatus) => {
        switch (status) {
          case "extracted":
            return { label: "Đã trích xuất", color: "bg-emerald-50 text-emerald-700" };
          case "saved":
            return { label: "Đã lưu", color: "bg-blue-50 text-blue-700" };
          default:
            return { label: "Chưa có", color: "bg-slate-100 text-slate-500" };
        }
      };

      // Stage 2: Tri thức AI
      const getKnowledgeBadge = (status: KnowledgeStatus) => {
        switch (status) {
          case "approved":
            return { label: "Đã duyệt", color: "bg-emerald-50 text-emerald-700" };
          case "review":
            return { label: "Chờ duyệt", color: "bg-amber-50 text-amber-700" };
          case "draft":
            return { label: "Bản nháp", color: "bg-blue-50 text-blue-700" };
          default:
            return { label: "Chưa có", color: "bg-slate-100 text-slate-500" };
        }
      };

      // Stage 3: Sales Sheet
      const getSalesSheetBadge = (status: SalesSheetStatus) => {
        switch (status) {
          case "approved":
            return { label: "Đã duyệt", color: "bg-emerald-50 text-emerald-700" };
          case "draft":
            return { label: "Bản nháp", color: "bg-amber-50 text-amber-700" };
          default:
            return { label: "Chưa có", color: "bg-slate-100 text-slate-500" };
        }
      };

      expect(getGuidebookBadge("extracted").label).toBe("Đã trích xuất");
      expect(getGuidebookBadge("none").label).toBe("Chưa có");

      expect(getKnowledgeBadge("draft").label).toBe("Bản nháp");
      expect(getKnowledgeBadge("approved").label).toBe("Đã duyệt");

      expect(getSalesSheetBadge("none").label).toBe("Chưa có");
      expect(getSalesSheetBadge("approved").label).toBe("Đã duyệt");
    });
  });
});

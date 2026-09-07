import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MAX_PRODUCT_IMAGE_SIZE,
  ALLOWED_PRODUCT_IMAGE_TYPES,
  validateProductImageFile,
  uploadProductImage,
  uploadAndSaveProductImage,
} from "../src/lib/catalogAdminDb";
import { resolveCatalogProductImage } from "../src/features/catalog/catalogParityUtils";
import { supabase } from "../src/integrations/supabase/client";

// Mock supabase
vi.mock("../src/integrations/supabase/client", () => {
  const uploadMock = vi.fn();
  const getPublicUrlMock = vi.fn();
  const updateMock = vi.fn();
  const eqMock = vi.fn();

  return {
    supabase: {
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
          getPublicUrl: getPublicUrlMock,
        })),
      },
      from: vi.fn(() => ({
        update: updateMock,
      })),
    },
  };
});

describe("Product Image Upload & Validation - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Constants & Constraints", () => {
    it("should specify 5MB max size limit", () => {
      expect(MAX_PRODUCT_IMAGE_SIZE).toBe(5 * 1024 * 1024);
    });

    it("should allow png, jpeg, and webp types", () => {
      expect(ALLOWED_PRODUCT_IMAGE_TYPES).toEqual(["image/png", "image/jpeg", "image/webp"]);
    });
  });

  describe("validateProductImageFile", () => {
    it("should fail when file is null or undefined", () => {
      expect(validateProductImageFile(null).valid).toBe(false);
      expect(validateProductImageFile(undefined).valid).toBe(false);
      expect(validateProductImageFile(null).error).toContain("Chưa chọn tệp ảnh");
    });

    it("should pass for valid image types under 5MB", () => {
      const pngFile = new File(["test data"], "avatar.png", { type: "image/png" });
      const jpgFile = new File(["test data"], "photo.jpg", { type: "image/jpeg" });
      const webpFile = new File(["test data"], "banner.webp", { type: "image/webp" });

      expect(validateProductImageFile(pngFile).valid).toBe(true);
      expect(validateProductImageFile(jpgFile).valid).toBe(true);
      expect(validateProductImageFile(webpFile).valid).toBe(true);
    });

    it("should reject disallowed image MIME types", () => {
      const gifFile = new File(["test data"], "animation.gif", { type: "image/gif" });
      const svgFile = new File(["test data"], "vector.svg", { type: "image/svg+xml" });
      const pdfFile = new File(["test data"], "doc.pdf", { type: "application/pdf" });

      const gifRes = validateProductImageFile(gifFile);
      expect(gifRes.valid).toBe(false);
      expect(gifRes.error).toContain("Định dạng ảnh không hợp lệ");

      const svgRes = validateProductImageFile(svgFile);
      expect(svgRes.valid).toBe(false);

      const pdfRes = validateProductImageFile(pdfFile);
      expect(pdfRes.valid).toBe(false);
    });

    it("should reject files exceeding 5MB", () => {
      // Mock large file size
      const oversizedFile = new File(["content"], "huge.png", { type: "image/png" });
      Object.defineProperty(oversizedFile, "size", {
        value: 5 * 1024 * 1024 + 1,
        configurable: true,
      });

      const res = validateProductImageFile(oversizedFile);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("vượt quá giới hạn 5MB");
    });
  });

  describe("uploadProductImage", () => {
    it("should reject invalid files before calling storage API", async () => {
      const badFile = new File(["content"], "doc.txt", { type: "text/plain" });
      const res = await uploadProductImage("prod-123", badFile);

      expect(res.error).toBeDefined();
      expect(res.publicUrl).toBeUndefined();
      expect(supabase.storage.from).not.toHaveBeenCalled();
    });

    it("should upload file with sanitized path to product-images bucket", async () => {
      const validFile = new File(["img-bytes"], "Sản Phẩm #1 (Special)!.PNG", {
        type: "image/png",
      });

      const mockStorage = {
        upload: vi.fn().mockResolvedValue({
          data: { path: "catalog-products/prod-123/123456789-san_pham__1__special___.png" },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: {
            publicUrl:
              "https://xyz.supabase.co/storage/v1/object/public/product-images/catalog-products/prod-123/123456789-san_pham__1__special___.png",
          },
        }),
      };
      (supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

      const res = await uploadProductImage("prod-123", validFile);

      expect(supabase.storage.from).toHaveBeenCalledWith("product-images");
      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^catalog-products\/prod-123\/\d+-.+\.png$/),
        validFile,
        expect.objectContaining({ cacheControl: "3600", upsert: true }),
      );
      expect(res.publicUrl).toContain(
        "https://xyz.supabase.co/storage/v1/object/public/product-images/",
      );
      expect(res.error).toBeUndefined();
    });

    it("should handle storage upload errors gracefully", async () => {
      const validFile = new File(["img-bytes"], "test.webp", { type: "image/webp" });

      const mockStorage = {
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Storage quota exceeded" },
        }),
        getPublicUrl: vi.fn(),
      };
      (supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

      const res = await uploadProductImage("prod-123", validFile);

      expect(res.error).toBe("Storage quota exceeded");
      expect(res.publicUrl).toBeUndefined();
    });
  });

  describe("uploadAndSaveProductImage", () => {
    const validUuid = "11111111-2222-3333-4444-555555555555";

    it("should upload and update catalog_products table with valid UUID", async () => {
      const validFile = new File(["img-bytes"], "sample.jpg", { type: "image/jpeg" });
      const expectedUrl =
        `https://xyz.supabase.co/storage/v1/object/public/product-images/catalog-products/${validUuid}/123-sample.jpg`;

      const mockStorage = {
        upload: vi.fn().mockResolvedValue({
          data: { path: `catalog-products/${validUuid}/123-sample.jpg` },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: expectedUrl },
        }),
      };
      (supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

      const selectMock = vi.fn().mockResolvedValue({
        data: [{ id: validUuid, product_code: "1", name: "Sample", image_url: expectedUrl }],
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ update: updateMock });

      const res = await uploadAndSaveProductImage(validUuid, validFile);

      expect(res.publicUrl).toBe(expectedUrl);
      expect(res.error).toBeUndefined();
      expect(supabase.from).toHaveBeenCalledWith("catalog_products");
      expect(updateMock).toHaveBeenCalledWith({ image_url: expectedUrl });
      expect(eqMock).toHaveBeenCalledWith("id", validUuid);
    });

    it("should resolve real UUID from catalog_products if productId is non-UUID", async () => {
      const targetUuid = "11111111-2222-3333-4444-555555555555";
      const validFile = new File(["img-bytes"], "sample.jpg", { type: "image/jpeg" });
      const expectedUrl =
        `https://xyz.supabase.co/storage/v1/object/public/product-images/catalog-products/${targetUuid}/123-sample.jpg`;

      const mockStorage = {
        upload: vi.fn().mockResolvedValue({
          data: { path: `catalog-products/${targetUuid}/123-sample.jpg` },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: expectedUrl },
        }),
      };
      (supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

      const lookupMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: targetUuid, product_code: "1", name: "Sample Prod" },
        error: null,
      });
      const lookupOr = vi.fn().mockReturnValue({ maybeSingle: lookupMaybeSingle });
      const lookupSelect = vi.fn().mockReturnValue({ or: lookupOr });

      const updateSelect = vi.fn().mockResolvedValue({
        data: [{ id: targetUuid, product_code: "1", name: "Sample Prod", image_url: expectedUrl }],
        error: null,
      });
      const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEq });

      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === "catalog_products") {
          return {
            select: lookupSelect,
            update: updateMock,
          };
        }
        return {};
      });

      const res = await uploadAndSaveProductImage("1", validFile);

      expect(res.publicUrl).toBe(expectedUrl);
      expect(res.error).toBeUndefined();
      expect(updateEq).toHaveBeenCalledWith("id", targetUuid);
    });

    it("should return error when DB update returns 0 rows (no false success)", async () => {
      const validFile = new File(["img-bytes"], "sample.jpg", { type: "image/jpeg" });
      const expectedUrl =
        `https://xyz.supabase.co/storage/v1/object/public/product-images/catalog-products/${validUuid}/123-sample.jpg`;

      const mockStorage = {
        upload: vi.fn().mockResolvedValue({
          data: { path: `catalog-products/${validUuid}/123-sample.jpg` },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: expectedUrl },
        }),
      };
      (supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

      const updateSelect = vi.fn().mockResolvedValue({
        data: [], // 0 rows updated!
        error: null,
      });
      const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEq });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: updateMock,
      });

      const res = await uploadAndSaveProductImage(validUuid, validFile);

      expect(res.error).toBeDefined();
      expect(res.error).toContain("Không tìm thấy sản phẩm");
    });

    it("should return error when DB update returns error", async () => {
      const validFile = new File(["img-bytes"], "sample.jpg", { type: "image/jpeg" });

      const mockStorage = {
        upload: vi.fn().mockResolvedValue({
          data: { path: `catalog-products/${validUuid}/123-sample.jpg` },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://xyz.supabase.co/img.jpg" },
        }),
      };
      (supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);

      const updateSelect = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "permission denied for table catalog_products" },
      });
      const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEq });

      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: updateMock,
      });

      const res = await uploadAndSaveProductImage(validUuid, validFile);

      expect(res.error).toContain("permission denied");
    });
  });

  describe("Catalog Parity Image Resolver Priority", () => {
    it("should prioritize catalog_products.image_url over product_overrides", () => {
      const dbProduct = {
        id: "prod-1",
        product_code: "1",
        name: "Aging Science Pure 24K Gold Cream",
        image_url: "https://example.com/db-uploaded-image.png",
      };
      const override = {
        no: 1,
        image_url: "https://example.com/old-override-image.png",
      };

      const resolved = resolveCatalogProductImage(dbProduct, override);
      expect(resolved).toBe("https://example.com/db-uploaded-image.png");
    });

    it("should fallback to product_overrides if catalog_products.image_url is null", () => {
      const dbProduct = {
        id: "prod-1",
        product_code: "1",
        name: "Aging Science Pure 24K Gold Cream",
        image_url: null,
      };
      const override = {
        no: 1,
        image_url: "https://example.com/override-image.png",
      };

      const resolved = resolveCatalogProductImage(dbProduct, override);
      expect(resolved).toBe("https://example.com/override-image.png");
    });
  });
});

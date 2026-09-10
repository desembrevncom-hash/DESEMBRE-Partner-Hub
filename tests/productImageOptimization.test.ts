import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { CatalogProductImage } from "../src/features/catalog/CatalogProductImage";
import {
  validateProductImageFile,
  compressImageForUpload,
  MAX_PRODUCT_IMAGE_SIZE,
  ALLOWED_PRODUCT_IMAGE_TYPES,
  TARGET_MAX_DIMENSION,
  DEFAULT_WEBP_QUALITY,
} from "../src/lib/imageCompression";
import { resolveCatalogProductImage } from "../src/features/catalog/catalogParityUtils";
import fs from "fs";
import path from "path";

describe("Product Image Optimization & Upload Compression", () => {
  describe("1. CatalogProductImage Rendering & Fallback Safety", () => {
    it("renders <img> with correct src, loading, and decoding when valid imageUrl is provided", () => {
      const html = renderToString(
        React.createElement(CatalogProductImage, {
          src: "https://example.com/product-1.webp",
          alt: "Desembre Cleanser",
          priority: true,
        }),
      );

      expect(html).toContain('src="https://example.com/product-1.webp"');
      expect(html).toContain('alt="Desembre Cleanser"');
      expect(html).toContain('loading="eager"');
      expect(html).toContain('decoding="async"');
    });

    it("renders lazy loading by default when priority is false", () => {
      const html = renderToString(
        React.createElement(CatalogProductImage, {
          src: "https://example.com/product-2.webp",
          alt: "Desembre Mask",
          priority: false,
        }),
      );

      expect(html).toContain('src="https://example.com/product-2.webp"');
      expect(html).toContain('loading="lazy"');
      expect(html).toContain('decoding="async"');
    });

    it("renders fallback placeholder when imageUrl is null, undefined, or whitespace", () => {
      const nullHtml = renderToString(
        React.createElement(CatalogProductImage, {
          src: null,
          alt: "No Image Product",
        }),
      );
      expect(nullHtml).not.toContain("<img");
      expect(nullHtml).toContain("<svg");

      const emptyHtml = renderToString(
        React.createElement(CatalogProductImage, {
          src: "   ",
          alt: "Empty Image Product",
        }),
      );
      expect(emptyHtml).not.toContain("<img");
      expect(emptyHtml).toContain("<svg");
    });
  });

  describe("2. Image File Validation Rules", () => {
    it("validates allowed image MIME types: png, jpeg, webp", () => {
      expect(ALLOWED_PRODUCT_IMAGE_TYPES).toContain("image/png");
      expect(ALLOWED_PRODUCT_IMAGE_TYPES).toContain("image/jpeg");
      expect(ALLOWED_PRODUCT_IMAGE_TYPES).toContain("image/webp");

      const validPng = new File(["test content"], "photo.png", { type: "image/png" });
      const validJpg = new File(["test content"], "photo.jpg", { type: "image/jpeg" });
      const validWebp = new File(["test content"], "photo.webp", { type: "image/webp" });

      expect(validateProductImageFile(validPng).valid).toBe(true);
      expect(validateProductImageFile(validJpg).valid).toBe(true);
      expect(validateProductImageFile(validWebp).valid).toBe(true);
    });

    it("rejects invalid MIME types such as gif, pdf, svg, text", () => {
      const invalidGif = new File(["test"], "anim.gif", { type: "image/gif" });
      const invalidPdf = new File(["test"], "doc.pdf", { type: "application/pdf" });
      const invalidTxt = new File(["test"], "notes.txt", { type: "text/plain" });

      expect(validateProductImageFile(invalidGif).valid).toBe(false);
      expect(validateProductImageFile(invalidPdf).valid).toBe(false);
      expect(validateProductImageFile(invalidTxt).valid).toBe(false);
    });

    it("enforces max file size of 8MB", () => {
      expect(MAX_PRODUCT_IMAGE_SIZE).toBe(8 * 1024 * 1024);

      const smallFile = new File([new Uint8Array(1024 * 500)], "small.jpg", { type: "image/jpeg" });
      expect(validateProductImageFile(smallFile).valid).toBe(true);

      const oversizedFile = new File([new Uint8Array(100)], "huge.jpg", { type: "image/jpeg" });
      Object.defineProperty(oversizedFile, "size", {
        value: 8 * 1024 * 1024 + 1,
        configurable: true,
      });

      const result = validateProductImageFile(oversizedFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("8MB");
    });

    it("handles null or undefined input safely", () => {
      expect(validateProductImageFile(null).valid).toBe(false);
      expect(validateProductImageFile(undefined).valid).toBe(false);
    });
  });

  describe("3. Image Compression & Target Optimization", () => {
    it("exports target dimension 1200px and quality 0.82", () => {
      expect(TARGET_MAX_DIMENSION).toBe(1200);
      expect(DEFAULT_WEBP_QUALITY).toBe(0.82);
    });

    it("handles non-browser environment safely and returns valid File object", async () => {
      const sampleFile = new File([new Uint8Array(1024 * 100)], "sample.jpg", { type: "image/jpeg" });
      const result = await compressImageForUpload(sampleFile);

      expect(result.file).toBeDefined();
      expect(result.originalSize).toBe(sampleFile.size);
      expect(result.compressedSize).toBeGreaterThan(0);
    });
  });

  describe("4. Catalog Image Resolution Priority", () => {
    it("resolves primary product image_url first", () => {
      const resolved = resolveCatalogProductImage(
        { image_url: "https://db.com/primary.jpg" },
        { image_url: "https://db.com/override.jpg" },
      );
      expect(resolved).toBe("https://db.com/primary.jpg");
    });

    it("falls back to override image_url when primary is missing", () => {
      const resolved = resolveCatalogProductImage(
        { image_url: null },
        { image_url: "https://db.com/override.jpg" },
      );
      expect(resolved).toBe("https://db.com/override.jpg");
    });

    it("returns undefined when all image sources are absent", () => {
      const resolved = resolveCatalogProductImage(null, null);
      expect(resolved).toBeUndefined();
    });
  });

  describe("5. Public Catalog Grid & Table Eager Loading Flags", () => {
    it("CatalogProductGrid passes priority={idx < 4} to CatalogProductCard", () => {
      const gridPath = path.resolve(__dirname, "../src/features/catalog/CatalogProductGrid.tsx");
      const gridContent = fs.readFileSync(gridPath, "utf-8");
      expect(gridContent).toContain("priority={idx < 4}");
    });

    it("CatalogProductTable passes priority={idx < 4} to desktop table and mobile list rows", () => {
      const tablePath = path.resolve(__dirname, "../src/features/catalog/CatalogProductTable.tsx");
      const tableContent = fs.readFileSync(tablePath, "utf-8");
      expect(tableContent).toContain("priority={idx < 4}");
    });
  });
});

/**
 * DESEMBRE Partner Hub - Product Image Compression & Optimization Utility
 * 
 * Enforces:
 * - Max original size: 8MB
 * - Supported types: image/png, image/jpeg, image/webp
 * - Max dimension: 1200px (width/height maintaining aspect ratio)
 * - Format: WebP (quality 0.82)
 * - Graceful fallback to original file if browser environment lacks canvas support
 */

export const MAX_PRODUCT_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
export const ALLOWED_PRODUCT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const TARGET_MAX_DIMENSION = 1200; // 1200px max width/height
export const DEFAULT_WEBP_QUALITY = 0.82;
export const TARGET_MAX_FILE_BYTES = 500 * 1024; // 500KB ideal target

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export interface ImageCompressionResult {
  file: File;
  wasCompressed: boolean;
  originalSize: number;
  compressedSize: number;
  dimensions?: { width: number; height: number };
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Validates a product image file against allowed MIME types and max file size (8MB).
 */
export function validateProductImageFile(file: File | null | undefined): ImageValidationResult {
  if (!file) {
    return { valid: false, error: "Chưa chọn tệp ảnh." };
  }
  if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP.",
    };
  }
  if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
    return {
      valid: false,
      error: "Dung lượng ảnh vượt quá giới hạn 8MB.",
    };
  }
  return { valid: true };
}

/**
 * Compresses and resizes an image file in the browser before upload.
 * Scales down to max 1200x1200px and converts to WebP (quality 0.82).
 */
export async function compressImageForUpload(
  file: File,
  options?: CompressOptions,
): Promise<ImageCompressionResult> {
  const maxWidth = options?.maxWidth ?? TARGET_MAX_DIMENSION;
  const maxHeight = options?.maxHeight ?? TARGET_MAX_DIMENSION;
  const quality = options?.quality ?? DEFAULT_WEBP_QUALITY;

  const originalSize = file.size;

  // Non-browser or unsupported canvas environment fallback
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      file,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }

  return new Promise((resolve) => {
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          URL.revokeObjectURL(objectUrl);

          const { width, height } = img;

          // Compute new dimensions keeping aspect ratio
          const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
          const targetWidth = Math.max(1, Math.round(width * ratio));
          const targetHeight = Math.max(1, Math.round(height * ratio));

          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return resolve({
              file,
              wasCompressed: false,
              originalSize,
              compressedSize: originalSize,
              dimensions: { width, height },
            });
          }

          // Enable high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Convert to WebP blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return resolve({
                  file,
                  wasCompressed: false,
                  originalSize,
                  compressedSize: originalSize,
                  dimensions: { width: targetWidth, height: targetHeight },
                });
              }

              // Base file name without extension
              const rawName = file.name.replace(/\.[^/.]+$/, "");
              const cleanName = `${rawName.replace(/[^a-zA-Z0-9_-]/g, "_")}.webp`;

              const compressedFile = new File([blob], cleanName, {
                type: "image/webp",
                lastModified: Date.now(),
              });

              resolve({
                file: compressedFile,
                wasCompressed: true,
                originalSize,
                compressedSize: compressedFile.size,
                dimensions: { width: targetWidth, height: targetHeight },
              });
            },
            "image/webp",
            quality,
          );
        } catch (innerErr) {
          console.warn("[imageCompression] Canvas processing error:", innerErr);
          resolve({
            file,
            wasCompressed: false,
            originalSize,
            compressedSize: originalSize,
          });
        }
      };

      img.onerror = (imgErr) => {
        URL.revokeObjectURL(objectUrl);
        console.warn("[imageCompression] Failed to load image for compression:", imgErr);
        resolve({
          file,
          wasCompressed: false,
          originalSize,
          compressedSize: originalSize,
        });
      };

      img.src = objectUrl;
    } catch (outerErr) {
      console.warn("[imageCompression] Unexpected compression failure:", outerErr);
      resolve({
        file,
        wasCompressed: false,
        originalSize,
        compressedSize: originalSize,
      });
    }
  });
}

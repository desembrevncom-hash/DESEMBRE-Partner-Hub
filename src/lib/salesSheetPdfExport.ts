import React from "react";
import { pdf } from "@react-pdf/renderer";
import {
  ProductSalesSheetPDF,
  type ProductSalesSheetPdfData,
} from "@/components/admin/templates/ProductSalesSheetPDF";
import { generateSalesSheetFileName } from "@/lib/salesSheetVersionUtils";

/**
 * Directly generates and downloads a customer-facing Product Sales Sheet PDF file.
 * Does NOT invoke browser print dialog (window.print()).
 */
export async function exportProductSalesSheetPdf(
  data: ProductSalesSheetPdfData,
  fileName?: string,
): Promise<Blob> {
  const safeFileName = fileName || generateSalesSheetFileName(data.product.name);
  const element = React.createElement(ProductSalesSheetPDF, { data });
  const blob = await pdf(element as any).toBlob();

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return blob;
}

export type { ProductSalesSheetPdfData };

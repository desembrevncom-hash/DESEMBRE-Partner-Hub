import React, { useImperativeHandle, forwardRef } from "react";
import { FileDown } from "lucide-react";

interface A4PreviewFrameProps {
  htmlContent: string;
  title?: string;
  hideExportButton?: boolean;
  /** @deprecated Use hideExportButton */
  hidePrintButton?: boolean;
  onExportPdf?: () => void | Promise<void>;
  isExporting?: boolean;
}

export interface A4PreviewFrameRef {
  exportPdf: () => void | Promise<void>;
  /** @deprecated Backwards compatibility alias for exportPdf */
  print: () => void | Promise<void>;
}

export const A4PreviewFrame = forwardRef<A4PreviewFrameRef, A4PreviewFrameProps>(
  (
    {
      htmlContent,
      title = "Xem trước",
      hideExportButton,
      hidePrintButton,
      onExportPdf,
      isExporting = false,
    },
    ref,
  ) => {
    const shouldHideButton = hideExportButton ?? hidePrintButton ?? false;

    const handleExport = async () => {
      if (onExportPdf) {
        await onExportPdf();
      }
    };

    useImperativeHandle(ref, () => ({
      exportPdf: handleExport,
      print: handleExport,
    }));

    return (
      <div className="flex flex-col w-full h-full bg-slate-100 items-center overflow-y-auto p-5">
        {/* Top Action Bar */}
        {!shouldHideButton && (
          <div className="w-full max-w-[210mm] flex justify-between items-center mb-4 bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex flex-col">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                Xem trước thiết kế
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">{title}</span>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              aria-label="Xuất tài liệu PDF"
              title="Xuất tài liệu PDF"
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              {isExporting ? "ĐANG XUẤT PDF..." : "XUẤT PDF"}
            </button>
          </div>
        )}

        {/* A4 Preview Container - simulated shadow and sizing */}
        <div
          id="a4-print-area"
          className="bg-white shadow-xl mx-auto overflow-hidden relative border border-slate-200 rounded-sm mb-10 transition-all hover:shadow-2xl"
          style={{ width: "210mm", minHeight: "297mm", padding: "15mm" }}
        >
          {/* Style block inside preview frame to support local Google Fonts load */}
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
            rel="stylesheet"
          />
          <div
            className="prose prose-sm max-w-none text-slate-800"
            style={{ fontFamily: "'Inter', sans-serif" }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      </div>
    );
  },
);

A4PreviewFrame.displayName = "A4PreviewFrame";

import React, { useImperativeHandle, forwardRef, useState, useEffect, useRef } from "react";
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

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

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
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const updateWidth = () => {
        setContainerWidth(el.clientWidth);
      };

      updateWidth();

      const observer = new ResizeObserver(() => {
        updateWidth();
      });
      observer.observe(el);

      return () => {
        observer.disconnect();
      };
    }, []);

    const handleExport = async () => {
      if (onExportPdf) {
        await onExportPdf();
      }
    };

    useImperativeHandle(ref, () => ({
      exportPdf: handleExport,
      print: handleExport,
    }));

    // Calculate scaling ratio based on available width inside container padding (16px left + 16px right = 32px)
    const availableWidth = containerWidth > 0 ? Math.max(containerWidth - 32, 0) : A4_WIDTH_PX;
    const scale = Math.min(availableWidth / A4_WIDTH_PX, 1);
    const scaledWidth = Math.round(A4_WIDTH_PX * scale);
    const scaledHeight = Math.round(A4_HEIGHT_PX * scale);

    return (
      <div
        ref={containerRef}
        className="flex flex-col w-full h-full bg-slate-100 items-center overflow-y-auto p-4"
        data-testid="a4-preview-container"
        data-scale={scale}
      >
        {/* Top Action Bar */}
        {!shouldHideButton && (
          <div
            style={{ width: `${scaledWidth}px`, maxWidth: `${A4_WIDTH_PX}px` }}
            className="w-full flex justify-between items-center mb-4 bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200"
          >
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

        {/* Scaled A4 Outer Wrapper */}
        <div
          className="relative mb-10"
          style={{
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
            minHeight: `${scaledHeight}px`,
          }}
          data-testid="a4-scaled-wrapper"
        >
          {/* Unscaled 794x1123 A4 Page with CSS scale transform */}
          <div
            id="a4-print-area"
            className="bg-white shadow-xl overflow-hidden absolute top-0 left-0 border border-slate-200 rounded-sm transition-all hover:shadow-2xl"
            style={{
              width: `${A4_WIDTH_PX}px`,
              minHeight: `${A4_HEIGHT_PX}px`,
              padding: "15mm",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
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
      </div>
    );
  },
);

A4PreviewFrame.displayName = "A4PreviewFrame";

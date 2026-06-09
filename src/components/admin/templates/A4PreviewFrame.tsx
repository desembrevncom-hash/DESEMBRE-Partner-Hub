import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";

interface A4PreviewFrameProps {
  htmlContent: string;
  title?: string;
  hidePrintButton?: boolean;
}

export interface A4PreviewFrameRef {
  print: () => void;
}

export const A4PreviewFrame = forwardRef<A4PreviewFrameRef, A4PreviewFrameProps>(
  ({ htmlContent, title = "Xem trước", hidePrintButton = false }, ref) => {
    const handlePrint = () => {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Không thể mở cửa sổ in. Vui lòng tắt trình chặn popup trên trình duyệt.");
        return;
      }

      // Write full HTML structure inside popup print window
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <meta charset="utf-8" />
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
              body {
                margin: 0;
                padding: 0;
                background-color: #f1f5f9;
                font-family: 'Inter', sans-serif;
                display: flex;
                justify-content: center;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .a4-page {
                background: white;
                width: 210mm;
                min-height: 297mm;
                padding: 15mm;
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                box-sizing: border-box;
                margin: 20px auto;
              }
              @media print {
                body {
                  background: white;
                }
                .a4-page {
                  width: 210mm;
                  height: 297mm;
                  margin: 0;
                  padding: 15mm;
                  box-shadow: none;
                  page-break-after: always;
                }
                @page {
                  size: A4;
                  margin: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="a4-page">
              ${htmlContent}
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 1000);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    };

    useImperativeHandle(ref, () => ({
      print: handlePrint,
    }));

    return (
      <div className="flex flex-col w-full h-full bg-slate-100 items-center overflow-y-auto p-5">
        {/* Top Action Bar */}
        {!hidePrintButton && (
          <div className="w-full max-w-[210mm] flex justify-between items-center mb-4 bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-200 print:hidden">
            <div className="flex flex-col">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                Xem trước thiết kế
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">{title}</span>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm hover:shadow transition-all"
            >
              <Printer className="w-4 h-4" />
              IN BẢN MẪU / XUẤT PDF
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

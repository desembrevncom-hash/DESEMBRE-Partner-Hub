import React, { useRef } from "react";
import { Printer, Download } from "lucide-react";

interface A4PreviewFrameProps {
  htmlContent: string;
  title?: string;
}

export const A4PreviewFrame: React.FC<A4PreviewFrameProps> = ({ htmlContent, title = "Preview" }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    // In a real scenario we could open a new window or trigger window.print
    // but the easiest robust way is to just call window.print and use a print CSS media query
    // that hides everything else except the print area.
    window.print();
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-100 items-center overflow-y-auto p-4">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #a4-print-area, #a4-print-area * {
              visibility: visible;
            }
            #a4-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 210mm;
              margin: 0;
              padding: 0;
              box-shadow: none;
            }
            @page {
              size: A4;
              margin: 0;
            }
          }
        `}
      </style>
      
      <div className="w-full max-w-[210mm] flex justify-between items-center mb-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 print:hidden">
        <h3 className="font-bold text-slate-700 text-sm">{title}</h3>
        <div className="flex gap-2">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* A4 Container - approx 210x297mm */}
      <div 
        id="a4-print-area"
        className="bg-white shadow-lg mx-auto overflow-hidden relative"
        style={{ width: "210mm", minHeight: "297mm", padding: "10mm" }}
      >
        <div 
          className="prose prose-sm max-w-none text-slate-800"
          dangerouslySetInnerHTML={{ __html: htmlContent }} 
        />
      </div>
    </div>
  );
};

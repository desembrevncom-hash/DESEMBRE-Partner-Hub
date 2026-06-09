import React, { useMemo } from "react";
import { A4PreviewFrame } from "./A4PreviewFrame";
import {
  renderTemplate,
  getTemplateSampleData,
  validateTemplateVariables,
} from "@/lib/documentTemplates";

interface DocumentTemplatePreviewProps {
  htmlTemplate: string;
  templateType: string;
}

export const DocumentTemplatePreview: React.FC<DocumentTemplatePreviewProps> = ({
  htmlTemplate,
  templateType,
}) => {
  const sampleData = useMemo(() => getTemplateSampleData(templateType), [templateType]);

  const renderedHtml = useMemo(() => {
    return renderTemplate(htmlTemplate, sampleData);
  }, [htmlTemplate, sampleData]);

  const validation = useMemo(() => {
    return validateTemplateVariables(htmlTemplate, templateType);
  }, [htmlTemplate, templateType]);

  return (
    <div className="flex flex-col w-full h-full">
      {!validation.valid && (
        <div className="bg-amber-50 text-amber-800 p-3 text-sm border-b border-amber-200">
          <span className="font-bold">Cảnh báo:</span> Template đang thiếu các biến bắt buộc:{" "}
          {validation.missing.map((m) => `{{${m}}}`).join(", ")}
        </div>
      )}
      <div className="flex-1 overflow-hidden bg-slate-100">
        <A4PreviewFrame htmlContent={renderedHtml} title={`Preview: ${templateType}`} />
      </div>
    </div>
  );
};

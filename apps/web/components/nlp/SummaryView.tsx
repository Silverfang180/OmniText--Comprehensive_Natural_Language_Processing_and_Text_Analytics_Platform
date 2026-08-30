import React from "react";
import { FileText } from "lucide-react";

interface SummaryViewProps {
  summaryText: string;
  originalText: string;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ summaryText, originalText }) => {
  const originalWordCount = originalText.trim().split(/\s+/).length;
  const summaryWordCount = summaryText.trim().split(/\s+/).length;
  const compressionRatio = originalWordCount > 0 
    ? Math.round((1 - summaryWordCount / originalWordCount) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-accent-primary/5 border border-accent-primary/15 text-text-primary">
        <p className="leading-relaxed whitespace-pre-wrap">{summaryText}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-raised border border-border-default text-xs text-text-secondary">
          <FileText className="w-3.5 h-3.5 text-text-secondary" />
          <span>Original: {originalWordCount} words</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-raised border border-border-default text-xs text-text-secondary">
          <span>Summary: {summaryWordCount} words</span>
        </div>
        {compressionRatio > 0 && (
          <div className="px-2.5 py-1 rounded-lg bg-success/15 border border-success/20 text-xs font-semibold text-success">
            {compressionRatio}% shorter
          </div>
        )}
      </div>
    </div>
  );
};

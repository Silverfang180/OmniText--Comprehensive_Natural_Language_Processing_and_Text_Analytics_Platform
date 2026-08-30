import React from "react";
import { MessageSquareCode, FileText, Sparkles } from "lucide-react";
import { EvidenceTag } from "./EvidenceTag";

interface QaAnswerCardProps {
  question: string;
  answer: string;
  confidence: number;
  sourcePassage: string;
  start: number;
  end: number;
  modelId: string;
  latencyMs?: number;
  documentTitle?: string;
  matchScore?: number;
}

export const QaAnswerCard: React.FC<QaAnswerCardProps> = ({
  question,
  answer,
  confidence,
  sourcePassage,
  start,
  end,
  modelId,
  latencyMs = 124.0, // default fallback if not present
  documentTitle,
  matchScore,
}) => {
  // Highlight the extracted answer span inside the source passage using --accent-secondary (ink-teal)
  const renderHighlightedContext = () => {
    if (start < 0 || end <= start || end > sourcePassage.length) {
      return <span>{sourcePassage}</span>;
    }
    const before = sourcePassage.slice(0, start);
    const answerSpan = sourcePassage.slice(start, end);
    const after = sourcePassage.slice(end);

    return (
      <span className="leading-relaxed">
        {before}
        <mark className="bg-accent-secondary/15 text-text-primary px-1 py-0.5 rounded font-semibold border-b-2 border-accent-secondary/60 decoration-clone">
          {answerSpan}
        </mark>
        {after}
      </span>
    );
  };

  return (
    <div className="bg-surface border border-border-default rounded-xl overflow-hidden flex flex-col sm:flex-row">
      {/* Left Column: QA Content (roughly 3/4 width) */}
      <div className="flex-1 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border-default/50 pb-2">
          <span className="text-xs font-bold text-accent-primary flex items-center gap-1.5 uppercase tracking-wider">
            <MessageSquareCode className="w-4 h-4" /> Extracted Answer
          </span>
        </div>

        <div className="p-3.5 bg-accent-secondary/5 border border-accent-secondary/15 rounded-lg text-sm font-semibold text-text-primary">
          {answer}
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
            Source Reference Passage
          </span>
          <div className="text-xs text-text-secondary leading-relaxed bg-surface/50 p-3 rounded-lg border border-border-default/60">
            {renderHighlightedContext()}
          </div>
        </div>

        {(documentTitle || matchScore !== undefined) && (
          <div className="flex items-center gap-3 text-[10px] text-text-secondary pt-1 border-t border-border-default/40">
            {documentTitle && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3 text-text-secondary" /> {documentTitle}
              </span>
            )}
            {matchScore !== undefined && (
              <span className="flex items-center gap-1 text-accent-secondary">
                <Sparkles className="w-3 h-3" /> {(matchScore * 100).toFixed(0)}% Similarity match
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Evidence Rail */}
      <div className="border-t sm:border-t-0 sm:border-l border-border-default px-5 py-4 sm:py-5 flex flex-col items-start sm:items-end gap-3 sm:w-48 shrink-0 bg-surface">
        <div className="flex flex-col items-start sm:items-end gap-1">
          <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold font-sans">Model</span>
          <EvidenceTag label={modelId} className="select-all break-all sm:text-right" />
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1">
          <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold font-sans">Latency</span>
          <EvidenceTag label={`${latencyMs.toFixed(1)}ms`} />
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1">
          <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold font-sans">Confidence</span>
          <EvidenceTag label={confidence.toFixed(2)} />
        </div>
      </div>
    </div>
  );
};

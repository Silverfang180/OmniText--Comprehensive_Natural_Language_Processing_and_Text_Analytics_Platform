import React from "react";
import { EvidenceTag } from "./EvidenceTag";

interface TaskResultCardProps {
  title: string;
  modelId: string;
  latencyMs: number;
  isInterim?: boolean;
  confidence?: number;
  children: React.ReactNode;
}

export const TaskResultCard: React.FC<TaskResultCardProps> = ({
  title,
  modelId,
  latencyMs,
  isInterim = true,
  confidence,
  children,
}) => {
  return (
    <div className="bg-surface border border-border-default rounded-xl overflow-hidden flex flex-col sm:flex-row">
      {/* Left Column: Result Content (roughly 3/4 width) */}
      <div className="flex-1 p-5 space-y-4">
        <h3 className="font-semibold text-text-primary text-sm tracking-tight">{title}</h3>
        <div className="text-sm leading-relaxed text-text-primary">
          {children}
        </div>
      </div>

      {/* Right Column: Evidence Metadata Rail (roughly 1/4 width, right-aligned) */}
      <div className="border-t sm:border-t-0 sm:border-l border-border-default px-5 py-4 sm:py-5 flex flex-col items-start sm:items-end gap-3 sm:w-48 shrink-0">
        <div className="flex flex-col items-start sm:items-end gap-1">
          <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold font-sans">Model</span>
          <EvidenceTag label={modelId} className="select-all break-all sm:text-right" />
          {isInterim && (
            <span className="text-[9px] font-sans font-bold tracking-wide uppercase px-1 py-0.5 rounded bg-info/10 text-info border border-info/20 mt-0.5">
              Interim Default
            </span>
          )}
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1">
          <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold font-sans">Latency</span>
          <EvidenceTag label={`${latencyMs.toFixed(1)}ms`} />
        </div>

        {confidence !== undefined && (
          <div className="flex flex-col items-start sm:items-end gap-1">
            <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold font-sans">Confidence</span>
            <EvidenceTag label={confidence.toFixed(2)} />
          </div>
        )}
      </div>
    </div>
  );
};

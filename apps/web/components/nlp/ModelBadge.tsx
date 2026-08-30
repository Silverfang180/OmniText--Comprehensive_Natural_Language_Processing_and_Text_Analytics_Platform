import React from "react";
import { Cpu } from "lucide-react";

interface ModelBadgeProps {
  modelId: string;
  isInterim?: boolean;
}

export const ModelBadge: React.FC<ModelBadgeProps> = ({ modelId, isInterim = true }) => {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-mono bg-surface-raised border border-border-default">
      <Cpu className="w-3 h-3 text-text-secondary" />
      <span className="text-text-secondary select-all">{modelId}</span>
      {isInterim && (
        <span className="text-[10px] font-sans font-semibold tracking-wide uppercase px-1 py-0.25 rounded-lg bg-info/10 text-info border border-info/20 ml-1">
          Interim Default
        </span>
      )}
    </div>
  );
};

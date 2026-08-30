import React from "react";
import { EvidenceTag } from "./EvidenceTag";

interface Entity {
  entity: string;
  label: string;
  start: number;
  end: number;
  confidence: number;
}

interface NerHighlightViewProps {
  text: string;
  entities: Entity[];
}

export const NerHighlightView: React.FC<NerHighlightViewProps> = ({ text, entities }) => {
  if (!entities || entities.length === 0) {
    return <p className="leading-relaxed whitespace-pre-wrap">{text}</p>;
  }

  // Sort entities by start index to process sequentially
  const sortedEntities = [...entities].sort((a, b) => a.start - b.start);

  // Filter out any overlapping entities to avoid indexing bugs
  const cleanEntities: Entity[] = [];
  let lastEnd = 0;
  for (const ent of sortedEntities) {
    if (ent.start >= lastEnd && ent.end <= text.length && ent.start < ent.end) {
      cleanEntities.push(ent);
      lastEnd = ent.end;
    }
  }

  // Construct visual segments
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  cleanEntities.forEach((ent, i) => {
    // Add text preceding the entity
    if (ent.start > lastIndex) {
      segments.push(
        <span key={`text-${i}`} className="whitespace-pre-wrap">
          {text.substring(lastIndex, ent.start)}
        </span>
      );
    }

    // Add entity span using --accent-secondary (ink-teal) and custom tooltip showing confidence as EvidenceTag
    segments.push(
      <span
        key={`ent-${i}`}
        className="relative group inline-flex items-baseline gap-1 mx-0.5 px-1.5 py-0.5 rounded-lg border text-xs font-semibold bg-accent-secondary/10 text-accent-secondary border-accent-secondary/20 cursor-help"
      >
        <span>{text.substring(ent.start, ent.end)}</span>
        <span className="text-[9px] uppercase tracking-wider opacity-70 font-mono">{ent.label}</span>
        
        {/* Tooltip displaying confidence as an EvidenceTag */}
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-surface border border-border-default shadow-lg text-[10px] text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 flex items-center gap-1.5">
          <span>Confidence:</span>
          <EvidenceTag label={ent.confidence.toFixed(2)} />
        </span>
      </span>
    );

    lastIndex = ent.end;
  });

  // Add remaining text following the last entity
  if (lastIndex < text.length) {
    segments.push(
      <span key="text-last" className="whitespace-pre-wrap">
        {text.substring(lastIndex)}
      </span>
    );
  }

  return (
    <div className="leading-relaxed p-4 rounded-xl bg-surface border border-border-default/50">
      {segments}
    </div>
  );
};

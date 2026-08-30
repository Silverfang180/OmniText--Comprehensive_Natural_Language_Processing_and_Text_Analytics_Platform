import React from "react";

interface EvidenceTagProps {
  label: string;
  className?: string;
}

export const EvidenceTag: React.FC<EvidenceTagProps> = ({ label, className = "" }) => {
  return (
    <span className={`font-mono text-xs text-text-secondary ${className}`}>
      {label}
    </span>
  );
};

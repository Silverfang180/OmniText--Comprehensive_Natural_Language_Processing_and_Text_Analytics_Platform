import React from "react";
import { Smile, Frown, Meh } from "lucide-react";

interface SentimentBadgeProps {
  label: string;
  score: number;
}

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({ label, score }) => {
  const isPositive = label.toUpperCase().includes("POS");
  const isNegative = label.toUpperCase().includes("NEG");
  const percentage = Math.round(score * 100);

  let badgeColorClass = "bg-text-secondary/10 border-text-secondary/20 text-text-secondary";
  let Icon = Meh;

  if (isPositive) {
    badgeColorClass = "bg-success/10 border-success/20 text-success";
    Icon = Smile;
  } else if (isNegative) {
    badgeColorClass = "bg-danger/10 border-danger/20 text-danger";
    Icon = Frown;
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-semibold ${badgeColorClass}`}>
        <Icon className="w-4 h-4" />
        <span className="tracking-wide uppercase">{label}</span>
      </div>
      <div className="text-xs text-text-secondary">
        Confidence score: <span className="font-mono font-medium text-text-primary">{percentage}%</span>
      </div>
    </div>
  );
};

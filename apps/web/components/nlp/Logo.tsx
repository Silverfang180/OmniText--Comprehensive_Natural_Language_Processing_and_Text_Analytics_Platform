import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 32 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Connection Lines */}
      {/* Top-left node (cx=40, cy=35) to central node (cx=60, cy=60) */}
      <line x1="40" y1="35" x2="60" y2="60" stroke="currentColor" strokeWidth="1.5" className="opacity-40" />
      {/* Top-left node (cx=40, cy=35) to middle-left node (cx=32, cy=65) */}
      <line x1="40" y1="35" x2="32" y2="65" stroke="currentColor" strokeWidth="1.5" className="opacity-40" />
      {/* Middle-right node (cx=88, cy=55) to central node (cx=60, cy=60) */}
      <line x1="88" y1="55" x2="60" y2="60" stroke="currentColor" strokeWidth="1.5" className="opacity-40" />
      {/* Bottom-right node (cx=92, cy=72) to central node (cx=60, cy=60) */}
      <line x1="92" y1="72" x2="60" y2="60" stroke="currentColor" strokeWidth="1.5" className="opacity-40" />
      {/* Bottom node (cx=66, cy=105) to central node (cx=60, cy=60) */}
      <line x1="66" y1="105" x2="60" y2="60" stroke="currentColor" strokeWidth="1.5" className="opacity-40" />

      {/* Nodes */}
      {/* Central terracotta node */}
      <circle cx="60" cy="60" r="8" fill="#C4623F" />

      {/* Connected nodes */}
      {/* Top-left node */}
      <circle cx="40" cy="35" r="4.5" fill="currentColor" />
      {/* Middle-left node (connected to top-left) */}
      <circle cx="32" cy="65" r="3" fill="currentColor" />
      {/* Middle-right node */}
      <circle cx="88" cy="55" r="3.5" fill="currentColor" />
      {/* Bottom-right node */}
      <circle cx="92" cy="72" r="5.5" fill="currentColor" />
      {/* Bottom node */}
      <circle cx="66" cy="105" r="4.5" fill="currentColor" />

      {/* Free-floating / Isolated nodes */}
      {/* Top-right node */}
      <circle cx="80" cy="20" r="3.5" fill="currentColor" />
      {/* Bottom-left-middle node */}
      <circle cx="48" cy="90" r="4" fill="currentColor" />
    </svg>
  );
};

import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "transparent",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 120 120"
          style={{ display: "block" }}
        >
          {/* Connection Lines */}
          <line x1="40" y1="35" x2="60" y2="60" stroke="#6B6862" strokeWidth="2" opacity="0.45" />
          <line x1="40" y1="35" x2="32" y2="65" stroke="#6B6862" strokeWidth="2" opacity="0.45" />
          <line x1="88" y1="55" x2="60" y2="60" stroke="#6B6862" strokeWidth="2" opacity="0.45" />
          <line x1="92" y1="72" x2="60" y2="60" stroke="#6B6862" strokeWidth="2" opacity="0.45" />
          <line x1="66" y1="105" x2="60" y2="60" stroke="#6B6862" strokeWidth="2" opacity="0.45" />

          {/* Central terracotta node */}
          <circle cx="60" cy="60" r="9" fill="#C4623F" />

          {/* Connected nodes */}
          <circle cx="40" cy="35" r="5.5" fill="#1C1B1F" />
          <circle cx="32" cy="65" r="4" fill="#1C1B1F" />
          <circle cx="88" cy="55" r="4.5" fill="#1C1B1F" />
          <circle cx="92" cy="72" r="7" fill="#1C1B1F" />
          <circle cx="66" cy="105" r="5.5" fill="#1C1B1F" />

          {/* Free-floating / Isolated nodes */}
          <circle cx="80" cy="20" r="4.5" fill="#1C1B1F" />
          <circle cx="48" cy="90" r="5" fill="#1C1B1F" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}

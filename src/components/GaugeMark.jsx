// Gauge + checkmark brand mark, recreated as inline SVG from the official
// Trooth.app logo (green gauge arc whose needle is a checkmark).
// The GitHub connector stores file content as text, so raster logo uploads
// corrupt; this vector mark is the shipped logo asset.
export default function GaugeMark({ height = 30 }) {
  return (
    <svg
      viewBox="0 0 640 215"
      height={height}
      width={Math.round((height * 640) / 215)}
      role="img"
      aria-label="Trooth gauge mark"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="trooth-needle" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0B6E1E" />
          <stop offset="0.55" stopColor="#2DBE3B" />
          <stop offset="1" stopColor="#46D62E" />
        </linearGradient>
      </defs>
      <path d="M 164.4 199.0 A 156 156 0 0 1 169.0 166.9 L 195.3 173.5 A 129 129 0 0 0 191.5 200.1 Z" fill="#042A0A" />
      <path d="M 162.1 152.0 A 167 167 0 0 1 176.5 120.4 L 208.3 139.1 A 130 130 0 0 0 197.1 163.7 Z" fill="#074113" />
      <path d="M 175.5 104.1 A 176 176 0 0 1 199.6 76.4 L 230.7 109.6 A 131 131 0 0 0 212.9 130.2 Z" fill="#0A581B" />
      <path d="M 205.2 61.7 A 184 184 0 0 1 237.4 41.0 L 260.9 87.7 A 131 131 0 0 0 237.8 102.5 Z" fill="#0D6F24" />
      <path d="M 248.4 30.8 A 188 188 0 0 1 286.1 19.7 L 296.2 75.3 A 132 132 0 0 0 269.9 83.1 Z" fill="#1C912A" />
      <path d="M 300.2 16.0 A 190 190 0 0 1 339.8 16.0 L 333.8 73.7 A 132 132 0 0 0 306.2 73.7 Z" fill="#38BF2C" />
      <path d="M 353.9 19.7 A 188 188 0 0 1 391.6 30.8 L 370.1 83.1 A 132 132 0 0 0 343.8 75.3 Z" fill="#3BC62E" />
      <path d="M 402.6 41.0 A 184 184 0 0 1 434.8 61.7 L 402.2 102.5 A 131 131 0 0 0 379.1 87.7 Z" fill="#24A62C" />
      <path d="M 440.4 76.4 A 176 176 0 0 1 464.5 104.1 L 427.1 130.2 A 131 131 0 0 0 409.3 109.6 Z" fill="#147E25" />
      <path d="M 463.5 120.4 A 167 167 0 0 1 477.9 152.0 L 442.9 163.7 A 130 130 0 0 0 431.7 139.1 Z" fill="#0B4F16" />
      <path d="M 471.0 166.9 A 156 156 0 0 1 475.6 199.0 L 448.5 200.1 A 129 129 0 0 0 444.7 173.5 Z" fill="#032008" />
      <polyline
        points="298,124 366,190 522,16"
        fill="none"
        stroke="url(#trooth-needle)"
        strokeWidth="30"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

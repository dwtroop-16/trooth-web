import { css } from "../helpers.js";

export default function Toast({ text }) {
  return (
    <div style={css("position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:50;background:var(--ink);color:var(--paper);border-radius:var(--radius);padding:10px 16px;font-size:13.5px;display:flex;align-items:center;gap:10px;box-shadow:0 16px 40px -18px rgba(0,0,0,0.7);animation:vToast 2.8s ease forwards;")}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6FCF97" strokeWidth="2.4">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
      {text}
    </div>
  );
}

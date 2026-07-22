import { css } from "../helpers.js";

export default function Toast({ text }) {
  return (
    <div style={css("position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:50;background:#1A1712;color:#F4F0E8;border-radius:11px;padding:14px 20px;font-size:14px;display:flex;align-items:center;gap:10px;box-shadow:0 16px 40px -18px rgba(0,0,0,0.7);animation:vToast 2.8s ease forwards;")}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6FCF97" strokeWidth="2.4">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
      {text}
    </div>
  );
}

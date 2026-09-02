// History-path routing for the Vite SPA. Netlify already falls back to index.html.

export function parsePath(pathname) {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  if (path === "/") return { view: "home" };
  if (path === "/method") return { view: "method" };
  if (path === "/changelog") return { view: "changelog" };
  let m = path.match(/^\/person\/([^/]+)$/);
  if (m) return { view: "profile", speakerId: decodeURIComponent(m[1]) };
  m = path.match(/^\/claim\/([^/]+)$/);
  if (m) return { view: "prediction", forecastId: decodeURIComponent(m[1]) };
  return { view: "home" };
}

export function pathFor(view, id) {
  if (view === "method") return "/method";
  if (view === "changelog") return "/changelog";
  if (view === "profile") return `/person/${encodeURIComponent(id)}`;
  if (view === "prediction") return `/claim/${encodeURIComponent(id)}`;
  return "/";
}

export function normalizeDomain(label) {
  if (!label) return "All";
  if (label === "Financial") return "Finance";
  return label;
}

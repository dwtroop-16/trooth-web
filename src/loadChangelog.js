import { publicChangelogEntries } from "./changelogPublic.js";

const files = import.meta.glob("./changelog/*.json", { eager: true });

export function loadChangelogDays() {
  return Object.entries(files)
    .map(([path, mod]) => {
      const m = path.match(/(\d{4}-\d{2}-\d{2})\.json$/);
      if (!m) return null;
      const data = mod && typeof mod === "object" && "default" in mod ? mod.default : mod;
      return { ...(data && typeof data === "object" ? data : {}), date: m[1] };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function loadPublicChangelog() {
  return publicChangelogEntries(loadChangelogDays());
}

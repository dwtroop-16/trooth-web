// Avatar initials (Card QA P3, 2026-10-29). An explicit `initials` override in speakers-v1.json
// wins. Otherwise: strip quotes/punctuation and generational suffixes, then first word + surname.
// Surname particles (Van, Von, De, ...) keep their letter: Scott Van Pelt -> SVP.
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const PARTICLES = new Set(["van", "von", "de", "del", "della", "der", "di", "da", "du", "la", "le", "st", "mac"]);

export function initialsFromName(name, override) {
  const o = typeof override === "string" ? override.replace(/[^A-Za-z]/g, "").toUpperCase() : "";
  if (o) return o.slice(0, 3);
  const words = String(name || "")
    .replace(/\(.*?\)/g, " ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z\s'-]/g, " ")
    .replace(/['"]/g, "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter((w, i, a) => !(i > 0 && i === a.length - 1 && SUFFIXES.has(w.toLowerCase())));
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  let i = words.length - 1;
  while (i - 1 > 0 && PARTICLES.has(words[i - 1].toLowerCase())) i -= 1;
  return (words[0][0] + words.slice(i).map((w) => w[0]).join("")).toUpperCase();
}

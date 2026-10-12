// Speaker initials for the neutral avatar. Built from the name's letters only: quotes, nicknames in
// quotes or parentheses, and punctuation never become initials ('"Stanford Steve" Coughlin' -> "SC",
// not '"C'). Letters with diacritics are kept (Unicode letter class).

const LETTER = /[\p{L}\p{N}]/u;

function firstLetter(word) {
  for (const ch of word) if (LETTER.test(ch)) return ch;
  return "";
}

export function speakerInitials(name) {
  const words = String(name || "")
    .replace(/\(.*?\)/g, " ")
    // Apostrophes inside a word are dropped, not split on (O’Neil -> ONeil).
    .replace(/(\p{L})['\u2019](\p{L})/gu, "$1$2")
    .replace(/[\u2018\u2019\u201C\u201D"'`.,;:!?()[\]{}<>/\\|_*+=~^%$#@&]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => firstLetter(w));
  if (words.length === 0) return "?";
  if (words.length === 1) {
    const letters = [...words[0]].filter((ch) => LETTER.test(ch));
    return letters.slice(0, 2).join("").toUpperCase();
  }
  return (firstLetter(words[0]) + firstLetter(words[words.length - 1])).toUpperCase();
}

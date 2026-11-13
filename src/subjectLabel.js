// Displayed subject label. The registry (SUBJECTS) is the source of truth.
// A forecast row's own subject.label is used only when that id is not in the registry.

export function displayedSubjectLabel(subject, subjects) {
  const id = subject?.id == null ? "" : String(subject.id);
  const table = subjects && typeof subjects === "object" && !Array.isArray(subjects) ? subjects : null;
  if (id && table && Object.prototype.hasOwnProperty.call(table, id)) {
    const label = table[id]?.label;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  const row = typeof subject?.label === "string" ? subject.label.trim() : "";
  return row || id;
}

/** Picks one spelling per person so "jordan" and "Jordan" are never two people. */
export function canonicalOwner(name: string, known: string[]): string {
  const trimmed = (name ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "Unassigned";
  const lower = trimmed.toLowerCase();
  if (lower === "unassigned") return "Unassigned";
  const hit = known.find((k) => k.trim().toLowerCase() === lower);
  if (hit) return hit.trim();
  if (trimmed === trimmed.toLowerCase() || trimmed === trimmed.toUpperCase()) {
    return trimmed.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return trimmed;
}

/** Best display name among spellings that differ only by case. */
export function pickDisplayName(variants: string[]): string {
  return (
    variants.find((v) => v.trim() && v.trim()[0] === v.trim()[0].toUpperCase() && v.trim() !== v.trim().toUpperCase()) ??
    variants[0]
  ).trim();
}

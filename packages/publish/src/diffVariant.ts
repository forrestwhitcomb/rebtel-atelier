import type { PropValue, TokenRef, VariantProps } from "@rebtel-atelier/spec";

function isTokenRef(v: unknown): v is TokenRef {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "token" in (v as object) &&
    typeof (v as { token: unknown }).token === "string"
  );
}

function stringifyForDiff(v: PropValue): string {
  if (isTokenRef(v)) return v.token;
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export type VariantDiffEntry =
  | { kind: "added"; key: string; after: string }
  | { kind: "removed"; key: string; before: string }
  | { kind: "changed"; key: string; before: string; after: string };

/**
 * Structural diff between a variant's previous published state and its
 * next published state. Used by commit-message and PR-body templates to
 * render an engineer-readable change summary.
 *
 * Values are normalized to strings for display (token refs collapse to
 * their dot-path). No attempt to diff inside nested objects or arrays —
 * those render whole-value changes.
 */
export function diffVariantProps(before: VariantProps, after: VariantProps): VariantDiffEntry[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const entries: VariantDiffEntry[] = [];
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    const bExists = Object.prototype.hasOwnProperty.call(before, key);
    const aExists = Object.prototype.hasOwnProperty.call(after, key);
    if (aExists && !bExists) {
      entries.push({ kind: "added", key, after: stringifyForDiff(a as PropValue) });
    } else if (!aExists && bExists) {
      entries.push({ kind: "removed", key, before: stringifyForDiff(b as PropValue) });
    } else if (stringifyForDiff(a as PropValue) !== stringifyForDiff(b as PropValue)) {
      entries.push({
        kind: "changed",
        key,
        before: stringifyForDiff(b as PropValue),
        after: stringifyForDiff(a as PropValue),
      });
    }
  }
  // Stable alpha order — deterministic commit/PR bodies.
  entries.sort((x, y) => x.key.localeCompare(y.key));
  return entries;
}

/** Render a single diff entry as a single-line bullet. */
export function formatDiffLine(entry: VariantDiffEntry): string {
  switch (entry.kind) {
    case "added":
      return `Added \`${entry.key}\` with value \`${entry.after}\``;
    case "removed":
      return `Removed \`${entry.key}\` (was \`${entry.before}\`)`;
    case "changed":
      return `\`${entry.key}\`: \`${entry.before}\` → \`${entry.after}\``;
  }
}

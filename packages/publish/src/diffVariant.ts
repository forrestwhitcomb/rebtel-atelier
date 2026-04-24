import type {
  AxisOverride,
  ComponentOverrideSnapshot,
  PropValue,
  TokenRef,
} from "@rebtel-atelier/spec";
import { serializeAxisSelection } from "./axisSlug.js";

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

/** Per-axis-combination diff entry. */
export interface AxisOverrideDiff {
  axisSelection: Record<string, string>;
  /** Pretty-form slug for display. */
  slug: string;
  entries: VariantDiffEntry[];
}

function axisSelectionsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

/**
 * Diff a single prop bag — used by callers that already know they're
 * looking at two snapshots of the same axis combination.
 */
export function diffPropBags(
  before: Record<string, PropValue>,
  after: Record<string, PropValue>,
): VariantDiffEntry[] {
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
  entries.sort((x, y) => x.key.localeCompare(y.key));
  return entries;
}

/**
 * Diff two component override snapshots. Returns one AxisOverrideDiff
 * per changed (or added / removed) axis combination. State overrides
 * are reported separately.
 */
export function diffOverrideSnapshots(
  before: ComponentOverrideSnapshot,
  after: ComponentOverrideSnapshot,
): { axes: AxisOverrideDiff[]; states: { state: string; entries: VariantDiffEntry[] }[] } {
  const axes: AxisOverrideDiff[] = [];

  // Walk every axisSelection that appears in either snapshot. Match
  // entries by deep-equality of the selection record.
  const allSelections: AxisOverride[] = [];
  for (const o of before.axisOverrides) allSelections.push(o);
  for (const o of after.axisOverrides) {
    if (!allSelections.some((x) => axisSelectionsEqual(x.axisSelection, o.axisSelection))) {
      allSelections.push(o);
    }
  }

  for (const sel of allSelections) {
    const b = before.axisOverrides.find((x) =>
      axisSelectionsEqual(x.axisSelection, sel.axisSelection),
    );
    const a = after.axisOverrides.find((x) =>
      axisSelectionsEqual(x.axisSelection, sel.axisSelection),
    );
    const entries = diffPropBags(b?.props ?? {}, a?.props ?? {});
    if (entries.length === 0) continue;
    axes.push({
      axisSelection: { ...sel.axisSelection },
      slug: serializeAxisSelection(sel.axisSelection, "pretty") || "(default)",
      entries,
    });
  }

  const states: { state: string; entries: VariantDiffEntry[] }[] = [];
  const allStates = new Set<string>([
    ...before.stateOverrides.map((s) => s.state),
    ...after.stateOverrides.map((s) => s.state),
  ]);
  for (const state of allStates) {
    const b = before.stateOverrides.find((s) => s.state === state);
    const a = after.stateOverrides.find((s) => s.state === state);
    const entries = diffPropBags(b?.props ?? {}, a?.props ?? {});
    if (entries.length === 0) continue;
    states.push({ state, entries });
  }

  return { axes, states };
}

/** Render a single diff entry as a one-line bullet. */
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

// Backwards-compatible export — the original `diffVariantProps` is now
// `diffPropBags`. Re-exported under the old name so the route's call
// site doesn't churn during the chunk-2 transition.
export const diffVariantProps = diffPropBags;

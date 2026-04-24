import type { Component, Instance, PropValue, TokenRef } from "@rebtel-atelier/spec";
import { publishedSnapshotAtVersion } from "@rebtel-atelier/spec";

function isTokenRef(v: unknown): v is TokenRef {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "token" in (v as object) &&
    typeof (v as { token: unknown }).token === "string"
  );
}

function valuesEqual(a: PropValue, b: PropValue): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object") return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

/**
 * Format a single prop value as a JSX attribute value. Returns the text that
 * goes after `=` — already wrapped in `{...}`, `"..."`, or a bare identifier.
 * Returns null for boolean `true` which is rendered as a bare attribute.
 */
function formatPropValue(v: PropValue): string | null {
  if (v === true) return null;
  if (v === false) return "{false}";
  if (v === null) return "{null}";
  if (isTokenRef(v)) return JSON.stringify(v.token);
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return `{${v}}`;
  if (typeof v === "boolean") return null;
  // Arrays / nested objects — emit as a JSON literal inside braces. Engineers
  // will likely reshape these, but at least the structure is preserved.
  return `{${JSON.stringify(v)}}`;
}

export interface JsxSnippet {
  /** Full snippet including component name and all props. */
  text: string;
  /** Just the prop list, key-by-key — useful for copy sub-regions. */
  props: { key: string; formatted: string | null }[];
}

/**
 * Build the handoff JSX for an instance. Shape:
 *
 *   <ComponentName
 *     variant="..."
 *     overrideKey="overrideValue"
 *     ...
 *   />
 *
 * Only instance-level overrides that differ from the resolved variant's
 * published state become explicit props; everything else cascades.
 *
 * Token refs render as their dot-path string (e.g. `bg="color.card-bg"`).
 * The engineer's codebase can translate that to whatever token import
 * shape it uses — we don't assume one.
 *
 * v4 note: chunk 2 still emits a single `variant="..."` prop synthesized
 * from the instance's axisSelection (single-axis components → the value;
 * multi-axis → "axis1=v1+axis2=v2"). 3.5b decomposes this into one prop
 * per axis (`<Button style="primary" size="md" />`).
 */
export function buildJsxSnippet(component: Component, instance: Instance): JsxSnippet {
  const snapshot = publishedSnapshotAtVersion(component, instance.variantVersion);

  // Aggregate matching axis-override props at the instance's pinned
  // version. Skip overrides whose axisSelection isn't a subset of the
  // instance's selection — same matching rule as the resolver.
  const matchingAxisProps: Record<string, PropValue> = {};
  for (const o of snapshot.axisOverrides) {
    let matches = true;
    for (const [k, v] of Object.entries(o.axisSelection)) {
      if (instance.axisSelection[k] !== v) {
        matches = false;
        break;
      }
    }
    if (matches) Object.assign(matchingAxisProps, o.props);
  }

  const overrideEntries: { key: string; formatted: string | null }[] = [];
  for (const [key, value] of Object.entries(instance.propOverrides)) {
    const variantValue = matchingAxisProps[key];
    if (variantValue !== undefined && valuesEqual(value, variantValue)) continue;
    overrideEntries.push({ key, formatted: formatPropValue(value) });
  }

  const variantSlug = synthesizeVariantSlug(instance.axisSelection);
  const variantProp: { key: string; formatted: string | null }[] =
    variantSlug !== null
      ? [{ key: "variant", formatted: JSON.stringify(variantSlug) }]
      : [];
  const allProps: { key: string; formatted: string | null }[] = [
    ...variantProp,
    ...overrideEntries,
  ];

  const propLines = allProps.map(({ key, formatted }) =>
    formatted === null ? `  ${key}` : `  ${key}=${formatted}`,
  );

  const text =
    propLines.length === 0
      ? `<${component.name} />`
      : `<${component.name}\n${propLines.join("\n")}\n/>`;

  return { text, props: allProps };
}

/**
 * Pretty (commit-message) form of an axis selection. Single-axis: just
 * the value (e.g. "primary"). Multi-axis: "style=primary+size=md".
 * Returns null for an empty selection — the snippet then omits the
 * `variant` prop entirely.
 *
 * 3.5b moves this to a shared `axisSlug.ts` in `packages/publish`
 * along with its branch-form sibling and a parser. For chunk 2 the
 * snippet only emits the pretty form; branches handled in publish.
 */
function synthesizeVariantSlug(axisSelection: Record<string, string>): string | null {
  const entries = Object.entries(axisSelection);
  if (entries.length === 0) return null;
  if (entries.length === 1) return entries[0]![1];
  return entries.map(([k, v]) => `${k}=${v}`).join("+");
}

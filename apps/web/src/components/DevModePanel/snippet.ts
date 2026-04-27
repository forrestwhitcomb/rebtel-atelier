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
 *     style="primary"
 *     size="md"
 *     overrideKey="overrideValue"
 *     ...
 *   />
 *
 * Each axis on the component becomes its own prop (`style="primary"`,
 * `size="md"`). Instance-level overrides that differ from the resolved
 * variant's published state follow. Token refs render as their dot-path
 * string (e.g. `bg="color.card-bg"`).
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

  // Per-axis props, emitted in the component's declared axis order so
  // the snippet reads left-to-right as the axis list does in the family
  // view. Missing axis values fall back to the axis's default.
  const axisProps: { key: string; formatted: string | null }[] = component.axes.map(
    (axis) => {
      const value = instance.axisSelection[axis.name] ?? axis.default;
      return { key: axis.name, formatted: JSON.stringify(value) };
    },
  );

  const allProps: { key: string; formatted: string | null }[] = [
    ...axisProps,
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

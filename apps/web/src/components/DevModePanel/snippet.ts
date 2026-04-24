import type { Component, Instance, PropValue, TokenRef } from "@rebtel-atelier/spec";
import { publishedAtVersion } from "@rebtel-atelier/spec";

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
 * Only instance-level overrides that differ from the pinned variant's
 * published state become explicit props; everything else cascades through
 * the `variant`.
 *
 * Token refs render as their dot-path string (e.g. `bg="color.card-bg"`).
 * The engineer's codebase can translate that to whatever token import
 * shape it uses — we don't assume one.
 */
export function buildJsxSnippet(component: Component, instance: Instance): JsxSnippet {
  const variant = component.variants.find((v) => v.id === instance.variantId);
  const variantPublished = variant ? publishedAtVersion(variant, instance.variantVersion) : {};

  const overrideEntries: { key: string; formatted: string | null }[] = [];
  for (const [key, value] of Object.entries(instance.propOverrides)) {
    const variantValue = variantPublished[key];
    // Skip overrides that duplicate the variant's own resolved value —
    // noise in the snippet otherwise.
    if (variantValue !== undefined && valuesEqual(value, variantValue)) continue;
    overrideEntries.push({ key, formatted: formatPropValue(value) });
  }

  const allProps: { key: string; formatted: string | null }[] = [
    { key: "variant", formatted: JSON.stringify(instance.variantId) },
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

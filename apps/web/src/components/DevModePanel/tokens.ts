import type { Component, PropValue, TokenRef } from "@rebtel-atelier/spec";
import { resolveProps } from "@rebtel-atelier/spec";
import { TOKEN_CATALOG, resolveToken } from "@rebtel-atelier/rebtel-ds";
import type { Instance } from "@rebtel-atelier/spec";

function isTokenRef(v: unknown): v is TokenRef {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "token" in (v as object) &&
    typeof (v as { token: unknown }).token === "string"
  );
}

export interface ResolvedTokenRow {
  /** Prop key on the component (e.g. "bg"). The "role" column. */
  role: string;
  /** Dot-path token name (e.g. "color.card-bg"). */
  tokenName: string;
  /** Token category — drives whether a swatch is shown. */
  category: string;
  /**
   * CSS value the token resolves to — a var() reference for known tokens,
   * or a fallback for unknown. Safe to use as a `background` CSS value.
   */
  cssValue: string;
}

/**
 * Walk the fully-resolved props for an instance and pull out every prop
 * whose value is a TokenRef. This is the semantic token surface — what
 * the component actually uses at render time, with the names intact.
 */
export function collectResolvedTokens(
  component: Component,
  instance: Instance,
): ResolvedTokenRow[] {
  const resolved = resolveProps(component, instance.variantId, instance.propOverrides, {
    variantVersion: instance.variantVersion,
  });

  const rows: ResolvedTokenRow[] = [];
  for (const [key, value] of Object.entries(resolved)) {
    if (!isTokenRef(value)) continue;
    const catalogEntry = TOKEN_CATALOG[value.token];
    rows.push({
      role: key,
      tokenName: value.token,
      category: catalogEntry?.category ?? "unknown",
      cssValue: resolveToken(value),
    });
  }

  // Stable order: by role name. Keeps reads predictable across re-renders.
  rows.sort((a, b) => a.role.localeCompare(b.role));
  return rows;
}

// Re-export so consumers don't need both imports.
export type { PropValue };

import { VariantNotFoundError } from "./types.js";
import type { Component, PropValue, Variant, VariantProps } from "./types.js";

export type DraftScope = "variant" | "base" | null;

export interface ResolveOptions {
  /**
   * When set, layers an additional draft overlay for the active editor.
   * Callers pass this only for the instance being edited — other instances
   * must resolve against published state (CLAUDE.md invariant #5).
   */
  draftScope?: DraftScope;
  /**
   * When set, the resolver reads variant state from
   * `variant.publishedHistory[variantVersion]` (if available) instead of the
   * latest `variant.published`. This is how shipped canvases keep their
   * instances pinned to the pre-publish variant version.
   */
  variantVersion?: number;
}

export function publishedAtVersion(variant: Variant, version?: number): VariantProps {
  if (version === undefined) return variant.published;
  const snap = variant.publishedHistory?.[version];
  return snap ?? variant.published;
}

export function resolveProps(
  component: Component,
  variantId: string,
  instanceOverrides?: Record<string, PropValue>,
  options: ResolveOptions = {},
): Record<string, PropValue> {
  const variant = component.variants.find((v) => v.id === variantId);
  if (!variant) throw new VariantNotFoundError(component.id, variantId);

  const { draftScope = null, variantVersion } = options;

  const base = component.baseSpec.props;
  const baseDraft =
    draftScope === "base" && component.baseDraft ? component.baseDraft : null;
  const variantPublished = publishedAtVersion(variant, variantVersion);
  const variantDraft = draftScope === "variant" ? variant.draft : null;

  return {
    ...base,
    ...(baseDraft ?? {}),
    ...variantPublished,
    ...(variantDraft ?? {}),
    ...(instanceOverrides ?? {}),
  };
}

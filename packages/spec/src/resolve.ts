import { VariantNotFoundError } from "./types.js";
import type { Component, PropValue } from "./types.js";

/**
 * Three-layer prop resolution: base ← variant.published ← instanceOverrides.
 *
 * Session 1 reads from `variant.published`. Draft-vs-published handling
 * (reading draft in edit mode) lands session 2.
 */
export function resolveProps(
  component: Component,
  variantId: string,
  instanceOverrides?: Record<string, PropValue>,
): Record<string, PropValue> {
  const variant = component.variants.find((v) => v.id === variantId);
  if (!variant) throw new VariantNotFoundError(component.id, variantId);

  return {
    ...component.baseSpec.props,
    ...variant.published,
    ...(instanceOverrides ?? {}),
  };
}

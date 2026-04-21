import { createElement, type ReactElement } from "react";
import {
  resolveProps,
  type Component,
  type ComponentTypeId,
  type Instance,
  type PropValue,
} from "@rebtel-atelier/spec";
import {
  Button,
  CountryPicker,
  ProductCard,
  resolveToken,
  tokenVar,
} from "@rebtel-atelier/rebtel-ds";

// ── Component registry ──────────────────────────────────────
// Maps ComponentTypeId → React component. Apps inject their full DS via
// `createRenderer({ registry })` so the renderer stays DS-agnostic; the
// default export below is the Rebtel registry for convenience.

type AnyComponent = (props: Record<string, unknown>) => ReactElement;

export interface RendererRegistry {
  [key: ComponentTypeId]: AnyComponent;
}

export const rebtelRegistry: RendererRegistry = {
  Button: Button as unknown as AnyComponent,
  ProductCard: ProductCard as unknown as AnyComponent,
  CountryPicker: CountryPicker as unknown as AnyComponent,
};

// ── Rendering ────────────────────────────────────────────────

export interface RenderOptions {
  registry?: RendererRegistry;
}

/**
 * Render an Instance to a React element.
 * Resolves props via the three-layer stack (base ← variant.published ← overrides),
 * then invokes the registered component.
 */
export function renderInstance(
  instance: Instance,
  component: Component,
  options: RenderOptions = {},
): ReactElement {
  const registry = options.registry ?? rebtelRegistry;
  const Impl = registry[component.id];
  if (!Impl) {
    throw new Error(
      `[renderer] No component registered for id "${component.id}". Did you add it to the registry?`,
    );
  }
  const resolved = resolveProps(component, instance.variantId, instance.propOverrides);
  const reactProps = Object.fromEntries(
    Object.entries(resolved).map(([k, v]) => [k, coercePropValueForReact(v)]),
  );
  return createElement(Impl, { ...reactProps, key: instance.id });
}

function coercePropValueForReact(value: PropValue): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "token" in value &&
    typeof (value as { token: unknown }).token === "string"
  ) {
    return resolveToken(value as { token: string });
  }
  return value;
}

// Re-export token utilities so consumers only need @rebtel-atelier/renderer
export { resolveToken, tokenVar };

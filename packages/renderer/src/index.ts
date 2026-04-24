import { createElement, type ReactElement } from "react";
import {
  resolveProps,
  type Component,
  type ComponentTypeId,
  type DraftScope,
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

type AnyComponent = (props: Record<string, unknown>) => ReactElement;

export interface RendererRegistry {
  [key: ComponentTypeId]: AnyComponent;
}

export const rebtelRegistry: RendererRegistry = {
  Button: Button as unknown as AnyComponent,
  ProductCard: ProductCard as unknown as AnyComponent,
  CountryPicker: CountryPicker as unknown as AnyComponent,
};

export interface RenderOptions {
  registry?: RendererRegistry;
  /**
   * When set, the resolver layers an additional draft overlay. Pass this only
   * for the specific instance that matches the active editor's scope —
   * non-editing views must always render against published state.
   */
  draftScope?: DraftScope;
  /**
   * Render-only override of `instance.variantId`. Used by the family-view
   * hover preview — the instance's committed variantId is unchanged.
   * When set, `instance.variantVersion` is ignored (we use the new variant's
   * current published state, since pinning across variants isn't meaningful).
   */
  previewVariantId?: string;
}

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
  const effectiveVariantId = options.previewVariantId ?? instance.variantId;
  const resolved = resolveProps(component, effectiveVariantId, instance.propOverrides, {
    draftScope: options.draftScope ?? null,
    // Pinning only applies when we're rendering the instance's real variant.
    variantVersion: options.previewVariantId ? undefined : instance.variantVersion,
  });
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

export { resolveToken, tokenVar };

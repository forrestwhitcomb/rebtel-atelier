import { createElement, type ReactElement, type ReactNode } from "react";
import {
  defaultAxisSelectionFor,
  resolveProps,
  type Component,
  type ComponentRef,
  type ComponentSpec,
  type ComponentTypeId,
  type DesignSystem,
  type DraftScope,
  type Instance,
  type PrimitiveSpec,
  type PropValue,
  type StateName,
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
   * Render-only override of `instance.axisSelection`. Used by the
   * family-view hover preview — the instance's committed selection is
   * unchanged. When set, `instance.variantVersion` is ignored (we use
   * the component's current published state, since pinning across axis
   * selections isn't meaningful).
   */
  previewAxisSelection?: Record<string, string>;
  /**
   * Current interaction state. Defaults to `default`. Forwarded to the
   * resolver so state overrides apply. The renderer doesn't read input
   * events itself; UI surfaces (hover, focus) drive this.
   */
  state?: StateName;
  /**
   * Required when the rendered component's baseSpec has ComponentRef
   * children (composition / Model C). The renderer looks up the
   * referenced components in this DS. Optional only for leaf components
   * (no refs in their spec).
   */
  designSystem?: DesignSystem;
}

/**
 * Render an instance — resolve props against the four-layer cascade,
 * walk the component's baseSpec.children for ComponentRef nodes,
 * recursively render each, and pass them as slot props (key === ref.key)
 * to the React component.
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
  const effectiveSelection = options.previewAxisSelection ?? instance.axisSelection;
  const resolved = resolveProps(component, effectiveSelection, instance.propOverrides, {
    draftScope: options.draftScope ?? null,
    // Pinning only applies when we're rendering the instance's real
    // selection. Hover preview uses live published state.
    variantVersion: options.previewAxisSelection ? undefined : instance.variantVersion,
    state: options.state,
  });
  const reactProps = Object.fromEntries(
    Object.entries(resolved).map(([k, v]) => [k, coercePropValueForReact(v)]),
  );

  // Slot composition (Model C): walk baseSpec.children for ComponentRef
  // nodes, render each, pass as slot props keyed by ref.key. Slots win
  // over a same-keyed entry in resolved props — refs are structural.
  const slotProps = renderSlots(component.baseSpec, options);
  return createElement(Impl, { ...reactProps, ...slotProps, key: instance.id });
}

/**
 * Render every ComponentRef found among a primitive's direct children
 * into a slot-prop map keyed by ref.key. This is the entry point the
 * compositional rendering uses; it does NOT recurse into PrimitiveSpec
 * children of the parent — Model C is one level of composition (the
 * parent's React component owns its own DOM tree). Refs nested under
 * other refs DO render, because each ref's referenced component
 * resolves its own baseSpec via this same path.
 */
function renderSlots(
  parentSpec: PrimitiveSpec,
  options: RenderOptions,
): Record<string, ReactNode> {
  const slots: Record<string, ReactNode> = {};
  // De-dupe stable keys so an authoring mistake (two refs with the same
  // key) doesn't silently lose one of them — flag it loudly instead.
  const seen = new Set<string>();
  for (const child of parentSpec.children) {
    if (child.kind !== "component") continue;
    if (seen.has(child.key)) {
      throw new Error(
        `[renderer] Duplicate slot key "${child.key}" in baseSpec for "${parentSpec.type}". ComponentRef keys must be unique within a parent.`,
      );
    }
    seen.add(child.key);
    slots[child.key] = renderComponentRef(child, options);
  }
  return slots;
}

/**
 * Render a single ComponentRef. Looks up the referenced component in
 * the design system, fills any missing axes with the component's
 * defaults, applies the ref's propOverrides as instance-level
 * overrides, and recursively walks the referenced component's
 * baseSpec.children for nested refs.
 *
 * `previewAxisSelection`, `variantVersion`, and `draftScope` from the
 * outer options do NOT propagate to refs — those are properties of the
 * outer instance being previewed/edited, not of the structural slot
 * fills. State DOES propagate (a disabled ProductCard implies a
 * disabled CTA button).
 */
function renderComponentRef(ref: ComponentRef, options: RenderOptions): ReactNode {
  const registry = options.registry ?? rebtelRegistry;
  const ds = options.designSystem;
  if (!ds) {
    throw new Error(
      `[renderer] designSystem is required when rendering ComponentRef "${ref.key}" (componentId "${ref.componentId}"). Pass options.designSystem from the canvas.`,
    );
  }
  const refComponent = ds.components.find((c) => c.id === ref.componentId);
  if (!refComponent) {
    throw new Error(
      `[renderer] ComponentRef "${ref.key}" references unknown componentId "${ref.componentId}". Check the parent's baseSpec.children.`,
    );
  }
  const Impl = registry[refComponent.id];
  if (!Impl) {
    throw new Error(
      `[renderer] No component registered for ComponentRef "${ref.key}" → "${refComponent.id}".`,
    );
  }

  // Fill missing axes from the referenced component's defaults so a
  // partial axisSelection on the ref still resolves cleanly.
  const defaults = defaultAxisSelectionFor(refComponent);
  const effectiveSelection: Record<string, string> = { ...defaults, ...(ref.axisSelection ?? {}) };

  const resolved = resolveProps(refComponent, effectiveSelection, ref.propOverrides, {
    draftScope: null,
    state: options.state,
  });
  const reactProps = Object.fromEntries(
    Object.entries(resolved).map(([k, v]) => [k, coercePropValueForReact(v)]),
  );

  const nestedSlots = renderSlots(refComponent.baseSpec, options);
  return createElement(Impl, { ...reactProps, ...nestedSlots, key: ref.key });
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
// Re-export ComponentSpec so consumers can name the type without
// pulling in @rebtel-atelier/spec directly when they're already
// importing from the renderer.
export type { ComponentSpec };

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import {
  type Component,
  type DesignSystem,
  type Instance,
  type Token,
} from "@rebtel-atelier/spec";
import { renderInstance, type RendererRegistry } from "./index.js";

// The renderer is tested at the React-element level — not by mounting
// to a DOM. `createElement` produces a virtual element whose `props`
// shape is the contract: assertions read `result.props.cta` to inspect
// the slot fill, sidestepping react-dom + jsdom for what's really a
// prop-shape test.

function elementProps(el: ReactElement): Record<string, unknown> {
  return el.props as Record<string, unknown>;
}

const tokens: Record<string, Token> = {};

function makeDS(components: Component[]): DesignSystem {
  return { tokens, components, rules: [] };
}

// A minimal stand-in for a React function component. We never invoke
// it — only `createElement` references it as `type` — so its return
// type doesn't matter for these tests.
const stubComponent =
  (name: string) =>
  (_props: Record<string, unknown>): ReactElement =>
    ({ type: name, props: {}, key: null } as unknown as ReactElement);

const baseLeafComponent: Component = {
  id: "Leaf",
  name: "Leaf",
  paletteGroup: "inputs",
  axes: [{ name: "size", options: ["sm", "md", "lg"], default: "md" }],
  supportedStates: ["default"],
  baseSpec: {
    kind: "primitive",
    id: "Leaf:base",
    type: "Leaf",
    props: { label: "leaf-base", size: "md" },
    children: [],
  },
  draft: { axisOverrides: [], stateOverrides: [] },
  published: {
    axisOverrides: [{ axisSelection: { size: "lg" }, props: { label: "leaf-lg" } }],
    stateOverrides: [],
  },
  publishedVersion: 1,
};

describe("renderInstance — basic resolution", () => {
  it("passes resolved props to the registered React component", () => {
    const registry: RendererRegistry = { Leaf: stubComponent("Leaf") };
    const instance: Instance = {
      id: "i1",
      componentId: "Leaf",
      axisSelection: { size: "lg" },
      variantVersion: 1,
      propOverrides: {},
      position: { x: 0, y: 0 },
      frameId: "f1",
    };
    const el = renderInstance(instance, baseLeafComponent, { registry });
    const props = elementProps(el);
    expect(props.label).toBe("leaf-lg"); // axis override wins
    expect(props.size).toBe("md"); // base — axis override only touched label
  });
});

// ── Composition: ComponentRef slot fill ──────────────────────

const buttonRefedComponent: Component = {
  id: "Button",
  name: "Button",
  paletteGroup: "inputs",
  axes: [{ name: "style", options: ["primary", "secondary"], default: "primary" }],
  supportedStates: ["default"],
  baseSpec: {
    kind: "primitive",
    id: "Button:base",
    type: "Button",
    props: { label: "btn-base" },
    children: [],
  },
  draft: { axisOverrides: [], stateOverrides: [] },
  published: {
    axisOverrides: [
      { axisSelection: { style: "primary" }, props: { color: "red" } },
      { axisSelection: { style: "secondary" }, props: { color: "gray" } },
    ],
    stateOverrides: [],
  },
  publishedVersion: 1,
};

function cardWithChildren(children: Component["baseSpec"]["children"]): Component {
  return {
    id: "Card",
    name: "Card",
    paletteGroup: "containers",
    axes: [],
    supportedStates: ["default"],
    baseSpec: {
      kind: "primitive",
      id: "Card:base",
      type: "Card",
      props: { padding: 8 },
      children,
    },
    draft: { axisOverrides: [], stateOverrides: [] },
    published: { axisOverrides: [{ axisSelection: {}, props: {} }], stateOverrides: [] },
    publishedVersion: 1,
  };
}

const cardInstance: Instance = {
  id: "i-card",
  componentId: "Card",
  axisSelection: {},
  variantVersion: 1,
  propOverrides: {},
  position: { x: 0, y: 0 },
  frameId: "f1",
};

describe("renderInstance — slot composition", () => {
  it("renders a ComponentRef child as a slot prop keyed by ref.key", () => {
    const card = cardWithChildren([
      {
        kind: "component",
        key: "cta",
        componentId: "Button",
        axisSelection: { style: "primary" },
      },
    ]);
    const ds = makeDS([card, buttonRefedComponent]);
    const registry: RendererRegistry = {
      Card: stubComponent("Card"),
      Button: stubComponent("Button"),
    };
    const el = renderInstance(cardInstance, card, { registry, designSystem: ds });
    const cardProps = elementProps(el);
    expect(cardProps.cta).toBeDefined();
    const slot = cardProps.cta as ReactElement;
    expect(elementProps(slot).label).toBe("btn-base");
    expect(elementProps(slot).color).toBe("red"); // primary axis override
  });

  it("multiple ComponentRef children land as distinct slot props", () => {
    const card = cardWithChildren([
      { kind: "component", key: "primaryCta", componentId: "Button" },
      {
        kind: "component",
        key: "secondaryCta",
        componentId: "Button",
        axisSelection: { style: "secondary" },
      },
    ]);
    const ds = makeDS([card, buttonRefedComponent]);
    const registry: RendererRegistry = {
      Card: stubComponent("Card"),
      Button: stubComponent("Button"),
    };
    const el = renderInstance(cardInstance, card, { registry, designSystem: ds });
    const cardProps = elementProps(el);
    expect(elementProps(cardProps.primaryCta as ReactElement).color).toBe("red");
    expect(elementProps(cardProps.secondaryCta as ReactElement).color).toBe("gray");
  });

  it("ComponentRef.propOverrides win over the referenced component's axis layer", () => {
    const card = cardWithChildren([
      {
        kind: "component",
        key: "cta",
        componentId: "Button",
        axisSelection: { style: "primary" },
        propOverrides: { color: "ref-blue", label: "ref-label" },
      },
    ]);
    const ds = makeDS([card, buttonRefedComponent]);
    const registry: RendererRegistry = {
      Card: stubComponent("Card"),
      Button: stubComponent("Button"),
    };
    const el = renderInstance(cardInstance, card, { registry, designSystem: ds });
    const slot = elementProps(el).cta as ReactElement;
    expect(elementProps(slot).color).toBe("ref-blue");
    expect(elementProps(slot).label).toBe("ref-label");
  });

  it("ComponentRef without axisSelection falls back to the referenced component's defaults", () => {
    const card = cardWithChildren([
      // No axisSelection — Button's `style` axis defaults to `primary`.
      { kind: "component", key: "cta", componentId: "Button" },
    ]);
    const ds = makeDS([card, buttonRefedComponent]);
    const registry: RendererRegistry = {
      Card: stubComponent("Card"),
      Button: stubComponent("Button"),
    };
    const el = renderInstance(cardInstance, card, { registry, designSystem: ds });
    const slot = elementProps(el).cta as ReactElement;
    expect(elementProps(slot).color).toBe("red"); // primary default
  });

  it("rejects duplicate slot keys loudly (no silent loss)", () => {
    const card = cardWithChildren([
      { kind: "component", key: "cta", componentId: "Button" },
      { kind: "component", key: "cta", componentId: "Button" },
    ]);
    const ds = makeDS([card, buttonRefedComponent]);
    const registry: RendererRegistry = {
      Card: stubComponent("Card"),
      Button: stubComponent("Button"),
    };
    expect(() => renderInstance(cardInstance, card, { registry, designSystem: ds })).toThrow(
      /Duplicate slot key "cta"/,
    );
  });

  it("throws clearly when a ref points at an unregistered component", () => {
    const card = cardWithChildren([
      { kind: "component", key: "cta", componentId: "MissingButton" },
    ]);
    const ds = makeDS([card]);
    const registry: RendererRegistry = { Card: stubComponent("Card") };
    expect(() => renderInstance(cardInstance, card, { registry, designSystem: ds })).toThrow(
      /unknown componentId "MissingButton"/,
    );
  });

  it("requires designSystem when the parent has ComponentRef children", () => {
    const card = cardWithChildren([{ kind: "component", key: "cta", componentId: "Button" }]);
    const registry: RendererRegistry = { Card: stubComponent("Card") };
    expect(() => renderInstance(cardInstance, card, { registry })).toThrow(
      /designSystem is required/,
    );
  });
});

import { productCardPlan, type Component } from "@rebtel-atelier/spec";

// v4 shape with a single `emphasis` axis (default vs highlighted).
//
// Composition (Model C — narrow demonstration): baseSpec.children
// includes one ComponentRef to Button keyed `cta`. The renderer walks
// the spec tree, renders that Button via the registry (with its own
// axis selection), and passes the result to ProductCard.tsx as a
// `cta?: ReactNode` slot prop. Multi-ref support is exercised by the
// renderer's tests; ProductCard's surface only needs the one slot.

const { axes, supportedStates } = productCardPlan;

export const productCardComponent: Component = {
  id: "ProductCard",
  name: "ProductCard",
  paletteGroup: "productSpecific",
  axes,
  supportedStates,
  baseSpec: {
    kind: "primitive",
    id: "ProductCard:base",
    type: "ProductCard",
    props: {
      bundle: "10 GB",
      duration: "30 days",
      price: 19.99,
      currency: "USD",
      bg: { token: "color.card-bg" },
      border: { token: "color.card-border" },
      radius: { token: "radius.lg" },
      priceColor: { token: "color.content-primary" },
      ctaLabel: "Buy now",
    },
    children: [
      {
        kind: "component",
        key: "cta",
        componentId: "Button",
        // Default axis selection on the referenced Button — the slot
        // arrives as a primary-style button. Future ProductCard variants
        // could override `style: 'secondary'` here per axis combination.
        axisSelection: { style: "primary" },
        // Wire the parent's `ctaLabel` through to the Button's `label`
        // prop — keeps the engineer's mental model simple (one prop on
        // ProductCard, no need to dig into the slot to relabel the CTA).
        propOverrides: {
          // The renderer reads `propOverrides` against the referenced
          // component's props at render time. Mapping ProductCard's
          // `ctaLabel` to Button's `label` is done by the parent React
          // component; here we just assert the slot's default label.
          label: "Buy now",
        },
      },
    ],
  },
  draft: { axisOverrides: [], stateOverrides: [] },
  published: {
    axisOverrides: [
      {
        axisSelection: { emphasis: "default" },
        props: {
          bg: { token: "color.card-bg" },
          border: { token: "color.card-border" },
          radius: { token: "radius.lg" },
          priceColor: { token: "color.content-primary" },
        },
      },
      {
        axisSelection: { emphasis: "highlighted" },
        props: {
          bg: { token: "color.home-card-mtu-bg" },
          border: { token: "color.border-brand" },
          radius: { token: "radius.lg" },
          priceColor: { token: "color.content-brand" },
        },
      },
    ],
    stateOverrides: [],
  },
  publishedVersion: 1,
  propSchema: {
    bundle: { category: "content", contentKind: "text", label: "Bundle" },
    duration: { category: "content", contentKind: "text", label: "Duration" },
    price: { category: "content", contentKind: "number", label: "Price" },
    currency: { category: "content", contentKind: "text", label: "Currency" },
    ctaLabel: { category: "content", contentKind: "text", label: "CTA label" },
    bg: { category: "token", tokenCategory: "color", label: "Background" },
    border: { category: "token", tokenCategory: "color", label: "Border color" },
    radius: { category: "token", tokenCategory: "radius", label: "Corner radius" },
    priceColor: { category: "token", tokenCategory: "color", label: "Price color" },
  },
};

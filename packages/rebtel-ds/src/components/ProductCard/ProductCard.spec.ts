import type { Component } from "@rebtel-atelier/spec";

export const productCardComponent: Component = {
  id: "ProductCard",
  name: "ProductCard",
  paletteGroup: "productSpecific",
  axes: [
    {
      name: "emphasis",
      options: ["default", "highlighted"],
      default: "default",
    },
  ],
  supportedStates: ["default", "hover", "pressed"],
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
        axisSelection: {
          style: "primary",
        },
        propOverrides: {
          label: "Buy now",
        },
      },
    ],
  },
  draft: {
    axisOverrides: [],
    stateOverrides: [],
  },
  published: {
    axisOverrides: [
      {
        axisSelection: {
          emphasis: "default",
        },
        props: {
          bg: { token: "color.card-bg" },
          border: { token: "color.card-border" },
          radius: { token: "radius.lg" },
          priceColor: { token: "color.content-primary" },
        },
      },
      {
        axisSelection: {
          emphasis: "highlighted",
        },
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

import type { Component } from "@rebtel-atelier/spec";
import { productCardVariants } from "./ProductCard.variants.js";

export const productCardComponent: Component = {
  id: "ProductCard",
  name: "ProductCard",
  paletteGroup: "productSpecific",
  version: 1,
  baseSpec: {
    id: "ProductCard:base",
    type: "ProductCard",
    variant: null,
    props: {
      bundle: "10 GB",
      duration: "30 days",
      price: 19.99,
      currency: "USD",
      bg: { token: "color.card-bg" },
      border: { token: "color.card-border" },
      radius: { token: "radius.lg" },
      priceColor: { token: "color.content-primary" },
    },
    children: [],
  },
  variants: productCardVariants,
  propSchema: {
    bundle: { category: "content", contentKind: "text", label: "Bundle" },
    duration: { category: "content", contentKind: "text", label: "Duration" },
    price: { category: "content", contentKind: "number", label: "Price" },
    currency: { category: "content", contentKind: "text", label: "Currency" },
    bg: { category: "token", tokenCategory: "color", label: "Background" },
    border: { category: "token", tokenCategory: "color", label: "Border color" },
    radius: { category: "token", tokenCategory: "radius", label: "Corner radius" },
    priceColor: { category: "token", tokenCategory: "color", label: "Price color" },
  },
};

import type { Component } from "@rebtel-atelier/spec";
import { productCardVariants } from "./ProductCard.variants.js";

export const productCardComponent: Component = {
  id: "ProductCard",
  name: "ProductCard",
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
      variant: "mtu-bundle",
    },
    children: [],
  },
  variants: productCardVariants,
};

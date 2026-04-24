import type { Component } from "@rebtel-atelier/spec";
import { buttonVariants } from "./Button.variants.js";

export const buttonComponent: Component = {
  id: "Button",
  name: "Button",
  paletteGroup: "inputs",
  version: 1,
  baseSpec: {
    id: "Button:base",
    type: "Button",
    variant: null,
    props: {
      label: "Button",
      disabled: false,
      bg: { token: "color.button-primary-bg" },
      fg: { token: "color.button-primary-text" },
      border: { token: "color.button-primary-border" },
      radius: { token: "radius.md" },
    },
    children: [],
  },
  variants: buttonVariants,
  propSchema: {
    label: { category: "content", contentKind: "text", label: "Label" },
    disabled: { category: "content", contentKind: "boolean", label: "Disabled" },
    bg: { category: "token", tokenCategory: "color", label: "Background" },
    fg: { category: "token", tokenCategory: "color", label: "Text color" },
    border: { category: "token", tokenCategory: "color", label: "Border color" },
    radius: { category: "token", tokenCategory: "radius", label: "Corner radius" },
  },
};

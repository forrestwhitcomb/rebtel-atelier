import type { Component } from "@rebtel-atelier/spec";
import { buttonVariants } from "./Button.variants.js";

export const buttonComponent: Component = {
  id: "Button",
  name: "Button",
  version: 1,
  baseSpec: {
    id: "Button:base",
    type: "Button",
    variant: null,
    props: {
      label: "Button",
      disabled: false,
      variant: "primary",
    },
    children: [],
  },
  variants: buttonVariants,
};

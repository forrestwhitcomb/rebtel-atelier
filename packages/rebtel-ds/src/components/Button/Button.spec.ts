import type { Component } from "@rebtel-atelier/spec";

export const buttonComponent: Component = {
  id: "Button",
  name: "Button",
  paletteGroup: "inputs",
  axes: [
    {
      name: "style",
      options: ["primary", "secondary", "ghost"],
      default: "primary",
    },
  ],
  supportedStates: ["default", "hover", "pressed", "disabled", "focus"],
  baseSpec: {
    kind: "primitive",
    id: "Button:base",
    type: "Button",
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
  draft: {
    axisOverrides: [],
    stateOverrides: [],
  },
  published: {
    axisOverrides: [
      {
        axisSelection: {
          style: "primary",
        },
        props: {
          bg: { token: "color.button-primary-bg" },
          fg: { token: "color.button-primary-text" },
          border: { token: "color.button-primary-border" },
          radius: { token: "radius.md" },
        },
      },
      {
        axisSelection: {
          style: "secondary",
        },
        props: {
          bg: { token: "color.button-secondary-black-bg" },
          fg: { token: "color.button-secondary-black-text" },
          border: { token: "color.button-secondary-black-border" },
          radius: { token: "radius.md" },
        },
      },
      {
        axisSelection: {
          style: "ghost",
        },
        props: {
          bg: { token: "color.button-ghost-bg" },
          fg: { token: "color.button-ghost-text" },
          border: { token: "color.button-ghost-border" },
          radius: { token: "radius.md" },
        },
      },
    ],
    stateOverrides: [],
  },
  publishedVersion: 1,
  propSchema: {
    label: { category: "content", contentKind: "text", label: "Label" },
    disabled: { category: "content", contentKind: "boolean", label: "Disabled" },
    bg: { category: "token", tokenCategory: "color", label: "Background" },
    fg: { category: "token", tokenCategory: "color", label: "Text color" },
    border: { category: "token", tokenCategory: "color", label: "Border color" },
    radius: { category: "token", tokenCategory: "radius", label: "Corner radius" },
  },
};

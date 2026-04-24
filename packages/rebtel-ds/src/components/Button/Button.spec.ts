import { buttonPlan, type Component } from "@rebtel-atelier/spec";

// v4 shape — flat-string variants are gone. The `style` axis carries
// what was previously three named variants (primary / secondary / ghost).
// Axes and supportedStates come from the migration plan in
// `packages/spec/src/migrations/plans/Button.plan.ts` so the migration
// archaeology and the live DS share one source of truth.

const { axes, supportedStates } = buttonPlan;

export const buttonComponent: Component = {
  id: "Button",
  name: "Button",
  paletteGroup: "inputs",
  axes,
  supportedStates,
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
  draft: { axisOverrides: [], stateOverrides: [] },
  published: {
    axisOverrides: [
      {
        axisSelection: { style: "primary" },
        props: {
          bg: { token: "color.button-primary-bg" },
          fg: { token: "color.button-primary-text" },
          border: { token: "color.button-primary-border" },
          radius: { token: "radius.md" },
        },
      },
      {
        axisSelection: { style: "secondary" },
        props: {
          bg: { token: "color.button-secondary-black-bg" },
          fg: { token: "color.button-secondary-black-text" },
          border: { token: "color.button-secondary-black-border" },
          radius: { token: "radius.md" },
        },
      },
      {
        axisSelection: { style: "ghost" },
        props: {
          bg: { token: "color.button-ghost-bg" },
          fg: { token: "color.button-ghost-text" },
          border: { token: "color.button-ghost-border" },
          radius: { token: "radius.md" },
        },
      },
    ],
    // No state overrides seeded yet — Button.tsx already reads `disabled`
    // as a prop and applies opacity/cursor styling itself. The state
    // vocabulary is declared in supportedStates so a future state-aware
    // session can add overrides here without touching the React side.
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

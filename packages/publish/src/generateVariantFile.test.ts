import { describe, it, expect } from "vitest";
import type { Component } from "@rebtel-atelier/spec";
import { generateVariantFile, componentSpecFilePathFor } from "./generateVariantFile.js";

const buttonComponent: Component = {
  id: "Button",
  name: "Button",
  paletteGroup: "inputs",
  axes: [
    { name: "style", options: ["primary", "secondary"], default: "primary" },
  ],
  supportedStates: ["default", "hover", "disabled"],
  baseSpec: {
    kind: "primitive",
    id: "Button:base",
    type: "Button",
    props: { label: "Button", disabled: false },
    children: [],
  },
  draft: {
    // Draft must be stripped from the output — never committed.
    axisOverrides: [
      { axisSelection: { style: "primary" }, props: { radius: { token: "radius.lg" } } },
    ],
    stateOverrides: [],
  },
  published: {
    axisOverrides: [
      {
        axisSelection: { style: "primary" },
        props: {
          bg: { token: "color.button-primary-bg" },
          fg: { token: "color.button-primary-text" },
        },
      },
      {
        axisSelection: { style: "secondary" },
        props: {
          bg: { token: "color.button-secondary-bg" },
          fg: { token: "color.button-secondary-text" },
        },
      },
    ],
    stateOverrides: [{ state: "disabled", props: { opacity: 0.5 } }],
  },
  publishedVersion: 2,
  publishedHistory: {
    1: { axisOverrides: [], stateOverrides: [] },
    2: {
      axisOverrides: [
        {
          axisSelection: { style: "primary" },
          props: {
            bg: { token: "color.button-primary-bg" },
            fg: { token: "color.button-primary-text" },
          },
        },
      ],
      stateOverrides: [],
    },
  },
  lastPublishedAt: "2026-04-22T10:00:00Z",
  lastPublishedBy: "forrest",
};

describe("generateVariantFile (v4 .spec.ts emitter)", () => {
  it("starts with the type import — no leading header comment", () => {
    const out = generateVariantFile({ component: buttonComponent });
    expect(out.startsWith(`import type { Component } from "@rebtel-atelier/spec";\n`)).toBe(true);
  });

  it("emits the v4 component constant under the camelCase name", () => {
    const out = generateVariantFile({ component: buttonComponent });
    expect(out).toContain("export const buttonComponent: Component");
  });

  it("emits axes as multi-line objects with inline primitive options array", () => {
    const out = generateVariantFile({ component: buttonComponent });
    expect(out).toContain(`name: "style"`);
    expect(out).toContain(`options: ["primary", "secondary"]`);
    expect(out).toContain(`default: "primary"`);
  });

  it("emits supportedStates as an inline primitive array", () => {
    const out = generateVariantFile({ component: buttonComponent });
    expect(out).toContain(`supportedStates: ["default", "hover", "disabled"]`);
  });

  it("emits token refs inline inside expanded props blocks", () => {
    const out = generateVariantFile({ component: buttonComponent });
    expect(out).toContain(`bg: { token: "color.button-primary-bg" }`);
    expect(out).toContain(`axisSelection: {`);
    expect(out).toContain(`style: "primary"`);
  });

  it("emits state overrides", () => {
    const out = generateVariantFile({ component: buttonComponent });
    expect(out).toContain(`state: "disabled"`);
    expect(out).toContain(`opacity: 0.5`);
  });

  it("strips draft, publishedHistory, lastPublishedAt, lastPublishedBy", () => {
    const out = generateVariantFile({ component: buttonComponent });
    expect(out).not.toContain("publishedHistory");
    expect(out).not.toContain("lastPublishedAt");
    expect(out).not.toContain("lastPublishedBy");
    // The draft.axisOverrides values must not leak through.
    expect(out).not.toContain("radius.lg");
    // draft is emitted as the empty snapshot.
    expect(out).toMatch(/draft: \{\s*axisOverrides: \[\],\s*stateOverrides: \[\],?\s*\}/);
  });

  it("is deterministic — same input produces byte-identical output", () => {
    const a = generateVariantFile({ component: buttonComponent });
    const b = generateVariantFile({ component: buttonComponent });
    expect(a).toBe(b);
  });

  it("componentSpecFilePathFor points at .spec.ts under the component dir", () => {
    expect(componentSpecFilePathFor(buttonComponent)).toBe(
      "packages/rebtel-ds/src/components/Button/Button.spec.ts",
    );
  });

  it("preserves axis-override insertion order", () => {
    const reordered: Component = {
      ...buttonComponent,
      published: {
        ...buttonComponent.published,
        axisOverrides: [
          {
            axisSelection: { style: "secondary" },
            props: { bg: { token: "color.b-bg" } },
          },
          {
            axisSelection: { style: "primary" },
            props: { bg: { token: "color.a-bg" } },
          },
        ],
      },
    };
    const out = generateVariantFile({ component: reordered });
    expect(out.indexOf(`"color.b-bg"`)).toBeLessThan(out.indexOf(`"color.a-bg"`));
  });
});

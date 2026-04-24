import { describe, expect, it } from "vitest";
import { defaultAxisSelectionFor, resolveProps } from "./resolve.js";
import type { Component } from "./types.js";

// Two-axis component covers axis matching, partial-override stacking,
// and instance-level wins. State overrides exercised in their own block.

const buttonLike: Component = {
  id: "TestButton",
  name: "TestButton",
  paletteGroup: "inputs",
  baseSpec: {
    kind: "primitive",
    id: "TestButton:base",
    type: "TestButton",
    props: { size: "md", label: "base", color: "black", weight: 400 },
    children: [],
  },
  axes: [
    { name: "style", options: ["primary", "secondary", "ghost"], default: "primary" },
    { name: "size", options: ["sm", "md", "lg"], default: "md" },
  ],
  supportedStates: ["default", "hover", "pressed", "disabled"],
  draft: { axisOverrides: [], stateOverrides: [] },
  published: {
    axisOverrides: [
      // Wildcard: applies to every primary regardless of size.
      { axisSelection: { style: "primary" }, props: { color: "red", label: "primary" } },
      // More-specific: applies only to primary + lg.
      {
        axisSelection: { style: "primary", size: "lg" },
        props: { weight: 700 },
      },
      { axisSelection: { style: "secondary" }, props: { color: "gray", label: "secondary" } },
      { axisSelection: { style: "ghost" }, props: { color: "transparent", label: "ghost" } },
    ],
    stateOverrides: [{ state: "disabled", props: { color: "muted", weight: 400 } }],
  },
  publishedVersion: 1,
  publishedHistory: {
    1: {
      axisOverrides: [
        { axisSelection: { style: "primary" }, props: { color: "red", label: "primary" } },
        {
          axisSelection: { style: "primary", size: "lg" },
          props: { weight: 700 },
        },
        { axisSelection: { style: "secondary" }, props: { color: "gray", label: "secondary" } },
        { axisSelection: { style: "ghost" }, props: { color: "transparent", label: "ghost" } },
      ],
      stateOverrides: [{ state: "disabled", props: { color: "muted", weight: 400 } }],
    },
  },
};

// Single-implicit-variant component (axes: []) — covers the
// CountryPicker case where axis matching is a no-op and only base +
// instance layers run.
const noAxes: Component = {
  id: "Bare",
  name: "Bare",
  paletteGroup: "inputs",
  baseSpec: {
    kind: "primitive",
    id: "Bare:base",
    type: "Bare",
    props: { label: "base", color: "black" },
    children: [],
  },
  axes: [],
  supportedStates: ["default"],
  draft: { axisOverrides: [], stateOverrides: [] },
  published: { axisOverrides: [], stateOverrides: [] },
  publishedVersion: 1,
};

describe("resolveProps — base layer", () => {
  it("returns base when no axes / no overrides selected", () => {
    expect(resolveProps(noAxes, {})).toEqual({ label: "base", color: "black" });
  });

  it("instance overrides win over base when no axes match", () => {
    expect(resolveProps(noAxes, {}, { color: "blue" })).toEqual({
      label: "base",
      color: "blue",
    });
  });
});

describe("resolveProps — axis layer", () => {
  it("primary selection picks up the primary axis override", () => {
    expect(resolveProps(buttonLike, { style: "primary", size: "md" })).toEqual({
      size: "md",
      label: "primary",
      color: "red",
      weight: 400,
    });
  });

  it("more-specific axis override stacks on top of less-specific", () => {
    expect(resolveProps(buttonLike, { style: "primary", size: "lg" })).toEqual({
      size: "md", // base — no axis override touches `size` here
      label: "primary",
      color: "red",
      weight: 700, // bumped by the {style:primary,size:lg} override
    });
  });

  it("non-matching axis selection falls through to base", () => {
    // ghost → label/color from ghost override; weight stays at base 400.
    expect(resolveProps(buttonLike, { style: "ghost", size: "md" })).toEqual({
      size: "md",
      label: "ghost",
      color: "transparent",
      weight: 400,
    });
  });

  it("missing axes in selection use the component's defaults", () => {
    // Only style declared; size should default to 'md'.
    expect(resolveProps(buttonLike, { style: "primary" })).toEqual({
      size: "md",
      label: "primary",
      color: "red",
      weight: 400,
    });
  });
});

describe("resolveProps — state layer", () => {
  it("disabled state override beats axis override", () => {
    expect(
      resolveProps(buttonLike, { style: "primary", size: "md" }, undefined, {
        state: "disabled",
      }),
    ).toEqual({
      size: "md",
      label: "primary",
      color: "muted", // state wins over axis-layered red
      weight: 400,
    });
  });

  it("default state has no state-layer effect", () => {
    expect(
      resolveProps(buttonLike, { style: "primary", size: "md" }, undefined, {
        state: "default",
      }),
    ).toEqual({
      size: "md",
      label: "primary",
      color: "red",
      weight: 400,
    });
  });
});

describe("resolveProps — instance layer", () => {
  it("instance overrides win over axis + state", () => {
    expect(
      resolveProps(
        buttonLike,
        { style: "primary", size: "md" },
        { color: "instance-color", label: "instance-label" },
        { state: "disabled" },
      ),
    ).toEqual({
      size: "md",
      label: "instance-label",
      color: "instance-color",
      weight: 400,
    });
  });
});

describe("resolveProps — draft scope", () => {
  it("component draftScope layers draft.axisOverrides on top of published", () => {
    const withDraft: Component = {
      ...buttonLike,
      draft: {
        axisOverrides: [
          { axisSelection: { style: "primary" }, props: { color: "draft-purple" } },
        ],
        stateOverrides: [],
      },
    };
    expect(
      resolveProps(withDraft, { style: "primary", size: "md" }, undefined, {
        draftScope: "component",
      }),
    ).toEqual({
      size: "md",
      label: "primary",
      color: "draft-purple", // draft wins
      weight: 400,
    });
  });

  it("draftScope is opt-in — default ignores draft", () => {
    const withDraft: Component = {
      ...buttonLike,
      draft: {
        axisOverrides: [
          { axisSelection: { style: "primary" }, props: { color: "draft-purple" } },
        ],
        stateOverrides: [],
      },
    };
    expect(resolveProps(withDraft, { style: "primary", size: "md" })).toEqual({
      size: "md",
      label: "primary",
      color: "red", // published wins; draft ignored
      weight: 400,
    });
  });

  it("instance overrides still win over draft", () => {
    const withDraft: Component = {
      ...buttonLike,
      draft: {
        axisOverrides: [
          { axisSelection: { style: "primary" }, props: { color: "draft-purple" } },
        ],
        stateOverrides: [],
      },
    };
    expect(
      resolveProps(
        withDraft,
        { style: "primary", size: "md" },
        { color: "instance-blue" },
        { draftScope: "component" },
      ),
    ).toEqual({
      size: "md",
      label: "primary",
      color: "instance-blue",
      weight: 400,
    });
  });

  it("base draftScope layers component.baseDraft beneath axis overrides", () => {
    const withBaseDraft: Component = {
      ...buttonLike,
      baseDraft: { size: "xl", color: "green" },
    };
    expect(
      resolveProps(withBaseDraft, { style: "primary", size: "md" }, undefined, {
        draftScope: "base",
      }),
    ).toEqual({
      size: "xl", // baseDraft visible
      label: "primary",
      color: "red", // axis layer overrides baseDraft.color
      weight: 400,
    });
  });

  it("base draftScope reaches props no axis touches", () => {
    const withBaseDraft: Component = {
      ...buttonLike,
      baseDraft: { weight: 999 },
    };
    expect(
      resolveProps(withBaseDraft, { style: "primary", size: "md" }, undefined, {
        draftScope: "base",
      }),
    ).toEqual({
      size: "md",
      label: "primary",
      color: "red",
      weight: 999, // baseDraft visible because no axis touches `weight` for primary+md
    });
  });
});

describe("resolveProps — versioning", () => {
  it("variantVersion pins to publishedHistory snapshot when present", () => {
    const withHistory: Component = {
      ...buttonLike,
      publishedVersion: 2,
      published: {
        axisOverrides: [
          { axisSelection: { style: "primary" }, props: { color: "v2-red", label: "v2-primary" } },
        ],
        stateOverrides: [],
      },
      publishedHistory: {
        ...buttonLike.publishedHistory,
        2: {
          axisOverrides: [
            {
              axisSelection: { style: "primary" },
              props: { color: "v2-red", label: "v2-primary" },
            },
          ],
          stateOverrides: [],
        },
      },
    };
    // Pin to v1 — should resolve against the v1 snapshot, not the latest v2.
    expect(resolveProps(withHistory, { style: "primary", size: "md" }, undefined, {
      variantVersion: 1,
    })).toEqual({
      size: "md",
      label: "primary",
      color: "red",
      weight: 400,
    });
    // Pin to v2 (or omit) — latest published.
    expect(resolveProps(withHistory, { style: "primary", size: "md" }, undefined, {
      variantVersion: 2,
    })).toEqual({
      size: "md",
      label: "v2-primary",
      color: "v2-red",
      weight: 400,
    });
  });

  it("variantVersion falls back to latest published when history missing", () => {
    expect(resolveProps(buttonLike, { style: "primary", size: "md" }, undefined, {
      variantVersion: 99,
    })).toEqual({
      size: "md",
      label: "primary",
      color: "red",
      weight: 400,
    });
  });
});

describe("resolveProps — purity", () => {
  it("does not mutate component or its overrides", () => {
    const before = JSON.stringify(buttonLike);
    resolveProps(
      buttonLike,
      { style: "primary", size: "lg" },
      { color: "blue" },
      { state: "disabled", draftScope: "component" },
    );
    expect(JSON.stringify(buttonLike)).toBe(before);
  });
});

describe("defaultAxisSelectionFor", () => {
  it("returns the declared default for every axis", () => {
    expect(defaultAxisSelectionFor(buttonLike)).toEqual({ style: "primary", size: "md" });
  });

  it("returns {} when the component has no axes", () => {
    expect(defaultAxisSelectionFor(noAxes)).toEqual({});
  });
});

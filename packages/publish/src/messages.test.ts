import { describe, it, expect } from "vitest";
import type { Component, ComponentOverrideSnapshot } from "@rebtel-atelier/spec";
import { buildBranchName, buildCommitMessage, buildPrBody } from "./messages.js";

const component: Component = {
  id: "ProductCard",
  name: "ProductCard",
  paletteGroup: "productSpecific",
  axes: [{ name: "emphasis", options: ["default", "highlighted"], default: "default" }],
  supportedStates: ["default", "hover", "pressed"],
  baseSpec: {
    kind: "primitive",
    id: "ProductCard:base",
    type: "ProductCard",
    props: {},
    children: [],
  },
  draft: { axisOverrides: [], stateOverrides: [] },
  published: { axisOverrides: [], stateOverrides: [] },
  publishedVersion: 3,
};

const previousPublished: ComponentOverrideSnapshot = {
  axisOverrides: [
    {
      axisSelection: { emphasis: "highlighted" },
      props: {
        bg: { token: "color.card-bg" },
        radius: { token: "radius.lg" },
      },
    },
  ],
  stateOverrides: [],
};

const nextPublished: ComponentOverrideSnapshot = {
  axisOverrides: [
    {
      axisSelection: { emphasis: "highlighted" },
      props: {
        bg: { token: "color.home-card-mtu-bg" },
        radius: { token: "radius.xl" },
        badge: "Most popular",
      },
    },
  ],
  stateOverrides: [],
};

describe("buildCommitMessage", () => {
  it("starts with the [atelier] prefix and names the changed axis combo", () => {
    const msg = buildCommitMessage({
      component,
      previousPublished,
      nextPublished,
      previousVersion: 3,
      nextVersion: 4,
      impacts: [],
    });
    const subject = msg.split("\n")[0];
    expect(subject).toBe("[atelier] ProductCard: update emphasis=highlighted (v3 → v4)");
  });

  it("includes one bullet per property change inside the axis combo", () => {
    const msg = buildCommitMessage({
      component,
      previousPublished,
      nextPublished,
      previousVersion: 3,
      nextVersion: 4,
      impacts: [],
    });
    expect(msg).toContain("`bg`: `color.card-bg` → `color.home-card-mtu-bg`");
    expect(msg).toContain("`radius`: `radius.lg` → `radius.xl`");
    expect(msg).toContain("Added `badge` with value");
  });

  it("annotates the subject when more than one axis combo changed", () => {
    const next: ComponentOverrideSnapshot = {
      ...nextPublished,
      axisOverrides: [
        ...nextPublished.axisOverrides,
        {
          axisSelection: { emphasis: "default" },
          props: { bg: { token: "color.new-default-bg" } },
        },
      ],
    };
    const msg = buildCommitMessage({
      component,
      previousPublished,
      nextPublished: next,
      previousVersion: 3,
      nextVersion: 4,
      impacts: [],
    });
    expect(msg.split("\n")[0]).toContain("(and 1 more)");
  });
});

describe("buildPrBody", () => {
  it("has the four required sections + the new axis-keyed shape", () => {
    const body = buildPrBody({
      component,
      previousPublished,
      nextPublished,
      previousVersion: 3,
      nextVersion: 4,
      impacts: [
        {
          canvasId: "c1",
          canvasName: "Cuba top-up",
          instanceCount: 6,
          status: "draft",
          adoptsNewVersion: true,
        },
        {
          canvasId: "c2",
          canvasName: "Mexico top-up",
          instanceCount: 2,
          status: "shipped",
          adoptsNewVersion: false,
        },
      ],
      editor: "Forrest",
    });
    expect(body).toContain("## What changed");
    expect(body).toContain("## Impact");
    expect(body).toContain("## Context");
    expect(body).toContain("## Dev notes");
    // Axis section present
    expect(body).toContain("### Axis overrides");
    expect(body).toContain("**emphasis=highlighted**");
    // Impact section
    expect(body).toContain("8 instances across 2 canvases");
    expect(body).toContain("Cuba top-up");
    expect(body).toContain("adopts v4");
    expect(body).toContain("pinned to v3");
  });

  it("handles the empty-impact case", () => {
    const body = buildPrBody({
      component,
      previousPublished,
      nextPublished,
      previousVersion: 3,
      nextVersion: 4,
      impacts: [],
    });
    expect(body).toContain("No canvases currently use this component.");
  });
});

describe("buildBranchName", () => {
  it("produces atelier/component/<slug>-<hash>", () => {
    expect(buildBranchName(component, "a1b2c3d")).toBe(
      "atelier/component/productcard-a1b2c3d",
    );
  });
});

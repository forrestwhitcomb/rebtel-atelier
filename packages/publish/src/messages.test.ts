import { describe, it, expect } from "vitest";
import type { Component, Variant } from "@rebtel-atelier/spec";
import { buildBranchName, buildCommitMessage, buildPrBody } from "./messages.js";

const component: Component = {
  id: "ProductCard",
  name: "ProductCard",
  paletteGroup: "productSpecific",
  version: 1,
  baseSpec: {
    id: "ProductCard:base",
    type: "ProductCard",
    variant: null,
    props: {},
    children: [],
  },
  variants: [],
};

const before: Variant = {
  id: "mtu-bundle-highlighted",
  name: "MTU Bundle (Highlighted)",
  extends: "mtu-bundle",
  draft: {},
  published: {
    bg: { token: "color.card-bg" },
    radius: { token: "radius.lg" },
  },
  publishedVersion: 3,
};

const after: Variant = {
  ...before,
  published: {
    bg: { token: "color.home-card-mtu-bg" },
    radius: { token: "radius.xl" },
    badge: "Most popular",
  },
  publishedVersion: 4,
};

describe("buildCommitMessage", () => {
  it("starts with the [atelier] prefix and names the component and variant", () => {
    const msg = buildCommitMessage({ component, variantBefore: before, variantAfter: after, impacts: [] });
    expect(msg.split("\n")[0]).toBe("[atelier] ProductCard: update mtu-bundle-highlighted variant");
  });

  it("includes one bullet per property change", () => {
    const msg = buildCommitMessage({ component, variantBefore: before, variantAfter: after, impacts: [] });
    expect(msg).toContain("`bg`: `color.card-bg` → `color.home-card-mtu-bg`");
    expect(msg).toContain("`radius`: `radius.lg` → `radius.xl`");
    expect(msg).toContain("Added `badge` with value");
  });
});

describe("buildPrBody", () => {
  it("has the four required sections", () => {
    const body = buildPrBody({
      component,
      variantBefore: before,
      variantAfter: after,
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
    // Impact section mentions total instances and per-canvas rows
    expect(body).toContain("8 instances across 2 canvases");
    expect(body).toContain("Cuba top-up");
    expect(body).toContain("adopts v4");
    expect(body).toContain("pinned to v3");
  });

  it("handles the empty-impact case", () => {
    const body = buildPrBody({
      component,
      variantBefore: before,
      variantAfter: after,
      impacts: [],
    });
    expect(body).toContain("No canvases currently use this variant.");
  });
});

describe("buildBranchName", () => {
  it("slugifies component and variant ids", () => {
    const name = buildBranchName(component, "mtu-bundle-highlighted", "a1b2c3d");
    expect(name).toBe("atelier/variant/productcard-mtu-bundle-highlighted-a1b2c3d");
  });
});

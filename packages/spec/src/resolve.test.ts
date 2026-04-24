import { describe, it, expect } from "vitest";
import { resolveProps } from "./resolve.js";
import { VariantNotFoundError, type Component } from "./types.js";

const component: Component = {
  id: "TestComponent",
  name: "TestComponent",
  paletteGroup: "inputs",
  version: 1,
  baseSpec: {
    id: "spec-root",
    type: "TestComponent",
    variant: null,
    props: { size: "md", label: "base", color: "black" },
    children: [],
  },
  variants: [
    {
      id: "primary",
      name: "primary",
      extends: "base",
      draft: {},
      published: { color: "red", label: "variant" },
      publishedVersion: 1,
    },
    {
      id: "bare",
      name: "bare",
      extends: "base",
      draft: {},
      published: {},
      publishedVersion: 1,
    },
  ],
};

describe("resolveProps", () => {
  it("starts with base props when variant has no overrides", () => {
    expect(resolveProps(component, "bare")).toEqual({
      size: "md",
      label: "base",
      color: "black",
    });
  });

  it("variant.published overrides base", () => {
    expect(resolveProps(component, "primary")).toEqual({
      size: "md",
      label: "variant",
      color: "red",
    });
  });

  it("instance overrides win over variant and base", () => {
    expect(resolveProps(component, "primary", { label: "instance" })).toEqual({
      size: "md",
      label: "instance",
      color: "red",
    });
  });

  it("instance override can unset a base value with an empty string etc.", () => {
    expect(resolveProps(component, "primary", { color: "blue", size: "lg" })).toEqual({
      size: "lg",
      label: "variant",
      color: "blue",
    });
  });

  it("throws VariantNotFoundError for unknown variant", () => {
    expect(() => resolveProps(component, "does-not-exist")).toThrow(VariantNotFoundError);
  });

  it("does not mutate component.baseSpec.props", () => {
    const snapshot = JSON.stringify(component.baseSpec.props);
    resolveProps(component, "primary", { color: "blue" });
    expect(JSON.stringify(component.baseSpec.props)).toBe(snapshot);
  });

  it("variant draftScope layers variant.draft over variant.published", () => {
    const withDraft: Component = {
      ...component,
      variants: component.variants.map((v) =>
        v.id === "primary" ? { ...v, draft: { color: "purple" } } : v,
      ),
    };
    expect(resolveProps(withDraft, "primary", undefined, { draftScope: "variant" })).toEqual({
      size: "md",
      label: "variant",
      color: "purple",
    });
  });

  it("variant draftScope ignored by default (canvases see published)", () => {
    const withDraft: Component = {
      ...component,
      variants: component.variants.map((v) =>
        v.id === "primary" ? { ...v, draft: { color: "purple" } } : v,
      ),
    };
    expect(resolveProps(withDraft, "primary")).toEqual({
      size: "md",
      label: "variant",
      color: "red",
    });
  });

  it("instance overrides still win over variant.draft", () => {
    const withDraft: Component = {
      ...component,
      variants: component.variants.map((v) =>
        v.id === "primary" ? { ...v, draft: { color: "purple" } } : v,
      ),
    };
    expect(
      resolveProps(withDraft, "primary", { color: "blue" }, { draftScope: "variant" }),
    ).toEqual({ size: "md", label: "variant", color: "blue" });
  });

  it("base draftScope layers component.baseDraft beneath variant.published", () => {
    const withBaseDraft: Component = {
      ...component,
      baseDraft: { size: "xl", color: "green" },
    };
    // Variant published overrides color=red again — that's the point.
    expect(resolveProps(withBaseDraft, "primary", undefined, { draftScope: "base" })).toEqual({
      size: "xl",
      label: "variant",
      color: "red",
    });
  });

  it("base draftScope reaches props the variant doesn't override", () => {
    const withBaseDraft: Component = {
      ...component,
      baseDraft: { size: "xl" },
    };
    expect(resolveProps(withBaseDraft, "bare", undefined, { draftScope: "base" })).toEqual({
      size: "xl",
      label: "base",
      color: "black",
    });
  });

  it("variantVersion pins to publishedHistory when the snapshot exists", () => {
    const withHistory: Component = {
      ...component,
      variants: component.variants.map((v) =>
        v.id === "primary"
          ? {
              ...v,
              publishedVersion: 2,
              published: { color: "lime", label: "v2" },
              publishedHistory: {
                1: { color: "red", label: "variant" },
                2: { color: "lime", label: "v2" },
              },
            }
          : v,
      ),
    };
    expect(resolveProps(withHistory, "primary", undefined, { variantVersion: 1 })).toEqual({
      size: "md",
      label: "variant",
      color: "red",
    });
    expect(resolveProps(withHistory, "primary", undefined, { variantVersion: 2 })).toEqual({
      size: "md",
      label: "v2",
      color: "lime",
    });
  });

  it("variantVersion falls back to latest published when history missing", () => {
    expect(resolveProps(component, "primary", undefined, { variantVersion: 99 })).toEqual({
      size: "md",
      label: "variant",
      color: "red",
    });
  });
});

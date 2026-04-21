import { describe, it, expect } from "vitest";
import { resolveProps } from "./resolve.js";
import { VariantNotFoundError, type Component } from "./types.js";

const component: Component = {
  id: "TestComponent",
  name: "TestComponent",
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
});

import { describe, expect, it } from "vitest";
import {
  migrateComponent,
  migrateInstance,
  type ComponentMigrationPlan,
  type ComponentV3,
  type InstanceV3,
} from "./v3-to-v4.js";
import {
  buttonPlan,
  countryPickerPlan,
  productCardPlan,
} from "./plans/index.js";

// The three production plans are imported (not redeclared) so the tests
// exercise the exact decomposition the DS components consume. A drift
// between plan-as-tested and plan-as-shipped is impossible by
// construction.

// ── Fixtures (lifted from packages/rebtel-ds, trimmed) ─────

const buttonV3: ComponentV3 = {
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
    },
    children: [],
  },
  variants: [
    {
      id: "primary",
      name: "Primary",
      extends: "base",
      draft: {},
      published: {
        bg: { token: "color.button-primary-bg" },
        fg: { token: "color.button-primary-text" },
      },
      publishedVersion: 1,
    },
    {
      id: "secondary",
      name: "Secondary",
      extends: "base",
      draft: {},
      published: {
        bg: { token: "color.button-secondary-black-bg" },
        fg: { token: "color.button-secondary-black-text" },
      },
      publishedVersion: 1,
    },
    {
      id: "ghost",
      name: "Ghost",
      extends: "base",
      draft: {},
      published: {
        bg: { token: "color.button-ghost-bg" },
        fg: { token: "color.button-ghost-text" },
      },
      publishedVersion: 1,
    },
  ],
  propSchema: {
    label: { category: "content", contentKind: "text" },
    bg: { category: "token", tokenCategory: "color" },
    fg: { category: "token", tokenCategory: "color" },
  },
};

const productCardV3: ComponentV3 = {
  id: "ProductCard",
  name: "ProductCard",
  paletteGroup: "productSpecific",
  version: 1,
  baseSpec: {
    id: "ProductCard:base",
    type: "ProductCard",
    variant: null,
    props: {
      bundle: "10 GB",
      bg: { token: "color.card-bg" },
      border: { token: "color.card-border" },
    },
    children: [],
  },
  variants: [
    {
      id: "mtu-bundle",
      name: "MTU Bundle",
      extends: "base",
      draft: {},
      published: {
        bg: { token: "color.card-bg" },
        border: { token: "color.card-border" },
      },
      publishedVersion: 1,
    },
    {
      id: "mtu-bundle-highlighted",
      name: "MTU Bundle (Highlighted)",
      extends: "mtu-bundle",
      draft: {},
      published: {
        bg: { token: "color.home-card-mtu-bg" },
        border: { token: "color.border-brand" },
      },
      publishedVersion: 1,
    },
  ],
};

const countryPickerV3: ComponentV3 = {
  id: "CountryPicker",
  name: "CountryPicker",
  paletteGroup: "productSpecific",
  version: 1,
  baseSpec: {
    id: "CountryPicker:base",
    type: "CountryPicker",
    variant: null,
    props: { selectedCode: null, bg: { token: "color.input-bg" } },
    children: [],
  },
  variants: [
    {
      id: "default",
      name: "Default",
      extends: "base",
      draft: {},
      published: { bg: { token: "color.input-bg" } },
      publishedVersion: 1,
    },
  ],
};

// ── migrateComponent — happy-path coverage of the three DS comps ────

describe("migrateComponent", () => {
  it("Button → single style axis with three options, paletteGroup preserved", () => {
    const v4 = migrateComponent(buttonV3, buttonPlan);
    expect(v4.id).toBe("Button");
    expect(v4.paletteGroup).toBe("inputs");
    expect(v4.axes).toEqual([
      { name: "style", options: ["primary", "secondary", "ghost"], default: "primary" },
    ]);
    expect(v4.supportedStates).toContain("default");
    expect(v4.supportedStates).toContain("disabled");
    expect(v4.published.axisOverrides).toHaveLength(3);
    expect(v4.published.axisOverrides[0]).toEqual({
      axisSelection: { style: "primary" },
      props: {
        bg: { token: "color.button-primary-bg" },
        fg: { token: "color.button-primary-text" },
      },
    });
    expect(v4.published.axisOverrides[1]?.axisSelection).toEqual({ style: "secondary" });
    expect(v4.published.axisOverrides[2]?.axisSelection).toEqual({ style: "ghost" });
    expect(v4.draft).toEqual({ axisOverrides: [], stateOverrides: [] });
    expect(v4.publishedVersion).toBe(1);
  });

  it("Button baseSpec migrates to PrimitiveSpec — 'variant: null' dropped, 'kind' added", () => {
    const v4 = migrateComponent(buttonV3, buttonPlan);
    expect(v4.baseSpec.kind).toBe("primitive");
    expect(v4.baseSpec.id).toBe("Button:base");
    expect(v4.baseSpec.type).toBe("Button");
    expect(v4.baseSpec.children).toEqual([]);
    expect("variant" in v4.baseSpec).toBe(false);
    // Token refs in props survive the deep-ish copy.
    expect(v4.baseSpec.props.bg).toEqual({ token: "color.button-primary-bg" });
  });

  it("ProductCard → emphasis axis collapses 'mtu-bundle' / 'mtu-bundle-highlighted'", () => {
    const v4 = migrateComponent(productCardV3, productCardPlan);
    expect(v4.axes).toEqual([
      { name: "emphasis", options: ["default", "highlighted"], default: "default" },
    ]);
    expect(v4.published.axisOverrides).toHaveLength(2);
    expect(v4.published.axisOverrides[0]?.axisSelection).toEqual({ emphasis: "default" });
    expect(v4.published.axisOverrides[1]?.axisSelection).toEqual({
      emphasis: "highlighted",
    });
    expect(v4.published.axisOverrides[1]?.props.bg).toEqual({
      token: "color.home-card-mtu-bg",
    });
  });

  it("CountryPicker → empty axes, single implicit variant maps to {}", () => {
    const v4 = migrateComponent(countryPickerV3, countryPickerPlan);
    expect(v4.axes).toEqual([]);
    expect(v4.supportedStates).toEqual(["default"]);
    expect(v4.published.axisOverrides).toHaveLength(1);
    expect(v4.published.axisOverrides[0]?.axisSelection).toEqual({});
  });

  it("propSchema and paletteGroup carry through unchanged", () => {
    const v4 = migrateComponent(buttonV3, buttonPlan);
    expect(v4.propSchema).toEqual(buttonV3.propSchema);
    // Mutating the migrated propSchema must not affect the v3 source.
    if (v4.propSchema?.label) {
      v4.propSchema.label.label = "Tampered";
    }
    expect(buttonV3.propSchema?.label?.label).toBeUndefined();
  });

  it("publishedHistory reconstructs per-version snapshots from per-variant histories", () => {
    const buttonWithHistory: ComponentV3 = {
      ...buttonV3,
      variants: buttonV3.variants.map((v) =>
        v.id === "primary"
          ? {
              ...v,
              publishedVersion: 2,
              published: {
                bg: { token: "color.button-primary-pressed-bg" },
                fg: { token: "color.button-primary-text" },
              },
              publishedHistory: {
                1: {
                  bg: { token: "color.button-primary-bg" },
                  fg: { token: "color.button-primary-text" },
                },
                2: {
                  bg: { token: "color.button-primary-pressed-bg" },
                  fg: { token: "color.button-primary-text" },
                },
              },
            }
          : v,
      ),
    };
    const v4 = migrateComponent(buttonWithHistory, buttonPlan);
    expect(v4.publishedVersion).toBe(2);
    expect(v4.publishedHistory?.[1]?.axisOverrides[0]?.props.bg).toEqual({
      token: "color.button-primary-bg",
    });
    expect(v4.publishedHistory?.[2]?.axisOverrides[0]?.props.bg).toEqual({
      token: "color.button-primary-pressed-bg",
    });
  });

  it("lastPublishedAt / lastPublishedBy lift from the most-recently-published variant", () => {
    const stamped: ComponentV3 = {
      ...buttonV3,
      variants: buttonV3.variants.map((v, i) => ({
        ...v,
        lastPublishedAt: `2026-04-${String(20 + i).padStart(2, "0")}T12:00:00Z`,
        lastPublishedBy: `editor-${i}@rebtel`,
      })),
    };
    const v4 = migrateComponent(stamped, buttonPlan);
    expect(v4.lastPublishedAt).toBe("2026-04-22T12:00:00Z");
    expect(v4.lastPublishedBy).toBe("editor-2@rebtel");
  });

  it("seeded stateOverrides land on draft-empty published snapshot and propagate into history", () => {
    const planWithState: ComponentMigrationPlan = {
      ...buttonPlan,
      stateOverrides: [{ state: "disabled", props: { opacity: 0.5 } }],
    };
    const v4 = migrateComponent(buttonV3, planWithState);
    expect(v4.published.stateOverrides).toEqual([
      { state: "disabled", props: { opacity: 0.5 } },
    ]);
    expect(v4.publishedHistory?.[1]?.stateOverrides).toEqual([
      { state: "disabled", props: { opacity: 0.5 } },
    ]);
  });

  it("does not mutate the v3 input", () => {
    const before = JSON.stringify(buttonV3);
    migrateComponent(buttonV3, buttonPlan);
    expect(JSON.stringify(buttonV3)).toBe(before);
  });
});

// ── migrateComponent — sanity checks ────────────────────────

describe("migrateComponent — sanity checks", () => {
  it("throws when a v3 variant is missing from the plan", () => {
    const incompletePlan: ComponentMigrationPlan = {
      ...buttonPlan,
      variantToAxisSelection: {
        primary: { style: "primary" },
        // 'secondary' and 'ghost' missing
      },
    };
    expect(() => migrateComponent(buttonV3, incompletePlan)).toThrow(/secondary, ghost/);
  });

  it("throws when an axis selection references an axis not declared in the plan", () => {
    const badPlan: ComponentMigrationPlan = {
      ...buttonPlan,
      variantToAxisSelection: {
        primary: { style: "primary", size: "lg" }, // 'size' axis not declared
        secondary: { style: "secondary" },
        ghost: { style: "ghost" },
      },
    };
    expect(() => migrateComponent(buttonV3, badPlan)).toThrow(/unknown axis "size"/);
  });

  it("throws when supportedStates omits 'default'", () => {
    const badPlan: ComponentMigrationPlan = {
      ...buttonPlan,
      supportedStates: ["hover", "disabled"],
    };
    expect(() => migrateComponent(buttonV3, badPlan)).toThrow(/must include "default"/);
  });
});

// ── migrateInstance ────────────────────────────────────────

describe("migrateInstance", () => {
  const v3Instance: InstanceV3 = {
    id: "inst_xyz",
    componentId: "Button",
    variantId: "primary",
    variantVersion: 1,
    propOverrides: { label: "Call now" },
    position: { x: 24, y: 80 },
    frameId: "frame:demo",
  };

  it("rewrites variantId to axisSelection via the same plan", () => {
    const v4 = migrateInstance(v3Instance, buttonPlan);
    expect(v4).toEqual({
      id: "inst_xyz",
      componentId: "Button",
      axisSelection: { style: "primary" },
      variantVersion: 1,
      propOverrides: { label: "Call now" },
      position: { x: 24, y: 80 },
      frameId: "frame:demo",
    });
    // No vestigial variantId field.
    expect("variantId" in v4).toBe(false);
  });

  it("CountryPicker instance migrates to empty axisSelection", () => {
    const cpInstance: InstanceV3 = {
      ...v3Instance,
      id: "inst_cp",
      componentId: "CountryPicker",
      variantId: "default",
    };
    const v4 = migrateInstance(cpInstance, countryPickerPlan);
    expect(v4.axisSelection).toEqual({});
  });

  it("throws (does not silently default) when variantId is unmapped", () => {
    const orphan: InstanceV3 = { ...v3Instance, variantId: "phantom-variant" };
    expect(() => migrateInstance(orphan, buttonPlan)).toThrow(
      /unknown variantId "phantom-variant"/,
    );
  });

  it("does not share mutable references with the v3 input", () => {
    const v4 = migrateInstance(v3Instance, buttonPlan);
    v4.propOverrides.label = "Mutated";
    v4.position.x = 999;
    expect(v3Instance.propOverrides.label).toBe("Call now");
    expect(v3Instance.position.x).toBe(24);
  });
});

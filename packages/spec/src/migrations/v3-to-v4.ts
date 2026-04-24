// v3 → v4 component model migration.
//
// v3 (sessions 1–3): variants are flat strings. A Button has three
// variants identified by id (`primary`, `secondary`, `ghost`); each
// variant carries its own `published` prop bag. Instances pin to a
// variant by `variantId`.
//
// v4 (session 3.5): variants are matrices of axes (e.g. `style`, `size`)
// composed independently. States (`hover`, `pressed`, `disabled`, …)
// are orthogonal. Components carry `axes`, `supportedStates`,
// `axisOverrides[]`, `stateOverrides[]`. Instances pin via
// `axisSelection`.
//
// This file is the migration *artifact* — it produces v4 shapes from v3
// shapes given an explicit per-component decomposition plan. The repo
// has no Supabase persistence yet, so this code is not invoked by any
// runtime path. It exists so:
//   1. The v4 component shape is reviewable in one place before chunk 2
//      rewrites the rest of the repo against it.
//   2. When persistence ships in a later session, the migration is
//      ready to run — see `packages/spec/migrations/RUNBOOK.md`.
//
// All functions are pure — no I/O, no logging, no mutation of inputs.

import type {
  Axis,
  AxisOverride,
  Component,
  ComponentOverrideSnapshot,
  ComponentSpec,
  Instance,
  PaletteGroup,
  PrimitiveSpec,
  PropSchema,
  PropValue,
  StateName,
  StateOverride,
} from "../types.js";

// Re-export the live v4 types under their migration-doc names so
// existing references keep working.
export type ComponentV4 = Component;
export type InstanceV4 = Instance;
export type { ComponentOverrideSnapshot };

// ── V3 shape (lifted verbatim from current types.ts) ────────
// Keeping this inline rather than importing the live `Component` /
// `Variant` / `Instance` so the migration's source-of-truth doesn't
// shift under us when chunk 2 rewrites those types.

interface V3VariantProps {
  [k: string]: PropValue;
}

interface V3Variant {
  id: string;
  name: string;
  extends: "base" | string;
  draft: V3VariantProps;
  published: V3VariantProps;
  publishedVersion: number;
  publishedHistory?: Record<number, V3VariantProps>;
  lastPublishedBy?: string;
  lastPublishedAt?: string;
}

interface V3ComponentSpec {
  id: string;
  type: string;
  variant: string | null;
  props: Record<string, PropValue>;
  children: V3ComponentSpec[];
}

export interface ComponentV3 {
  id: string;
  name: string;
  paletteGroup: PaletteGroup;
  baseSpec: V3ComponentSpec;
  baseDraft?: Record<string, PropValue>;
  variants: V3Variant[];
  version: number;
  propSchema?: PropSchema;
  hideFamilyView?: boolean;
}

export interface InstanceV3 {
  id: string;
  componentId: string;
  variantId: string;
  variantVersion: number;
  propOverrides: Record<string, PropValue>;
  position: { x: number; y: number };
  frameId: string;
}

// ── V4 shape ───────────────────────────────────────────────
// `Component` and `Instance` from `../types.js` ARE the v4 shape now
// (chunk 2 promoted them out of this file). The `ComponentV4` /
// `InstanceV4` aliases at the top of this file preserve the migration's
// original vocabulary so the runbook docs continue to read cleanly.

// ── Migration plan ──────────────────────────────────────────
// The migration cannot infer how flat-string variants decompose into
// axes — that's an editorial choice. Callers provide a plan per
// component. For the three DS components in session 3.5, plans are
// authored by hand in chunk 2 (see `Button.spec.ts` etc.).
//
// When persistence ships and Supabase carries production v3 data, the
// operator authors plans for any extra components introduced since.

export interface ComponentMigrationPlan {
  /** Axes the v4 component should have. Order is family-view presentation order. */
  axes: Axis[];
  /** States the v4 component supports. Always include 'default'. */
  supportedStates: StateName[];
  /**
   * Map from old flat variant id → new axis selection. Every v3
   * variant's id must appear here, otherwise the migration throws —
   * silent loss of variants is the worst outcome.
   */
  variantToAxisSelection: Record<string, Record<string, string>>;
  /**
   * Optional — state-driven overrides to seed on the v4 component.
   * v3 didn't model states at all, so anything here is new authorship,
   * not migrated data.
   */
  stateOverrides?: StateOverride[];
}

// ── Migration ───────────────────────────────────────────────

/**
 * Migrate a v3 Component to v4.
 *
 * - `baseSpec` becomes a PrimitiveSpec (kind discriminator added,
 *   meaningless `variant: null` field dropped). Children are migrated
 *   recursively. v3 has no ComponentRef nodes, so all children remain
 *   primitives unless the caller supplies a tree that already includes
 *   refs (chunk-2 hand-authored case).
 * - Each v3 variant's `published` becomes one AxisOverride keyed by the
 *   axis selection from `plan.variantToAxisSelection`.
 * - The component's `published.axisOverrides` is the union of all
 *   variant publisheds, in v3 declaration order.
 * - `publishedVersion` becomes the max of all v3 variants' versions.
 *   v3 carried per-variant versions; v4 versions a whole snapshot at
 *   once. Instances pinned to an old per-variant version migrate
 *   conservatively to the same numeric version, which is fine because
 *   in fixture data everything sits at v1.
 *
 *   Cadence note: post-migration, component version increments faster
 *   than it did pre-migration. v3 incremented one variant at a time;
 *   v4 increments the whole component on any axis or state override
 *   change. A Button at v1 with three variants might reach v15 in v4
 *   after fifteen separate axis-override pushes that would have been
 *   spread across three independently-versioned variant rows in v3.
 *   This is correct per the new model — a component is a unit, and
 *   its version reflects every published change to it. Engineers
 *   reviewing PRs see component-level bumps; instance pinning keeps
 *   shipped canvases stable.
 * - publishedHistory entries collapse from per-variant maps to
 *   per-version snapshots; we keep the highest-numbered snapshot per
 *   version we encounter.
 * - draft starts empty (chunk 2 enters edit mode fresh after the
 *   migration runs).
 *
 * Throws if any v3 variant id is missing from
 * `plan.variantToAxisSelection`.
 */
export function migrateComponent(
  v3: ComponentV3,
  plan: ComponentMigrationPlan,
): ComponentV4 {
  // Sanity: every v3 variant must be mapped.
  const missing = v3.variants
    .map((v) => v.id)
    .filter((id) => !(id in plan.variantToAxisSelection));
  if (missing.length > 0) {
    throw new Error(
      `[migrateComponent] Component "${v3.id}": variantToAxisSelection is missing entries for: ${missing.join(", ")}`,
    );
  }

  // Sanity: each axis selection must reference axes the plan declares.
  const declaredAxes = new Set(plan.axes.map((a) => a.name));
  for (const [variantId, sel] of Object.entries(plan.variantToAxisSelection)) {
    for (const axisName of Object.keys(sel)) {
      if (!declaredAxes.has(axisName)) {
        throw new Error(
          `[migrateComponent] Component "${v3.id}": variant "${variantId}" maps to unknown axis "${axisName}"`,
        );
      }
    }
  }

  // Sanity: 'default' must appear in supportedStates so resolver lookups
  // never silently fall through.
  if (!plan.supportedStates.includes("default")) {
    throw new Error(
      `[migrateComponent] Component "${v3.id}": supportedStates must include "default"`,
    );
  }

  const axisOverrides: AxisOverride[] = v3.variants.map((variant) => ({
    axisSelection: plan.variantToAxisSelection[variant.id]!,
    props: { ...variant.published },
  }));

  const stateOverrides: StateOverride[] = (plan.stateOverrides ?? []).map((s) => ({
    state: s.state,
    props: { ...s.props },
  }));

  const publishedVersion = v3.variants.reduce(
    (max, v) => Math.max(max, v.publishedVersion),
    1,
  );

  const publishedSnapshot: ComponentOverrideSnapshot = {
    axisOverrides,
    stateOverrides,
  };

  // Reconstruct publishedHistory by collapsing per-variant histories
  // into per-version component snapshots. We rebuild each historical
  // version by replaying every variant's snapshot at that version (or
  // its current published if the variant didn't snapshot that version
  // explicitly).
  const allHistoryVersions = new Set<number>();
  for (const v of v3.variants) {
    if (v.publishedHistory) {
      for (const k of Object.keys(v.publishedHistory)) allHistoryVersions.add(Number(k));
    }
  }
  allHistoryVersions.add(publishedVersion);

  const publishedHistory: Record<number, ComponentOverrideSnapshot> = {};
  for (const version of allHistoryVersions) {
    const historicalAxisOverrides: AxisOverride[] = v3.variants.map((variant) => {
      const sourceProps =
        variant.publishedHistory?.[version] ?? variant.published;
      return {
        axisSelection: plan.variantToAxisSelection[variant.id]!,
        props: { ...sourceProps },
      };
    });
    publishedHistory[version] = {
      axisOverrides: historicalAxisOverrides,
      // State overrides have no v3 equivalent — they're new in v4.
      // Treat the seeded set as applying to every historical version.
      stateOverrides: stateOverrides.map((s) => ({ ...s, props: { ...s.props } })),
    };
  }

  const lastPublished = v3.variants.reduce<{ at?: string; by?: string } | null>(
    (acc, v) => {
      if (!v.lastPublishedAt) return acc;
      if (!acc?.at || v.lastPublishedAt > acc.at) {
        return { at: v.lastPublishedAt, by: v.lastPublishedBy };
      }
      return acc;
    },
    null,
  );

  return {
    id: v3.id,
    name: v3.name,
    paletteGroup: v3.paletteGroup,
    baseSpec: migrateSpecNode(v3.baseSpec),
    baseDraft: v3.baseDraft ? { ...v3.baseDraft } : undefined,
    axes: plan.axes.map((a) => ({
      name: a.name,
      options: [...a.options],
      default: a.default,
    })),
    supportedStates: [...plan.supportedStates],
    draft: { axisOverrides: [], stateOverrides: [] },
    published: publishedSnapshot,
    publishedVersion,
    publishedHistory,
    ...(lastPublished?.at ? { lastPublishedAt: lastPublished.at } : {}),
    ...(lastPublished?.by ? { lastPublishedBy: lastPublished.by } : {}),
    // Deep-copy propSchema entries so mutations on the migrated component
    // don't leak back into the v3 source. Same defensive-copy posture as
    // axes / overrides / instance fields.
    propSchema: clonePropSchema(v3.propSchema),
    hideFamilyView: v3.hideFamilyView,
  };
}

/**
 * Migrate a v3 Instance to v4. Maps `variantId` → `axisSelection` via
 * the same plan used to migrate the parent component. Throws if the
 * instance points at an unmapped variant — silent reassignment to a
 * default would be worse than failing loudly.
 */
export function migrateInstance(
  v3: InstanceV3,
  plan: ComponentMigrationPlan,
): InstanceV4 {
  const selection = plan.variantToAxisSelection[v3.variantId];
  if (!selection) {
    throw new Error(
      `[migrateInstance] Instance "${v3.id}" (component "${v3.componentId}") references unknown variantId "${v3.variantId}"`,
    );
  }
  return {
    id: v3.id,
    componentId: v3.componentId,
    axisSelection: { ...selection },
    variantVersion: v3.variantVersion,
    propOverrides: { ...v3.propOverrides },
    position: { ...v3.position },
    frameId: v3.frameId,
  };
}

// ── Internal: helpers ───────────────────────────────────────

function clonePropSchema(schema: PropSchema | undefined): PropSchema | undefined {
  if (!schema) return undefined;
  const out: PropSchema = {};
  for (const [key, entry] of Object.entries(schema)) {
    out[key] = { ...entry };
  }
  return out;
}

function migrateSpecNode(node: V3ComponentSpec): PrimitiveSpec {
  // v3 has no ComponentRef concept, so every node migrates to a
  // primitive. The `variant: null` field disappears; everything else
  // carries through with a `kind` discriminator.
  return {
    kind: "primitive",
    id: node.id,
    type: node.type,
    props: { ...node.props },
    children: node.children.map(migrateSpecNode) as ComponentSpec[],
  };
}

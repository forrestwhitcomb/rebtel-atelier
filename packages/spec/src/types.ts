import type { Token, TokenCategory, TokenRef } from "./tokens.js";

// ── ComponentSpec tree ───────────────────────────────────────
// A component's structural skeleton. Discriminated union: PrimitiveSpec
// is the bones (the React component renders the DOM), ComponentRef is a
// reference to another registered component the renderer drops into a
// named slot on the parent.
//
// Lifted from Aphantasia's SpecNode, trimmed: no annotations (AI
// suggestion attachment — session 5), no responsiveOverrides (single
// mobile frame this session), no materialization levels or origin
// tracking. Session 3.5 introduced the discriminated union; Model C
// composition only — ComponentRef has no `tag`/`layout`/`style` fields
// because the parent's React component still owns DOM, the spec only
// declares which slot a referenced component fills.

/** ComponentType is a string — IDs source from the DS registry, not a union. */
export type ComponentTypeId = string;

export type PropValue =
  | string
  | number
  | boolean
  | null
  | TokenRef
  | PropValue[]
  | { [k: string]: PropValue };

/**
 * Discriminated `kind: "primitive"` node. Carries the bones of a
 * component: a stable id, the type id (matches the DS registry), default
 * props, and child specs (other primitives or ComponentRef references).
 */
export interface PrimitiveSpec {
  kind: "primitive";
  /** Stable per-spec id (CRDT-friendly). */
  id: string;
  /** Component type id — same identifier the renderer registry uses. */
  type: ComponentTypeId;
  /** Default props. The floor of four-layer resolution. */
  props: Record<string, PropValue>;
  /** Child specs — primitives or component references. */
  children: ComponentSpec[];
}

/**
 * Reference to another registered component, embedded inside a parent's
 * spec tree. The renderer walks the parent's children, finds each
 * ComponentRef, renders it via the registry (resolving its own axes /
 * state / props), and passes the rendered React node to the parent as a
 * named slot (parent prop key === ref.key).
 *
 * Session 3.5 demonstrates this with one ref per composed component
 * (Model C — narrow demonstration): ProductCard's baseSpec children
 * include one ComponentRef to Button keyed `cta`; ProductCard.tsx
 * accepts a `cta?: ReactNode` slot. Multi-ref support is exercised by
 * the renderer tests; full primitive-driven layout (with PrimitiveSpec
 * tag/layout/style) lands in a future session.
 */
export interface ComponentRef {
  kind: "component";
  /** Stable key within the parent's tree. Doubles as the slot prop name. */
  key: string;
  /** ID of the registered component to render here. */
  componentId: ComponentTypeId;
  /** Axis values pinned for this reference. Missing axes use the component's defaults. */
  axisSelection?: Record<string, string>;
  /** Per-reference instance prop overrides — wins over axes/state inside the referenced component. */
  propOverrides?: Record<string, PropValue>;
}

/** Discriminated union for nodes in a component's spec tree. */
export type ComponentSpec = PrimitiveSpec | ComponentRef;

// ── Palette groups ──────────────────────────────────────────
// Every component belongs to exactly one palette group (CLAUDE.md invariant
// #6). Groups are editorial and adjustable as the DS grows; assignment is
// manual — do NOT infer from name or shape.

export type PaletteGroup =
  | "inputs"
  | "content"
  | "containers"
  | "dataDisplay"
  | "navigation"
  | "productSpecific";

// ── Axes and states ─────────────────────────────────────────
// Variants in v4 are matrices of axes (style, size, tone, …) composed
// independently. States (hover, pressed, disabled, …) sit orthogonal to
// axes. AxisOverride and StateOverride are sparse — declare only what
// differs from base.

/**
 * A named dimension of variation on a component. Picking one option per
 * axis yields a variant. Examples: a Button has axes `style` (primary /
 * secondary / ghost) and `size` (sm / md / lg). The 3 × 3 = 9 variants
 * are not enumerated; they emerge from axis selection.
 */
export interface Axis {
  /** Axis identifier — distinct within a Component. */
  name: string;
  /** Allowed values for this axis. Order is presentation order in the family view. */
  options: string[];
  /** Option used when an axis is unspecified. Must be one of `options`. */
  default: string;
}

/**
 * Interaction / context state. States are orthogonal to axes — a
 * `primary, lg` Button can independently be in `hover` or `disabled`.
 * Components declare which states they support; `default` is implicit
 * but should appear in `supportedStates` for explicitness.
 *
 * Open union (string-typed) so individual components or future sessions
 * can introduce new states without modifying this type — but the names
 * below are the canonical set the inspector knows about.
 */
export type StateName =
  | "default"
  | "hover"
  | "pressed"
  | "disabled"
  | "loading"
  | "error"
  | "focus"
  | "selected";

/**
 * Property overrides that apply when a specific axis combination is
 * selected. Sparse: only declare the props that differ from base.
 *
 * `axisSelection` is matched as a subset of the instance's full axis
 * selection. A partial selection (e.g. `{ style: "primary" }` on a
 * component with both `style` and `size` axes) acts as a wildcard for
 * the unspecified axes — the override applies to every `size` option
 * for `style: primary`. The resolver layers all matching overrides in
 * declaration order; later (more-specific) overrides win.
 */
export interface AxisOverride {
  axisSelection: Record<string, string>;
  props: Record<string, PropValue>;
}

/**
 * Property overrides that apply when the component is in a given state.
 * Sparse: only declare the props that change for this state. State
 * overrides apply on top of axis overrides; the instance always wins
 * over both (see four-layer resolution in `resolve.ts`).
 */
export interface StateOverride {
  state: StateName;
  props: Record<string, PropValue>;
}

/**
 * Snapshot of a Component's overrides at a given publishedVersion.
 * Both axisOverrides and stateOverrides snapshot together — they're
 * both part of "what the design system looked like at this version."
 */
export interface ComponentOverrideSnapshot {
  axisOverrides: AxisOverride[];
  stateOverrides: StateOverride[];
}

// ── Prop schema ─────────────────────────────────────────────
// Declarative metadata about each editable prop. Drives the inspector's
// grouping (Tokens vs Content), the token-category narrowing in the
// picker, and the labels shown to editors. Required on every ingested
// component per docs/COMPONENT_AUTHORING.md.

export type PropCategory = "token" | "content";

export type ContentKind = "text" | "multiline" | "number" | "boolean";

export interface PropSchemaEntry {
  category: PropCategory;
  /** Required when category==="token". Narrows the token picker roster. */
  tokenCategory?: TokenCategory;
  /** Required when category==="content". Picks the input kind. */
  contentKind?: ContentKind;
  /** Display label; defaults to the prop key. */
  label?: string;
  /** Optional sub-grouping label within a category. */
  group?: string;
}

export type PropSchema = Record<string, PropSchemaEntry>;

// ── Component (DS member) ────────────────────────────────────
// v4 shape. Variants as flat strings are gone; in their place are
// `axes` + `axisOverrides[]`. States arrive as a vocabulary +
// `stateOverrides[]`. Component-level versioning replaces v3's
// per-variant versioning — see migration runbook for cadence notes.

export interface Component {
  id: ComponentTypeId;
  name: string;
  /**
   * Editorial palette group — required. CLAUDE.md invariant #6: every
   * component must belong to exactly one group. Missing group is a
   * validation error at DS load, not a silent fallback.
   */
  paletteGroup: PaletteGroup;
  /** Structural skeleton. Children may include ComponentRef nodes (Model C — slot composition). */
  baseSpec: PrimitiveSpec;
  /** Editor-local draft overlay on baseSpec.props. Empty when not in base-edit mode. */
  baseDraft?: Record<string, PropValue>;
  /** Dimensions of variation. Empty array means the component has no variants. */
  axes: Axis[];
  /**
   * States this component can be in. Always includes `default`. The
   * inspector and renderer narrow state-aware behavior to this list.
   */
  supportedStates: StateName[];
  /**
   * Editor-local override draft. Both axisOverrides and stateOverrides
   * snapshot together — promoted to `published` on push. Empty arrays
   * when not in component-edit mode.
   */
  draft: ComponentOverrideSnapshot;
  /**
   * Canonical canvas-facing overrides. The resolver reads from here
   * unless the caller is the active editor (see ResolveOptions).
   */
  published: ComponentOverrideSnapshot;
  publishedVersion: number;
  /**
   * Immutable per-version snapshots. Instances pinned to an older
   * version (shipped canvases) resolve against the matching snapshot.
   * Optional for legacy fixture data — the store seeds
   * publishedHistory[publishedVersion] = published on load.
   */
  publishedHistory?: Record<number, ComponentOverrideSnapshot>;
  lastPublishedBy?: string;
  lastPublishedAt?: string;
  /**
   * Schema for every editable prop exposed by this component. The
   * inspector reads this to group fields (Tokens / Content) and narrow
   * the token picker. Props not listed fall back to value-type
   * inference — but every ingested component SHOULD declare propSchema
   * in full. See docs/COMPONENT_AUTHORING.md.
   */
  propSchema?: PropSchema;
  /**
   * When true, the canvas family-view strip is suppressed for instances
   * of this component. Use for structural containers (__root, __row)
   * where "pick a different variant" doesn't make sense.
   */
  hideFamilyView?: boolean;
}

// ── DS rules (placeholder) ───────────────────────────────────

export interface Rule {
  id: string;
  description: string;
}

// ── DesignSystem ─────────────────────────────────────────────

export interface DesignSystem {
  tokens: Record<string, Token>;
  components: Component[];
  rules: Rule[];
}

// ── Canvas model ─────────────────────────────────────────────
// Canvas is the document shape. Must be CRDT-compatible: stable string ids,
// no order-sensitive arrays, no functions, no DOM refs.

export type Viewport = "mobile" | "tablet" | "desktop";

export interface Frame {
  id: string;
  viewport: Viewport;
  position: { x: number; y: number };
  size: { w: number; h: number };
}

export interface Instance {
  id: string;
  componentId: ComponentTypeId;
  /** Pins this instance to a specific axis combination. Missing axes use the component's defaults. */
  axisSelection: Record<string, string>;
  /** Pinned at drop time; version updates are an explicit adopt action. */
  variantVersion: number;
  propOverrides: Record<string, PropValue>;
  /** Relative to the frame it's dropped into. */
  position: { x: number; y: number };
  /** Frame this instance belongs to. */
  frameId: string;
}

/** Reserved — connections between frames arrive with Play mode (session 6). */
export interface Connection {
  id: string;
  fromFrameId: string;
  toFrameId: string;
  label?: string;
}

export interface Canvas {
  id: string;
  name: string;
  status: "draft" | "shipped";
  frames: Frame[];
  instances: Instance[];
  connections: Connection[];
}

// ── Errors ───────────────────────────────────────────────────

export class ComponentNotFoundError extends Error {
  constructor(componentId: string) {
    super(`Component "${componentId}" not found in the design system.`);
    this.name = "ComponentNotFoundError";
  }
}

export class DesignSystemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesignSystemValidationError";
  }
}

// ── Validation ──────────────────────────────────────────────
// Runtime check so dynamically-constructed DS data (e.g. loaded from
// Supabase, or assembled outside the TS compiler's view) can't slip a
// Component through without a paletteGroup, or with an axes/states
// shape that breaks resolver assumptions. TS catches the static cases
// at build; this is the belt.

const PALETTE_GROUPS: readonly PaletteGroup[] = [
  "inputs",
  "content",
  "containers",
  "dataDisplay",
  "navigation",
  "productSpecific",
];

export function validateDesignSystem(ds: DesignSystem): void {
  const problems: string[] = [];
  for (const c of ds.components) {
    if (!c.paletteGroup) {
      problems.push(`Component "${c.id}" is missing paletteGroup`);
    } else if (!PALETTE_GROUPS.includes(c.paletteGroup)) {
      problems.push(
        `Component "${c.id}" has unknown paletteGroup "${c.paletteGroup}" (allowed: ${PALETTE_GROUPS.join(", ")})`,
      );
    }
    if (!Array.isArray(c.axes)) {
      problems.push(`Component "${c.id}" is missing axes (declare [] for no variants)`);
    } else {
      for (const axis of c.axes) {
        if (!axis.options.includes(axis.default)) {
          problems.push(
            `Component "${c.id}" axis "${axis.name}" default "${axis.default}" is not in options [${axis.options.join(", ")}]`,
          );
        }
      }
    }
    if (!Array.isArray(c.supportedStates) || !c.supportedStates.includes("default")) {
      problems.push(`Component "${c.id}" supportedStates must include "default"`);
    }
    if (!c.draft || !Array.isArray(c.draft.axisOverrides) || !Array.isArray(c.draft.stateOverrides)) {
      problems.push(`Component "${c.id}" draft must be { axisOverrides: [], stateOverrides: [] }`);
    }
    if (
      !c.published ||
      !Array.isArray(c.published.axisOverrides) ||
      !Array.isArray(c.published.stateOverrides)
    ) {
      problems.push(
        `Component "${c.id}" published must be { axisOverrides: [...], stateOverrides: [...] }`,
      );
    }
  }
  if (problems.length > 0) {
    throw new DesignSystemValidationError(
      `DesignSystem validation failed:\n  - ${problems.join("\n  - ")}`,
    );
  }
}

// ── EditorAction (reference only — session 1 implements a subset) ────
// Kept here so sessions 2+ have the shape to grow into. The web app's
// Zustand store only implements a subset — see apps/web/src/stores/canvas.ts.

// CLAUDE.md type-system hygiene: ToolMode stays open-ended. Draw and
// annotate aren't wired yet but are reintroduced in later sessions
// (sketch recognition, annotation-based AI). Don't narrow.
export type ToolMode = "select" | "draw" | "annotate" | "hand";

export type EditorAction =
  | { type: "SELECT_INSTANCE"; id: string | null }
  | { type: "UPDATE_INSTANCE_PROPS"; id: string; props: Record<string, PropValue> }
  | {
      type: "ADD_INSTANCE";
      frameId: string;
      componentId: ComponentTypeId;
      axisSelection: Record<string, string>;
      variantVersion: number;
      position: { x: number; y: number };
    }
  | { type: "SET_TOOL"; tool: ToolMode }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_PAN"; pan: { x: number; y: number } };

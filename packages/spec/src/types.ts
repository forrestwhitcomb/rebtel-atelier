import type { Token, TokenCategory, TokenRef } from "./tokens.js";

// ── ComponentSpec tree ───────────────────────────────────────
// Recursive structural description of a component. Lifted from Aphantasia's
// SpecNode, trimmed: no annotations (AI suggestion attachment — session 5),
// no responsiveOverrides (single mobile frame this session), no materialization
// levels or origin tracking.

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

export interface ComponentSpec {
  /** Stable per-spec id (crdt-friendly). */
  id: string;
  /** Component type, e.g. "Button". Resolves via DS registry. */
  type: ComponentTypeId;
  /** Default variant id, or null for spec-only definitions. */
  variant: string | null;
  /** Base props — the floor of three-layer resolution. */
  props: Record<string, PropValue>;
  /** Recursive children. */
  children: ComponentSpec[];
}

// ── Variants ─────────────────────────────────────────────────
// Draft vs published is a real boundary (CLAUDE.md invariant #5).
// publish() is session 3; shape has to be right now.

export type VariantProps = Record<string, PropValue>;

export interface Variant {
  id: string;
  name: string;
  /** Variant inheritance: "base" or another variant id. */
  extends: "base" | string;
  /** Mutable editor state — session 4 syncs this via Yjs. */
  draft: VariantProps;
  /** Canonical canvas-facing state. Publishing promotes draft → published. */
  published: VariantProps;
  publishedVersion: number;
  /**
   * Immutable snapshots keyed by version. Instances pinned to an older version
   * (e.g. on a shipped canvas) resolve against the snapshot, not the latest
   * `published`. Optional for legacy fixture data — the store populates
   * history[publishedVersion] = published on load.
   */
  publishedHistory?: Record<number, VariantProps>;
  lastPublishedBy?: string;
  lastPublishedAt?: string;
}

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

// ── Component (DS member) ────────────────────────────────────

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

export interface Component {
  id: ComponentTypeId;
  name: string;
  /**
   * Editorial palette group — required. CLAUDE.md invariant #6: every
   * component must belong to exactly one group. Missing group is a
   * validation error at DS load, not a silent fallback.
   */
  paletteGroup: PaletteGroup;
  baseSpec: ComponentSpec;
  /** Editor-local draft overlay on baseSpec.props. Empty when not in base-edit mode. */
  baseDraft?: Record<string, PropValue>;
  variants: Variant[];
  version: number;
  /**
   * Schema for every editable prop exposed by this component. The inspector
   * reads this to group fields (Tokens / Content) and narrow the token
   * picker. Props not listed fall back to value-type inference — but every
   * ingested component SHOULD declare propSchema in full. See
   * docs/COMPONENT_AUTHORING.md.
   */
  propSchema?: PropSchema;
  /**
   * When true, the canvas family-view strip is suppressed for instances of
   * this component. Use for structural containers (__root, __row) where
   * "pick a different variant" doesn't make sense.
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
  variantId: string;
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

export class VariantNotFoundError extends Error {
  constructor(componentId: string, variantId: string) {
    super(`Variant "${variantId}" not found on component "${componentId}".`);
    this.name = "VariantNotFoundError";
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
// Component through without a paletteGroup. TS catches this at build for
// statically-authored components; this is the belt.

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
      continue;
    }
    if (!PALETTE_GROUPS.includes(c.paletteGroup)) {
      problems.push(
        `Component "${c.id}" has unknown paletteGroup "${c.paletteGroup}" (allowed: ${PALETTE_GROUPS.join(", ")})`,
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
      variantId: string;
      variantVersion: number;
      position: { x: number; y: number };
    }
  | { type: "SET_TOOL"; tool: ToolMode }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_PAN"; pan: { x: number; y: number } };

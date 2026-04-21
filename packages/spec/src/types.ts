import type { Token, TokenRef } from "./tokens.js";

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
  lastPublishedBy?: string;
  lastPublishedAt?: string;
}

// ── Component (DS member) ────────────────────────────────────

export interface Component {
  id: ComponentTypeId;
  name: string;
  baseSpec: ComponentSpec;
  variants: Variant[];
  version: number;
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

// ── EditorAction (reference only — session 1 implements a subset) ────
// Kept here so sessions 2+ have the shape to grow into. The web app's
// Zustand store only implements a subset — see apps/web/src/stores/canvas.ts.

export type ToolMode = "select" | "hand";

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

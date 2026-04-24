"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  Canvas,
  Component,
  ComponentTypeId,
  DesignSystem,
  Instance,
  PropValue,
  ToolMode,
  Variant,
  VariantProps,
} from "@rebtel-atelier/spec";
import { rebtelDesignSystem } from "@rebtel-atelier/rebtel-ds";

// ── Shape notes ─────────────────────────────────────────────
// Document slice (canvases, designSystem) is structured so it can be moved
// into a Yjs doc without reshape — stable string ids, no order-sensitive
// arrays, no functions, no DOM refs. UI slice (selection/scope/zoom/…)
// stays in Zustand forever; it's session-local per user.
//
// Variant draft state lives on `designSystem.components[i].variants[j].draft`.
// It's editor-local (never persisted, never rendered by non-editing users)
// and reset on publish or exit-without-saving. CLAUDE.md invariant #5:
// draft vs published is a real boundary. The resolver reads draft only when
// the caller opts in via `draftScope`.

export type EditScope = "instance" | "variant" | "base";

/** Right-panel tab: properties editor vs read-only dev handoff. */
export type RightPanelTab = "properties" | "dev";

/** Filter for the per-canvas impact list in the push popup. */
export type PushPopupFilter = "all" | "inProgress" | "shipped";

export interface PublishedPrInfo {
  url: string;
  number: number;
}

/** Which component/variant is currently being edited (scope === 'variant'). */
export interface EditingVariantKey {
  componentId: ComponentTypeId;
  variantId: string;
}

/** Which component is currently being edited (scope === 'base'). */
export interface EditingBaseKey {
  componentId: ComponentTypeId;
}

interface UIState {
  activeCanvasId: string;
  selection: string | null;
  tool: ToolMode;
  zoom: number;
  pan: { x: number; y: number };
  /** Component type id currently being dragged from the rail, or null. */
  draggingComponentId: ComponentTypeId | null;
  editScope: EditScope;
  editingVariantKey: EditingVariantKey | null;
  editingBaseKey: EditingBaseKey | null;
  /** When the user clicks an escalation target but hasn't confirmed yet. */
  pendingScopeEscalation: EditScope | null;
  /** True when the push-confirmation modal is open. */
  pushPopupOpen: boolean;
  /**
   * Per-canvas "adopt new version" choice staged in the push popup. Keyed
   * by canvasId. Populated on popup open (defaults: draft → true,
   * shipped → false) and consumed by publishVariant.
   */
  canvasPublishChoices: Record<string, boolean>;
  /** Filter for the per-canvas impact list. */
  pushPopupFilter: PushPopupFilter;
  /** In-flight publish state. True between request start and response. */
  isPublishing: boolean;
  /** Most recent publish error, shown inline in the popup. */
  publishError: string | null;
  /** PR that just opened — drives the success state + toast link. */
  lastPublishedPr: PublishedPrInfo | null;
  /** Which tab is visible in the right panel when an instance is selected. */
  rightPanelTab: RightPanelTab;
  /**
   * Family-view hover preview: variant id being previewed on the selected
   * instance. Transient render-only state — mutating this does NOT write
   * to the document. Cleared on mouseleave.
   */
  hoveredVariantId: string | null;
  /**
   * Transient toast message shown after non-modal actions (e.g. variant
   * swap). Monotonic id so consecutive identical messages still trigger.
   */
  toast: { id: number; message: string } | null;
}

interface DocState {
  designSystem: DesignSystem;
  canvases: Record<string, Canvas>;
  /** Stable order for UI listing. */
  canvasOrder: string[];
}

interface Actions {
  // UI
  setActiveCanvas: (id: string) => void;
  selectInstance: (id: string | null) => void;
  setTool: (tool: ToolMode) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setDraggingComponentId: (id: ComponentTypeId | null) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;

  // Scope / edit-mode
  /** Click an instance to scope to 'instance' (no confirmation). */
  resetScopeToInstance: () => void;
  /** User clicked 'This variant' or 'Base component' — show inline confirm. */
  requestScopeEscalation: (scope: EditScope) => void;
  /** User clicked the escalated scope a second time — commit and enter edit mode. */
  confirmScopeEscalation: () => void;
  cancelScopeEscalation: () => void;
  /** Exit-without-saving: revert draft and return to instance scope. */
  exitEditMode: () => void;

  // Document — instances
  addInstance: (
    canvasId: string,
    frameId: string,
    componentId: ComponentTypeId,
    variantId: string,
    position: { x: number; y: number },
  ) => string;
  updateInstanceProps: (id: string, props: Record<string, PropValue>) => void;
  setCanvasStatus: (canvasId: string, status: Canvas["status"]) => void;

  // Document — variant / base draft
  updateVariantDraft: (
    componentId: ComponentTypeId,
    variantId: string,
    props: Record<string, PropValue>,
  ) => void;
  updateBaseDraft: (
    componentId: ComponentTypeId,
    props: Record<string, PropValue>,
  ) => void;

  // Publish
  openPushPopup: () => void;
  closePushPopup: () => void;
  publishVariant: (
    componentId: ComponentTypeId,
    variantId: string,
  ) => Promise<{ ok: true; pr: PublishedPrInfo } | { ok: false; error: string }>;
  publishBase: (componentId: ComponentTypeId) => void;
  /** Toggle a single canvas's adopt/stay choice in the popup. */
  setCanvasPublishChoice: (canvasId: string, adopt: boolean) => void;
  setPushPopupFilter: (filter: PushPopupFilter) => void;
  clearPublishError: () => void;

  // Family view
  setHoveredVariantId: (id: string | null) => void;
  /**
   * Swap the selected instance's variantId (instance-level override — no
   * edit module, no variant mutation). Also re-pins variantVersion to the
   * new variant's current publishedVersion.
   */
  swapInstanceVariant: (instanceId: string, nextVariantId: string) => void;
  /**
   * Create a new variant on the component, seeded from the given variant's
   * published + the given instance's overrides. Drops the editor into
   * variant-edit mode on the new variant.
   */
  createVariantFromInstance: (instanceId: string) => string | null;

  // Toast
  showToast: (message: string) => void;
  clearToast: () => void;
}

export type CanvasStore = UIState & DocState & Actions;

// ── Initial document ────────────────────────────────────────

export const demoFrameId = "frame:demo";
export const demo2FrameId = "frame:demo2";

const demoCanvas: Canvas = {
  id: "demo",
  name: "Demo",
  status: "draft",
  frames: [
    {
      id: demoFrameId,
      viewport: "mobile",
      position: { x: 0, y: 0 },
      size: { w: 375, h: 812 },
    },
  ],
  instances: [],
  connections: [],
};

const demo2Canvas: Canvas = {
  id: "demo2",
  name: "Demo 2",
  status: "draft",
  frames: [
    {
      id: demo2FrameId,
      viewport: "mobile",
      position: { x: 0, y: 0 },
      size: { w: 375, h: 812 },
    },
  ],
  // Seeded with a couple of Button-primary instances so the second canvas
  // is a meaningful target for the draft/published verification (check #4)
  // and the shipped-pin verification (check #8).
  instances: [
    {
      id: "inst_seed_demo2_btn_a",
      componentId: "Button",
      variantId: "primary",
      variantVersion: 1,
      propOverrides: { label: "Call now" },
      position: { x: 24, y: 80 },
      frameId: demo2FrameId,
    },
    {
      id: "inst_seed_demo2_btn_b",
      componentId: "Button",
      variantId: "primary",
      variantVersion: 1,
      propOverrides: { label: "Send top-up" },
      position: { x: 24, y: 160 },
      frameId: demo2FrameId,
    },
  ],
  connections: [],
};

// Deep-clone the hardcoded DS so per-tab draft mutations can't leak back
// into the singleton imported module.
function cloneDesignSystem(ds: DesignSystem): DesignSystem {
  return {
    ...ds,
    components: ds.components.map((c) => ({
      ...c,
      baseDraft: c.baseDraft ? { ...c.baseDraft } : {},
      baseSpec: { ...c.baseSpec, props: { ...c.baseSpec.props } },
      variants: c.variants.map((v) => {
        const publishedCopy = { ...v.published };
        // Seed history with the current published version — shipped canvases
        // need to be able to pin to it after future publishes overwrite
        // `published`.
        const history = { ...(v.publishedHistory ?? {}) };
        if (history[v.publishedVersion] === undefined) {
          history[v.publishedVersion] = publishedCopy;
        }
        return {
          ...v,
          draft: { ...v.draft },
          published: publishedCopy,
          publishedHistory: history,
        };
      }),
    })),
  };
}

// ── Helpers on DS ───────────────────────────────────────────

function mapComponent(
  ds: DesignSystem,
  componentId: ComponentTypeId,
  fn: (c: Component) => Component,
): DesignSystem {
  return {
    ...ds,
    components: ds.components.map((c) => (c.id === componentId ? fn(c) : c)),
  };
}

function mapVariant(
  ds: DesignSystem,
  componentId: ComponentTypeId,
  variantId: string,
  fn: (v: Variant) => Variant,
): DesignSystem {
  return mapComponent(ds, componentId, (c) => ({
    ...c,
    variants: c.variants.map((v) => (v.id === variantId ? fn(v) : v)),
  }));
}

// ── Store ───────────────────────────────────────────────────

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // UI
  activeCanvasId: demoCanvas.id,
  selection: null,
  tool: "select",
  zoom: 1,
  pan: { x: 0, y: 0 },
  draggingComponentId: null,
  editScope: "instance",
  editingVariantKey: null,
  editingBaseKey: null,
  pendingScopeEscalation: null,
  pushPopupOpen: false,
  canvasPublishChoices: {},
  pushPopupFilter: "all",
  isPublishing: false,
  publishError: null,
  lastPublishedPr: null,
  rightPanelTab: "properties",
  hoveredVariantId: null,
  toast: null,

  // Document
  designSystem: cloneDesignSystem(rebtelDesignSystem),
  canvases: { [demoCanvas.id]: demoCanvas, [demo2Canvas.id]: demo2Canvas },
  canvasOrder: [demoCanvas.id, demo2Canvas.id],

  // ── UI actions ─────────────────────────────────────────
  setActiveCanvas: (id) => {
    const state = get();
    if (!state.canvases[id]) {
      console.warn(`[canvas store] Unknown canvasId: ${id}`);
      return;
    }
    if (state.activeCanvasId === id) return;
    set({ activeCanvasId: id, selection: null });
  },
  selectInstance: (id) => {
    const current = get().selection;
    if (current === id) return;
    // Selection change clears any transient hover preview to avoid
    // stale-render flashes on the new target.
    set({ selection: id, hoveredVariantId: null });
  },
  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setDraggingComponentId: (draggingComponentId) => set({ draggingComponentId }),
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),

  // ── Scope / edit-mode ─────────────────────────────────
  resetScopeToInstance: () =>
    set({
      editScope: "instance",
      editingVariantKey: null,
      editingBaseKey: null,
      pendingScopeEscalation: null,
    }),

  requestScopeEscalation: (scope) => {
    if (scope === "instance") {
      // Click-to-go-back-to-instance. Exit any in-progress edit first.
      get().exitEditMode();
      return;
    }
    // If already in the requested edit mode, clicking again should do nothing;
    // that's handled by the UI. Otherwise record the pending request.
    set({ pendingScopeEscalation: scope });
  },

  confirmScopeEscalation: () => {
    const state = get();
    const pending = state.pendingScopeEscalation;
    if (!pending || pending === "instance") return;
    const selected = state.selection
      ? state.canvases[state.activeCanvasId]?.instances.find((i) => i.id === state.selection)
      : null;
    if (!selected) {
      console.warn("[canvas store] confirmScopeEscalation: no selection");
      set({ pendingScopeEscalation: null });
      return;
    }

    if (pending === "variant") {
      set({
        editScope: "variant",
        editingVariantKey: {
          componentId: selected.componentId,
          variantId: selected.variantId,
        },
        editingBaseKey: null,
        pendingScopeEscalation: null,
      });
      return;
    }

    // base
    set({
      editScope: "base",
      editingBaseKey: { componentId: selected.componentId },
      editingVariantKey: null,
      pendingScopeEscalation: null,
    });
  },

  cancelScopeEscalation: () => set({ pendingScopeEscalation: null }),

  exitEditMode: () => {
    const state = get();
    if (state.editScope === "instance") {
      set({ pendingScopeEscalation: null });
      return;
    }
    // Revert the draft overlay to empty. Published is untouched.
    let nextDs = state.designSystem;
    if (state.editScope === "variant" && state.editingVariantKey) {
      const { componentId, variantId } = state.editingVariantKey;
      nextDs = mapVariant(nextDs, componentId, variantId, (v) => ({ ...v, draft: {} }));
    } else if (state.editScope === "base" && state.editingBaseKey) {
      const { componentId } = state.editingBaseKey;
      nextDs = mapComponent(nextDs, componentId, (c) => ({ ...c, baseDraft: {} }));
    }
    set({
      designSystem: nextDs,
      editScope: "instance",
      editingVariantKey: null,
      editingBaseKey: null,
      pendingScopeEscalation: null,
      pushPopupOpen: false,
    });
  },

  // ── Document actions ─────────────────────────────────
  addInstance: (canvasId, frameId, componentId, variantId, position) => {
    const state = get();
    const canvas = state.canvases[canvasId];
    if (!canvas) {
      console.warn(`[canvas store] addInstance: unknown canvasId ${canvasId}`);
      return "";
    }
    const component = state.designSystem.components.find((c) => c.id === componentId);
    if (!component) {
      console.warn(`[canvas store] addInstance: unknown componentId ${componentId}`);
      return "";
    }
    const variant = component.variants.find((v) => v.id === variantId);
    const pinnedVersion = variant?.publishedVersion ?? 1;
    const id = `inst_${nanoid(8)}`;
    const instance: Instance = {
      id,
      componentId,
      variantId,
      variantVersion: pinnedVersion,
      propOverrides: {},
      position,
      frameId,
    };
    set({
      canvases: {
        ...state.canvases,
        [canvasId]: { ...canvas, instances: [...canvas.instances, instance] },
      },
      selection: id,
    });
    return id;
  },

  updateInstanceProps: (id, props) =>
    set((s) => {
      const next: Record<string, Canvas> = {};
      for (const [cid, c] of Object.entries(s.canvases)) {
        const instances = c.instances.map((inst) =>
          inst.id === id
            ? { ...inst, propOverrides: { ...inst.propOverrides, ...props } }
            : inst,
        );
        next[cid] = instances === c.instances ? c : { ...c, instances };
      }
      return { canvases: next };
    }),

  setCanvasStatus: (canvasId, status) =>
    set((s) => {
      const c = s.canvases[canvasId];
      if (!c) return {};
      return {
        canvases: { ...s.canvases, [canvasId]: { ...c, status } },
      };
    }),

  updateVariantDraft: (componentId, variantId, props) =>
    set((s) => ({
      designSystem: mapVariant(s.designSystem, componentId, variantId, (v) => ({
        ...v,
        draft: { ...v.draft, ...props },
      })),
    })),

  updateBaseDraft: (componentId, props) =>
    set((s) => ({
      designSystem: mapComponent(s.designSystem, componentId, (c) => ({
        ...c,
        baseDraft: { ...(c.baseDraft ?? {}), ...props },
      })),
    })),

  // ── Publish ─────────────────────────────────────────
  openPushPopup: () => {
    const state = get();
    // Seed per-canvas adopt choices for the variant being pushed. Draft
    // canvases adopt by default; shipped canvases stay pinned. Only
    // canvases that actually use this variant get an entry.
    const choices: Record<string, boolean> = {};
    if (state.editScope === "variant" && state.editingVariantKey) {
      const { componentId, variantId } = state.editingVariantKey;
      for (const c of Object.values(state.canvases)) {
        const uses = c.instances.some(
          (i) => i.componentId === componentId && i.variantId === variantId,
        );
        if (!uses) continue;
        choices[c.id] = c.status === "draft";
      }
    }
    set({
      pushPopupOpen: true,
      canvasPublishChoices: choices,
      pushPopupFilter: "all",
      publishError: null,
      lastPublishedPr: null,
    });
  },
  closePushPopup: () =>
    set({
      pushPopupOpen: false,
      canvasPublishChoices: {},
      publishError: null,
      // lastPublishedPr intentionally kept — callers like the toast need
      // to read it after the popup closes.
    }),
  setCanvasPublishChoice: (canvasId, adopt) =>
    set((s) => ({ canvasPublishChoices: { ...s.canvasPublishChoices, [canvasId]: adopt } })),
  setPushPopupFilter: (filter) => set({ pushPopupFilter: filter }),
  clearPublishError: () => set({ publishError: null }),

  publishVariant: async (componentId, variantId) => {
    const state = get();
    const component = state.designSystem.components.find((c) => c.id === componentId);
    const variant = component?.variants.find((v) => v.id === variantId);
    if (!component || !variant) {
      return { ok: false, error: "Component or variant not found" };
    }

    const previousVersion = variant.publishedVersion;
    const nextVersion = previousVersion + 1;
    const nextPublished: VariantProps = { ...variant.published, ...variant.draft };

    // Snapshot variants pre and post for the API request body (commit
    // message + PR body need the diff rendered server-side).
    const variantBefore: Variant = {
      ...variant,
      draft: {},
      publishedHistory: undefined,
    };
    const variantAfter: Variant = {
      ...variant,
      draft: {},
      published: nextPublished,
      publishedVersion: nextVersion,
      publishedHistory: undefined,
    };

    // Post-publish component shape — what the generator serializes into
    // the shipped .variants.ts file.
    const componentForPublish: Component = {
      ...component,
      variants: component.variants.map((v) =>
        v.id === variantId ? variantAfter : { ...v, draft: {}, publishedHistory: undefined },
      ),
    };

    // Build impact rows honoring the popup's per-canvas adopt choices.
    const choices = state.canvasPublishChoices;
    const impacts = Object.values(state.canvases)
      .map((c) => {
        const instanceCount = c.instances.reduce(
          (n, i) => (i.componentId === componentId && i.variantId === variantId ? n + 1 : n),
          0,
        );
        if (instanceCount === 0) return null;
        const adopt = choices[c.id] ?? c.status === "draft";
        return {
          canvasId: c.id,
          canvasName: c.name,
          instanceCount,
          status: c.status,
          adoptsNewVersion: adopt,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    set({ isPublishing: true, publishError: null });

    // ── GitHub side — load-bearing. If this fails, nothing in the
    // store changes; Supabase write below is also skipped.
    let prInfo: PublishedPrInfo;
    try {
      const res = await fetch("/api/publish-variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          component: componentForPublish,
          variantBefore,
          variantAfter,
          impacts,
          editor: "Forrest",
        }),
      });
      const json = (await res.json()) as
        | { ok: true; pr: { number: number; url: string } }
        | { ok: false; error: string };
      if (!res.ok || !("ok" in json) || !json.ok) {
        const msg = "error" in json ? json.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      prInfo = { url: json.pr.url, number: json.pr.number };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isPublishing: false, publishError: msg });
      return { ok: false, error: msg };
    }

    // ── Supabase side — stubbed for session 3 (no persistence yet).
    // When we wire it up, a failure here rolls back by closing the PR.
    // Shape of rollback:
    //   await fetch('/api/rollback-pr', { body: { number: prInfo.number } });
    //   set({ isPublishing: false, publishError: supabaseErr });
    //   return { ok: false, error: supabaseErr };
    // Leaving the comment rather than the code so the write path stays
    // honest about what isn't implemented.

    // ── Apply local document state. Promote draft → published, bump
    // version, snapshot into history so pinned canvases can resolve
    // back to prior versions.
    const nextDs = mapVariant(state.designSystem, componentId, variantId, (v) => ({
      ...v,
      published: nextPublished,
      draft: {},
      publishedVersion: nextVersion,
      publishedHistory: {
        ...(v.publishedHistory ?? {}),
        [nextVersion]: nextPublished,
      },
      lastPublishedAt: new Date().toISOString(),
      lastPublishedBy: "forrest@rebtel",
    }));

    // Per-canvas adoption: bump variantVersion on canvases where the
    // user chose "adopt new version" (default: true for draft, false
    // for shipped — set by the popup).
    const nextCanvases: Record<string, Canvas> = {};
    for (const [cid, c] of Object.entries(state.canvases)) {
      const adopt = choices[cid] ?? c.status === "draft";
      if (!adopt) {
        nextCanvases[cid] = c;
        continue;
      }
      let mutated = false;
      const instances = c.instances.map((inst) => {
        if (
          inst.componentId === componentId &&
          inst.variantId === variantId &&
          inst.variantVersion !== nextVersion
        ) {
          mutated = true;
          return { ...inst, variantVersion: nextVersion };
        }
        return inst;
      });
      nextCanvases[cid] = mutated ? { ...c, instances } : c;
    }

    set({
      designSystem: nextDs,
      canvases: nextCanvases,
      editScope: "instance",
      editingVariantKey: null,
      isPublishing: false,
      publishError: null,
      lastPublishedPr: prInfo,
      // Leave pushPopupOpen: true so the user sees the success state with
      // the PR link. closePushPopup() (called on "Done" / backdrop click)
      // resets canvasPublishChoices and pushPopupOpen together.
    });

    // Queue a toast with the PR link for the canvas after the popup closes.
    get().showToast(`${component.name} · ${variant.name} published · ${prInfo.url}`);

    return { ok: true, pr: prInfo };
  },

  publishBase: (componentId) => {
    const state = get();
    const component = state.designSystem.components.find((c) => c.id === componentId);
    if (!component) return;
    const baseDraft = component.baseDraft ?? {};
    if (Object.keys(baseDraft).length === 0) return;

    // Promote baseDraft → baseSpec.props, bump component.version, clear draft.
    const previousVersion = component.version;
    const nextVersion = previousVersion + 1;
    const nextDs = mapComponent(state.designSystem, componentId, (c) => ({
      ...c,
      baseSpec: { ...c.baseSpec, props: { ...c.baseSpec.props, ...baseDraft } },
      baseDraft: {},
      version: nextVersion,
    }));

    // Base edits don't change variantVersion per-se, but the brief says base
    // changes cascade to all variants and all instances. For session 2 the
    // pinning semantics on base are simpler: draft canvases reflect the new
    // base; shipped canvases stay on the old base by pinning their instances
    // to the now-snapshot's resolved values. We don't materialize that here
    // (requires a base-version pin on Instance that we haven't designed yet);
    // we just flag it in the console.
    console.log("[publish] PR would open here", {
      componentId,
      kind: "base",
      fromVersion: previousVersion,
      toVersion: nextVersion,
      diff: baseDraft,
    });

    set({
      designSystem: nextDs,
      editScope: "instance",
      editingBaseKey: null,
      pushPopupOpen: false,
    });
  },

  // ── Family view ─────────────────────────────────────────
  setHoveredVariantId: (id) => set({ hoveredVariantId: id }),

  swapInstanceVariant: (instanceId, nextVariantId) => {
    const state = get();
    // Find the instance to discover its componentId (instances may live on any canvas).
    let instComponentId: ComponentTypeId | null = null;
    for (const c of Object.values(state.canvases)) {
      const hit = c.instances.find((i) => i.id === instanceId);
      if (hit) {
        instComponentId = hit.componentId;
        break;
      }
    }
    if (!instComponentId) return;

    const component = state.designSystem.components.find((c) => c.id === instComponentId);
    const nextVariant = component?.variants.find((v) => v.id === nextVariantId);
    if (!component || !nextVariant) return;

    const nextCanvases: Record<string, Canvas> = {};
    for (const [cid, c] of Object.entries(state.canvases)) {
      const instances = c.instances.map((inst) =>
        inst.id === instanceId
          ? { ...inst, variantId: nextVariantId, variantVersion: nextVariant.publishedVersion }
          : inst,
      );
      nextCanvases[cid] = instances === c.instances ? c : { ...c, instances };
    }
    set({ canvases: nextCanvases });
    get().showToast(`Swapped to ${nextVariant.name} · instance override`);
  },

  createVariantFromInstance: (instanceId) => {
    const state = get();
    let inst: Instance | undefined;
    for (const c of Object.values(state.canvases)) {
      inst = c.instances.find((i) => i.id === instanceId);
      if (inst) break;
    }
    if (!inst) return null;

    const component = state.designSystem.components.find((c) => c.id === inst!.componentId);
    const currentVariant = component?.variants.find((v) => v.id === inst!.variantId);
    if (!component || !currentVariant) return null;

    // Auto-generate id from component id and next ordinal.
    const newOrdinal = component.variants.length + 1;
    const newId = `${component.id.toLowerCase()}-variant-${newOrdinal}`;
    // New variant seeded from current variant's published + instance overrides.
    const seededPublished: VariantProps = {
      ...currentVariant.published,
      ...(inst.propOverrides as VariantProps),
    };
    const newVariant: Variant = {
      id: newId,
      name: newId,
      extends: "base",
      draft: {},
      published: seededPublished,
      publishedVersion: 1,
      publishedHistory: { 1: seededPublished },
    };

    const nextDs = mapComponent(state.designSystem, component.id, (c) => ({
      ...c,
      variants: [...c.variants, newVariant],
    }));

    set({
      designSystem: nextDs,
      editScope: "variant",
      editingVariantKey: { componentId: component.id, variantId: newId },
      editingBaseKey: null,
      pendingScopeEscalation: null,
      hoveredVariantId: null,
    });
    return newId;
  },

  // ── Toast ──────────────────────────────────────────────
  showToast: (message) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    set({ toast: { id, message } });
  },
  clearToast: () => set({ toast: null }),
}));

// Dev-only convenience: expose the store on window so the verification
// walkthrough can drive flows without replicating dnd-kit pointer math.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __ATELIER_STORE__?: typeof useCanvasStore }).__ATELIER_STORE__ =
    useCanvasStore;
}

// ── Selectors (stable refs via useShallow callsites — simple derived only) ─

/** Get the currently-active Canvas object (or undefined during init). */
export function selectActiveCanvas(s: CanvasStore): Canvas | undefined {
  return s.canvases[s.activeCanvasId];
}

// Helpers that operate on primitive slices — safe to call in the component
// render body (not inside a zustand selector, which would trip the snapshot
// cache on fresh object returns).

export function countFromCanvases(
  canvases: Record<string, Canvas>,
  componentId: ComponentTypeId,
  variantId: string,
): { instanceCount: number; canvasCount: number } {
  let instanceCount = 0;
  let canvasCount = 0;
  for (const c of Object.values(canvases)) {
    let canvasHas = false;
    for (const inst of c.instances) {
      if (inst.componentId === componentId && inst.variantId === variantId) {
        instanceCount += 1;
        canvasHas = true;
      }
    }
    if (canvasHas) canvasCount += 1;
  }
  return { instanceCount, canvasCount };
}

/** Instances of a specific variant on a specific canvas — for family-view usage counts. */
export function countVariantUsageOnCanvas(
  canvas: Canvas,
  componentId: ComponentTypeId,
  variantId: string,
): number {
  let n = 0;
  for (const inst of canvas.instances) {
    if (inst.componentId === componentId && inst.variantId === variantId) n += 1;
  }
  return n;
}

/**
 * Pure scoring for the component-swap stub. For session 2b this drives a
 * console.log; session 3 wires it into UI.
 *
 * - shapeScore: Jaccard of baseSpec.props keys (overlap / union).
 * - coOccurrenceScore: share of canvases where BOTH components appear.
 *   Weak signal — we don't have nested components yet, so "same canvas"
 *   is the best proxy for "reasonably replaces".
 * - total: weighted sum (shape dominant, co-occurrence as tiebreaker).
 */
export interface SwapCandidate {
  componentId: ComponentTypeId;
  componentName: string;
  shapeScore: number;
  coOccurrenceScore: number;
  total: number;
}

export function scoreSwapCandidates(
  designSystem: DesignSystem,
  canvases: Record<string, Canvas>,
  sourceComponentId: ComponentTypeId,
): SwapCandidate[] {
  const source = designSystem.components.find((c) => c.id === sourceComponentId);
  if (!source) return [];

  const sourceKeys = new Set(Object.keys(source.baseSpec.props));
  const canvasList = Object.values(canvases);
  const totalCanvases = canvasList.length || 1;
  const canvasesWithSource = canvasList.filter((c) =>
    c.instances.some((i) => i.componentId === sourceComponentId),
  );

  const candidates: SwapCandidate[] = [];
  for (const c of designSystem.components) {
    if (c.id === sourceComponentId) continue;
    const theirKeys = new Set(Object.keys(c.baseSpec.props));
    let intersection = 0;
    for (const k of sourceKeys) if (theirKeys.has(k)) intersection += 1;
    const unionSize = new Set([...sourceKeys, ...theirKeys]).size || 1;
    const shapeScore = intersection / unionSize;

    let coCount = 0;
    for (const canvas of canvasesWithSource) {
      if (canvas.instances.some((i) => i.componentId === c.id)) coCount += 1;
    }
    const coOccurrenceScore = coCount / totalCanvases;

    candidates.push({
      componentId: c.id,
      componentName: c.name,
      shapeScore,
      coOccurrenceScore,
      // Shape is the primary signal; co-occurrence breaks ties at small scales.
      total: shapeScore * 0.8 + coOccurrenceScore * 0.2,
    });
  }

  candidates.sort((a, b) => b.total - a.total);
  return candidates;
}

export function countFromCanvasesByComponent(
  canvases: Record<string, Canvas>,
  componentId: ComponentTypeId,
  variantCount: number,
): { instanceCount: number; canvasCount: number; variantCount: number } {
  let instanceCount = 0;
  let canvasCount = 0;
  for (const c of Object.values(canvases)) {
    let canvasHas = false;
    for (const inst of c.instances) {
      if (inst.componentId === componentId) {
        instanceCount += 1;
        canvasHas = true;
      }
    }
    if (canvasHas) canvasCount += 1;
  }
  return { instanceCount, canvasCount, variantCount };
}

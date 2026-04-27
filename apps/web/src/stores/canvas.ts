"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  AxisOverride,
  Canvas,
  Component,
  ComponentTypeId,
  DesignSystem,
  Instance,
  PropValue,
  ToolMode,
} from "@rebtel-atelier/spec";
import { defaultAxisSelectionFor, resolveProps } from "@rebtel-atelier/spec";
import { rebtelDesignSystem } from "@rebtel-atelier/rebtel-ds";

// ── Shape notes ─────────────────────────────────────────────
// Document slice (canvases, designSystem) is structured so it can be moved
// into a Yjs doc without reshape — stable string ids, no order-sensitive
// arrays, no functions, no DOM refs. UI slice (selection/scope/zoom/…)
// stays in Zustand forever; it's session-local per user.
//
// v4 model (session 3.5 chunk 2):
// - Component carries `draft` and `published` snapshots
//   ({ axisOverrides, stateOverrides }). Editing modifies the draft;
//   publish promotes draft → published and bumps publishedVersion.
// - Instances pin to a component via `componentId` + `axisSelection`.
//   No more `variantId` — variants are axis combinations.
// - "Editing a variant" in the UI now means editing one specific axis
//   combination's draft override entry on its component. The user-facing
//   word stays "variant" through chunk 2; the UI surface gets the axes
//   treatment in 3.5b.

export type EditScope = "instance" | "variant" | "base";

/** Right-panel tab: properties editor vs read-only dev handoff. */
export type RightPanelTab = "properties" | "dev";

/** Filter for the per-canvas impact list in the push popup. */
export type PushPopupFilter = "all" | "inProgress" | "shipped";

export interface PublishedPrInfo {
  url: string;
  number: number;
}

/**
 * Identifies a single axis combination on a component being edited.
 * The combination is what the user-facing "variant" word means in v4.
 * `axisSelection: {}` is the implicit single combination of an
 * axis-less component (e.g. CountryPicker).
 */
export interface EditingAxisCombinationKey {
  componentId: ComponentTypeId;
  axisSelection: Record<string, string>;
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
  editingAxisCombinationKey: EditingAxisCombinationKey | null;
  editingBaseKey: EditingBaseKey | null;
  /** When the user clicks an escalation target but hasn't confirmed yet. */
  pendingScopeEscalation: EditScope | null;
  /** True when the push-confirmation modal is open. */
  pushPopupOpen: boolean;
  /**
   * Per-canvas "adopt new version" choice staged in the push popup. Keyed
   * by canvasId. Populated on popup open (defaults: draft → true,
   * shipped → false) and consumed by publishComponent.
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
   * Family-view hover preview: axis selection being previewed on the
   * selected instance. Transient render-only state — mutating this does
   * NOT write to the document. Cleared on mouseleave.
   */
  hoveredAxisSelection: Record<string, string> | null;
  /**
   * Library palette collapse state, keyed by PaletteGroup id. `true` =
   * collapsed, missing/undefined = expanded. Session-local only; not
   * persisted to Supabase (groups are editorial — their identities can
   * change between sessions).
   */
  collapsedLibraryGroups: Record<string, boolean>;
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
  /** Toggle a palette group's collapsed state in the left rail. */
  toggleLibraryGroup: (group: string) => void;

  // Scope / edit-mode
  resetScopeToInstance: () => void;
  requestScopeEscalation: (scope: EditScope) => void;
  confirmScopeEscalation: () => void;
  cancelScopeEscalation: () => void;
  exitEditMode: () => void;

  // Document — instances
  addInstance: (
    canvasId: string,
    frameId: string,
    componentId: ComponentTypeId,
    axisSelection: Record<string, string>,
    position: { x: number; y: number },
  ) => string;
  updateInstanceProps: (id: string, props: Record<string, PropValue>) => void;
  setCanvasStatus: (canvasId: string, status: Canvas["status"]) => void;

  // Document — component / base draft
  /**
   * Add or update an axis-override draft entry for a specific axis
   * combination. Idempotent on `axisSelection` deep-equality — calling
   * twice for the same combination updates the existing draft entry.
   */
  updateAxisOverrideDraft: (
    componentId: ComponentTypeId,
    axisSelection: Record<string, string>,
    props: Record<string, PropValue>,
  ) => void;
  updateBaseDraft: (
    componentId: ComponentTypeId,
    props: Record<string, PropValue>,
  ) => void;

  // Publish
  openPushPopup: () => void;
  closePushPopup: () => void;
  /**
   * Publish all pending draft overrides (axis + state) on a component.
   * Bumps publishedVersion, snapshots into publishedHistory, opens a PR
   * via /api/publish-variant. Per-canvas adopt choices in
   * `canvasPublishChoices` decide whether each canvas's instances of
   * this component bump their pinned variantVersion.
   */
  publishComponent: (
    componentId: ComponentTypeId,
  ) => Promise<{ ok: true; pr: PublishedPrInfo } | { ok: false; error: string }>;
  publishBase: (componentId: ComponentTypeId) => void;
  setCanvasPublishChoice: (canvasId: string, adopt: boolean) => void;
  setPushPopupFilter: (filter: PushPopupFilter) => void;
  clearPublishError: () => void;

  // Family view
  setHoveredAxisSelection: (sel: Record<string, string> | null) => void;
  /**
   * Set the selected instance's axisSelection (instance-level swap — no
   * edit module, no draft mutation). Re-pins variantVersion to the
   * component's current publishedVersion.
   */
  setInstanceAxisSelection: (
    instanceId: string,
    axisSelection: Record<string, string>,
  ) => void;
  /**
   * Add a new option to the component's first axis, seeded from the
   * given instance's resolved props. Drops the editor into variant-edit
   * mode on the new combination. Returns the new option name, or null
   * if the component has no axes (no place to add an option).
   *
   * `axisName` targets a specific axis; defaults to the first axis for
   * back-compat (family view's per-axis + buttons pass the axis name).
   */
  createAxisOptionFromInstance: (instanceId: string, axisName?: string) => string | null;

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
  // Seeded with two Button instances on the primary style axis. v4
  // shape: axisSelection replaces variantId.
  instances: [
    {
      id: "inst_seed_demo2_btn_a",
      componentId: "Button",
      axisSelection: { style: "primary" },
      variantVersion: 1,
      propOverrides: { label: "Call now" },
      position: { x: 24, y: 80 },
      frameId: demo2FrameId,
    },
    {
      id: "inst_seed_demo2_btn_b",
      componentId: "Button",
      axisSelection: { style: "primary" },
      variantVersion: 1,
      propOverrides: { label: "Send top-up" },
      position: { x: 24, y: 160 },
      frameId: demo2FrameId,
    },
  ],
  connections: [],
};

// Deep-clone the hardcoded DS so per-tab draft mutations can't leak back
// into the singleton imported module. v4 shape: clone draft / published
// snapshots and the publishedHistory map.
function cloneDesignSystem(ds: DesignSystem): DesignSystem {
  return {
    ...ds,
    components: ds.components.map((c) => {
      const cloneSnapshot = (snap: Component["published"]): Component["published"] => ({
        axisOverrides: snap.axisOverrides.map((o) => ({
          axisSelection: { ...o.axisSelection },
          props: { ...o.props },
        })),
        stateOverrides: snap.stateOverrides.map((o) => ({
          state: o.state,
          props: { ...o.props },
        })),
      });

      const history: Record<number, Component["published"]> = {};
      for (const [v, snap] of Object.entries(c.publishedHistory ?? {})) {
        history[Number(v)] = cloneSnapshot(snap);
      }
      // Seed history with the current published version so shipped
      // canvases can pin to it after future publishes overwrite
      // `published`.
      if (history[c.publishedVersion] === undefined) {
        history[c.publishedVersion] = cloneSnapshot(c.published);
      }

      return {
        ...c,
        baseDraft: c.baseDraft ? { ...c.baseDraft } : {},
        baseSpec: {
          ...c.baseSpec,
          props: { ...c.baseSpec.props },
          children: c.baseSpec.children.map((child) =>
            child.kind === "primitive"
              ? {
                  ...child,
                  props: { ...child.props },
                  children: [...child.children],
                }
              : { ...child, axisSelection: child.axisSelection ? { ...child.axisSelection } : undefined, propOverrides: child.propOverrides ? { ...child.propOverrides } : undefined },
          ),
        },
        axes: c.axes.map((a) => ({ name: a.name, options: [...a.options], default: a.default })),
        supportedStates: [...c.supportedStates],
        draft: cloneSnapshot(c.draft),
        published: cloneSnapshot(c.published),
        publishedHistory: history,
      };
    }),
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

/** Deep-equality check for axisSelection records. Order-independent. */
export function axisSelectionsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/**
 * Upsert a draft axis override on a component. Preserves the existing
 * entry's prop bag and merges the incoming props on top. If no matching
 * entry exists yet, append a new one.
 */
function upsertAxisOverrideDraft(
  c: Component,
  axisSelection: Record<string, string>,
  props: Record<string, PropValue>,
): Component {
  const existing = c.draft.axisOverrides.find((o) =>
    axisSelectionsEqual(o.axisSelection, axisSelection),
  );
  let nextOverrides: AxisOverride[];
  if (existing) {
    nextOverrides = c.draft.axisOverrides.map((o) =>
      o === existing ? { ...o, props: { ...o.props, ...props } } : o,
    );
  } else {
    nextOverrides = [
      ...c.draft.axisOverrides,
      { axisSelection: { ...axisSelection }, props: { ...props } },
    ];
  }
  return { ...c, draft: { ...c.draft, axisOverrides: nextOverrides } };
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
  editingAxisCombinationKey: null,
  editingBaseKey: null,
  pendingScopeEscalation: null,
  pushPopupOpen: false,
  canvasPublishChoices: {},
  pushPopupFilter: "all",
  isPublishing: false,
  publishError: null,
  lastPublishedPr: null,
  rightPanelTab: "properties",
  hoveredAxisSelection: null,
  collapsedLibraryGroups: {},
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
    set({ selection: id, hoveredAxisSelection: null });
  },
  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setDraggingComponentId: (draggingComponentId) => set({ draggingComponentId }),
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
  toggleLibraryGroup: (group) =>
    set((s) => ({
      collapsedLibraryGroups: {
        ...s.collapsedLibraryGroups,
        [group]: !s.collapsedLibraryGroups[group],
      },
    })),

  // ── Scope / edit-mode ─────────────────────────────────
  resetScopeToInstance: () =>
    set({
      editScope: "instance",
      editingAxisCombinationKey: null,
      editingBaseKey: null,
      pendingScopeEscalation: null,
    }),

  requestScopeEscalation: (scope) => {
    if (scope === "instance") {
      get().exitEditMode();
      return;
    }
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
        editingAxisCombinationKey: {
          componentId: selected.componentId,
          axisSelection: { ...selected.axisSelection },
        },
        editingBaseKey: null,
        pendingScopeEscalation: null,
      });
      return;
    }

    set({
      editScope: "base",
      editingBaseKey: { componentId: selected.componentId },
      editingAxisCombinationKey: null,
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
    let nextDs = state.designSystem;
    if (state.editScope === "variant" && state.editingAxisCombinationKey) {
      const { componentId } = state.editingAxisCombinationKey;
      nextDs = mapComponent(nextDs, componentId, (c) => ({
        ...c,
        draft: { axisOverrides: [], stateOverrides: [] },
      }));
    } else if (state.editScope === "base" && state.editingBaseKey) {
      const { componentId } = state.editingBaseKey;
      nextDs = mapComponent(nextDs, componentId, (c) => ({ ...c, baseDraft: {} }));
    }
    set({
      designSystem: nextDs,
      editScope: "instance",
      editingAxisCombinationKey: null,
      editingBaseKey: null,
      pendingScopeEscalation: null,
      pushPopupOpen: false,
    });
  },

  // ── Document actions ─────────────────────────────────
  addInstance: (canvasId, frameId, componentId, axisSelection, position) => {
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
    const id = `inst_${nanoid(8)}`;
    const instance: Instance = {
      id,
      componentId,
      axisSelection: { ...axisSelection },
      variantVersion: component.publishedVersion,
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

  updateAxisOverrideDraft: (componentId, axisSelection, props) =>
    set((s) => ({
      designSystem: mapComponent(s.designSystem, componentId, (c) =>
        upsertAxisOverrideDraft(c, axisSelection, props),
      ),
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
    // Per-canvas adopt choices: in v4 the publish bumps the whole
    // component's version, so every canvas with ANY instance of this
    // component is in scope. Default: draft → adopt, shipped → stay.
    const choices: Record<string, boolean> = {};
    let componentId: ComponentTypeId | null = null;
    if (state.editScope === "variant" && state.editingAxisCombinationKey) {
      componentId = state.editingAxisCombinationKey.componentId;
    } else if (state.editScope === "base" && state.editingBaseKey) {
      componentId = state.editingBaseKey.componentId;
    }
    if (componentId) {
      for (const c of Object.values(state.canvases)) {
        const uses = c.instances.some((i) => i.componentId === componentId);
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
    }),
  setCanvasPublishChoice: (canvasId, adopt) =>
    set((s) => ({ canvasPublishChoices: { ...s.canvasPublishChoices, [canvasId]: adopt } })),
  setPushPopupFilter: (filter) => set({ pushPopupFilter: filter }),
  clearPublishError: () => set({ publishError: null }),

  publishComponent: async (componentId) => {
    const state = get();
    const component = state.designSystem.components.find((c) => c.id === componentId);
    if (!component) {
      return { ok: false, error: "Component not found" };
    }

    const previousVersion = component.publishedVersion;
    const nextVersion = previousVersion + 1;

    // Promote draft → published. Each draft axis override merges onto
    // the matching published entry (or appends if no match). State
    // overrides similarly.
    const mergedAxisOverrides: AxisOverride[] = component.published.axisOverrides.map((o) => {
      const draftEntry = component.draft.axisOverrides.find((d) =>
        axisSelectionsEqual(d.axisSelection, o.axisSelection),
      );
      return draftEntry ? { ...o, props: { ...o.props, ...draftEntry.props } } : o;
    });
    for (const draftEntry of component.draft.axisOverrides) {
      const exists = mergedAxisOverrides.some((o) =>
        axisSelectionsEqual(o.axisSelection, draftEntry.axisSelection),
      );
      if (!exists) mergedAxisOverrides.push(draftEntry);
    }
    const mergedStateOverrides = [
      ...component.published.stateOverrides,
      ...component.draft.stateOverrides.filter(
        (d) => !component.published.stateOverrides.some((p) => p.state === d.state),
      ),
    ];
    const nextPublished: Component["published"] = {
      axisOverrides: mergedAxisOverrides,
      stateOverrides: mergedStateOverrides,
    };

    // Shape used by the publish API for commit message + diff +
    // generated file content. Route still expects the legacy v3-shaped
    // payload; the publish package's update lands in the same chunk.
    // Editor name kept stable for now.
    const componentForPublish: Component = {
      ...component,
      draft: { axisOverrides: [], stateOverrides: [] },
      published: nextPublished,
      publishedVersion: nextVersion,
      publishedHistory: undefined,
    };

    // Per-canvas adopt choices: applies to every canvas with any
    // instance of this component.
    const choices = state.canvasPublishChoices;
    const impacts = Object.values(state.canvases)
      .map((c) => {
        const instanceCount = c.instances.reduce(
          (n, i) => (i.componentId === componentId ? n + 1 : n),
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

    let prInfo: PublishedPrInfo;
    try {
      const res = await fetch("/api/publish-variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          component: componentForPublish,
          previousPublished: component.published,
          nextPublished,
          previousVersion,
          nextVersion,
          impacts,
          editor: "Forrest",
        }),
      });
      const rawText = await res.text();
      let parsed:
        | { ok: true; pr: { number: number; url: string } }
        | { ok: false; error: string }
        | null = null;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          // fall through — we'll surface the raw text below
        }
      }
      if (!res.ok || !parsed || !("ok" in parsed) || !parsed.ok) {
        const msg =
          parsed && "error" in parsed
            ? parsed.error
            : rawText
              ? `HTTP ${res.status}: ${rawText.slice(0, 400)}`
              : `HTTP ${res.status} (empty response — check Vercel function logs)`;
        throw new Error(msg);
      }
      prInfo = { url: parsed.pr.url, number: parsed.pr.number };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isPublishing: false, publishError: msg });
      return { ok: false, error: msg };
    }

    // Apply local document state. Snapshot into history so pinned
    // canvases can resolve back to prior versions.
    const nextDs = mapComponent(state.designSystem, componentId, (c) => ({
      ...c,
      published: nextPublished,
      draft: { axisOverrides: [], stateOverrides: [] },
      publishedVersion: nextVersion,
      publishedHistory: {
        ...(c.publishedHistory ?? {}),
        [nextVersion]: nextPublished,
      },
      lastPublishedAt: new Date().toISOString(),
      lastPublishedBy: "forrest@rebtel",
    }));

    // Per-canvas adoption: bump variantVersion on canvases that opted in.
    const nextCanvases: Record<string, Canvas> = {};
    for (const [cid, c] of Object.entries(state.canvases)) {
      const adopt = choices[cid] ?? c.status === "draft";
      if (!adopt) {
        nextCanvases[cid] = c;
        continue;
      }
      let mutated = false;
      const instances = c.instances.map((inst) => {
        if (inst.componentId === componentId && inst.variantVersion !== nextVersion) {
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
      editingAxisCombinationKey: null,
      isPublishing: false,
      publishError: null,
      lastPublishedPr: prInfo,
    });

    get().showToast(`${component.name} published · ${prInfo.url}`);

    return { ok: true, pr: prInfo };
  },

  publishBase: (componentId) => {
    const state = get();
    const component = state.designSystem.components.find((c) => c.id === componentId);
    if (!component) return;
    const baseDraft = component.baseDraft ?? {};
    if (Object.keys(baseDraft).length === 0) return;

    const previousVersion = component.publishedVersion;
    const nextVersion = previousVersion + 1;
    const nextDs = mapComponent(state.designSystem, componentId, (c) => ({
      ...c,
      baseSpec: { ...c.baseSpec, props: { ...c.baseSpec.props, ...baseDraft } },
      baseDraft: {},
      publishedVersion: nextVersion,
    }));

    console.log("[publish] base PR would open here", {
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
  setHoveredAxisSelection: (sel) => set({ hoveredAxisSelection: sel }),

  setInstanceAxisSelection: (instanceId, axisSelection) => {
    const state = get();
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
    if (!component) return;

    const nextCanvases: Record<string, Canvas> = {};
    for (const [cid, c] of Object.entries(state.canvases)) {
      const instances = c.instances.map((inst) =>
        inst.id === instanceId
          ? {
              ...inst,
              axisSelection: { ...axisSelection },
              variantVersion: component.publishedVersion,
            }
          : inst,
      );
      nextCanvases[cid] = instances === c.instances ? c : { ...c, instances };
    }
    set({ canvases: nextCanvases });
    get().showToast(`Swapped variant · instance override`);
  },

  createAxisOptionFromInstance: (instanceId, axisName) => {
    const state = get();
    let inst: Instance | undefined;
    for (const c of Object.values(state.canvases)) {
      inst = c.instances.find((i) => i.id === instanceId);
      if (inst) break;
    }
    if (!inst) return null;

    const component = state.designSystem.components.find((c) => c.id === inst!.componentId);
    if (!component) return null;
    const targetAxis = axisName
      ? component.axes.find((a) => a.name === axisName)
      : component.axes[0];
    if (!targetAxis) {
      // No axes — nothing to add an option to.
      get().showToast(`${component.name} has no variant axis to extend.`);
      return null;
    }

    // Auto-generate option name. Avoid collisions with existing options.
    const existingOptions = new Set(targetAxis.options);
    let ordinal = targetAxis.options.length + 1;
    let newOptionName = `option-${ordinal}`;
    while (existingOptions.has(newOptionName)) {
      ordinal += 1;
      newOptionName = `option-${ordinal}`;
    }

    const newSelection: Record<string, string> = {
      ...inst.axisSelection,
      [targetAxis.name]: newOptionName,
    };

    // Seed the new axisOverride with the resolved props of the source
    // instance (excluding base props that aren't varied — keep the
    // override sparse, only diffs from base).
    const resolved = resolveProps(component, inst.axisSelection, inst.propOverrides);
    const baseProps = component.baseSpec.props;
    const seededProps: Record<string, PropValue> = {};
    for (const [k, v] of Object.entries(resolved)) {
      if (JSON.stringify(baseProps[k]) !== JSON.stringify(v)) {
        seededProps[k] = v;
      }
    }

    const nextDs = mapComponent(state.designSystem, component.id, (c) => ({
      ...c,
      axes: c.axes.map((a) =>
        a.name === targetAxis.name ? { ...a, options: [...a.options, newOptionName] } : a,
      ),
      published: {
        ...c.published,
        axisOverrides: [
          ...c.published.axisOverrides,
          { axisSelection: { ...newSelection }, props: { ...seededProps } },
        ],
      },
    }));

    set({
      designSystem: nextDs,
      editScope: "variant",
      editingAxisCombinationKey: {
        componentId: component.id,
        axisSelection: { ...newSelection },
      },
      editingBaseKey: null,
      pendingScopeEscalation: null,
      hoveredAxisSelection: null,
    });
    return newOptionName;
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

// ── Selectors and helpers ───────────────────────────────────

export function selectActiveCanvas(s: CanvasStore): Canvas | undefined {
  return s.canvases[s.activeCanvasId];
}

/**
 * Count instances on every canvas matching a specific axis combination
 * for a component. Used by the family-view "this combo is used N times
 * here" hint.
 */
export function countAxisCombinationUsage(
  canvases: Record<string, Canvas>,
  componentId: ComponentTypeId,
  axisSelection: Record<string, string>,
): { instanceCount: number; canvasCount: number } {
  let instanceCount = 0;
  let canvasCount = 0;
  for (const c of Object.values(canvases)) {
    let canvasHas = false;
    for (const inst of c.instances) {
      if (inst.componentId !== componentId) continue;
      if (!axisSelectionsEqual(inst.axisSelection, axisSelection)) continue;
      instanceCount += 1;
      canvasHas = true;
    }
    if (canvasHas) canvasCount += 1;
  }
  return { instanceCount, canvasCount };
}

/** Per-canvas count of instances matching one axis combination. */
export function countAxisCombinationOnCanvas(
  canvas: Canvas,
  componentId: ComponentTypeId,
  axisSelection: Record<string, string>,
): number {
  let n = 0;
  for (const inst of canvas.instances) {
    if (inst.componentId !== componentId) continue;
    if (axisSelectionsEqual(inst.axisSelection, axisSelection)) n += 1;
  }
  return n;
}

/** Across-all-canvases count keyed by component only. */
export function countFromCanvasesByComponent(
  canvases: Record<string, Canvas>,
  componentId: ComponentTypeId,
): { instanceCount: number; canvasCount: number } {
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
  return { instanceCount, canvasCount };
}

/**
 * Enumerate every axis combination on a component as a flat list.
 * Single-axis: one entry per option (`primary`, `secondary`, `ghost`).
 * Multi-axis: cartesian product (`primary/sm`, `primary/md`, …).
 * Empty axes: a single entry with `axisSelection: {}` and the
 * synthesized name "default".
 *
 * Family view in chunk 2 still presents these as a flat strip — 3.5b
 * groups them by axis.
 */
export function enumerateAxisCombinations(
  component: Component,
): { axisSelection: Record<string, string>; name: string; key: string }[] {
  if (component.axes.length === 0) {
    return [{ axisSelection: {}, name: "default", key: "default" }];
  }
  let combos: Record<string, string>[] = [{}];
  for (const axis of component.axes) {
    const next: Record<string, string>[] = [];
    for (const combo of combos) {
      for (const opt of axis.options) {
        next.push({ ...combo, [axis.name]: opt });
      }
    }
    combos = next;
  }
  return combos.map((sel) => ({
    axisSelection: sel,
    name: synthesizeVariantName(component, sel),
    key: synthesizeVariantKey(sel),
  }));
}

/** Display name for an axis combination. Single-axis: the value. Multi-axis: joined with " / ". */
export function synthesizeVariantName(
  component: Component,
  axisSelection: Record<string, string>,
): string {
  if (component.axes.length === 0) return "default";
  if (component.axes.length === 1) {
    const axis = component.axes[0]!;
    return axisSelection[axis.name] ?? axis.default;
  }
  return component.axes.map((a) => axisSelection[a.name] ?? a.default).join(" / ");
}

/**
 * Stable React key from an axisSelection. Sorts keys so a re-ordered
 * selection still produces the same string.
 */
export function synthesizeVariantKey(axisSelection: Record<string, string>): string {
  const entries = Object.entries(axisSelection).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "__default__";
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

/** Defaults helper re-exported for the canvas / dnd-kit caller. */
export { defaultAxisSelectionFor };

/**
 * Pure scoring for the component-swap stub. Unchanged from chunk 1 —
 * still operates on baseSpec.props keys.
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
      total: shapeScore * 0.8 + coOccurrenceScore * 0.2,
    });
  }

  candidates.sort((a, b) => b.total - a.total);
  return candidates;
}

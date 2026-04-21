"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  Canvas,
  ComponentTypeId,
  DesignSystem,
  Instance,
  PropValue,
  ToolMode,
} from "@rebtel-atelier/spec";
import { rebtelDesignSystem } from "@rebtel-atelier/rebtel-ds";

// ── Shape notes ─────────────────────────────────────────────
// Document slice (canvas, designSystem) is structured so it can be moved
// into a Yjs doc without reshape — stable string ids, no order-sensitive
// arrays, no functions, no DOM refs. UI slice (selection/tool/zoom/pan)
// stays in Zustand forever; it's session-local per user.

interface UIState {
  selection: string | null;
  tool: ToolMode;
  zoom: number;
  pan: { x: number; y: number };
  /** Component type id currently being dragged from the rail, or null. */
  draggingComponentId: ComponentTypeId | null;
}

interface DocState {
  designSystem: DesignSystem;
  canvas: Canvas;
}

interface Actions {
  // UI
  selectInstance: (id: string | null) => void;
  setTool: (tool: ToolMode) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setDraggingComponentId: (id: ComponentTypeId | null) => void;

  // Document
  addInstance: (
    frameId: string,
    componentId: ComponentTypeId,
    variantId: string,
    position: { x: number; y: number },
  ) => string;
  updateInstanceProps: (id: string, props: Record<string, PropValue>) => void;
}

export type CanvasStore = UIState & DocState & Actions;

// ── Initial document ────────────────────────────────────────

const demoFrameId = "frame:demo";

const initialCanvas: Canvas = {
  id: "canvas:demo",
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

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // UI
  selection: null,
  tool: "select",
  zoom: 1,
  pan: { x: 0, y: 0 },
  draggingComponentId: null,

  // Document
  designSystem: rebtelDesignSystem,
  canvas: initialCanvas,

  // Actions — UI
  selectInstance: (id) => set({ selection: id }),
  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setDraggingComponentId: (draggingComponentId) => set({ draggingComponentId }),

  // Actions — Document
  addInstance: (frameId, componentId, variantId, position) => {
    const state = get();
    const component = state.designSystem.components.find((c) => c.id === componentId);
    if (!component) {
      console.warn(`[canvas store] Unknown componentId: ${componentId}`);
      return "";
    }
    const id = `inst_${nanoid(8)}`;
    const instance: Instance = {
      id,
      componentId,
      variantId,
      variantVersion: component.version,
      propOverrides: {},
      position,
      frameId,
    };
    set((s) => ({
      canvas: { ...s.canvas, instances: [...s.canvas.instances, instance] },
      selection: id,
    }));
    return id;
  },

  updateInstanceProps: (id, props) =>
    set((s) => ({
      canvas: {
        ...s.canvas,
        instances: s.canvas.instances.map((inst) =>
          inst.id === id
            ? { ...inst, propOverrides: { ...inst.propOverrides, ...props } }
            : inst,
        ),
      },
    })),
}));

export { demoFrameId };

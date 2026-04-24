"use client";

import type { CSSProperties } from "react";
import {
  countAxisCombinationUsage,
  countFromCanvasesByComponent,
  synthesizeVariantName,
  useCanvasStore,
} from "@/stores/canvas";

const RAIL_WIDTH = 180;
const PANEL_WIDTH = 260;
const HEADER_HEIGHT = 36;

/**
 * Persistent banner that slides down from the top of the canvas area when
 * the user enters variant-edit or base-edit mode. Ambient announcement —
 * doesn't block further edits, doesn't collapse.
 *
 * The underlying frame shifts down 8px when this appears (see CanvasSurface).
 */
export function EditModule() {
  // Pull primitive slices only — never derive objects inside a selector,
  // or Zustand's snapshot cache trips (useSyncExternalStore → infinite loop).
  const editScope = useCanvasStore((s) => s.editScope);
  const editingAxisCombinationKey = useCanvasStore((s) => s.editingAxisCombinationKey);
  const editingBaseKey = useCanvasStore((s) => s.editingBaseKey);
  const selection = useCanvasStore((s) => s.selection);
  const canvases = useCanvasStore((s) => s.canvases);
  const designSystem = useCanvasStore((s) => s.designSystem);
  const hasSelection = selection !== null;

  const exitEditMode = useCanvasStore((s) => s.exitEditMode);
  const openPushPopup = useCanvasStore((s) => s.openPushPopup);

  if (editScope === "instance") return null;

  let info: {
    kind: "variant" | "base";
    componentName: string;
    variantName: string | null;
    changedKeys: string[];
    instanceCount: number;
    canvasCount: number;
  } | null = null;

  if (editScope === "variant" && editingAxisCombinationKey) {
    const component = designSystem.components.find(
      (c) => c.id === editingAxisCombinationKey.componentId,
    );
    const stats = countAxisCombinationUsage(
      canvases,
      editingAxisCombinationKey.componentId,
      editingAxisCombinationKey.axisSelection,
    );
    // Find the matching draft override entry to surface its changed
    // prop keys as chips. There can be at most one matching entry — the
    // store upserts on axisSelection deep-equality.
    const draftEntry = component?.draft.axisOverrides.find((o) => {
      const a = o.axisSelection;
      const b = editingAxisCombinationKey.axisSelection;
      const ak = Object.keys(a);
      if (ak.length !== Object.keys(b).length) return false;
      return ak.every((k) => a[k] === b[k]);
    });
    info = {
      kind: "variant",
      componentName: component?.name ?? editingAxisCombinationKey.componentId,
      variantName: component
        ? synthesizeVariantName(component, editingAxisCombinationKey.axisSelection)
        : null,
      changedKeys: Object.keys(draftEntry?.props ?? {}),
      instanceCount: stats.instanceCount,
      canvasCount: stats.canvasCount,
    };
  } else if (editScope === "base" && editingBaseKey) {
    const component = designSystem.components.find((c) => c.id === editingBaseKey.componentId);
    const stats = countFromCanvasesByComponent(canvases, editingBaseKey.componentId);
    info = {
      kind: "base",
      componentName: component?.name ?? editingBaseKey.componentId,
      variantName: null,
      changedKeys: Object.keys(component?.baseDraft ?? {}),
      instanceCount: stats.instanceCount,
      canvasCount: stats.canvasCount,
    };
  }

  if (!info) return null;

  const isVariant = info.kind === "variant";
  const stripe = isVariant ? "#b695ff" : "#f4b64b";
  const title = isVariant
    ? `Editing variant · ${info.componentName} / ${info.variantName}`
    : `Editing base component · ${info.componentName}`;
  const affectedText = `Currently affects: ${info.instanceCount} instance${
    info.instanceCount === 1 ? "" : "s"
  } across ${info.canvasCount} canvas${info.canvasCount === 1 ? "" : "es"}`;

  const containerStyle: CSSProperties = {
    position: "absolute",
    top: HEADER_HEIGHT,
    left: RAIL_WIDTH,
    right: hasSelection ? PANEL_WIDTH : 0,
    background: "rgba(20, 22, 30, 0.96)",
    borderBottom: `1px solid ${stripe}`,
    borderTop: `1px solid rgba(255,255,255,0.04)`,
    backdropFilter: "blur(6px)",
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    zIndex: 3,
    minHeight: 56,
    boxSizing: "border-box",
  };

  const stripeStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    background: stripe,
  };

  const chipBase: CSSProperties = {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    border: `1px solid ${stripe}`,
    color: "var(--atelier-panel-text)",
    background: "rgba(0,0,0,0.3)",
    letterSpacing: "0.02em",
  };

  return (
    <div style={containerStyle}>
      <div style={stripeStyle} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 11,
            color: "var(--atelier-panel-muted)",
          }}
        >
          <span>{affectedText}</span>
          {info.changedKeys.length > 0 ? <span style={{ opacity: 0.5 }}>·</span> : null}
          {info.changedKeys.map((k) => (
            <span key={k} style={chipBase}>
              {k}
            </span>
          ))}
          {info.changedKeys.length === 0 ? (
            <span style={{ opacity: 0.5 }}>No changes yet</span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => openPushPopup()}
        disabled={info.changedKeys.length === 0}
        style={{
          padding: "7px 14px",
          borderRadius: 4,
          border: "none",
          background: stripe,
          color: "#0c0e13",
          fontSize: 12,
          fontWeight: 600,
          cursor: info.changedKeys.length === 0 ? "not-allowed" : "pointer",
          opacity: info.changedKeys.length === 0 ? 0.5 : 1,
        }}
      >
        {isVariant ? "Push variant" : "Push to all components"}
      </button>
      <button
        type="button"
        onClick={() => exitEditMode()}
        style={{
          padding: "7px 10px",
          borderRadius: 4,
          border: "1px solid var(--atelier-panel-border)",
          background: "transparent",
          color: "var(--atelier-panel-text)",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Exit without saving
      </button>
    </div>
  );
}

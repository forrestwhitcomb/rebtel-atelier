"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Axis } from "@rebtel-atelier/spec";
import {
  axisSelectionsEqual,
  countAxisCombinationOnCanvas,
  enumerateAxisCombinations,
  scoreSwapCandidates,
  selectActiveCanvas,
  synthesizeVariantName,
  useCanvasStore,
} from "@/stores/canvas";
import { VariantThumbnail } from "./VariantThumbnail";

const STRIP_WIDTH = 540;
const GAP = 12;

type Placement = { kind: "right" | "below" | "above"; left: number; top: number };

/**
 * Anchored to the currently-selected instance. Visible only when the instance's
 * component has more than one variant and the editor isn't in variant/base mode.
 *
 * 3.5b layout: one row per axis. Each row shows a small axis header followed
 * by option thumbnails, plus a per-axis "+ new option" tile. Clicking an
 * option swaps the instance's selection on that axis only (other axes stay).
 *
 * Positioned in screen coordinates (outside the TransformWrapper) so zoom
 * doesn't shrink the strip. We re-measure on pan/zoom/selection change.
 */
export function FamilyView() {
  const selection = useCanvasStore((s) => s.selection);
  const activeCanvas = useCanvasStore(selectActiveCanvas);
  const designSystem = useCanvasStore((s) => s.designSystem);
  const editScope = useCanvasStore((s) => s.editScope);
  const zoom = useCanvasStore((s) => s.zoom);
  const pan = useCanvasStore((s) => s.pan);
  const canvases = useCanvasStore((s) => s.canvases);
  const hoveredAxisSelection = useCanvasStore((s) => s.hoveredAxisSelection);
  const setHoveredAxisSelection = useCanvasStore((s) => s.setHoveredAxisSelection);
  const setInstanceAxisSelection = useCanvasStore((s) => s.setInstanceAxisSelection);
  const createAxisOptionFromInstance = useCanvasStore((s) => s.createAxisOptionFromInstance);

  const stripRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  // Resolve the selected instance + its component.
  const instance = selection
    ? activeCanvas?.instances.find((i) => i.id === selection) ?? null
    : null;
  const component = instance
    ? designSystem.components.find((c) => c.id === instance.componentId) ?? null
    : null;

  // "More than one variant" means the cartesian product of axis options
  // is > 1. Single-axis with 3 options → 3 combos; empty axes → 1 combo.
  // Hide when there's only one combo to pick from (no swap is meaningful).
  const comboCount = component ? enumerateAxisCombinations(component).length : 0;
  const visible =
    !!instance &&
    !!component &&
    comboCount > 1 &&
    editScope === "instance" &&
    !component.hideFamilyView;

  // Re-measure position whenever the selection, pan/zoom, or visibility changes.
  useLayoutEffect(() => {
    if (!visible || !instance) {
      setPlacement(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-instance-id="${instance.id}"]`,
      );
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const stripH = stripRef.current?.offsetHeight ?? 180;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Prefer right of the instance.
      const rightLeft = rect.right + GAP;
      const rightTop = Math.max(
        12,
        Math.min(vh - stripH - 12, rect.top + rect.height / 2 - stripH / 2),
      );
      if (rightLeft + STRIP_WIDTH <= vw - 12) {
        setPlacement({ kind: "right", left: rightLeft, top: rightTop });
        return;
      }

      // Try below.
      const belowTop = rect.bottom + GAP;
      const belowLeft = Math.max(
        12,
        Math.min(vw - STRIP_WIDTH - 12, rect.left + rect.width / 2 - STRIP_WIDTH / 2),
      );
      if (belowTop + stripH <= vh - 12) {
        setPlacement({ kind: "below", left: belowLeft, top: belowTop });
        return;
      }

      // Above.
      const aboveTop = Math.max(12, rect.top - stripH - GAP);
      setPlacement({ kind: "above", left: belowLeft, top: aboveTop });
    };

    measure();
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [visible, instance, zoom, pan.x, pan.y, activeCanvas?.id]);

  useEffect(() => {
    if (!visible) return;
    const onResize = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-instance-id="${instance?.id ?? ""}"]`,
      );
      if (!el || !stripRef.current) return;
      const rect = el.getBoundingClientRect();
      const stripH = stripRef.current.offsetHeight;
      setPlacement((prev) =>
        prev
          ? {
              ...prev,
              left: prev.kind === "right" ? rect.right + GAP : prev.left,
              top:
                prev.kind === "right"
                  ? Math.max(12, rect.top + rect.height / 2 - stripH / 2)
                  : prev.top,
            }
          : prev,
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [visible, instance?.id]);

  if (!visible || !instance || !component || !placement) return null;

  const canvasId = activeCanvas?.id ?? "";

  const containerStyle: CSSProperties = {
    position: "fixed",
    top: placement.top,
    left: placement.left,
    width: STRIP_WIDTH,
    background: "rgba(20, 22, 30, 0.98)",
    border: "1px solid var(--atelier-panel-border)",
    borderRadius: 8,
    boxShadow: "0 18px 48px rgba(0,0,0,0.4)",
    padding: "10px 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    zIndex: 4,
    color: "var(--atelier-panel-text)",
  };

  return (
    <div
      ref={stripRef}
      style={containerStyle}
      onMouseLeave={() => setHoveredAxisSelection(null)}
      onClick={(e) => e.stopPropagation()}
      data-family-view="true"
    >
      <Tail placement={placement} />

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{component.name}</div>
        <div style={{ fontSize: 11, color: "var(--atelier-panel-muted)" }}>
          {comboCount} variant{comboCount === 1 ? "" : "s"}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--atelier-panel-muted)" }}>
          Hover to preview · click to swap
        </div>
      </div>

      {component.axes.map((axis) => (
        <AxisRow
          key={axis.name}
          axis={axis}
          component={component}
          instance={instance}
          activeCanvas={activeCanvas}
          hoveredAxisSelection={hoveredAxisSelection}
          designSystem={designSystem}
          onHoverEnter={setHoveredAxisSelection}
          onHoverLeave={() => setHoveredAxisSelection(null)}
          onClickOption={(optionSelection) => {
            setHoveredAxisSelection(null);
            setInstanceAxisSelection(instance.id, optionSelection);
          }}
          onAddOption={() => {
            const newOption = createAxisOptionFromInstance(instance.id, axis.name);
            if (!newOption) {
              console.warn("[FamilyView] createAxisOptionFromInstance returned null");
            }
          }}
        />
      ))}

      <div style={{ fontSize: 11 }}>
        <button
          type="button"
          onClick={() => {
            const candidates = scoreSwapCandidates(designSystem, canvases, component.id);
            console.log("[component-swap view coming soon]", {
              source: component.id,
              onCanvas: canvasId,
              candidates,
            });
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--atelier-panel-text)",
            cursor: "pointer",
            fontSize: 11,
            padding: 0,
            textDecoration: "underline dotted",
            textUnderlineOffset: 3,
          }}
        >
          Swap to different component →
        </button>
      </div>
    </div>
  );
}

interface AxisRowProps {
  axis: Axis;
  component: import("@rebtel-atelier/spec").Component;
  instance: import("@rebtel-atelier/spec").Instance;
  activeCanvas: import("@rebtel-atelier/spec").Canvas | undefined;
  hoveredAxisSelection: Record<string, string> | null;
  designSystem: import("@rebtel-atelier/spec").DesignSystem;
  onHoverEnter: (sel: Record<string, string>) => void;
  onHoverLeave: () => void;
  onClickOption: (sel: Record<string, string>) => void;
  onAddOption: () => void;
}

function AxisRow({
  axis,
  component,
  instance,
  activeCanvas,
  hoveredAxisSelection,
  designSystem,
  onHoverEnter,
  onHoverLeave,
  onClickOption,
  onAddOption,
}: AxisRowProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "var(--atelier-panel-muted)",
        }}
      >
        {axis.name}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          scrollbarWidth: "thin",
        }}
      >
        {axis.options.map((option) => {
          const optionSelection: Record<string, string> = {
            ...instance.axisSelection,
            [axis.name]: option,
          };
          const isCurrent = axisSelectionsEqual(optionSelection, instance.axisSelection);
          const usage = activeCanvas
            ? countAxisCombinationOnCanvas(activeCanvas, component.id, optionSelection)
            : 0;
          const label = synthesizeVariantName(component, optionSelection);
          return (
            <VariantThumbnail
              key={`${axis.name}:${option}`}
              component={component}
              axisSelection={optionSelection}
              variantName={label}
              sourceInstance={instance}
              designSystem={designSystem}
              isCurrent={isCurrent}
              usageCount={usage}
              onHoverEnter={() => onHoverEnter(optionSelection)}
              onHoverLeave={() => {
                if (
                  hoveredAxisSelection &&
                  axisSelectionsEqual(hoveredAxisSelection, optionSelection)
                ) {
                  onHoverLeave();
                }
              }}
              onClick={() => {
                if (isCurrent) return;
                onClickOption(optionSelection);
              }}
            />
          );
        })}

        <NewOptionTile axisName={axis.name} onClick={onAddOption} />
      </div>
    </div>
  );
}

function NewOptionTile({ axisName, onClick }: { axisName: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      title={`Add new ${axisName} option`}
      style={{
        width: 132,
        height: 84 + 26,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        flexShrink: 0,
        cursor: "pointer",
        border: "1px dashed var(--atelier-panel-border)",
        borderRadius: 6,
        color: "var(--atelier-panel-muted)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ fontSize: 22, lineHeight: 1, marginTop: -4 }}>+</div>
      <div style={{ fontSize: 11 }}>New {axisName} option</div>
    </div>
  );
}

function Tail({ placement }: { placement: Placement }) {
  const size = 8;
  const base: CSSProperties = {
    position: "absolute",
    width: 0,
    height: 0,
    border: `${size}px solid transparent`,
  };
  if (placement.kind === "right") {
    return (
      <div
        style={{
          ...base,
          left: -size * 2,
          top: "50%",
          marginTop: -size,
          borderRightColor: "rgba(20, 22, 30, 0.98)",
        }}
      />
    );
  }
  if (placement.kind === "below") {
    return (
      <div
        style={{
          ...base,
          top: -size * 2,
          left: "50%",
          marginLeft: -size,
          borderBottomColor: "rgba(20, 22, 30, 0.98)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...base,
        bottom: -size * 2,
        left: "50%",
        marginLeft: -size,
        borderTopColor: "rgba(20, 22, 30, 0.98)",
      }}
    />
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  countVariantUsageOnCanvas,
  scoreSwapCandidates,
  selectActiveCanvas,
  useCanvasStore,
} from "@/stores/canvas";
import { VariantThumbnail } from "./VariantThumbnail";

const STRIP_WIDTH = 520;
const GAP = 12;

type Placement = { kind: "right" | "below" | "above"; left: number; top: number };

/**
 * Anchored to the currently-selected instance. Visible only when the instance's
 * component has more than one variant and the editor isn't in variant/base mode.
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
  const hoveredVariantId = useCanvasStore((s) => s.hoveredVariantId);
  const setHoveredVariantId = useCanvasStore((s) => s.setHoveredVariantId);
  const swapInstanceVariant = useCanvasStore((s) => s.swapInstanceVariant);
  const createVariantFromInstance = useCanvasStore((s) => s.createVariantFromInstance);

  const stripRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  // Resolve the selected instance + its component.
  const instance = selection
    ? activeCanvas?.instances.find((i) => i.id === selection) ?? null
    : null;
  const component = instance
    ? designSystem.components.find((c) => c.id === instance.componentId) ?? null
    : null;

  const visible =
    !!instance &&
    !!component &&
    component.variants.length > 1 &&
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

    // Immediate + on next frame (lets the render outline settle first).
    measure();
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [visible, instance, zoom, pan.x, pan.y, activeCanvas?.id]);

  // Re-measure on resize so the strip doesn't end up off-screen.
  useEffect(() => {
    if (!visible) return;
    const onResize = () => {
      // Bump the deps indirectly by touching pan — cheapest trigger.
      // (No harm if the measure no-ops when the DOM hasn't changed.)
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
      onMouseLeave={() => setHoveredVariantId(null)}
      onClick={(e) => e.stopPropagation()}
      data-family-view="true"
    >
      <Tail placement={placement} />

      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{component.name}</div>
        <div style={{ fontSize: 11, color: "var(--atelier-panel-muted)" }}>
          {component.variants.length} variant{component.variants.length === 1 ? "" : "s"}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--atelier-panel-muted)" }}>
          Hover to preview · click to swap
        </div>
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
        {component.variants.map((v) => {
          const usage = activeCanvas
            ? countVariantUsageOnCanvas(activeCanvas, component.id, v.id)
            : 0;
          const isCurrent = v.id === instance.variantId;
          return (
            <VariantThumbnail
              key={v.id}
              component={component}
              variant={v}
              sourceInstance={instance}
              isCurrent={isCurrent}
              usageCount={usage}
              onHoverEnter={() => setHoveredVariantId(v.id)}
              onHoverLeave={() => {
                // Hover-leave handled by container's onMouseLeave too — but
                // setting here gives immediate revert when moving between tiles.
                if (hoveredVariantId === v.id) setHoveredVariantId(null);
              }}
              onClick={() => {
                if (isCurrent) return;
                setHoveredVariantId(null);
                swapInstanceVariant(instance.id, v.id);
              }}
            />
          );
        })}

        {/* + new variant */}
        <NewVariantTile
          onClick={() => {
            const newId = createVariantFromInstance(instance.id);
            if (!newId) {
              console.warn("[FamilyView] createVariantFromInstance returned null");
            }
          }}
        />
      </div>

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

function NewVariantTile({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
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
      <div style={{ fontSize: 11 }}>New variant</div>
    </div>
  );
}

function Tail({ placement }: { placement: Placement }) {
  // Small triangle indicator pointing at the instance.
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
  // above
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

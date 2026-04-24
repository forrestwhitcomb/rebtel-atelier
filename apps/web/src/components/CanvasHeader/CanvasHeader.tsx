"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCanvasStore } from "@/stores/canvas";

const RAIL_WIDTH = 180;
const PANEL_WIDTH = 260;

export function CanvasHeader() {
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const canvases = useCanvasStore((s) => s.canvases);
  const canvasOrder = useCanvasStore((s) => s.canvasOrder);
  const selection = useCanvasStore((s) => s.selection);
  const setCanvasStatus = useCanvasStore((s) => s.setCanvasStatus);
  const hasSelection = selection !== null;

  const active = canvases[activeCanvasId];
  if (!active) return null;

  const containerStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: RAIL_WIDTH,
    right: hasSelection ? PANEL_WIDTH : 0,
    height: 36,
    background: "rgba(10, 12, 18, 0.92)",
    borderBottom: "1px solid var(--atelier-panel-border)",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "0 14px",
    zIndex: 3,
    fontSize: 12,
  };

  const statusColor = active.status === "shipped" ? "#4dd38a" : "#9ccdff";

  return (
    <div style={containerStyle}>
      <div style={{ fontWeight: 600, letterSpacing: "0.02em" }}>{active.name}</div>

      <button
        type="button"
        onClick={() =>
          setCanvasStatus(active.id, active.status === "draft" ? "shipped" : "draft")
        }
        title="Toggle canvas status — shipped canvases pin instances to the published variant version"
        style={{
          border: `1px solid ${statusColor}`,
          color: statusColor,
          background: "transparent",
          borderRadius: 999,
          padding: "2px 10px",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        {active.status}
      </button>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: 6 }}>
        {canvasOrder.map((cid) => {
          const c = canvases[cid];
          if (!c) return null;
          const isActive = cid === activeCanvasId;
          return (
            <Link
              key={cid}
              href={`/canvas/${cid}`}
              prefetch={false}
              style={{
                textDecoration: "none",
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 4,
                background: isActive ? "rgba(156,205,255,0.18)" : "transparent",
                border: "1px solid var(--atelier-panel-border)",
                color: "var(--atelier-panel-text)",
              }}
            >
              {c.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

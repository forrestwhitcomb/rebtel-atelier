"use client";

import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import { useCanvasStore } from "@/stores/canvas";

const RAIL_WIDTH = 180;

export function LeftRail() {
  const components = useCanvasStore((s) => s.designSystem.components);
  return (
    <aside
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        width: RAIL_WIDTH,
        background: "var(--atelier-panel-bg)",
        borderRight: "1px solid var(--atelier-panel-border)",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        zIndex: 2,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--atelier-panel-muted)",
          padding: "4px 4px 8px",
        }}
      >
        Components
      </div>
      {components.map((c) => (
        <RailItem key={c.id} id={c.id} name={c.name} />
      ))}
    </aside>
  );
}

function RailItem({ id, name }: { id: string; name: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });

  const style: CSSProperties = {
    padding: "10px 12px",
    borderRadius: 6,
    background: isDragging ? "#2a2f3a" : "#1e222b",
    border: "1px solid var(--atelier-panel-border)",
    color: "var(--atelier-panel-text)",
    fontSize: 13,
    userSelect: "none",
    cursor: "grab",
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={style}>
      {name}
    </div>
  );
}

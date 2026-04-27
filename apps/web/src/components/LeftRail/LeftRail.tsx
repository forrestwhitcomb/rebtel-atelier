"use client";

import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import type { Component, PaletteGroup } from "@rebtel-atelier/spec";
import { useCanvasStore } from "@/stores/canvas";

const RAIL_WIDTH = 180;

// Presentation order + display titles for palette groups. Groups not
// present in this map would fall through to their raw id, but since
// PaletteGroup is a finite union we cover all of them here. Empty groups
// are hidden at render time.
const GROUP_ORDER: PaletteGroup[] = [
  "inputs",
  "content",
  "containers",
  "dataDisplay",
  "navigation",
  "productSpecific",
];

const GROUP_LABELS: Record<PaletteGroup, string> = {
  inputs: "Inputs & Controls",
  content: "Content",
  containers: "Containers",
  dataDisplay: "Data Display",
  navigation: "Navigation",
  productSpecific: "Product",
};

export function LeftRail() {
  const components = useCanvasStore((s) => s.designSystem.components);
  const collapsed = useCanvasStore((s) => s.collapsedLibraryGroups);
  const toggleLibraryGroup = useCanvasStore((s) => s.toggleLibraryGroup);

  const byGroup = new Map<PaletteGroup, Component[]>();
  for (const c of components) {
    const group = c.paletteGroup;
    const list = byGroup.get(group) ?? [];
    list.push(c);
    byGroup.set(group, list);
  }

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
        gap: 10,
        zIndex: 2,
        overflowY: "auto",
      }}
    >
      {GROUP_ORDER.map((group) => {
        const groupComponents = byGroup.get(group);
        if (!groupComponents || groupComponents.length === 0) return null;
        const isCollapsed = !!collapsed[group];
        return (
          <div key={group} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              type="button"
              onClick={() => toggleLibraryGroup(group)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 4px",
                background: "transparent",
                border: "none",
                color: "var(--atelier-panel-muted)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                textAlign: "left",
              }}
              aria-expanded={!isCollapsed}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  fontSize: 10,
                  transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                  transition: "transform 0.12s ease-out",
                }}
              >
                ▾
              </span>
              {GROUP_LABELS[group]}
            </button>
            {!isCollapsed
              ? groupComponents.map((c) => (
                  <RailItem key={c.id} id={c.id} name={c.name} />
                ))
              : null}
          </div>
        );
      })}
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

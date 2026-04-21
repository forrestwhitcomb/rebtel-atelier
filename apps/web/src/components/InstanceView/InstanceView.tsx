"use client";

import type { CSSProperties, MouseEvent } from "react";
import { renderInstance } from "@rebtel-atelier/renderer";
import type { Instance } from "@rebtel-atelier/spec";
import { useCanvasStore } from "@/stores/canvas";

export function InstanceView({ instance }: { instance: Instance }) {
  const selection = useCanvasStore((s) => s.selection);
  const select = useCanvasStore((s) => s.selectInstance);
  const component = useCanvasStore((s) =>
    s.designSystem.components.find((c) => c.id === instance.componentId),
  );

  if (!component) return null;

  const selected = selection === instance.id;
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    select(instance.id);
  };

  const style: CSSProperties = {
    position: "absolute",
    left: instance.position.x,
    top: instance.position.y,
    outline: selected
      ? "2px solid var(--rebtel-border-brand)"
      : "1px dashed transparent",
    outlineOffset: 2,
    cursor: "pointer",
    maxWidth: 343,
  };

  return (
    <div onClick={handleClick} style={style}>
      {renderInstance(instance, component)}
    </div>
  );
}

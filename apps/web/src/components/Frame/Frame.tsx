"use client";

import { useDroppable } from "@dnd-kit/core";
import { useCanvasStore } from "@/stores/canvas";
import { InstanceView } from "../InstanceView/InstanceView";

export function Frame() {
  // Never derive arrays inside a zustand selector — a fresh reference each call
  // trips useSyncExternalStore's cached-snapshot check (infinite loop on SSR).
  // Select the stable array and filter in render instead.
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const canvas = useCanvasStore((s) => s.canvases[activeCanvasId]);
  const frame = canvas?.frames[0];
  const allInstances = canvas?.instances ?? [];
  const frameId = frame?.id ?? "";
  const instances = allInstances.filter((i) => i.frameId === frameId);
  const { setNodeRef, isOver } = useDroppable({ id: frameId, disabled: !frameId });

  if (!frame) return null;

  return (
    <div
      ref={setNodeRef}
      data-frame-id={frame.id}
      style={{
        width: frame.size.w,
        height: frame.size.h,
        background: "var(--rebtel-surface-page-canvas)",
        borderRadius: 20,
        boxShadow: isOver
          ? "0 0 0 3px var(--rebtel-border-brand), 0 20px 60px rgba(0,0,0,0.4)"
          : "0 20px 60px rgba(0,0,0,0.4)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {instances.map((inst) => (
        <InstanceView key={inst.id} instance={inst} />
      ))}
    </div>
  );
}

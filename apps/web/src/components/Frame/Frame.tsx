"use client";

import { useDroppable } from "@dnd-kit/core";
import { useCanvasStore, demoFrameId } from "@/stores/canvas";
import { InstanceView } from "../InstanceView/InstanceView";

export function Frame() {
  const frame = useCanvasStore((s) => s.canvas.frames.find((f) => f.id === demoFrameId));
  const instances = useCanvasStore((s) =>
    s.canvas.instances.filter((i) => i.frameId === demoFrameId),
  );
  const { setNodeRef, isOver } = useDroppable({ id: demoFrameId });

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

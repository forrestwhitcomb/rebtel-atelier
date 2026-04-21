"use client";

import { useEffect, useRef } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useCanvasStore, demoFrameId } from "@/stores/canvas";
import { getSupabase } from "@/lib/supabase";
import { LeftRail } from "../LeftRail/LeftRail";
import { CanvasSurface } from "../CanvasSurface/CanvasSurface";
import { RightPanel } from "../RightPanel/RightPanel";

export function CanvasEditor() {
  const addInstance = useCanvasStore((s) => s.addInstance);
  const designSystem = useCanvasStore((s) => s.designSystem);
  const zoomRef = useRef(1);
  useEffect(() => {
    return useCanvasStore.subscribe((s) => {
      zoomRef.current = s.zoom;
    });
  }, []);

  // Verify Supabase client instantiates — session 1 acceptance for /lib/supabase
  useEffect(() => {
    try {
      getSupabase();
    } catch (err) {
      console.warn("[CanvasEditor] Supabase client not available:", err);
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over, delta, activatorEvent } = event;
    if (!over || over.id !== demoFrameId) return;

    const componentId = String(active.id);
    const component = designSystem.components.find((c) => c.id === componentId);
    if (!component) return;

    const firstVariantId = component.variants[0]?.id ?? "default";

    // Compute drop position within frame space, correcting for zoom.
    const frameEl = document.querySelector<HTMLElement>(`[data-frame-id="${demoFrameId}"]`);
    let position = { x: 16, y: 16 };
    if (frameEl && activatorEvent && "clientX" in activatorEvent) {
      const pe = activatorEvent as PointerEvent;
      const finalX = pe.clientX + delta.x;
      const finalY = pe.clientY + delta.y;
      const rect = frameEl.getBoundingClientRect();
      const zoom = zoomRef.current || 1;
      position = {
        x: Math.max(0, (finalX - rect.left) / zoom - 80),
        y: Math.max(0, (finalY - rect.top) / zoom - 24),
      };
    }

    addInstance(demoFrameId, componentId, firstVariantId, position);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--atelier-bg)",
          color: "var(--atelier-panel-text)",
          overflow: "hidden",
        }}
      >
        <CanvasSurface />
        <LeftRail />
        <RightPanel />
      </div>
    </DndContext>
  );
}

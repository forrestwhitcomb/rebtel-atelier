"use client";

import { useEffect, useRef } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useCanvasStore } from "@/stores/canvas";
import { getSupabase } from "@/lib/supabase";
import { LeftRail } from "../LeftRail/LeftRail";
import { CanvasSurface } from "../CanvasSurface/CanvasSurface";
import { CanvasHeader } from "../CanvasHeader/CanvasHeader";
import { RightPanel } from "../RightPanel/RightPanel";
import { EditModule } from "../EditModule/EditModule";
import { PushPopup } from "../PushPopup/PushPopup";
import { FamilyView } from "../FamilyView/FamilyView";
import { Toast } from "../Toast/Toast";

interface CanvasEditorProps {
  canvasId: string;
}

export function CanvasEditor({ canvasId }: CanvasEditorProps) {
  const setActiveCanvas = useCanvasStore((s) => s.setActiveCanvas);
  const addInstance = useCanvasStore((s) => s.addInstance);
  const designSystem = useCanvasStore((s) => s.designSystem);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const zoomRef = useRef(1);

  useEffect(() => {
    setActiveCanvas(canvasId);
  }, [canvasId, setActiveCanvas]);

  useEffect(() => {
    return useCanvasStore.subscribe((s) => {
      zoomRef.current = s.zoom;
    });
  }, []);

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
    if (!over) return;
    const frameId = String(over.id);
    // Confirm the drop target is the active canvas's frame.
    const activeCanvas = useCanvasStore.getState().canvases[activeCanvasId];
    const frame = activeCanvas?.frames.find((f) => f.id === frameId);
    if (!frame) return;

    const componentId = String(active.id);
    const component = designSystem.components.find((c) => c.id === componentId);
    if (!component) return;

    const firstVariantId = component.variants[0]?.id ?? "default";

    const frameEl = document.querySelector<HTMLElement>(`[data-frame-id="${frameId}"]`);
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

    addInstance(activeCanvasId, frameId, componentId, firstVariantId, position);
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
        <CanvasHeader />
        <EditModule />
        <LeftRail />
        <RightPanel />
        <FamilyView />
        <PushPopup />
        <Toast />
      </div>
    </DndContext>
  );
}

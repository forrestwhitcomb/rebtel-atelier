"use client";

import { useEffect, useRef } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useCanvasStore } from "@/stores/canvas";
import { Frame } from "../Frame/Frame";

const RAIL_WIDTH = 180;
const PANEL_WIDTH = 240;

export function CanvasSurface() {
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setPan = useCanvasStore((s) => s.setPan);
  const selection = useCanvasStore((s) => s.selection);
  const selectInstance = useCanvasStore((s) => s.selectInstance);
  const hasSelection = selection !== null;
  const transformRef = useRef<React.ComponentRef<typeof TransformWrapper> | null>(null);

  // Mirror pan/zoom into the store so drop math can read current zoom.
  useEffect(() => {
    const tw = transformRef.current;
    if (!tw) return;
    // initial sync — no-op; the onTransformed callback keeps it in sync after.
  }, []);

  return (
    <div
      onClick={() => {
        if (hasSelection) selectInstance(null);
      }}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: RAIL_WIDTH,
        right: hasSelection ? PANEL_WIDTH : 0,
        background: "var(--atelier-bg)",
        overflow: "hidden",
      }}
    >
      <TransformWrapper
        ref={transformRef}
        minScale={0.25}
        maxScale={3}
        initialScale={1}
        centerOnInit
        wheel={{ step: 0.08 }}
        panning={{ velocityDisabled: true, excluded: ["rail-item", "dnd-draggable"] }}
        doubleClick={{ disabled: true }}
        onTransformed={(_, state) => {
          setZoom(state.scale);
          setPan({ x: state.positionX, y: state.positionY });
        }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: "100%", height: "100%" }}
        >
          <div
            style={{
              width: 2400,
              height: 1800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Frame />
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

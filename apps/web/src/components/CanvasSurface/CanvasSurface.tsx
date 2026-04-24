"use client";

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useCanvasStore } from "@/stores/canvas";
import { Frame } from "../Frame/Frame";

const RAIL_WIDTH = 180;
const PANEL_WIDTH = 260;
const HEADER_HEIGHT = 36;

export function CanvasSurface() {
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setPan = useCanvasStore((s) => s.setPan);
  const selection = useCanvasStore((s) => s.selection);
  const selectInstance = useCanvasStore((s) => s.selectInstance);
  const editScope = useCanvasStore((s) => s.editScope);
  const hasSelection = selection !== null;
  const inEditMode = editScope !== "instance";

  return (
    <div
      onClick={() => {
        if (hasSelection) selectInstance(null);
      }}
      style={{
        position: "absolute",
        top: HEADER_HEIGHT,
        bottom: 0,
        left: RAIL_WIDTH,
        right: hasSelection ? PANEL_WIDTH : 0,
        background: "var(--atelier-bg)",
        overflow: "hidden",
      }}
    >
      <TransformWrapper
        minScale={0.25}
        maxScale={3}
        initialScale={1}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.08 }}
        // Hold Space to pan (Figma convention). Default left-click-drag fights
        // dnd-kit's drag sensor, and empty-canvas drag pans accidentally while
        // trying to select.
        panning={{
          velocityDisabled: true,
          activationKeys: [" "],
          wheelPanning: false,
        }}
        doubleClick={{ disabled: true }}
        onTransformed={(_, state) => {
          setZoom(state.scale);
          setPan({ x: state.positionX, y: state.positionY });
        }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            style={{
              padding: 80,
              // 8px nudge on the frame when the edit module appears —
              // subtle acknowledgement that we've entered a different mode.
              transform: inEditMode ? "translateY(8px)" : "translateY(0)",
              transition: "transform 200ms ease",
            }}
          >
            <Frame />
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

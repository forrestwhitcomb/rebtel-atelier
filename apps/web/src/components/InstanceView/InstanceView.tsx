"use client";

import type { CSSProperties, MouseEvent } from "react";
import { renderInstance } from "@rebtel-atelier/renderer";
import type { DraftScope, Instance } from "@rebtel-atelier/spec";
import { axisSelectionsEqual, useCanvasStore } from "@/stores/canvas";

export function InstanceView({ instance }: { instance: Instance }) {
  const selection = useCanvasStore((s) => s.selection);
  const select = useCanvasStore((s) => s.selectInstance);
  const component = useCanvasStore((s) =>
    s.designSystem.components.find((c) => c.id === instance.componentId),
  );
  const designSystem = useCanvasStore((s) => s.designSystem);
  const editScope = useCanvasStore((s) => s.editScope);
  const editingAxisCombinationKey = useCanvasStore((s) => s.editingAxisCombinationKey);
  const editingBaseKey = useCanvasStore((s) => s.editingBaseKey);
  const hoveredAxisSelection = useCanvasStore((s) => s.hoveredAxisSelection);

  if (!component) return null;

  // Only the actively-edited combo / base resolves against draft. This
  // keeps draft-vs-published a real boundary on the canvas: other
  // instances stay on their pinned published version.
  let draftScope: DraftScope = null;
  if (
    editScope === "variant" &&
    editingAxisCombinationKey &&
    editingAxisCombinationKey.componentId === instance.componentId &&
    axisSelectionsEqual(editingAxisCombinationKey.axisSelection, instance.axisSelection)
  ) {
    draftScope = "component";
  } else if (
    editScope === "base" &&
    editingBaseKey &&
    editingBaseKey.componentId === instance.componentId
  ) {
    draftScope = "base";
  }

  const selected = selection === instance.id;

  // Hover preview is SELECTION-scoped — only the selected instance
  // re-renders as the hovered combo. Transient render-only override:
  // we pass `previewAxisSelection` to the renderer but never mutate state.
  const previewActive =
    selected &&
    hoveredAxisSelection !== null &&
    !axisSelectionsEqual(hoveredAxisSelection, instance.axisSelection);
  const previewAxisSelection = previewActive ? hoveredAxisSelection ?? undefined : undefined;

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    select(instance.id);
  };

  const style: CSSProperties = {
    position: "absolute",
    left: instance.position.x,
    top: instance.position.y,
    outline: previewActive
      ? "2px dashed #f4b64b"
      : selected
      ? "2px solid var(--rebtel-border-brand)"
      : "1px dashed transparent",
    outlineOffset: 2,
    cursor: "pointer",
    maxWidth: 343,
  };

  return (
    <div
      data-instance-id={instance.id}
      onClick={handleClick}
      style={style}
    >
      {renderInstance(instance, component, {
        draftScope,
        previewAxisSelection,
        designSystem,
      })}
    </div>
  );
}

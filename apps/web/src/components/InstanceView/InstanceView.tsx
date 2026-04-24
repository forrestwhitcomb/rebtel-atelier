"use client";

import type { CSSProperties, MouseEvent } from "react";
import { renderInstance } from "@rebtel-atelier/renderer";
import type { DraftScope, Instance } from "@rebtel-atelier/spec";
import { useCanvasStore } from "@/stores/canvas";

export function InstanceView({ instance }: { instance: Instance }) {
  const selection = useCanvasStore((s) => s.selection);
  const select = useCanvasStore((s) => s.selectInstance);
  const component = useCanvasStore((s) =>
    s.designSystem.components.find((c) => c.id === instance.componentId),
  );
  const editScope = useCanvasStore((s) => s.editScope);
  const editingVariantKey = useCanvasStore((s) => s.editingVariantKey);
  const editingBaseKey = useCanvasStore((s) => s.editingBaseKey);
  const hoveredVariantId = useCanvasStore((s) => s.hoveredVariantId);

  if (!component) return null;

  // Only the actively-edited variant/base resolves against draft. This is
  // what keeps draft-vs-published a real boundary on the canvas: other
  // instances of other variants stay on their pinned published version.
  let draftScope: DraftScope = null;
  if (
    editScope === "variant" &&
    editingVariantKey &&
    editingVariantKey.componentId === instance.componentId &&
    editingVariantKey.variantId === instance.variantId
  ) {
    draftScope = "variant";
  } else if (
    editScope === "base" &&
    editingBaseKey &&
    editingBaseKey.componentId === instance.componentId
  ) {
    draftScope = "base";
  }

  const selected = selection === instance.id;

  // Hover preview is SELECTION-scoped — only the selected instance re-renders
  // as the hovered variant. Others are never affected. Transient render-only
  // override: we pass `previewVariantId` to the renderer but never mutate state.
  const previewActive =
    selected &&
    hoveredVariantId !== null &&
    hoveredVariantId !== instance.variantId &&
    component.variants.some((v) => v.id === hoveredVariantId);
  const previewVariantId = previewActive ? hoveredVariantId ?? undefined : undefined;

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
      {renderInstance(instance, component, { draftScope, previewVariantId })}
    </div>
  );
}

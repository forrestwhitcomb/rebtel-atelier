"use client";

import type { CSSProperties, MouseEventHandler } from "react";
import { renderInstance } from "@rebtel-atelier/renderer";
import type { Component, Variant, Instance } from "@rebtel-atelier/spec";

interface VariantThumbnailProps {
  component: Component;
  variant: Variant;
  /** Instance we're previewing from — we reuse its prop overrides for a more accurate preview. */
  sourceInstance: Instance;
  isCurrent: boolean;
  usageCount: number;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onClick: MouseEventHandler;
}

const THUMB_W = 132;
const THUMB_H = 84;
const RENDER_SCALE = 0.45;

export function VariantThumbnail({
  component,
  variant,
  sourceInstance,
  isCurrent,
  usageCount,
  onHoverEnter,
  onHoverLeave,
  onClick,
}: VariantThumbnailProps) {
  // Build a preview instance using the source instance's overrides so the
  // thumbnail feels like "what this instance would look like as this variant"
  // rather than a generic gallery item.
  const previewInstance: Instance = {
    ...sourceInstance,
    id: `${sourceInstance.id}__fv_${variant.id}`,
    variantId: variant.id,
    variantVersion: variant.publishedVersion,
  };

  const wrapperStyle: CSSProperties = {
    width: THUMB_W,
    height: THUMB_H + 26,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flexShrink: 0,
    cursor: "pointer",
  };

  const frameStyle: CSSProperties = {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 6,
    border: isCurrent
      ? "1.5px solid #9ccdff"
      : "1px solid var(--atelier-panel-border)",
    background: "var(--rebtel-surface-page-canvas, #f7f7f8)",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  // Scale the rendered component down — real renderer output, not an icon.
  const renderWrapStyle: CSSProperties = {
    transform: `scale(${RENDER_SCALE})`,
    transformOrigin: "center center",
    pointerEvents: "none",
  };

  const labelRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "var(--atelier-panel-text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  return (
    <div
      style={wrapperStyle}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onClick={onClick}
    >
      <div style={frameStyle}>
        <div style={renderWrapStyle}>{renderInstance(previewInstance, component)}</div>
        {isCurrent ? (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 6,
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "#9ccdff",
            }}
            title="Currently applied"
          />
        ) : null}
      </div>
      <div style={labelRowStyle}>
        <span style={{ fontWeight: 500 }}>{variant.name}</span>
        <span style={{ color: "var(--atelier-panel-muted)", fontSize: 10 }}>
          {usageCount === 0 ? "unused" : `used ${usageCount}×`}
        </span>
      </div>
    </div>
  );
}

export { THUMB_W, THUMB_H };

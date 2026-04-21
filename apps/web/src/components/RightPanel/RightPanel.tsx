"use client";

import type { ChangeEvent, CSSProperties } from "react";
import { resolveProps, type PropValue } from "@rebtel-atelier/spec";
import { useCanvasStore } from "@/stores/canvas";

const PANEL_WIDTH = 240;

export function RightPanel() {
  const selection = useCanvasStore((s) => s.selection);
  const instance = useCanvasStore((s) =>
    s.canvas.instances.find((i) => i.id === selection) ?? null,
  );
  const component = useCanvasStore((s) =>
    instance
      ? s.designSystem.components.find((c) => c.id === instance.componentId) ?? null
      : null,
  );
  const updateInstanceProps = useCanvasStore((s) => s.updateInstanceProps);

  if (!selection || !instance || !component) return null;

  const resolved = resolveProps(component, instance.variantId, instance.propOverrides);

  const setProp = (key: string, value: PropValue) => {
    updateInstanceProps(instance.id, { [key]: value });
  };

  const rowStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
  const labelStyle: CSSProperties = {
    fontSize: 11,
    color: "var(--atelier-panel-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  };
  const inputStyle: CSSProperties = {
    background: "#11141a",
    border: "1px solid var(--atelier-panel-border)",
    borderRadius: 4,
    color: "var(--atelier-panel-text)",
    padding: "6px 8px",
    fontSize: 13,
    fontFamily: "inherit",
  };

  return (
    <aside
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: PANEL_WIDTH,
        background: "var(--atelier-panel-bg)",
        borderLeft: "1px solid var(--atelier-panel-border)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        zIndex: 2,
        overflowY: "auto",
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: "var(--atelier-panel-muted)", letterSpacing: "0.08em" }}>
          INSTANCE
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{component.name}</div>
        <div style={{ fontSize: 11, color: "var(--atelier-panel-muted)", marginTop: 2 }}>
          variant: {instance.variantId} · v{instance.variantVersion}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Object.entries(resolved).map(([key, val]) => (
          <PropField
            key={key}
            propKey={key}
            value={val}
            rowStyle={rowStyle}
            labelStyle={labelStyle}
            inputStyle={inputStyle}
            onChange={(v) => setProp(key, v)}
          />
        ))}
      </div>

      <div style={{ marginTop: "auto", fontSize: 11, color: "var(--atelier-panel-muted)" }}>
        Changes are instance overrides. Variant + base edits arrive in session 2.
      </div>
    </aside>
  );
}

interface PropFieldProps {
  propKey: string;
  value: PropValue;
  rowStyle: CSSProperties;
  labelStyle: CSSProperties;
  inputStyle: CSSProperties;
  onChange: (v: PropValue) => void;
}

function PropField({
  propKey,
  value,
  rowStyle,
  labelStyle,
  inputStyle,
  onChange,
}: PropFieldProps) {
  // String
  if (typeof value === "string") {
    return (
      <label style={rowStyle}>
        <span style={labelStyle}>{propKey}</span>
        <input
          type="text"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          style={inputStyle}
        />
      </label>
    );
  }

  // Number
  if (typeof value === "number") {
    return (
      <label style={rowStyle}>
        <span style={labelStyle}>{propKey}</span>
        <input
          type="number"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const parsed = parseFloat(e.target.value);
            onChange(Number.isFinite(parsed) ? parsed : 0);
          }}
          style={inputStyle}
          step="any"
        />
      </label>
    );
  }

  // Boolean
  if (typeof value === "boolean") {
    return (
      <label style={{ ...rowStyle, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        />
        <span style={{ ...labelStyle, textTransform: "none", letterSpacing: 0, fontSize: 13 }}>
          {propKey}
        </span>
      </label>
    );
  }

  // null / complex — read-only preview
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{propKey}</span>
      <div
        style={{
          ...inputStyle,
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          color: "var(--atelier-panel-muted)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={JSON.stringify(value)}
      >
        {value === null ? "null" : JSON.stringify(value)}
      </div>
    </div>
  );
}

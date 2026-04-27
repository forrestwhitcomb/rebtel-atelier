"use client";

import type { ChangeEvent, CSSProperties } from "react";
import { useMemo } from "react";
import {
  publishedSnapshotAtVersion,
  resolveProps,
  type Component,
  type PropSchemaEntry,
  type PropValue,
  type TokenCategory,
  type TokenRef,
} from "@rebtel-atelier/spec";
import { resolveToken } from "@rebtel-atelier/renderer";
import {
  countAxisCombinationUsage,
  countFromCanvasesByComponent,
  selectActiveCanvas,
  synthesizeVariantName,
  useCanvasStore,
  type EditScope,
  type RightPanelTab,
} from "@/stores/canvas";
import { DevModePanel } from "@/components/DevModePanel/DevModePanel";

const PANEL_WIDTH = 260;

export function RightPanel() {
  const selection = useCanvasStore((s) => s.selection);
  const activeCanvas = useCanvasStore(selectActiveCanvas);
  const instance = useCanvasStore((s) => {
    const c = selectActiveCanvas(s);
    return c?.instances.find((i) => i.id === selection) ?? null;
  });
  const component = useCanvasStore((s) =>
    instance ? s.designSystem.components.find((c) => c.id === instance.componentId) ?? null : null,
  );
  const designSystem = useCanvasStore((s) => s.designSystem);

  const editScope = useCanvasStore((s) => s.editScope);
  const editingAxisCombinationKey = useCanvasStore((s) => s.editingAxisCombinationKey);
  const editingBaseKey = useCanvasStore((s) => s.editingBaseKey);
  const pendingScopeEscalation = useCanvasStore((s) => s.pendingScopeEscalation);
  const rightPanelTab = useCanvasStore((s) => s.rightPanelTab);
  const setRightPanelTab = useCanvasStore((s) => s.setRightPanelTab);

  const requestScopeEscalation = useCanvasStore((s) => s.requestScopeEscalation);
  const confirmScopeEscalation = useCanvasStore((s) => s.confirmScopeEscalation);
  const cancelScopeEscalation = useCanvasStore((s) => s.cancelScopeEscalation);
  const resetScopeToInstance = useCanvasStore((s) => s.resetScopeToInstance);
  const updateInstanceProps = useCanvasStore((s) => s.updateInstanceProps);
  const updateAxisOverrideDraft = useCanvasStore((s) => s.updateAxisOverrideDraft);
  const updateBaseDraft = useCanvasStore((s) => s.updateBaseDraft);

  // Token rosters for the picker, keyed by category. Lazily extended if a
  // propSchema references a category not yet in the map.
  const tokenRosters = useMemo<Record<string, string[]>>(() => {
    const rosters: Record<string, string[]> = {};
    for (const t of Object.values(designSystem.tokens)) {
      const bucket = rosters[t.category] ?? (rosters[t.category] = []);
      bucket.push(t.token);
    }
    for (const k of Object.keys(rosters)) rosters[k]?.sort();
    return rosters;
  }, [designSystem.tokens]);

  if (!selection || !instance || !component || !activeCanvas) return null;

  // ── Resolve props for the *currently-scoped* target ──────────
  // Instance scope: four-layer resolve at the instance's own selection / version.
  // Variant scope:  base ← matched-axis-overrides (published) ← matching draft override.
  // Base scope:     base ← baseDraft (axis-agnostic).
  let displayedProps: Record<string, PropValue>;
  if (editScope === "variant" && editingAxisCombinationKey) {
    displayedProps = resolveProps(
      component,
      editingAxisCombinationKey.axisSelection,
      undefined,
      { draftScope: "component" },
    );
  } else if (editScope === "base" && editingBaseKey) {
    displayedProps = {
      ...component.baseSpec.props,
      ...(component.baseDraft ?? {}),
    };
  } else {
    displayedProps = resolveProps(component, instance.axisSelection, instance.propOverrides, {
      variantVersion: instance.variantVersion,
    });
  }

  const setProp = (key: string, value: PropValue) => {
    if (editScope === "variant" && editingAxisCombinationKey) {
      updateAxisOverrideDraft(
        editingAxisCombinationKey.componentId,
        editingAxisCombinationKey.axisSelection,
        { [key]: value },
      );
    } else if (editScope === "base" && editingBaseKey) {
      updateBaseDraft(editingBaseKey.componentId, { [key]: value });
    } else {
      updateInstanceProps(instance.id, { [key]: value });
    }
  };

  const scopeHeader = (() => {
    if (editScope === "variant" && editingAxisCombinationKey) {
      return {
        kind: "VARIANT",
        title: synthesizeVariantName(component, editingAxisCombinationKey.axisSelection),
      };
    }
    if (editScope === "base" && editingBaseKey) {
      return { kind: "BASE", title: component.name };
    }
    return {
      kind: "INSTANCE",
      title: `${component.name} · ${synthesizeVariantName(component, instance.axisSelection)}`,
      meta: `v${instance.variantVersion}`,
    };
  })();

  // ── Styles ────────────────────────────────────────────────
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
  const rowStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };

  // Dev tab is hidden for structural nodes (root containers, row primitives,
  // etc.) where handoff doesn't apply. We use hideFamilyView as the proxy —
  // same signal 2b uses for "this isn't user-authored, it's scaffolding".
  const devTabAvailable = !component.hideFamilyView;

  // If the Dev tab is showing but the selection changes to a component that
  // doesn't support it, fall back to properties for this render.
  const activeTab: RightPanelTab = devTabAvailable ? rightPanelTab : "properties";

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
      <TabBar
        activeTab={activeTab}
        devAvailable={devTabAvailable}
        onSelect={setRightPanelTab}
      />

      {activeTab === "properties" ? (
        <>
          <div>
            <div
              style={{ fontSize: 11, color: "var(--atelier-panel-muted)", letterSpacing: "0.08em" }}
            >
              {scopeHeader.kind}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{scopeHeader.title}</div>
            {"meta" in scopeHeader && scopeHeader.meta ? (
              <div style={{ fontSize: 11, color: "var(--atelier-panel-muted)", marginTop: 2 }}>
                {scopeHeader.meta}
              </div>
            ) : null}
          </div>

          <ScopeSelector
            editScope={editScope}
            pending={pendingScopeEscalation}
            onSelect={(s) => {
              if (s === "instance") {
                resetScopeToInstance();
                return;
              }
              if (s === editScope) {
                cancelScopeEscalation();
                return;
              }
              if (pendingScopeEscalation === s) {
                confirmScopeEscalation();
                return;
              }
              requestScopeEscalation(s);
            }}
          />

          {pendingScopeEscalation ? (
            <ScopeConfirm
              pending={pendingScopeEscalation}
              component={component}
              axisSelection={instance.axisSelection}
              onCancel={cancelScopeEscalation}
              onConfirm={confirmScopeEscalation}
            />
          ) : null}

          <PropSections
            component={component}
            displayedProps={displayedProps}
            tokenRosters={tokenRosters}
            rowStyle={rowStyle}
            labelStyle={labelStyle}
            inputStyle={inputStyle}
            onChange={setProp}
          />

          <div style={{ marginTop: "auto", fontSize: 11, color: "var(--atelier-panel-muted)" }}>
            {editScope === "instance"
              ? "Edits here are instance overrides (this canvas only)."
              : editScope === "variant"
              ? "Edits are staged on the variant draft. Push to publish."
              : "Edits are staged on the base. Push cascades to all variants."}
          </div>
        </>
      ) : (
        <DevModePanel component={component} instance={instance} />
      )}
    </aside>
  );
}

// ── TabBar ─────────────────────────────────────────────────

interface TabBarProps {
  activeTab: RightPanelTab;
  devAvailable: boolean;
  onSelect: (tab: RightPanelTab) => void;
}

function TabBar({ activeTab, devAvailable, onSelect }: TabBarProps) {
  const tab = (id: RightPanelTab, label: string, disabled = false) => {
    const isActive = activeTab === id;
    return (
      <button
        key={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onSelect(id)}
        style={{
          flex: 1,
          padding: "6px 0",
          background: "transparent",
          border: "none",
          borderBottom: `2px solid ${isActive ? "var(--atelier-panel-text)" : "transparent"}`,
          color: disabled
            ? "var(--atelier-panel-muted)"
            : isActive
              ? "var(--atelier-panel-text)"
              : "var(--atelier-panel-muted)",
          fontSize: 12,
          fontWeight: isActive ? 600 : 500,
          letterSpacing: "0.04em",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--atelier-panel-border)",
        marginBottom: 4,
      }}
    >
      {tab("properties", "Properties")}
      {tab("dev", "Dev", !devAvailable)}
    </div>
  );
}

// ── ScopeSelector ──────────────────────────────────────────

interface ScopeSelectorProps {
  editScope: EditScope;
  pending: EditScope | null;
  onSelect: (scope: EditScope) => void;
}

function ScopeSelector({ editScope, pending, onSelect }: ScopeSelectorProps) {
  const btn = (target: EditScope, label: string, accent: string) => {
    const isActive = editScope === target;
    const isPending = pending === target;
    return (
      <button
        key={target}
        type="button"
        onClick={() => onSelect(target)}
        style={{
          flex: 1,
          padding: "6px 4px",
          border: "1px solid var(--atelier-panel-border)",
          borderColor: isActive ? accent : isPending ? accent : "var(--atelier-panel-border)",
          background: isActive ? accent : isPending ? "rgba(0,0,0,0)" : "#11141a",
          color: isActive ? "#0c0e13" : "var(--atelier-panel-text)",
          fontSize: 11,
          fontWeight: isActive ? 600 : 500,
          letterSpacing: "0.02em",
          cursor: "pointer",
          borderRadius: 4,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {btn("instance", "Instance", "#9ccdff")}
      {btn("variant", "Variant", "#b695ff")}
      {btn("base", "Base", "#f4b64b")}
    </div>
  );
}

// ── ScopeConfirm ──────────────────────────────────────────

interface ScopeConfirmProps {
  pending: EditScope;
  component: Component;
  axisSelection: Record<string, string>;
  onCancel: () => void;
  onConfirm: () => void;
}

function ScopeConfirm({ pending, component, axisSelection, onCancel, onConfirm }: ScopeConfirmProps) {
  // Avoid deriving objects inside the selector — Zustand's snapshot cache
  // trips on fresh references each call. Compute stats from a stable slice.
  const canvases = useCanvasStore((s) => s.canvases);
  const stats =
    pending === "variant"
      ? countAxisCombinationUsage(canvases, component.id, axisSelection)
      : countFromCanvasesByComponent(canvases, component.id);

  const isBase = pending === "base";
  const stripe = isBase ? "#f4b64b" : "#b695ff";
  const body = isBase
    ? `Changes to the base will cascade to all ${component.axes.reduce(
        (n, a) => n * a.options.length,
        component.axes.length === 0 ? 1 : 1,
      )} variants and ${stats.instanceCount} instances across ${stats.canvasCount} canvases.`
    : `You're about to edit this variant. Changes will affect ${stats.instanceCount} instances across ${stats.canvasCount} canvases once published.`;

  return (
    <div
      style={{
        border: `1px solid ${stripe}`,
        borderLeftWidth: 3,
        borderRadius: 4,
        padding: "10px 12px",
        background: "rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontSize: 12,
      }}
    >
      <div style={{ color: "var(--atelier-panel-text)" }}>{body}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            padding: "4px 10px",
            borderRadius: 4,
            border: "none",
            background: stripe,
            color: "#0c0e13",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {isBase ? "Edit base" : "Edit variant"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "4px 10px",
            borderRadius: 4,
            border: "1px solid var(--atelier-panel-border)",
            background: "transparent",
            color: "var(--atelier-panel-text)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── PropSections (schema-driven grouping) ──────────────────
// Groups displayed props into "Tokens" and "Content" sections per
// component.propSchema. Props without a schema entry fall back to
// value-type inference and go into "Other" — which is a warning sign
// that the component's schema isn't complete.

interface PropSectionsProps {
  component: Component;
  displayedProps: Record<string, PropValue>;
  tokenRosters: Record<string, string[]>;
  rowStyle: CSSProperties;
  labelStyle: CSSProperties;
  inputStyle: CSSProperties;
  onChange: (key: string, value: PropValue) => void;
}

function PropSections({
  component,
  displayedProps,
  tokenRosters,
  rowStyle,
  labelStyle,
  inputStyle,
  onChange,
}: PropSectionsProps) {
  const schema = component.propSchema ?? {};
  const entries = Object.entries(displayedProps);

  // Preserve schema-declared order first, then anything else in discovery order.
  const schemaOrder = new Map<string, number>();
  Object.keys(schema).forEach((k, i) => schemaOrder.set(k, i));
  entries.sort(([a], [b]) => {
    const ai = schemaOrder.get(a);
    const bi = schemaOrder.get(b);
    if (ai === undefined && bi === undefined) return 0;
    if (ai === undefined) return 1;
    if (bi === undefined) return -1;
    return ai - bi;
  });

  const tokens: typeof entries = [];
  const content: typeof entries = [];
  const other: typeof entries = [];
  for (const [k, v] of entries) {
    const category = schema[k]?.category;
    if (category === "token") tokens.push([k, v]);
    else if (category === "content") content.push([k, v]);
    else {
      // Fallback inference when schema is missing.
      if (isTokenRef(v)) tokens.push([k, v]);
      else other.push([k, v]);
    }
  }

  const section = (title: string, items: typeof entries) =>
    items.length === 0 ? null : (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--atelier-panel-muted)",
            opacity: 0.7,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(([key, val]) => (
            <PropField
              key={key}
              propKey={key}
              value={val}
              schemaEntry={schema[key]}
              tokenRosters={tokenRosters}
              rowStyle={rowStyle}
              labelStyle={labelStyle}
              inputStyle={inputStyle}
              onChange={(v) => onChange(key, v)}
            />
          ))}
        </div>
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {section("Tokens", tokens)}
      {section("Content", content)}
      {section("Other", other)}
    </div>
  );
}

// ── PropField ──────────────────────────────────────────────

interface PropFieldProps {
  propKey: string;
  value: PropValue;
  schemaEntry?: PropSchemaEntry;
  tokenRosters: Record<string, string[]>;
  rowStyle: CSSProperties;
  labelStyle: CSSProperties;
  inputStyle: CSSProperties;
  onChange: (v: PropValue) => void;
}

function isTokenRef(v: unknown): v is TokenRef {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "token" in (v as object) &&
    typeof (v as { token: unknown }).token === "string"
  );
}

function tokenCategoryOf(tokenPath: string): TokenCategory | null {
  const dot = tokenPath.indexOf(".");
  if (dot < 0) return null;
  const prefix = tokenPath.slice(0, dot);
  const valid: TokenCategory[] = [
    "color",
    "spacing",
    "radius",
    "type",
    "shadow",
    "height",
    "icon-size",
    "stroke",
    "font-size",
  ];
  return (valid as string[]).includes(prefix) ? (prefix as TokenCategory) : null;
}

function PropField({
  propKey,
  value,
  schemaEntry,
  tokenRosters,
  rowStyle,
  labelStyle,
  inputStyle,
  onChange,
}: PropFieldProps) {
  const displayLabel = schemaEntry?.label ?? propKey;

  // Token fields: prefer schema's tokenCategory; else infer from the current
  // TokenRef's path prefix. Still renders if value is a TokenRef even when
  // schema is missing (so ingested-but-unschema'd components degrade usefully).
  if (schemaEntry?.category === "token" || isTokenRef(value)) {
    const currentTokenPath = isTokenRef(value) ? value.token : null;
    const cat: TokenCategory | null =
      schemaEntry?.tokenCategory ?? (currentTokenPath ? tokenCategoryOf(currentTokenPath) : null);
    const roster = cat ? tokenRosters[cat] ?? null : null;
    if (roster) {
      const tokenValue = currentTokenPath ?? roster[0] ?? "";
      return (
        <label style={rowStyle}>
          <span style={labelStyle}>{displayLabel}</span>
          <select
            value={tokenValue}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange({ token: e.target.value })}
            style={inputStyle}
          >
            {roster.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {cat === "color" && currentTokenPath ? (
            <span
              style={{
                display: "inline-block",
                width: "100%",
                height: 10,
                borderRadius: 2,
                background: resolveToken({ token: currentTokenPath }),
              }}
            />
          ) : null}
        </label>
      );
    }
  }

  // Content fields + untyped fallbacks.
  const contentKind = schemaEntry?.contentKind;

  if (contentKind === "boolean" || typeof value === "boolean") {
    return (
      <label style={{ ...rowStyle, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={typeof value === "boolean" ? value : false}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        />
        <span style={{ ...labelStyle, textTransform: "none", letterSpacing: 0, fontSize: 13 }}>
          {displayLabel}
        </span>
      </label>
    );
  }

  if (contentKind === "number" || (typeof value === "number" && !schemaEntry)) {
    return (
      <label style={rowStyle}>
        <span style={labelStyle}>{displayLabel}</span>
        <input
          type="number"
          value={typeof value === "number" ? value : 0}
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

  if (contentKind === "multiline") {
    return (
      <label style={rowStyle}>
        <span style={labelStyle}>{displayLabel}</span>
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
        />
      </label>
    );
  }

  if (contentKind === "text" || typeof value === "string") {
    // Complex values (arrays/objects) masquerading as "text" in the schema
    // fall through to read-only JSON — text input can't safely round-trip them.
    if (typeof value === "string") {
      return (
        <label style={rowStyle}>
          <span style={labelStyle}>{displayLabel}</span>
          <input
            type="text"
            value={value}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            style={inputStyle}
          />
        </label>
      );
    }
  }

  // Complex / null — read-only JSON preview.
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{displayLabel}</span>
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

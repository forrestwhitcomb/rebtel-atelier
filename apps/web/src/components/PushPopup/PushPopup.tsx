"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { publishedAtVersion, type PropValue } from "@rebtel-atelier/spec";
import { renderInstance, resolveToken } from "@rebtel-atelier/renderer";
import type { Canvas } from "@rebtel-atelier/spec";
import {
  countFromCanvases,
  countFromCanvasesByComponent,
  useCanvasStore,
  type PushPopupFilter,
} from "@/stores/canvas";

export function PushPopup() {
  const pushPopupOpen = useCanvasStore((s) => s.pushPopupOpen);
  const editScope = useCanvasStore((s) => s.editScope);
  const editingVariantKey = useCanvasStore((s) => s.editingVariantKey);
  const editingBaseKey = useCanvasStore((s) => s.editingBaseKey);
  const closePushPopup = useCanvasStore((s) => s.closePushPopup);
  const publishVariant = useCanvasStore((s) => s.publishVariant);
  const publishBase = useCanvasStore((s) => s.publishBase);

  const canvases = useCanvasStore((s) => s.canvases);
  const designSystem = useCanvasStore((s) => s.designSystem);

  const isPublishing = useCanvasStore((s) => s.isPublishing);
  const publishError = useCanvasStore((s) => s.publishError);
  const lastPublishedPr = useCanvasStore((s) => s.lastPublishedPr);
  const canvasPublishChoices = useCanvasStore((s) => s.canvasPublishChoices);
  const pushPopupFilter = useCanvasStore((s) => s.pushPopupFilter);
  const setCanvasPublishChoice = useCanvasStore((s) => s.setCanvasPublishChoice);
  const setPushPopupFilter = useCanvasStore((s) => s.setPushPopupFilter);

  if (!pushPopupOpen) return null;

  // Derive info in the render body from primitive slices.
  let info:
    | {
        kind: "variant";
        component: import("@rebtel-atelier/spec").Component;
        variantId: string;
        variantName: string;
        oldPublished: Record<string, PropValue>;
        draft: Record<string, PropValue>;
        fromVersion: number;
        instanceCount: number;
        canvasCount: number;
      }
    | {
        kind: "base";
        component: import("@rebtel-atelier/spec").Component;
        baseDraft: Record<string, PropValue>;
        fromVersion: number;
        instanceCount: number;
        canvasCount: number;
      }
    | null = null;

  if (editScope === "variant" && editingVariantKey) {
    const component = designSystem.components.find(
      (c) => c.id === editingVariantKey.componentId,
    );
    const variant = component?.variants.find((v) => v.id === editingVariantKey.variantId);
    if (component && variant) {
      const stats = countFromCanvases(
        canvases,
        editingVariantKey.componentId,
        editingVariantKey.variantId,
      );
      info = {
        kind: "variant",
        component,
        variantId: editingVariantKey.variantId,
        variantName: variant.name,
        oldPublished: publishedAtVersion(variant, variant.publishedVersion),
        draft: variant.draft,
        fromVersion: variant.publishedVersion,
        instanceCount: stats.instanceCount,
        canvasCount: stats.canvasCount,
      };
    }
  } else if (editScope === "base" && editingBaseKey) {
    const component = designSystem.components.find(
      (c) => c.id === editingBaseKey.componentId,
    );
    if (component) {
      const stats = countFromCanvasesByComponent(
        canvases,
        editingBaseKey.componentId,
        component.variants.length,
      );
      info = {
        kind: "base",
        component,
        baseDraft: component.baseDraft ?? {},
        fromVersion: component.version,
        instanceCount: stats.instanceCount,
        canvasCount: stats.canvasCount,
      };
    }
  }

  if (!info) return null;

  const stripe = info.kind === "variant" ? "#b695ff" : "#f4b64b";
  const changedKeys =
    info.kind === "variant" ? Object.keys(info.draft) : Object.keys(info.baseDraft);

  // Build before/after preview instances so the user can see what the change
  // looks like in isolation. We render via the normal renderer — no DS math
  // in the popup, just different inputs.
  const previewId = "__push_preview__";
  const previewInstance =
    info.kind === "variant"
      ? {
          id: previewId,
          componentId: info.component.id,
          variantId: info.variantId,
          variantVersion: info.fromVersion,
          propOverrides: {} as Record<string, PropValue>,
          position: { x: 0, y: 0 },
          frameId: "__preview__",
        }
      : {
          id: previewId,
          componentId: info.component.id,
          variantId: info.component.variants[0]?.id ?? "default",
          variantVersion: 1,
          propOverrides: {} as Record<string, PropValue>,
          position: { x: 0, y: 0 },
          frameId: "__preview__",
        };

  return (
    <div
      onClick={() => closePushPopup()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxWidth: "92vw",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "#11141a",
          borderRadius: 8,
          border: "1px solid var(--atelier-panel-border)",
          borderLeft: `3px solid ${stripe}`,
          color: "var(--atelier-panel-text)",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: stripe,
            }}
          >
            {info.kind === "variant" ? "Push variant" : "Push base component"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {info.kind === "variant"
              ? `${info.component.name} · ${info.variantName}`
              : info.component.name}
          </div>
        </header>

        <BeforeAfter
          kind={info.kind}
          component={info.component}
          previewInstance={previewInstance}
          oldVariantPublished={info.kind === "variant" ? info.oldPublished : undefined}
          variantDraft={info.kind === "variant" ? info.draft : undefined}
          baseDraft={info.kind === "base" ? info.baseDraft : undefined}
        />

        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--atelier-panel-muted)" }}>
            What lands
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {changedKeys.length === 0 ? (
              <span style={{ color: "var(--atelier-panel-muted)", fontSize: 12 }}>
                No changes
              </span>
            ) : (
              changedKeys.map((k) => (
                <span
                  key={k}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    border: `1px solid ${stripe}`,
                    background: "rgba(0,0,0,0.3)",
                  }}
                >
                  {k}
                </span>
              ))
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--atelier-panel-muted)" }}>
            Affects <b style={{ color: "var(--atelier-panel-text)" }}>{info.instanceCount}</b>{" "}
            instances across{" "}
            <b style={{ color: "var(--atelier-panel-text)" }}>{info.canvasCount}</b>{" "}
            canvases. Files touched:{" "}
            <code style={{ fontSize: 11 }}>
              packages/rebtel-ds/src/components/{info.component.name}/
              {info.kind === "variant"
                ? `${info.component.name}.variants.ts`
                : `${info.component.name}.spec.ts`}
            </code>
          </div>
        </section>

        {info.kind === "variant" ? (
          <ImpactPreview
            canvases={canvases}
            componentId={info.component.id}
            variantId={info.variantId}
            filter={pushPopupFilter}
            onFilter={setPushPopupFilter}
            choices={canvasPublishChoices}
            onToggle={setCanvasPublishChoice}
            fromVersion={info.fromVersion}
            nextVersion={info.fromVersion + 1}
            disabled={isPublishing || lastPublishedPr !== null}
          />
        ) : null}

        {publishError ? (
          <div
            style={{
              padding: "10px 12px",
              border: "1px solid #e06565",
              borderRadius: 4,
              background: "rgba(224, 101, 101, 0.08)",
              fontSize: 12,
              color: "#ffbaba",
            }}
          >
            Publish failed: {publishError}
          </div>
        ) : null}

        {lastPublishedPr ? (
          <div
            style={{
              padding: "10px 12px",
              border: "1px solid #5ed3c9",
              borderRadius: 4,
              background: "rgba(94, 211, 201, 0.06)",
              fontSize: 12,
              color: "var(--atelier-panel-text)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontWeight: 600, color: "#5ed3c9" }}>Published ✓</div>
            <a
              href={lastPublishedPr.url}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#9ccdff", textDecoration: "none", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
            >
              {lastPublishedPr.url}
            </a>
          </div>
        ) : null}

        <footer
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => closePushPopup()}
            style={{
              padding: "8px 14px",
              borderRadius: 4,
              border: "1px solid var(--atelier-panel-border)",
              background: "transparent",
              color: "var(--atelier-panel-text)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {lastPublishedPr ? "Done" : "Cancel"}
          </button>
          {!lastPublishedPr ? (
            <button
              type="button"
              disabled={changedKeys.length === 0 || isPublishing}
              onClick={() => {
                if (info.kind === "variant") {
                  publishVariant(info.component.id, info.variantId);
                } else {
                  publishBase(info.component.id);
                }
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 4,
                border: "none",
                background: stripe,
                color: "#0c0e13",
                fontSize: 13,
                fontWeight: 600,
                cursor:
                  changedKeys.length === 0 || isPublishing ? "not-allowed" : "pointer",
                opacity: changedKeys.length === 0 || isPublishing ? 0.6 : 1,
              }}
            >
              {isPublishing
                ? "Opening PR…"
                : info.kind === "variant"
                  ? "Push variant"
                  : "Push to all components"}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

// ── Impact preview ────────────────────────────────────────

interface ImpactPreviewProps {
  canvases: Record<string, Canvas>;
  componentId: string;
  variantId: string;
  filter: PushPopupFilter;
  onFilter: (f: PushPopupFilter) => void;
  choices: Record<string, boolean>;
  onToggle: (canvasId: string, adopt: boolean) => void;
  fromVersion: number;
  nextVersion: number;
  disabled: boolean;
}

interface ImpactRow {
  canvas: Canvas;
  instanceCount: number;
}

function ImpactPreview({
  canvases,
  componentId,
  variantId,
  filter,
  onFilter,
  choices,
  onToggle,
  fromVersion,
  nextVersion,
  disabled,
}: ImpactPreviewProps) {
  const rows: ImpactRow[] = useMemo(() => {
    const out: ImpactRow[] = [];
    for (const c of Object.values(canvases)) {
      let n = 0;
      for (const inst of c.instances) {
        if (inst.componentId === componentId && inst.variantId === variantId) n += 1;
      }
      if (n > 0) out.push({ canvas: c, instanceCount: n });
    }
    // Stable order: draft before shipped, then alpha by name.
    out.sort((a, b) => {
      if (a.canvas.status !== b.canvas.status) {
        return a.canvas.status === "draft" ? -1 : 1;
      }
      return a.canvas.name.localeCompare(b.canvas.name);
    });
    return out;
  }, [canvases, componentId, variantId]);

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "inProgress") return r.canvas.status === "draft";
    return r.canvas.status === "shipped";
  });

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--atelier-panel-muted)",
          }}
        >
          Per-canvas impact
        </div>
        <FilterBar active={filter} onChange={onFilter} />
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding: "12px",
            border: "1px dashed var(--atelier-panel-border)",
            borderRadius: 4,
            fontSize: 12,
            color: "var(--atelier-panel-muted)",
            fontStyle: "italic",
          }}
        >
          No canvases use this variant yet. It will become available once published.
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: "8px",
            fontSize: 12,
            color: "var(--atelier-panel-muted)",
            fontStyle: "italic",
          }}
        >
          No canvases match this filter.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((r) => (
            <CanvasImpactRow
              key={r.canvas.id}
              row={r}
              adopt={choices[r.canvas.id] ?? r.canvas.status === "draft"}
              onToggle={(adopt) => onToggle(r.canvas.id, adopt)}
              fromVersion={fromVersion}
              nextVersion={nextVersion}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FilterBar({
  active,
  onChange,
}: {
  active: PushPopupFilter;
  onChange: (f: PushPopupFilter) => void;
}) {
  const btn = (id: PushPopupFilter, label: string) => {
    const isActive = active === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        style={{
          padding: "3px 8px",
          fontSize: 11,
          background: isActive ? "var(--atelier-panel-text)" : "transparent",
          color: isActive ? "#0c0e13" : "var(--atelier-panel-muted)",
          border: "1px solid var(--atelier-panel-border)",
          borderRadius: 3,
          cursor: "pointer",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {btn("all", "All")}
      {btn("inProgress", "In progress")}
      {btn("shipped", "Shipped")}
    </div>
  );
}

function CanvasImpactRow({
  row,
  adopt,
  onToggle,
  fromVersion,
  nextVersion,
  disabled,
}: {
  row: ImpactRow;
  adopt: boolean;
  onToggle: (adopt: boolean) => void;
  fromVersion: number;
  nextVersion: number;
  disabled: boolean;
}) {
  const { canvas, instanceCount } = row;
  const isDraft = canvas.status === "draft";
  const badgeBg = isDraft ? "#f4b64b" : "#6b7280";

  // Thumbnail stub — a flat rect colored by draft/shipped, with a small
  // chip showing the instance count. Real thumbnails come later.
  const thumb = (
    <div
      style={{
        width: 48,
        height: 36,
        borderRadius: 3,
        background: isDraft ? "rgba(244, 182, 75, 0.16)" : "rgba(107, 114, 128, 0.18)",
        border: `1px solid ${badgeBg}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--atelier-panel-text)",
        flexShrink: 0,
      }}
      aria-hidden
    >
      {instanceCount}×
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        border: "1px solid var(--atelier-panel-border)",
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      {thumb}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600, color: "var(--atelier-panel-text)" }}>
            {canvas.name}
          </span>
          <span
            style={{
              padding: "1px 6px",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              borderRadius: 2,
              color: "#0c0e13",
              background: badgeBg,
              fontWeight: 600,
            }}
          >
            {isDraft ? "Draft" : "Shipped"}
          </span>
        </div>
        <div style={{ color: "var(--atelier-panel-muted)", fontSize: 11 }}>
          {instanceCount} instance{instanceCount === 1 ? "" : "s"} · offline (no editors)
        </div>
      </div>
      <fieldset
        disabled={disabled}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          border: "none",
          padding: 0,
          margin: 0,
          fontSize: 11,
          color: "var(--atelier-panel-muted)",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input
            type="radio"
            name={`adopt-${canvas.id}`}
            checked={adopt}
            onChange={() => onToggle(true)}
          />
          <span style={{ color: adopt ? "var(--atelier-panel-text)" : undefined }}>
            Adopt v{nextVersion}
          </span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input
            type="radio"
            name={`adopt-${canvas.id}`}
            checked={!adopt}
            onChange={() => onToggle(false)}
          />
          <span style={{ color: !adopt ? "var(--atelier-panel-text)" : undefined }}>
            Stay on v{fromVersion}
          </span>
        </label>
      </fieldset>
    </div>
  );
}

// ── Before/After preview ──────────────────────────────────

interface BeforeAfterProps {
  kind: "variant" | "base";
  component: import("@rebtel-atelier/spec").Component;
  previewInstance: import("@rebtel-atelier/spec").Instance;
  oldVariantPublished?: Record<string, PropValue>;
  variantDraft?: Record<string, PropValue>;
  baseDraft?: Record<string, PropValue>;
}

function BeforeAfter({
  kind,
  component,
  previewInstance,
  oldVariantPublished,
  variantDraft,
  baseDraft,
}: BeforeAfterProps) {
  // Build two copies of the component: one reflecting current state (before push)
  // and one reflecting post-push state. Render via the normal renderer.
  const { beforeComponent, afterComponent } = useMemo(() => {
    if (kind === "variant") {
      const variantId = previewInstance.variantId;
      // Clear publishedHistory on the preview variant so the resolver falls
      // back to `published` — which we set explicitly here for before/after.
      const before: typeof component = {
        ...component,
        variants: component.variants.map((v) =>
          v.id === variantId
            ? {
                ...v,
                draft: {},
                published: oldVariantPublished ?? v.published,
                publishedHistory: undefined,
              }
            : v,
        ),
      };
      const after: typeof component = {
        ...component,
        variants: component.variants.map((v) =>
          v.id === variantId
            ? {
                ...v,
                draft: {},
                published: { ...(oldVariantPublished ?? v.published), ...(variantDraft ?? {}) },
                publishedHistory: undefined,
              }
            : v,
        ),
      };
      return { beforeComponent: before, afterComponent: after };
    }
    // base
    const before: typeof component = {
      ...component,
      baseDraft: {},
    };
    const after: typeof component = {
      ...component,
      baseSpec: {
        ...component.baseSpec,
        props: { ...component.baseSpec.props, ...(baseDraft ?? {}) },
      },
      baseDraft: {},
    };
    return { beforeComponent: before, afterComponent: after };
  }, [kind, component, previewInstance.variantId, oldVariantPublished, variantDraft, baseDraft]);
  void resolveToken;

  const column: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 16,
    background: "var(--rebtel-surface-page-canvas, #1a1d24)",
    borderRadius: 6,
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
  };
  const label: CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--atelier-panel-muted)",
  };

  return (
    <section style={{ display: "flex", gap: 12 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={label}>Before</div>
        <div style={column}>{renderInstance(previewInstance, beforeComponent)}</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={label}>After</div>
        <div style={column}>{renderInstance(previewInstance, afterComponent)}</div>
      </div>
    </section>
  );
}


import type { Component, ComponentOverrideSnapshot } from "@rebtel-atelier/spec";
import {
  diffOverrideSnapshots,
  formatDiffLine,
  type AxisOverrideDiff,
  type VariantDiffEntry,
} from "./diffVariant.js";

/**
 * Per-canvas impact data for the PR body's "Impact" section.
 * Shipped canvases typically stay pinned to the old version; draft
 * canvases typically adopt. That distinction is what the section
 * actually communicates.
 */
export interface CanvasImpactRow {
  canvasId: string;
  canvasName: string;
  instanceCount: number;
  status: "draft" | "shipped";
  /** True if this canvas adopts the new component version on publish. */
  adoptsNewVersion: boolean;
}

export interface BuildMessageOptions {
  component: Component;
  /** Pre-publish snapshot (matches `component.publishedHistory[previousVersion]`). */
  previousPublished: ComponentOverrideSnapshot;
  /** Post-publish snapshot (matches the about-to-write `component.published`). */
  nextPublished: ComponentOverrideSnapshot;
  previousVersion: number;
  nextVersion: number;
  impacts: CanvasImpactRow[];
  /** Optional author display name for the "Context" section. */
  editor?: string;
  /** Optional URL back to the component in Atelier (stretch). */
  atelierUrl?: string;
}

function describeImpactSummary(impacts: CanvasImpactRow[]): string {
  const totalInstances = impacts.reduce((sum, r) => sum + r.instanceCount, 0);
  const canvasCount = impacts.length;
  return `${totalInstances} instance${totalInstances === 1 ? "" : "s"} across ${canvasCount} canvas${
    canvasCount === 1 ? "" : "es"
  }`;
}

function diffBulletList(diff: VariantDiffEntry[], bulletPrefix = "  - "): string {
  if (diff.length === 0) return `${bulletPrefix}(no property changes)`;
  return diff.map((e) => `${bulletPrefix}${formatDiffLine(e)}`).join("\n");
}

function describeAxisDiffs(diffs: AxisOverrideDiff[]): string {
  if (diffs.length === 0) return "_(no axis-override changes)_";
  return diffs
    .map((d) => `- **${d.slug}**\n${diffBulletList(d.entries, "  - ")}`)
    .join("\n");
}

// ── Commit message ─────────────────────────────────────────
// Format:
//   [atelier] ComponentName: update style=primary[+axis2=v2,…] (and N more)
//
//   - axisCombo:
//     - key: before → after
//   - ...

export function buildCommitMessage(opts: BuildMessageOptions): string {
  const { component, previousPublished, nextPublished, previousVersion, nextVersion } = opts;
  const { axes, states } = diffOverrideSnapshots(previousPublished, nextPublished);

  const subjectSlug = (() => {
    if (axes.length === 0) {
      if (states.length === 0) return `update component`;
      return `update state ${states[0]!.state}${states.length > 1 ? ` (and ${states.length - 1} more)` : ""}`;
    }
    const head = axes[0]!.slug;
    const more = axes.length > 1 ? ` (and ${axes.length - 1} more)` : "";
    return `update ${head}${more}`;
  })();

  const subject = `[atelier] ${component.name}: ${subjectSlug} (v${previousVersion} → v${nextVersion})`;

  const bodyLines: string[] = [];
  if (axes.length > 0) {
    bodyLines.push("Axis overrides:");
    for (const d of axes) {
      bodyLines.push(`- ${d.slug}`);
      bodyLines.push(diffBulletList(d.entries, "  - "));
    }
  }
  if (states.length > 0) {
    if (bodyLines.length > 0) bodyLines.push("");
    bodyLines.push("State overrides:");
    for (const s of states) {
      bodyLines.push(`- ${s.state}`);
      bodyLines.push(diffBulletList(s.entries, "  - "));
    }
  }
  if (bodyLines.length === 0) bodyLines.push("(no property changes)");

  return `${subject}\n\n${bodyLines.join("\n")}\n`;
}

// ── PR body ────────────────────────────────────────────────

export function buildPrBody(opts: BuildMessageOptions): string {
  const { component, previousPublished, nextPublished, previousVersion, nextVersion, impacts, editor, atelierUrl } = opts;
  const { axes, states } = diffOverrideSnapshots(previousPublished, nextPublished);

  const whatChanged =
    `## What changed\n` +
    `Updated \`${component.name}\` (v${previousVersion} → v${nextVersion}).\n\n` +
    `### Axis overrides\n` +
    describeAxisDiffs(axes) +
    `\n` +
    (states.length > 0
      ? `\n### State overrides\n` +
        states
          .map((s) => `- **${s.state}**\n${diffBulletList(s.entries, "  - ")}`)
          .join("\n") +
        `\n`
      : "");

  const impactLines = impacts.length
    ? impacts
        .map((r) => {
          const pinLabel = r.adoptsNewVersion
            ? `adopts v${nextVersion}`
            : `pinned to v${previousVersion}`;
          return `- ${r.canvasName} (${r.instanceCount} instance${
            r.instanceCount === 1 ? "" : "s"
          }, ${r.status} — ${pinLabel})`;
        })
        .join("\n")
    : "- No canvases currently use this component.";

  const impact =
    `## Impact\n` +
    `This change affects **${describeImpactSummary(impacts)}** in Atelier.\n\n` +
    impactLines +
    `\n`;

  const contextLines: string[] = [];
  if (editor) contextLines.push(`Edited by ${editor} in Atelier.`);
  if (atelierUrl) contextLines.push(`[View in Atelier →](${atelierUrl})`);
  if (contextLines.length === 0) contextLines.push("Edited in Atelier.");
  const context = `## Context\n${contextLines.join(" ")}\n`;

  const devNotes =
    `## Dev notes\n` +
    `- Token references resolved against \`packages/rebtel-ds/src/tokens.ts\`\n` +
    `- File format: v4 component spec (axes + state overrides)\n` +
    `- Visual checks: not yet implemented (manual review only)\n`;

  return [whatChanged, impact, context, devNotes].join("\n");
}

// ── Branch name ────────────────────────────────────────────
// Pattern: atelier/component/<component-slug>-<short-hash>
//
// v3 branched per-variant; v4 publishes the whole component, so the
// branch is per-component too. Short hash keeps successive publishes of
// the same component distinguishable.

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildBranchName(component: Component, shortHash: string): string {
  return `atelier/component/${slugify(component.id)}-${shortHash}`;
}

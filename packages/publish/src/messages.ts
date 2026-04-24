import type { Component, Variant } from "@rebtel-atelier/spec";
import { diffVariantProps, formatDiffLine, type VariantDiffEntry } from "./diffVariant.js";

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
  /** True if this canvas adopts the new variant version on publish. */
  adoptsNewVersion: boolean;
}

export interface BuildMessageOptions {
  component: Component;
  variantBefore: Variant;
  variantAfter: Variant;
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

function diffBulletList(diff: VariantDiffEntry[], bulletPrefix = "- "): string {
  if (diff.length === 0) return `${bulletPrefix}(no property changes)`;
  return diff.map((e) => `${bulletPrefix}${formatDiffLine(e)}`).join("\n");
}

// ── Commit message ─────────────────────────────────────────
// Format:
//   [atelier] ComponentName: update variant-slug variant
//
//   - key: before → after
//   - ...

export function buildCommitMessage(opts: BuildMessageOptions): string {
  const { component, variantBefore, variantAfter } = opts;
  const diff = diffVariantProps(variantBefore.published, variantAfter.published);
  const subject = `[atelier] ${component.name}: update ${variantAfter.id} variant`;
  const body = diffBulletList(diff);
  return `${subject}\n\n${body}\n`;
}

// ── PR body ────────────────────────────────────────────────
// Sections: What changed / Impact / Context / Dev notes.

export function buildPrBody(opts: BuildMessageOptions): string {
  const { component, variantBefore, variantAfter, impacts, editor, atelierUrl } = opts;
  const diff = diffVariantProps(variantBefore.published, variantAfter.published);

  const whatChanged =
    `## What changed\n` +
    `Updated the \`${variantAfter.id}\` variant of \`${component.name}\`.\n\n` +
    `### Property changes\n` +
    diffBulletList(diff) +
    `\n`;

  const impactLines = impacts.length
    ? impacts
        .map((r) => {
          const pinLabel = r.adoptsNewVersion
            ? `adopts v${variantAfter.publishedVersion}`
            : `pinned to v${variantBefore.publishedVersion}`;
          return `- ${r.canvasName} (${r.instanceCount} instance${
            r.instanceCount === 1 ? "" : "s"
          }, ${r.status} — ${pinLabel})`;
        })
        .join("\n")
    : "- No canvases currently use this variant.";

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
    `- File format: auto-generated from variant spec, safe to merge as-is\n` +
    `- Visual checks: not yet implemented (session 3 ships manual review only)\n`;

  return [whatChanged, impact, context, devNotes].join("\n");
}

// ── Branch name ────────────────────────────────────────────
// Pattern: atelier/variant/<component-slug>-<variant-slug>-<short-hash>

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildBranchName(
  component: Component,
  variantId: string,
  shortHash: string,
): string {
  return `atelier/variant/${slugify(component.id)}-${slugify(variantId)}-${shortHash}`;
}

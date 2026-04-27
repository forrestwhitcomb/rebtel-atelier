"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { Component, Instance } from "@rebtel-atelier/spec";
import { buildJsxSnippet } from "./snippet";
import { collectResolvedTokens } from "./tokens";
import { synthesizeVariantName } from "@/stores/canvas";

interface DevModePanelProps {
  component: Component;
  instance: Instance;
}

/**
 * Read-only handoff view. Shows the JSX an engineer would paste, the
 * semantic token references behind the rendered styles, and links out
 * to the source on GitHub. No editing happens here.
 *
 * Each axis becomes its own prop in the snippet (`style="primary"`,
 * `size="md"`) — the engineer's React component signature receives one
 * string prop per axis, not a single flattened `variant` slug.
 */
export function DevModePanel({ component, instance }: DevModePanelProps) {
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(
    () => buildJsxSnippet(component, instance),
    [component, instance],
  );
  const tokens = useMemo(
    () => collectResolvedTokens(component, instance),
    [component, instance],
  );

  const variantName = synthesizeVariantName(component, instance.axisSelection);

  const repoOwner = process.env.NEXT_PUBLIC_GITHUB_REPO_OWNER;
  const repoName = process.env.NEXT_PUBLIC_GITHUB_REPO_NAME;
  const repoPath = `packages/rebtel-ds/src/components/${component.id}`;
  const repoLink =
    repoOwner && repoName
      ? `https://github.com/${repoOwner}/${repoName}/tree/main/${repoPath}`
      : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked in unsecured contexts; no-op.
    }
  };

  // ── Styles ─────────────────────────────────────────────────
  const section: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
  const sectionLabel: CSSProperties = {
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--atelier-panel-muted)",
    opacity: 0.7,
  };
  const codeBlock: CSSProperties = {
    background: "#0b0d12",
    border: "1px solid var(--atelier-panel-border)",
    borderRadius: 4,
    padding: "10px 12px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: 12,
    lineHeight: 1.55,
    whiteSpace: "pre",
    overflowX: "auto",
    color: "var(--atelier-panel-text)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div>
        <div
          style={{
            display: "inline-block",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#5ed3c9",
            border: "1px solid rgba(94, 211, 201, 0.35)",
            borderRadius: 3,
            padding: "2px 6px",
            marginBottom: 6,
          }}
        >
          Dev handoff
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{component.name}</div>
        <div style={{ fontSize: 12, color: "var(--atelier-panel-muted)", marginTop: 2 }}>
          {variantName} ·{" "}
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
            v{instance.variantVersion}
          </span>
        </div>
      </div>

      {/* JSX snippet */}
      <div style={section}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={sectionLabel}>JSX</span>
          <button
            type="button"
            onClick={copy}
            style={{
              background: copied ? "#5ed3c9" : "transparent",
              border: "1px solid var(--atelier-panel-border)",
              borderColor: copied ? "#5ed3c9" : "var(--atelier-panel-border)",
              color: copied ? "#0c0e13" : "var(--atelier-panel-text)",
              fontSize: 10,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: 3,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre style={codeBlock}>
          <JsxHighlight text={snippet.text} />
        </pre>
      </div>

      {/* Resolved tokens */}
      <div style={section}>
        <span style={sectionLabel}>Resolved tokens</span>
        {tokens.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "var(--atelier-panel-muted)",
              fontStyle: "italic",
              padding: "6px 0",
            }}
          >
            This component uses no token props.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 16px 1fr",
              columnGap: 10,
              rowGap: 6,
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              alignItems: "center",
            }}
          >
            {tokens.map((row) => (
              <ResolvedTokenRow key={row.role} row={row} />
            ))}
          </div>
        )}
      </div>

      {/* Links */}
      <div style={section}>
        <span style={sectionLabel}>Links</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {repoLink ? (
            <a
              href={repoLink}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 12,
                color: "#9ccdff",
                textDecoration: "none",
              }}
            >
              Open in repo →
            </a>
          ) : (
            <span style={{ fontSize: 12, color: "var(--atelier-panel-muted)", fontStyle: "italic" }}>
              Repo link unavailable (set NEXT_PUBLIC_GITHUB_REPO_*)
            </span>
          )}
          <span
            style={{
              fontSize: 12,
              color: "var(--atelier-panel-muted)",
              fontStyle: "italic",
              opacity: 0.7,
            }}
            title="Coming later — opens the full ComponentSpec JSON"
          >
            View full spec →
          </span>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--atelier-panel-muted)", lineHeight: 1.5 }}>
        Read-only handoff. Token refs are semantic — the engineer's codebase
        maps them to their own imports.
      </div>
    </div>
  );
}

// ── Resolved token row ──────────────────────────────────────

function ResolvedTokenRow({ row }: { row: { role: string; tokenName: string; category: string; cssValue: string } }) {
  const showSwatch = row.category === "color";
  return (
    <>
      <div style={{ color: "var(--atelier-panel-muted)" }}>{row.role}</div>
      <div>
        {showSwatch ? (
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              borderRadius: 2,
              background: row.cssValue,
              border: "1px solid rgba(255,255,255,0.08)",
              verticalAlign: "middle",
            }}
            aria-hidden
          />
        ) : null}
      </div>
      <div style={{ color: "var(--atelier-panel-text)", overflow: "hidden", textOverflow: "ellipsis" }}>
        {row.tokenName}
      </div>
    </>
  );
}

// ── JSX syntax highlight ────────────────────────────────────
// Minimal token-level coloring: component name, attr names, string
// literals, numeric/boolean literals. No AST — small regex pass just to
// make the copy-worthy snippet readable.

function JsxHighlight({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  // Tokenize: angle brackets + slash, identifiers, strings, braced expressions,
  // equals, whitespace, and everything else. We color identifiers by position
  // (first one after `<` is the component name; otherwise attr name), strings
  // green, braced expressions orange.
  const regex = /("(?:[^"\\]|\\.)*")|(\{[^{}]*\})|([A-Za-z_][A-Za-z0-9_]*)|(<\/?|\/>|>|=)|(\s+)|(.)/g;

  let inTag = false;
  let expectingComponentName = false;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    const [, str, brace, ident, sym, ws, other] = match;
    const key = `t${idx++}`;
    if (ws) {
      parts.push(ws);
      continue;
    }
    if (sym) {
      if (sym === "<" || sym === "</") {
        inTag = true;
        expectingComponentName = true;
      } else if (sym === "/>" || sym === ">") {
        inTag = false;
        expectingComponentName = false;
      }
      parts.push(
        <span key={key} style={{ color: "#6b7280" }}>
          {sym}
        </span>,
      );
      continue;
    }
    if (ident) {
      if (inTag && expectingComponentName) {
        expectingComponentName = false;
        parts.push(
          <span key={key} style={{ color: "#b695ff", fontWeight: 600 }}>
            {ident}
          </span>,
        );
      } else if (inTag) {
        parts.push(
          <span key={key} style={{ color: "#9ccdff" }}>
            {ident}
          </span>,
        );
      } else {
        parts.push(ident);
      }
      continue;
    }
    if (str) {
      parts.push(
        <span key={key} style={{ color: "#b7d98c" }}>
          {str}
        </span>,
      );
      continue;
    }
    if (brace) {
      parts.push(
        <span key={key} style={{ color: "#f4b64b" }}>
          {brace}
        </span>,
      );
      continue;
    }
    if (other) {
      parts.push(other);
    }
  }

  return <>{parts}</>;
}

// Token resolution — dot-path key → CSS custom property reference.
// Values live in ./tokens.css (imported by apps/web's global CSS).
// Ported from the Aphantasia Rebtel fork; CLAUDE.md invariant #1 enforced
// by scripts/verify-no-hex.mjs against packages/rebtel-ds/src/components/**.

import type { TextStyleToken, Token, TokenCategory, TokenRef } from "@rebtel-atelier/spec";
import { isTokenRef } from "@rebtel-atelier/spec";

// ── Token catalog (typed metadata) ────────────────────────────
// Every dot-path token is categorized. This is how Token<'color'>,
// Token<'spacing'> etc. become load-bearing — components read metadata here,
// not raw CSS strings.

function mkToken<C extends TokenCategory>(category: C, token: string): Token<C> {
  return { category, token };
}

// ── CSS variable map (runtime value source) ───────────────────

export const TOKEN_CSS: Record<string, string> = {
  // Spacing
  "spacing.none": "var(--rebtel-spacing-none)",
  "spacing.xxxs": "var(--rebtel-spacing-xxxs)",
  "spacing.xxs": "var(--rebtel-spacing-xxs)",
  "spacing.xs": "var(--rebtel-spacing-xs)",
  "spacing.sm": "var(--rebtel-spacing-sm)",
  "spacing.md": "var(--rebtel-spacing-md)",
  "spacing.lg": "var(--rebtel-spacing-lg)",
  "spacing.xl": "var(--rebtel-spacing-xl)",
  "spacing.xxl": "var(--rebtel-spacing-xxl)",
  "spacing.xxxl": "var(--rebtel-spacing-xxxl)",
  "spacing.xxxxl": "var(--rebtel-spacing-xxxxl)",

  // Heights
  "height.xs": "var(--rebtel-height-xs)",
  "height.sm": "var(--rebtel-height-sm)",
  "height.md": "var(--rebtel-height-md)",
  "height.lg": "var(--rebtel-height-lg)",
  "height.xl": "var(--rebtel-height-xl)",
  "height.xxl": "var(--rebtel-height-xxl)",
  "height.xxxl": "var(--rebtel-height-xxxl)",

  // Radius
  "radius.xs": "var(--rebtel-radius-xs)",
  "radius.sm": "var(--rebtel-radius-sm)",
  "radius.md": "var(--rebtel-radius-md)",
  "radius.lg": "var(--rebtel-radius-lg)",
  "radius.xl": "var(--rebtel-radius-xl)",
  "radius.xxl": "var(--rebtel-radius-xxl)",
  "radius.full": "var(--rebtel-radius-full)",

  // Surfaces (mapped)
  "color.surface-primary": "var(--rebtel-surface-primary)",
  "color.surface-elevated": "var(--rebtel-surface-primary-elevated)",
  "color.surface-inverse": "var(--rebtel-surface-primary-inverse)",
  "color.surface-neutral": "var(--rebtel-surface-primary-neutral)",
  "color.surface-light": "var(--rebtel-surface-primary-light)",
  "color.surface-lighter": "var(--rebtel-surface-primary-lighter)",
  "color.surface-brand": "var(--rebtel-surface-brand-red)",
  "color.surface-canvas": "var(--rebtel-surface-canvas)",
  "color.surface-default": "var(--rebtel-surface-default)",
  "color.surface-raised": "var(--rebtel-surface-raised)",
  "color.surface-overlay": "var(--rebtel-surface-overlay)",
  "color.surface-sheet": "var(--rebtel-surface-sheet)",
  "color.surface-calling": "var(--rebtel-surface-calling)",
  "color.surface-mtu": "var(--rebtel-surface-mtu)",
  "color.surface-page-canvas": "var(--rebtel-surface-page-canvas)",
  "color.surface-page-default": "var(--rebtel-surface-page-default)",
  "color.surface-page-raised": "var(--rebtel-surface-page-raised)",
  "color.surface-page-overlay": "var(--rebtel-surface-page-overlay)",
  "color.surface-brand-primary": "var(--rebtel-surface-brand-primary)",
  "color.surface-brand-pressed": "var(--rebtel-surface-brand-pressed)",
  "color.surface-brand-subtle": "var(--rebtel-surface-brand-subtle)",
  "color.surface-accent-primary": "var(--rebtel-surface-accent-primary)",
  "color.surface-accent-subtle": "var(--rebtel-surface-accent-subtle)",
  "color.surface-feedback-error": "var(--rebtel-surface-feedback-error)",
  "color.surface-feedback-error-subtle": "var(--rebtel-surface-feedback-error-subtle)",
  "color.surface-feedback-warning": "var(--rebtel-surface-feedback-warning)",
  "color.surface-feedback-warning-subtle": "var(--rebtel-surface-feedback-warning-subtle)",
  "color.surface-feedback-success": "var(--rebtel-surface-feedback-success)",
  "color.surface-feedback-success-subtle": "var(--rebtel-surface-feedback-success-subtle)",
  "color.surface-overlay-scrim": "var(--rebtel-surface-overlay-scrim)",
  "color.surface-overlay-scrim-strong": "var(--rebtel-surface-overlay-scrim-strong)",
  "color.surface-overlay-transparent": "var(--rebtel-surface-overlay-transparent)",
  "color.surface-feature-calling": "var(--rebtel-surface-feature-calling)",
  "color.surface-feature-mtu": "var(--rebtel-surface-feature-mtu)",

  // Content / Text
  "color.text-primary": "var(--rebtel-text-primary)",
  "color.text-secondary": "var(--rebtel-text-secondary)",
  "color.text-tertiary": "var(--rebtel-text-tertiary)",
  "color.text-highlight": "var(--rebtel-text-highlight)",
  "color.text-brand-inverted": "var(--rebtel-text-brand-inverted)",
  "color.text-on-brand": "var(--rebtel-text-on-brand)",
  "color.content-primary": "var(--rebtel-content-primary)",
  "color.content-secondary": "var(--rebtel-content-secondary)",
  "color.content-tertiary": "var(--rebtel-content-tertiary)",
  "color.content-disabled": "var(--rebtel-content-disabled)",
  "color.content-inverse": "var(--rebtel-content-inverse)",
  "color.content-brand": "var(--rebtel-content-brand)",
  "color.content-success": "var(--rebtel-content-success)",
  "color.content-accent": "var(--rebtel-content-accent)",
  "color.content-warning": "var(--rebtel-content-warning)",
  "color.content-error": "var(--rebtel-content-error)",
  "color.text-white-constant": "var(--rebtel-content-inverse)",
  "color.text-black-constant": "var(--rebtel-content-primary)",

  // Icons
  "color.icon-default": "var(--rebtel-icon-default)",
  "color.icon-secondary": "var(--rebtel-icon-secondary)",
  "color.icon-disabled": "var(--rebtel-icon-disabled)",
  "color.icon-brand": "var(--rebtel-icon-brand)",
  "color.icon-primary": "var(--rebtel-icon-primary)",
  "color.icon-tertiary": "var(--rebtel-icon-tertiary)",
  "color.icon-inverse": "var(--rebtel-icon-inverse)",
  "color.icon-accent": "var(--rebtel-icon-accent)",
  "color.icon-success": "var(--rebtel-icon-success)",
  "color.icon-warning": "var(--rebtel-icon-warning)",
  "color.icon-error": "var(--rebtel-icon-error)",
  "color.icon-lightest": "var(--rebtel-icon-inverse)",

  // Brand
  "color.brand-red": "var(--rebtel-brand-red)",
  "color.brand-black": "var(--rebtel-brand-black)",
  "color.brand-white": "var(--rebtel-brand-white)",

  // Borders
  "color.border-default": "var(--rebtel-border-default)",
  "color.border-secondary": "var(--rebtel-border-secondary)",
  "color.border-highlight": "var(--rebtel-border-highlight)",
  "color.border-tertiary": "var(--rebtel-border-default)",
  "color.border-strong": "var(--rebtel-border-strong)",
  "color.border-subtle": "var(--rebtel-border-subtle)",
  "color.border-focus": "var(--rebtel-border-focus)",
  "color.border-brand": "var(--rebtel-border-brand)",
  "color.border-accent": "var(--rebtel-border-accent)",
  "color.border-error": "var(--rebtel-border-error)",
  "color.border-success": "var(--rebtel-border-success)",
  "color.border-warning": "var(--rebtel-border-warning)",

  // Buttons (mapped)
  "color.button-primary": "var(--rebtel-button-primary)",
  "color.button-secondary-white": "var(--rebtel-button-secondary-white)",
  "color.button-secondary-grey": "var(--rebtel-button-secondary-grey)",
  "color.button-disabled": "var(--rebtel-button-disabled)",
  "color.button-green": "var(--rebtel-button-green)",
  "color.surface-button-primary": "var(--rebtel-button-primary-bg)",
  "color.surface-button-secondary-black": "var(--rebtel-button-secondary-black-bg)",
  "color.surface-button-secondary-white": "var(--rebtel-button-secondary-white-bg)",
  "color.surface-button-secondary-grey": "var(--rebtel-button-secondary-grey-bg)",
  "color.surface-label-black": "var(--rebtel-surface-page-overlay)",
  "color.surface-primary-light": "var(--rebtel-surface-primary-light)",
  "color.surface-primary-lighter": "var(--rebtel-surface-primary-lighter)",
  "color.surface-primary-transparent": "var(--rebtel-surface-overlay-transparent)",

  // Semantic
  "color.green": "var(--rebtel-green)",
  "color.green-light": "var(--rebtel-green-light)",
  "color.success": "var(--rebtel-success)",
  "color.success-light": "var(--rebtel-success-light)",
  "color.warning": "var(--rebtel-warning)",
  "color.warning-light": "var(--rebtel-warning-light)",
  "color.red-light": "var(--rebtel-red-light)",
  "color.red-50": "var(--rebtel-red-50)",
  "color.purple": "var(--rebtel-purple)",

  // Grey scale
  "color.grey-900": "var(--rebtel-grey-900)",
  "color.grey-800": "var(--rebtel-grey-800)",
  "color.grey-700": "var(--rebtel-grey-700)",
  "color.grey-600": "var(--rebtel-grey-600)",
  "color.grey-500": "var(--rebtel-grey-500)",
  "color.grey-400": "var(--rebtel-grey-400)",
  "color.grey-300": "var(--rebtel-grey-300)",
  "color.grey-200": "var(--rebtel-grey-200)",
  "color.grey-100": "var(--rebtel-grey-100)",
  "color.grey-50": "var(--rebtel-grey-50)",
  "color.grey-0": "var(--rebtel-grey-0)",
  "color.grey-900-a40": "var(--rebtel-grey-900-a40)",
  "color.grey-900-a60": "var(--rebtel-grey-900-a60)",
  "color.grey-900-a80": "var(--rebtel-grey-900-a80)",
  "color.grey-100-a0": "var(--rebtel-grey-100-a0)",
  "color.grey-800-a0": "var(--rebtel-grey-800-a0)",

  // Red scale
  "color.red-100": "var(--rebtel-red-100)",
  "color.red-200": "var(--rebtel-red-200)",
  "color.red-300": "var(--rebtel-red-300)",
  "color.red-400": "var(--rebtel-red-400)",
  "color.red-500": "var(--rebtel-red-500)",
  "color.red-600": "var(--rebtel-red-600)",
  "color.red-700": "var(--rebtel-red-700)",
  "color.red-800": "var(--rebtel-red-800)",

  // Blue / Accent scale
  "color.blue-100": "var(--rebtel-blue-100)",
  "color.blue-200": "var(--rebtel-blue-200)",
  "color.blue-300": "var(--rebtel-blue-300)",
  "color.blue-400": "var(--rebtel-blue-400)",
  "color.blue-500": "var(--rebtel-blue-500)",
  "color.blue-600": "var(--rebtel-blue-600)",
  "color.blue-700": "var(--rebtel-blue-700)",

  // Green scale
  "color.green-100": "var(--rebtel-green-100)",
  "color.green-200": "var(--rebtel-green-200)",
  "color.green-300": "var(--rebtel-green-300)",
  "color.green-400": "var(--rebtel-green-400)",
  "color.green-500": "var(--rebtel-green-500)",

  // Orange / Warning scale
  "color.orange-100": "var(--rebtel-orange-100)",
  "color.orange-200": "var(--rebtel-orange-200)",
  "color.orange-300": "var(--rebtel-orange-300)",

  // Singletons
  "color.purple-500": "var(--rebtel-purple-500)",
  "color.shadow-500": "var(--rebtel-shadow-500)",
  "color.sand-100": "var(--rebtel-sand-100)",
  "color.cornflower-100": "var(--rebtel-cornflower-100)",

  // Button — primary (all states)
  "color.button-primary-bg": "var(--rebtel-button-primary-bg)",
  "color.button-primary-text": "var(--rebtel-button-primary-text)",
  "color.button-primary-bg-pressed": "var(--rebtel-button-primary-bg-pressed)",
  "color.button-primary-bg-disabled": "var(--rebtel-button-primary-bg-disabled)",
  "color.button-primary-bg-focus": "var(--rebtel-button-primary-bg-focus)",
  "color.button-primary-border": "var(--rebtel-button-primary-border)",
  "color.button-primary-border-disabled": "var(--rebtel-button-primary-border-disabled)",
  "color.button-primary-border-focus": "var(--rebtel-button-primary-border-focus)",
  "color.button-primary-text-disabled": "var(--rebtel-button-primary-text-disabled)",
  "color.button-primary-icon": "var(--rebtel-button-primary-icon)",
  "color.button-primary-icon-disabled": "var(--rebtel-button-primary-icon-disabled)",

  // Button — secondary black (all states)
  "color.button-secondary-black-bg": "var(--rebtel-button-secondary-black-bg)",
  "color.button-secondary-black-text": "var(--rebtel-button-secondary-black-text)",
  "color.button-secondary-black-bg-pressed": "var(--rebtel-button-secondary-black-bg-pressed)",
  "color.button-secondary-black-bg-disabled": "var(--rebtel-button-secondary-black-bg-disabled)",
  "color.button-secondary-black-bg-focus": "var(--rebtel-button-secondary-black-bg-focus)",
  "color.button-secondary-black-border": "var(--rebtel-button-secondary-black-border)",
  "color.button-secondary-black-border-disabled":
    "var(--rebtel-button-secondary-black-border-disabled)",
  "color.button-secondary-black-border-focus": "var(--rebtel-button-secondary-black-border-focus)",
  "color.button-secondary-black-icon": "var(--rebtel-button-secondary-black-icon)",
  "color.button-secondary-black-icon-disabled": "var(--rebtel-button-secondary-black-icon-disabled)",

  // Button — secondary white (all states)
  "color.button-secondary-white-bg": "var(--rebtel-button-secondary-white-bg)",
  "color.button-secondary-white-bg-pressed": "var(--rebtel-button-secondary-white-bg-pressed)",
  "color.button-secondary-white-bg-disabled": "var(--rebtel-button-secondary-white-bg-disabled)",
  "color.button-secondary-white-bg-focus": "var(--rebtel-button-secondary-white-bg-focus)",
  "color.button-secondary-white-border": "var(--rebtel-button-secondary-white-border)",
  "color.button-secondary-white-border-disabled":
    "var(--rebtel-button-secondary-white-border-disabled)",
  "color.button-secondary-white-border-focus": "var(--rebtel-button-secondary-white-border-focus)",
  "color.button-secondary-white-text": "var(--rebtel-button-secondary-white-text)",
  "color.button-secondary-white-text-disabled": "var(--rebtel-button-secondary-white-text-disabled)",
  "color.button-secondary-white-icon": "var(--rebtel-button-secondary-white-icon)",
  "color.button-secondary-white-icon-disabled": "var(--rebtel-button-secondary-white-icon-disabled)",

  // Button — secondary grey (all states)
  "color.button-secondary-grey-bg": "var(--rebtel-button-secondary-grey-bg)",
  "color.button-secondary-grey-bg-pressed": "var(--rebtel-button-secondary-grey-bg-pressed)",
  "color.button-secondary-grey-bg-disabled": "var(--rebtel-button-secondary-grey-bg-disabled)",
  "color.button-secondary-grey-bg-focus": "var(--rebtel-button-secondary-grey-bg-focus)",
  "color.button-secondary-grey-border": "var(--rebtel-button-secondary-grey-border)",
  "color.button-secondary-grey-border-disabled":
    "var(--rebtel-button-secondary-grey-border-disabled)",
  "color.button-secondary-grey-border-focus": "var(--rebtel-button-secondary-grey-border-focus)",
  "color.button-secondary-grey-text": "var(--rebtel-button-secondary-grey-text)",
  "color.button-secondary-grey-text-disabled": "var(--rebtel-button-secondary-grey-text-disabled)",
  "color.button-secondary-grey-icon": "var(--rebtel-button-secondary-grey-icon)",
  "color.button-secondary-grey-icon-disabled": "var(--rebtel-button-secondary-grey-icon-disabled)",

  // Button — ghost (all states)
  "color.button-ghost-bg": "var(--rebtel-button-ghost-bg)",
  "color.button-ghost-bg-pressed": "var(--rebtel-button-ghost-bg-pressed)",
  "color.button-ghost-bg-disabled": "var(--rebtel-button-ghost-bg-disabled)",
  "color.button-ghost-bg-focus": "var(--rebtel-button-ghost-bg-focus)",
  "color.button-ghost-border": "var(--rebtel-button-ghost-border)",
  "color.button-ghost-border-disabled": "var(--rebtel-button-ghost-border-disabled)",
  "color.button-ghost-border-focus": "var(--rebtel-button-ghost-border-focus)",
  "color.button-ghost-text": "var(--rebtel-button-ghost-text)",
  "color.button-ghost-text-disabled": "var(--rebtel-button-ghost-text-disabled)",
  "color.button-ghost-icon": "var(--rebtel-button-ghost-icon)",
  "color.button-ghost-icon-disabled": "var(--rebtel-button-ghost-icon-disabled)",
  "color.button-outlined-border": "var(--rebtel-button-outlined-border)",
  "color.button-outlined-text": "var(--rebtel-button-outlined-text)",

  // Input
  "color.input-bg": "var(--rebtel-input-bg)",
  "color.input-bg-focus": "var(--rebtel-input-bg-focus)",
  "color.input-bg-disabled": "var(--rebtel-input-bg-disabled)",
  "color.input-bg-error": "var(--rebtel-input-bg-error)",
  "color.input-border": "var(--rebtel-input-border)",
  "color.input-border-focus": "var(--rebtel-input-border-focus)",
  "color.input-border-disabled": "var(--rebtel-input-border-disabled)",
  "color.input-border-error": "var(--rebtel-input-border-error)",
  "color.input-text": "var(--rebtel-input-text)",
  "color.input-text-placeholder": "var(--rebtel-input-text-placeholder)",
  "color.input-text-disabled": "var(--rebtel-input-text-disabled)",
  "color.input-label": "var(--rebtel-input-label)",
  "color.input-label-focus": "var(--rebtel-input-label-focus)",
  "color.input-label-error": "var(--rebtel-input-label-error)",
  "color.input-icon": "var(--rebtel-input-icon)",
  "color.input-icon-focus": "var(--rebtel-input-icon-focus)",
  "color.input-icon-disabled": "var(--rebtel-input-icon-disabled)",
  "color.input-icon-error": "var(--rebtel-input-icon-error)",

  // Card
  "color.card-bg": "var(--rebtel-card-bg)",
  "color.card-bg-pressed": "var(--rebtel-card-bg-pressed)",
  "color.card-border": "var(--rebtel-card-border)",
  "color.card-border-pressed": "var(--rebtel-card-border-pressed)",
  "color.card-elevated-bg": "var(--rebtel-card-elevated-bg)",
  "color.card-elevated-border": "var(--rebtel-card-elevated-border)",

  // Label
  "color.label-neutral-bg": "var(--rebtel-label-neutral-bg)",
  "color.label-neutral-border": "var(--rebtel-label-neutral-border)",
  "color.label-neutral-text": "var(--rebtel-label-neutral-text)",
  "color.label-brand-bg": "var(--rebtel-label-brand-bg)",
  "color.label-brand-border": "var(--rebtel-label-brand-border)",
  "color.label-brand-text": "var(--rebtel-label-brand-text)",
  "color.label-accent-bg": "var(--rebtel-label-accent-bg)",
  "color.label-accent-border": "var(--rebtel-label-accent-border)",
  "color.label-accent-text": "var(--rebtel-label-accent-text)",
  "color.label-success-bg": "var(--rebtel-label-success-bg)",
  "color.label-success-border": "var(--rebtel-label-success-border)",
  "color.label-success-text": "var(--rebtel-label-success-text)",
  "color.label-warning-bg": "var(--rebtel-label-warning-bg)",
  "color.label-warning-border": "var(--rebtel-label-warning-border)",
  "color.label-warning-text": "var(--rebtel-label-warning-text)",
  "color.label-error-bg": "var(--rebtel-label-error-bg)",
  "color.label-error-border": "var(--rebtel-label-error-border)",
  "color.label-error-text": "var(--rebtel-label-error-text)",
  "color.label-purple-bg": "var(--rebtel-label-purple-bg)",
  "color.label-purple-border": "var(--rebtel-label-purple-border)",
  "color.label-purple-text": "var(--rebtel-label-purple-text)",
  "color.feedback-label-purple": "var(--rebtel-feedback-label-purple)",
  "color.feedback-label-dark": "var(--rebtel-feedback-label-dark)",

  // Tab
  "color.tab-bg": "var(--rebtel-tab-bg)",
  "color.tab-bg-active": "var(--rebtel-tab-bg-active)",
  "color.tab-border": "var(--rebtel-tab-border)",
  "color.tab-border-active": "var(--rebtel-tab-border-active)",
  "color.tab-text": "var(--rebtel-tab-text)",
  "color.tab-text-active": "var(--rebtel-tab-text-active)",
  "color.tab-text-disabled": "var(--rebtel-tab-text-disabled)",
  "color.tab-icon": "var(--rebtel-tab-icon)",
  "color.tab-icon-active": "var(--rebtel-tab-icon-active)",
  "color.tab-icon-disabled": "var(--rebtel-tab-icon-disabled)",
  "color.tab-indicator-active": "var(--rebtel-tab-indicator-active)",

  // Nav
  "color.nav-bar-bg": "var(--rebtel-nav-bar-bg)",
  "color.nav-bar-border": "var(--rebtel-nav-bar-border)",
  "color.nav-bar-icon": "var(--rebtel-nav-bar-icon)",
  "color.nav-bar-icon-active": "var(--rebtel-nav-bar-icon-active)",
  "color.nav-bar-text": "var(--rebtel-nav-bar-text)",
  "color.nav-bar-text-active": "var(--rebtel-nav-bar-text-active)",

  // Home cards
  "color.home-card-calling-bg": "var(--rebtel-home-card-calling-bg)",
  "color.home-card-mtu-bg": "var(--rebtel-home-card-mtu-bg)",

  // Icon sizes
  "icon-size.xxs": "var(--rebtel-icon-size-xxs)",
  "icon-size.xs": "var(--rebtel-icon-size-xs)",
  "icon-size.sm": "var(--rebtel-icon-size-sm)",
  "icon-size.md": "var(--rebtel-icon-size-md)",
  "icon-size.lg": "var(--rebtel-icon-size-lg)",
  "icon-size.xl": "var(--rebtel-icon-size-xl)",
  "icon-size.xxl": "var(--rebtel-icon-size-xxl)",

  // Stroke
  "stroke.md": "var(--rebtel-stroke-md)",
  "stroke.lg": "var(--rebtel-stroke-lg)",
  "stroke.xl": "var(--rebtel-stroke-xl)",
  "stroke.xxl": "var(--rebtel-stroke-xxl)",

  // Font sizes (read by text style maps below)
  "font-size.headline-md": "var(--rebtel-headline-md-size)",
  "font-size.label-xl": "var(--rebtel-label-xl-size)",
  "font-size.label-lg": "var(--rebtel-label-lg-size)",
  "font-size.label-md": "var(--rebtel-label-md-size)",
  "font-size.label-sm": "var(--rebtel-label-sm-size)",
  "font-size.label-xs": "var(--rebtel-label-xs-size)",
  "font-size.paragraph-lg": "var(--rebtel-paragraph-lg-size)",
  "font-size.paragraph-md": "var(--rebtel-paragraph-md-size)",
  "font-size.paragraph-xs": "var(--rebtel-paragraph-xs-size)",

  // Shadows
  "shadow.sm": "0 1px 2px rgba(50,50,93,0.04)",
  "shadow.card": "4px 5px 10px 2px rgba(0,0,0,0.02)",
  "shadow.md": "0 4px 12px rgba(50,50,93,0.06)",
  "shadow.lg": "0 8px 24px rgba(50,50,93,0.08)",
  "shadow.button": "0 1px 3px rgba(50,50,93,0.06)",
};

// ── Category inference ───────────────────────────────────────

function categoryFromKey(key: string): TokenCategory {
  const prefix = key.split(".", 1)[0] ?? "";
  switch (prefix) {
    case "color":
      return "color";
    case "spacing":
      return "spacing";
    case "radius":
      return "radius";
    case "shadow":
      return "shadow";
    case "height":
      return "height";
    case "icon-size":
      return "icon-size";
    case "stroke":
      return "stroke";
    case "font-size":
      return "font-size";
    default:
      return "type";
  }
}

export const TOKEN_CATALOG: Record<string, Token<TokenCategory>> = Object.fromEntries(
  Object.keys(TOKEN_CSS).map((k) => [k, mkToken(categoryFromKey(k), k)]),
);

// ── Text style map ───────────────────────────────────────────

export interface TextStyleDef {
  family: string;
  size: string;
  lh: string;
  weight: number;
  ls: string;
}

const FONT_DISPLAY = "var(--rebtel-font-display)";
const FONT_BODY = "var(--rebtel-font-body)";
const LS = "var(--rebtel-ls)";

export const TEXT_STYLE_MAP: Record<TextStyleToken, TextStyleDef> = {
  "display-lg": {
    family: FONT_DISPLAY,
    size: "var(--rebtel-display-lg-size)",
    lh: "var(--rebtel-display-lg-lh)",
    weight: 700,
    ls: LS,
  },
  "display-md": {
    family: FONT_DISPLAY,
    size: "var(--rebtel-display-md-size)",
    lh: "var(--rebtel-display-md-lh)",
    weight: 700,
    ls: LS,
  },
  "display-sm": {
    family: FONT_DISPLAY,
    size: "var(--rebtel-display-sm-size)",
    lh: "var(--rebtel-display-sm-lh)",
    weight: 700,
    ls: LS,
  },
  "display-xs": {
    family: FONT_DISPLAY,
    size: "var(--rebtel-display-xs-size)",
    lh: "var(--rebtel-display-xs-lh)",
    weight: 700,
    ls: LS,
  },
  "headline-lg": {
    family: FONT_BODY,
    size: "var(--rebtel-headline-lg-size)",
    lh: "var(--rebtel-headline-lg-lh)",
    weight: 700,
    ls: LS,
  },
  "headline-md": {
    family: FONT_BODY,
    size: "var(--rebtel-headline-md-size)",
    lh: "var(--rebtel-headline-md-lh)",
    weight: 700,
    ls: LS,
  },
  "headline-sm": {
    family: FONT_BODY,
    size: "var(--rebtel-headline-sm-size)",
    lh: "var(--rebtel-headline-sm-lh)",
    weight: 600,
    ls: LS,
  },
  "headline-xs": {
    family: FONT_BODY,
    size: "var(--rebtel-headline-xs-size)",
    lh: "var(--rebtel-headline-xs-lh)",
    weight: 600,
    ls: LS,
  },
  "paragraph-xl": {
    family: FONT_BODY,
    size: "var(--rebtel-paragraph-xl-size)",
    lh: "var(--rebtel-paragraph-xl-lh)",
    weight: 400,
    ls: LS,
  },
  "paragraph-lg": {
    family: FONT_BODY,
    size: "var(--rebtel-paragraph-lg-size)",
    lh: "var(--rebtel-paragraph-lg-lh)",
    weight: 400,
    ls: LS,
  },
  "paragraph-md": {
    family: FONT_BODY,
    size: "var(--rebtel-paragraph-md-size)",
    lh: "var(--rebtel-paragraph-md-lh)",
    weight: 400,
    ls: LS,
  },
  "paragraph-sm": {
    family: FONT_BODY,
    size: "var(--rebtel-paragraph-sm-size)",
    lh: "var(--rebtel-paragraph-sm-lh)",
    weight: 400,
    ls: LS,
  },
  "paragraph-xs": {
    family: FONT_BODY,
    size: "var(--rebtel-paragraph-xs-size)",
    lh: "var(--rebtel-paragraph-xs-lh)",
    weight: 400,
    ls: LS,
  },
  "label-xl": {
    family: FONT_BODY,
    size: "var(--rebtel-label-xl-size)",
    lh: "var(--rebtel-label-xl-lh)",
    weight: 500,
    ls: LS,
  },
  "label-lg": {
    family: FONT_BODY,
    size: "var(--rebtel-label-lg-size)",
    lh: "var(--rebtel-label-lg-lh)",
    weight: 500,
    ls: LS,
  },
  "label-md": {
    family: FONT_BODY,
    size: "var(--rebtel-label-md-size)",
    lh: "var(--rebtel-label-md-lh)",
    weight: 500,
    ls: LS,
  },
  "label-sm": {
    family: FONT_BODY,
    size: "var(--rebtel-label-sm-size)",
    lh: "var(--rebtel-label-sm-lh)",
    weight: 500,
    ls: LS,
  },
  "label-xs": {
    family: FONT_BODY,
    size: "var(--rebtel-label-xs-size)",
    lh: "var(--rebtel-label-xs-lh)",
    weight: 500,
    ls: LS,
  },
};

// ── Resolution ───────────────────────────────────────────────

/**
 * Resolve a TokenRef or literal to a CSS value.
 * Numbers become `${n}px`. Strings pass through. TokenRefs look up in TOKEN_CSS.
 */
export function resolveToken(ref: TokenRef | string | number): string {
  if (typeof ref === "number") return `${ref}px`;
  if (typeof ref === "string") return ref;
  if (isTokenRef(ref)) {
    const val = TOKEN_CSS[ref.token];
    if (!val) {
      if (typeof console !== "undefined") {
        console.warn(`[rebtel-ds/tokens] Unknown token: "${ref.token}"`);
      }
      return "0px";
    }
    return val;
  }
  return "0px";
}

export function resolveTextStyle(style: TextStyleToken): TextStyleDef {
  return TEXT_STYLE_MAP[style];
}

/** Shorthand: return the CSS var reference for a dot-path token key. */
export function tokenVar(key: string): string {
  const val = TOKEN_CSS[key];
  if (!val) {
    if (typeof console !== "undefined") {
      console.warn(`[rebtel-ds/tokens] Unknown token key: "${key}"`);
    }
    return "0px";
  }
  return val;
}

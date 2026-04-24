import type { CSSProperties, ReactNode } from "react";
import { resolveTextStyle } from "../../tokens.js";

// Token-driven product card. Compositional: accepts a `cta` slot the
// renderer fills from the ComponentRef in baseSpec.children.
//
// Composition contract: the renderer pre-renders any ComponentRef child
// in this component's baseSpec.children and passes it as a slot prop
// keyed by ref.key. ProductCard declares one slot (`cta`); if present,
// it renders below the price block. If absent (nothing referenced —
// e.g. an instance whose component has been swapped without a slot
// fill), the layout collapses gracefully.

export interface ProductCardProps {
  bundle: string;
  duration: string;
  price: number;
  currency: string;
  /**
   * Display label for the CTA. Mirrors what the spec wires through to
   * the slot's Button label — keeps the inspector showing one familiar
   * string instead of asking editors to dig into a nested instance.
   */
  ctaLabel: string;
  /** CSS value (post-token-resolution). */
  bg: string;
  /** CSS value (post-token-resolution). */
  border: string;
  /** CSS value (post-token-resolution). */
  radius: string;
  /** CSS value (post-token-resolution). */
  priceColor: string;
  /**
   * Slot filled by the renderer from ProductCard's ComponentRef child
   * (`baseSpec.children` — the entry keyed `cta`). Optional so a
   * ProductCard rendered outside the renderer (e.g. in a unit test
   * fixture) still works.
   */
  cta?: ReactNode;
}

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

export function ProductCard({
  bundle,
  duration,
  price,
  currency,
  bg,
  border,
  radius,
  priceColor,
  cta,
}: ProductCardProps) {
  const bundleStyle = resolveTextStyle("headline-sm");
  const durationStyle = resolveTextStyle("paragraph-sm");
  const priceStyle = resolveTextStyle("headline-md");

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "var(--rebtel-spacing-sm)",
    padding: "var(--rebtel-spacing-md)",
    borderRadius: radius,
    backgroundColor: bg,
    borderWidth: "var(--rebtel-stroke-md)",
    borderStyle: "solid",
    borderColor: border,
    width: "100%",
    minHeight: "var(--rebtel-height-xxxl)",
    boxSizing: "border-box",
  };

  const bundleTextStyle: CSSProperties = {
    fontFamily: bundleStyle.family,
    fontSize: bundleStyle.size,
    lineHeight: bundleStyle.lh,
    fontWeight: bundleStyle.weight,
    letterSpacing: bundleStyle.ls,
    color: "var(--rebtel-content-primary)",
    margin: 0,
  };

  const durationTextStyle: CSSProperties = {
    fontFamily: durationStyle.family,
    fontSize: durationStyle.size,
    lineHeight: durationStyle.lh,
    fontWeight: durationStyle.weight,
    letterSpacing: durationStyle.ls,
    color: "var(--rebtel-content-secondary)",
    margin: 0,
  };

  const priceTextStyle: CSSProperties = {
    fontFamily: priceStyle.family,
    fontSize: priceStyle.size,
    lineHeight: priceStyle.lh,
    fontWeight: priceStyle.weight,
    letterSpacing: priceStyle.ls,
    color: priceColor,
    margin: 0,
    marginTop: "var(--rebtel-spacing-xs)",
  };

  return (
    <div style={containerStyle}>
      <p style={bundleTextStyle}>{bundle}</p>
      <p style={durationTextStyle}>{duration}</p>
      <p style={priceTextStyle}>{formatPrice(price, currency)}</p>
      {cta ? <div style={{ marginTop: "var(--rebtel-spacing-sm)" }}>{cta}</div> : null}
    </div>
  );
}

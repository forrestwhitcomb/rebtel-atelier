import type { CSSProperties } from "react";
import { resolveTextStyle } from "../../tokens.js";

// All visual choices are token props. Variants publish explicit token refs
// (bg, border, radius, priceColor) — the component never switches on a
// variant discriminator. See docs/COMPONENT_AUTHORING.md.

export type ProductCardVariantId = string;

export interface ProductCardProps {
  bundle: string;
  duration: string;
  price: number;
  currency: string;
  /** CSS value (post-token-resolution). */
  bg: string;
  /** CSS value (post-token-resolution). */
  border: string;
  /** CSS value (post-token-resolution). */
  radius: string;
  /** CSS value (post-token-resolution). */
  priceColor: string;
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
    </div>
  );
}

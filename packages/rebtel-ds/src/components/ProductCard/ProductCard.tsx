import type { CSSProperties } from "react";
import { resolveTextStyle, tokenVar } from "../../tokens.js";

export type ProductCardVariantId = "mtu-bundle" | "mtu-bundle-highlighted";

export interface ProductCardProps {
  bundle: string;
  duration: string;
  price: number;
  currency: string;
  variant?: ProductCardVariantId;
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
  variant = "mtu-bundle",
}: ProductCardProps) {
  const highlighted = variant === "mtu-bundle-highlighted";
  const bundleStyle = resolveTextStyle("headline-sm");
  const durationStyle = resolveTextStyle("paragraph-sm");
  const priceStyle = resolveTextStyle("headline-md");

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: tokenVar("spacing.sm"),
    padding: tokenVar("spacing.md"),
    borderRadius: tokenVar("radius.lg"),
    backgroundColor: highlighted
      ? tokenVar("color.home-card-mtu-bg")
      : tokenVar("color.card-bg"),
    borderWidth: tokenVar("stroke.md"),
    borderStyle: "solid",
    borderColor: highlighted ? tokenVar("color.border-brand") : tokenVar("color.card-border"),
    width: "100%",
    minHeight: tokenVar("height.xxxl"),
    boxSizing: "border-box",
  };

  const bundleTextStyle: CSSProperties = {
    fontFamily: bundleStyle.family,
    fontSize: bundleStyle.size,
    lineHeight: bundleStyle.lh,
    fontWeight: bundleStyle.weight,
    letterSpacing: bundleStyle.ls,
    color: tokenVar("color.content-primary"),
    margin: 0,
  };

  const durationTextStyle: CSSProperties = {
    fontFamily: durationStyle.family,
    fontSize: durationStyle.size,
    lineHeight: durationStyle.lh,
    fontWeight: durationStyle.weight,
    letterSpacing: durationStyle.ls,
    color: tokenVar("color.content-secondary"),
    margin: 0,
  };

  const priceTextStyle: CSSProperties = {
    fontFamily: priceStyle.family,
    fontSize: priceStyle.size,
    lineHeight: priceStyle.lh,
    fontWeight: priceStyle.weight,
    letterSpacing: priceStyle.ls,
    color: highlighted ? tokenVar("color.content-brand") : tokenVar("color.content-primary"),
    margin: 0,
    marginTop: tokenVar("spacing.xs"),
  };

  return (
    <div style={containerStyle}>
      <p style={bundleTextStyle}>{bundle}</p>
      <p style={durationTextStyle}>{duration}</p>
      <p style={priceTextStyle}>{formatPrice(price, currency)}</p>
    </div>
  );
}

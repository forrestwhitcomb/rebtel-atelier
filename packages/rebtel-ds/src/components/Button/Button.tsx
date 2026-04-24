import type { CSSProperties } from "react";
import { resolveTextStyle } from "../../tokens.js";

export type ButtonVariantId = "primary" | "secondary" | "ghost";

/**
 * Token-driven button. Colors and radius arrive as already-coerced CSS
 * variable references (the renderer coerces TokenRef → string via
 * resolveToken before invoking the component). Variant-edit mode works
 * by mutating these tokens on variant.draft — the button doesn't need to
 * know about variants at all.
 */
export interface ButtonProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** CSS value (post-token-resolution). */
  bg: string;
  /** CSS value (post-token-resolution). */
  fg: string;
  /** CSS value (post-token-resolution). */
  border: string;
  /** CSS value (post-token-resolution). */
  radius: string;
}

export function Button({
  label,
  onClick,
  disabled = false,
  bg,
  fg,
  border,
  radius,
}: ButtonProps) {
  const labelStyle = resolveTextStyle("label-md");
  const style: CSSProperties = {
    height: "var(--rebtel-height-lg)",
    paddingLeft: "var(--rebtel-spacing-xl)",
    paddingRight: "var(--rebtel-spacing-xl)",
    borderRadius: radius,
    backgroundColor: bg,
    color: fg,
    borderWidth: "var(--rebtel-stroke-md)",
    borderStyle: "solid",
    borderColor: border,
    fontFamily: labelStyle.family,
    fontSize: labelStyle.size,
    lineHeight: labelStyle.lh,
    fontWeight: labelStyle.weight,
    letterSpacing: labelStyle.ls,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  };

  return (
    <button type="button" onClick={onClick} disabled={disabled} style={style}>
      {label}
    </button>
  );
}

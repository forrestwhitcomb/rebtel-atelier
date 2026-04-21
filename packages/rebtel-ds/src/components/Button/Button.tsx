import type { CSSProperties } from "react";
import { resolveTextStyle, tokenVar } from "../../tokens.js";

export type ButtonVariantId = "primary" | "secondary" | "ghost";

export interface ButtonProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariantId;
}

function buttonColors(variant: ButtonVariantId, disabled: boolean) {
  switch (variant) {
    case "primary":
      return disabled
        ? {
            bg: tokenVar("color.button-primary-bg-disabled"),
            text: tokenVar("color.button-primary-text-disabled"),
            border: tokenVar("color.button-primary-border-disabled"),
          }
        : {
            bg: tokenVar("color.button-primary-bg"),
            text: tokenVar("color.button-primary-text"),
            border: tokenVar("color.button-primary-border"),
          };
    case "secondary":
      return disabled
        ? {
            bg: tokenVar("color.button-secondary-black-bg-disabled"),
            text: tokenVar("color.content-disabled"),
            border: tokenVar("color.button-secondary-black-border-disabled"),
          }
        : {
            bg: tokenVar("color.button-secondary-black-bg"),
            text: tokenVar("color.button-secondary-black-text"),
            border: tokenVar("color.button-secondary-black-border"),
          };
    case "ghost":
      return disabled
        ? {
            bg: tokenVar("color.button-ghost-bg-disabled"),
            text: tokenVar("color.button-ghost-text-disabled"),
            border: tokenVar("color.button-ghost-border-disabled"),
          }
        : {
            bg: tokenVar("color.button-ghost-bg"),
            text: tokenVar("color.button-ghost-text"),
            border: tokenVar("color.button-ghost-border"),
          };
  }
}

export function Button({ label, onClick, disabled = false, variant = "primary" }: ButtonProps) {
  const colors = buttonColors(variant, disabled);
  const labelStyle = resolveTextStyle("label-md");
  const style: CSSProperties = {
    height: tokenVar("height.lg"),
    paddingLeft: tokenVar("spacing.xl"),
    paddingRight: tokenVar("spacing.xl"),
    borderRadius: tokenVar("radius.md"),
    backgroundColor: colors.bg,
    color: colors.text,
    borderWidth: tokenVar("stroke.md"),
    borderStyle: "solid",
    borderColor: colors.border,
    fontFamily: labelStyle.family,
    fontSize: labelStyle.size,
    lineHeight: labelStyle.lh,
    fontWeight: labelStyle.weight,
    letterSpacing: labelStyle.ls,
    cursor: disabled ? "not-allowed" : "pointer",
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

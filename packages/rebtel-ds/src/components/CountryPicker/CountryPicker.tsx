import type { CSSProperties } from "react";
import { resolveTextStyle, tokenVar } from "../../tokens.js";

export interface CountryOption {
  code: string;
  name: string;
  flag?: string;
}

export type CountryPickerVariantId = "default";

export interface CountryPickerProps {
  countries: CountryOption[];
  selectedCode?: string | null;
  onSelect?: (code: string) => void;
  variant?: CountryPickerVariantId;
}

export function CountryPicker({
  countries,
  selectedCode = null,
  onSelect,
}: CountryPickerProps) {
  const labelStyle = resolveTextStyle("label-md");
  const paragraphStyle = resolveTextStyle("paragraph-md");

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: tokenVar("spacing.xs"),
    width: "100%",
  };

  const labelTextStyle: CSSProperties = {
    fontFamily: labelStyle.family,
    fontSize: labelStyle.size,
    lineHeight: labelStyle.lh,
    fontWeight: labelStyle.weight,
    letterSpacing: labelStyle.ls,
    color: tokenVar("color.input-label"),
    margin: 0,
  };

  const selectStyle: CSSProperties = {
    height: tokenVar("height.lg"),
    paddingLeft: tokenVar("spacing.md"),
    paddingRight: tokenVar("spacing.md"),
    borderRadius: tokenVar("radius.sm"),
    backgroundColor: tokenVar("color.input-bg"),
    color: tokenVar("color.input-text"),
    borderWidth: tokenVar("stroke.md"),
    borderStyle: "solid",
    borderColor: tokenVar("color.input-border"),
    fontFamily: paragraphStyle.family,
    fontSize: paragraphStyle.size,
    lineHeight: paragraphStyle.lh,
    fontWeight: paragraphStyle.weight,
    letterSpacing: paragraphStyle.ls,
    width: "100%",
    boxSizing: "border-box",
    appearance: "none",
  };

  return (
    <div style={containerStyle}>
      <label style={labelTextStyle}>Country</label>
      <select
        style={selectStyle}
        value={selectedCode ?? ""}
        onChange={(e) => onSelect?.(e.target.value)}
      >
        <option value="" disabled>
          Select a country
        </option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag ? `${c.flag} ${c.name}` : c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

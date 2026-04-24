import type { CSSProperties } from "react";
import { resolveTextStyle } from "../../tokens.js";

export interface CountryOption {
  code: string;
  name: string;
  flag?: string;
}

// All visual choices are token props. See docs/COMPONENT_AUTHORING.md.
export interface CountryPickerProps {
  countries: CountryOption[];
  selectedCode?: string | null;
  onSelect?: (code: string) => void;
  /** CSS value (post-token-resolution). */
  bg: string;
  /** CSS value (post-token-resolution). */
  fg: string;
  /** CSS value (post-token-resolution). */
  border: string;
  /** CSS value (post-token-resolution). */
  radius: string;
  /** CSS value (post-token-resolution). */
  labelColor: string;
}

export function CountryPicker({
  countries,
  selectedCode = null,
  onSelect,
  bg,
  fg,
  border,
  radius,
  labelColor,
}: CountryPickerProps) {
  const labelStyle = resolveTextStyle("label-md");
  const paragraphStyle = resolveTextStyle("paragraph-md");

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "var(--rebtel-spacing-xs)",
    width: "100%",
  };

  const labelTextStyle: CSSProperties = {
    fontFamily: labelStyle.family,
    fontSize: labelStyle.size,
    lineHeight: labelStyle.lh,
    fontWeight: labelStyle.weight,
    letterSpacing: labelStyle.ls,
    color: labelColor,
    margin: 0,
  };

  const selectStyle: CSSProperties = {
    height: "var(--rebtel-height-lg)",
    paddingLeft: "var(--rebtel-spacing-md)",
    paddingRight: "var(--rebtel-spacing-md)",
    borderRadius: radius,
    backgroundColor: bg,
    color: fg,
    borderWidth: "var(--rebtel-stroke-md)",
    borderStyle: "solid",
    borderColor: border,
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

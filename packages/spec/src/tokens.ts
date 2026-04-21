// Token types. Tokens are typed by category so CLAUDE.md's Token<'color'>,
// Token<'spacing'> etc. are load-bearing — not cosmetic.

export type TokenCategory =
  | "color"
  | "spacing"
  | "radius"
  | "type"
  | "shadow"
  | "height"
  | "icon-size"
  | "stroke"
  | "font-size";

export interface Token<C extends TokenCategory = TokenCategory> {
  category: C;
  /** Dot-path key, e.g. "color.brand-red". Indexes into TOKEN_MAP. */
  token: string;
}

/** Minimal shape carried on ComponentSpec props that reference tokens. */
export type TokenRef = { token: string };

export function isTokenRef(v: unknown): v is TokenRef {
  return (
    typeof v === "object" &&
    v !== null &&
    "token" in v &&
    typeof (v as { token: unknown }).token === "string"
  );
}

export type TextStyleToken =
  | "display-lg"
  | "display-md"
  | "display-sm"
  | "display-xs"
  | "headline-lg"
  | "headline-md"
  | "headline-sm"
  | "headline-xs"
  | "paragraph-xl"
  | "paragraph-lg"
  | "paragraph-md"
  | "paragraph-sm"
  | "paragraph-xs"
  | "label-xl"
  | "label-lg"
  | "label-md"
  | "label-sm"
  | "label-xs";

// Shared axis-selection slug serializer + parser. The PR generator and
// the Dev Mode JSX snippet both go through this module — the two forms
// (pretty / branch) are different surfaces of the same data, so a
// single source of truth here prevents them drifting.
//
// 3.5b uses both forms:
//   - Pretty: `style=primary+size=md` — for commit subjects / PR titles
//     (readable to humans, GitHub renders fine).
//   - Branch: `style-primary_size-md` — git refs accept `=` and `+` per
//     check-ref-format, but GitHub URLs encode them. Underscore stays
//     un-encoded and keeps shared links readable.
//
// Both forms must round-trip to the same axisSelection record. Tests
// cover that explicitly.

export type SlugForm = "pretty" | "branch";

const PRETTY_AXIS_SEP = "+";
const PRETTY_KV_SEP = "=";

const BRANCH_AXIS_SEP = "_";
const BRANCH_KV_SEP = "-";

/**
 * Serialize an axis selection to its slug form. Empty selection → empty
 * string; the caller decides whether to omit the slug entirely.
 *
 * Order: keys serialize in insertion order. Callers that need a stable
 * canonical form (e.g. branch names that should match across runs)
 * should sort the input record themselves.
 */
export function serializeAxisSelection(
  selection: Record<string, string>,
  form: SlugForm,
): string {
  const entries = Object.entries(selection);
  if (entries.length === 0) return "";
  const [axisSep, kvSep] = form === "pretty" ? [PRETTY_AXIS_SEP, PRETTY_KV_SEP] : [BRANCH_AXIS_SEP, BRANCH_KV_SEP];
  return entries.map(([k, v]) => `${k}${kvSep}${v}`).join(axisSep);
}

/**
 * Parse a slug back into an axis-selection record. Empty string → {}.
 * Throws on malformed input rather than guessing.
 */
export function parseAxisSelection(
  slug: string,
  form: SlugForm,
): Record<string, string> {
  if (slug === "") return {};
  const [axisSep, kvSep] = form === "pretty" ? [PRETTY_AXIS_SEP, PRETTY_KV_SEP] : [BRANCH_AXIS_SEP, BRANCH_KV_SEP];
  const out: Record<string, string> = {};
  for (const piece of slug.split(axisSep)) {
    const idx = piece.indexOf(kvSep);
    if (idx <= 0 || idx === piece.length - 1) {
      throw new Error(
        `[axisSlug] Cannot parse "${piece}" as ${form}-form axis entry — expected key${kvSep}value`,
      );
    }
    const key = piece.slice(0, idx);
    const value = piece.slice(idx + 1);
    if (out[key] !== undefined) {
      throw new Error(
        `[axisSlug] Duplicate axis "${key}" in slug "${slug}"`,
      );
    }
    out[key] = value;
  }
  return out;
}

/**
 * Convenience: round-trip an axis selection through one form and back.
 * Tests use this to assert the serialize-then-parse identity.
 */
export function roundTrip(
  selection: Record<string, string>,
  form: SlugForm,
): Record<string, string> {
  return parseAxisSelection(serializeAxisSelection(selection, form), form);
}

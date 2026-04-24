import type {
  AxisOverride,
  Component,
  ComponentOverrideSnapshot,
  PropValue,
  StateName,
  StateOverride,
} from "./types.js";

export type DraftScope = "component" | "base" | null;

export interface ResolveOptions {
  /**
   * When set, layers an additional draft overlay for the active editor.
   *   - "component" merges `component.draft` (axis + state overrides) on
   *     top of `component.published`.
   *   - "base" merges `component.baseDraft` on top of `component.baseSpec.props`.
   * Callers pass this only for the instance being edited — other instances
   * must resolve against published state (CLAUDE.md invariant #5).
   */
  draftScope?: DraftScope;
  /**
   * When set, the resolver reads the component snapshot from
   * `component.publishedHistory[variantVersion]` (if available) instead
   * of the latest `component.published`. This is how shipped canvases
   * keep their instances pinned to the pre-publish version.
   */
  variantVersion?: number;
  /**
   * Current interaction state. Defaults to "default". Used to pick
   * matching state overrides. The renderer drives this from interaction
   * (hover, focus, etc.) once state UI lands; for now only `default`
   * and `disabled` are meaningfully consumed.
   */
  state?: StateName;
}

/**
 * Pick the snapshot to read from. Falls back to the latest `published`
 * when no specific version is requested or the requested version isn't
 * in history.
 */
export function publishedSnapshotAtVersion(
  component: Component,
  version?: number,
): ComponentOverrideSnapshot {
  if (version === undefined) return component.published;
  const snap = component.publishedHistory?.[version];
  return snap ?? component.published;
}

/**
 * `axisSelection` matches when every key in the override's selection
 * appears in the instance's selection with the same value. Partial
 * overrides act as wildcards across unspecified axes.
 *
 * The empty selection `{}` always matches — this is how a single-axis
 * component can declare a "covers everything" baseline override
 * without naming the axis explicitly. Sub-keyed selections are then
 * stacked on top in declaration order, so a more-specific override
 * wins over a less-specific one.
 */
function axisSelectionMatches(
  override: Record<string, string>,
  instance: Record<string, string>,
): boolean {
  for (const [k, v] of Object.entries(override)) {
    if (instance[k] !== v) return false;
  }
  return true;
}

function matchedAxisOverrides(
  overrides: AxisOverride[],
  axisSelection: Record<string, string>,
): AxisOverride[] {
  const out: AxisOverride[] = [];
  for (const o of overrides) {
    if (axisSelectionMatches(o.axisSelection, axisSelection)) out.push(o);
  }
  // More-specific overrides (more keys in the selection) win, so sort
  // ascending by key count: less-specific gets layered first, more-
  // specific layered on top.
  out.sort(
    (a, b) => Object.keys(a.axisSelection).length - Object.keys(b.axisSelection).length,
  );
  return out;
}

function matchedStateOverrides(
  overrides: StateOverride[],
  state: StateName,
): StateOverride[] {
  const out: StateOverride[] = [];
  for (const o of overrides) {
    if (o.state === state) out.push(o);
  }
  return out;
}

/**
 * Four-layer prop resolution.
 *
 *   base.props
 *     ← matched axis overrides (less-specific → more-specific)
 *     ← matched state overrides (in declaration order)
 *     ← instance.propOverrides
 *
 * Draft / published is orthogonal: when `draftScope === "component"`,
 * the draft snapshot's overrides layer on top of the published
 * snapshot's overrides at the axis and state layers. When
 * `draftScope === "base"`, `component.baseDraft` layers on top of
 * `baseSpec.props` at the base layer.
 *
 * `variantVersion` pins to a historical published snapshot at the
 * axis/state layers; the base layer always uses the live `baseSpec`
 * (base versioning isn't a thing yet — base edits cascade immediately).
 */
export function resolveProps(
  component: Component,
  axisSelection: Record<string, string>,
  instanceOverrides?: Record<string, PropValue>,
  options: ResolveOptions = {},
): Record<string, PropValue> {
  const { draftScope = null, variantVersion, state = "default" } = options;

  const base = component.baseSpec.props;
  const baseDraft =
    draftScope === "base" && component.baseDraft ? component.baseDraft : null;

  const publishedSnap = publishedSnapshotAtVersion(component, variantVersion);
  const draftSnap = draftScope === "component" ? component.draft : null;

  // Effective axisSelection includes axis defaults for any unspecified axes,
  // so an override declared as `{ style: 'primary' }` still matches when the
  // instance only stored a partial selection at drop time.
  const effectiveAxisSelection: Record<string, string> = {};
  for (const axis of component.axes) {
    effectiveAxisSelection[axis.name] = axisSelection[axis.name] ?? axis.default;
  }
  // Also carry through any keys the instance set that aren't in the axes
  // declaration (defensive — shouldn't happen for valid data, but the
  // resolver shouldn't drop them silently).
  for (const [k, v] of Object.entries(axisSelection)) {
    if (!(k in effectiveAxisSelection)) effectiveAxisSelection[k] = v;
  }

  const publishedAxisLayers = matchedAxisOverrides(
    publishedSnap.axisOverrides,
    effectiveAxisSelection,
  );
  const draftAxisLayers = draftSnap
    ? matchedAxisOverrides(draftSnap.axisOverrides, effectiveAxisSelection)
    : [];

  const publishedStateLayers = matchedStateOverrides(publishedSnap.stateOverrides, state);
  const draftStateLayers = draftSnap
    ? matchedStateOverrides(draftSnap.stateOverrides, state)
    : [];

  // Layer order: base, baseDraft (if any), then every published axis layer
  // (less-specific → more-specific), then every draft axis layer the same
  // way, then published state layers, then draft state layers, then
  // instance overrides on top.
  let resolved: Record<string, PropValue> = { ...base };
  if (baseDraft) resolved = { ...resolved, ...baseDraft };
  for (const layer of publishedAxisLayers) resolved = { ...resolved, ...layer.props };
  for (const layer of draftAxisLayers) resolved = { ...resolved, ...layer.props };
  for (const layer of publishedStateLayers) resolved = { ...resolved, ...layer.props };
  for (const layer of draftStateLayers) resolved = { ...resolved, ...layer.props };
  if (instanceOverrides) resolved = { ...resolved, ...instanceOverrides };
  return resolved;
}

/** Compute the default axisSelection for a component (every axis at its declared default). */
export function defaultAxisSelectionFor(component: Component): Record<string, string> {
  const out: Record<string, string> = {};
  for (const axis of component.axes) out[axis.name] = axis.default;
  return out;
}

# Session 3.5 — compositional refactor: axes, states, and component references

Read `CLAUDE.md` and `docs/ATELIER.md` before starting. Invariants and the deferred list both apply. Session 3 is complete and verified — Dev Mode, PR publishing, impact preview all working. An engineer has confirmed a real PR from Atelier merged successfully.

## Goal

This is an infrastructure session. No new user-facing feature. By end of session, the component model under the hood is:

1. **Variants are matrices of axes, not flat strings.** A Button isn't `primary-large-disabled` (one variant out of 45). It's `{ style: 'primary', size: 'lg' }` with a `disabled` state applied. Axis values compose.
2. **States are orthogonal to variants.** Every interactive component declares which states it supports (default, hover, pressed, disabled, loading, error) and what prop overrides apply in each.
3. **Components can reference other registered components in their spec tree.** A ProductCard spec's children can include a Label reference, a Button reference, etc. — not just primitive tags.
4. **The palette is organized by `paletteGroup`** (invariant #6 from session 3 preflight). The library view groups by function: Inputs & Controls, Content, Containers, Data Display, Navigation, Product-Specific.

That's the acceptance criterion. The user-visible changes are small — the family view now shows axis selectors instead of a flat variant strip, and the library palette is grouped — but the model underneath is substantially cleaner.

## Why this matters

Without this refactor:
- Sessions 4 (multiplayer) and 5 (AI) compound flat-variant sprawl. Every new combination becomes a named string. AI generation produces variants like `primary-large-disabled-with-icon-2` because it has no structural grammar.
- Component composition (ProductCard containing a Label + Button + Text) can't be expressed cleanly. Composed components reimplement their parts inline, breaking coherence.
- The DS can't enforce consistency because nothing at the type level says "a Button has a style axis, a size axis, and supports these states."

With it:
- Adding a new style or size to Button is changing one axis option, not duplicating all the state combinations.
- Composed components reference their parts, so a button change propagates through every ProductCard, RateCard, CountryPicker that uses one.
- AI in session 5 generates within a constrained grammar (pick axis values, reference registered components, use tokens) and its output feels native.

This is the session that makes the rest of the architecture honest.

## Scope

### Type model — the core change

Extend `packages/spec`:

```ts
// An axis is a named dimension of variation on a component.
// Axes compose: picking a value on each axis defines a variant.
interface Axis {
  name: string;              // 'style' | 'size' | 'tone' | etc.
  options: string[];          // ['primary', 'secondary', 'ghost']
  default: string;            // which option applies if not specified
}

// A state is an orthogonal interaction/context mode.
// Components declare which states they support.
type StateName =
  | 'default'
  | 'hover'
  | 'pressed'
  | 'disabled'
  | 'loading'
  | 'error'
  | 'focus'
  | 'selected';

interface Component {
  id: string;
  name: string;
  paletteGroup: PaletteGroup;
  axes: Axis[];                // empty array if component has no variants
  supportedStates: StateName[]; // which states this component can be in
  baseSpec: ComponentSpec;     // the "bones" — layout, children, etc.
  axisOverrides: AxisOverride[];   // partial prop overrides per axis combination
  stateOverrides: StateOverride[]; // partial prop overrides per state
  version: number;
  // draft/published (from session 2) still apply, now carrying axisOverrides/stateOverrides
  draft: { axisOverrides: AxisOverride[]; stateOverrides: StateOverride[] };
  published: { axisOverrides: AxisOverride[]; stateOverrides: StateOverride[] };
  publishedVersion: number;
}

interface AxisOverride {
  axisSelection: Record<string, string>;  // { style: 'primary', size: 'lg' }
  props: Partial<ComponentProps>;         // what to override for this combination
}

interface StateOverride {
  state: StateName;
  props: Partial<ComponentProps>;
}

// An instance picks axis values and can override props further.
interface Instance {
  id: string;
  componentId: string;
  axisSelection: Record<string, string>;   // the current variant, as axis choices
  variantVersion: number;                   // pinned
  propOverrides: Partial<ComponentProps>;   // instance-local
  position: { x: number; y: number };
}
```

### Four-layer prop resolution

Invariant #4 (three-layer resolution) extends to four:

```
base.props
  ← axisOverride.props (matched by axisSelection)
  ← stateOverride.props (matched by current state)
  ← instance.propOverrides
```

Order matters. Axes are structural ("what kind of button"), state is transient ("currently hovered"), instance is contextual ("this one has custom text"). State sits between axes and instances so per-state overrides apply regardless of variant but are themselves overrideable by the specific instance.

Update `packages/spec`'s resolver to walk all four layers. The draft vs published boundary (invariant #5) still applies — editing user sees `draft.axisOverrides` and `draft.stateOverrides`, others see `published`.

### Component references in specs

Before this session, `ComponentSpec.children` was a tree of primitive nodes (tags like `div`, `button`, `text`). Extend it to support component references:

```ts
type ComponentSpec =
  | PrimitiveSpec     // renders as HTML/JSX directly
  | ComponentRef;     // renders another registered component

interface PrimitiveSpec {
  kind: 'primitive';
  tag: 'div' | 'span' | 'button' | ...;
  layout: LayoutSpec;
  style: StyleSpec;
  text?: TextSpec;
  children?: ComponentSpec[];
  // ... existing primitive fields
}

interface ComponentRef {
  kind: 'component';
  componentId: string;                    // id of a registered component
  axisSelection?: Record<string, string>; // defaults to component's axis defaults
  propOverrides?: Partial<ComponentProps>;
  key: string;                             // stable key within the parent's tree
}
```

A ProductCard's `baseSpec` now looks something like:

```ts
{
  kind: 'primitive',
  tag: 'div',
  layout: { /* ... */ },
  style: { /* ... */ },
  children: [
    { kind: 'component', componentId: 'Label', axisSelection: { tone: 'neutral' }, key: 'bundle-label' },
    { kind: 'primitive', tag: 'text', text: { /* ... */ }, key: 'duration' },
    { kind: 'component', componentId: 'Button', axisSelection: { style: 'primary', size: 'md' }, key: 'cta' },
  ]
}
```

The renderer detects `kind: 'component'` and recursively renders the referenced component (through its own axis/state resolution) inside the parent.

### Migration of existing variants

Sessions 1–3 created flat-string variants. Migrate them to the axis model:

- **Button**: existing variants `primary`, `secondary`, `ghost` become a single `style` axis with those three options. Existing sizes (if any) become a `size` axis.
- **ProductCard**: existing `mtu-bundle` and `mtu-bundle-highlighted` become a single axis (could be called `state` but that overloads the word — use `emphasis` with options `default`, `highlighted`).
- **CountryPicker**: existing `default` single variant stays, but represented as "no axes, one implicit variant."

Write a migration script in `packages/spec/migrations/` that converts the old variant structure in Supabase into the new axis/state model. Run it as part of session 3.5's deploy. Store the migration output as a new `version: 4` schema; old `version: 3` data stays readable for rollback.

Instance data also migrates: `instance.variantId = 'mtu-bundle-highlighted'` becomes `instance.axisSelection = { emphasis: 'highlighted' }`.

### Family view, updated

The family view from session 2b currently shows a flat strip of variant thumbnails. Update it to show axes:

- If component has 1 axis: the strip looks the same, showing options for that axis (e.g. Button's style options).
- If component has 2+ axes: the strip is organized by axis. A small header for each axis ("Style," "Size") with its options below. User can pick an option per axis to compose the variant.
- State is not shown in the family view; states are applied transiently based on interaction, not selected explicitly. (A future session might add state preview for review purposes — out of scope now.)
- `+ new variant` from 2b becomes `+ new axis option` or `+ new axis` depending on context. If the user wants a new style for Button, they add an option to the `style` axis. If they want to introduce a new dimension entirely (e.g. a `tone` axis), they add an axis.

The hover-preview behavior is unchanged — hover an axis option, the instance previews as that combination.

### Library palette, organized

The left-rail component list in the canvas currently shows all components flat. Update it to group by `paletteGroup`:

```
INPUTS & CONTROLS
  Button
  Input
  Toggle

CONTENT
  Text
  Image
  Icon

CONTAINERS
  Card
  Sheet
  Panel

DATA DISPLAY
  Label
  Badge

NAVIGATION
  AppBar

PRODUCT
  ProductCard
  CountryPicker
```

Groups collapsible with remembered state (Zustand UI state). Empty groups hidden.

Each component entry still shows usage count and a small preview thumbnail of its default axis combination.

### Dev Mode panel, updated

The JSX snippet from session 3 used a single `variant` prop. Update it to reflect axes:

Before:
```jsx
<ProductCard variant="mtu-bundle-highlighted" ... />
```

After:
```jsx
<ProductCard emphasis="highlighted" ... />
```

Each axis becomes its own prop. State is not serialized in the snippet — React components handle state via their own lifecycle (hover, focus, disabled prop). The snippet represents the static configuration an engineer would hand-write.

If a component has no axes (e.g. CountryPicker with its single implicit variant), no variant-related props appear — just the instance's prop overrides.

The resolved tokens section still applies. The repo link still applies. The file link now points at the component directory, not a specific variant file (variants no longer live in their own file — they live as axis overrides in the component's main spec file).

### File format change

Before session 3.5, each component had three files: `.tsx`, `.spec.ts`, `.variants.ts`. After 3.5, the variant file is absorbed into the spec file because variants are now axis overrides rather than separate exports:

```
packages/rebtel-ds/src/ProductCard/
  ProductCard.tsx           — React component (consumes resolved props)
  ProductCard.spec.ts       — ComponentSpec + axes + states + axisOverrides + stateOverrides
```

The `.variants.ts` file format is deprecated. Migration: consolidate existing `.variants.ts` contents into the matching `.spec.ts`, delete the old variants files.

Update the three-files-per-component rule in CLAUDE.md to two-files-per-component (the React component and the spec).

The PR generation logic from session 3 also updates — the generated file is now `ProductCard.spec.ts` containing axes and overrides, not `ProductCard.variants.ts`. Update the commit message and PR body templates accordingly.

## Out of scope (deferred — do not reach)

- State preview in the family view (out of scope for 3.5, maybe later)
- Context tokens / parent-aware rendering (different problem, still deferred)
- Component-swap view (stretch from 2b, still deferred)
- AI generation working with the new model (session 5)
- Real-time sync of axis changes (session 4)
- UI for introducing a brand-new axis to a component that doesn't have one (stretch — if scope allows, add a "+ new axis" button in the family view; otherwise, axes are added via the spec file by hand)
- Automatic migration of instance-level overrides that conflict with the new axis model (rare in practice; flag conflicts, don't auto-resolve)

If I ask for anything on this list, push back.

## Verification checklist at the end

1. Every component in `packages/rebtel-ds` has been migrated to the axis/state model. Old `variantId` strings are gone from spec files.
2. `packages/rebtel-ds` directory structure reflects the two-files-per-component rule. No `.variants.ts` files remain.
3. The Supabase migration ran cleanly. No old-schema data is readable by the new app code (it all points at the migrated schema).
4. Old instances in old canvases still render correctly — they've been migrated to the new `axisSelection` field.
5. Select an instance. Family view shows axis options, not a flat variant list. If the component has one axis, the UI looks mostly unchanged (single row of options). If it has two axes, both are shown with separators.
6. Click an axis option. The instance updates. If it was a new axis combination, the override cascade resolves correctly through all four layers.
7. Hover an axis option. Instance previews, revert on mouseleave.
8. `+ new axis option` in the family view enters variant-edit mode (from session 2) pre-loaded with the current combination.
9. Library palette groups components by `paletteGroup`. Groups collapse and remember state. Empty groups hidden.
10. Dev Mode JSX snippet uses axis props, not a single `variant` string.
11. A ProductCard with a Button reference in its spec renders correctly — the Button appears inside the card, styled per its own axis selections and tokens.
12. Edit the referenced Button's variant (via session 2's flow). After publish, every ProductCard using that Button reflects the change. Coherence test passes.
13. Publish a ProductCard variant change. PR opens with `.spec.ts` updated (not `.variants.ts`), commit message and PR body reflect the new file format.
14. An engineer reviews the updated PR. The diff is still clean and readable. If not, fix before declaring done.
15. Run through the full flow from sessions 1–3: drag component, click to select, edit prop, scope-escalate to variant, push, engineer reviews PR. Everything still works end-to-end.

When all pass, session 3.5 is done and the model is ready for sessions 4 and 5.

## Inputs I'll provide at kickoff

Nothing new. Migration script can be written against the existing Supabase schema; I'll confirm the schema if you need verification before running migrations.

## Note on effort

This is a Large session by the roadmap's sizing, possibly larger. It touches:
- Type definitions (many files)
- Resolver logic in `packages/spec`
- Renderer in `packages/renderer`
- DS components in `packages/rebtel-ds`
- Supabase schema + migration
- Family view UI
- Library palette UI
- Dev Mode UI
- PR generation logic

Plan for it to run long. If 60% through you're still in migration plumbing, stop and ship a partial session (3.5a = types + resolver + migration; 3.5b = UI updates + file format change). Partial shipping is better than forcing a complete pass when context is full.

## The north star for this session

After 3.5, a designer can click an instance, see its family view with axis options, pick "primary size=md," and the Button on the canvas updates immediately. An engineer reviewing a PR sees clean diffs with axis overrides expressed as data, not as proliferated variant names. An AI agent in session 5, asked to create a new Button variant, picks an axis value or adds an option — it doesn't invent a new string.

If the model feels like it's fighting you after this session, something is wrong. Flag it; don't ship anyway.

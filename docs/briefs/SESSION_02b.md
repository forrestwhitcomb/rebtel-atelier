# Session 2b — family view + component swap

Read `CLAUDE.md` and `docs/ATELIER.md` before starting. Invariants and the deferred list both apply. Session 2 is complete and verified — variant editing, edit module, draft/published, push flow all working.

## Goal

The family view is the interaction that makes variant discovery a canvas gesture instead of a menu trip. By end of session:

- I click any instance. A family strip appears adjacent to it, showing all variants of that component.
- I hover a thumbnail. The selected instance on the canvas previews as that variant (dashed outline to indicate preview-not-commit).
- I click a thumbnail. The instance swaps to that variant — as an instance override. No mode change, no module.
- A `+ new variant` tile at the end of the strip takes me into session 2's variant-edit mode, pre-loaded with the current variant's state as a starting point.
- A `Swap to different component →` link at the bottom opens a component-swap view (related components, can replace this instance entirely).

That's the acceptance criterion. The component-swap view is the stretch — ship the family view properly first, then do swap if time allows. If time is tight, a stub link that logs "component swap view coming soon" is acceptable for this session.

## Why this matters

Family view is the gesture that converts Atelier from "a tool where you prototype" into "a tool where you try things on." Without it, users have to navigate to the library, find the variant, and reapply — friction that pushes them back toward Figma habits. With it, exploring alternatives happens inline with the work.

Architecturally, this session is relatively small because session 2 did the load-bearing work. The variant system, the three-scope model, the render resolver — all of that exists. This session is mostly UI on top of existing state.

## Scope

### The family strip component

Position: anchored to the currently selected instance, appearing to the right of or below it depending on canvas space. A small arrow/tail pointing at the instance so the spatial relationship is unambiguous.

Contents:
- Header row: component name (e.g. "ProductCard"), variant count ("5 variants"), right-side hint text ("Hover to preview · click to swap")
- Strip of variant thumbnails, scrollable horizontally if more than fit
- Each thumbnail: rendered preview of the variant at small scale (use the renderer — these are real components, not icons), variant name below, usage count ("used 14×")
- The currently-used variant is marked with an indicator (a dot next to its name, or a subtle accent border)
- `+ new variant` tile at the end of the strip — dashed border, plus icon, labeled "New variant"
- Footer link: "Swap to different component →"

### Hover preview (the core gesture)

Hovering a variant thumbnail previews the change on the canvas itself, not in the thumbnail. The selected instance — on the actual canvas — re-renders as the hovered variant with a dashed outline (amber color, to distinguish from the purple selection outline).

Move off the thumbnail → instance reverts to its committed variant.

Implementation notes:
- This is a transient render state, not a mutation. Do NOT update the store on hover. Render-only override.
- The state lives in a local `hoveredVariantId` somewhere in UI state (Zustand is fine — this is view state, not document state).
- The renderer takes an optional `previewVariantId` prop that overrides the instance's actual `variantId` for display purposes.
- Revert is instant on mouseleave. No animation, no debounce.

### Click to swap (committed instance override)

Clicking a variant thumbnail commits the swap:
- `instance.variantId` updates to the clicked variant
- This is an **instance override**, not a variant edit. No edit module appears.
- Brief toast confirmation: "Swapped to [variantName] · instance override"
- The thumbnail in the strip updates to show the new "currently used" indicator

If the user clicks the variant that's already applied, no-op.

### `+ new variant` entry point

Clicking this tile:
1. Creates a new variant in the DS with an auto-generated name (e.g. `productcard-variant-6` — user can rename from the edit module)
2. Its props start as a copy of the current instance's variant's `published` values + any instance overrides
3. Enters session 2's variant-edit mode on this new variant
4. The edit module from session 2 appears with the new variant name

This is how new variants are born through direct manipulation. Users see a variant they like *almost*, click +, tweak it, ship it.

### Family view visibility rules

- Appears when an instance is selected AND the instance's component has more than one variant. Single-variant components don't get a family strip.
- Closes when selection is cleared.
- Closes when the user enters variant-edit mode (the module takes over; family view would be noise).
- Does NOT appear for `__root` or `__row` or any structural components (flag these as `hideFamilyView: true` in their component spec).

### Component swap view (stretch — ship if scope allows)

The `Swap to different component →` link opens a full-width popover or modal showing related components — things that could reasonably occupy this slot.

For v1, "related" is defined by two simple heuristics, computed at render time:
1. **Shape similarity** — components with overlapping prop signatures. A Label and a Badge both take `text`, both render inline; they're swap candidates.
2. **Historical co-occurrence** — components that have appeared in the same parent type elsewhere in existing canvases. If ProductCards frequently contain either Label or Badge, those are ranked higher when a Label is selected inside a ProductCard.

Output: a grid of component thumbnails, clicking one swaps the instance's `componentId` (not just `variantId`). Props carry over where compatible; lost props are flagged in a small warning chip.

**For session 2b specifically**: implement the link as a stub that logs "component swap view coming soon" with the computed relevance scores to the console. Full UI is a later session if usage warrants.

If session 2b has room at the end, build a minimal version — a popover listing related component names with click-to-swap, no fancy thumbnails. Prove the data pipeline even if the UI is basic.

## Out of scope (deferred — do not reach)

- Real-time sync of the family view across editors (session 4)
- Showing which *other* canvases use each variant in the family view (session 3, part of impact preview)
- Usage count live-updating as instances are added/removed elsewhere (session 4 once multiplayer is real — for now, compute it server-side on load and cache)
- Drag-reorder of variants in the strip (not needed)
- AI-suggested new variants in the family view (session 5)
- Component-swap view with full rendered thumbnails and prop migration UI (defer past session 2b)

If I ask for anything on this list, push back.

## Verification checklist at the end

1. Click a ProductCard instance. Family strip appears next to it showing both variants (assuming session 1's two variants) plus `+ new variant`.
2. Hover the other variant's thumbnail → canvas instance previews as that variant with dashed amber outline. Move off → reverts.
3. Click the other variant. Canvas instance commits as that variant. Toast appears. Strip's "currently used" indicator moves. No edit module.
4. Confirm this was an instance override: check the instance's `variantId` changed but the variant's `published` state is unchanged.
5. Click `+ new variant`. Edit module from session 2 appears. New variant exists in the DS with a generated name, props initialized from the previous variant.
6. Clear selection. Family strip disappears.
7. Select a Button instance. Family strip shows Button's 3 variants. Works independently of ProductCard's state.
8. Click `Swap to different component →`. Console logs the candidate list with relevance scores. (Or, if stretch was shipped: popover appears with alternatives.)
9. `grep` the codebase for any state mutation in hover handlers — there should be none. Hover preview is pure render-time override.

When all pass, session 2b is done. Report in chat with what works and anything unexpected.

## Inputs I'll provide at kickoff

Nothing new. If you need a design decision I haven't documented, ask rather than guess.

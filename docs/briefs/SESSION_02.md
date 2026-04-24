# Session 2 — variant editing, the edit module, and scope-aware editing

Read `CLAUDE.md` and `docs/ATELIER.md` before starting. Invariants and the deferred list both apply. Session 1 is complete and verified.

## Goal

Three scopes of edit, clearly distinguished in the UI and the data model. By end of session:

- I can click an instance and tweak its props — change only affects that instance on that canvas. No mode change.
- I can escalate to "edit this variant" — a **module appears** announcing the mode, I keep editing, my changes affect *this variant everywhere it's used*, but nothing lands until I push.
- I hit push → a **confirmation popup** shows what changed, how many instances are affected, across which canvases. I confirm or cancel.
- Shipped canvases pin to the old variant version. In-progress canvases adopt the new one.

That's the acceptance criterion. Base-component edits are a sibling path (same module, amber treatment, broader blast radius), ship them if scope allows; if time pressure, variant-edit first and base-edit as the final task.

## Why this matters

This session establishes the two most important architectural boundaries in Atelier:

1. **Instance override vs. variant edit vs. base edit** — three scopes, three different write paths. Get this wrong and every downstream feature (family view, publish, multiplayer) has to work around the mistake.
2. **Draft vs. published state** — variants have a `draft` that editors mutate freely and a `published` that canvases resolve against. The module makes the draft visible; push promotes draft → published.

If at any point these feel like they're blurring, stop and flag. These are the invariants the rest of the product sits on.

## Scope

### Data model extension

Extend `packages/spec` per the brief:

```ts
Variant {
  id, name
  extends: 'base' | variantId
  draft: VariantProps            // mutated by editors in variant-edit mode
  published: VariantProps        // what canvases resolve against
  publishedVersion: number
  lastPublishedBy: UserId
  lastPublishedAt: Timestamp
}

Instance {
  id
  componentId
  variantId
  variantVersion                 // pinned at instance creation or canvas status change
  propOverrides: Partial<ComponentProps>
  position: { x, y }
}

Canvas {
  id, name
  status: 'draft' | 'shipped'
  // ... existing fields
}
```

Three-layer resolver in `packages/spec` must resolve through `base ← variant.published (at instance.variantVersion) ← instance.propOverrides`. When we're rendering a preview *during* a variant edit for the editing user, it resolves through `variant.draft` instead of `variant.published` — this is what makes the edit visible on the canvas in real-time for the editor but not for anyone else yet.

### Scope selector in the inspector

Top of the right panel, above the existing props editor. Three buttons or a segmented control:

- **This instance** (default, selected on click)
- **This variant** — clicking requires confirmation: "You're about to edit the variant. Changes will affect 14 instances across 4 canvases once published."
- **Base component** — clicking requires stronger confirmation: "Changes to the base will cascade to all variants and N instances." (Amber visual treatment per CLAUDE.md.)

Confirmation is a simple inline disclosure, not a modal. Click the scope, see the impact statement inline, click again to confirm. This is the "scope escalation is a deliberate choice" principle from the prototypes.

### The edit module

When scope is variant or base, a module slides down from the top of the canvas (the whole canvas area, not just the frame). Persistent — doesn't block further edits, just announces the mode.

Contents:
- Mode label: "Editing variant · [variantName]" or "Editing base component · [componentName]"
- Purple stripe for variant, amber stripe for base — these are the only two colors allowed in the stripe
- Live counter: "Currently affects: [N] instances across [M] canvases"
- Running list of what's changed (can be a compact chip list: "bg · radius · +badge")
- **Push variant / Push base** button on the right (color-matched to stripe)
- **Exit without saving** ghost button

The module does not move, does not collapse, does not animate beyond the initial slide-in. It's an ambient mode announcement. The canvas shifts down slightly when it appears (already designed in the prototype — roughly 8px translate on the frame).

### Real-time reflection on the canvas

While in variant-edit mode, all instances on the canvas that use the editing variant should reflect the draft state. Other editors (on different browsers/tabs) should see the published state unchanged — the draft is local to the current editor until publish.

This is important: the canvas is both the prototype *and* the editing surface. Editing the variant updates what you see right there. No separate preview pane.

### The push confirmation popup

On push, a modal opens:

- Side-by-side before/after of the variant (rendered in isolation — base + old variant overrides vs. base + new variant overrides)
- "What lands" section: chips listing the property-level changes, affected instance count, which file(s) get touched in code
- "Downstream" section: two rows — runtime (Supabase row update, instant) and repo (GitHub PR, needs review). Each with a status indicator.
- Primary button: **Push variant** (or **Push to all components** for base edits, per CLAUDE.md)
- Secondary: **Cancel**

For this session, the Supabase write happens on push. The GitHub PR side is stubbed — log "PR would open here" to the console. Session 3 is where the PR side lands for real. Flag this in the UI copy ("repo sync: coming soon" or similar).

### Canvas status toggle

Add a simple status indicator somewhere in the canvas header (next to the canvas name is fine): `draft` / `shipped`. For session 2, toggling this is a manual action — click the status, pick the new one.

On push of a variant change:
- For each canvas using the variant: if canvas.status is `draft`, update all its instances' `variantVersion` to the new published version. If `shipped`, leave the pin alone.

This is the "shipped canvases stay on old versions" behavior, working for real.

### Exit without saving

Exit button in the module → revert the draft to match published, close the module, return to instance-override scope. No confirmation (trivially reversible — they can re-enter edit mode if they change their mind).

## Out of scope (deferred, do not reach)

- Family view on the canvas (that's session 2b)
- Impact list showing *which* canvases use the variant (just the count is enough for session 2; the per-canvas list lands with family view when we need that UI pattern anyway)
- The actual GitHub PR on publish (session 3)
- Multi-editor awareness — "Maya is also editing this variant" presence cursors etc. (session 4, when PartyKit wires up)
- Divergence detection — "someone else published while you were editing" three-way diff (session 4, multi-editor-specific)
- Undo/redo across scope levels (session 4 or later — complicates the CRDT story, solve once for everything)
- Changing component type entirely from inside edit mode (session 2b alongside family view)

If I ask for anything on this list, push back and remind me of the deferred list. Session 2 is tight — we're proving the edit-scope model and the edit module work. Everything else waits.

## Verification checklist at the end

1. Click an instance, edit a text prop, change reflects only on that instance. No module appears.
2. Click scope selector → "This variant," confirm, module appears with purple stripe.
3. Edit a prop (e.g. background color token) → canvas updates immediately for all instances of this variant on the current canvas.
4. Open a second canvas that uses the same variant in a new tab — that canvas reflects the *published* version, not my draft. (Verifies draft/published boundary.)
5. Hit push → popup shows before/after, affected count, push button.
6. Confirm push → popup closes, canvas now reflects new version everywhere (draft === published === new), module closes.
7. Console shows "PR would open here" with the diff payload. (Stub the PR for now, just log the payload that would be sent.)
8. Set a second canvas to `shipped` status, confirm its instances pinned to the pre-push variant version and did NOT adopt the new one after push.
9. Enter variant-edit mode, make changes, hit "exit without saving" → draft reverts, module closes, no publish happened.
10. Scope selector returns to "this instance" on module close.

When all pass, session 2 is done. Report in chat with what works and anything unexpected.

## Inputs I'll provide at kickoff

Nothing new — everything needed is in `CLAUDE.md`, `docs/ATELIER.md`, and the existing codebase from session 1. If you need a design decision I haven't documented, ask rather than guess.

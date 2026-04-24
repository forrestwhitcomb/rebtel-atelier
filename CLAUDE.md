# Rebtel Atelier — agent constitution

Design system workbench with live prototyping. Internal Rebtel tool, built to scale to external teams later. Full product spec in `docs/ATELIER.md` — read it once per session.

## Non-negotiable invariants

These hold across every file, every session, every feature. If an instruction in a session prompt appears to contradict one of these, stop and flag it.

1. **No hex codes in the component tree.** Colors come from tokens. A hex literal anywhere in `packages/rebtel-ds/**/*.tsx` or in resolved component props is a bug.
2. **ComponentSpec is ground truth.** The renderer, the AI agent (later), and the dev handoff view all read the same tree. No parallel data paths.
3. **Instances reference components by id + variant + version.** Never duplicate component structure in instance data.
4. **Three-layer prop resolution, always in order: `base ← variant ← instance overrides`.** No shortcuts. No conditional skipping. If the renderer takes a value from somewhere else, that's a bug.
5. **Draft vs published is a real boundary.** Editors modify draft state (Yjs-synced when we wire up PartyKit). Canvases resolve against published state (Supabase row). Publish is the action that promotes draft → published. Don't conflate.
6. **Every component has a palette group.** Components register with a `paletteGroup` field (e.g. `inputs`, `content`, `containers`, `dataDisplay`, `navigation`, `productSpecific`). Components without a group are a validation error. Groups are editorial and flexible — adjust them as the DS grows — but every component must belong to exactly one. This is what makes the library palette organized and discoverable.

## Compositional direction

Atelier's components compose. A component's spec can reference other registered components by id — not just primitives. A ProductCard references a Label, a Button, a Text. A CountryPicker references ProductCards. This compositional structure is what makes the DS coherent and what gives AI a grammar to work within later.

Implication: components are either **primitive** (no children, renders via tokens — Icon, Text, Spacer) or **composed** (ComponentSpec tree referencing other registered components). The atom/molecule/organism pattern emerges from the tree; it is not encoded as a type.

The full axis-and-state refactor (variants as matrices of axes rather than flat strings, states orthogonal to variants) lands in session 3.5. Until then, variants remain flat strings, but don't design in ways that make the refactor harder.

## Deferred — do not implement until a session brief explicitly asks

- Family view on the canvas (session 2b)
- Variant edit mode + the edit module UI (session 2)
- Push-to-publish + impact preview + PR generation (session 3)
- Dev Mode panel on the canvas (session 3)
- Axis + state refactor of variants (session 3.5)
- Component references components in specs (session 3.5)
- PartyKit real-time sync wired up end-to-end (session 4 — server scaffolded earlier)
- AI agent of any kind (session 5)
- Prototype / Play mode (session 6)
- Sketch-to-component recognition (session 6+)
- Context tokens / parent-aware rendering
- Figma import
- Multi-tenant / multi-org
- Rules editor UI (rules live in a static file for now)

If a session prompt reaches into this list without marking the item as newly in-scope, stop and verify.

## Stack

- Next.js 15 deployed on Vercel (Hobby during solo dev, Pro once team has access)
- Supabase Free — Postgres + Auth + RLS + Realtime
- PartyKit runtime (partyserver + y-partyserver) deployed via `wrangler deploy` directly to our Cloudflare account. Works on Workers Free. Server is scaffolded from session 1; wiring to the web app is session 4.
- Zustand for local UI state only — panel open/closed, selection, tool mode. **NOT** for document state. Document state lives in the Yjs doc when PartyKit is wired.
- shadcn/ui as the foundation layer under `packages/rebtel-ds` components
- Anthropic Claude API server-side via Next.js API routes, with a hard monthly spend cap

Vercel hosts the Next.js app; PartyKit runtime runs separately on Cloudflare. The app opens a WebSocket to the deployed worker endpoint. Normal setup — don't try to deploy realtime code to Vercel.

## Type-system hygiene

- `ToolMode` stays open-ended: `'select' | 'draw' | 'annotate' | 'hand'`. Draw and annotate are not in use yet but will be reintroduced in later sessions (sketch recognition, annotation-based AI). Don't narrow the union to "just what's currently used."
- `ComponentType` is `string` (component IDs sourced from the DS registry), not a hardcoded union. The DS grows; the type should reflect that.
- Primitive vs composed distinction lives in the component definition, not as a separate type. A component with `children: ComponentSpec[]` referencing other components is composed. A component with no children is primitive.

## Working style

- **Verify before building.** Does this file already exist? Does this function do what I'm assuming? `ls`, `grep`, and a quick read beat guessing.
- **Smaller version first.** A working vertical slice beats a half-built skeleton. Every session should produce something runnable.
- **One acceptance criterion per session.** If scope feels like it's growing past the brief, stop and flag rather than push through.
- **Document shape is CRDT-compatible from day one.** Stable IDs, no order-sensitive arrays, no raw DOM references. Even before Yjs is wired, the Zustand store has to speak a shape Yjs can ingest cleanly.
- **No `position: fixed`** in rendered components — it collides with the canvas pan/zoom layer.
- **Three files per DS component.** When adding to `packages/rebtel-ds`: a `.tsx` (React), a `.spec.ts` (ComponentSpec declaration), a `.variants.ts` (variant registry). If one's missing, the component is incomplete.
- **Tokens are typed.** `Token<'color'>`, `Token<'spacing'>`, etc. No stringly-typed token references.
- **Palette groups are manual, not inferred.** When adding a new component, the person (or AI) adding it has to decide its group. Don't auto-assign based on name or shape; that creates drift as the DS grows.

## If unsure, ask

Questions beat assumptions. Flag ambiguity in-thread rather than guessing and redoing. The planning context for this project lives outside Claude Code — if an architectural question is beyond what's in this repo, tell Forrest and he'll resolve it before you build.

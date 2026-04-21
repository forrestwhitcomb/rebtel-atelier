# Rebtel Atelier — agent constitution

Design system workbench with live prototyping. Internal Rebtel tool, built to scale to external teams later. Full product spec in `docs/ATELIER.md` — read it once per session.

## Non-negotiable invariants

These hold across every file, every session, every feature. If an instruction in a session prompt appears to contradict one of these, stop and flag it.

1. **No hex codes in the component tree.** Colors come from tokens. A hex literal anywhere in `packages/rebtel-ds/**/*.tsx` or in resolved component props is a bug.
2. **ComponentSpec is ground truth.** The renderer, the AI agent (later), and the dev handoff view all read the same tree. No parallel data paths.
3. **Instances reference components by id + variant + version.** Never duplicate component structure in instance data.
4. **Three-layer prop resolution, always in order: `base ← variant ← instance overrides`.** No shortcuts. No conditional skipping. If the renderer takes a value from somewhere else, that's a bug.
5. **Draft vs published is a real boundary.** Editors modify draft state (Yjs-synced when we wire up PartyKit). Canvases resolve against published state (Supabase row). Publish is the action that promotes draft → published. Don't conflate.

## Deferred — do not implement until a session brief explicitly asks

- Family view on the canvas (session 2)
- Variant edit mode + the edit module UI (session 2)
- Push-to-publish + impact preview + PR generation (session 3)
- Component library gallery view (session 3)
- PartyKit real-time sync wired up end-to-end (session 4 — server scaffolded earlier)
- AI agent of any kind (session 5)
- Prototype / Play mode (session 6)
- Figma import
- Multi-tenant / multi-org
- Sketch-to-component shape recognition
- Rules editor UI (rules live in a static file for now)

If a session prompt reaches into this list without marking the item as newly in-scope, stop and verify.

## Stack

- Next.js 15 deployed on Vercel (Hobby during solo dev, Pro once team has access)
- Supabase Free — Postgres + Auth + RLS + Realtime
- PartyKit deployed to our Cloudflare account for Yjs-backed collaboration. Server is scaffolded from session 1; wiring to the web app is session 4.
- Zustand for local UI state only — panel open/closed, selection, tool mode. **NOT** for document state. Document state lives in the Yjs doc when PartyKit is wired.
- shadcn/ui as the foundation layer under `packages/rebtel-ds` components
- Anthropic Claude API server-side via Next.js API routes, with a hard monthly spend cap

Vercel hosts the Next.js app; PartyKit runs separately on Cloudflare. The app opens a WebSocket to the PartyKit endpoint. Normal setup — don't try to deploy PartyKit to Vercel.

## Working style

- **Verify before building.** Does this file already exist? Does this function do what I'm assuming? `ls`, `grep`, and a quick read beat guessing.
- **Smaller version first.** A working vertical slice beats a half-built skeleton. Every session should produce something runnable.
- **One acceptance criterion per session.** If scope feels like it's growing past the brief, stop and flag rather than push through.
- **Document shape is CRDT-compatible from day one.** Stable IDs, no order-sensitive arrays, no raw DOM references. Even before Yjs is wired, the Zustand store has to speak a shape Yjs can ingest cleanly.
- **No `position: fixed`** in rendered components — it collides with the canvas pan/zoom layer.
- **Three files per DS component.** When adding to `packages/rebtel-ds`: a `.tsx` (React), a `.spec.ts` (ComponentSpec declaration), a `.variants.ts` (variant registry). If one's missing, the component is incomplete.
- **Tokens are typed.** `Token<'color'>`, `Token<'spacing'>`, etc. No stringly-typed token references.

## If unsure, ask

Questions beat assumptions. Flag ambiguity in-thread rather than guessing and redoing. The planning context for this project lives outside Claude Code — if an architectural question is beyond what's in this repo, tell Forrest and he'll resolve it before you build.

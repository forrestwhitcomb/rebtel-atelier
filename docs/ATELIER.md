# Rebtel Atelier — build brief

Internal design system workbench with live prototyping. Replaces Figma for Rebtel's design-to-dev workflow. Built to scale to multi-user from day one and to external teams later. Proof of concept for a broader product direction.

---

## Why this exists

The Rebtel team can't ship designs to engineering with confidence through Figma. Components are hard to read, variants are hard to discover, tokens don't map cleanly to code, and prototypes don't reflect what will actually be built. Atelier collapses that gap by making the design system the first-class citizen: every prototype composes real components with real token bindings, and every dev handoff reads structured spec rather than interpreted pixels.

Rebtel is the initial audience. The architecture supports external teams later, but do not over-engineer for that now. Build for one org, one design system, one repo — with the data model clean enough that multi-tenant becomes an additive change, not a rewrite.

---

## The four surfaces

### 1. Canvas — the default work surface
Infinite canvas with frames. Frames are viewport-sized (mobile/desktop) and double as routing endpoints in exported code. Inside a frame, you drag components from the library or sketch with rough shapes (shape-to-component recognition is v2 — sketch is not a primary path).

Primary interactions:
- Drag component from library → drops into the frame or canvas
- Click an instance → property inspector opens on the right, family view appears adjacent to the instance
- Edit properties inline — defaults to instance override scope
- Escalate scope to variant-edit or base-edit → edit module appears at top of canvas as mode announcement
- Push changes → impact preview popup → confirm

Family view behavior:
- Appears next to selected instance on click, scoped to the component of the selection
- Shows all variants as thumbnails with name and usage count
- Hover a variant → the selected instance previews as that variant on the canvas (dashed border to indicate preview state)
- Click a variant → commit swap as instance override
- `+ new variant` at end → enters variant-edit mode, pre-loaded with current variant's state
- `Swap to different component →` link at bottom opens component-swap view (related components ranked by shape similarity + historical co-occurrence; v2)

### 2. Component library — the system view
Full-screen gallery. Left: component list with usage counts. Main: selected component's variants rendered in a grid, with mode toggle (light/dark). Below each variant: the tokens it references, as chips with color swatches.

Every component page has three tabs:
- Preview — all variants rendered
- Props — the ComponentSpec rendered as a reference
- Dev — React source + generated usage snippet with token-named props + links to repo

This view is also where you browse to edit a variant without going through canvas first.

### 3. Prototype mode — experience runtime
Exits the edit UI. Frames become navigable routes in a full-screen simulator. Navigation arrows on the canvas translate to real nav between frames. No inspector, no library, no AI panel — just the app.

Shareable URL per canvas: `/play/:canvasId`. External viewers (non-editors) can view but not edit. Returns to canvas mode via escape or a small floating control.

### 4. AI agent — the assist panel
Right-side panel, toggleable. Not a single chat — three distinct surfaces with different contexts and output shapes:

- **Variations** — operates on the current canvas or selection. Returns N alternatives as previewable thumbnails. User picks one to commit.
- **Extend** — adds screens/sections to the current flow, aware of what's already there.
- **New component** — generates a new component spec from description, with preview and token bindings already assigned. Commits as a DS addition (goes through the variant-edit flow for publishing).

All AI operations produce ComponentSpec mutations as JSON patches, not freeform code. The same renderer handles AI output and manual output. Proposed edits show as a diff before commit — user accepts or rejects. Never autonomous writes to the document.

---

## Architecture

### Stack (final)
- **Next.js 15** deployed on **Vercel** — start on Hobby for solo development, upgrade to Pro ($20/month, one seat) when the team starts accessing Atelier internally
- **Supabase Free** — Postgres + Auth + RLS + Realtime. A tiny Cloudflare Worker cron pings it weekly to prevent 7-day pauses
- **PartyKit** deployed separately to our own Cloudflare account — Yjs-backed collaborative editing. The Next.js app on Vercel opens a WebSocket to the PartyKit endpoint. Pays only Cloudflare Workers + Durable Objects usage (~$5–15/month)
- **Zustand** for local UI state (panel open/closed, tool mode, selection — NOT document state; document state is Yjs via PartyKit)
- **shadcn/ui** as the foundation for rendered components
- **Anthropic Claude API** server-side via Next.js API routes, with a hard monthly spend cap

This is three services, one per responsibility: app → Vercel, realtime → PartyKit on Cloudflare, database → Supabase. Each is independently swappable.

### Repo structure (pnpm monorepo)
```
rebtel-atelier/
├── apps/
│   ├── web/              Next.js app (Vercel)
│   └── party/            PartyKit server (Cloudflare)
├── packages/
│   ├── spec/             ComponentSpec types (lifted from Aphantasia, trimmed)
│   ├── rebtel-ds/        Hardcoded Rebtel DS: components, tokens, variants
│   └── renderer/         ComponentSpec → React
```

### Data model (key types)

```ts
DesignSystem {
  tokens: Token[]       // color, spacing, type, radius, shadow
  components: Component[]
  rules: Rule[]
}

Component {
  id, name
  baseSpec: ComponentSpec
  variants: Variant[]
  version: number
}

Variant {
  id, name
  extends: 'base' | variantId
  draft: VariantProps            // what editors are currently modifying (Yjs-synced)
  published: VariantProps        // what canvases resolve against by default
  publishedVersion: number
  lastPublishedBy: UserId
  lastPublishedAt: Timestamp
}

Instance {               // lives on a canvas, references a component
  id
  componentId
  variantId
  variantVersion         // pinned — version updates are explicit
  propOverrides: Partial<ComponentProps>
  position: { x, y }
}

Canvas {
  id, name
  status: 'draft' | 'shipped'     // shipped canvases pin to old versions when DS updates
  frames: Frame[]                 // viewport-sized containers
  instances: Instance[]
  connections: Connection[]       // nav between frames
  // Yjs doc is managed by PartyKit and keyed by canvas id
}
```

Three-layer property resolution, always in this order: `base props ← variant overrides ← instance overrides`. Any renderer, any consumer, any AI operation resolves through this stack.

### Core invariants (enforce in code, not docs)

1. **No hex codes in the component tree, ever.** If a color isn't in tokens, it's a validation error at save time.
2. **ComponentSpec is the ground truth.** Renderer, AI, and dev handoff all read the same tree.
3. **Instances reference components by id + variant + version.** No duplication of structure.
4. **Variants and tokens are versioned.** Instances pin to a version. Version changes create an "update available" indicator on the canvas; users choose when to adopt.
5. **Draft vs published is a real boundary.** Editors modify the draft (Yjs). Canvases resolve against published (Supabase). Publish is the promotion action that copies draft → published.

### Multiplayer edit model
- **Instance overrides** live on the canvas's Yjs doc. Sync in real-time via PartyKit. No PR, no DS write, just canvas state.
- **Variant edits** modify the shared draft state in a Yjs doc keyed to the variant. Multiple editors can contribute to the same draft concurrently; CRDT handles merging.
- **Publish is turn-taking.** When a user clicks Push, a soft lock engages (via Yjs awareness). Others see "Forrest is publishing this variant" and cannot open their own Push popup until A commits or cancels. Soft lock releases on a timeout if the popup is abandoned.
- **Divergence detection.** If user A's draft was based on published v3, but someone else shipped v4 in the meantime, A's Push popup surfaces "Maya published changes while you were editing" and shows a three-way diff. Rare in practice but needs to exist.
- **Base vs variant concurrency.** Base edits pause when any variant of that component has a pending publish. Resolve the variant first.

### Publishing is two-headed
When the user publishes a variant/base change:
- Supabase row updates immediately (runtime truth — app sees change instantly, instances in draft canvases auto-adopt)
- GitHub PR opens against the repo (dev truth — code catches up via review)

Both must succeed. If PR open fails, the DB write rolls back. This is the boundary that keeps design and code in sync.

---

## Session 1 scope (must produce a runnable vertical slice)

Goal: by end of session 1, Forrest can open the app, see a frame on a canvas, drag a ProductCard from the library into the frame, click it, see its properties in the inspector, and edit one property with the change reflected immediately.

Concrete work:
1. Monorepo scaffolded (pnpm workspaces, `apps/web`, `apps/party`, 3 packages)
2. Supabase Free project provisioned — auth wired, empty schema for now
3. `packages/spec` — ComponentSpec types lifted from Aphantasia, trimmed (no materialization levels, no AI suggestion attachments, no origin tracking — components are always real)
4. `packages/rebtel-ds` — three components hardcoded: Button (3 variants), ProductCard (2 variants), CountryPicker (1 variant). Real React components. A `.spec.ts` declaration per component. A `.variants.ts` per component. Real tokens in `tokens.ts` (~20 to start, covering colors, spacing, radius, type).
5. `packages/renderer` — takes a ComponentSpec + resolved props, renders to React. Handles token resolution. Handles three-layer prop override resolution.
6. `apps/web` — one page: `/canvas/demo`. Shows an infinite canvas with one frame. Left rail with component list. Drag from list → drop in frame → instance created, rendered via the renderer. Click instance → right panel shows properties. Edit a text prop → inline update.
7. `apps/party` — PartyKit server scaffolded with Yjs integration via `y-partyserver`. Not wired to the web app yet, but deployable.
8. Zustand store in the web app, with document shape that will ingest cleanly into Yjs later (stable IDs, no order-sensitive arrays, no raw DOM references).

Acceptance criteria: the flow above works end-to-end. The ProductCard on the canvas is a real React component rendered from spec, not a visual approximation. The party server deploys cleanly to Cloudflare even though it's not wired up yet.

---

## Deferred for later sessions (explicit — do not reach for these in session 1)

- Family view (session 2)
- Variant edit mode + edit module (session 2)
- Push to publish + impact preview + PR generation (session 3)
- Component library gallery view (session 3)
- Real-time sync via PartyKit (session 4 — wire up the already-deployed server)
- AI agent (session 5 — after DS and collab are solid)
- Prototype/Play mode (session 6)
- Figma import (much later — Rebtel DS is hardcoded in `packages/rebtel-ds`)
- External tenants / multi-org (not in scope)
- Rules editor (not in scope yet, rules live in a static file for now)

---

## Running costs at this scope

Monthly, for an internal team of 5–10 editors:

- **Vercel: $0 during solo development on Hobby, $20/month once the team has access (Pro, one seat).** Hobby is non-commercial per Vercel's terms, so upgrade to Pro the moment other Rebtel people start using the live URL. Additional seats are $20 each, but you only need seats for people who *deploy*, not for people who use the app.
- **Supabase Free: $0.** Upgrade to Pro ($25/month) when the team uses it weekly enough that the 7-day pause becomes friction, or when you bump up against the 500MB database cap.
- **Cloudflare Workers (PartyKit server): ~$5–15/month.** Workers Paid is $5 minimum plus Durable Objects usage.
- **Claude API: $30–100/month** depending on AI usage. Set a hard cap from day one.

**All-in now (solo): ~$5–15/month.**
**All-in when the team is on (Pro seats + upgraded Supabase + AI): ~$80–160/month.**

Validate the experience on the cheap tier first, upgrade components one at a time as they become the thing slowing you down.

### Gotchas to plan around
- **Vercel Hobby is technically non-commercial.** Safe for solo dev and preview URLs shared with yourself, but flip to Pro before anyone else at Rebtel starts using it in earnest. $20/month isn't going to be the blocker.
- **Supabase Free pauses inactive projects after 7 days.** Mitigation: a tiny Cloudflare Worker cron that pings Supabase weekly. Free, takes 10 minutes to set up, prevents Monday-morning lockouts.
- **Supabase Free has a 500MB database cap.** Plenty for internal team usage but worth monitoring.
- **Claude API costs are unbounded by default.** Set a hard monthly spend cap in the Anthropic dashboard before session 5. Start at $50/month; raise it if the team hits it legitimately.

---

## Working style with Claude Code

- `CLAUDE.md` at repo root encodes: the five invariants above, the three-layer prop resolution rule, the token-first rule, and the deferred list. Every session reads this first.
- Session briefs follow the pattern: context → acceptance criteria → deferred → decisions needed. Tight scopes, verify-before-building, one working slice per session.
- When in doubt, build the smaller version. The architecture is more valuable than features right now.

---

## What to lift from Aphantasia — and what not to

**Lift (copy-and-trim, don't share a package):**
- ComponentSpec type structure
- Figma MCP extraction patterns (for much later, when external DS import becomes a thing)
- Rebtel DS extraction work done in the fork (as reference, not as code)
- Annotation-based AI editing pattern (when AI ships in session 5)
- Edit propagation logic, simplified to the three-layer stack above

**Don't lift:**
- Progressive materialization (out of scope — components are always real here)
- Design DNA generative tokens (out of scope)
- Deep Render creative toolkit (out of scope)
- Sketch-first interactions as a primary gesture (drag-from-library is primary; sketch is v2)
- Materialization levels, AI suggestion attachments, origin tracking — complicate the spec without serving this product

Copy once, own it, let it diverge. If in six months the types are still 90% aligned, promote to a shared package then.

---

## Open decisions (post-session 1, not blocking)

1. **SOC 2 compliance path.** When an external team wants in, you'll need it. That means Supabase Team ($599) and/or Liveblocks Team ($600). This is a conscious step, not a slow drift; budget for it when the first external customer is on the horizon, not before.
2. **Publish target for the two-headed write.** Supabase as runtime truth + GitHub PR for code is the plan. If the GitHub PR dependency becomes painful (e.g. engineers don't review promptly), consider making the PR optional with a "mark as needs-review-later" flag on the Supabase row.
3. **AI agent cost governance.** Per-user limits, per-session limits, or organization-level monthly cap. Decide before session 5.

---

## North star

The moment that proves this is working: a Rebtel engineer opens a canvas Forrest built, clicks a ProductCard, opens Dev Mode, reads the ComponentSpec + generated JSX, and says "yes — I can build from this directly, no Figma handoff needed." If that happens with three people in the first month, the thesis is validated and further investment is warranted.

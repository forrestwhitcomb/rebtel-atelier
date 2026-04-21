# Session 1 — monorepo scaffold and first vertical slice

Read `CLAUDE.md` and `docs/ATELIER.md` before starting. Non-negotiable invariants and the deferred list both apply.

## Goal

By end of session: I can run `pnpm dev`, open `/canvas/demo`, drag a ProductCard from the left rail onto a frame, click it, and change its price prop with the canvas updating immediately.

That's the acceptance criterion. If any task in this brief starts to grow past what this demo needs, stop and flag rather than push through.

## What I'll provide at kickoff

Ask me for these before you start building — don't guess or fabricate:

1. **The ComponentSpec type from Aphantasia** — I'll paste it. Your job is to trim per `CLAUDE.md` (remove materialization levels, AI suggestion attachments, origin tracking) and land it in `packages/spec/src/index.ts`.
2. **The Rebtel token values** — I'll paste 20ish tokens covering color, spacing, radius, and type. Land them in `packages/rebtel-ds/tokens.ts`.
3. **Supabase project credentials** — I'll create the project and give you the URL + anon key for `.env.local`.
4. **Cloudflare account details for PartyKit** — account ID and API token. PartyKit's server deploys to my account.

## Scope

### Monorepo
pnpm workspaces with this structure:

```
rebtel-atelier/
├── apps/
│   ├── web/              Next.js 15, app router, TypeScript strict
│   └── party/            PartyKit server (y-partyserver)
├── packages/
│   ├── spec/             ComponentSpec types
│   ├── rebtel-ds/        Hardcoded Rebtel DS
│   └── renderer/         ComponentSpec → React
├── CLAUDE.md
└── docs/ATELIER.md
```

Shared root `tsconfig.json`. TypeScript strict mode throughout. ESLint + Prettier with a lightweight config — nothing that'll generate noise.

### packages/spec
The trimmed ComponentSpec types. Exported cleanly, no React dependency (this package is pure types + resolution logic).

Include the three-layer prop resolver as a utility: `resolveProps(component, variantId, instanceOverrides)` that implements `base ← variant ← instance`. This is what the renderer calls.

### packages/rebtel-ds
Three components, each with all three files (`.tsx`, `.spec.ts`, `.variants.ts`):

- **Button** — 3 variants: `primary`, `secondary`, `ghost`. Props: `label`, `onClick`, `disabled`.
- **ProductCard** — 2 variants: `mtu-bundle`, `mtu-bundle-highlighted`. Props: `bundle` (string, e.g. "10 GB"), `duration` (string, e.g. "30 days"), `price` (number), `currency` (string).
- **CountryPicker** — 1 variant: `default`. Props: `countries` (array), `selectedCode`, `onSelect`.

Plus `tokens.ts` with the values I'll paste, typed as `Token<'color'>`, `Token<'spacing'>`, etc.

The React components import tokens by name — never hex literals. `packages/rebtel-ds` is what proves invariant #1 holds; if you see a hex in a `.tsx` file, fix it.

### packages/renderer
Takes a ComponentSpec + resolved props, returns a React element. Handles:
- Token reference resolution (`brand.primary` → actual CSS value)
- Three-layer prop override stack (calls into `packages/spec`'s resolver)
- Variant selection (given a variant id, pick the right React component path)

No JSX authored here — this package is a translation layer. It imports the DS components from `packages/rebtel-ds` and calls them with resolved props.

### apps/web — one page: `/canvas/demo`
Infinite canvas with pan and zoom. One frame on it, sized as a mobile viewport (375×812). Left rail (narrow, ~180px) shows the three components from `rebtel-ds` as draggable items.

Interactions:
- Drag a component from the rail → drops into the frame → a new Instance is created in the Zustand store, rendered via the renderer at the drop position.
- Click an instance → right panel (~240px) opens and shows the instance's properties as editable fields.
- Edit a prop (e.g. the `price` on ProductCard) → the canvas reflects the change immediately.

Canvas interactions should feel responsive. No need for production-grade pan/zoom here — `react-zoom-pan-pinch` or similar is fine if it works out of the box.

### apps/party
PartyKit server scaffold using `y-partyserver`. Deployable to my Cloudflare account via `pnpm deploy:party` or similar script. Verify it deploys and a test client can connect — but **do not** wire it to the web app yet. That's session 4.

### Zustand store in apps/web
Represents canvas state: frames, instances, selection. Document shape must be CRDT-compatible: stable string IDs, no order-sensitive arrays, no raw DOM references, no functions in state.

## Out of scope for this session

Flag any scope creep:
- Family view (coming session 2)
- Variant editing (coming session 2)
- Gallery / library view (coming session 3)
- AI agent (coming session 5)
- Real-time sync wiring (coming session 4 — scaffold only this session)
- Figma import, Play mode, rules editor — all later

If I ask for something from this list, push back and remind me of the deferred list.

## Verification checklist at the end

Before declaring session 1 done, walk through:

1. `pnpm install && pnpm dev` in a fresh clone works.
2. `/canvas/demo` loads without errors in the console.
3. I can drag all three component types (Button, ProductCard, CountryPicker) onto the frame.
4. Clicking any instance opens the property panel with the correct prop fields.
5. Editing a prop updates the canvas.
6. `grep -r "#[0-9a-fA-F]\{6\}" packages/rebtel-ds/**/*.tsx` returns nothing (no hex in components).
7. `pnpm deploy:party` deploys the server to Cloudflare successfully.
8. No TypeScript errors anywhere.

When all eight pass, we're done.

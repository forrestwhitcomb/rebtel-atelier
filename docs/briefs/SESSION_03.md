# Session 3 — Dev Mode + GitHub PR publishing + impact preview

Read `CLAUDE.md` and `docs/ATELIER.md` before starting. Invariants and the deferred list both apply. Sessions 1, 2, and 2b are complete and verified — canvas, variant editing, draft/published, family view all working.

## Goal

This is the thesis-proving session. By end of session:

1. I can select any instance on the canvas, open a **Dev Mode panel**, and see a ComponentSpec readable as an engineering handoff document. JSX snippet, token-named props, copy-to-clipboard.
2. I can edit a variant (using session 2's flow), hit push, and a **real GitHub PR** opens against the Rebtel GitHub repo with the updated variants file. An engineer can review and merge it like any other PR.
3. The **push popup shows per-canvas impact** — which canvases use this variant, whether they're draft or shipped, who's editing them, thumbnails.
4. **Shipped canvases stay on the old variant version** by default; in-progress canvases auto-adopt. The toggle in the popup is explicit per-canvas.

That's the acceptance criterion. This is the moment Rebtel engineers can read Atelier's output and build from it directly. Without this, Atelier is a pretty prototyping tool. With this, it's a genuine dev handoff surface.

## Why this matters more than other sessions

Every other session builds capability inside Atelier. This session builds the bridge *out* of Atelier to the engineering workflow. If the PR opened in session 3 isn't something an engineer wants to review, the whole thesis fails — no amount of downstream polish will save it.

Everything here should be designed with "an engineer I haven't met will review this PR" as the user. Clear commit messages, readable diffs, meaningful PR bodies, predictable file organization.

## Preflight — invariant #6 enforcement

Before doing any of the main scope, verify and fix if needed:

**Every registered component must declare a `paletteGroup`.** This is invariant #6 in CLAUDE.md. If session 2 / 2b components don't have palette groups yet (they likely don't — the invariant is newly added), add them now. Suggested groupings:

- `inputs` — Button, Input, Toggle, Select, Checkbox, Radio, Slider
- `content` — Text, Image, Icon, Video
- `containers` — Card, Sheet, Panel, Tabs, Accordion
- `dataDisplay` — Label, Badge, Avatar, Progress, RateCard
- `navigation` — AppBar, TabBar, Breadcrumb, SideNav
- `productSpecific` — ProductCard, CountryPicker, PaymentModule

For the components we actually have: Button → `inputs`, ProductCard → `productSpecific`, CountryPicker → `productSpecific`. Add the `paletteGroup` field to the component spec type and require it at component registration time. Missing group = validation error at startup, not silent fallback.

Also: confirm `ToolMode` in the editor state is still the open-ended `'select' | 'draw' | 'annotate' | 'hand'`. If earlier sessions narrowed it, widen it back. Draw and annotate aren't used yet but are reintroduced in later sessions.

These two cleanups are small but block cleanly on session 3.5's compositional work if skipped now.

## Scope

### Dev Mode panel

A tab (or toggle) on the right-side inspector alongside the existing Properties tab. When an instance is selected, clicking "Dev" shows:

**Handoff header**
- Component name (e.g. `ProductCard`)
- Variant name (e.g. `mtu-bundle-highlighted`)
- Variant version pinned on this instance (e.g. `v3`)
- Tag: "Dev handoff" in teal

**JSX snippet**
The exact JSX an engineer would paste. Token-named props, not resolved values:

```jsx
<ProductCard
  variant="mtu-bundle-highlighted"
  bundle="10 GB"
  duration="30 days"
  price={1000}
  currency="USD"
  selected
/>
```

- Monospace font, syntax-highlighted
- Copy-to-clipboard button (small "Copy" label top-right)
- If the instance has prop overrides that differ from the variant's published state, those show as explicit props. Otherwise, the snippet uses the variant and the defaults cascade.

**Resolved tokens section**
Below the snippet, a list of tokens this component actually uses at render time, with their values:

```
bg      [swatch]  surface.card.active      #1A1A1C
border  [swatch]  brand.primary            #E63946
radius            radii.lg                 12px
```

Three columns: token role, name, resolved value. Color tokens show a small swatch. This is the "semantic reference" layer — engineers see *what* the tokens are called in the DS, not just what they look like.

**Links section**
- `Open in repo →` — links to the component file in GitHub (constructed from the repo URL + component path)
- `View full spec →` — shows the full ComponentSpec JSON in a scratchpad overlay (stretch if time, stubbed otherwise)

**Behavior notes**
- Dev Mode is read-only. No editing here.
- Updates live as the user clicks different instances.
- Hidden for any structural node (root containers, row primitives, etc.) — no meaningful dev handoff for layout scaffolding.

### GitHub integration

This is the load-bearing infrastructure work of the session. Needs to exist:

**Auth via GitHub App.** Create a GitHub App with permissions:
- Repository: Contents (Read & Write)
- Repository: Pull Requests (Read & Write)
- Repository: Metadata (Read)

Install it on the Rebtel GitHub org (or Forrest's test repo during development). Store the installation ID, App ID, and private key in environment variables:
- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`
- `GITHUB_REPO_OWNER` (e.g. `forrestwhitcomb` during dev, `rebtel` later)
- `GITHUB_REPO_NAME` (e.g. `rebtel-atelier` during dev)

Use `@octokit/app` or `octokit` with App auth. Don't use PATs — they tie to an individual and break the handoff narrative.

**The publish API route.** When the user clicks "Push variant" in session 2's popup:

1. Atelier writes the draft → published in Supabase (this already works from session 2)
2. Atelier calls `POST /api/publish-variant` with the variant ID and changeset
3. The API route:
   - Gets the current file content from the repo (e.g. `packages/rebtel-ds/src/ProductCard/ProductCard.variants.ts`)
   - Applies the variant changes — generates the new file content deterministically from the variant spec
   - Creates a branch: `atelier/variant/[component-slug]-[variant-slug]-[short-hash]`
   - Commits the updated file on the new branch with a generated commit message
   - Opens a PR against `main` with a generated PR body
   - Returns the PR URL to the client

**Deterministic file generation.** This is the subtle part. The variants file in `packages/rebtel-ds` must be generated from the variant spec in a predictable, stable way — so that editing the same variant twice produces reasonable diffs (not a whole-file reshuffle).

Strategy: the variants file is serialized from the variant spec using a code generator that:
- Preserves variant ordering (variants appear in the file in creation order, or alphabetical — pick one and stick with it)
- Uses consistent formatting (let Prettier handle this, run prettier on the generated content)
- Imports tokens by their registry name, not inline hex values (invariant #1 still applies — no hex literals)
- Includes a header comment: `// Generated by Rebtel Atelier. Edit via the workbench or by hand — both are respected.`

If a user has edited the file by hand and then publishes from Atelier, the generator should merge (not overwrite) where possible. For this session, merging is out of scope — the generator overwrites, and if there's a conflict we flag it to the user via the push popup before committing. The handling: "This file has been modified outside Atelier. Review the diff before publishing." with a link to view the diff.

**Commit messages and PR bodies.**

Commit message template:
```
[atelier] ProductCard: update mtu-bundle-highlighted variant

- bg: surface.card.active → surface.card.promoted
- radius: radii.lg → radii.xl
- added badge prop
```

PR body template:
```
## What changed
Updated the `mtu-bundle-highlighted` variant of `ProductCard`.

### Property changes
- `bg`: `surface.card.active` → `surface.card.promoted`
- `radius`: `radii.lg` → `radii.xl`
- Added `badge` prop with default `{ text: "Most popular", color: "brand.primary" }`

## Impact
This change affects **14 instances across 4 canvases** in Atelier.

- Cuba top-up · amount selection (6 instances, draft)
- Nigeria top-up · amount selection (4 instances, draft)
- Mexico top-up · bundle picker (2 instances, shipped — pinned to v3, not affected)
- Calling credits · purchase flow (2 instances, shipped — pinned to v3, not affected)

## Context
Edited by Forrest in Atelier. [View in Atelier →](https://atelier.rebtel.com/component/productcard/variant/mtu-bundle-highlighted)

## Dev notes
- Token references resolved against `packages/rebtel-ds/tokens.ts`
- No visual regression issues detected in Atelier's preview
- File format: auto-generated from variant spec, safe to merge as-is
```

These templates should live in `packages/publish` (or wherever the publish logic lands) as functions that take the variant diff + impact analysis and produce the strings. Not hardcoded in the API route.

### Impact preview in the push popup

Extend session 2's push popup with real per-canvas data:

**Summary line** (already exists from session 2 at counter level):
> 14 instances across 4 canvases · 2 editors will see a sync indicator

**Per-canvas list** — new for session 3. Each row:
- Small thumbnail (can be a simple colored rectangle with instance-count dots for v1, real thumbnail later)
- Canvas name
- Instance count on this canvas
- Editor presence and "edited Nh ago" metadata
- Status badge: `draft` (amber) or `shipped` (gray)
- Radio toggle per canvas: `adopt new version` / `stay on v3`

**Default behavior:**
- Draft canvases: adopt new version (pre-selected)
- Shipped canvases: stay on v3 (pre-selected)

User can override either default per-canvas if needed. The checkbox at the bottom of session 2's popup — "Shipped canvases stay on old version" — becomes redundant with per-canvas controls and can be removed.

**Filter bar** at the top of the per-canvas list: `All | In progress | Shipped`. Default to All.

**Empty state** if no canvases are affected (e.g. newly created variant that hasn't been used yet): a short message "No canvases use this variant yet. It will become available once published."

### The atomic publish transaction

The two-headed publish from session 2 was stubbed for the repo side. Now it's real. Transaction semantics:

1. Start Supabase write (draft → published)
2. Start GitHub PR creation
3. If both succeed: commit both, show success state with PR link
4. If Supabase succeeds but GitHub fails: **roll back** the Supabase write, show error
5. If GitHub succeeds but Supabase fails: **delete** the GitHub PR (or close it with a comment explaining), show error

This is the "both must succeed" rule from the brief. In practice, both-failing is rare; one-failing is uncommon; but when it happens, the rollback prevents design and code from drifting silently.

Implementation: do the Supabase write first (reversible via simple update). Do the GitHub PR open after (reversible via close). If the second fails, revert the first. Wrap the whole thing in a try/catch with explicit rollback in the catch branch.

### Post-push state

After successful publish:
- The push popup shows a success state with PR link
- Toast notification on the main canvas: "[variantName] published · [PR link]"
- The variant in Supabase is now at version N+1
- Per the user's choices, canvases either pinned to N (stayed) or updated to N+1 (adopted)
- Edit module closes
- Draft state for this variant resets (next edit starts fresh from the new published state)

## Design constraints — don't make 3.5 harder

Session 3.5 refactors variants from flat strings into axis-and-state matrices. A few guardrails in this session to keep that refactor clean:

- **The JSX snippet in Dev Mode should use the variant name as a single prop** (e.g. `variant="mtu-bundle-highlighted"`). Don't start decomposing into `style="highlighted"` yet — that's 3.5's work.
- **The commit message / PR body format** references variants by name as a single string. Don't pre-split into axis-like sub-labels.
- **Impact preview per-canvas list** keys on `variantId` as a single identifier, not (variantId, state) tuples. 3.5 will introduce state-aware filtering; leave it out for now.
- **The code generator** should produce flat-variant output. The file shape will change in 3.5 to support axes and states, but for now the simpler format wins.

The goal: ship session 3 cleanly, let 3.5 do the refactor with confidence. Don't try to be clever about anticipating the new model.

## Out of scope (deferred — do not reach)

- Merging hand-edited variant files (for session 3, if the file was edited outside Atelier, we flag it and overwrite. Proper merge comes later.)
- Multiple variant changes in a single PR (one variant change = one PR for session 3. Batching is a UX question to answer later.)
- PR status polling — "your PR was merged" notifications in Atelier (session 4 or later)
- Token changes via publish (session 3 publishes variant and base-component changes only; token changes are a separate publish path and out of scope here)
- Visual regression testing on publish (nice-to-have, ship a stub "visual checks: not yet implemented")
- Component swap view full UI (was a stretch in 2b, still out of scope here)
- AI-suggested PR descriptions (session 5 or later)
- Axis / state refactor of variants (session 3.5)
- Component references components in specs (session 3.5)

If I ask for anything on this list, push back.

## Verification checklist at the end

1. All registered components have a `paletteGroup` field. A test component without one fails validation.
2. `ToolMode` type is `'select' | 'draw' | 'annotate' | 'hand'`, open-ended.
3. Select an instance, click Dev tab. Panel shows component name, variant, JSX snippet with token-named props, resolved tokens list with swatches, repo link.
4. Click "Copy" on the JSX snippet. Paste into a text editor. The pasted content is clean, valid JSX, using token names not hex values.
5. Edit a variant via session 2's flow. Hit push. Popup opens showing:
   - Before/after preview
   - Per-canvas impact list with thumbnails, statuses, editor metadata
   - Filter bar works (All/In progress/Shipped)
   - Per-canvas adopt/stay radios, default behavior correct
6. Confirm push. Popup shows success state with a real GitHub PR link.
7. Open the PR in GitHub. Verify:
   - Branch name follows `atelier/variant/[component]-[variant]-[hash]` pattern
   - Commit message has the three-section format (title, blank line, bullets)
   - PR body has the "What changed / Impact / Context / Dev notes" structure
   - The diff shows the updated `.variants.ts` file with clean, readable changes (no whole-file reshuffle)
   - Token references are by name, not hex values
8. In the Rebtel repo (or test repo), have an engineer review the PR. Ask them: "could you merge this as-is?" If yes, ✅. If no, find out what's missing.
9. Check that draft canvases auto-adopted the new version (their instances' `variantVersion` updated to N+1).
10. Check that shipped canvases stayed on version N.
11. Test failure modes:
    - Disable GitHub token temporarily → push should fail cleanly with "could not open PR" error, Supabase should roll back
    - Then re-enable and push again → should succeed
12. Dev Mode panel handles edge cases: instance with no overrides (snippet uses defaults), instance with all overrides (snippet shows every prop), structural node selected (Dev tab disabled or hidden).

When all pass, session 3 is done — and the thesis has been tested for real.

## Inputs I'll provide at kickoff

1. **GitHub App credentials** — I'll create the GitHub App during session setup and paste the App ID, private key, and installation ID.
2. **Test repo URL** — which repo the PRs should target. During dev this is likely a personal test repo of mine; eventually it'll be a Rebtel repo.
3. **Vercel env vars access** — I'll add the GitHub App credentials to Vercel's environment variables so the production deploy can open PRs.

The GitHub App setup is the only non-trivial manual step. You'll need to walk me through it if I haven't done it before.

## The north star for this session

An engineer opens the PR you created, reads the body, glances at the diff, and says "yeah, I'd merge this." That's the bar. If it's lower than that — if the PR is cryptic, or the diff is noisy, or the body doesn't explain what changed — we haven't proven the thesis yet and something in this session needs another pass.

Don't ship until a real engineer has looked at a real PR Atelier generated, and approved it.

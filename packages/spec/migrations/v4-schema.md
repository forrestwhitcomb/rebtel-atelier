# Atelier v4 — proposed Supabase schema

> **Status: proposal.** This document describes the Postgres schema Atelier will land in Supabase when persistence ships in a future session. It is not yet applied to any database. The schema mirrors the v4 in-memory shape declared in `packages/spec/src/migrations/v3-to-v4.ts`.
>
> The migration code lives at `packages/spec/src/migrations/v3-to-v4.ts` (under `src/` so vitest can run it). Migration *docs* live alongside this file at `packages/spec/migrations/`.

## Design choices

- **Single Supabase project, single schema (`atelier`).** Multi-tenant is deferred (CLAUDE.md). All tables sit in one schema; org-scoping rows can be added as a column when external tenants land.
- **Component-level versioning, not variant-level.** v3 versioned each variant independently; v4 versions the whole component-overrides snapshot. An instance pins to `(component_id, component_version)` and resolves against the matching `component_published_history` row. Side-effect: component versions tick up faster than v3 variant versions did, because every axis or state override change bumps the whole component. A Button that sat at v1 in v3 with three independently-versioned variants might reach v15 in v4 after the same number of edits — correct per the new model, but worth noting before the first reviewer sees a PR titled "Button v15".
- **Overrides stored as JSONB.** `axis_overrides` and `state_overrides` are arrays of `{axisSelection, props}` / `{state, props}` records — small, frequently read together, never queried by individual key. JSONB beats a normalized `axis_override_props` table for read latency and edit ergonomics.
- **`propOverrides` and `axis_selection` on instances are JSONB too.** Same reasoning. Instances are read in bulk per canvas.
- **Tokens stay in code, not Supabase.** `packages/rebtel-ds/src/tokens.ts` is the runtime source. Persisting tokens is a token-editor session, deferred.
- **No CRDT data here.** PartyKit holds the Yjs documents for collaborative editing (canvases, variant drafts). Supabase holds the published, committed state — what canvases resolve against by default. Promotion from draft to published is the publish action, which writes both Supabase and the GitHub PR.
- **RLS-ready but permissive at first.** Tables have RLS enabled with a single `authenticated` policy until the role model is designed. Anonymous reads are off — Atelier requires login.

## Tables

### `atelier.components`

The DS member rows. One row per registered component.

```sql
create table atelier.components (
  id              text          primary key,                -- e.g. 'Button'
  name            text          not null,                   -- display name
  palette_group   text          not null check (
    palette_group in ('inputs','content','containers','dataDisplay','navigation','productSpecific')
  ),
  base_spec       jsonb         not null,                   -- PrimitiveSpec (kind:'primitive', children may include ComponentRef)
  base_draft      jsonb,                                    -- nullable; editor-local
  axes            jsonb         not null default '[]'::jsonb, -- Axis[]
  supported_states jsonb        not null default '["default"]'::jsonb, -- StateName[]
  prop_schema     jsonb,                                    -- nullable; PropSchema
  hide_family_view boolean      not null default false,
  published_version integer     not null default 1,
  published_axis_overrides   jsonb not null default '[]'::jsonb,
  published_state_overrides  jsonb not null default '[]'::jsonb,
  last_published_at timestamptz,
  last_published_by text,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

-- Validation: every base_spec is { kind: 'primitive', ... }.
alter table atelier.components add constraint base_spec_is_primitive
  check (base_spec ->> 'kind' = 'primitive');
```

### `atelier.component_published_history`

Immutable per-version snapshots. Shipped canvases pin instances to a `component_version`; the renderer reads the matching row instead of the live `published_*` columns.

```sql
create table atelier.component_published_history (
  component_id    text          not null references atelier.components(id) on delete cascade,
  version         integer       not null,
  axis_overrides  jsonb         not null,
  state_overrides jsonb         not null,
  published_at    timestamptz   not null default now(),
  published_by    text,
  primary key (component_id, version)
);
```

### `atelier.canvases`

```sql
create table atelier.canvases (
  id              text          primary key,
  name            text          not null,
  status          text          not null default 'draft' check (status in ('draft','shipped')),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);
```

### `atelier.frames`

```sql
create table atelier.frames (
  id              text          primary key,
  canvas_id       text          not null references atelier.canvases(id) on delete cascade,
  viewport        text          not null check (viewport in ('mobile','tablet','desktop')),
  position        jsonb         not null,                   -- { x, y }
  size            jsonb         not null,                   -- { w, h }
  ord             integer       not null default 0          -- presentation order; explicit, no implicit array order
);
create index frames_by_canvas on atelier.frames (canvas_id);
```

### `atelier.instances`

The big one. v4: `axis_selection` JSONB replaces `variant_id`.

```sql
create table atelier.instances (
  id              text          primary key,
  canvas_id       text          not null references atelier.canvases(id) on delete cascade,
  frame_id        text          not null references atelier.frames(id) on delete cascade,
  component_id    text          not null references atelier.components(id),
  axis_selection  jsonb         not null default '{}'::jsonb,    -- Record<string, string>
  variant_version integer       not null,                        -- pinned version; matches component_published_history.version
  prop_overrides  jsonb         not null default '{}'::jsonb,
  position        jsonb         not null                          -- { x, y } relative to frame
);
create index instances_by_canvas on atelier.instances (canvas_id);
create index instances_by_component on atelier.instances (component_id);
```

### `atelier.connections` (reserved)

Reserved for Play mode (session 6).

```sql
create table atelier.connections (
  id              text          primary key,
  canvas_id       text          not null references atelier.canvases(id) on delete cascade,
  from_frame_id   text          not null references atelier.frames(id),
  to_frame_id     text          not null references atelier.frames(id),
  label           text
);
```

## RLS

All tables have RLS enabled. Initial policy: `authenticated` users have full read/write. Tightening (per-org, per-canvas, per-role) is deferred until Atelier has roles.

```sql
alter table atelier.components enable row level security;
alter table atelier.component_published_history enable row level security;
alter table atelier.canvases enable row level security;
alter table atelier.frames enable row level security;
alter table atelier.instances enable row level security;
alter table atelier.connections enable row level security;

-- Permissive bootstrap policy. Replace before opening Atelier to non-Rebtel users.
create policy authenticated_full on atelier.components for all to authenticated using (true) with check (true);
create policy authenticated_full on atelier.component_published_history for all to authenticated using (true) with check (true);
create policy authenticated_full on atelier.canvases for all to authenticated using (true) with check (true);
create policy authenticated_full on atelier.frames for all to authenticated using (true) with check (true);
create policy authenticated_full on atelier.instances for all to authenticated using (true) with check (true);
create policy authenticated_full on atelier.connections for all to authenticated using (true) with check (true);
```

## What's intentionally *not* here

- **Tokens table.** Tokens are code-resident; runtime resolves via `tokens.ts`. A future token-editor session will decide whether to mirror them in Supabase.
- **Variants table.** The v3 `variants` table doesn't exist in v4 — variants are axis selections matched against `published_axis_overrides`. Migration collapses every v3 variant row into a JSONB entry on its parent component.
- **PartyKit / Yjs CRDT documents.** Live on Cloudflare via PartyKit. Supabase persists committed published state only.
- **Multi-tenant org column.** Add when needed; not now.
- **Audit / change log.** `last_published_at` / `last_published_by` cover the most recent publish; full history lives in `component_published_history`. A separate audit table can layer on later.

## v3 → v4 mapping summary

| v3 source                                  | v4 destination                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `components.id, name, palette_group, ...`  | unchanged                                                                     |
| `components.base_spec.variant: null`       | dropped                                                                       |
| `components.base_spec.{...}`               | `base_spec` with `kind: 'primitive'` discriminator added                      |
| `variants[].published`                     | one entry in `published_axis_overrides`, keyed by `axisSelection` from the migration plan |
| `variants[].publishedHistory[v]`           | folded into `component_published_history` row at version `v`                  |
| `variants[].publishedVersion` (max)        | `components.published_version`                                                |
| `instances.variant_id`                     | `instances.axis_selection` (JSONB) via the same plan                          |
| `instances.variant_version`                | unchanged numeric value; resolved against `component_published_history`       |
| (no v3 equivalent)                         | `axes`, `supported_states`, `published_state_overrides`                       |

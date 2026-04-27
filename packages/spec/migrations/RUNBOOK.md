# v3 → v4 migration runbook

> **Status: artifact only.** Atelier has no Supabase persistence yet. This runbook describes how to apply the migration when persistence ships in a future session. Nothing here runs against any database today.
>
> Author: session 3.5a. Live persistence: deferred.

## What you're migrating

- **From** the v3 component model (flat-string variants, single `variantId` on instances).
- **To** the v4 component model (axes + states + JSONB `axis_selection` on instances) defined in `v4-schema.md` and produced by `packages/spec/src/migrations/v3-to-v4.ts`.

## Inputs you need before starting

1. A Supabase project containing live v3 data.
2. `DATABASE_URL` for the target project, with `pg_dump` access.
3. A reviewed `ComponentMigrationPlan` for **every** v3 component in the database. No canonical plans ship with the repo — the operator authors one plan per component at cutover time. `v3-to-v4.test.ts` contains inline fixture plans for Button / ProductCard / CountryPicker that serve as reference shape examples.
4. Confirmed approval from the Atelier owner that a migration window is acceptable. The migration runs in a single transaction; users hitting the app during that window will see stale reads or, briefly, errors.

## Pre-flight checks

Run these first. If any fails, stop and resolve before touching the database.

```bash
# 1. Run the migration unit tests against the current `main`.
pnpm --filter @rebtel-atelier/spec test

# 2. Confirm every v3 component in the source DB has a plan authored.
#    The migration tool's --dry-run output enumerates components with no plan.
pnpm migrate:v4 --dry-run --src "$DATABASE_URL"

# 3. Confirm the v4 schema script applies cleanly to a scratch DB.
psql "$SCRATCH_DATABASE_URL" -f packages/spec/migrations/v4-schema.sql
```

> Note: `pnpm migrate:v4` and `v4-schema.sql` do not exist yet. They land in the persistence session that wires Supabase to Atelier. Until then, treat steps 2–3 as documentation of the expected commands.

## Step 1 — Backup

**The backup is the floor. Without it, the migration cannot proceed.** A Supabase-side snapshot is fine, but only if you can verify it's restorable.

```bash
mkdir -p backups
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
pg_dump "$DATABASE_URL" \
  --no-owner --no-privileges \
  --file="backups/${TIMESTAMP}-pre-v4.sql"

# Verify the dump is non-empty and contains expected tables.
ls -lh "backups/${TIMESTAMP}-pre-v4.sql"
grep -c "CREATE TABLE" "backups/${TIMESTAMP}-pre-v4.sql"   # should be > 0
grep "atelier.components" "backups/${TIMESTAMP}-pre-v4.sql" | head -3
```

Store the backup in a location separate from your laptop's local disk (S3, encrypted bucket, Notion attachment — your call). Treat it like a release artifact.

## Step 2 — Dry-run on a clone

Spin up a Supabase branch (or restore the backup to a scratch DB) and run the migration against it. Do not skip this on the basis of "the unit tests passed." The unit tests cover three known plans against fixture data; production data will surface plan gaps.

```bash
pnpm migrate:v4 \
  --src "$CLONE_DATABASE_URL" \
  --plans path/to/component-plans.json \
  --dry-run
```

Inspect the output:
- Component count in v3 source → should equal component count migrated.
- Per-component variant count → should equal axis-override count produced.
- Instance count migrated → should equal instance count read.
- Any errors thrown by `migrateComponent` or `migrateInstance` → resolve by amending the plan, then re-run.

## Step 3 — Schema migration on the clone

```bash
psql "$CLONE_DATABASE_URL" -1 -f packages/spec/migrations/v4-schema.sql
```

The `-1` runs the file in a single transaction. If the DDL fails partway through, the entire schema rolls back. Verify table existence + RLS policies after:

```bash
psql "$CLONE_DATABASE_URL" -c "\dt atelier.*"
psql "$CLONE_DATABASE_URL" -c "select tablename, rowsecurity from pg_tables where schemaname = 'atelier'"
```

## Step 4 — Data migration on the clone

```bash
pnpm migrate:v4 \
  --src "$CLONE_DATABASE_URL" \
  --dst "$CLONE_DATABASE_URL" \
  --plans path/to/component-plans.json \
  --apply
```

Spot-check after:
- Pick three components at random; verify their `axes`, `published_axis_overrides`, and `published_version` look right.
- Pick ten instances at random; verify `axis_selection` is non-empty (or empty for components with `axes = []`) and `variant_version` matches a row in `component_published_history`.
- Render a draft canvas in a preview deploy pointed at the clone. Visual smoke test only — formal verification waits for the persistence session.

## Step 5 — Production cutover

Repeat steps 1, 3, 4 against production. The clone gives you confidence; production is the live action.

```bash
# 1. Backup again (production-fresh).
pg_dump "$PROD_DATABASE_URL" --no-owner --no-privileges \
  --file="backups/$(date +%Y%m%d-%H%M%S)-prod-pre-v4.sql"

# 2. Schema migration in a transaction.
psql "$PROD_DATABASE_URL" -1 -f packages/spec/migrations/v4-schema.sql

# 3. Data migration.
pnpm migrate:v4 \
  --src "$PROD_DATABASE_URL" \
  --dst "$PROD_DATABASE_URL" \
  --plans path/to/component-plans.json \
  --apply
```

If anything fails, the schema's DDL transaction rolls back automatically. The data migration runs in its own transaction; if it fails, the schema is in place but no v4 rows landed — re-run after fixing the plan, do not partial-apply.

## Step 6 — Verify

- Row counts: `select count(*) from atelier.components`, `from atelier.instances`, `from atelier.canvases` — match the pre-backup counts.
- Render a known canvas in production. Eyeball pass.
- Open the publish flow on a known variant change. Confirm Dev Mode reads axis selections, the family view shows axis options, the PR generator produces the right `.spec.ts` content. (These are 3.5b features — they'll exist in the app code by the time you run this.)

## Rollback

If the cutover surfaces a problem you can't fix forward in under an hour:

```bash
# 1. Drop the v4 schema. The v3 schema is untouched until step 4 wrote
#    over it (the migration writes to NEW v4 tables, not the v3 ones,
#    so v3 tables still exist unless you've already dropped them).
psql "$PROD_DATABASE_URL" -c "drop schema atelier cascade"

# 2. Restore from the production backup.
psql "$PROD_DATABASE_URL" < backups/<your-backup>.sql
```

If you've already dropped the v3 tables to reclaim space, rollback restores the entire backup.

## Things this runbook intentionally omits

- **PartyKit / Yjs migration.** Atelier doesn't persist Yjs documents to Supabase yet — collaborative state is ephemeral per session. When that lands, Yjs document migration is a separate runbook.
- **Token migration.** Tokens are code-resident; nothing to migrate in the database.
- **App downtime coordination.** Atelier is internal; the cutover window is a Slack ping, not a status page. Adjust if Atelier ever goes external.

## Where plans live

Plans are authored ad-hoc when the migration runs; no canonical plans ship with the repo. The migration operator constructs a `ComponentMigrationPlan` per component at cutover time and passes the collection to `pnpm migrate:v4 --plans path/to/component-plans.json`.

The v4 component shape (axes, supportedStates) is the source of truth for live DS components — each component's `packages/rebtel-ds/src/components/<Name>/<Name>.spec.ts` declares its axes and supportedStates inline. A migration plan is a one-time translation artifact mapping old v3 flat-variant ids to new axis selections; once cutover is complete, the plan can be discarded.

The test suite in `packages/spec/src/migrations/v3-to-v4.test.ts` exercises the migration with inline fixture plans (Button / ProductCard / CountryPicker). Those fixtures live next to their test data and are reference-only — treat them as shape examples when authoring production plans.

## Open questions (resolve before running this against production)

- Should `component_published_history` carry a `git_pr_url` column linking back to the PR that produced each version? Useful for audit; cheap to add now, awkward to backfill later.
- How does the migration tool authenticate against Supabase? Service-role key in the operator's environment is the obvious answer; the security review for that key needs to happen before first prod run.

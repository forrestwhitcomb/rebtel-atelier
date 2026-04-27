export * from "./tokens.js";
export * from "./types.js";
export {
  resolveProps,
  publishedSnapshotAtVersion,
  defaultAxisSelectionFor,
} from "./resolve.js";
export type { DraftScope, ResolveOptions } from "./resolve.js";
export { validateDesignSystem, DesignSystemValidationError } from "./types.js";

// v4 migration entry points. The v4 shape is the live Component/Instance
// from ./types.js; the migration code consumes those directly.
// Migration remains invocable for the eventual Supabase persistence
// cutover — callers author per-component ComponentMigrationPlan objects
// ad-hoc at that point (no canonical plans ship with the repo).
export {
  migrateComponent,
  migrateInstance,
  type ComponentMigrationPlan,
} from "./migrations/index.js";

export * from "./tokens.js";
export * from "./types.js";
export {
  resolveProps,
  publishedSnapshotAtVersion,
  defaultAxisSelectionFor,
} from "./resolve.js";
export type { DraftScope, ResolveOptions } from "./resolve.js";
export { validateDesignSystem, DesignSystemValidationError } from "./types.js";

// v4 migration entry points. Chunk 2 of session 3.5 promoted the v4
// shape into ./types.js; the migration code now consumes those types
// directly rather than declaring v4 inline. Migration remains
// invocable for the eventual Supabase persistence cutover.
//
// Plans (Button / ProductCard / CountryPicker) are re-exported here so
// the DS components can read their own axes / supportedStates from the
// same source of truth as the migration code.
export {
  migrateComponent,
  migrateInstance,
  type ComponentMigrationPlan,
  buttonPlan,
  productCardPlan,
  countryPickerPlan,
} from "./migrations/index.js";

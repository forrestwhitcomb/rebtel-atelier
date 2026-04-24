export {
  migrateComponent,
  migrateInstance,
  type ComponentMigrationPlan,
  type ComponentOverrideSnapshot,
  type ComponentV3,
  type ComponentV4,
  type InstanceV3,
  type InstanceV4,
} from "./v3-to-v4.js";

// Per-component migration plans. Also consumed by the DS components
// themselves so axes/supportedStates have one source of truth shared
// with the migration archaeology.
export { buttonPlan, productCardPlan, countryPickerPlan } from "./plans/index.js";

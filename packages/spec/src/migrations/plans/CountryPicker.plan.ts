import type { ComponentMigrationPlan } from "../v3-to-v4.js";

/**
 * CountryPicker — no axes. v3's single `default` variant collapses to
 * an empty axis selection. Future axes (e.g. `density: 'compact' |
 * 'comfortable'`) would extend this; for now the picker has only one
 * shape.
 */
export const countryPickerPlan: ComponentMigrationPlan = {
  axes: [],
  supportedStates: ["default"],
  variantToAxisSelection: {
    default: {},
  },
};

// Per-component migration plans for the v3 → v4 cutover. The plan
// declares each component's axes, supported states, and the mapping
// from old flat-variant ids to new axis selections.
//
// These plans are also consumed by `packages/rebtel-ds/src/components/<Name>/<Name>.spec.ts`
// — chunk 2 reads `axes` and `supportedStates` from here so the DS
// component definition stays a single source of truth shared with the
// migration archaeology.

export { buttonPlan } from "./Button.plan.js";
export { productCardPlan } from "./ProductCard.plan.js";
export { countryPickerPlan } from "./CountryPicker.plan.js";

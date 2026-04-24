// Tokens
export * from "./tokens.js";

// Components — three-files-per-component is now two (the .variants.ts
// file was absorbed into .spec.ts when v4 collapsed flat-string variants
// into axis overrides on the Component itself). The DS only exports the
// React component and the spec.
export { Button } from "./components/Button/Button.js";
export type { ButtonProps } from "./components/Button/Button.js";
export { buttonComponent } from "./components/Button/Button.spec.js";

export { ProductCard } from "./components/ProductCard/ProductCard.js";
export type { ProductCardProps } from "./components/ProductCard/ProductCard.js";
export { productCardComponent } from "./components/ProductCard/ProductCard.spec.js";

export { CountryPicker } from "./components/CountryPicker/CountryPicker.js";
export type {
  CountryOption,
  CountryPickerProps,
} from "./components/CountryPicker/CountryPicker.js";
export { countryPickerComponent } from "./components/CountryPicker/CountryPicker.spec.js";

// Assembled design system for easy consumption by apps
import type { DesignSystem } from "@rebtel-atelier/spec";
import { validateDesignSystem } from "@rebtel-atelier/spec";
import { buttonComponent } from "./components/Button/Button.spec.js";
import { productCardComponent } from "./components/ProductCard/ProductCard.spec.js";
import { countryPickerComponent } from "./components/CountryPicker/CountryPicker.spec.js";
import { TOKEN_CATALOG } from "./tokens.js";

export const rebtelDesignSystem: DesignSystem = {
  tokens: TOKEN_CATALOG,
  components: [buttonComponent, productCardComponent, countryPickerComponent],
  rules: [],
};

// Startup-time validation per CLAUDE.md invariant #6 + the v4 axes /
// supportedStates / draft / published shape checks. Throws if any
// component is missing required structure or uses an unknown
// paletteGroup value.
validateDesignSystem(rebtelDesignSystem);

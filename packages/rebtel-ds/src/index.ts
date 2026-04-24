// Tokens
export * from "./tokens.js";

// Components
export { Button } from "./components/Button/Button.js";
export type { ButtonProps, ButtonVariantId } from "./components/Button/Button.js";
export { buttonComponent } from "./components/Button/Button.spec.js";
export { buttonVariants } from "./components/Button/Button.variants.js";

export { ProductCard } from "./components/ProductCard/ProductCard.js";
export type {
  ProductCardProps,
  ProductCardVariantId,
} from "./components/ProductCard/ProductCard.js";
export { productCardComponent } from "./components/ProductCard/ProductCard.spec.js";
export { productCardVariants } from "./components/ProductCard/ProductCard.variants.js";

export { CountryPicker } from "./components/CountryPicker/CountryPicker.js";
export type {
  CountryOption,
  CountryPickerProps,
  CountryPickerVariantId,
} from "./components/CountryPicker/CountryPicker.js";
export { countryPickerComponent } from "./components/CountryPicker/CountryPicker.spec.js";
export { countryPickerVariants } from "./components/CountryPicker/CountryPicker.variants.js";

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

// Startup-time validation per CLAUDE.md invariant #6. Throws if any
// component is missing a paletteGroup or uses an unknown group value.
validateDesignSystem(rebtelDesignSystem);

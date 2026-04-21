import type { Component } from "@rebtel-atelier/spec";
import { countryPickerVariants } from "./CountryPicker.variants.js";

export const countryPickerComponent: Component = {
  id: "CountryPicker",
  name: "CountryPicker",
  version: 1,
  baseSpec: {
    id: "CountryPicker:base",
    type: "CountryPicker",
    variant: null,
    props: {
      countries: [
        { code: "US", name: "United States", flag: "🇺🇸" },
        { code: "SE", name: "Sweden", flag: "🇸🇪" },
        { code: "IN", name: "India", flag: "🇮🇳" },
        { code: "NG", name: "Nigeria", flag: "🇳🇬" },
        { code: "PH", name: "Philippines", flag: "🇵🇭" },
      ],
      selectedCode: null,
    },
    children: [],
  },
  variants: countryPickerVariants,
};

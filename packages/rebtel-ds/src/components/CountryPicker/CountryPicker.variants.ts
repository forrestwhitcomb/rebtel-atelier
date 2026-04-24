import type { Variant } from "@rebtel-atelier/spec";

// Variants declare visual differences through explicit token refs on
// `published` — no variant-discriminator flag that the component reads.
// CountryPicker currently has a single variant; published mirrors base.

export const countryPickerVariants: Variant[] = [
  {
    id: "default",
    name: "Default",
    extends: "base",
    draft: {},
    published: {
      bg: { token: "color.input-bg" },
      fg: { token: "color.input-text" },
      border: { token: "color.input-border" },
      radius: { token: "radius.sm" },
      labelColor: { token: "color.input-label" },
    },
    publishedVersion: 1,
  },
];

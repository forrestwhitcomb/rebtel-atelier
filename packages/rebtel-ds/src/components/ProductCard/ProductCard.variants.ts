import type { Variant } from "@rebtel-atelier/spec";

// Variants declare visual differences through explicit token refs on
// `published` — no variant-discriminator flag that the component reads.

export const productCardVariants: Variant[] = [
  {
    id: "mtu-bundle",
    name: "MTU Bundle",
    extends: "base",
    draft: {},
    published: {
      bg: { token: "color.card-bg" },
      border: { token: "color.card-border" },
      radius: { token: "radius.lg" },
      priceColor: { token: "color.content-primary" },
    },
    publishedVersion: 1,
  },
  {
    id: "mtu-bundle-highlighted",
    name: "MTU Bundle (Highlighted)",
    extends: "mtu-bundle",
    draft: {},
    published: {
      bg: { token: "color.home-card-mtu-bg" },
      border: { token: "color.border-brand" },
      radius: { token: "radius.lg" },
      priceColor: { token: "color.content-brand" },
    },
    publishedVersion: 1,
  },
];

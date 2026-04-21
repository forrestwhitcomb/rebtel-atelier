import type { Variant } from "@rebtel-atelier/spec";

export const productCardVariants: Variant[] = [
  {
    id: "mtu-bundle",
    name: "MTU Bundle",
    extends: "base",
    draft: {},
    published: { variant: "mtu-bundle" },
    publishedVersion: 1,
  },
  {
    id: "mtu-bundle-highlighted",
    name: "MTU Bundle (Highlighted)",
    extends: "mtu-bundle",
    draft: {},
    published: { variant: "mtu-bundle-highlighted" },
    publishedVersion: 1,
  },
];

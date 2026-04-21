import type { Variant } from "@rebtel-atelier/spec";

export const buttonVariants: Variant[] = [
  {
    id: "primary",
    name: "Primary",
    extends: "base",
    draft: {},
    published: { variant: "primary" },
    publishedVersion: 1,
  },
  {
    id: "secondary",
    name: "Secondary",
    extends: "base",
    draft: {},
    published: { variant: "secondary" },
    publishedVersion: 1,
  },
  {
    id: "ghost",
    name: "Ghost",
    extends: "base",
    draft: {},
    published: { variant: "ghost" },
    publishedVersion: 1,
  },
];

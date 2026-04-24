import type { ComponentMigrationPlan } from "../v3-to-v4.js";

/**
 * ProductCard — single `emphasis` axis. v3 had two flat variants
 * `mtu-bundle` (default styling) and `mtu-bundle-highlighted` (brand-
 * accented for the promoted bundle on the home screen). They collapse
 * cleanly into `emphasis: 'default' | 'highlighted'`.
 *
 * supportedStates includes hover / pressed because cards are interactive
 * tap targets. No state overrides seeded — that's a future session.
 */
export const productCardPlan: ComponentMigrationPlan = {
  axes: [
    {
      name: "emphasis",
      options: ["default", "highlighted"],
      default: "default",
    },
  ],
  supportedStates: ["default", "hover", "pressed"],
  variantToAxisSelection: {
    "mtu-bundle": { emphasis: "default" },
    "mtu-bundle-highlighted": { emphasis: "highlighted" },
  },
};

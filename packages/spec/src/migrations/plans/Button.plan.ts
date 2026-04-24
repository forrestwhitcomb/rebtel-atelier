import type { ComponentMigrationPlan } from "../v3-to-v4.js";

/**
 * Button — single `style` axis (primary / secondary / ghost), no `size`
 * axis yet (today's Button.tsx hardcodes height-lg / spacing-xl). Adding
 * a `size` axis is a follow-up — the plan is sized to today's reality.
 *
 * supportedStates declares the full interactive surface even though
 * only `disabled` ships behaviour in chunk 2 (Button.tsx already reads
 * `disabled` as a prop). Hover / pressed / focus listed so a future
 * state-aware session doesn't need to backfill the plan.
 */
export const buttonPlan: ComponentMigrationPlan = {
  axes: [
    {
      name: "style",
      options: ["primary", "secondary", "ghost"],
      default: "primary",
    },
  ],
  supportedStates: ["default", "hover", "pressed", "disabled", "focus"],
  variantToAxisSelection: {
    primary: { style: "primary" },
    secondary: { style: "secondary" },
    ghost: { style: "ghost" },
  },
};

# Component authoring rules

Every component that enters `packages/rebtel-ds` follows these rules. If an existing component doesn't, it's a bug.

## The rules

1. **Two files per component.** `Component.tsx` and `Component.spec.ts`. Nothing else. Exported from `packages/rebtel-ds/src/index.ts`. The legacy `.variants.ts` file was absorbed into `.spec.ts` when v4 collapsed flat-string variants into axis overrides on the `Component` itself; do not reintroduce it.

2. **Every visual choice is a top-level `TokenRef` prop.** Color, radius, spacing, font-size, icon size, shadow, border — anything the designer might want to change per variant or per instance. No hardcoded hex. No hardcoded token strings buried in a switch inside `.tsx`.

3. **Components never switch on a `variant` discriminator.** A `Button.tsx` does not read a `variant: "primary" | "ghost"` prop and branch on it. Instead, each axis combination's override declares the explicit token values (`bg`, `fg`, `border`, `radius`) and the component consumes those props directly. Variants are *data*, not a flag.

4. **`propSchema` is required.** Every prop in `baseSpec.props` has a schema entry declaring `category: "token" | "content"` plus the narrowing hint (`tokenCategory` for tokens, `contentKind` for content) and a human label. The inspector groups fields by category; a missing schema entry falls into an "Other" bucket — which is a visible tell that the component is under-specified.

5. **`baseSpec.props` carries defaults for every declared prop.** Never `undefined`, never "we'll figure it out at render time". If there's no sensible default, the prop doesn't belong on the component.

6. **Axis overrides declare visual diffs.** Each `published.axisOverrides` entry pairs an `axisSelection` (partial or full) with the props that differ from base. Sparse — only declare what changes. Four-layer resolution (`base ← matched axisOverrides ← matched stateOverrides ← instance overrides`) composes the full prop bag at render time.

7. **Every component has a `paletteGroup`.** Invariant #6 from `CLAUDE.md` — one of `inputs`, `content`, `containers`, `dataDisplay`, `navigation`, `productSpecific`. Validated at DS load; a missing or unknown group throws.

8. **The generated `.spec.ts` is byte-identical to the hand-authored file.** `packages/publish/src/generate-matches-source.test.ts` enforces this — it's the contract that makes re-publishing a component produce a no-op diff, and makes reviewing Atelier-authored PRs as clean as hand edits. If you add a new component, run the test to confirm the generator's output matches your hand-authored shape.

## Example (Button)

```ts
// Button.tsx — consumes tokens directly, no variant switch
export function Button({ label, disabled, bg, fg, border, radius }: ButtonProps) {
  const style = { backgroundColor: bg, color: fg, borderColor: border, borderRadius: radius, ... };
  return <button style={style} disabled={disabled}>{label}</button>;
}

// Button.spec.ts — the full v4 shape in one file
import type { Component } from "@rebtel-atelier/spec";

export const buttonComponent: Component = {
  id: "Button",
  name: "Button",
  paletteGroup: "inputs",
  axes: [
    {
      name: "style",
      options: ["primary", "secondary", "ghost"],
      default: "primary",
    },
  ],
  supportedStates: ["default", "hover", "pressed", "disabled", "focus"],
  baseSpec: {
    kind: "primitive",
    id: "Button:base",
    type: "Button",
    props: {
      label: "Button",
      disabled: false,
      bg: { token: "color.button-primary-bg" },
      fg: { token: "color.button-primary-text" },
      border: { token: "color.button-primary-border" },
      radius: { token: "radius.md" },
    },
    children: [],
  },
  draft: {
    axisOverrides: [],
    stateOverrides: [],
  },
  published: {
    axisOverrides: [
      {
        axisSelection: { style: "primary" },
        props: {
          bg: { token: "color.button-primary-bg" },
          fg: { token: "color.button-primary-text" },
          border: { token: "color.button-primary-border" },
          radius: { token: "radius.md" },
        },
      },
      // … secondary, ghost
    ],
    stateOverrides: [],
  },
  publishedVersion: 1,
  propSchema: {
    label: { category: "content", contentKind: "text", label: "Label" },
    disabled: { category: "content", contentKind: "boolean", label: "Disabled" },
    bg: { category: "token", tokenCategory: "color", label: "Background" },
    fg: { category: "token", tokenCategory: "color", label: "Text color" },
    border: { category: "token", tokenCategory: "color", label: "Border color" },
    radius: { category: "token", tokenCategory: "radius", label: "Corner radius" },
  },
};
```

## Content vs token

- **Token props** — anything resolvable against the DS: colors, radii, spacing, font-size, etc. Always `TokenRef` (`{ token: "color.foo" }`). Rendered in the "Tokens" section of the inspector as a dropdown narrowed by `tokenCategory`, with a swatch for colors.
- **Content props** — text, numbers, booleans, images, opaque data. Rendered in the "Content" section. `contentKind` picks the input affordance (`text` / `multiline` / `number` / `boolean`). Complex values (arrays of objects, nested structures) show as read-only JSON for now — complex-content editors arrive later.

If a prop could plausibly be either (say, `"10px"` as a literal string vs a `spacing.md` token), the schema's `category` is the tiebreaker. Don't rely on runtime inference.

## Invariants (enforced by tooling where possible)

- **No hex codes** in `packages/rebtel-ds/src/components/**/*.tsx`. Checked by `scripts/verify-no-hex.mjs`. Use tokens.
- **No variant-discriminator switches** in component `.tsx`. Not yet automated; code review.
- **All props have a schema entry.** Not yet automated; code review. A runtime warning from the inspector ("Other" section showing up) is a smoke signal.
- **Generator byte-match.** `packages/publish/src/generate-matches-source.test.ts` — any drift between hand-authored `.spec.ts` and generator output fails CI.

## When this will extend

- **Multi-ref composition.** Today the renderer supports multiple `ComponentRef` slots in `baseSpec.children` (demonstrated with ProductCard → Button). More complex compositions (cards containing rows of buttons, navigation stacks) layer on the same mechanism; no type changes needed.
- **New content kinds.** Image upload, rich text, icon picker. Add to `ContentKind` in `packages/spec/src/types.ts` and teach the inspector to render them. Keep the schema shape stable.
- **State overrides in practice.** Components declare `supportedStates` today but few seed `stateOverrides`. A state-aware session layers on by populating `published.stateOverrides` for interactive components.
- **Responsive overrides, annotations, AI suggestions.** Layer onto this model; don't replace it.

## Checklist before a PR that adds or modifies a component

- [ ] Two files present (`.tsx`, `.spec.ts`) and exported.
- [ ] `paletteGroup` set to one of the six valid groups.
- [ ] `axes` and `supportedStates` declared inline in `.spec.ts`.
- [ ] No hex in `.tsx`; no variant-discriminator switch.
- [ ] Every visual choice is a `TokenRef` prop consumed directly.
- [ ] `baseSpec.props` has a default for every prop.
- [ ] `propSchema` declares every prop with category + narrowing hint + label.
- [ ] `published.axisOverrides` declare only the token/content values that differ from base.
- [ ] `pnpm --filter @rebtel-atelier/spec test` passes.
- [ ] `pnpm --filter @rebtel-atelier/publish test` passes (includes the generator byte-match test).
- [ ] `node scripts/verify-no-hex.mjs` passes.
- [ ] Open the component in Atelier and confirm the inspector renders Tokens + Content sections with no "Other" bucket.

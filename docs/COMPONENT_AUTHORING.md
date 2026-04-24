# Component authoring rules

Every component that enters `packages/rebtel-ds` follows these rules. If an existing component doesn't, it's a bug.

## The rules

1. **Three files per component.** `Component.tsx`, `Component.spec.ts`, `Component.variants.ts`. Nothing else. Exported from `packages/rebtel-ds/src/index.ts`.

2. **Every visual choice is a top-level `TokenRef` prop.** Color, radius, spacing, font-size, icon size, shadow, border — anything the designer might want to change per variant or per instance. No hardcoded hex. No hardcoded token strings buried in a switch inside `.tsx`.

3. **Components never switch on `variantId`.** A `Button.tsx` does not read a `variant: "primary" | "ghost"` prop and branch on it. Instead, the variant's `published` declares the explicit token values (`bg`, `fg`, `border`, `radius`) and the component consumes those props directly. Variants are *data*, not a flag.

4. **`propSchema` is required.** Every prop in `baseSpec.props` has a schema entry declaring `category: "token" | "content"` plus the narrowing hint (`tokenCategory` for tokens, `contentKind` for content) and a human label. The inspector groups fields by category; a missing schema entry falls into an "Other" bucket — which is a visible tell that the component is under-specified.

5. **`baseSpec.props` carries defaults for every declared prop.** Never `undefined`, never "we'll figure it out at render time". If there's no sensible default, the prop doesn't belong on the component.

6. **Variants declare visual diffs via `published`.** Each variant's `published` contains the exact token values that differ from base (or from what the variant extends). Variants never override base behavior through a discriminator string.

## Example (Button)

```ts
// Button.tsx — consumes tokens directly, no variant switch
export function Button({ label, disabled, bg, fg, border, radius }: ButtonProps) {
  const style = { backgroundColor: bg, color: fg, borderColor: border, borderRadius: radius, ... };
  return <button style={style} disabled={disabled}>{label}</button>;
}

// Button.spec.ts — baseSpec + propSchema
baseSpec: {
  props: {
    label: "Button",
    disabled: false,
    bg: { token: "color.button-primary-bg" },
    fg: { token: "color.button-primary-text" },
    border: { token: "color.button-primary-border" },
    radius: { token: "radius.md" },
  },
},
propSchema: {
  label: { category: "content", contentKind: "text", label: "Label" },
  disabled: { category: "content", contentKind: "boolean", label: "Disabled" },
  bg: { category: "token", tokenCategory: "color", label: "Background" },
  fg: { category: "token", tokenCategory: "color", label: "Text color" },
  border: { category: "token", tokenCategory: "color", label: "Border color" },
  radius: { category: "token", tokenCategory: "radius", label: "Corner radius" },
}

// Button.variants.ts — each variant publishes its token values
{ id: "primary",   published: { bg: {...}, fg: {...}, border: {...}, radius: {...} } },
{ id: "secondary", published: { bg: {...}, fg: {...}, border: {...}, radius: {...} } },
{ id: "ghost",     published: { bg: {...}, fg: {...}, border: {...}, radius: {...} } },
```

## Content vs token

- **Token props** — anything resolvable against the DS: colors, radii, spacing, font-size, etc. Always `TokenRef` (`{ token: "color.foo" }`). Rendered in the "Tokens" section of the inspector as a dropdown narrowed by `tokenCategory`, with a swatch for colors.
- **Content props** — text, numbers, booleans, images, opaque data. Rendered in the "Content" section. `contentKind` picks the input affordance (`text` / `multiline` / `number` / `boolean`). Complex values (arrays of objects, nested structures) show as read-only JSON for now — complex-content editors arrive later.

If a prop could plausibly be either (say, `"10px"` as a literal string vs a `spacing.md` token), the schema's `category` is the tiebreaker. Don't rely on runtime inference.

## Invariants (enforced by tooling where possible)

- **No hex codes** in `packages/rebtel-ds/src/components/**/*.tsx`. Checked by `scripts/verify-no-hex.mjs`. Use tokens.
- **No variant-discriminator switches** in component `.tsx`. Not yet automated; code review.
- **All props have a schema entry.** Not yet automated; code review. A runtime warning from the inspector ("Other" section showing up) is a smoke signal.

## When this will extend

- **Sub-components.** When a component is compositional (e.g. a card that contains a button), we move to the nested-instance model: `Instance.slots: Record<string, Instance>`, each slot a first-class instance with its own `variantId` + overrides. Deferred until we ingest a component that needs it.
- **New content kinds.** Image upload, rich text, icon picker. Add to `ContentKind` in `packages/spec/src/types.ts` and teach the inspector to render them. Keep the schema shape stable.
- **Responsive overrides, annotations, AI suggestions.** Layer onto this model; don't replace it.

## Checklist before a PR that adds or modifies a component

- [ ] Three files present and exported.
- [ ] No hex in `.tsx`; no variant-discriminator switch.
- [ ] Every visual choice is a `TokenRef` prop consumed directly.
- [ ] `baseSpec.props` has a default for every prop.
- [ ] `propSchema` declares every prop with category + narrowing hint + label.
- [ ] Variants' `published` declares only the token/content values that differ from base.
- [ ] `pnpm --filter @rebtel-atelier/spec test` passes.
- [ ] `node scripts/verify-no-hex.mjs` passes.
- [ ] Open the component in Atelier and confirm the inspector renders Tokens + Content sections with no "Other" bucket.

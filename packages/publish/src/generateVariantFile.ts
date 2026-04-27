import type {
  Component,
  ComponentOverrideSnapshot,
  ComponentSpec,
  PrimitiveSpec,
  PropValue,
  TokenRef,
} from "@rebtel-atelier/spec";

const INDENT = "  ";

function indentLine(depth: number): string {
  return INDENT.repeat(depth);
}

/** TS-style key: bare identifier where safe, quoted string otherwise. */
function formatKey(k: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
}

function isTokenRef(v: unknown): v is TokenRef {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "token" in (v as object) &&
    typeof (v as { token: unknown }).token === "string" &&
    Object.keys(v as object).length === 1
  );
}

/**
 * PropSchema entry = object whose `category` is `"token"` or `"content"`
 * and whose values are all primitive. These emit inline per the
 * hand-authored `.spec.ts` convention (one line per prop).
 */
function isPropSchemaEntry(v: unknown): boolean {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  if (!("category" in obj)) return false;
  const cat = obj.category;
  if (cat !== "token" && cat !== "content") return false;
  for (const val of Object.values(obj)) {
    if (val !== null && typeof val === "object") return false;
  }
  return true;
}

function isPrimitiveValue(v: unknown): boolean {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

/**
 * Serialize a value to TypeScript source. Formatting rules match the
 * hand-authored `.spec.ts` convention exactly so the byte-match test in
 * `generate-matches-source.test.ts` passes: primitive-only arrays emit
 * inline, object arrays expand, TokenRefs and PropSchemaEntries emit
 * inline, other objects expand. Deterministic — re-running on the same
 * input produces byte-identical output.
 */
function serializeValue(value: unknown, depth: number): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every(isPrimitiveValue)) {
      const parts = value.map((v) => serializeValue(v, depth));
      return `[${parts.join(", ")}]`;
    }
    const inner = value
      .map((item) => `${indentLine(depth + 1)}${serializeValue(item, depth + 1)},`)
      .join("\n");
    return `[\n${inner}\n${indentLine(depth)}]`;
  }

  if (isTokenRef(value)) {
    return `{ token: ${JSON.stringify(value.token)} }`;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";

  if (isPropSchemaEntry(value)) {
    const parts = entries.map(
      ([k, v]) => `${formatKey(k)}: ${serializeValue(v, depth)}`,
    );
    return `{ ${parts.join(", ")} }`;
  }

  const inner = entries
    .map(
      ([k, v]) =>
        `${indentLine(depth + 1)}${formatKey(k)}: ${serializeValue(v, depth + 1)},`,
    )
    .join("\n");
  return `{\n${inner}\n${indentLine(depth)}}`;
}

function componentIdToSlug(id: string): string {
  if (id.length === 0) return id;
  return id[0]!.toLowerCase() + id.slice(1);
}

export function componentVarNameFor(component: Component): string {
  return `${componentIdToSlug(component.id)}Component`;
}

/**
 * Path-in-repo for a component's spec file. v4 collapses the legacy
 * three-files-per-component into two — only `.tsx` and `.spec.ts`.
 */
export function componentSpecFilePathFor(component: Component): string {
  return `packages/rebtel-ds/src/components/${component.id}/${component.id}.spec.ts`;
}

// Back-compat export aliases — the publish-variant API route still
// imports these names. Swap at call site when time permits.
export const variantsFilePathFor = componentSpecFilePathFor;
export const variantsVarNameFor = componentVarNameFor;

export interface GenerateVariantFileOptions {
  component: Component;
}

/**
 * Deterministic serializer for a v4 component's `.spec.ts` file. Output
 * is byte-identical to the hand-authored form at
 * `packages/rebtel-ds/src/components/<Name>/<Name>.spec.ts` — enforced
 * by `generate-matches-source.test.ts`.
 *
 * Stripped (runtime / editor-local state, not committed truth):
 * `draft`, `publishedHistory`, `lastPublishedAt`, `lastPublishedBy`,
 * `baseDraft`. Emitted draft is always the empty snapshot.
 */
export function generateVariantFile({ component }: GenerateVariantFileOptions): string {
  const varName = componentVarNameFor(component);

  const shape: Record<string, unknown> = {
    id: component.id,
    name: component.name,
    paletteGroup: component.paletteGroup,
    axes: component.axes.map((a) => ({
      name: a.name,
      options: [...a.options],
      default: a.default,
    })),
    supportedStates: [...component.supportedStates],
    baseSpec: serializableBaseSpec(component.baseSpec),
    draft: { axisOverrides: [], stateOverrides: [] },
    published: serializableSnapshot(component.published),
    publishedVersion: component.publishedVersion,
  };

  if (component.propSchema) {
    shape.propSchema = component.propSchema;
  }
  if (component.hideFamilyView) {
    shape.hideFamilyView = true;
  }

  const body = serializeValue(shape, 0);

  return `import type { Component } from "@rebtel-atelier/spec";\n\nexport const ${varName}: Component = ${body};\n`;
}

function serializableBaseSpec(spec: PrimitiveSpec): Record<string, unknown> {
  return {
    kind: "primitive",
    id: spec.id,
    type: spec.type,
    props: spec.props as Record<string, PropValue>,
    children: spec.children.map(serializableChild),
  };
}

function serializableChild(node: ComponentSpec): Record<string, unknown> {
  if (node.kind === "primitive") {
    return serializableBaseSpec(node);
  }
  const result: Record<string, unknown> = {
    kind: "component",
    key: node.key,
    componentId: node.componentId,
  };
  if (node.axisSelection !== undefined) {
    result.axisSelection = { ...node.axisSelection };
  }
  if (node.propOverrides !== undefined) {
    result.propOverrides = { ...node.propOverrides };
  }
  return result;
}

function serializableSnapshot(s: ComponentOverrideSnapshot): {
  axisOverrides: { axisSelection: Record<string, string>; props: Record<string, PropValue> }[];
  stateOverrides: { state: string; props: Record<string, PropValue> }[];
} {
  return {
    axisOverrides: s.axisOverrides.map((o) => ({
      axisSelection: { ...o.axisSelection },
      props: { ...o.props },
    })),
    stateOverrides: s.stateOverrides.map((o) => ({
      state: o.state,
      props: { ...o.props },
    })),
  };
}

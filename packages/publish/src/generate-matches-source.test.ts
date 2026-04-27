import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Component } from "@rebtel-atelier/spec";
import { generateVariantFile } from "./generateVariantFile.js";

// The contract for future component additions: when anyone adds a
// component to the DS, `generateVariantFile` must emit the same bytes
// as the hand-authored `.spec.ts`, or this test fails loudly. Re-
// publishing a component should produce a no-op diff — diffs only
// appear when overrides actually changed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

interface SpecCase {
  id: string;
  varName: string;
}

const CASES: SpecCase[] = [
  { id: "Button", varName: "buttonComponent" },
  { id: "ProductCard", varName: "productCardComponent" },
  { id: "CountryPicker", varName: "countryPickerComponent" },
];

function specPathFor(id: string): string {
  return path.join(REPO_ROOT, "packages/rebtel-ds/src/components", id, `${id}.spec.ts`);
}

describe("generateVariantFile — byte-exact match against hand-authored .spec.ts", () => {
  for (const { id, varName } of CASES) {
    it(`${id}.spec.ts matches generator output exactly`, async () => {
      const absPath = specPathFor(id);
      const handAuthored = readFileSync(absPath, "utf8");
      const mod = (await import(absPath)) as Record<string, Component>;
      const component = mod[varName];
      if (!component) {
        throw new Error(
          `Expected export "${varName}" in ${absPath} — check the DS barrel.`,
        );
      }
      const generated = generateVariantFile({ component });
      if (generated !== handAuthored) {
        // Human-readable diff — surface the first divergence so the
        // failure message tells the author what line drifted.
        const handLines = handAuthored.split("\n");
        const genLines = generated.split("\n");
        const maxLen = Math.max(handLines.length, genLines.length);
        const diffLines: string[] = [];
        for (let i = 0; i < maxLen; i++) {
          const h = handLines[i];
          const g = genLines[i];
          if (h !== g) {
            diffLines.push(`line ${i + 1}:`);
            diffLines.push(`  hand: ${JSON.stringify(h)}`);
            diffLines.push(`  gen : ${JSON.stringify(g)}`);
            if (diffLines.length >= 12) break;
          }
        }
        const msg =
          `Generator output for ${id} drifted from hand-authored ${id}.spec.ts.\n` +
          `First divergence(s):\n${diffLines.join("\n")}`;
        expect(generated, msg).toBe(handAuthored);
      }
    });
  }
});

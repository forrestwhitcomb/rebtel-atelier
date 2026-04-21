#!/usr/bin/env node
// Invariant #1: no hex color literals in packages/rebtel-ds/**/*.tsx.
// Tokens only. A hex is a bug.

import { execSync } from "node:child_process";
import { exit } from "node:process";

const TARGET = "packages/rebtel-ds/src/components";
const PATTERN = "#[0-9a-fA-F]{3,8}";

try {
  const out = execSync(`grep -rEn --include='*.tsx' '${PATTERN}' ${TARGET} || true`, {
    encoding: "utf8",
  });
  const hits = out.trim().split("\n").filter(Boolean);
  if (hits.length === 0) {
    console.log(`verify: no hex literals in ${TARGET}/**/*.tsx ✓`);
    exit(0);
  }
  console.error(`verify: found ${hits.length} hex literal(s) in ${TARGET}:`);
  for (const h of hits) console.error("  " + h);
  console.error("Use design tokens instead (see packages/rebtel-ds/src/tokens.ts).");
  exit(1);
} catch (err) {
  console.error("verify: script error:", err?.message ?? err);
  exit(2);
}

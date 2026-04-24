import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import type { Component, Variant } from "@rebtel-atelier/spec";
import {
  buildBranchName,
  buildCommitMessage,
  buildPrBody,
  generateVariantFile,
  variantsFilePathFor,
  type CanvasImpactRow,
} from "@rebtel-atelier/publish";
import {
  closePullRequest,
  createBranch,
  deleteBranch,
  getDefaultBranchSha,
  getFile,
  openPullRequest,
  putFile,
  repoFromEnv,
} from "@/lib/github";

export const runtime = "nodejs";

interface PublishRequestBody {
  /** Post-publish Component state — variant.draft empty, publishedVersion bumped. */
  component: Component;
  /** Pre-publish snapshot of the variant (for diff rendering). */
  variantBefore: Variant;
  /** Post-publish snapshot of the variant (redundant vs component.variants[i], but explicit). */
  variantAfter: Variant;
  /** Per-canvas impact rows computed on the client for PR body + UI. */
  impacts: CanvasImpactRow[];
  /** Display name for the "Context" section of the PR body. */
  editor?: string;
  /** Optional atelier back-link for the PR body. */
  atelierUrl?: string;
}

function shortHash(): string {
  return randomBytes(4).toString("hex");
}

const REQUIRED_ENV = [
  "GITHUB_APP_ID",
  "GITHUB_INSTALLATION_ID",
  "GITHUB_REPO_OWNER",
  "GITHUB_REPO_NAME",
] as const;

function validateEnv(): string[] {
  const missing: string[] = [];
  for (const name of REQUIRED_ENV) {
    if (!process.env[name]) missing.push(name);
  }
  // Private key: accept either the inline PEM (Vercel) or a path to one (dev).
  if (!process.env.GITHUB_PRIVATE_KEY && !process.env.GITHUB_PRIVATE_KEY_PATH) {
    missing.push("GITHUB_PRIVATE_KEY (or GITHUB_PRIVATE_KEY_PATH)");
  }
  return missing;
}

export async function POST(req: Request) {
  const missingEnv = validateEnv();
  if (missingEnv.length > 0) {
    const msg = `Missing env vars: ${missingEnv.join(", ")}`;
    console.error("[publish-variant]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  let body: PublishRequestBody;
  try {
    body = (await req.json()) as PublishRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { component, variantBefore, variantAfter, impacts, editor, atelierUrl } = body;
  if (!component?.id || !variantAfter?.id) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: component.id or variantAfter.id" },
      { status: 400 },
    );
  }

  console.log(
    `[publish-variant] start component=${component.id} variant=${variantAfter.id}`,
  );

  const repo = repoFromEnv();
  const path = variantsFilePathFor(component);
  const fileContent = generateVariantFile({ component });
  const commitMessage = buildCommitMessage({
    component,
    variantBefore,
    variantAfter,
    impacts,
    editor,
    atelierUrl,
  });
  const prTitle = commitMessage.split("\n")[0] ?? `[atelier] ${component.name} update`;
  const prBody = buildPrBody({
    component,
    variantBefore,
    variantAfter,
    impacts,
    editor,
    atelierUrl,
  });
  const branch = buildBranchName(component, variantAfter.id, shortHash());

  // Track what we've done so rollback can un-do each step in reverse.
  const rollback: Array<() => Promise<void>> = [];

  try {
    // 1. Discover the base branch + its tip SHA for the new branch.
    const baseRef = await getDefaultBranchSha(repo);

    // 2. Read the existing file (to get its sha for an update, or null for create).
    const existing = await getFile(repo, path, baseRef.branch);

    // 3. Create the branch off main.
    await createBranch(repo, branch, baseRef.sha);
    rollback.push(async () => {
      // Best-effort cleanup; swallow errors so the outer catch still surfaces
      // the original failure.
      try {
        await deleteBranch(repo, branch);
      } catch {}
    });

    // 4. Commit the updated variants file.
    await putFile(repo, path, fileContent, commitMessage, branch, existing?.sha);

    // 5. Open the PR against the default branch.
    const pr = await openPullRequest(repo, branch, baseRef.branch, prTitle, prBody);
    rollback.push(async () => {
      try {
        await closePullRequest(
          repo,
          pr.number,
          "Closing automatically — Atelier publish transaction rolled back.",
        );
      } catch {}
    });

    return NextResponse.json({
      ok: true,
      pr: { number: pr.number, url: pr.htmlUrl },
      branch,
      commitMessage,
      fileHadExistingSha: Boolean(existing?.sha),
    });
  } catch (err) {
    // Run rollback in reverse order. Each step is best-effort.
    for (let i = rollback.length - 1; i >= 0; i--) {
      await rollback[i]!();
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[publish-variant] failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

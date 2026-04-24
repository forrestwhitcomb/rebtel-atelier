import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import type { Component, ComponentOverrideSnapshot } from "@rebtel-atelier/spec";
import {
  buildBranchName,
  buildCommitMessage,
  buildPrBody,
  componentSpecFilePathFor,
  generateVariantFile,
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
  /** Post-publish Component state (draft empty, publishedVersion bumped). */
  component: Component;
  /** Pre-publish published-overrides snapshot. */
  previousPublished: ComponentOverrideSnapshot;
  /** Post-publish published-overrides snapshot. */
  nextPublished: ComponentOverrideSnapshot;
  previousVersion: number;
  nextVersion: number;
  /** Per-canvas impact rows computed on the client for PR body + UI. */
  impacts: CanvasImpactRow[];
  editor?: string;
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

  const { component, previousPublished, nextPublished, previousVersion, nextVersion, impacts, editor, atelierUrl } = body;
  if (!component?.id || !nextPublished) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: component.id or nextPublished" },
      { status: 400 },
    );
  }

  console.log(
    `[publish-variant] start component=${component.id} v${previousVersion} → v${nextVersion}`,
  );

  const repo = repoFromEnv();
  const path = componentSpecFilePathFor(component);
  const fileContent = generateVariantFile({ component });
  const commitMessage = buildCommitMessage({
    component,
    previousPublished,
    nextPublished,
    previousVersion,
    nextVersion,
    impacts,
    editor,
    atelierUrl,
  });
  const prTitle = commitMessage.split("\n")[0] ?? `[atelier] ${component.name} update`;
  const prBody = buildPrBody({
    component,
    previousPublished,
    nextPublished,
    previousVersion,
    nextVersion,
    impacts,
    editor,
    atelierUrl,
  });
  const branch = buildBranchName(component, shortHash());

  const rollback: Array<() => Promise<void>> = [];

  try {
    const baseRef = await getDefaultBranchSha(repo);
    const existing = await getFile(repo, path, baseRef.branch);
    await createBranch(repo, branch, baseRef.sha);
    rollback.push(async () => {
      try {
        await deleteBranch(repo, branch);
      } catch {}
    });
    await putFile(repo, path, fileContent, commitMessage, branch, existing?.sha);
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
    for (let i = rollback.length - 1; i >= 0; i--) {
      await rollback[i]!();
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[publish-variant] failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

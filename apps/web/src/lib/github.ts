import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

/**
 * GitHub App client — zero-dep, Node built-ins only. Server-side only:
 * this module reads the private key off disk (dev) or from env (prod) and
 * mints JWTs. Never import from a client component.
 *
 * Dev uses `GITHUB_PRIVATE_KEY_PATH` to point at a PEM file outside the
 * repo. Prod (Vercel) uses `GITHUB_PRIVATE_KEY` with the PEM contents
 * inlined — no filesystem there.
 */

const GITHUB_API = "https://api.github.com";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[github] Missing env var: ${name}`);
  return v;
}

function loadPrivateKey(): string {
  const inline = process.env.GITHUB_PRIVATE_KEY;
  if (inline) {
    // Allow newlines stored as literal `\n` in dashboards like Vercel.
    return inline.includes("\\n") ? inline.replace(/\\n/g, "\n") : inline;
  }
  const path = process.env.GITHUB_PRIVATE_KEY_PATH;
  if (!path) {
    throw new Error(
      "[github] Neither GITHUB_PRIVATE_KEY nor GITHUB_PRIVATE_KEY_PATH is set",
    );
  }
  return readFileSync(path, "utf8");
}

function b64url(input: Buffer | string): string {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function mintAppJwt(): string {
  const appId = required("GITHUB_APP_ID");
  const privateKey = loadPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 60, exp: now + 9 * 60, iss: appId };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `${unsigned}.${b64url(sig)}`;
}

// ── Installation token cache ──────────────────────────────
// Installation tokens are valid for ~1 hour. Cache and return the cached
// one until it's within 60s of expiry.

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

let cache: CachedToken | null = null;

async function getInstallationToken(): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt - 60_000 > now) return cache.token;

  const installationId = required("GITHUB_INSTALLATION_ID");
  const jwt = mintAppJwt();

  const res = await fetch(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "rebtel-atelier",
      },
    },
  );
  if (!res.ok) {
    throw new Error(
      `[github] Failed to mint installation token: ${res.status} ${await res.text()}`,
    );
  }
  const data = (await res.json()) as { token: string; expires_at: string };
  cache = { token: data.token, expiresAt: Date.parse(data.expires_at) };
  return cache.token;
}

// ── Typed API wrapper ──────────────────────────────────────

interface GhOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

async function gh<T>(path: string, opts: GhOptions = {}): Promise<T> {
  const token = await getInstallationToken();
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "rebtel-atelier",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const json = (text ? JSON.parse(text) : null) as T & { message?: string };
  if (!res.ok) {
    const message =
      (json && typeof json === "object" && "message" in json && json.message) || text;
    throw new Error(`[github] ${opts.method ?? "GET"} ${path} → ${res.status}: ${message}`);
  }
  return json;
}

// ── High-level helpers ─────────────────────────────────────

export interface RepoRef {
  owner: string;
  name: string;
}

export function repoFromEnv(): RepoRef {
  return {
    owner: required("GITHUB_REPO_OWNER"),
    name: required("GITHUB_REPO_NAME"),
  };
}

export interface GetFileResult {
  sha: string;
  content: string;
}

/** Read a file from the repo. Returns `null` if the file doesn't exist. */
export async function getFile(
  repo: RepoRef,
  path: string,
  ref?: string,
): Promise<GetFileResult | null> {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  try {
    const data = await gh<{ sha: string; content: string; encoding: string }>(
      `/repos/${repo.owner}/${repo.name}/contents/${encodeURIComponent(path)}${query}`,
    );
    if (data.encoding !== "base64") {
      throw new Error(`[github] Unexpected encoding for ${path}: ${data.encoding}`);
    }
    return { sha: data.sha, content: Buffer.from(data.content, "base64").toString("utf8") };
  } catch (err) {
    // 404 → file not in repo yet; treat as absent.
    if (err instanceof Error && err.message.includes("→ 404")) return null;
    throw err;
  }
}

export async function getDefaultBranchSha(repo: RepoRef): Promise<{ branch: string; sha: string }> {
  const repoData = await gh<{ default_branch: string }>(
    `/repos/${repo.owner}/${repo.name}`,
  );
  const ref = await gh<{ object: { sha: string } }>(
    `/repos/${repo.owner}/${repo.name}/git/ref/heads/${repoData.default_branch}`,
  );
  return { branch: repoData.default_branch, sha: ref.object.sha };
}

export async function createBranch(
  repo: RepoRef,
  branchName: string,
  fromSha: string,
): Promise<void> {
  await gh<{ ref: string }>(`/repos/${repo.owner}/${repo.name}/git/refs`, {
    method: "POST",
    body: { ref: `refs/heads/${branchName}`, sha: fromSha },
  });
}

/**
 * Create or update a file on a specific branch. Pass `sha` when updating
 * an existing file, omit it when creating one. Returns the new commit sha.
 */
export async function putFile(
  repo: RepoRef,
  path: string,
  content: string,
  message: string,
  branch: string,
  sha?: string,
): Promise<string> {
  const data = await gh<{ commit: { sha: string } }>(
    `/repos/${repo.owner}/${repo.name}/contents/${encodeURIComponent(path)}`,
    {
      method: "PUT",
      body: {
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
        ...(sha ? { sha } : {}),
      },
    },
  );
  return data.commit.sha;
}

export interface PullRequestResult {
  number: number;
  htmlUrl: string;
  nodeId: string;
}

export async function openPullRequest(
  repo: RepoRef,
  head: string,
  base: string,
  title: string,
  body: string,
): Promise<PullRequestResult> {
  const pr = await gh<{ number: number; html_url: string; node_id: string }>(
    `/repos/${repo.owner}/${repo.name}/pulls`,
    {
      method: "POST",
      body: { head, base, title, body },
    },
  );
  return { number: pr.number, htmlUrl: pr.html_url, nodeId: pr.node_id };
}

export async function closePullRequest(
  repo: RepoRef,
  prNumber: number,
  comment?: string,
): Promise<void> {
  if (comment) {
    await gh(`/repos/${repo.owner}/${repo.name}/issues/${prNumber}/comments`, {
      method: "POST",
      body: { body: comment },
    });
  }
  await gh(`/repos/${repo.owner}/${repo.name}/pulls/${prNumber}`, {
    method: "PATCH",
    body: { state: "closed" },
  });
}

export async function deleteBranch(repo: RepoRef, branchName: string): Promise<void> {
  await gh(`/repos/${repo.owner}/${repo.name}/git/refs/heads/${branchName}`, {
    method: "DELETE",
  });
}

#!/usr/bin/env node
// Verify the GitHub App can authenticate, mint an installation token,
// and see the target repo. Zero deps — Node built-ins only.

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv(path) {
  const text = readFileSync(path, 'utf8');
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnv(resolve(__dirname, '../apps/web/.env.local'));

const {
  GITHUB_APP_ID,
  GITHUB_INSTALLATION_ID,
  GITHUB_PRIVATE_KEY_PATH,
  GITHUB_REPO_OWNER,
  GITHUB_REPO_NAME,
} = process.env;

for (const [name, val] of Object.entries({
  GITHUB_APP_ID,
  GITHUB_INSTALLATION_ID,
  GITHUB_PRIVATE_KEY_PATH,
  GITHUB_REPO_OWNER,
  GITHUB_REPO_NAME,
})) {
  if (!val) {
    console.error(`✗ missing env var: ${name}`);
    process.exit(1);
  }
}

const privateKey = readFileSync(GITHUB_PRIVATE_KEY_PATH, 'utf8');

function b64url(input) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function mintAppJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: now - 60, exp: now + 9 * 60, iss: GITHUB_APP_ID };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(privateKey);
  return `${unsigned}.${b64url(sig)}`;
}

async function gh(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'rebtel-atelier-verify',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`GitHub ${method} ${path} → ${res.status}: ${json?.message ?? text}`);
  }
  return json;
}

(async () => {
  console.log(`App ID:          ${GITHUB_APP_ID}`);
  console.log(`Installation:    ${GITHUB_INSTALLATION_ID}`);
  console.log(`Target repo:     ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`);
  console.log('');

  const jwt = mintAppJwt();

  const app = await gh('/app', { token: jwt });
  console.log(`✓ App auth OK   → "${app.name}" (slug: ${app.slug})`);

  const install = await gh(`/app/installations/${GITHUB_INSTALLATION_ID}`, { token: jwt });
  console.log(`✓ Installation  → account: ${install.account.login}, repo_selection: ${install.repository_selection}`);

  const tokenRes = await gh(
    `/app/installations/${GITHUB_INSTALLATION_ID}/access_tokens`,
    { token: jwt, method: 'POST' }
  );
  const instToken = tokenRes.token;
  console.log(`✓ Installation token minted (expires ${tokenRes.expires_at})`);

  const repos = await gh('/installation/repositories', { token: instToken });
  const names = repos.repositories.map((r) => r.full_name);
  const target = `${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;

  if (names.includes(target)) {
    console.log(`✓ Target repo   → ${target} is in the installation (${names.length} repo(s) total)`);
  } else {
    console.log(`✗ Target repo   → ${target} NOT in installation`);
    console.log(`  Visible repos: ${names.join(', ') || '(none)'}`);
    process.exit(1);
  }

  const repo = await gh(
    `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
    { token: instToken }
  );
  console.log(`✓ Repo read     → default_branch=${repo.default_branch}, private=${repo.private}`);

  console.log('\nAll checks passed. GitHub App auth is wired up end-to-end.');
})().catch((err) => {
  console.error('\n✗', err.message);
  process.exit(1);
});

import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readText = (path: string) => readFile(path, 'utf8');
const release = 'ae836d8400d5784d74af4fecc020f225d1c2d08e';
const candidatePath = 'docs/gf-v4-qualification.candidate.yml';

async function activeWorkflows(): Promise<string[]> {
  try {
    return (await readdir('.github/workflows')).filter((name) => /\.ya?ml$/.test(name)).sort();
  } catch (error) {
    // Git and Bazel runfiles do not retain a directory after its last file is removed.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

describe('inert invitation GF v4 qualification source', () => {
  it('declares real tests and existing compilation/package labels with status-only results', async () => {
    expect(JSON.parse(await readText('.github/lanes.json'))).toEqual({
      schema_version: 3,
      actions: {
        'unit-tests': {
          command: 'test', targets: ['//:test', '//:package_artifact_test'], capability: 'rbe-linux-x86_64',
          result: { mode: 'status-only' },
        },
        'package-check': {
          command: 'build', targets: ['//:pkg'],
          capability: 'rbe-linux-x86_64', result: { mode: 'status-only' },
        },
      },
    });
    const build = await readText('BUILD.bazel');
    expect(build).toMatch(/ts_project\(\s*name = "tinyland_invitation"/);
    expect(build).toMatch(/npm_package\(\s*name = "pkg"/);
    expect(build.match(/npm_package\([\s\S]*?\n\)/)?.[0]).toContain('":tinyland_invitation"');
    expect(build).toMatch(/vitest_bin\.vitest_test\(\s*name = "test"/);
  });

  it('pins the exact released thin caller without execution or publication additions', async () => {
    const candidate = (await readText(candidatePath))
      .split('\n').filter((line) => !line.startsWith('#')).join('\n').trim();
    expect(candidate).toBe(`name: GF v4 qualification

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  id-token: write

jobs:
  qualify:
    if: >-
      github.event_name == 'push' ||
      github.event.pull_request.head.repo.full_name == github.repository
    strategy:
      fail-fast: false
      matrix:
        action: [unit-tests, package-check]
    uses: xoxd-ai/ci-templates/.github/workflows/spoke-ci-v4.yml@${release}
    with:
      action_name: \${{ matrix.action }}`);
  });

  it('keeps the candidate outside the complete active workflow inventory', async () => {
    // This is intentional retirement, not a successful or skipped CI receipt.
    expect(await activeWorkflows()).toEqual([]);
    expect(await readText(candidatePath)).toContain('# INERT SOURCE CANDIDATE');
    const build = await readText('BUILD.bazel');
    expect(build).toContain('".github/workflows/*.yml"');
    expect(build).toContain('".github/workflows/*.yaml"');
    // Keep any reintroduced workflows visible in runfiles, but permit the retired inventory.
    expect(build).toMatch(/glob\(\s*\["\.github\/workflows\/\*\.yml", "\.github\/workflows\/\*\.yaml"\],\s*allow_empty = True,?\s*\)/);
  });

  it('retains graph-registered runtime and metadata checks after provider retirement', async () => {
    const build = await readText('BUILD.bazel');
    const testBlock = build.match(/vitest_bin\.vitest_test\([\s\S]*?\n\)/)?.[0];
    expect(testBlock).toBeDefined();
    for (const path of ['BUILD.bazel', 'MODULE.bazel', 'package.json']) {
      expect(testBlock).toContain(`"${path}"`);
    }
    expect(testBlock).toContain('"tests/**/*.test.ts"');
    expect(testBlock).toContain('"run"');
    const metadataContract = await readText('tests/version-parity.test.ts');
    expect(metadataContract).toContain('keeps npm, Bzlmod, and Bazel package versions aligned');
    expect(metadataContract).toContain('keeps the translated npm repository package-scoped');
    for (const path of ['tests/invitation.test.ts', 'tests/durable-acceptance.test.ts']) {
      expect(await readText(path)).toContain('describe(');
    }
  });

  it('does not expose npm or GitHub Packages delivery configuration', async () => {
    const manifest = JSON.parse(await readText('package.json'));
    expect(manifest.name).toBe('@tummycrypt/tinyland-invitation');
    expect(manifest.publishConfig).toBeUndefined();
    for (const hook of ['prepublish', 'prepublishOnly', 'publish', 'postpublish']) {
      expect(manifest.scripts?.[hook]).toBeUndefined();
    }
    expect(manifest.scripts.build).toBe('tsc');
    expect(manifest.scripts.typecheck).toBe('tsc --noEmit');
    expect(manifest.scripts['check:package']).toBe('publint');
    expect(JSON.stringify(manifest)).not.toMatch(/registry\.npmjs\.org|npm\.pkg\.github\.com|(?:npm|pnpm) publish/);
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      expect(Object.keys(manifest[field] ?? {}).filter((name) => /^@(tummycrypt|tinyland|tinyland-inc|xoxd-ai)\//.test(name)))
        .toEqual([]);
    }
  });

  it('runs locked publint on the actual Bazel package without repacking or publication', async () => {
    const build = await readText('BUILD.bazel');
    const artifactRule = build.match(/js_test\(\s*name = "package_artifact_test",([\s\S]*?)\n\)/)?.[1];
    expect(artifactRule).toContain('entry_point = "scripts/check-package-artifact.mjs"');
    expect(artifactRule).toContain('args = ["$(rootpath :pkg)"]');
    for (const input of [':pkg', ':node_modules/publint', 'package.json', 'scripts/check-package-artifact.mjs']) {
      expect(artifactRule).toContain(`"${input}"`);
    }
    const testRule = build.match(/vitest_bin\.vitest_test\([\s\S]*?\n\)/)?.[0];
    expect(testRule).toContain('"scripts/check-package-artifact.mjs"');
    const packageRule = build.match(/npm_package\([\s\S]*?\n\)/)?.[0];
    expect(packageRule).toContain('publishable = False');
    const script = await readText('scripts/check-package-artifact.mjs');
    expect(script).toContain('await publint({ pkgDir: packageDirectory, pack: false, strict: false })');
    expect(script).toContain("message.type === 'error'");
    expect(script).not.toMatch(/child_process|execSync|spawnSync|npm publish|pnpm publish/);
  });
});

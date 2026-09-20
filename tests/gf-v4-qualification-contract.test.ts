import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const readText = (path: string) => readFile(path, 'utf8');
const release = '32e39ced0008edf4564ebeb173a5e8fbf069e28f';
const candidatePath = 'docs/gf-v4-qualification.candidate.yml';

describe('inert invitation GF v4 qualification source', () => {
  it('declares real tests and existing compilation/package labels with status-only results', async () => {
    expect(JSON.parse(await readText('.github/lanes.json'))).toEqual({
      schema_version: 3,
      actions: {
        'unit-tests': {
          command: 'test', targets: ['//:test'], capability: 'rbe-linux-x86_64',
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
    const workflows = (await readdir('.github/workflows')).filter((name) => /\.ya?ml$/.test(name)).sort();
    expect(workflows).toEqual(['ci.yml', 'publish.yml']);
    for (const name of workflows) {
      expect(await readText(`.github/workflows/${name}`)).not.toContain('spoke-ci-v4.yml');
    }
    expect(await readText(candidatePath)).toContain('# INERT SOURCE CANDIDATE');
    const build = await readText('BUILD.bazel');
    expect(build).toContain('".github/workflows/*.yml"');
    expect(build).toContain('".github/workflows/*.yaml"');
  });

  it('retains existing legacy package gates without claiming status-only publication', async () => {
    for (const path of ['.github/workflows/ci.yml', '.github/workflows/publish.yml']) {
      const workflow = await readText(path);
      expect(workflow).toContain('js-bazel-package.yml@21e0093a7586931ee69d716387e00556c6da7738');
      expect(workflow).toContain('typecheck_command: pnpm typecheck');
      expect(workflow).toContain('unit_test_command: pnpm test');
      expect(workflow).toContain('package_check_command: pnpm check:package');
      expect(workflow).toContain('bazel_targets: "//:pkg //:test"');
      expect(workflow).toContain('github_package_name: "@tummycrypt/tinyland-invitation"');
    }
  });
});

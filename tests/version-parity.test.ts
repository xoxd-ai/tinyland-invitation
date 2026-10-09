import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('release version parity', () => {
  it('keeps npm, Bzlmod, and Bazel package versions aligned', () => {
    const packageVersion = JSON.parse(readRepoFile('package.json')).version as string;
    const moduleFile = readRepoFile('MODULE.bazel');
    const buildFile = readRepoFile('BUILD.bazel');
    const moduleBlock = moduleFile.match(/module\([\s\S]*?\n\)/)?.[0];
    const npmPackageBlock = buildFile.match(/npm_package\([\s\S]*?\n\)/)?.[0];

    expect(moduleBlock).toContain(`version = "${packageVersion}"`);
    expect(npmPackageBlock).toContain(`version = "${packageVersion}"`);
  });

  it('keeps the translated npm repository package-scoped for cross-module composition', () => {
    const repository = 'tummycrypt_tinyland_invitation_npm';
    const moduleFile = readRepoFile('MODULE.bazel');
    const buildFile = readRepoFile('BUILD.bazel');
    const translationBlocks = [...moduleFile.matchAll(/npm\.npm_translate_lock\([\s\S]*?\n\)/g)];

    expect(translationBlocks).toHaveLength(1);
    expect(translationBlocks[0]?.[0]).toContain(`name = "${repository}"`);
    expect([...moduleFile.matchAll(/use_repo\(\s*npm\b[^)]*\)/g)].map(([call]) => call))
      .toEqual([`use_repo(npm, "${repository}")`]);
    expect(buildFile).toContain(`load("@${repository}//:defs.bzl", "npm_link_all_packages")`);
    expect(buildFile).toContain(`load("@${repository}//:vitest/package_json.bzl", vitest_bin = "bin")`);
    expect(buildFile).not.toMatch(/\bload\(\s*["']@{1,2}npm\/\//);

    const testBlock = buildFile.match(/vitest_bin\.vitest_test\([\s\S]*?\n\)/)?.[0];
    expect(testBlock).toContain('"MODULE.bazel"');
    expect(testBlock).toContain('"BUILD.bazel"');
  });
});

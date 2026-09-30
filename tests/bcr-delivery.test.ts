import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

describe('BCR-only delivery authority (TIN-89, TIN-1629)', () => {
  it('keeps package-manager publication hooks and configuration absent', () => {
    const manifest = JSON.parse(read('package.json'));
    expect(manifest.publishConfig).toBeUndefined();
    for (const hook of ['prepublish', 'prepublishOnly', 'publish', 'postpublish']) {
      expect(manifest.scripts?.[hook]).toBeUndefined();
    }
    const packageRule = read('BUILD.bazel').match(/npm_package\([\s\S]*?\n\)/)?.[0];
    expect(packageRule).toContain('publishable = False');
  });

  it('has only validation workflows with no release event or provider publisher', () => {
    const directory = new URL('../.github/workflows/', import.meta.url);
    const files = readdirSync(directory).filter((name) => /\.ya?ml$/.test(name)).sort();
    expect(files).toEqual(['ci.yml']);
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/^\s+dry_run: true$/m);
    expect(ci).not.toMatch(/^\s+release:/m);
    expect(ci).not.toMatch(/\bNPM_TOKEN\b|github_package_name:|\bnpm\s+publish\b/);
  });
});

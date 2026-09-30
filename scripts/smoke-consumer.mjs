import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Use an operator-selected stable workspace so repeated proofs reuse the pool.
const source = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const version = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')).version;
const workspaceArg = process.argv[2];
if (!workspaceArg) throw new Error('Usage: pnpm smoke:consumer <dedicated-consumer-workspace>');
const workspace = resolve(workspaceArg);
if (workspace === source) throw new Error('The consumer must be separate from the producer');
const marker = join(workspace, '.invitation-consumer-smoke');
if (existsSync(workspace) && readdirSync(workspace).length && !existsSync(marker)) {
  throw new Error('Refusing to overwrite a workspace without the smoke marker');
}
mkdirSync(workspace, { recursive: true });
writeFileSync(marker, 'tinyland-invitation namespace consumer smoke\n');
for (const name of ['.bazelversion', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
  copyFileSync(join(source, name), join(workspace, name));
}
writeFileSync(join(workspace, 'MODULE.bazel'), `module(name = "invitation_namespace_consumer")
bazel_dep(name = "tummycrypt_tinyland_invitation", version = ${JSON.stringify(version)})
local_path_override(module_name = "tummycrypt_tinyland_invitation", path = ${JSON.stringify(source)})
bazel_dep(name = "aspect_rules_js", version = "2.9.1")
npm = use_extension("@aspect_rules_js//npm:extensions.bzl", "npm")
npm.npm_translate_lock(
    name = "npm",
    data = ["//:package.json", "//:pnpm-workspace.yaml"],
    pnpm_lock = "//:pnpm-lock.yaml",
)
use_repo(npm, "npm")
`);
writeFileSync(join(workspace, 'BUILD.bazel'), 'exports_files(["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"])\n');
for (const args of [['mod', 'graph'], ['build', '@tummycrypt_tinyland_invitation//:pkg']]) {
  const result = spawnSync('bazelisk', args, { cwd: workspace, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

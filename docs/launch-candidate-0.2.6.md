# Invitation 0.2.6: existing-admin launch candidate

Status: unreleased, source/version preparation only (TIN-2716). The 2026-09-20 UTC
operator decision permits a separate backward-compatible candidate for the
existing-admin, single-writer mothership. It supersedes the earlier operational
hold only for this preparation; invitation 0.3/auth 0.8 breaking work remains
held. No held PR is adopted, and no push, tag, publication, workflow activation,
consumer pin change or deployment is authorized here.

The narrowed scope is recorded in TIN-2716 comment
`6d68fbe2-d37a-4ea3-8d80-2927dec2979b`.

## Occupancy and compatibility baseline

Read-only checks at 2026-09-22 01:54:36 UTC found canonical
`xoxd-ai/tinyland-invitation` main at
`649c6587cc99538083fa49c30734b7769b4b3ea0`; the released `v0.2.5` source remains
`7687bb49b5e3f8719e874946ba1586f4d0d0b83a`. Exact tags `v0.2.6` and `0.2.6`,
the `v0.2.6` release and the active BCR 0.2.6 directory were absent. At registry
main `09d1f4f56be12bb0c52b2b40c88560ea6cefebac`, module metadata and directories
listed 0.2.2 through 0.2.5 with no yanks. These checks do not reserve a version;
recheck source tags/releases and the append-only BCR before immutable release.

The 2026-08-27 correction in TIN-89/TIN-1629 makes Bzlmod/BCR the sole first-party
delivery authority. npmjs and GitHub Packages occupancy, credentials and provider
publication are not release prerequisites or fallbacks. Historical provider
artifacts remain untouched; their absence or accessibility does not block 0.2.6.

Compared with that released source and its tracked declarations, reviewed source
`8c1a394d5eb13209ef3e4b0a2b3d68557bf15a85` adds an optional
`InvitationConfig.durableAcceptance`, `InvitationService.recoverPendingAcceptances`,
receipt types and optional result fields. Existing callers need no new required
configuration or arguments. Without the opt-in, the legacy acceptance path
remains; it does not gain crash recovery. The default-path security correction
rejects inactive invitations in pending lookup/acceptance and pending lists.

The following released contracts are intentionally retained, not silently
replaced with the held breaking design:

- `InvitationCreateOptions.createdBy`, optional `createdByRole` and
  `createdByHandle` remain caller inputs. `AdminRole` remains `string`.
- `canCreateInviteForRole` remains a replaceable hook, not an additional mandatory
  package policy. Without it, the existing hierarchy normalizes role spelling,
  rejects missing/unknown roles and requires the creator to strictly outrank the
  target. The package does not authenticate those caller-supplied assertions.
- Creation still returns the invitation, temporary TOTP secret and QR result.
  Initial acceptance can still return `tempTotpSecret`; the new user remains
  `totpEnabled: false` and `needsOnboarding: true`. Temporary invitation material
  is not proof of possession, verified MFA or a fully onboarded session.
- Durable receipt replay returns only the stable receipt/user ID and
  `replayed: true`, never a user snapshot or temporary factor secret. Consumers
  opting in must branch before session creation and use ordinary login/MFA.

## App boundary and state contract

The mothership must derive creation authority from the current durable principal,
not form fields or cached session roles; its replacement creation hook must
enforce current role policy. Durable acceptance's `canAcceptInvitation` must
re-read the current active, completed creator and current target-role authority.
Revocation, extension, listing and other management entrypoints still require
app authorization. The package does not provide package-wide trusted RBAC.

One writer process, a shared reentrant mutation gate, persistent private journal,
atomic/fsynced projection writes and recovery before protected auth reads are
required. Startup and failed-projection recovery must fail closed; retained
tombstones and receipts must not be discarded. This is not a distributed lock,
cross-replica CAS, new-user bootstrap or external identity-provider integration.
After durable writes, reverting to 0.2.5 without compatible recovery is not a
state-safe rollback. See the README for the exact gate and receipt contract.

## Bazel composition correction

The 0.2.6 source candidate also corrects the TIN-1438 composition defect retained
by released 0.2.5: `npm_translate_lock`, `use_repo` and both BUILD loads now use
`tummycrypt_tinyland_invitation_npm`, not the unscoped `npm` repository. This
matches the canonical auth/content/ActivityPub convention and the existing
admin-user-service 0.2.3 BCR correction. Historical registry entries are not
rewritten, and dependency versions, package labels and runtime API are unchanged.

The existing version-parity test now checks the exact translation/import/load
mapping, forbids bare `@npm` loads and verifies that MODULE/BUILD are included in
its Bazel runfiles. This source regression does not itself prove consumer graph
evaluation or remote execution; those remain part of the same release
qualification, not an additional operational hold.

## BCR-only CI retirement and current-main reconciliation

The current canonical main advance from the released baseline touches only
`.github/workflows/ci.yml` and `publish.yml`: CT1 (PR 27) repoints their template
to `xoxd-ai/ci-templates@v2.14.1`, and GP2 (PR 28) removes `github_package_name`.
It does not change runtime source, API, package version or module graph. The
remaining publish workflow still carries npm publication inputs and `NPM_TOKEN`.

This candidate completes provider retirement by deleting both legacy workflow
files, package `publishConfig` and the `prepublishOnly` hook. It does not undo GP2,
add a competing carrier or rewrite historical releases. Reconcile those two
workflow delete/modify overlaps when consolidating the reviewed candidate onto
current main; the rest of the existing recovery source is preserved.

TIN-89 examples `vite-plugin-skeleton-colors` PR 9, `vite-plugin-a11y` PR 11 and
`tinyland-color-utils` PR 11 support removing provider workflows/configuration,
but remain open source carriers with an unreleased canary pin. Their active
caller is not copied here. The enrollment skill requires retirement without a
legacy fallback; `.github/lanes.json` and the documented caller remain inert
until the root integration lane revalidates the released immutable contract and
admitted binding. No active workflow is intentionally present in this source
candidate. That absence is a visible qualification gap, not green or skipped CI.

The `//:test` graph still includes invitation/recovery, version/namespace and
workflow-retirement contracts. `//:pkg` still depends on TypeScript compilation;
the plan requires actual `test //:test //:package_artifact_test` and `build //:pkg`,
not a build-only test target. The new artifact target preserves packaging lint
coverage using locked `publint` against the actual assembled `//:pkg` directory
with `pack: false` and errors-only failure. It also checks manifest identity,
version, exports and nonempty declared runtime/type files, without importing
package runtime or adding dependencies. No check is replaced with a successful
no-op or a new publisher; the package rule explicitly keeps `publishable = False`.

The documented caller now pins released ci-templates v5.1.1 commit
`ae836d8400d5784d74af4fecc020f225d1c2d08e`. Its `--result-dir` repair does not
change the actions' status-only result contract or prove installed admission.
It remains outside `.github/workflows/` and inactive.

## Artifact treatment and remaining release gates

This metadata pass aligns `package.json`, `MODULE.bazel` and `BUILD.bazel` at
provisional 0.2.6 without changing runtime/API source. `package.json` exports
tracked `dist/`; existing declarations/JavaScript were generated with the
repository's TypeScript build for the recovery commits. They contain no package
version constant and remain untouched in this metadata-only pass. Do not hand
edit them. Bazel `//:pkg` independently includes `//:tinyland_invitation` compiler
output; tracked dist is not evidence that the Bazel artifact is qualified.

The metadata follow-up, before the npm repository rename, passed the two focused
version/qualification suites (5 cases) on 2026-09-20 UTC. Managed Bazel 8.1.1 strict dependency replay first
correctly rejected the old root-version extension digests. Dependency-only
update regenerated exactly three `usagesDigest` values (Node, pnpm and
TypeScript); no dependency pins, registry hashes or generated repository specs
changed. Subsequent `--lockfile_mode=error` replay passed without changing lock
SHA-256 `473be9e2c9693f1d6476afb51d0bcd92f48a3e32b79c891eed5f822a40a6823b`.
These are local diagnostics, not Bazel build/test or remote GF execution.

That lock receipt predates the composition correction and is historical for the
renamed repository inputs. The coordinator will refresh the real lock and run
the focused regression in the serialized diagnostic slot; no lock bytes are
hand-edited or inherited as proof of the new graph.

The earlier lock/runtime diagnostics remain historical evidence, not receipts
for the namespace and BCR-only metadata changes. No local test, build, Bazel or
Nix execution is authorized in this retirement pass. The root lane coordinates
real lock refresh/replay with pinned Bazel 8.1.1, exact-source GF-backed
`test //:test //:package_artifact_test` and `build //:pkg`, artifact/metadata qualification and isolated
external BCR `//:pkg` consumer proof. Lock bytes are not hand-edited or fabricated.
The retained internal pnpm/publint/compiler commands are build mechanics, not a
provider publication path or replacement evidence.

Remaining integration work is reviewed consolidation onto current main, released
and admitted GF qualification, current-principal/pending-MFA app proof, immutable
source-version availability and an append-only BCR transaction bound to the exact
source archive digest. Consumer pins and runtime rollout follow that qualified
BCR release separately. There is no npm/GitHub Packages publication prerequisite,
new provider publisher or additional operational hold.

# Invitation GF v4 qualification: inert source preparation

This TIN-2716 source candidate is not an activated workflow, enrollment, remote
execution receipt or package release. Installation coordination remains with
TIN-2611. Keep the caller under `docs/`, not `.github/workflows/`.

## Released contract and existing targets

`.github/lanes.json` uses ActionPlan/v4 schema 3 with two status-only actions:

| Action | Existing Bazel command and labels |
| --- | --- |
| `unit-tests` | `test //:test //:package_artifact_test` |
| `package-check` | `build //:pkg` |

`//:pkg` already depends on the existing TypeScript compilation target
`//:tinyland_invitation`; no redundant compiler action or nonexistent
`//:typecheck` label is added. The test action runs tests rather than
merely building a test target. Both actions request abstract
`rbe-linux-x86_64` demand, not a runner or an assertion of admitted supply.
The plan contains no endpoints, credentials, tenant/repository identity,
publication or deployment authority.

The inert caller pins the released ci-templates v5.1.1 commit
`ae836d8400d5784d74af4fecc020f225d1c2d08e`, not template main or a proposed
publisher interface. It admits only main pushes and same-repository PRs targeting
main, with `contents: read` and `id-token: write`; no manual dispatch, secrets,
tag trigger or package-write permission is added. The released caller selects
the exact push/PR head revision, not a synthetic PR merge revision. Relative to
the prior v5.1.0 caller, this release passes the compiled client its isolated
`--result-dir`. Both actions remain status-only: that directory is not an export,
publication or admission receipt. The installed binding still requires independent
verification before any activation.

Status-only means terminal status, not exported package files. Building
`//:pkg` neither exports a qualified artifact nor runs `publint` or publishes
it. The graph-owned `//:package_artifact_test` supplies its actual assembled
directory to the existing locked `publint` 0.3.18 API with `pack: false` and
`strict: false`: it never repacks, imports target runtime or uses source `dist`
as a fallback. It logs findings and fails on errors, preserving the retired
CLI gate's severity. It also checks source/artifact manifest parity and nonempty
declared ESM/type files. This packaging check does not typecheck declaration
closure or replace an isolated external consumer proof.

Under corrected TIN-89/TIN-1629 authority, the legacy `ci.yml`/`publish.yml`
provider paths and package publishing configuration are retired, not retained as
a fallback. The candidate intentionally has no active workflow pending the
released/admitted GF binding. Missing qualification is not a successful check.
At preparation commit `8c1a394d5eb13209ef3e4b0a2b3d68557bf15a85`, package/module/
Bazel versions, dependencies and generated `dist` were unchanged. The subsequent
[0.2.6 source candidate](launch-candidate-0.2.6.md) adds release metadata,
package-scoped Bazel composition and BCR-only CI retirement;
its changed inputs require fresh lock replay and package qualification before
release, not reuse of this preparation receipt as execution proof.

## Local diagnostics and source lock

Focused contracts in `tests/gf-v4-qualification-contract.test.ts` verify the
closed plan, existing labels, inert caller, required graph-registered runtime and
metadata tests, and absence of provider publication configuration. Their
inputs include the actual workflow-file glob so an added active workflow cannot
be invisible to the Bazel test's runfiles.

Validate with the full JSON Schema engine and the exact released files:

```text
python3 <reviewed-v5.1.1-checkout>/scripts/manifest-schema-validate.py \
  <reviewed-v5.1.1-checkout>/schemas/lanes.schema.json .github/lanes.json
```

Use commit `ae836d8400d5784d74af4fecc020f225d1c2d08e` and Python with
`jsonschema`; the explicit schema path matters because `--schemas-dir` routes
repository-manifest versions, not this action plan. Released schema SHA-256:
`4fef58645b8cd367a4336a66eaee629388c8a949a06d85becc97cfc1be82e3b8`.
Released validator SHA-256:
`759f343aadf815a665b6c8319fbc92015a21ea4cf647b1e549f50d3c12b22468`.
Both released files have the same bytes as the previously reviewed schema and
validator. That static hash comparison is not a fresh validation of the changed
plan or an execution receipt.

GF also needs the actual source-bound `MODULE.bazel.lock`. This repository pins
Bazel 8.1.1; the integration lane coordinates real lock generation and strict
replay. This source-only pass authorizes no local Bazel/test/build/Nix execution.
Do not invent lock bytes, copy another package's
lock, weaken transport trust or claim dependency resolution as remote execution.
The preparation outcome below must distinguish generated source data from
target execution and provider qualification.

## Activation remains a separate reviewed transaction

Before moving the candidate into the active workflow directory, verify the
actual committed lock; current organization App installation, signed owner and
tenant documents and revocations; admitted renamed workflow/ref/event/capability
policy; installed client/provider receipts, joined supply catalog and eligible
workers. Source declarations confer none of these authorities.

Require fresh Actions OIDC and applicable independent App PR admission. The
resolver must bind the exact source, plan/action, module lock, installed Bazel
digest and provider-selected closure. Prove remote Execute or authenticated
cache-hit evidence with measurement attribution; runner pickup and a green
Actions badge alone do not qualify execution. No local/hosted/cache-endpoint
fallback or caller-built binding substitutes for missing authority.

BCR delivery requires exact-source test/build/artifact and external consumer
qualification, an immutable source tag/release and append-only registry entry
with the source archive digest. npmjs/GitHub Packages publication or occupancy
is not a gate. This inert preparation introduces no provider publisher and does
not release or change application/runtime authority.

## Preparation outcome

On 2026-09-19, the exact released schema validator passed and the focused local
qualification/version-parity diagnostics passed (2 files, 5 tests). The existing
managed launcher selected Bazel 8.1.1; `bazel --batch mod deps
--lockfile_mode=update` generated the real lock and the same command with
`--lockfile_mode=error` succeeded without changing its bytes.

At preparation commit `8c1a394`, the source lock had format 18, 179 registry-file hashes from
`bcr.bazel.build`, and SHA-256
`825388f8560502c57b4f3cc620cf5ec97d53050c004865bec3a1867a2fc816bb`.
A structural audit found no machine-local paths, credential-bearing URLs or
nonempty credential fields. Bazel repository-label `private/` segments are
public source labels, not local filesystem paths. Only the generated lock was
unignored; dependency declarations and pins remain unchanged.

These Darwin-local dependency and contract diagnostics do not establish a Linux
execution closure, worker admission or a GF receipt. No Bazel build/test, GF
invocation, workflow activation, release, tag or remote write was performed.

The later 0.2.6 metadata candidate required three regenerated root-version
extension usage digests. Its new lock and passing strict replay are recorded
in [the candidate note](launch-candidate-0.2.6.md); the hash above is historical,
not the current candidate's lock identity.

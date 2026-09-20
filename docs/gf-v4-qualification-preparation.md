# Invitation GF v4 qualification: inert source preparation

This TIN-2716 source candidate is not an activated workflow, enrollment, remote
execution receipt or package release. Installation coordination remains with
TIN-2611. Keep the caller under `docs/`, not `.github/workflows/`.

## Released contract and existing targets

`.github/lanes.json` uses ActionPlan/v4 schema 3 with two status-only actions:

| Action | Existing Bazel command and labels |
| --- | --- |
| `unit-tests` | `test //:test` |
| `package-check` | `build //:pkg` |

`//:pkg` already depends on the existing TypeScript compilation target
`//:tinyland_invitation`; no redundant compiler action or nonexistent
`//:typecheck` label is added. The test action runs tests rather than
merely building a test target. Both actions request abstract
`rbe-linux-x86_64` demand, not a runner or an assertion of admitted supply.
The plan contains no endpoints, credentials, tenant/repository identity,
publication or deployment authority.

The inert caller pins the released ci-templates v5.1.0 commit
`32e39ced0008edf4564ebeb173a5e8fbf069e28f`, not template main or a proposed
publisher interface. It admits only main pushes and same-repository PRs targeting
main, with `contents: read` and `id-token: write`; no manual dispatch, secrets,
tag trigger or package-write permission is added. The released caller selects
the exact push/PR head revision, not a synthetic PR merge revision.

Status-only means terminal status, not exported package files. Building
`//:pkg` neither exports a qualified artifact nor runs `publint` or publishes
it. Existing `ci.yml` and `publish.yml`, their `21e0093` legacy template pin,
release events, package checks and publication permissions stay unchanged.
Their results are not GF v4 evidence or a fallback for a refused v4 action.
Package/module/Bazel versions, dependencies and generated `dist` stay unchanged.

## Local diagnostics and source lock

Focused contracts in `tests/gf-v4-qualification-contract.test.ts` verify the
closed plan, existing labels, inert caller and preserved legacy gates. Their
inputs include the actual workflow-file glob so an added active workflow cannot
be invisible to the Bazel test's runfiles.

Validate with the full JSON Schema engine and the exact released files:

```text
python3 <reviewed-v5.1.0-checkout>/scripts/manifest-schema-validate.py \
  <reviewed-v5.1.0-checkout>/schemas/lanes.schema.json .github/lanes.json
```

Use commit `32e39ced0008edf4564ebeb173a5e8fbf069e28f` and Python with
`jsonschema`; the explicit schema path matters because `--schemas-dir` routes
repository-manifest versions, not this action plan. Released schema SHA-256:
`4fef58645b8cd367a4336a66eaee629388c8a949a06d85becc97cfc1be82e3b8`.
Released validator SHA-256:
`759f343aadf815a665b6c8319fbc92015a21ea4cf647b1e549f50d3c12b22468`.

GF also needs the actual source-bound `MODULE.bazel.lock`. This repository pins
Bazel 8.1.1; use its managed launcher for dependency-only `mod deps`, then replay
with `--lockfile_mode=error`. Do not invent lock bytes, copy another package's
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

Publication requires separate artifact qualification, original package gates,
immutable version, BCR registration and explicit release authority. This inert
preparation does not publish or change application/runtime authority.

## Preparation outcome

On 2026-09-19, the exact released schema validator passed and the focused local
qualification/version-parity diagnostics passed (2 files, 5 tests). The existing
managed launcher selected Bazel 8.1.1; `bazel --batch mod deps
--lockfile_mode=update` generated the real lock and the same command with
`--lockfile_mode=error` succeeded without changing its bytes.

The committed source lock has format 18, 179 registry-file hashes from
`bcr.bazel.build`, and SHA-256
`825388f8560502c57b4f3cc620cf5ec97d53050c004865bec3a1867a2fc816bb`.
A structural audit found no machine-local paths, credential-bearing URLs or
nonempty credential fields. Bazel repository-label `private/` segments are
public source labels, not local filesystem paths. Only the generated lock was
unignored; dependency declarations and pins remain unchanged.

These Darwin-local dependency and contract diagnostics do not establish a Linux
execution closure, worker admission or a GF receipt. No Bazel build/test, GF
invocation, workflow activation, release, tag or remote write was performed.

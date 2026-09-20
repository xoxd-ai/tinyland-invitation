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

Read-only checks on 2026-09-20 UTC found canonical `xoxd-ai/tinyland-invitation` main
and tag `v0.2.5` at `7687bb49b5e3f8719e874946ba1586f4d0d0b83a`. Its tags and
releases contained no 0.2.6. The active `xoxd-ai/bazel-registry` module directory
and metadata listed 0.2.2 through 0.2.5, not 0.2.6. These checks do not reserve
the version: GitHub Packages occupancy remains unresolved, and all surfaces
must be rechecked before any immutable release. No credential/scope changes
were made to resolve that uncertainty.

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

## Artifact treatment and remaining release gates

This metadata pass aligns `package.json`, `MODULE.bazel` and `BUILD.bazel` at
provisional 0.2.6 without changing runtime/API source. `package.json` exports
tracked `dist/`; existing declarations/JavaScript were generated with the
repository's TypeScript build for the recovery commits. They contain no package
version constant and remain untouched in this metadata-only pass. Do not hand
edit them. Bazel `//:pkg` independently includes `//:tinyland_invitation` compiler
output; tracked dist is not evidence that the Bazel artifact is qualified.

The metadata follow-up passed the two focused version/qualification suites
(5 cases) on 2026-09-20 UTC. Managed Bazel 8.1.1 strict dependency replay first
correctly rejected the old root-version extension digests. Dependency-only
update regenerated exactly three `usagesDigest` values (Node, pnpm and
TypeScript); no dependency pins, registry hashes or generated repository specs
changed. Subsequent `--lockfile_mode=error` replay passed without changing lock
SHA-256 `473be9e2c9693f1d6476afb51d0bcd92f48a3e32b79c891eed5f822a40a6823b`.
These are local diagnostics, not Bazel build/test or remote GF execution.

The earlier 0.2.5-input lock and runtime diagnostics remain historical evidence.
The full runtime/build/artifact checks were not repeated in this metadata pass;
before release, revalidate the changed source inputs through the managed
entrypoints and qualify the canonical remote artifact:

```text
pnpm exec vitest run tests/invitation.test.ts tests/durable-acceptance.test.ts tests/version-parity.test.ts tests/gf-v4-qualification-contract.test.ts
pnpm exec tsc --noEmit
pnpm run build
git diff --exit-code -- dist
pnpm check:package
bazel --batch mod deps --lockfile_mode=error
```

If the strict lock replay reports changed inputs, regenerate with the same pinned
Bazel 8.1.1 in update mode, audit the actual diff and replay in error mode; do not
fabricate lock bytes. Local compatibility/package diagnostics do not replace
canonical remote GF-backed test/build and artifact qualification. The GF caller
remains inert. Existing legacy CI/publish workflows and registry configuration
are unchanged; release ownership must resolve the actual GitHub Packages/BCR
publication path and any legacy npm publication behavior before authorization.

Remaining gates are immutable-version occupancy, current-principal and pending-MFA
app integration proof, exact-source remote qualification and the reviewed package
publication/BCR transaction. Consumer pinning and runtime rollout are separate
steps after those gates, not implied by this candidate version.

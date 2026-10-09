# Changelog

## 0.4.0

Reconciles the reviewed `candidate/nonprod-20260924-170b52743ef9` lineage (the
invitation source the Mothership writer image already builds through
`--override_module`) onto 0.3.0, so consumers can resolve it from the registry
(TIN-3692 RU11). Additive for 0.3.0 consumers.

- `InvitationConfig.durableAcceptance` (optional, single-process, file-native
  acceptance journal), `InvitationService.recoverPendingAcceptances()` and
  `AcceptResult.replayed`. Replay never restores old user security state and
  omits user and temporary-factor material.
- Inactive invitations are excluded from pending lookup, acceptance and the
  pending list; corrupt or missing established user authority fails closed.
- Legacy username aliases are reserved, and committed issuance is reported
  truthfully.
- The new acceptance and expiry paths read the internal `seams.ts` clock that
  0.3.0 introduced (system time unless the NODE_ENV=test testing build installs
  a clock); no public clock option is added.
- Release surface follows 0.3.0 (validation-only `ci.yml`, `publishable =
  False`, no publish hooks) plus `//:package_artifact_test` on the real
  `//:pkg`. The candidate's inert GF v4 lane file and its workflow-absence
  contract test are not carried over; the inert plan documents stay.

## 0.2.6 — unreleased launch candidate (folded into 0.4.0)

Source/version preparation for TIN-2716, separate from the held invitation 0.3
and auth 0.8 breaking train. See [scope and remaining gates](docs/launch-candidate-0.2.6.md).

- Add optional single-process, file-native invitation acceptance recovery with
  stable receipts, token/handle reservation and replay that never restores old
  user security state. No database or distributed compare-and-set is introduced.
- Fail closed on corrupt/missing established user authority and applied history
  with an empty user projection, without resurrecting accounts or enabling bootstrap.
- Exclude inactive invitations from pending lookup, acceptance and pending lists.
- Scope the translated npm repository as `tummycrypt_tinyland_invitation_npm`
  throughout MODULE/BUILD so the package does not reuse bare `@npm` in a composed
  Bzlmod graph (TIN-1438); dependency versions and runtime API stay unchanged.
- Preserve existing creation options, replaceable policy hook, default role
  hierarchy and initial temporary-TOTP results. Receipt replay omits user and
  temporary-factor material and is not authentication.
- Prepare inert GF v4 action declarations and a source dependency lock; the
  candidate caller remains documentation, not an active workflow or GF proof.
- Refresh the inert caller to immutable ci-templates v5.1.1 and add
  `//:package_artifact_test` to the declared test action. The target checks the
  actual `//:pkg` output with existing locked `publint`, without repacking or
  adding dependencies; warnings remain visible and only errors fail.
- Retire legacy CI/provider-publish workflows and npm publishing configuration
  under corrected TIN-89/TIN-1629 authority. Bzlmod/BCR is the sole first-party
  delivery path; npmjs/GitHub Packages occupancy is not a release gate. Existing
  Bazel runtime/metadata tests remain required, with no replacement publisher or
  active GF caller introduced by this preparation.

## 0.2.5 — released baseline

Canonical tag `v0.2.5` points to `7687bb49b5e3f8719e874946ba1586f4d0d0b83a`.
It carries claim-first token consumption and process-local acceptance locking
(TIN-2781); neither that baseline nor this candidate provides distributed CAS.

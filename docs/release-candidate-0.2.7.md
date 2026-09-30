# Namespace-only source/BCR successor 0.2.7

This candidate preserves the public 0.2.5 runtime API and adds only the reviewed
Bazel namespace correction and declared development toolchain from PR 30. It does
not adopt the separate, preserved 0.2.6 durable-acceptance candidate or any held
breaking auth/invitation work. The 0.2.7 identity keeps those scopes distinct.

TIN-89's 2026-08-27 correction and TIN-1629 establish Bzlmod plus the append-only
Tinyland BCR as first-party delivery authority. GitHub tags/releases identify
source; npmjs and GitHub Packages are neither prerequisites nor fallbacks.
Accordingly this change retires the active release-to-npm workflow and its
manifest configuration. Existing package validation remains a dry run, and
compilation, tests, package metadata parity and the isolated consumer smoke remain
real checks. Historical provider artifacts and registry 0.2.5 are untouched.

The retained 0.2.6 recovery work was authorized by TIN-2716 only for source/version
preparation. It is not represented as completed by this namespace-only release.

The lead owns source merge and immutable source-anchor/BCR publication. Before
that transaction, recheck 0.2.7 tag/release/registry occupancy, qualify this exact
source and its external BCR consumer, and compute integrity from the real source
archive. No digest is fabricated and no existing version directory is edited.
This source change performs no publication, consumer adoption or runtime change.

The existing manifest licensing declaration is unchanged. This repository does
not currently carry the LICENSE file named by its manifest; that provenance gap
is recorded for the owner, not filled with invented license text.

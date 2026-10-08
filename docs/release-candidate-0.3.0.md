# Test clock seam release 0.3.0

This release carries PR 32 (TIN-5766, sprint rulings RS5 and RS6). The public
runtime API of 0.2.7 is unchanged. Invitation timestamps and expiry checks now
read the current time through an internal, process-wide clock seam
(`src/seams.ts`). Only `src/testing` writes to the seam, so the agent
end-to-end harness can drive invitation expiry.

- `src/testing` is not exported. It is compiled only by
  `tsconfig.testing.json` into `dist-testing/`, which is never packed.
- The shipped seam writer refuses to install a clock unless
  `process.env.NODE_ENV` is exactly `test`. Clearing the clock is always
  allowed and returns the process to the system clock.
- `tests/production-artifact.test.ts` proves the testing entry and its symbols
  are absent from the production artifact.

The minor bump records the new internal seam; consumers need no code change.
This package does not depend on `@tummycrypt/tinyland-auth`, so it is
unaffected by the auth 1.0.0 breaking release.

Delivery follows the 0.2.7 authority: a signed `v0.3.0` tag and GitHub release
identify the source, and the append-only Tinyland BCR entry carries integrity
computed from the real tag archive. No provider package is published.

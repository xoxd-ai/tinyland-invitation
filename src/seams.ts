/**
 * Internal time seam (RS5/RS6 pattern from @tummycrypt/tinyland-auth 1.0.0).
 *
 * Not exported from the package entry point, and there is no public option
 * on `InvitationConfig` that changes it. With nothing installed every
 * timestamp and expiry check reads the system clock. The only writer is the
 * `src/testing` build, which is excluded from the production build and the
 * published package and refuses to load unless `NODE_ENV` is exactly "test".
 */

/** Time source: milliseconds since the Unix epoch. */
export interface Clock {
  now(): number;
}

let installedClock: Clock | undefined;

/** Current time: the installed test clock, else the system clock. */
export function currentDate(): Date {
  return installedClock ? new Date(installedClock.now()) : new Date();
}

/** Install or clear the process-wide clock. Called only from src/testing. */
export function setInstalledClock(clock: Clock | undefined): void {
  installedClock = clock;
}

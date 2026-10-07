/**
 * Test-only harness for `@tummycrypt/tinyland-invitation` (RS5 pattern).
 *
 * Hard gate, in layers:
 *
 * 1. Compile-time exclusion: `tsconfig.json` and Bazel
 *    `//:tinyland_invitation` exclude this directory, so `dist/` and the
 *    published package never contain it. It builds only through
 *    `tsconfig.testing.json` into git-ignored `dist-testing/`.
 * 2. Not exported: `package.json` has no entry for it.
 * 3. Load gate: evaluating this module throws unless `process.env.NODE_ENV`
 *    is exactly "test". No function takes a caller-supplied environment.
 *
 * `tests/production-artifact.test.ts` proves all three on built output.
 */
import { setInstalledClock, type Clock } from '../seams.js';

export type { Clock };

/** Unique marker that must never appear in the production build. */
export const TESTING_ENTRY_SENTINEL = 'tinyland-invitation-testing-entry-ab58fac70763c8ffc6461c80';

/** The only `NODE_ENV` value under which this module loads. */
export const TEST_NODE_ENV = 'test';

export class TestingEntryRefusedError extends Error {
  constructor(reason: string) {
    super(
      `@tummycrypt/tinyland-invitation testing entry refused to load: ${reason}. ` +
        `It loads only when NODE_ENV is exactly "${TEST_NODE_ENV}".`,
    );
    this.name = 'TestingEntryRefusedError';
  }
}

/** Throws unless the live `process.env.NODE_ENV` is exactly "test". */
export function assertTestEnvironment(): void {
  const nodeEnv =
    typeof process === 'object' && process !== null && typeof process.env === 'object'
      ? process.env.NODE_ENV
      : undefined;
  if (nodeEnv !== TEST_NODE_ENV) {
    throw new TestingEntryRefusedError(
      nodeEnv === undefined ? 'NODE_ENV is unset' : `NODE_ENV is ${JSON.stringify(nodeEnv)}`,
    );
  }
}

// Load gate: runs when this module is evaluated, before any export is usable.
assertTestEnvironment();

/** A clock a harness can move by hand. */
export interface ManualClock extends Clock {
  set(epochMs: number): void;
  advance(deltaMs: number): void;
}

export function createManualClock(startMs: number): ManualClock {
  let current = startMs;
  return {
    now: () => current,
    set: (epochMs) => {
      current = epochMs;
    },
    advance: (deltaMs) => {
      current += deltaMs;
    },
  };
}

/**
 * Drive every invitation timestamp and expiry check in this process from
 * `clock` until {@link resetTestClock}.
 */
export function useTestClock(clock: Clock): void {
  assertTestEnvironment();
  setInstalledClock(clock);
}

/**
 * Return to the system clock. Deliberately ungated: clearing can only restore
 * the system clock, and afterEach hooks must be able to call it after a test
 * has moved NODE_ENV away from "test".
 */
export function resetTestClock(): void {
  setInstalledClock(undefined);
}

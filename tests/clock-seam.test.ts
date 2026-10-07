import { afterEach, describe, expect, it, vi } from 'vitest';
import * as pkg from '../src/index.js';
import { configure, resetConfig } from '../src/config.js';
import { InvitationService } from '../src/service.js';
import type { InvitationConfig } from '../src/index.js';
import {
  TestingEntryRefusedError,
  createManualClock,
  resetTestClock,
  useTestClock,
} from '../src/testing/index.js';

// RP2 harness seam. Since the RS5/RS6 rework there is no public clock option:
// a test clock is installed only through the gated src/testing build. These
// tests pin the default (system time, unchanged), that a clock smuggled through
// the public config is ignored, and the test-clock behaviour.

function buildConfig(extra: Record<string, unknown> = {}): InvitationConfig {
  const files = new Map<string, string>();
  let nextId = 0;
  return {
    readFile: async (path) => {
      const data = files.get(path);
      if (data === undefined) throw new Error(`ENOENT: ${path}`);
      return data;
    },
    writeFile: async (path, data) => {
      files.set(path, data);
    },
    invitesFilePath: 'invites.json',
    adminUsersFilePath: 'admin-users.json',
    generateId: () => `id-${++nextId}`,
    hashPassword: async (password) => `hashed:${password.length}`,
    generateTotpSecret: () => 'A'.repeat(32),
    generateKeyUri: (account, issuer) => `otpauth://totp/${issuer}:${account}`,
    generateQrCode: async () => 'data:image/png;base64,x',
    authConfig: { invitation: { defaultExpiryHours: 48 }, password: { bcryptRounds: 4 } },
    auditLog: async () => undefined,
    publicUrl: 'http://localhost.test',
    ...(extra as object),
  };
}

const createOptions = {
  role: 'member',
  createdBy: 'root',
  createdByHandle: 'root',
  createdByRole: 'super_admin',
} as const;

describe('invitation clock seam', () => {
  afterEach(() => {
    resetTestClock();
    resetConfig();
    vi.unstubAllEnvs();
  });

  it('exposes no clock on the public entry point', () => {
    expect(Object.keys(pkg).filter((name) => /clock|seam/i.test(name))).toEqual([]);
  });

  it('ignores a clock passed through the public config', async () => {
    const frozen = Date.UTC(2001, 0, 1);
    configure(buildConfig({ clock: { now: () => frozen } }));
    const service = new InvitationService();
    const before = Date.now();
    const result = await service.createInvitation({ ...createOptions });
    expect(Date.parse(result.invitation!.createdAt)).toBeGreaterThanOrEqual(before);
  });

  it('uses the system clock when no clock is configured', async () => {
    configure(buildConfig());
    const service = new InvitationService();
    const before = Date.now();
    const result = await service.createInvitation({ ...createOptions });
    const after = Date.now();

    expect(result.success).toBe(true);
    const created = Date.parse(result.invitation!.createdAt);
    expect(created).toBeGreaterThanOrEqual(before);
    expect(created).toBeLessThanOrEqual(after);
    const ttlHours = (Date.parse(result.invitation!.expiresAt) - created) / 3_600_000;
    expect(ttlHours).toBeGreaterThan(46.5);
    expect(ttlHours).toBeLessThan(49.5);
    expect(await service.getInvitation(result.invitation!.token)).not.toBeNull();
  });

  it('stamps and expires invitations from a test clock', async () => {
    const clock = createManualClock(Date.UTC(2031, 0, 15, 12, 0, 0));
    useTestClock(clock);
    configure(buildConfig());
    const service = new InvitationService();

    const result = await service.createInvitation({ ...createOptions });
    expect(result.success).toBe(true);
    const { token, createdAt } = result.invitation!;
    expect(createdAt).toBe(new Date(clock.now()).toISOString());
    expect(await service.getInvitation(token)).not.toBeNull();

    clock.advance(47 * 3_600_000);
    expect(await service.getInvitation(token)).not.toBeNull();

    clock.advance(3 * 3_600_000);
    expect(await service.getInvitation(token)).toBeNull();
    expect((await service.getStatistics()).pending).toBe(0);
  });

  it('refuses to install a test clock once NODE_ENV leaves "test"', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => useTestClock(createManualClock(0))).toThrow(TestingEntryRefusedError);
    vi.stubEnv('NODE_ENV', undefined);
    expect(() => useTestClock(createManualClock(0))).toThrow(/NODE_ENV is unset/);
  });
});

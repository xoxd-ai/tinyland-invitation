import { afterEach, describe, expect, it } from 'vitest';
import { configure, resetConfig } from '../src/config.js';
import { InvitationService } from '../src/service.js';
import type { InvitationClock, InvitationConfig } from '../src/index.js';

// RP2 harness seam: an optional clock on InvitationConfig. These tests pin the
// default (system time, unchanged) and the injected behaviour.

function buildConfig(clock?: InvitationClock): InvitationConfig {
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
    ...(clock ? { clock } : {}),
  };
}

const createOptions = {
  role: 'member',
  createdBy: 'root',
  createdByHandle: 'root',
  createdByRole: 'super_admin',
} as const;

describe('invitation clock seam', () => {
  afterEach(() => resetConfig());

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

  it('stamps and expires invitations from an injected clock', async () => {
    let nowMs = Date.UTC(2031, 0, 15, 12, 0, 0);
    configure(buildConfig({ now: () => nowMs }));
    const service = new InvitationService();

    const result = await service.createInvitation({ ...createOptions });
    expect(result.success).toBe(true);
    const { token, createdAt } = result.invitation!;
    expect(createdAt).toBe(new Date(nowMs).toISOString());
    expect(await service.getInvitation(token)).not.toBeNull();

    nowMs += 47 * 3_600_000;
    expect(await service.getInvitation(token)).not.toBeNull();

    nowMs += 3 * 3_600_000;
    expect(await service.getInvitation(token)).toBeNull();
    expect((await service.getStatistics()).pending).toBe(0);
  });
});

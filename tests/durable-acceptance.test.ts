import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configure, InvitationService, resetConfig } from '../src/index.js';
import type { AdminInvite, AdminUser, InvitationConfig } from '../src/index.js';

function mutationGate() {
  let previous = Promise.resolve();
  return async <T>(operation: () => Promise<T>): Promise<T> => {
    const ready = previous;
    let release!: () => void;
    previous = new Promise<void>((resolve) => { release = resolve; });
    await ready;
    try { return await operation(); } finally { release(); }
  };
}

describe('durable invitation acceptance', () => {
  let directory: string;
  let config: InvitationConfig;
  let service: InvitationService;
  let failProjection: 'invitation' | 'user' | 'user-ack' | undefined;
  let creatorActive: boolean;
  let nextId: number;
  const password = 'a-strong-password';
  const data = { token: 'opaque-invitation-token', handle: 'new-author', password };

  const invite = (overrides: Partial<AdminInvite> = {}): AdminInvite => ({
    id: 'invitation-1', token: data.token, role: 'member', createdBy: 'operator',
    createdByHandle: 'operator', createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(), isActive: true,
    temporaryTotpSecret: 'INVITATION-SECRET', ...overrides,
  });
  const users = async (): Promise<AdminUser[]> => JSON.parse(await readFile(config.adminUsersFilePath, 'utf8'));
  const invitations = async (): Promise<AdminInvite[]> => JSON.parse(await readFile(config.invitesFilePath, 'utf8'));
  const journal = async () => JSON.parse(await readFile(config.durableAcceptance!.operationsFilePath, 'utf8'));

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'invitation-recovery-'));
    nextId = 0;
    creatorActive = true;
    failProjection = undefined;
    config = {
      invitesFilePath: join(directory, 'invites.json'),
      adminUsersFilePath: join(directory, 'admin-users.json'),
      readFile: (path) => readFile(path, 'utf8'),
      writeFile: vi.fn(async (path, text) => {
        if (failProjection === 'invitation' && path === config.invitesFilePath) {
          throw new Error('interruption after journal commit');
        }
        if (failProjection === 'user' && path === config.adminUsersFilePath) {
          throw new Error('interruption between projections');
        }
        await writeFile(path, text);
        if (failProjection === 'user-ack' && path === config.adminUsersFilePath) {
          throw new Error('lost user projection acknowledgement');
        }
      }),
      generateId: () => `stable-user-${++nextId}`,
      hashPassword: vi.fn(async (value) => `slow-password-hash:${value}`),
      generateTotpSecret: () => 'SECRET', generateKeyUri: () => 'otpauth://test',
      generateQrCode: async () => 'qr',
      authConfig: { invitation: { defaultExpiryHours: 24 }, password: { bcryptRounds: 12 } },
      auditLog: vi.fn(async () => undefined), publicUrl: 'https://mothership.xoxd.ai',
      canCreateInviteForRole: async () => creatorActive,
      durableAcceptance: {
        operationsFilePath: join(directory, 'acceptance-operations.json'),
        withMutationGate: mutationGate(),
        canAcceptInvitation: vi.fn(async ({ invitation }) => creatorActive && invitation.role === 'member'),
        verifyPassword: async (value, hash) => hash === `slow-password-hash:${value}`,
      },
    };
    await writeFile(config.invitesFilePath, JSON.stringify([invite()]));
    await writeFile(config.adminUsersFilePath, '[]');
    configure(config);
    service = new InvitationService();
  });

  afterEach(async () => {
    resetConfig();
    // Each directory is the unique mkdtemp test fixture created above.
    await rm(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('commits identity and returns one fresh onboarding user with a private receipt', async () => {
    const result = await service.acceptInvitation(data);
    expect(result).toMatchObject({
      success: true, userId: 'stable-user-1', replayed: false, needsOnboarding: true,
      user: { handle: data.handle, role: 'member', totpEnabled: false, needsOnboarding: true },
    });
    expect(result.user?.invitationAcceptanceId).toBe(result.receipt?.operationId);
    expect((await invitations())[0].usedBy).toBe(result.userId);
    expect((await journal()).operations[0]).toMatchObject({ state: 'applied', receipt: result.receipt });
    expect((await journal()).operations[0].user).toBeUndefined();
    expect(await readFile(config.durableAcceptance!.operationsFilePath, 'utf8')).not.toContain(data.token);
    expect((await stat(config.durableAcceptance!.operationsFilePath)).mode & 0o777).toBe(0o600);
  });

  it('same request retries return the same receipt, not another onboarding login', async () => {
    const first = await service.acceptInvitation(data);
    const replay = await new InvitationService().acceptInvitation(data);
    expect(replay).toEqual({ success: true, userId: first.userId, receipt: first.receipt, replayed: true });
    expect(replay.user).toBeUndefined();
    expect(replay.tempTotpSecret).toBeUndefined();
    expect(replay.needsOnboarding).toBeUndefined();
    expect(await users()).toHaveLength(1);
    expect(config.hashPassword).toHaveBeenCalledTimes(1);
  });

  it.each(['invitation', 'user', 'user-ack'] as const)(
    'recovers after %s interruption with the same committed user ID', async (failure) => {
      failProjection = failure;
      expect((await service.acceptInvitation(data)).success).toBe(false);
      const committed = (await journal()).operations[0];
      expect(committed.state).toBe('committed');
      expect(committed.receipt.userId).toBe('stable-user-1');
      // Simulated process restart: no service map or transient claim is reused.
      failProjection = undefined;
      const restarted = new InvitationService();
      await restarted.recoverPendingAcceptances();
      expect(await users()).toHaveLength(1);
      expect((await users())[0].id).toBe(committed.receipt.userId);
      expect((await invitations())[0].usedBy).toBe(committed.receipt.userId);
      expect((await journal()).operations[0].state).toBe('applied');
      const replay = await restarted.acceptInvitation(data);
      expect(replay).toMatchObject({ success: true, replayed: true, receipt: committed.receipt });
      expect(replay.user).toBeUndefined();
      expect(config.hashPassword).toHaveBeenCalledTimes(1);
    },
  );

  it('recovers an already committed invitation even after its expiry', async () => {
    failProjection = 'invitation';
    await service.acceptInvitation(data);
    await writeFile(config.invitesFilePath, JSON.stringify([invite({ expiresAt: new Date(0).toISOString() })]));
    failProjection = undefined;
    await new InvitationService().recoverPendingAcceptances();
    expect(await users()).toHaveLength(1);
  });

  it('unfinished recovery blocks the protected barrier rather than serving partial state', async () => {
    failProjection = 'user';
    await service.acceptInvitation(data);
    await expect(new InvitationService().recoverPendingAcceptances()).rejects.toThrow('interruption between projections');
    expect((await journal()).operations[0].state).toBe('committed');
    expect(await users()).toHaveLength(0);
  });

  it('lost acknowledgements never replay the original security snapshot onto an existing user', async () => {
    failProjection = 'user-ack';
    await service.acceptInvitation(data);
    const current = (await users())[0];
    const changed = {
      ...current, role: 'viewer', passwordHash: 'changed', totpEnabled: true,
      totpSecretId: 'fresh-factor', needsOnboarding: false, onboardingStep: 5,
      isActive: false, removedAt: new Date().toISOString(),
    };
    await writeFile(config.adminUsersFilePath, JSON.stringify([changed]));
    failProjection = undefined;
    await new InvitationService().recoverPendingAcceptances();
    expect(await users()).toEqual([changed]);
    expect((await service.acceptInvitation(data)).success).toBe(false);
  });

  it('applied receipts never resurrect a removed account or rewrite any projection', async () => {
    await service.acceptInvitation(data);
    await writeFile(config.adminUsersFilePath, '[]');
    vi.mocked(config.writeFile).mockClear();
    await expect(new InvitationService().recoverPendingAcceptances())
      .rejects.toThrow('Invitation history exists but user authority is empty');
    expect(await users()).toEqual([]);
    expect(config.writeFile).not.toHaveBeenCalled();
    expect((await service.acceptInvitation(data)).success).toBe(false);
  });

  it('denies replay with a different handle or password, including an old password after reset', async () => {
    await service.acceptInvitation(data);
    expect((await service.acceptInvitation({ ...data, handle: 'another-author' })).success).toBe(false);
    expect((await service.acceptInvitation({ ...data, password: 'wrong' })).success).toBe(false);
    const [current] = await users();
    current.passwordHash = 'slow-password-hash:replacement';
    await writeFile(config.adminUsersFilePath, JSON.stringify([current]));
    expect((await service.acceptInvitation(data)).success).toBe(false);
    expect((await service.acceptInvitation({ ...data, password: 'replacement' })).replayed).toBe(true);
  });

  it('serializes separate tokens competing for the same handle', async () => {
    await writeFile(config.invitesFilePath, JSON.stringify([invite(), invite({ id: 'invitation-2', token: 'another-token' })]));
    const results = await Promise.all([
      service.acceptInvitation(data),
      new InvitationService().acceptInvitation({ ...data, token: 'another-token' }),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.find((result) => !result.success)?.error).toBe('Handle already taken');
    expect(await users()).toHaveLength(1);
  });

  it('preserves two concurrent independent acceptances without whole-file lost updates', async () => {
    await writeFile(config.invitesFilePath, JSON.stringify([invite(), invite({ id: 'invitation-2', token: 'another-token' })]));
    const results = await Promise.all([
      service.acceptInvitation(data),
      new InvitationService().acceptInvitation({ ...data, token: 'another-token', handle: 'another-author' }),
    ]);
    expect(results.every((result) => result.success)).toBe(true);
    expect(await users()).toHaveLength(2);
    expect((await invitations()).every((invitation) => !!invitation.usedBy)).toBe(true);
  });

  it('reserves inactive/tombstoned handles and case variants', async () => {
    await writeFile(config.adminUsersFilePath, JSON.stringify([{
      id: 'removed-author', handle: data.handle.toUpperCase(), isActive: false,
      removedAt: new Date().toISOString(),
    }]));
    expect(await service.acceptInvitation(data)).toEqual({ success: false, error: 'Handle already taken' });
    expect(config.hashPassword).not.toHaveBeenCalled();
  });

  it('reserves applied-receipt handles even if an external cleanup deletes the user', async () => {
    await service.acceptInvitation(data);
    // Retain a separate tombstone so this isolates the missing user's handle
    // reservation rather than the empty-established-authority barrier.
    await writeFile(config.adminUsersFilePath, JSON.stringify([{
      id: 'retained-other', handle: 'retained-other', isActive: false,
      removedAt: new Date().toISOString(),
    }]));
    await writeFile(config.invitesFilePath, JSON.stringify([invite({ id: 'invitation-2', token: 'another-token' })]));
    expect(await service.acceptInvitation({ ...data, token: 'another-token' }))
      .toEqual({ success: false, error: 'Handle already taken' });
  });

  it('denies an inactive invite and a creator whose current authority was removed', async () => {
    creatorActive = false;
    expect((await service.acceptInvitation(data)).success).toBe(false);
    creatorActive = true;
    await writeFile(config.invitesFilePath, JSON.stringify([invite({ isActive: false })]));
    expect((await service.acceptInvitation(data)).success).toBe(false);
    expect(config.hashPassword).not.toHaveBeenCalled();
    expect(await users()).toHaveLength(0);
  });

  it('rechecks current creator authority after asynchronous password hashing', async () => {
    vi.mocked(config.hashPassword).mockImplementation(async () => {
      creatorActive = false;
      return 'slow-password-hash:password';
    });
    expect((await service.acceptInvitation(data)).success).toBe(false);
    expect(await users()).toHaveLength(0);
    await expect(journal()).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not hide corrupt existing user state behind an empty-user fallback', async () => {
    await writeFile(config.adminUsersFilePath, '{broken');
    expect((await service.acceptInvitation(data)).success).toBe(false);
    expect(await readFile(config.adminUsersFilePath, 'utf8')).toBe('{broken');
    expect((await invitations())[0].usedAt).toBeUndefined();
  });

  it('corrupt journals fail closed for recovery and invitation writes', async () => {
    await writeFile(config.durableAcceptance!.operationsFilePath, '{broken');
    await expect(service.recoverPendingAcceptances()).rejects.toThrow();
    await expect(service.revokeInvitation(data.token, 'operator')).rejects.toThrow();
    expect((await invitations())[0].usedAt).toBeUndefined();
  });

  it('missing users authority is not a new installation during acceptance or recovery', async () => {
    await unlink(config.adminUsersFilePath);
    expect((await service.acceptInvitation(data)).success).toBe(false);
    await writeFile(config.adminUsersFilePath, '[]');
    failProjection = 'user';
    await service.acceptInvitation(data);
    await unlink(config.adminUsersFilePath);
    failProjection = undefined;
    await expect(service.recoverPendingAcceptances()).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(users()).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('applied-only history still fails the auth barrier if the entire users authority is lost', async () => {
    await service.acceptInvitation(data);
    await unlink(config.adminUsersFilePath);
    await expect(service.recoverPendingAcceptances()).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(users()).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('applied receipts with parseable empty users block a fresh-bootstrap decision without writes', async () => {
    await service.acceptInvitation(data);
    const applied = await journal();
    await writeFile(config.adminUsersFilePath, '[]');
    vi.mocked(config.writeFile).mockClear();
    const bootstrapDecision = vi.fn(async () => (await users()).length === 0);
    const protectedDecision = async () => {
      await new InvitationService().recoverPendingAcceptances();
      return bootstrapDecision();
    };
    await expect(protectedDecision()).rejects.toThrow('Invitation history exists but user authority is empty');
    expect(bootstrapDecision).not.toHaveBeenCalled();
    expect(config.writeFile).not.toHaveBeenCalled();
    expect(await users()).toEqual([]);
    expect(await journal()).toEqual(applied);
  });

  it('retained tombstones satisfy established user authority without restoring their account state', async () => {
    await service.acceptInvitation(data);
    const [current] = await users();
    const tombstone = {
      id: current.id, handle: current.handle, isActive: false,
      invitationAcceptanceId: current.invitationAcceptanceId,
      removedAt: new Date().toISOString(), removedBy: 'operator',
    };
    await writeFile(config.adminUsersFilePath, JSON.stringify([tombstone]));
    vi.mocked(config.writeFile).mockClear();
    await expect(service.recoverPendingAcceptances()).resolves.toBeUndefined();
    expect(await users()).toEqual([tombstone]);
    expect(config.writeFile).not.toHaveBeenCalled();
  });

  it('mixed applied and committed history refuses empty authority before projecting the pending account', async () => {
    await service.acceptInvitation(data);
    await writeFile(config.invitesFilePath, JSON.stringify([
      ...(await invitations()), invite({ id: 'invitation-2', token: 'another-token' }),
    ]));
    failProjection = 'user';
    expect((await service.acceptInvitation({
      ...data, token: 'another-token', handle: 'another-author',
    })).success).toBe(false);
    const committed = await journal();
    expect(committed.operations.map((operation: { state: string }) => operation.state))
      .toEqual(['applied', 'committed']);
    await writeFile(config.adminUsersFilePath, '[]');
    failProjection = undefined;
    vi.mocked(config.writeFile).mockClear();
    await expect(new InvitationService().recoverPendingAcceptances())
      .rejects.toThrow('Invitation history exists but user authority is empty');
    expect(config.writeFile).not.toHaveBeenCalled();
    expect(await users()).toEqual([]);
    expect(await journal()).toEqual(committed);
  });

  it.each([{}, { invites: 'not-an-array' }, [invite(), invite()]])(
    'does not overwrite malformed invitation authority: %j', async (badState) => {
      const before = JSON.stringify(badState);
      await writeFile(config.invitesFilePath, before);
      await expect(service.createInvitation({ role: 'member', createdBy: 'operator', createdByHandle: 'operator' }))
        .rejects.toThrow();
      await expect(service.revokeInvitation(data.token, 'operator')).rejects.toThrow();
      expect(await readFile(config.invitesFilePath, 'utf8')).toBe(before);
    },
  );

  it.each([{ removedAt: null }, { removedBy: null }, { removedBy: 'operator' }])(
    'denies replay for retained removal markers even when their value is null: %j', async (markers) => {
      await service.acceptInvitation(data);
      const [current] = await users();
      await writeFile(config.adminUsersFilePath, JSON.stringify([{ ...current, ...markers }]));
      expect((await service.acceptInvitation(data)).success).toBe(false);
    },
  );

  it('does not accept a token that expires during its final asynchronous authority check', async () => {
    const now = Date.now();
    let calls = 0;
    config.durableAcceptance!.canAcceptInvitation = async () => {
      if (++calls === 2) vi.spyOn(Date, 'now').mockReturnValue(now + 120_000);
      return true;
    };
    expect((await service.acceptInvitation(data)).success).toBe(false);
    await expect(journal()).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await users()).toHaveLength(0);
  });

  it('refuses to overwrite an unrelated user with a colliding generated ID', async () => {
    await writeFile(config.adminUsersFilePath, JSON.stringify([{ id: 'stable-user-1', handle: 'existing' }]));
    expect((await service.acceptInvitation(data)).success).toBe(false);
    expect(await users()).toEqual([{ id: 'stable-user-1', handle: 'existing' }]);
  });

  it('does not undo a committed account when the audit sink fails', async () => {
    vi.mocked(config.auditLog).mockRejectedValue(new Error('audit sink offline'));
    expect((await service.acceptInvitation(data)).success).toBe(true);
    expect((await journal()).operations[0].state).toBe('applied');
  });

  it('reloads shared invitation state before create/revoke instead of replacing stale entries', async () => {
    const other = new InvitationService();
    await other.getInvitation(data.token);
    const created = await service.createInvitation({ role: 'member', createdBy: 'operator', createdByHandle: 'operator' });
    expect(created.success).toBe(true);
    await other.revokeInvitation(data.token, 'operator');
    expect((await invitations()).map((entry) => entry.id)).toEqual([created.invitation!.id]);
  });
});

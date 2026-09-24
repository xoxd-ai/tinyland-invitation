import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { InvitationConfig, DurableInvitationAcceptanceConfig } from './config.js';
import type {
  AcceptResult, AdminInvite, AdminUser, InvitationAcceptData, InvitationAcceptanceReceipt,
} from './types.js';

interface AcceptanceOperation {
  tokenHash: string;
  receipt: InvitationAcceptanceReceipt;
  state: 'committed' | 'applied';
  /** Removed once projections are durable. Never contains a plaintext password. */
  user?: AdminUser;
}

interface AcceptanceJournal {
  version: 1;
  operations: AcceptanceOperation[];
}

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizedHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

function userReservesHandle(user: AdminUser, handle: string): boolean {
  // Login resolves both the canonical handle and the retained username alias.
  // Reserve either identity, including inactive/tombstoned accounts. The
  // normalized comparison is conservative for legacy case/spacing variants;
  // it never treats an alias as available merely because login's current
  // equality check would not match that variant verbatim.
  return normalizedHandle(user.handle) === handle
    || (typeof user.username === 'string' && normalizedHandle(user.username) === handle);
}

function liveUser(user: AdminUser): boolean {
  return user.isActive === true && !('removedAt' in user) && !('removedBy' in user)
    && !('deletedAt' in user) && !('tombstonedAt' in user) && !user.isRemoved;
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function invalid(): AcceptResult {
  return { success: false, error: 'Invalid or expired invitation' };
}

/**
 * A narrow file-backed commit/replay coordinator, not a distributed transaction.
 * The consumer must serialize all auth mutations and run recovery before auth
 * decisions. Once committed, an operation is authoritative even if the invite
 * expires before restart. Applied receipts are immutable and never reproject.
 */
export class DurableInvitationAcceptance {
  private readonly durable: DurableInvitationAcceptanceConfig;

  constructor(private readonly config: InvitationConfig) {
    if (!config.durableAcceptance) throw new Error('Durable invitation acceptance is not configured');
    this.durable = config.durableAcceptance;
  }

  async withReadyState<T>(operation: () => Promise<T>): Promise<T> {
    return this.durable.withMutationGate(async () => {
      await this.recoverUnlocked();
      return operation();
    });
  }

  async recover(): Promise<void> {
    await this.withReadyState(async () => undefined);
  }

  async accept(data: InvitationAcceptData): Promise<AcceptResult> {
    return this.withReadyState(async () => {
      if (!data.token || !data.password || !data.handle
          || normalizedHandle(data.handle) !== data.handle
          || !/^[a-z0-9][a-z0-9_-]*$/.test(data.handle)) return invalid();

      const journal = await this.readJournal();
      const digest = tokenHash(data.token);
      const previous = journal.operations.find((entry) => entry.tokenHash === digest);
      if (previous) {
        if (previous.receipt.handle !== data.handle) return invalid();
        const user = (await this.readUsers()).find((candidate) => candidate.id === previous.receipt.userId);
        if (!user || user.handle !== data.handle || !liveUser(user)
            || !await this.durable.verifyPassword(data.password, user.passwordHash)) return invalid();
        // A consumed invite must never become a reusable password-only login or
        // an MFA bypass. The consumer redirects receipt retries to normal login.
        return { success: true, userId: user.id, receipt: previous.receipt, replayed: true };
      }

      let invitations = await this.readInvitations();
      let invitation = invitations.find((candidate) => candidate.token === data.token);
      if (!this.pending(invitation)) return invalid();
      if (this.handleReserved(data.handle, await this.readUsers(), journal)) {
        return { success: false, error: 'Handle already taken' };
      }
      if (!await this.durable.canAcceptInvitation({ invitation, handle: data.handle })) return invalid();

      const passwordHash = await this.config.hashPassword(data.password, this.config.authConfig.password.bcryptRounds);
      // Hashing is asynchronous and can cross an expiry. Re-read the authority
      // inside the shared gate immediately before the durable commit.
      invitations = await this.readInvitations();
      invitation = invitations.find((candidate) => candidate.token === data.token);
      const users = await this.readUsers();
      if (!this.pending(invitation)
          || !await this.durable.canAcceptInvitation({ invitation, handle: data.handle })) return invalid();
      if (!this.pending(invitation)) return invalid();
      if (this.handleReserved(data.handle, users, journal)) {
        return { success: false, error: 'Handle already taken' };
      }
      const userId = this.config.generateId();
      if (!userId || users.some((user) => user.id === userId)
          || journal.operations.some((entry) => entry.receipt.userId === userId)) {
        throw new Error('Invitation user ID collision');
      }
      const receipt: InvitationAcceptanceReceipt = {
        operationId: randomUUID(), invitationId: invitation.id, userId,
        handle: data.handle, committedAt: new Date().toISOString(),
      };
      const user: AdminUser = {
        id: userId, username: data.handle, handle: data.handle, email: '', passwordHash,
        role: invitation.role, totpEnabled: false, isActive: true,
        needsOnboarding: true, onboardingStep: 0, firstLogin: true,
        createdAt: receipt.committedAt, updatedAt: receipt.committedAt,
        invitationAcceptanceId: receipt.operationId,
      };
      const operation: AcceptanceOperation = { tokenHash: digest, receipt, state: 'committed', user };
      journal.operations.push(operation);
      // The fsynced journal fixes token, handle and identity BEFORE either mutable
      // projection. If this write has an uncertain result, the next gate recovers.
      await this.writeJournal(journal);
      await this.apply(operation);
      operation.state = 'applied';
      delete operation.user;
      await this.writeJournal(journal);

      // An audit sink outage must not turn an already committed account into a
      // false failure. The durable receipt remains the acceptance authority.
      try {
        await this.config.auditLog('INVITATION_ACCEPTED', {
          invitationId: receipt.invitationId, userId, handle: data.handle,
          role: invitation.role, operationId: receipt.operationId,
        });
        await this.config.auditLog('USER_CREATED', {
          userId, handle: data.handle, role: invitation.role,
          createdVia: 'invitation', operationId: receipt.operationId,
        });
      } catch {
        console.error('Invitation acceptance committed; audit delivery failed');
      }
      return {
        success: true, user, userId, needsOnboarding: true,
        tempTotpSecret: invitation.temporaryTotpSecret, receipt, replayed: false,
      };
    });
  }

  private pending(invitation: AdminInvite | undefined): invitation is AdminInvite {
    return !!invitation && invitation.isActive === true && !invitation.usedAt
      && validDate(invitation.expiresAt) && Date.parse(invitation.expiresAt) > Date.now();
  }

  private handleReserved(handle: string, users: AdminUser[], journal: AcceptanceJournal): boolean {
    // Retained/removed users count. Applied receipts also reserve a handle if an
    // external cleanup incorrectly removes the user's tombstone from its file.
    return users.some((user) => userReservesHandle(user, handle))
      || journal.operations.some((entry) => entry.receipt.handle === handle);
  }

  private async recoverUnlocked(): Promise<void> {
    const journal = await this.readJournal();
    // Even an applied-only history proves this is not a fresh installation.
    // Losing user authority must fail the protected gate, not enable bootstrap.
    if (journal.operations.length > 0) {
      const users = await this.readUsers();
      if (users.length === 0 && journal.operations.some((operation) => operation.state === 'applied')) {
        throw new Error('Invitation history exists but user authority is empty');
      }
    }
    for (const operation of journal.operations) {
      if (operation.state === 'applied') continue;
      await this.apply(operation);
      operation.state = 'applied';
      delete operation.user;
      await this.writeJournal(journal);
    }
    // Check after replay so a first committed acceptance can still finish from
    // an explicitly empty projection. Applied history is never a new install,
    // and its missing users must not be resurrected from old security state.
    if (journal.operations.length > 0 && (await this.readUsers()).length === 0) {
      throw new Error('Invitation history exists but user authority is empty');
    }
  }

  private async apply(operation: AcceptanceOperation): Promise<void> {
    const { receipt, user } = operation;
    if (!user) throw new Error('Committed invitation is missing its user projection');
    const invitations = await this.readInvitations();
    const invitation = invitations.find((candidate) => tokenHash(candidate.token) === operation.tokenHash);
    if (invitation) {
      if (invitation.id !== receipt.invitationId
          || (invitation.usedBy && invitation.usedBy !== receipt.userId)) {
        throw new Error('Committed invitation conflicts with its token projection');
      }
      if (!invitation.usedAt || !invitation.usedBy) {
        invitation.usedAt = receipt.committedAt;
        invitation.usedBy = receipt.userId;
        await this.config.writeFile(this.config.invitesFilePath, JSON.stringify(invitations, null, 2));
      }
    }
    // Missing invitations need not be resurrected: the journal consumes their
    // capability permanently. Missing/corrupt user storage is never guessed at.
    const users = await this.readUsers();
    const existing = users.find((candidate) => candidate.id === receipt.userId);
    if (existing) {
      if (existing.handle !== receipt.handle || existing.invitationAcceptanceId !== receipt.operationId) {
        throw new Error('Committed invitation conflicts with its user projection');
      }
      // Never replay the original password, role, MFA, activity or onboarding
      // snapshot over an existing user, including removed/tombstoned users.
      return;
    }
    if (users.some((candidate) => userReservesHandle(candidate, receipt.handle))) {
      throw new Error('Committed invitation handle is already reserved');
    }
    users.push(user);
    await this.config.writeFile(this.config.adminUsersFilePath, JSON.stringify(users, null, 2));
  }

  async readInvitations(): Promise<AdminInvite[]> {
    const parsed = await this.readProjection(this.config.invitesFilePath);
    const invitations: unknown = Array.isArray(parsed) ? parsed : (parsed as { invites?: unknown })?.invites;
    if (!Array.isArray(invitations) || invitations.some((invite) =>
      !invite || typeof invite.id !== 'string' || !invite.id
      || typeof invite.token !== 'string' || !invite.token
      || typeof invite.role !== 'string' || !invite.role
      || typeof invite.createdBy !== 'string' || !invite.createdBy
      || typeof invite.isActive !== 'boolean' || !validDate(invite.expiresAt))) {
      throw new Error('Invalid invitation projection');
    }
    if (new Set(invitations.map((invite) => invite.token)).size !== invitations.length
        || new Set(invitations.map((invite) => invite.id)).size !== invitations.length) {
      throw new Error('Duplicate invitation projection identity');
    }
    return invitations as AdminInvite[];
  }

  private async readUsers(): Promise<AdminUser[]> {
    // An inviter already exists when accepting an invitation. Missing user
    // authority is storage loss, not permission to recreate a prior snapshot.
    const users: unknown = JSON.parse(await this.config.readFile(this.config.adminUsersFilePath));
    if (!Array.isArray(users) || users.some((user) =>
      !user || typeof user.id !== 'string' || !user.id
      || typeof user.handle !== 'string' || !user.handle)) {
      throw new Error('Invalid user projection');
    }
    if (new Set(users.map((user) => user.id)).size !== users.length
        || new Set(users.map((user) => normalizedHandle(user.handle))).size !== users.length) {
      throw new Error('Duplicate user projection identity');
    }
    return users as AdminUser[];
  }

  private async readProjection(path: string): Promise<unknown> {
    try {
      return JSON.parse(await this.config.readFile(path));
    } catch (error) {
      if (missing(error)) return [];
      throw error;
    }
  }

  private async readJournal(): Promise<AcceptanceJournal> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(this.durable.operationsFilePath, 'utf8'));
    } catch (error) {
      if (missing(error)) return { version: 1, operations: [] };
      throw error;
    }
    const journal = parsed as AcceptanceJournal;
    if (journal?.version !== 1 || !Array.isArray(journal.operations)) {
      throw new Error('Invalid invitation acceptance journal');
    }
    const tokens = new Set<string>();
    const handles = new Set<string>();
    const users = new Set<string>();
    for (const entry of journal.operations) {
      const receipt = entry?.receipt;
      if (!entry || !/^[a-f0-9]{64}$/.test(entry.tokenHash)
          || (entry.state !== 'committed' && entry.state !== 'applied')
          || !receipt || typeof receipt.operationId !== 'string' || !receipt.operationId
          || typeof receipt.invitationId !== 'string' || !receipt.invitationId
          || typeof receipt.userId !== 'string' || !receipt.userId
          || typeof receipt.handle !== 'string' || !receipt.handle
          || normalizedHandle(receipt.handle) !== receipt.handle
          || !validDate(receipt.committedAt)
          || tokens.has(entry.tokenHash) || handles.has(receipt.handle) || users.has(receipt.userId)
          || (entry.state === 'committed' && (!entry.user
            || entry.user.id !== receipt.userId || entry.user.handle !== receipt.handle
            || entry.user.invitationAcceptanceId !== receipt.operationId
            || typeof entry.user.passwordHash !== 'string' || !entry.user.passwordHash))) {
        throw new Error('Invalid invitation acceptance operation');
      }
      tokens.add(entry.tokenHash);
      handles.add(receipt.handle);
      users.add(receipt.userId);
    }
    return journal;
  }

  private async writeJournal(journal: AcceptanceJournal): Promise<void> {
    const target = this.durable.operationsFilePath;
    const directory = dirname(target);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    let renamed = false;
    try {
      const file = await open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(JSON.stringify(journal, null, 2), 'utf8');
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, target);
      renamed = true;
      const directoryFile = await open(directory, 'r');
      try {
        await directoryFile.sync();
      } finally {
        await directoryFile.close();
      }
    } finally {
      if (!renamed) await unlink(temporary).catch((error: unknown) => { if (!missing(error)) throw error; });
    }
  }
}

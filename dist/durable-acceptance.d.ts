import type { InvitationConfig } from './config.js';
import type { AcceptResult, AdminInvite, InvitationAcceptData } from './types.js';
/**
 * A narrow file-backed commit/replay coordinator, not a distributed transaction.
 * The consumer must serialize all auth mutations and run recovery before auth
 * decisions. Once committed, an operation is authoritative even if the invite
 * expires before restart. Applied receipts are immutable and never reproject.
 */
export declare class DurableInvitationAcceptance {
    private readonly config;
    private readonly durable;
    constructor(config: InvitationConfig);
    withReadyState<T>(operation: () => Promise<T>): Promise<T>;
    recover(): Promise<void>;
    accept(data: InvitationAcceptData): Promise<AcceptResult>;
    private pending;
    private handleReserved;
    private recoverUnlocked;
    private apply;
    readInvitations(): Promise<AdminInvite[]>;
    private readUsers;
    private readProjection;
    private readJournal;
    private writeJournal;
}
//# sourceMappingURL=durable-acceptance.d.ts.map
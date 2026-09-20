
import type { AdminInvite } from './types.js';

/** Opt-in recovery for one process sharing the consumer's auth mutation gate. */
export interface DurableInvitationAcceptanceConfig {
  /** Private local file on the same persistent storage as auth projections. */
  operationsFilePath: string;
  /** Must be the SAME reentrant gate used by every user/security mutation. */
  withMutationGate: <T>(operation: () => Promise<T>) => Promise<T>;
  /** Resolve current creator authority, never trust the invitation's old role. */
  canAcceptInvitation: (args: { invitation: AdminInvite; handle: string }) => Promise<boolean>;
  /** Applied retries prove the current password but never grant a new session. */
  verifyPassword: (password: string, passwordHash: string) => Promise<boolean>;
}

export interface InvitationConfig {
  
  readFile: (path: string) => Promise<string>;
  
  writeFile: (path: string, data: string) => Promise<void>;
  
  invitesFilePath: string;
  
  adminUsersFilePath: string;

  /** When enabled, writeFile MUST atomically replace and durably sync projections. */
  durableAcceptance?: DurableInvitationAcceptanceConfig;

  
  generateId: () => string;
  
  hashPassword: (password: string, rounds: number) => Promise<string>;

  
  generateTotpSecret: () => string;
  
  generateKeyUri: (account: string, issuer: string, secret: string) => string;
  
  generateQrCode: (otpauthUrl: string) => Promise<string>;

  
  authConfig: {
    invitation: { defaultExpiryHours: number };
    password: { bcryptRounds: number };
  };

  
  auditLog: (eventType: string, data: Record<string, unknown>) => Promise<void>;

  publicUrl: string;

  canCreateInviteForRole?: (args: {
    createdBy: string;
    createdByRole?: string;
    targetRole: string;
  }) => boolean | Promise<boolean>;
}

let currentConfig: InvitationConfig | null = null;





export function configure(config: InvitationConfig): void {
  currentConfig = config;
}





export function getConfig(): InvitationConfig {
  if (!currentConfig) {
    throw new Error(
      'tinyland-invitation is not configured. Call configure() before using the service.'
    );
  }
  return currentConfig;
}




export function resetConfig(): void {
  currentConfig = null;
}

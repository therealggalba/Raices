import type { Invitation, InvitationStatus, IsoDateTime } from '../types/domain';

// Invitation codes: single use, configurable expiry, traceable (who created
// it, who redeemed it and when). Codes come from a CSPRNG and avoid
// ambiguous characters (0/O, 1/I/L) so they can be dictated over the phone.

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_GROUPS = 3;
export const CODE_GROUP_SIZE = 4;
export const EXPIRY_OPTIONS_DAYS = [1, 7, 30] as const;
export const MAX_EXPIRY_DAYS = 90;

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_GROUP_SIZE}}(?:-[${CODE_ALPHABET}]{${CODE_GROUP_SIZE}}){${CODE_GROUPS - 1}}$`);

export type RandomSource = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array;

const cryptoRandom: RandomSource = (bytes) => crypto.getRandomValues(bytes);

/** "K7PM-Q2XD-9HWA". Rejection sampling keeps the distribution uniform. */
export function generateInvitationCode(random: RandomSource = cryptoRandom): string {
  const total = CODE_GROUPS * CODE_GROUP_SIZE;
  const limit = 256 - (256 % CODE_ALPHABET.length);
  const chars: string[] = [];
  while (chars.length < total) {
    for (const byte of random(new Uint8Array(total * 2))) {
      if (byte < limit && chars.length < total) chars.push(CODE_ALPHABET[byte % CODE_ALPHABET.length]);
    }
  }
  const groups: string[] = [];
  for (let i = 0; i < total; i += CODE_GROUP_SIZE) groups.push(chars.slice(i, i + CODE_GROUP_SIZE).join(''));
  return groups.join('-');
}

/** Uppercases, drops spaces and re-inserts dashes so "k7pm q2xd9hwa" works. */
export function normalizeInvitationCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, '');
  if (compact.length !== CODE_GROUPS * CODE_GROUP_SIZE) return null;
  const groups: string[] = [];
  for (let i = 0; i < compact.length; i += CODE_GROUP_SIZE) groups.push(compact.slice(i, i + CODE_GROUP_SIZE));
  const code = groups.join('-');
  return CODE_RE.test(code) ? code : null;
}

export function invitationStatus(invitation: Invitation, now: IsoDateTime): InvitationStatus {
  if (invitation.revokedAt) return 'revoked';
  if (invitation.usedAt) return 'used';
  if (invitation.expiresAt <= now) return 'expired';
  return 'active';
}

export function expiryFrom(now: Date, days: number): IsoDateTime {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

export const STATUS_LABELS: Record<InvitationStatus, string> = {
  active: 'Activa',
  used: 'Usada',
  expired: 'Caducada',
  revoked: 'Revocada',
};

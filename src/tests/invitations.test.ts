import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  generateInvitationCode,
  invitationStatus,
  normalizeInvitationCode,
} from '../utils/invitations';
import type { Invitation } from '../types/domain';

const base: Invitation = {
  id: 'i1',
  channelId: 'c1',
  code: 'ABCD-EFGH-JKMN',
  createdBy: 'u1',
  createdAt: '2026-10-01T00:00:00.000Z',
  expiresAt: '2026-10-08T00:00:00.000Z',
};

describe('invitation codes', () => {
  it('generates well-formed codes from the unambiguous alphabet', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateInvitationCode()));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect([...code.replace(/-/g, '')].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    }
  });

  it('skips biased bytes (rejection sampling)', () => {
    let call = 0;
    const code = generateInvitationCode((bytes) => {
      call += 1;
      return bytes.fill(call === 1 ? 255 : 0);
    });
    expect(code).toBe('AAAA-AAAA-AAAA');
  });

  it('normalizes what people type', () => {
    expect(normalizeInvitationCode(' k7pm q2xd-9hwa ')).toBe('K7PM-Q2XD-9HWA');
    expect(normalizeInvitationCode('K7PM-Q2XD')).toBeNull();
    expect(normalizeInvitationCode('O0O0-I1I1-LLLL')).toBeNull();
  });
});

describe('invitationStatus', () => {
  it('derives the status, revoked and used taking precedence over expiry', () => {
    expect(invitationStatus(base, '2026-10-02T00:00:00.000Z')).toBe('active');
    expect(invitationStatus(base, '2026-10-08T00:00:00.000Z')).toBe('expired');
    expect(invitationStatus({ ...base, usedAt: '2026-10-02T00:00:00.000Z' }, '2026-10-09T00:00:00.000Z')).toBe('used');
    expect(invitationStatus({ ...base, revokedAt: '2026-10-02T00:00:00.000Z' }, '2026-10-03T00:00:00.000Z')).toBe('revoked');
  });
});

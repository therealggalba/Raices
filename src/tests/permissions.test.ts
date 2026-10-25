import { describe, expect, it } from 'vitest';
import {
  canAddEvents,
  canEditContent,
  canEditEvent,
  canManage,
  canUpload,
  canUploadAbout,
  isNotifyTime,
  needsApproval,
} from '../utils/permissions';

const owner = { role: 'owner' as const, userId: 'u1', personId: 'p1' };
const admin = { role: 'admin' as const, userId: 'u2', personId: 'p2' };
const member = { role: 'member' as const, userId: 'u3', personId: 'p3' };
const nobody = { role: 'member' as const, userId: 'u4' };

describe('permissions', () => {
  it('only the owner manages the channel and skips approval', () => {
    expect([owner, admin, member].map(canManage)).toEqual([true, false, false]);
    expect([owner, admin, member].map(needsApproval)).toEqual([false, true, true]);
  });

  it('admins upload content of anyone; members only where they appear', () => {
    expect(canUploadAbout(owner, [])).toBe(true);
    expect(canUploadAbout(admin, ['p9'])).toBe(true);
    expect(canUploadAbout(member, ['p9'])).toBe(false);
    expect(canUploadAbout(member, ['p9', 'p3'])).toBe(true);
    expect(canUploadAbout(member, [])).toBe(false);
  });

  it('a member who has not said who they are cannot upload or add dates', () => {
    expect(canUpload(nobody)).toBe(false);
    expect(canAddEvents(nobody)).toBe(false);
    expect(canUpload(member)).toBe(true);
    expect(canUpload({ role: 'admin' })).toBe(true);
  });

  it('content is edited by the owner or its author', () => {
    expect(canEditContent(owner, { authorId: 'u3' })).toBe(true);
    expect(canEditContent(member, { authorId: 'u3' })).toBe(true);
    expect(canEditContent(admin, { authorId: 'u3' })).toBe(false);
  });

  it('dates are edited by the owner or anyone in them', () => {
    expect(canEditEvent(owner, { personIds: [] })).toBe(true);
    expect(canEditEvent(member, { personIds: ['p3', 'p1'] })).toBe(true);
    expect(canEditEvent(admin, { personIds: ['p3'] })).toBe(false);
    expect(canEditEvent(nobody, { personIds: ['p3'] })).toBe(false);
  });

  it('validates the reminder time', () => {
    expect(['09:00', '00:00', '23:59', '20:30'].every(isNotifyTime)).toBe(true);
    expect(['24:00', '9:00', '12:60', '', 'abc', null].some(isNotifyTime)).toBe(false);
  });
});

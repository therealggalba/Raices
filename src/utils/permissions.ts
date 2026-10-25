import type { Member, Role } from '../types/domain';

// What each role may do in a channel. Pure: the local repository enforces it
// and the screens use it to show only what is allowed (the Supabase backend
// enforces the same rules in the database, see migration 0009).

type Me = { role: Role; personId?: string; userId?: string };

/** The owner manages the channel: settings, invitations, members, tree, everyone's data, approvals. */
export function canManage(me: Pick<Me, 'role'>): boolean {
  return me.role === 'owner';
}

/** May upload videos and cromos at all: owner and admins, or a member who knows who they are. */
export function canUpload(me: Pick<Me, 'role' | 'personId'>): boolean {
  return me.role !== 'member' || !!me.personId;
}

/** Owner and admins upload content of anyone; members only content in which they appear. */
export function canUploadAbout(me: Pick<Me, 'role' | 'personId'>, personIds: readonly string[]): boolean {
  if (me.role !== 'member') return true;
  return !!me.personId && personIds.includes(me.personId);
}

/** What the owner uploads is approved at once; the rest waits for them. */
export function needsApproval(me: Pick<Me, 'role'>): boolean {
  return me.role !== 'owner';
}

/** Videos and cromos: the owner, or their author. */
export function canEditContent(me: Pick<Member, 'role' | 'userId'>, item: { authorId: string }): boolean {
  return canManage(me) || item.authorId === me.userId;
}

/** Important dates: the owner, or anyone who appears in them. */
export function canEditEvent(me: Pick<Me, 'role' | 'personId'>, event: { personIds: readonly string[] }): boolean {
  return canManage(me) || (!!me.personId && event.personIds.includes(me.personId));
}

/** May add important dates (their own, at least). */
export function canAddEvents(me: Pick<Me, 'role' | 'personId'>): boolean {
  return canManage(me) || !!me.personId;
}

/** «HH:MM», 00:00-23:59. */
export function isNotifyTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export const DEFAULT_NOTIFY_AT = '09:00';

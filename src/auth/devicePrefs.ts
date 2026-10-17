// Small per-device preferences of the login (localStorage can throw in
// private windows: then nothing is remembered).

const REMEMBERED_LOGIN = 'family-memories:usuario';
const LAST_USED = 'family-memories:ultimo-uso';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Not remembered.
  }
}

/** «Recordarme»: the username (never the password) to prefill next time. */
export const rememberedLogin = () => read(REMEMBERED_LOGIN);
export const setRememberedLogin = (login: string | null) => write(REMEMBERED_LOGIN, login);

export function lastUsed(): number | null {
  const value = Number(read(LAST_USED));
  return read(LAST_USED) !== null && Number.isFinite(value) ? value : null;
}
export const markUsed = (at: number = Date.now()) => write(LAST_USED, String(at));
export const clearLastUsed = () => write(LAST_USED, null);

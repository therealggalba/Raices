/** Native confirm wrapped so destructive actions read the same everywhere. */
export function confirmAction(message: string): boolean {
  return window.confirm(message);
}

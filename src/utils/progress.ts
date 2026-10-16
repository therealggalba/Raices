// "Continue watching" rules, shared by every backend and the player.

/** Below this, there is nothing worth resuming. */
export const RESUME_MIN_SECONDS = 5;
/** Within this many seconds of the end (or past FINISHED_RATIO) the video counts as finished. */
export const FINISHED_TAIL_SECONDS = 15;
export const FINISHED_RATIO = 0.95;
/** How often the player saves progress while playing. */
export const SAVE_INTERVAL_SECONDS = 5;

export type ProgressDecision = { action: 'save'; positionSeconds: number; durationSeconds: number } | { action: 'clear' };

/** Validates and classifies a position reported by a player. Null = invalid input. */
export function decideProgress(positionSeconds: unknown, durationSeconds: unknown): ProgressDecision | null {
  if (typeof positionSeconds !== 'number' || typeof durationSeconds !== 'number') return null;
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) return null;
  if (positionSeconds < 0 || durationSeconds <= 0 || durationSeconds > 24 * 3600) return null;
  const position = Math.min(Math.floor(positionSeconds), Math.floor(durationSeconds));
  const duration = Math.floor(durationSeconds);
  const finished = position >= duration - FINISHED_TAIL_SECONDS || position >= duration * FINISHED_RATIO;
  if (position < RESUME_MIN_SECONDS || finished) return { action: 'clear' };
  return { action: 'save', positionSeconds: position, durationSeconds: duration };
}

/** 0..1 for the progress bar on cards. */
export function progressRatio(progress: { positionSeconds: number; durationSeconds: number } | undefined): number {
  if (!progress || progress.durationSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, progress.positionSeconds / progress.durationSeconds));
}

/** "3:07" / "1:02:03". */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

import { describe, expect, it } from 'vitest';
import { decideProgress, formatTimestamp, progressRatio } from '../utils/progress';

describe('decideProgress', () => {
  it('saves a position in the middle of the video (floored)', () => {
    expect(decideProgress(187.6, 596.2)).toEqual({ action: 'save', positionSeconds: 187, durationSeconds: 596 });
  });

  it('clears near the start and near the end', () => {
    expect(decideProgress(3, 596)).toEqual({ action: 'clear' });
    expect(decideProgress(585, 596)).toEqual({ action: 'clear' });
    expect(decideProgress(596, 596)).toEqual({ action: 'clear' });
    // Long video: 95 % counts as finished even far from the last 15 s.
    expect(decideProgress(3500, 3600)).toEqual({ action: 'clear' });
  });

  it('rejects garbage', () => {
    for (const [p, d] of [[-1, 10], [5, 0], [Number.NaN, 10], [5, Infinity], ['5', 10], [5, 100000]]) {
      expect(decideProgress(p, d)).toBeNull();
    }
  });
});

describe('progress helpers', () => {
  it('computes the bar ratio and formats timestamps', () => {
    expect(progressRatio({ positionSeconds: 30, durationSeconds: 120 })).toBe(0.25);
    expect(progressRatio(undefined)).toBe(0);
    expect(formatTimestamp(187)).toBe('3:07');
    expect(formatTimestamp(3723)).toBe('1:02:03');
  });
});

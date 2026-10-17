import { useCallback, useEffect, useRef, useState } from 'react';

type Direction = -1 | 1;

/**
 * The scroll container must be `position: relative` (items' offsetLeft is
 * measured from it).
 *
 * Horizontal carousel helper: tells whether there is more content to either
 * side and scrolls exactly one item per step, aligning it with the start
 * edge (respecting scroll-padding). `deps` re-measures when items change.
 */
export function useScrollArrows<T extends HTMLElement>(deps: readonly unknown[] = []) {
  const ref = useRef<T>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 2);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-provided deps
  }, [update, ...deps]);

  const step = useCallback((direction: Direction) => {
    const el = ref.current;
    if (!el) return;
    const edge = el.scrollLeft + (parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0);
    const items = [...el.children] as HTMLElement[];
    const target =
      direction === 1
        ? items.find((item) => item.offsetLeft > edge + 2)
        : items.findLast((item) => item.offsetLeft < edge - 2);
    if (!target) return;
    el.scrollTo({ left: target.offsetLeft - (edge - el.scrollLeft), behavior: 'smooth' });
  }, []);

  /** Brings an item into view (e.g. the selected tab). */
  const reveal = useCallback((item: HTMLElement | null) => {
    const el = ref.current;
    if (!el || !item) return;
    const left = item.offsetLeft;
    const right = left + item.offsetWidth;
    if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: left - (el.clientWidth - item.offsetWidth) / 2, behavior: 'smooth' });
    }
  }, []);

  return { ref, canPrev, canNext, step, reveal };
}

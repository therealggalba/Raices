import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Video } from '../types/domain';
import { VideoCard } from './VideoCard';
import styles from './VideoRow.module.scss';

interface Props {
  title: string;
  videos: Video[];
  favoriteIds: readonly string[];
  ranked?: boolean;
  /** "Ver todo" link (usually the catalog, pre-filtered). */
  moreTo?: string;
}

type Direction = -1 | 1;

/**
 * Netflix-style row. Edge arrows move it one card per click; on touch
 * screens each swipe also advances exactly one card (scroll-snap-stop).
 */
export function VideoRow({ title, videos, favoriteIds, ranked, moreTo }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const favs = new Set(favoriteIds);

  const updateArrows = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 2);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      observer.disconnect();
    };
  }, [updateArrows, videos.length]);

  /** Scrolls so the previous/next card lines up with the row's start edge. */
  const step = (direction: Direction) => {
    const el = scroller.current;
    if (!el) return;
    const edge = el.scrollLeft + (parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0);
    const cards = [...el.children] as HTMLElement[];
    const target =
      direction === 1
        ? cards.find((card) => card.offsetLeft > edge + 2)
        : cards.findLast((card) => card.offsetLeft < edge - 2);
    if (!target) return;
    const left = target.offsetLeft - (edge - el.scrollLeft);
    el.scrollTo({ left, behavior: 'smooth' });
  };

  return (
    <section className={styles.row} aria-label={title}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {moreTo && (
          <Link to={moreTo} className={styles.more} aria-label={`Ver todo: ${title}`}>
            Ver todo ›
          </Link>
        )}
      </div>
      <div className={styles.viewport}>
        <div className={styles.scroller} ref={scroller}>
          {videos.map((video, i) => (
            <VideoCard key={video.id} video={video} favorite={favs.has(video.id)} rank={ranked ? i + 1 : undefined} />
          ))}
        </div>
        {canPrev && (
          <button type="button" className={[styles.arrow, styles.prev].join(' ')} onClick={() => step(-1)} aria-label={`Anterior en ${title}`}>
            <span aria-hidden>‹</span>
          </button>
        )}
        {canNext && (
          <button type="button" className={[styles.arrow, styles.next].join(' ')} onClick={() => step(1)} aria-label={`Siguiente en ${title}`}>
            <span aria-hidden>›</span>
          </button>
        )}
      </div>
    </section>
  );
}

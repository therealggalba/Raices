import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { ui } from '../components/ui-styles';
import { VideoCard } from '../components/VideoCard';
import { useChannel } from '../hooks/channel-context';
import { buildTimeline } from '../utils/catalog';
import { formatPartialDate } from '../utils/dates';
import styles from './TimelinePage.module.scss';

/** Alternative navigation: memories by the year they happened. */
export function TimelinePage() {
  const { snapshot } = useChannel();
  const { hash } = useLocation();
  const timeline = buildTimeline(snapshot.videos);
  const favs = new Set(snapshot.favoriteVideoIds);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  if (!timeline.length) {
    return (
      <EmptyState icon="◷">
        <p>La cronología aparecerá cuando el canal tenga vídeos.</p>
      </EmptyState>
    );
  }

  return (
    <div className={[ui.page, ui.pageWide].join(' ')}>
      <div className={ui.pageHeader}>
        <h1>Cronología</h1>
        <span className={ui.muted}>
          {timeline[0].year} – {timeline.at(-1)!.year}
        </span>
      </div>
      <nav className={styles.years} aria-label="Ir al año">
        {timeline.map(({ year }) => (
          <a key={year} href={`#y${year}`} className={ui.chip}>
            {year}
          </a>
        ))}
      </nav>
      <ol className={styles.timeline}>
        {timeline.map(({ year, videos }) => (
          <li key={year} id={`y${year}`} className={styles.year}>
            <h2 className={styles.yearLabel}>{year}</h2>
            <ul className={styles.entries}>
              {videos.map((video) => (
                <li key={video.id} className={styles.entry}>
                  <VideoCard
                    video={video}
                    favorite={favs.has(video.id)}
                    caption={formatPartialDate(video.eventDate)}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

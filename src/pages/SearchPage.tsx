import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { ui } from '../components/ui-styles';
import { VideoCard } from '../components/VideoCard';
import { useChannel } from '../hooks/channel-context';
import { searchVideos } from '../utils/catalog';
import { formatPartialDate } from '../utils/dates';
import { fullName } from '../utils/people';
import styles from './SearchPage.module.scss';

export function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').slice(0, 80);
  const { snapshot } = useChannel();
  const names = Object.fromEntries(snapshot.people.map((p) => [p.id, fullName(p)]));
  const results = searchVideos(snapshot.videos, query, names);
  const favs = new Set(snapshot.favoriteVideoIds);

  return (
    <div className={[ui.page, ui.pageWide].join(' ')}>
      <h1>Resultados para «{query}»</h1>
      {results.length === 0 ? (
        <EmptyState icon="🔍">
          <p>No hay recuerdos que coincidan. Prueba con un nombre, un lugar o una etiqueta.</p>
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {results.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              channelId={snapshot.channel.id}
              favorite={favs.has(video.id)}
              caption={formatPartialDate(video.eventDate)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

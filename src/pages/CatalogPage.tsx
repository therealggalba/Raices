import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, EmptyState } from '../components/ui';
import { ui } from '../components/ui-styles';
import { VideoCard } from '../components/VideoCard';
import { useLibrary } from '../hooks/library-context';
import { CATALOG_SORTS, VIDEO_CATEGORIES } from '../types/domain';
import type { CatalogFilters, CatalogSort } from '../types/domain';
import {
  activeFilterCount,
  availableCategories,
  availableDecades,
  catalogParams,
  filterCatalog,
  parseCatalogParams,
} from '../utils/catalogFilters';
import { formatPartialDate } from '../utils/dates';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../utils/labels';
import { fullName, sortPeople } from '../utils/people';
import styles from './CatalogPage.module.scss';

const SORT_LABELS: Record<CatalogSort, string> = {
  added: 'Añadidos recientemente',
  'memory-desc': 'Recuerdo más reciente',
  'memory-asc': 'Recuerdo más antiguo',
  views: 'Más vistos',
  title: 'Título (A-Z)',
};

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/** The complete catalog: every video of every channel, with filters in the URL. */
export function CatalogPage() {
  const { library, channelById } = useLibrary();
  const [params, setParams] = useSearchParams();
  const filters = parseCatalogParams(params);
  const active = activeFilterCount(filters);
  const [showFilters, setShowFilters] = useState(active > 0);
  const results = filterCatalog(library, filters);
  const favs = new Set(library.favoriteVideoIds);
  const categories = availableCategories(library.videos, VIDEO_CATEGORIES);
  const decades = availableDecades(library.videos);
  const multiChannel = library.channels.length > 1;

  // Several changes in the same tick must each build on the previous one;
  // react-router's setParams(prev => …) still sees the URL of the last render.
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  }, [params]);
  type Patch = Partial<CatalogFilters> | ((current: CatalogFilters) => Partial<CatalogFilters>);
  const update = (patch: Patch) => {
    const current = parseCatalogParams(latest.current);
    const next = catalogParams({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) });
    latest.current = next;
    setParams(next, { replace: true });
  };

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <h1>Catálogo</h1>
        <div className={styles.searchRow}>
          <input
            type="search"
            className={[ui.input, styles.search].join(' ')}
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="Buscar por título, persona, lugar, canal…"
            aria-label="Buscar en el catálogo"
            maxLength={80}
            autoFocus={params.get('buscar') === '1'}
          />
          <Button
            aria-expanded={showFilters}
            aria-controls="catalog-filters"
            variant={active ? 'primary' : 'secondary'}
            onClick={() => setShowFilters((s) => !s)}
          >
            Filtros{active ? ` (${active})` : ''}
          </Button>
        </div>

        {showFilters && (
          <div id="catalog-filters" className={styles.filters}>
            {multiChannel && (
              <fieldset className={styles.group}>
                <legend>Canales</legend>
                <div className={ui.chips}>
                  {library.channels.map((c) => {
                    const on = filters.channelIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        className={[ui.chip, on ? ui.chipActive : ''].join(' ')}
                        onClick={() => update((f) => ({ channelIds: toggle(f.channelIds, c.id) }))}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            <fieldset className={styles.group}>
              <legend>Tipo de evento</legend>
              <div className={ui.chips}>
                {categories.map((cat) => {
                  const on = filters.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={on}
                      className={[ui.chip, on ? ui.chipActive : ''].join(' ')}
                      onClick={() => update((f) => ({ categories: toggle(f.categories, cat) }))}
                    >
                      <span aria-hidden>{CATEGORY_ICONS[cat]}</span> {CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className={styles.selects}>
              <label className={styles.select}>
                <span>Década</span>
                <select
                  className={ui.input}
                  value={filters.decade ?? ''}
                  onChange={(e) => update({ decade: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">Todas</option>
                  {decades.map((d) => (
                    <option key={d} value={d}>
                      Años {String(d).slice(2)} ({d})
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.select}>
                <span>Persona</span>
                <select
                  className={ui.input}
                  value={filters.personId ?? ''}
                  onChange={(e) => update({ personId: e.target.value || undefined })}
                >
                  <option value="">Cualquiera</option>
                  {sortPeople(library.people).map((p) => (
                    <option key={p.id} value={p.id}>
                      {fullName(p)}
                      {multiChannel ? ` · ${channelById(p.channelId)?.name ?? ''}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={filters.favoritesOnly}
                onChange={(e) => update({ favoritesOnly: e.target.checked })}
              />
              Solo mis favoritos
            </label>
            {active > 0 && (
              <div>
                <Button
                  variant="ghost"
                  small
                  onClick={() =>
                    update({ channelIds: [], categories: [], personId: undefined, decade: undefined, favoritesOnly: false })
                  }
                >
                  Quitar filtros
                </Button>
              </div>
            )}
          </div>
        )}

        <div className={styles.resultsBar}>
          <span className={ui.muted} role="status">
            {results.length === library.videos.length
              ? `${results.length} vídeos`
              : `${results.length} de ${library.videos.length} vídeos`}
          </span>
          <label className={styles.sort}>
            <span className={styles.srOnly}>Ordenar</span>
            <select
              className={ui.input}
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as CatalogSort })}
            >
              {CATALOG_SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState icon="🔍">
          <p>Ningún vídeo coincide con la búsqueda o los filtros.</p>
          {(active > 0 || filters.query) && (
            <Button onClick={() => setParams(new URLSearchParams(), { replace: true })}>Ver todo el catálogo</Button>
          )}
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {results.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              favorite={favs.has(video.id)}
              caption={`${multiChannel ? `${channelById(video.channelId)?.name ?? ''} · ` : ''}${formatPartialDate(video.eventDate)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

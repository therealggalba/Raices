import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Cromo } from '../components/Cromo';
import { PackArt } from '../components/PackArt';
import { EmptyState, ErrorBanner, LinkButton } from '../components/ui';
import { useLibrary } from '../hooks/library-context';
import { useScrollArrows } from '../hooks/useScrollArrows';
import { repository } from '../services';
import { errorMessage } from '../services/repository';
import type { PackPull } from '../types/domain';
import { packStatusText } from '../utils/packs';
import styles from './OpenPackPage.module.scss';

/** Fraction of the pack width the finger must travel along the top to cut it. */
const CUT_THRESHOLD = 0.7;
/** Duration of the tear + cards-out animation before the preview. */
const TEAR_MS = 1300;

type Phase = 'ready' | 'tearing' | 'reveal';

/**
 * Opening a pack: swipe along the top edge to cut it open (TCG Pocket style),
 * the top flies off, the cromos come out and are previewed one by one in a
 * carousel («¡NUEVA!» on the ones just unlocked) until the viewer approves.
 * The pack is consumed the moment it is cut.
 */
export function OpenPackPage() {
  const { channelId = '' } = useParams();
  const { library, channelById, personById, reload } = useLibrary();
  const channel = channelById(channelId);
  const [phase, setPhase] = useState<Phase>('ready');
  const [pulls, setPulls] = useState<PackPull[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cut, setCut] = useState(0);
  const [nudge, setNudge] = useState(false);
  const drag = useRef<{ startX: number; min: number; max: number; width: number; left: number } | null>(null);
  const { ref: carouselRef, canPrev, canNext, step } = useScrollArrows<HTMLDivElement>([pulls.length, phase]);
  const [current, setCurrent] = useState(0);
  const hasCards = library.cards.some((c) => c.channelId === channelId);

  // Which cromo of the carousel is centred.
  useEffect(() => {
    const el = carouselRef.current;
    if (phase !== 'reveal' || !el) return;
    const onScroll = () => setCurrent(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [phase, carouselRef]);

  if (!channel || !hasCards) {
    return (
      <EmptyState icon="🎁">
        <p>Este álbum no existe o todavía no tiene cromos.</p>
        <LinkButton to="/sobres">Ver mis sobres</LinkButton>
      </EmptyState>
    );
  }

  async function open() {
    if (phase !== 'ready') return;
    setPhase('tearing');
    setError(null);
    try {
      const [result] = await Promise.all([
        repository.openPack(channelId),
        new Promise((resolve) => setTimeout(resolve, TEAR_MS)),
      ]);
      setPulls(result);
      setPhase('reveal');
      void reload();
    } catch (e) {
      setError(errorMessage(e));
      setPhase('ready');
      setCut(0);
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== 'ready') return;
    const rect = e.currentTarget.getBoundingClientRect();
    try {
      // Keep receiving moves even if the finger leaves the strip.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Not fatal: the cut still works while the finger stays on the strip.
    }
    drag.current = { startX: e.clientX, min: e.clientX, max: e.clientX, width: rect.width, left: rect.left };
    setNudge(false);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.min = Math.min(d.min, e.clientX);
    d.max = Math.max(d.max, e.clientX);
    const progress = Math.min(1, (d.max - d.min) / d.width);
    setCut(progress);
    if (progress >= CUT_THRESHOLD) {
      drag.current = null;
      setCut(1);
      void open();
    }
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (phase === 'ready') {
      setCut(0);
      setNudge(true);
    }
  };

  if (library.packs.remaining === 0 && phase === 'ready') {
    return (
      <EmptyState icon="🎁">
        <p>{packStatusText(library.packs)}</p>
        <LinkButton to={`/albumes/${channel.id}`}>Ver el álbum</LinkButton>
      </EmptyState>
    );
  }

  if (phase === 'reveal') {
    const fresh = pulls.filter((p) => p.isNew).length;
    return (
      <div className={styles.reveal}>
        <header className={styles.revealHeader}>
          <h1>¡Sobre abierto!</h1>
          <p>
            {fresh > 0 ? `${fresh} ${fresh === 1 ? 'cromo nuevo' : 'cromos nuevos'}` : 'Ningún cromo nuevo'}
            {pulls.length - fresh > 0 && ` · ${pulls.length - fresh} ${pulls.length - fresh === 1 ? 'repetido' : 'repetidos'}`}
          </p>
        </header>
        <div className={styles.carouselViewport}>
          <div className={styles.carousel} ref={carouselRef} aria-label="Cromos del sobre">
            {pulls.map((pull, i) => (
              <div key={`${pull.card.id}-${i}`} className={styles.slide} style={{ animationDelay: `${i * 90}ms` }}>
                <Cromo
                  card={pull.card}
                  person={pull.card.personId ? personById(pull.card.personId) : undefined}
                  locked={false}
                  copies={pull.copies}
                  ribbon={pull.isNew ? '¡NUEVA!' : undefined}
                />
              </div>
            ))}
          </div>
          {canPrev && (
            <button type="button" className={[styles.arrow, styles.prev].join(' ')} onClick={() => step(-1)} aria-label="Cromo anterior">
              ‹
            </button>
          )}
          {canNext && (
            <button type="button" className={[styles.arrow, styles.next].join(' ')} onClick={() => step(1)} aria-label="Cromo siguiente">
              ›
            </button>
          )}
        </div>
        <div className={styles.dots} aria-hidden>
          {pulls.map((p, i) => (
            <span key={i} className={[i === current ? styles.dotOn : '', p.isNew ? styles.dotNew : ''].join(' ')} />
          ))}
        </div>
        <p className={styles.position}>
          {Math.min(current + 1, pulls.length)} / {pulls.length}
        </p>
        <div className={styles.actions}>
          {library.packs.remaining > 0 ? (
            <>
              <LinkButton to="/sobres" variant="primary">
                🎁 Abrir otro sobre ({library.packs.remaining})
              </LinkButton>
              <LinkButton to={`/albumes/${channel.id}`}>Ver el álbum</LinkButton>
            </>
          ) : (
            <>
              <LinkButton to={`/albumes/${channel.id}`} variant="primary">
                Ver el álbum
              </LinkButton>
              <LinkButton to="/albumes">Ver álbumes</LinkButton>
            </>
          )}
        </div>
      </div>
    );
  }

  const tearing = phase === 'tearing';
  return (
    <div className={styles.page}>
      <Link to="/sobres" className={styles.back}>
        ‹ Sobres
      </Link>
      <p className={styles.instructions}>
        {tearing ? '¡Abriendo…!' : nudge ? '¡Sigue deslizando hasta el otro lado!' : 'Desliza el dedo por la parte de arriba para abrir el sobre'}
      </p>

      <div className={[styles.stage, tearing ? styles.tearing : ''].join(' ')}>
        <PackArt theme={channel.packTheme} title={channel.name} className={[styles.half, styles.top].join(' ')} />
        <PackArt theme={channel.packTheme} title={channel.name} className={[styles.half, styles.body].join(' ')} />
        <div className={styles.cardsOut} aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ ['--i' as string]: i }} />
          ))}
        </div>
        {!tearing && (
          <div
            className={styles.cutZone}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <span className={styles.cutLine} />
            <span className={styles.cutProgress} style={{ width: `${cut * 100}%` }} />
            {cut === 0 && (
              <span className={styles.scissors} aria-hidden>
                ✂
              </span>
            )}
          </div>
        )}
      </div>

      <ErrorBanner message={error} />
      <p className={styles.allowance}>{packStatusText(library.packs)}</p>
      {!tearing && (
        <button type="button" className={styles.fallback} onClick={() => void open()}>
          ¿No puedes deslizar? Abrir el sobre
        </button>
      )}
    </div>
  );
}

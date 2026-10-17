import { Link, useNavigate, useParams } from 'react-router-dom';
import { Cromo } from '../components/Cromo';
import { Button, EmptyState, ErrorBanner, LinkButton } from '../components/ui';
import { useLibrary } from '../hooks/library-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import { NO_PERSON, albumSections, cardNeighbours } from '../utils/album';
import styles from './CardPage.module.scss';

/** One cromo, full size, with previous/next of the same person. */
export function CardPage() {
  const { channelId = '', cardId = '' } = useParams();
  const navigate = useNavigate();
  const { library, reload, channelById, personById } = useLibrary();
  const { run, pending, error } = useAction();
  const channel = channelById(channelId);
  const cards = library.cards.filter((c) => c.channelId === channelId);
  const card = cards.find((c) => c.id === cardId);
  const albumUrl = `/albumes/${channelId}`;

  if (!channel || !card) {
    return (
      <EmptyState icon="🃏">
        <p>Este cromo no existe o ha sido eliminado.</p>
        <LinkButton to={channel ? albumUrl : '/albumes'}>Volver al álbum</LinkButton>
      </EmptyState>
    );
  }

  const copies = library.cardCopies[card.id] ?? 0;
  const locked = copies === 0;
  const person = card.personId ? personById(card.personId) : undefined;
  const sectionId = person ? person.id : NO_PERSON;
  const people = library.people.filter((p) => p.channelId === channelId);
  const section = albumSections(cards, people).find((s) => s.id === sectionId);
  const { prev, next } = section ? cardNeighbours(section, card.id) : {};
  const position = section ? section.cards.findIndex((c) => c.id === card.id) + 1 : 0;
  const back = `${albumUrl}?persona=${sectionId}`;

  return (
    <div className={styles.page}>
      <div className={styles.nav}>
        <Link to={back} className={styles.back}>
          ‹ {person ? person.firstName : 'Varios'}
        </Link>
        {section && (
          <span className={styles.position}>
            {position} / {section.cards.length}
          </span>
        )}
      </div>

      <div className={styles.stage}>
        {prev ? (
          <Link to={`${albumUrl}/${prev.id}`} className={[styles.arrow, styles.prev].join(' ')} aria-label={`Anterior: ${prev.title}`}>
            ‹
          </Link>
        ) : (
          <span />
        )}
        <Cromo key={card.id} card={card} person={person} locked={locked} copies={copies} />
        {next ? (
          <Link to={`${albumUrl}/${next.id}`} className={[styles.arrow, styles.next].join(' ')} aria-label={`Siguiente: ${next.title}`}>
            ›
          </Link>
        ) : (
          <span />
        )}
      </div>

      <div className={styles.info}>
        {locked ? (
          <p className={styles.lockedNote}>
            Desbloquea este cromo abriendo sobres para ver la foto y el recuerdo que hay detrás.
          </p>
        ) : (
          card.description && <p className={styles.description}>{card.description}</p>
        )}
        {channel.role === 'admin' && (
          <div className={styles.actions}>
            <LinkButton to={`/c/${channel.id}/album/${card.id}/editar`} small>
              Editar
            </LinkButton>
            <Button
              variant="danger"
              small
              disabled={pending}
              onClick={async () => {
                if (!confirmAction(`¿Eliminar el cromo #${card.number} «${card.title}»? Su número no se volverá a usar.`)) return;
                const done = await run(async () => {
                  await repository.deleteCard(channel.id, card.id);
                  return true;
                });
                if (done) {
                  await reload();
                  navigate(back, { replace: true });
                }
              }}
            >
              Eliminar
            </Button>
          </div>
        )}
        <ErrorBanner message={error} />
      </div>
    </div>
  );
}

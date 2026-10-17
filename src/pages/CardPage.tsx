import { Link, useNavigate, useParams } from 'react-router-dom';
import { Cromo } from '../components/Cromo';
import { Button, EmptyState, ErrorBanner, LinkButton } from '../components/ui';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import { NO_PERSON, albumSections, cardNeighbours } from '../utils/album';
import { RARITY_LABELS } from '../utils/labels';
import styles from './CardPage.module.scss';

/** One cromo, full size, with previous/next of the same person. */
export function CardPage() {
  const { cardId = '' } = useParams();
  const navigate = useNavigate();
  const { snapshot, isAdmin, reload, personById } = useChannel();
  const { run, pending, error } = useAction();
  const { channel, cards, people } = snapshot;
  const card = cards.find((c) => c.id === cardId);
  const base = `/c/${channel.id}/album`;

  if (!card) {
    return (
      <EmptyState icon="🃏">
        <p>Este cromo no existe o ha sido eliminado.</p>
        <LinkButton to={base}>Volver al álbum</LinkButton>
      </EmptyState>
    );
  }

  const person = card.personId ? personById(card.personId) : undefined;
  const sectionId = person ? person.id : NO_PERSON;
  const section = albumSections(cards, people).find((s) => s.id === sectionId);
  const { prev, next } = section ? cardNeighbours(section, card.id) : {};
  const position = section ? section.cards.findIndex((c) => c.id === card.id) + 1 : 0;

  return (
    <div className={styles.page}>
      <div className={styles.nav}>
        <Link to={`${base}#album-${sectionId}`} className={styles.back}>
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
          <Link to={`${base}/${prev.id}`} className={[styles.arrow, styles.prev].join(' ')} aria-label={`Anterior: ${prev.title}`}>
            ‹
          </Link>
        ) : (
          <span className={styles.arrowSpace} />
        )}
        <Cromo key={card.id} card={card} person={person} />
        {next ? (
          <Link to={`${base}/${next.id}`} className={[styles.arrow, styles.next].join(' ')} aria-label={`Siguiente: ${next.title}`}>
            ›
          </Link>
        ) : (
          <span className={styles.arrowSpace} />
        )}
      </div>

      <div className={styles.info}>
        <p className={styles.rarity}>{RARITY_LABELS[card.rarity]}</p>
        {card.description && <p className={styles.description}>{card.description}</p>}
        {isAdmin && (
          <div className={styles.actions}>
            <LinkButton to={`${base}/${card.id}/editar`} small>
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
                  navigate(`${base}#album-${sectionId}`, { replace: true });
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

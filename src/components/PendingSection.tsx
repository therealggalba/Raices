import { Link } from 'react-router-dom';
import { Button } from './ui';
import { useChannel } from '../hooks/channel-context';
import { useAction } from '../hooks/useAction';
import { confirmAction } from '../hooks/useConfirm';
import { repository } from '../services';
import { ErrorBanner } from './ui';
import type { AlbumCard, ContentKind, Video } from '../types/domain';
import { thumbnailFor } from '../utils/media';
import { canManage } from '../utils/permissions';
import { fullName } from '../utils/people';
import styles from './PendingSection.module.scss';

type Item = { kind: ContentKind; id: string; title: string; image?: string; authorId: string; about: string; detail: string };

/**
 * Videos and cromos waiting for approval. The owner reviews everybody's
 * (approve, edit or reject); the rest see their own uploads while they wait.
 */
export function PendingSection() {
  const { snapshot, reload, personById } = useChannel();
  const { run, pending, error } = useAction();
  const { channel, me, members } = snapshot;
  const owner = canManage(me);
  const names = (ids: string[]) =>
    ids
      .map((id) => personById(id))
      .filter((p) => !!p)
      .map((p) => fullName(p))
      .join(', ');
  const fromVideo = (v: Video): Item => ({
    kind: 'video',
    id: v.id,
    title: v.title,
    image: thumbnailFor(v) ?? undefined,
    authorId: v.authorId,
    about: names(v.personIds),
    detail: v.mediaUrl,
  });
  const fromCard = (c: AlbumCard): Item => ({
    kind: 'card',
    id: c.id,
    title: c.title,
    image: c.imageUrl,
    authorId: c.authorId,
    about: c.personId ? names([c.personId]) : 'Varios',
    detail: c.description,
  });
  const items = [...snapshot.pending.videos.map(fromVideo), ...snapshot.pending.cards.map(fromCard)];
  if (items.length === 0) return null;

  const author = (id: string) => members.find((m) => m.userId === id)?.displayName ?? 'Alguien que ya no está';
  const editUrl = (item: Item) =>
    item.kind === 'video' ? `/c/${channel.id}/v/${item.id}/editar` : `/c/${channel.id}/album/${item.id}/editar`;
  const approve = (item: Item) =>
    run(async () => {
      await repository.approveContent(channel.id, item.kind, item.id);
      await reload();
    });
  const remove = (item: Item, question: string) => {
    if (!confirmAction(question)) return;
    void run(async () => {
      if (item.kind === 'video') await repository.deleteVideo(channel.id, item.id);
      else await repository.deleteCard(channel.id, item.id);
      await reload();
    });
  };

  return (
    <section className={styles.section} aria-label="Pendiente de aprobación">
      <h2 className={styles.title}>
        {owner ? 'Por revisar' : 'Esperando aprobación'} <span>{items.length}</span>
      </h2>
      <p className={styles.hint}>
        {owner
          ? 'Lo que suben los demás no se publica hasta que lo apruebes.'
          : 'El creador del canal lo revisará antes de que lo vean los demás.'}
      </p>
      <ErrorBanner message={error} />
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className={styles.item}>
            <div className={[styles.thumb, item.kind === 'card' ? styles.thumbCard : ''].join(' ')}>
              {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span aria-hidden>▶</span>}
            </div>
            <div className={styles.body}>
              <span className={styles.kind}>{item.kind === 'video' ? 'Vídeo' : 'Cromo'}</span>
              <strong className={styles.name}>{item.title}</strong>
              <span className={styles.meta}>
                {owner && <>De {author(item.authorId)} · </>}
                {item.about || 'Sin personas'}
              </span>
              {item.detail &&
                (item.kind === 'video' ? (
                  <a className={styles.link} href={item.detail} target="_blank" rel="noopener noreferrer">
                    Ver el vídeo
                  </a>
                ) : (
                  <span className={styles.detail}>{item.detail}</span>
                ))}
              <div className={styles.actions}>
                {owner && (
                  <Button variant="primary" small disabled={pending} onClick={() => void approve(item)}>
                    Aprobar
                  </Button>
                )}
                <Link className={styles.secondary} to={editUrl(item)}>
                  Editar
                </Link>
                <Button
                  variant="ghost"
                  small
                  disabled={pending}
                  onClick={() =>
                    remove(item, owner && item.authorId !== me.userId ? `¿Rechazar «${item.title}»? Se borrará.` : `¿Retirar «${item.title}»?`)
                  }
                >
                  {owner && item.authorId !== me.userId ? 'Rechazar' : 'Retirar'}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

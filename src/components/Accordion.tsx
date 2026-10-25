import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Accordion.module.scss';

export interface AccordionPanel {
  id: string;
  title: string;
  /** Small counter next to the title (hidden when 0). */
  badge?: number;
  tone?: 'danger';
  /** Rendered only while open (a panel's data loads when it is opened). */
  content: ReactNode;
}

/**
 * Collapsed sections, one open at a time: opening one closes the rest.
 * Tapping the open one closes it.
 */
export function Accordion({ panels, initial }: { panels: AccordionPanel[]; initial?: string }) {
  const [open, setOpen] = useState<string | null>(initial ?? null);
  const base = useId();
  const headers = useRef(new Map<string, HTMLButtonElement>());

  // The panel above may have just collapsed: keep the opened one in view.
  useEffect(() => {
    if (open) headers.current.get(open)?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  return (
    <div className={styles.accordion}>
      {panels.map((panel) => {
        const isOpen = open === panel.id;
        const bodyId = `${base}-${panel.id}`;
        return (
          <section key={panel.id} className={[styles.panel, panel.tone === 'danger' ? styles.danger : ''].join(' ')}>
            <h2 className={styles.heading}>
              <button
                ref={(el) => {
                  if (el) headers.current.set(panel.id, el);
                  else headers.current.delete(panel.id);
                }}
                type="button"
                className={styles.header}
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => setOpen(isOpen ? null : panel.id)}
              >
                <span className={styles.title}>{panel.title}</span>
                {!!panel.badge && <span className={styles.badge}>{panel.badge}</span>}
                <span className={styles.chevron} aria-hidden />
              </button>
            </h2>
            {isOpen && (
              <div id={bodyId} className={styles.body}>
                {panel.content}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

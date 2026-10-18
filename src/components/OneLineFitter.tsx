import { useEffect } from 'react';

/** Texts that must stay on one line (plus h1-h3, buttons and labels, styled nowrap). */
const SELECTOR = 'h1, h2, h3, .one-line, [data-one-line]';
/** Never smaller than this share of the designed size. */
const MIN_SCALE = 0.7;

/** Shrinks one text until it fits its line (the CSS adds «…» if even that isn't enough). */
function fitOneLine(el: HTMLElement): void {
  el.style.fontSize = '';
  if (el.clientWidth === 0 || el.scrollWidth <= el.clientWidth + 1) return;
  const base = parseFloat(getComputedStyle(el).fontSize);
  const scale = Math.max(MIN_SCALE, (el.clientWidth / el.scrollWidth) * 0.98);
  el.style.fontSize = `${(base * scale).toFixed(2)}px`;
}

/**
 * App-wide rule: a title, button, notice or label never breaks into two
 * lines. Whenever the page changes or the screen turns, every such text is
 * fitted to its width. Long texts (descriptions, biographies) are not touched.
 */
export function OneLineFitter() {
  useEffect(() => {
    // A short pause groups the many changes of one render into one pass.
    let timer = 0;
    const fitAll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        document.querySelectorAll<HTMLElement>(SELECTOR).forEach(fitOneLine);
      }, 60);
    };
    // Only content changes (our own font-size tweaks are attribute changes: ignored).
    const observer = new MutationObserver(fitAll);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', fitAll);
    void document.fonts?.ready.then(fitAll);
    fitAll();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fitAll);
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}

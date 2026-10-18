import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import styles from './PhotoCropper.module.scss';

interface Props {
  file: Blob;
  /** Width / height of the result (cromo 3/4, person 1, cover 16/9). */
  aspect: number;
  /** Longest side of the result, in pixels. */
  maxSide: number;
  onDone(cropped: Blob): void;
  onCancel(): void;
}

interface View {
  x: number;
  y: number;
  scale: number;
}

/** Keeps the photo covering the whole frame. */
function clamp(view: View, frameW: number, frameH: number, imgW: number, imgH: number, minScale: number): View {
  const scale = Math.min(Math.max(view.scale, minScale), minScale * 5);
  const x = Math.min(0, Math.max(frameW - imgW * scale, view.x));
  const y = Math.min(0, Math.max(frameH - imgH * scale, view.y));
  return { x, y, scale };
}

/**
 * Frame the photo before uploading it: drag to move it, pinch (or the
 * slider) to zoom. The frame has the shape the photo will have in the app,
 * so what you see is what everybody will see.
 */
export function PhotoCropper({ file, aspect, maxSide, onDone, onCancel }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  // Null until the user moves it: then it starts centred, covering the frame.
  const [moved, setView] = useState<View | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: View; dist: number; mid: { x: number; y: number } } | null>(null);

  // The photo is painted once on a canvas the size of the original.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!bitmap || !canvas) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  }, [bitmap]);

  // Decode respecting the phone's rotation (EXIF).
  useEffect(() => {
    let cancelled = false;
    createImageBitmap(file, { imageOrientation: 'from-image' }).then(
      (b) => (cancelled ? b.close() : setBitmap(b)),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Frame size: as wide as possible, with the requested shape.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.min(el.parentElement!.clientWidth, 520, (window.innerHeight * 0.6) * aspect);
      setFrame({ w, h: w / aspect });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [aspect]);

  const minScale = bitmap && frame.w ? Math.max(frame.w / bitmap.width, frame.h / bitmap.height) : 1;

  const view: View =
    moved ??
    (bitmap && frame.w
      ? { scale: minScale, x: (frame.w - bitmap.width * minScale) / 2, y: (frame.h - bitmap.height * minScale) / 2 }
      : { x: 0, y: 0, scale: 1 });

  const update = (next: View) => {
    if (bitmap) setView(clamp(next, frame.w, frame.h, bitmap.width, bitmap.height, minScale));
  };

  /** Zoom keeping the point (px, py) of the frame still. */
  const zoomAt = (base: View, scale: number, px: number, py: number): View => {
    const ratio = scale / base.scale;
    return { scale, x: px - (px - base.x) * ratio, y: py - (py - base.y) * ratio };
  };

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = frameRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const [a, b] = pts;
      gesture.current = {
        view,
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    } else if (pts.length === 1) {
      gesture.current = { view, dist: 0, mid: pts[0] };
    }
  };

  const crop = async () => {
    if (!bitmap) return;
    setBusy(true);
    // Part of the original photo inside the frame.
    const sx = -view.x / view.scale;
    const sy = -view.y / view.scale;
    const sw = frame.w / view.scale;
    const sh = frame.h / view.scale;
    const outScale = Math.min(1, maxSide / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * outScale));
    canvas.height = Math.max(1, Math.round(sh * outScale));
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (blob && blob.type === 'image/webp') onDone(blob);
        else setError(true);
      },
      'image/webp',
      0.82,
    );
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Encuadrar la foto">
      <div className={styles.sheet}>
        <h2 className={styles.title}>Encuadra la foto</h2>
        <div className={styles.stage}>
          <div
            ref={frameRef}
            className={styles.frame}
            style={{ width: frame.w || undefined, height: frame.h || undefined }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              pointers.current.set(e.pointerId, local(e));
              startGesture();
            }}
            onPointerMove={(e) => {
              if (!pointers.current.has(e.pointerId) || !gesture.current) return;
              pointers.current.set(e.pointerId, local(e));
              const pts = [...pointers.current.values()];
              const g = gesture.current;
              if (pts.length >= 2) {
                const [a, b] = pts;
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                const zoomed = zoomAt(g.view, g.view.scale * (dist / g.dist), g.mid.x, g.mid.y);
                update({ ...zoomed, x: zoomed.x + mid.x - g.mid.x, y: zoomed.y + mid.y - g.mid.y });
              } else {
                update({ ...g.view, x: g.view.x + pts[0].x - g.mid.x, y: g.view.y + pts[0].y - g.mid.y });
              }
            }}
            onPointerUp={(e) => {
              pointers.current.delete(e.pointerId);
              startGesture();
            }}
            onPointerCancel={(e) => {
              pointers.current.delete(e.pointerId);
              startGesture();
            }}
            onWheel={(e) => {
              const p = local(e);
              update(zoomAt(view, view.scale * (e.deltaY < 0 ? 1.1 : 0.9), p.x, p.y));
            }}
          >
            {bitmap && (
              <canvas
                ref={canvasRef}
                aria-hidden
                className={styles.image}
                style={{
                  width: bitmap.width,
                  height: bitmap.height,
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                }}
              />
            )}
            {!bitmap && !error && <span className={styles.loading}>Cargando…</span>}
          </div>
        </div>
        {error ? (
          <p className={styles.error}>No se ha podido abrir esa imagen. Prueba con otra foto.</p>
        ) : (
          <input
            className={styles.zoom}
            type="range"
            min={1}
            max={5}
            step={0.01}
            value={minScale ? view.scale / minScale : 1}
            onChange={(e) => update(zoomAt(view, minScale * Number(e.target.value), frame.w / 2, frame.h / 2))}
            aria-label="Zoom"
          />
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void crop()} disabled={!bitmap || busy}>
            {busy ? 'Preparando…' : 'Usar foto'}
          </Button>
        </div>
      </div>
    </div>
  );
}

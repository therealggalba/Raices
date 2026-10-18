// Photos are made small in the app before uploading: scaled down and saved
// as WebP. Cromos also get a tiny copy (it only has to look blurred).

/** Largest side, in pixels, for each use. */
export const PHOTO_MAX_SIDE = { cromo: 1080, persona: 512, miniatura: 1280 } as const;
/** Width of the copy shown while a cromo is locked (blurred further with CSS). */
export const BLURRED_WIDTH = 40;

/** Size that fits inside max×max keeping the proportions (never upscales). */
export function fitSize(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function decode(file: Blob): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image');
  // Respects the phone's rotation (EXIF) so portraits don't come out lying down.
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

function encode(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no-canvas'));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob && blob.type === 'image/webp' ? resolve(blob) : reject(new Error('no-webp'))),
      'image/webp',
      quality,
    ),
  );
}

/** The photo ready to upload (WebP, at most maxSide pixels on its longest side). */
export async function compressPhoto(file: Blob, maxSide: number): Promise<Blob> {
  const bitmap = await decode(file);
  try {
    const size = fitSize(bitmap.width, bitmap.height, maxSide);
    return await encode(bitmap, size.width, size.height, 0.8);
  } finally {
    bitmap.close();
  }
}

/** A tiny copy for locked cromos: too small to make out the original. */
export async function blurredCopy(file: Blob): Promise<Blob> {
  const bitmap = await decode(file);
  try {
    const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * BLURRED_WIDTH));
    return await encode(bitmap, BLURRED_WIDTH, height, 0.5);
  } finally {
    bitmap.close();
  }
}

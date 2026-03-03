export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_WIDTH = 600;
const MAX_HEIGHT = 750;
const JPEG_QUALITY = 0.85;
const MIN_SUBJECT_SCALE = 0.6;
const MAX_SUBJECT_SCALE = 1;

/**
 * Crop, downscale, and compress the selected region into a JPEG Blob.
 *
 * The output is capped at 600×750 px (4:5 portrait ratio at 2× retina) and
 * encoded as JPEG at quality 0.85 — small file size with no visible loss for
 * portrait-sized photos.
 */
export async function getCroppedBlob(
  imageSrc: string,
  cropArea: CropArea,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
  quality = JPEG_QUALITY,
  subjectScale = 1,
): Promise<Blob> {
  const image = await createImage(imageSrc);

  let outW = cropArea.width;
  let outH = cropArea.height;

  if (outW > maxWidth || outH > maxHeight) {
    const scale = Math.min(maxWidth / outW, maxHeight / outH);
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const clampedScale = Math.max(
    MIN_SUBJECT_SCALE,
    Math.min(MAX_SUBJECT_SCALE, subjectScale),
  );

  if (clampedScale < 0.999) {
    // Use a blurred version of the same crop as background fill.
    ctx.save();
    ctx.filter = 'blur(14px) brightness(0.72)';
    const bleed = 1.08;
    const bgW = outW * bleed;
    const bgH = outH * bleed;
    ctx.drawImage(
      image,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height,
      -(bgW - outW) / 2,
      -(bgH - outH) / 2,
      bgW,
      bgH,
    );
    ctx.restore();

    const drawW = outW * clampedScale;
    const drawH = outH * clampedScale;
    const drawX = (outW - drawW) / 2;
    const drawY = (outH - drawH) / 2;
    ctx.drawImage(
      image,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height,
      drawX,
      drawY,
      drawW,
      drawH,
    );
  } else {
    ctx.drawImage(
      image,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height,
      0,
      0,
      outW,
      outH,
    );
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      quality,
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

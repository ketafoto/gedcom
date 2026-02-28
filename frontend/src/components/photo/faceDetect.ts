import type { PercentCrop } from 'react-image-crop';

interface FaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ASPECT = 4 / 5;
const FACE_HEIGHT_RATIO = 0.6;
const FACE_VERT_POS = 0.4;

export function isFaceDetectorAvailable(): boolean {
  return 'FaceDetector' in window;
}

/**
 * Use the browser's Shape Detection API to find the largest face.
 * Available in Chrome / Edge; returns null elsewhere or on failure.
 */
export async function detectFace(
  image: HTMLImageElement,
): Promise<FaceBounds | null> {
  if (!isFaceDetectorAvailable()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).FaceDetector({ fastMode: true });
    const faces = await detector.detect(image);
    if (!faces.length) return null;

    const largest = faces.reduce((a: any, b: any) =>
      a.boundingBox.width * a.boundingBox.height >=
      b.boundingBox.width * b.boundingBox.height
        ? a
        : b,
    );
    const bb = largest.boundingBox;
    return { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
  } catch {
    return null;
  }
}

/**
 * Given a face bounding box (in natural-image pixels) compute the ideal
 * 4:5 crop so the face sits slightly above centre and occupies ~60 % of the
 * crop height.  The crop is clamped to the image boundaries.
 */
export function computeAutoCrop(
  face: FaceBounds,
  imageWidth: number,
  imageHeight: number,
): PercentCrop {
  let cropH = face.height / FACE_HEIGHT_RATIO;
  let cropW = cropH * ASPECT;

  if (cropW > imageWidth) {
    cropW = imageWidth;
    cropH = cropW / ASPECT;
  }
  if (cropH > imageHeight) {
    cropH = imageHeight;
    cropW = cropH * ASPECT;
  }

  const faceCenterX = face.x + face.width / 2;
  const faceCenterY = face.y + face.height / 2;
  let cropX = faceCenterX - cropW / 2;
  let cropY = faceCenterY - cropH * FACE_VERT_POS;

  cropX = Math.max(0, Math.min(cropX, imageWidth - cropW));
  cropY = Math.max(0, Math.min(cropY, imageHeight - cropH));

  return {
    unit: '%',
    x: (cropX / imageWidth) * 100,
    y: (cropY / imageHeight) * 100,
    width: (cropW / imageWidth) * 100,
    height: (cropH / imageHeight) * 100,
  };
}

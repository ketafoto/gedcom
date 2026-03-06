import { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
  convertToPixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Camera } from 'lucide-react';
import { Button } from '../common/Button';
import { getCroppedBlob } from './cropImage';

const ACCEPTED_FORMATS = '.jpg,.jpeg,.png,.webp,.heic,.heif';
const PORTRAIT_ASPECT = 4 / 5;
const PREVIEW_W = 88;
const PREVIEW_H = 110;

interface PhotoUploadDialogProps {
  individualId: number;
  sourceMediaId?: number;
  initialImageSrc?: string;
  initialAge?: number;
  initialIsDefault?: boolean;
  onUpload: (params: {
    blob: Blob;
    age: number;
    isDefault: boolean;
    sourceMediaId?: number;
  }) => Promise<void>;
  onClose: () => void;
}

export function PhotoUploadDialog({
  sourceMediaId,
  initialImageSrc,
  initialAge,
  initialIsDefault,
  onUpload,
  onClose,
}: PhotoUploadDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageSrc ?? null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [age, setAge] = useState(initialAge != null ? String(initialAge) : '');
  const [isDefault, setIsDefault] = useState(Boolean(initialIsDefault));
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [subjectScale, setSubjectScale] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setImageSrc(initialImageSrc ?? null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setAge(initialAge != null ? String(initialAge) : '');
    setIsDefault(Boolean(initialIsDefault));
    setIsUploading(false);
    setError('');
    setSubjectScale(1);
    setBrightness(100);
    setContrast(100);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [initialImageSrc, initialAge, initialIsDefault, sourceMediaId]);

  /* ---- file selection ---- */

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError('');
      setImageSrc(URL.createObjectURL(file));
      setCrop(undefined);
      setCompletedCrop(undefined);
    },
    [],
  );

  /* ---- image loaded ---- */

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      imgRef.current = img;
      const { naturalWidth: w, naturalHeight: h } = img;

      const initial = centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, PORTRAIT_ASPECT, w, h),
        w,
        h,
      );
      setCrop(initial);
      setCompletedCrop(convertToPixelCrop(initial, img.width, img.height));
    },
    [],
  );

  /* ---- preview canvas ---- */

  useEffect(() => {
    const c = completedCrop;
    const img = imgRef.current;
    const canvas = previewCanvasRef.current;
    if (!c || !img || !canvas || c.width === 0 || c.height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = PREVIEW_W * dpr;
    canvas.height = PREVIEW_H * dpr;

    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const clampedScale = Math.max(0.6, Math.min(1, subjectScale));

    if (clampedScale < 0.999) {
      // Match export composition: blurred background + centered scaled subject.
      ctx.save();
      ctx.filter = 'blur(10px) brightness(0.72)';
      const bleed = 1.08;
      const bgW = canvas.width * bleed;
      const bgH = canvas.height * bleed;
      ctx.drawImage(
        img,
        c.x * scaleX,
        c.y * scaleY,
        c.width * scaleX,
        c.height * scaleY,
        -(bgW - canvas.width) / 2,
        -(bgH - canvas.height) / 2,
        bgW,
        bgH,
      );
      ctx.restore();

      const drawW = canvas.width * clampedScale;
      const drawH = canvas.height * clampedScale;
      const drawX = (canvas.width - drawW) / 2;
      const drawY = (canvas.height - drawH) / 2;
      ctx.drawImage(
        img,
        c.x * scaleX,
        c.y * scaleY,
        c.width * scaleX,
        c.height * scaleY,
        drawX,
        drawY,
        drawW,
        drawH,
      );
    } else {
      ctx.drawImage(
        img,
        c.x * scaleX,
        c.y * scaleY,
        c.width * scaleX,
        c.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    }

    if (brightness !== 100 || contrast !== 100) {
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tmpCtx = tmp.getContext('2d')!;
      tmpCtx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = `brightness(${brightness / 100}) contrast(${contrast / 100})`;
      ctx.drawImage(tmp, 0, 0);
      ctx.filter = 'none';
    }
  }, [completedCrop, subjectScale, brightness, contrast]);

  /* ---- submit ---- */

  const handleOk = useCallback(async () => {
    if (!imageSrc || !completedCrop || !imgRef.current) return;

    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      setError('Please enter a valid age (0\u2013150)');
      return;
    }

    setIsUploading(true);
    setError('');
    try {
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      const blob = await getCroppedBlob(imageSrc, {
        x: completedCrop.x * scaleX,
        y: completedCrop.y * scaleY,
        width: completedCrop.width * scaleX,
        height: completedCrop.height * scaleY,
      }, undefined, undefined, undefined, subjectScale, brightness / 100, contrast / 100);
      await onUpload({
        blob,
        age: ageNum,
        isDefault,
        sourceMediaId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsUploading(false);
    }
  }, [
    imageSrc,
    completedCrop,
    age,
    isDefault,
    onUpload,
    sourceMediaId,
    subjectScale,
    brightness,
    contrast,
  ]);

  /* ---- render ---- */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {sourceMediaId ? 'Edit Photo' : 'Add Photo'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!imageSrc ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-64 border-2 border-dashed border-gray-300 rounded-xl
                         flex flex-col items-center justify-center gap-3
                         hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
            >
              <Camera className="w-12 h-12 text-gray-400" />
              <span className="text-gray-600 font-medium">
                Click to select a photo
              </span>
              <span className="text-xs text-gray-400">
                JPG, PNG, WebP, HEIC &middot; Max 20 MB
              </span>
            </button>
          ) : (
            <>
              <div className="flex gap-6 items-stretch">
                {/* Crop area */}
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-900 rounded-xl overflow-hidden inline-block">
                    <ReactCrop
                      crop={crop}
                      onChange={(_, pc) => setCrop(pc)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={PORTRAIT_ASPECT}
                      keepSelection
                      ruleOfThirds
                      renderSelectionAddon={() => (
                        <div
                          className="absolute inset-0 pointer-events-none flex justify-center"
                          style={{ paddingTop: '24.9%' }}
                        >
                          <div
                            className="relative rounded-full"
                            style={{ width: '57.6%', height: '73%' }}
                          >
                            <svg
                              className="absolute inset-0 w-full h-full"
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                            >
                              <ellipse
                                cx="50"
                                cy="50"
                                rx="49.5"
                                ry="49.5"
                                fill="none"
                                stroke="#000"
                                strokeWidth="1"
                                strokeDasharray="6 6"
                              >
                                <animate
                                  attributeName="stroke-dashoffset"
                                  from="0"
                                  to="-12"
                                  dur="1s"
                                  repeatCount="indefinite"
                                />
                              </ellipse>
                              <ellipse
                                cx="50"
                                cy="50"
                                rx="49.5"
                                ry="49.5"
                                fill="none"
                                stroke="#fff"
                                strokeWidth="1"
                                strokeDasharray="6 6"
                                strokeDashoffset="6"
                              >
                                <animate
                                  attributeName="stroke-dashoffset"
                                  from="-6"
                                  to="-18"
                                  dur="1s"
                                  repeatCount="indefinite"
                                />
                              </ellipse>
                            </svg>
                          </div>
                        </div>
                      )}
                    >
                      <img
                        src={imageSrc}
                        onLoad={onImageLoad}
                        className="max-h-[400px] max-w-full"
                        alt="Upload"
                      />
                    </ReactCrop>
                  </div>

                  <p className="text-[11px] text-gray-400 mt-1">
                    Align face to the oval guide for consistent carousel look.
                    Drag corners/edges to resize, drag inside to reposition.
                  </p>
                </div>

                {/* Right panel: preview + photo controls */}
                <div className="w-56 shrink-0 flex flex-col pt-1">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tree preview
                    </span>
                    <div
                      className="rounded-xl overflow-hidden ring-2 ring-gray-300 bg-gray-100"
                      style={{ width: PREVIEW_W, height: PREVIEW_H }}
                    >
                      <canvas
                        ref={previewCanvasRef}
                        style={{
                          width: PREVIEW_W,
                          height: PREVIEW_H,
                          display: 'block',
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Zoom out (add margin)
                      </label>
                      <input
                        type="range"
                        min={60}
                        max={100}
                        step={1}
                        value={Math.round(subjectScale * 100)}
                        onChange={(e) =>
                          setSubjectScale(Number(e.target.value) / 100)
                        }
                        className="w-full accent-emerald-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {Math.round(subjectScale * 100)}%
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Brightness
                      </label>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        step={1}
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">{brightness}%</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contrast
                      </label>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        step={1}
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                      <p className="text-xs text-gray-500 mt-1">{contrast}%</p>
                    </div>

                    <button
                      onClick={() => {
                        setImageSrc(null);
                        setCrop(undefined);
                        setCompletedCrop(undefined);
                        setSubjectScale(1);
                        setBrightness(100);
                        setContrast(100);
                        if (fileInputRef.current)
                          fileInputRef.current.value = '';
                      }}
                      className="text-sm text-emerald-600 hover:underline"
                    >
                      Choose different photo
                    </button>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Approximate age on photo{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={150}
                        value={age}
                        onChange={(e) => {
                          setAge(e.target.value);
                          setError('');
                        }}
                        placeholder="e.g. 25"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                                   focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600
                                   focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">
                        Set as default (show on tree)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleOk}
            disabled={!imageSrc || !completedCrop || !age || isUploading}
            isLoading={isUploading}
          >
            OK
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FORMATS}
        onChange={onFileSelect}
        className="hidden"
      />
    </div>
  );
}

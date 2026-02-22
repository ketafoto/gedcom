import { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { X, Camera, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '../common/Button';
import { getCroppedBlob } from './cropImage';

const ACCEPTED_FORMATS = '.jpg,.jpeg,.png,.webp,.heic,.heif';
const PORTRAIT_ASPECT = 4 / 5;

interface PhotoUploadDialogProps {
  individualId: number;
  onUpload: (blob: Blob, age: number, isDefault: boolean) => Promise<void>;
  onClose: () => void;
}

export function PhotoUploadDialog({
  onUpload,
  onClose,
}: PhotoUploadDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [age, setAge] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const objectUrl = URL.createObjectURL(file);
    setImageSrc(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleOk = useCallback(async () => {
    if (!imageSrc || !croppedArea) return;

    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      setError('Please enter a valid age (0–150)');
      return;
    }

    setIsUploading(true);
    setError('');
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      await onUpload(blob, ageNum, isDefault);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsUploading(false);
    }
  }, [imageSrc, croppedArea, age, isDefault, onUpload]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Photo</h2>
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
            /* File picker area */
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-64 border-2 border-dashed border-gray-300 rounded-xl
                         flex flex-col items-center justify-center gap-3
                         hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
            >
              <Camera className="w-12 h-12 text-gray-400" />
              <span className="text-gray-600 font-medium">Click to select a photo</span>
              <span className="text-xs text-gray-400">
                JPG, PNG, WebP, HEIC &middot; Max 20 MB
              </span>
            </button>
          ) : (
            /* Cropper */
            <>
              <div className="relative w-full h-80 bg-gray-900 rounded-xl overflow-hidden">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={PORTRAIT_ASPECT}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              {/* Zoom control */}
              <div className="flex items-center gap-3 px-2">
                <ZoomOut className="w-4 h-4 text-gray-400" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-emerald-600"
                />
                <ZoomIn className="w-4 h-4 text-gray-400" />
              </div>

              {/* Change photo link */}
              <button
                onClick={() => {
                  setImageSrc(null);
                  setCroppedArea(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-sm text-emerald-600 hover:underline"
              >
                Choose a different photo
              </button>
            </>
          )}

          {/* Age input + Set as default */}
          {imageSrc && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approximate age on photo <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={150}
                  value={age}
                  onChange={(e) => { setAge(e.target.value); setError(''); }}
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
                <span className="text-sm text-gray-700">Set as default (show on tree)</span>
              </label>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleOk}
            disabled={!imageSrc || !croppedArea || !age || isUploading}
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

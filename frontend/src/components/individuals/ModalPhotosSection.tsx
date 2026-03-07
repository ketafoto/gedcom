import { Camera, Edit2, Image, Star, Trash2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { mediaApi } from '../../api/media';
import type { Media } from '../../types/models';

interface ModalPhotosSectionProps {
  open: boolean;
  onClose: () => void;
  photos: Media[];
  photoCacheBust: number;
  onAddPhoto: () => void;
  onEditPhoto: (item: Media) => void;
  onSetDefault: (id: number) => void;
  onDeletePhoto: (id: number) => void;
  readOnly?: boolean;
}

export function ModalPhotosSection({
  open,
  onClose,
  photos,
  photoCacheBust,
  onAddPhoto,
  onEditPhoto,
  onSetDefault,
  onDeletePhoto,
  readOnly = false,
}: ModalPhotosSectionProps) {
  return (
    <Modal open={open} onClose={onClose} title="Photos" wide>
      <div className="space-y-4">
        {!readOnly && (
          <Button variant="secondary" size="sm" onClick={onAddPhoto}>
            <Camera className="w-4 h-4 mr-2" />
            Add Photo
          </Button>
        )}
        {photos.length === 0 ? (
          <div className="text-center py-8">
            <Image className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No photos yet</p>
            {!readOnly && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={onAddPhoto}>
                <Camera className="w-4 h-4 mr-1" />
                Add first photo
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((item) => (
              <div key={item.id} className="group relative">
                <div
                  className={`w-full aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden ring-2 ${
                    item.is_default ? 'ring-amber-400' : 'ring-transparent'
                  }`}
                >
                  <img
                    src={`${mediaApi.getFileUrl(item.id)}?v=${photoCacheBust}`}
                    alt={`Age ${item.age_on_photo ?? '?'}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                  age {item.age_on_photo ?? '?'}
                </span>
                {item.is_default && (
                  <Star className="absolute top-1 right-1 w-4 h-4 text-amber-400 fill-amber-400" />
                )}
                {!readOnly && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onEditPhoto(item)}
                      className="p-1.5 bg-white/90 rounded-full hover:bg-white"
                      title="Edit crop"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                    {!item.is_default && (
                      <button
                        type="button"
                        onClick={() => onSetDefault(item.id)}
                        className="p-1.5 bg-white/90 rounded-full hover:bg-white"
                        title="Set as default"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-500" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => window.confirm('Delete this photo?') && onDeletePhoto(item.id)}
                      className="p-1.5 bg-white/90 rounded-full hover:bg-white"
                      title="Delete photo"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

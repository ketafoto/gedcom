import { Image } from 'lucide-react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import type { Media } from '../../types/models';

interface ModalFamilyMediaProps {
  open: boolean;
  onClose: () => void;
  media: Media[];
}

export function ModalFamilyMedia({ open, onClose, media }: ModalFamilyMediaProps) {
  return (
    <Modal open={open} onClose={onClose} title="Media">
      <div className="space-y-4">
        {media.length === 0 ? (
          <div className="text-center py-8">
            <Image className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No media attached</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {media.map((item) => (
              <div key={item.id} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                <Image className="w-8 h-8 text-gray-400" />
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

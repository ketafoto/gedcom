import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface FamilyEntry {
  id: number;
  gedcom_id?: string;
  role: string;
}

interface ModalFamiliesSectionProps {
  open: boolean;
  onClose: () => void;
  families: FamilyEntry[];
}

export function ModalFamiliesSection({ open, onClose, families }: ModalFamiliesSectionProps) {
  return (
    <Modal open={open} onClose={onClose} title="Families">
      <div className="space-y-4">
        {families.length === 0 ? (
          <p className="text-gray-500 py-4">No family connections</p>
        ) : (
          <ul className="space-y-3">
            {families.map((f) => (
              <li key={f.id}>
                <Link
                  to={`/families/${f.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                    <Heart className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{f.gedcom_id || `Family ${f.id}`}</p>
                    <p className="text-sm text-gray-500">{f.role}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

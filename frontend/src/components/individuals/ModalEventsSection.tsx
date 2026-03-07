import { Calendar, Edit2, Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { typesApi } from '../../api/types';
import { sortEventsChronologically } from '../../utils/eventSort';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import type { Event } from '../../types/models';

interface ModalEventsSectionProps {
  open: boolean;
  onClose: () => void;
  events: Event[];
  onAddEvent: () => void;
  onEditEvent: (ev: Event) => void;
  onDeleteEvent: (ev: Event) => void;
  readOnly?: boolean;
}

export function ModalEventsSection({
  open,
  onClose,
  events,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  readOnly = false,
}: ModalEventsSectionProps) {
  const { data: eventTypes } = useQuery({
    queryKey: ['types', 'events'],
    queryFn: typesApi.getEventTypes,
  });
  const eventTypeByCode = (code: string) =>
    eventTypes?.find((t) => t.code === code)?.description ?? code;

  return (
    <Modal open={open} onClose={onClose} title="Events">
      <div className="space-y-4">
        {!readOnly && (
          <Button variant="secondary" size="sm" onClick={onAddEvent}>
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </Button>
        )}
        {events.length === 0 ? (
          <p className="text-gray-500 py-4">No events recorded</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortEventsChronologically(events).map((ev) => (
              <div key={ev.id} className="py-3 flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{eventTypeByCode(ev.event_type_code)}</p>
                  <p className="text-sm text-gray-600">
                    {ev.event_date || ev.event_date_approx}
                    {ev.event_place && ` • ${ev.event_place}`}
                  </p>
                  {ev.description && <p className="text-sm text-gray-500 mt-1">{ev.description}</p>}
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditEvent(ev)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                      title="Edit event"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => window.confirm('Delete this event?') && onDeleteEvent(ev)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Delete event"
                    >
                      <Trash2 className="w-4 h-4" />
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

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Trash2,
  Calendar,
  MapPin,
  Heart,
  User,
  Image,
} from 'lucide-react';
import { familiesApi } from '../../api/families';
import { individualsApi } from '../../api/individuals';
import { formatIndividualName, getLatestName } from '../../utils/nameUtils';
import { sortEventsChronologically } from '../../utils/eventSort';
import { eventsApi } from '../../api/events';
import { typesApi } from '../../api/types';
import { mediaApi } from '../../api/media';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import { EventFormDialog } from '../../components/events/EventFormDialog';
import { ModalEventsSection } from '../../components/individuals/ModalEventsSection';
import { ModalMarriage } from '../../components/families/ModalMarriage';
import { ModalDivorce } from '../../components/families/ModalDivorce';
import { ModalFamilyNotes } from '../../components/families/ModalFamilyNotes';
import { ModalSpouses } from '../../components/families/ModalSpouses';
import { ModalChildren } from '../../components/families/ModalChildren';
import { ModalFamilyMedia } from '../../components/families/ModalFamilyMedia';
import toast from 'react-hot-toast';
import type { Event } from '../../types/models';

type FamilySectionModal = 'spouses' | 'children' | 'marriage' | 'divorce' | 'events' | 'notes' | 'media' | null;

export function FamilyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: family, isLoading } = useQuery({
    queryKey: ['families', id],
    queryFn: () => familiesApi.get(Number(id)),
    enabled: !!id,
  });

  const { data: individuals } = useQuery({
    queryKey: ['individuals'],
    queryFn: () => individualsApi.list(),
  });

  const { data: events } = useQuery({
    queryKey: ['events', { family_id: Number(id) }],
    queryFn: () => eventsApi.list({ family_id: Number(id) }),
    enabled: !!id,
  });

  const { data: eventTypes } = useQuery({
    queryKey: ['types', 'events'],
    queryFn: typesApi.getEventTypes,
  });
  const eventTypeLabel = (code: string) =>
    eventTypes?.find((t) => t.code === code)?.description ?? code;

  const { data: media } = useQuery({
    queryKey: ['media', { family_id: Number(id) }],
    queryFn: () => mediaApi.list({ family_id: Number(id) }),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: familiesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      toast.success('Family deleted');
      navigate('/families');
    },
    onError: () => {
      toast.error('Failed to delete family');
    },
  });

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete this family?`)) {
      deleteMutation.mutate(Number(id));
    }
  };

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

  const deleteEventMutation = useMutation({
    mutationFn: eventsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', { family_id: Number(id) }] });
      toast.success('Event deleted');
    },
    onError: () => toast.error('Failed to delete event'),
  });

  // Helper to get individual by ID
  const getIndividual = (individualId: number) => {
    return individuals?.find((i) => i.id === individualId);
  };

  const getIndividualName = (individualId: number) => {
    const individual = getIndividual(individualId);
    if (!individual) return 'Unknown';
    return formatIndividualName(getLatestName(individual.names));
  };

  const [sectionModal, setSectionModal] = useState<FamilySectionModal>(null);
  const cardDoubleClick = (section: FamilySectionModal) => ({ onDoubleClick: () => setSectionModal(section) });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!family) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Family not found</p>
        <Link to="/families" className="text-emerald-600 hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/families')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center">
              <Heart className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{family.gedcom_id}</h1>
              <p className="text-gray-600 mt-1">
                {family.family_type || 'Family'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Spouses */}
          <Card title="Spouses / Partners" {...cardDoubleClick('spouses')}>
            {family.members.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No members added</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {family.members.map((member) => {
                  const individual = getIndividual(member.individual_id);
                  return (
                    <Link
                      key={member.individual_id}
                      to={`/individuals/${member.individual_id}`}
                      className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {getIndividualName(member.individual_id)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {member.role || 'Member'}
                          {individual?.birth_date && ` • Born ${individual.birth_date}`}
                        </p>
                      </div>
                      <span className="text-sm text-gray-400">
                        {individual?.gedcom_id}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Children */}
          <Card title="Children" {...cardDoubleClick('children')}>
            {family.children.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No children recorded</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {family.children.map((child) => {
                  const individual = getIndividual(child.child_id);
                  return (
                    <Link
                      key={child.child_id}
                      to={`/individuals/${child.child_id}`}
                      className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {getIndividualName(child.child_id)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {individual?.birth_date && `Born ${individual.birth_date}`}
                        </p>
                      </div>
                      <span className="text-sm text-gray-400">
                        {individual?.gedcom_id}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Marriage */}
          <Card title="Marriage" {...cardDoubleClick('marriage')}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {family.marriage_date || family.marriage_date_approx || 'No date recorded'}
                </p>
                {family.marriage_place ? (
                  <p className="text-gray-600 flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {family.marriage_place}
                  </p>
                ) : (
                  <p className="text-gray-500 text-sm mt-1">No place recorded</p>
                )}
              </div>
            </div>
          </Card>

          {/* Divorce */}
          <Card title="Divorce" {...cardDoubleClick('divorce')}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {family.divorce_date || family.divorce_date_approx || 'No date recorded'}
                </p>
              </div>
            </div>
          </Card>

          {/* Events */}
          <Card title="Family Events" {...cardDoubleClick('events')}>
            {(events?.length || 0) === 0 ? (
              <p className="text-gray-500 text-center py-4">No events recorded</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortEventsChronologically(events ?? []).map((ev) => (
                  <div key={ev.id} className="py-3 flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{eventTypeLabel(ev.event_type_code)}</p>
                      <p className="text-sm text-gray-600">
                        {ev.event_date || ev.event_date_approx}
                        {ev.event_place && ` • ${ev.event_place}`}
                      </p>
                      {ev.description && (
                        <p className="text-sm text-gray-500 mt-1">{ev.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card title="Notes" {...cardDoubleClick('notes')}>
            {family.notes ? (
              <p className="text-gray-700 whitespace-pre-wrap">{family.notes}</p>
            ) : (
              <p className="text-gray-500 text-sm">No notes recorded</p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Media */}
          <Card title="Media" {...cardDoubleClick('media')}>
            {(media?.length || 0) === 0 ? (
              <div className="text-center py-4">
                <Image className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">No media attached</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {media?.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center"
                  >
                    <Image className="w-8 h-8 text-gray-400" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Section modals */}
      {family && (
        <>
          <ModalSpouses open={sectionModal === 'spouses'} onClose={() => setSectionModal(null)} family={family} />
          <ModalChildren open={sectionModal === 'children'} onClose={() => setSectionModal(null)} family={family} />
          <ModalMarriage open={sectionModal === 'marriage'} onClose={() => setSectionModal(null)} family={family} />
          <ModalDivorce open={sectionModal === 'divorce'} onClose={() => setSectionModal(null)} family={family} />
          <ModalFamilyNotes open={sectionModal === 'notes'} onClose={() => setSectionModal(null)} family={family} />
          <ModalEventsSection
            open={sectionModal === 'events'}
            onClose={() => setSectionModal(null)}
            events={events ?? []}
            onAddEvent={() => {
              setEventToEdit(null);
              setEventDialogOpen(true);
            }}
            onEditEvent={(ev) => {
              setEventToEdit(ev);
              setEventDialogOpen(true);
            }}
            onDeleteEvent={(ev) => deleteEventMutation.mutate(ev.id)}
          />
          <ModalFamilyMedia
            open={sectionModal === 'media'}
            onClose={() => setSectionModal(null)}
            media={media ?? []}
          />
        </>
      )}

      <EventFormDialog
        open={eventDialogOpen}
        onClose={() => {
          setEventDialogOpen(false);
          setEventToEdit(null);
        }}
        familyId={id ? Number(id) : undefined}
        event={eventToEdit}
      />
    </div>
  );
}


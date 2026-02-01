import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Calendar,
  MapPin,
  Heart,
  Users,
  Image,
  Plus,
} from 'lucide-react';
import { familiesApi } from '../../api/families';
import { individualsApi } from '../../api/individuals';
import { eventsApi } from '../../api/events';
import { mediaApi } from '../../api/media';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import toast from 'react-hot-toast';

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

  // Helper to get individual by ID
  const getIndividual = (individualId: number) => {
    return individuals?.find((i) => i.id === individualId);
  };

  // Helper to get individual name
  const getIndividualName = (individualId: number) => {
    const individual = getIndividual(individualId);
    if (!individual) return 'Unknown';
    const name = individual.names[0];
    return name
      ? `${name.given_name || ''} ${name.family_name || ''}`.trim() || 'Unnamed'
      : 'Unnamed';
  };

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
          <Link to={`/families/${id}/edit`}>
            <Button variant="secondary">
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
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
          <Card title="Spouses / Partners">
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
          <Card
            title="Children"
            actions={
              <Button variant="ghost" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Child
              </Button>
            }
          >
            {family.children.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
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

          {/* Marriage Info */}
          {(family.marriage_date || family.marriage_date_approx || family.marriage_place) && (
            <Card title="Marriage">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {family.marriage_date || family.marriage_date_approx || 'Date unknown'}
                  </p>
                  {family.marriage_place && (
                    <p className="text-gray-600 flex items-center gap-1 mt-1">
                      <MapPin className="w-4 h-4" />
                      {family.marriage_place}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Divorce Info */}
          {(family.divorce_date || family.divorce_date_approx) && (
            <Card title="Divorce">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {family.divorce_date || family.divorce_date_approx}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Events */}
          <Card
            title="Family Events"
            actions={
              <Button variant="ghost" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Event
              </Button>
            }
          >
            {(events?.length || 0) === 0 ? (
              <p className="text-gray-500 text-center py-4">No events recorded</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {events?.map((event) => (
                  <div key={event.id} className="py-3 flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{event.event_type_code}</p>
                      <p className="text-sm text-gray-600">
                        {event.event_date || event.event_date_approx}
                        {event.event_place && ` • ${event.event_place}`}
                      </p>
                      {event.description && (
                        <p className="text-sm text-gray-500 mt-1">{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Notes */}
          {family.notes && (
            <Card title="Notes">
              <p className="text-gray-700 whitespace-pre-wrap">{family.notes}</p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Media */}
          <Card
            title="Media"
            actions={
              <Button variant="ghost" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            }
          >
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
    </div>
  );
}


import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Calendar,
  MapPin,
  Heart,
  Image,
  Plus,
} from 'lucide-react';
import { individualsApi } from '../../api/individuals';
import { familiesApi } from '../../api/families';
import { eventsApi } from '../../api/events';
import { mediaApi } from '../../api/media';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import toast from 'react-hot-toast';

export function IndividualDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: individual, isLoading } = useQuery({
    queryKey: ['individuals', id],
    queryFn: () => individualsApi.get(Number(id)),
    enabled: !!id,
  });

  const { data: families } = useQuery({
    queryKey: ['families'],
    queryFn: () => familiesApi.list(),
  });

  const { data: events } = useQuery({
    queryKey: ['events', { individual_id: Number(id) }],
    queryFn: () => eventsApi.list({ individual_id: Number(id) }),
    enabled: !!id,
  });

  const { data: media } = useQuery({
    queryKey: ['media', { individual_id: Number(id) }],
    queryFn: () => mediaApi.list({ individual_id: Number(id) }),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: individualsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] });
      toast.success('Individual deleted');
      navigate('/individuals');
    },
    onError: () => {
      toast.error('Failed to delete individual');
    },
  });

  const handleDelete = () => {
    const primaryName = individual?.names[0];
    const displayName = primaryName
      ? `${primaryName.given_name || ''} ${primaryName.family_name || ''}`.trim() || 'Unnamed'
      : 'Unnamed';

    if (window.confirm(`Are you sure you want to delete "${displayName}"?`)) {
      deleteMutation.mutate(Number(id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!individual) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Individual not found</p>
        <Link to="/individuals" className="text-emerald-600 hover:underline">
          Back to list
        </Link>
      </div>
    );
  }

  const primaryName = individual.names[0];
  const displayName = primaryName
    ? `${primaryName.given_name || ''} ${primaryName.family_name || ''}`.trim() || 'Unnamed'
    : 'Unnamed';

  // Find families where this individual is a member
  const relatedFamilies = (families || []).filter((family) =>
    family.members.some((m) => m.individual_id === Number(id)) ||
    family.children.some((c) => c.child_id === Number(id))
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/individuals')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
            <p className="text-gray-600 mt-1">{individual.gedcom_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/individuals/${id}/edit`}>
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
          {/* Basic Info */}
          <Card title="Basic Information">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Sex</dt>
                <dd className="mt-1 text-gray-900">{individual.sex_code || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">GEDCOM ID</dt>
                <dd className="mt-1 text-gray-900">{individual.gedcom_id || '-'}</dd>
              </div>
            </dl>
          </Card>

          {/* Birth */}
          <Card title="Birth">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {individual.birth_date || individual.birth_date_approx || 'Unknown'}
                </p>
                {individual.birth_place && (
                  <p className="text-gray-600 flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {individual.birth_place}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Death */}
          {(individual.death_date || individual.death_date_approx || individual.death_place) && (
            <Card title="Death">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {individual.death_date || individual.death_date_approx || 'Unknown'}
                  </p>
                  {individual.death_place && (
                    <p className="text-gray-600 flex items-center gap-1 mt-1">
                      <MapPin className="w-4 h-4" />
                      {individual.death_place}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Events */}
          <Card
            title="Events"
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
          {individual.notes && (
            <Card title="Notes">
              <p className="text-gray-700 whitespace-pre-wrap">{individual.notes}</p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Alternative Names */}
          {individual.names.length > 1 && (
            <Card title="Alternative Names">
              <ul className="space-y-2">
                {individual.names.slice(1).map((name, index) => (
                  <li key={index} className="text-gray-700">
                    {`${name.prefix || ''} ${name.given_name || ''} ${name.family_name || ''} ${name.suffix || ''}`.trim()}
                    {name.name_type && (
                      <span className="text-gray-500 text-sm ml-2">({name.name_type})</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Families */}
          <Card
            title="Families"
            actions={
              <Button variant="ghost" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            }
          >
            {relatedFamilies.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No family connections</p>
            ) : (
              <ul className="space-y-3">
                {relatedFamilies.map((family) => {
                  const isChild = family.children.some((c) => c.child_id === Number(id));
                  const member = family.members.find((m) => m.individual_id === Number(id));
                  const role = isChild ? 'Child' : member?.role || 'Member';

                  return (
                    <li key={family.id}>
                      <Link
                        to={`/families/${family.id}`}
                        className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                          <Heart className="w-4 h-4 text-rose-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{family.gedcom_id}</p>
                          <p className="text-sm text-gray-500">{role}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

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


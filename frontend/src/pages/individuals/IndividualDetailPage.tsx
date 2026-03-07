import { useEffect, useRef, useState, type ChangeEvent } from 'react';
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
  GitBranch,
  Star,
  Camera,
} from 'lucide-react';
import { individualsApi } from '../../api/individuals';
import { familiesApi } from '../../api/families';
import { eventsApi } from '../../api/events';
import { mediaApi } from '../../api/media';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import { PhotoUploadDialog } from '../../components/photo/PhotoUploadDialog';
import toast from 'react-hot-toast';
import { formatIndividualName, getLatestName } from '../../utils/nameUtils';
import type { Media } from '../../types/models';

interface IndividualDetailPageProps {
  readOnly?: boolean;
}

export function IndividualDetailPage({ readOnly = false }: IndividualDetailPageProps) {
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

  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<Media | null>(null);
  const [newPhotoSrc, setNewPhotoSrc] = useState<string | null>(null);
  const [photoCacheBust, setPhotoCacheBust] = useState(() => Date.now());
  const addPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (newPhotoSrc) URL.revokeObjectURL(newPhotoSrc);
    };
  }, [newPhotoSrc]);

  const handleStartAddPhoto = () => {
    if (addPhotoInputRef.current) {
      addPhotoInputRef.current.value = '';
      addPhotoInputRef.current.click();
    }
  };

  const handleAddPhotoFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setNewPhotoSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    setEditingPhoto(null);
    setShowPhotoDialog(true);
  };

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

  const deleteMediaMutation = useMutation({
    mutationFn: mediaApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', { individual_id: Number(id) }] });
      toast.success('Photo deleted');
    },
    onError: () => toast.error('Failed to delete photo'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: mediaApi.setDefault,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', { individual_id: Number(id) }] });
      toast.success('Default photo updated');
    },
    onError: () => toast.error('Failed to set default'),
  });

  const handlePhotoUpload = async ({
    blob,
    age,
    isDefault,
    sourceMediaId,
  }: {
    blob?: Blob;
    age: number;
    isDefault: boolean;
    sourceMediaId?: number;
  }) => {
    if (sourceMediaId && blob) {
      await mediaApi.recropPhoto({
        media_id: sourceMediaId,
        file: blob,
        age_on_photo: age,
        is_default: isDefault,
      });
      toast.success('Photo updated');
    } else if (sourceMediaId) {
      await mediaApi.update(sourceMediaId, {
        age_on_photo: age,
        is_default: isDefault,
      });
      toast.success('Photo updated');
    } else if (blob) {
      await mediaApi.uploadPhoto({
        file: blob,
        individual_id: Number(id),
        age_on_photo: age,
        is_default: isDefault,
      });
      toast.success('Photo uploaded');
    }
    queryClient.invalidateQueries({ queryKey: ['media', { individual_id: Number(id) }] });
    setPhotoCacheBust(Date.now());
    setEditingPhoto(null);
    setNewPhotoSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setShowPhotoDialog(false);
  };

  const handleDelete = () => {
    const displayName = formatIndividualName(getLatestName(individual?.names ?? []));

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
        <Link to={readOnly ? '/tree' : '/individuals'} className="text-emerald-600 hover:underline">
          {readOnly ? 'Back to tree' : 'Back to list'}
        </Link>
      </div>
    );
  }

  const primaryName = getLatestName(individual.names);
  const displayName = formatIndividualName(primaryName);

  // Find families where this individual is a member
  const relatedFamilies = (families || []).filter((family) =>
    family.members.some((m) => m.individual_id === Number(id)) ||
    family.children.some((c) => c.child_id === Number(id))
  );
  const sortedPhotoMedia = [...(media || [])]
    .filter((m) => m.media_type_code === 'photo')
    .sort((a, b) => {
      const ageA = a.age_on_photo ?? Number.POSITIVE_INFINITY;
      const ageB = b.age_on_photo ?? Number.POSITIVE_INFINITY;
      if (ageA !== ageB) return ageA - ageB;
      return a.id - b.id;
    });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(readOnly ? '/tree' : '/individuals')}
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
          <Link to={`/individuals/${id}/tree`}>
            <Button variant="secondary">
              <GitBranch className="w-4 h-4 mr-2" />
              View Tree
            </Button>
          </Link>
          {!readOnly && (
            <>
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
            </>
          )}
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
            actions={!readOnly ? (
              <Button variant="ghost" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Event
              </Button>
            ) : undefined}
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
            actions={!readOnly ? (
              <Button variant="ghost" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            ) : undefined}
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

          {/* Photos */}
          <Card
            title="Photos"
            actions={!readOnly ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleStartAddPhoto();
                }}
              >
                <Camera className="w-4 h-4 mr-1" />
                Add Photo
              </Button>
            ) : undefined}
          >
            {(media?.length || 0) === 0 ? (
              <div className="text-center py-4">
                <Image className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">No photos yet</p>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      handleStartAddPhoto();
                    }}
                  >
                    <Camera className="w-4 h-4 mr-1" />
                    Add first photo
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {sortedPhotoMedia.map((item) => (
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
                      {/* Age label */}
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                        age {item.age_on_photo ?? '?'}
                      </span>
                      {item.is_default && (
                        <Star className="absolute top-1 right-1 w-4 h-4 text-amber-400 fill-amber-400" />
                      )}
                      {/* Hover actions */}
                      {!readOnly && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors
                                        rounded-lg flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setEditingPhoto(item);
                              setNewPhotoSrc((prev) => {
                                if (prev) URL.revokeObjectURL(prev);
                                return null;
                              });
                              setShowPhotoDialog(true);
                            }}
                            className="p-1.5 bg-white/90 rounded-full hover:bg-white"
                            title="Edit crop"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                          {!item.is_default && (
                            <button
                              onClick={() => setDefaultMutation.mutate(item.id)}
                              className="p-1.5 bg-white/90 rounded-full hover:bg-white"
                              title="Set as default"
                            >
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this photo?'))
                                deleteMediaMutation.mutate(item.id);
                            }}
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
          </Card>
        </div>
      </div>

      {/* Photo upload dialog */}
      {!readOnly && showPhotoDialog && (
        <PhotoUploadDialog
          individualId={Number(id)}
          sourceMediaId={editingPhoto?.id}
          initialImageSrc={
            editingPhoto
              ? `${mediaApi.getFileUrl(editingPhoto.id)}?v=${photoCacheBust}`
              : newPhotoSrc ?? undefined
          }
          initialAge={editingPhoto?.age_on_photo}
          initialIsDefault={editingPhoto?.is_default}
          onUpload={handlePhotoUpload}
          onClose={() => {
            setShowPhotoDialog(false);
            setEditingPhoto(null);
            setNewPhotoSrc((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
          }}
        />
      )}

      <input
        ref={addPhotoInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
        onChange={handleAddPhotoFileSelected}
        className="hidden"
      />
    </div>
  );
}


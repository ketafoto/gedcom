import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../../api/events';
import { typesApi } from '../../api/types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { ApproxDateInput } from '../common/ApproxDateInput';
import toast from 'react-hot-toast';
import type { Event, EventCreate } from '../../types/models';

interface EventFormDialogProps {
  open: boolean;
  onClose: () => void;
  individualId?: number;
  familyId?: number;
  event?: Event | null;
  onSaved?: () => void;
}

type FormData = {
  event_type_code: string;
  event_date?: string;
  event_date_approx?: string;
  event_place?: string;
  description?: string;
};

const clean = (s: string | undefined) => (s?.trim() || undefined);

export function EventFormDialog({
  open,
  onClose,
  individualId,
  familyId,
  event,
  onSaved,
}: EventFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!event;

  const { data: eventTypes } = useQuery({
    queryKey: ['types', 'events'],
    queryFn: typesApi.getEventTypes,
  });

  const { data: approxDateTypes } = useQuery({
    queryKey: ['types', 'date-approx'],
    queryFn: typesApi.getDateApproxTypes,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    defaultValues: {
      event_type_code: '',
      event_date: '',
      event_date_approx: '',
      event_place: '',
      description: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (event) {
        reset({
          event_type_code: event.event_type_code || '',
          event_date: event.event_date || '',
          event_date_approx: event.event_date_approx || '',
          event_place: event.event_place || '',
          description: event.description || '',
        });
      } else {
        reset({
          event_type_code: '',
          event_date: '',
          event_date_approx: '',
          event_place: '',
          description: '',
        });
      }
    }
  }, [open, event, reset]);

  const createMutation = useMutation({
    mutationFn: (data: EventCreate) => eventsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event added');
      onClose();
      onSaved?.();
    },
    onError: () => toast.error('Failed to add event'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof eventsApi.update>[1] }) =>
      eventsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated');
      onClose();
      onSaved?.();
    },
    onError: () => toast.error('Failed to update event'),
  });

  const onSubmit = (data: FormData) => {
    const base = {
      event_type_code: data.event_type_code,
      event_date: clean(data.event_date) || undefined,
      event_date_approx: clean(data.event_date_approx),
      event_place: clean(data.event_place),
      description: clean(data.description),
    };

    if (isEdit && event) {
      updateMutation.mutate({ id: event.id, data: base });
    } else {
      createMutation.mutate({
        ...base,
        individual_id: individualId,
        family_id: familyId,
      });
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Edit Event' : 'Add Event'}
      elevated
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Event type</label>
          <select
            {...register('event_type_code', { required: 'Event type is required' })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">Select type...</option>
            {eventTypes?.map((t) => (
              <option key={t.code} value={t.code}>
                {t.description} ({t.code})
              </option>
            ))}
          </select>
          {errors.event_type_code && (
            <p className="text-sm text-red-600">{errors.event_type_code.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Date"
            type="date"
            {...register('event_date')}
          />
          <Controller
            control={control}
            name="event_date_approx"
            render={({ field }) => (
              <ApproxDateInput
                label="Approximate date"
                value={field.value}
                onChange={field.onChange}
                options={approxDateTypes}
              />
            )}
          />
        </div>

        <Input
          label="Place"
          {...register('event_place')}
          placeholder="Event location"
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            {...register('description')}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Optional description"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Add event'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

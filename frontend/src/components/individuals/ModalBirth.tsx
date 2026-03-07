import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { individualsApi } from '../../api/individuals';
import { typesApi } from '../../api/types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ApproxDateInput } from '../common/ApproxDateInput';
import { Modal } from '../common/Modal';
import toast from 'react-hot-toast';
import type { Individual } from '../../types/models';

interface ModalBirthProps {
  open: boolean;
  onClose: () => void;
  individual: Individual;
  onSaved?: () => void;
}

type FormData = { birth_date?: string; birth_date_approx?: string; birth_place?: string };

const clean = (s: string | undefined) => (s?.trim() || undefined);

export function ModalBirth({ open, onClose, individual, onSaved }: ModalBirthProps) {
  const queryClient = useQueryClient();
  const { data: approxDateTypes } = useQuery({
    queryKey: ['types', 'date-approx'],
    queryFn: typesApi.getDateApproxTypes,
  });
  const { register, control, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { birth_date: '', birth_date_approx: '', birth_place: '' },
  });

  useEffect(() => {
    if (open && individual) {
      reset({
        birth_date: individual.birth_date || '',
        birth_date_approx: individual.birth_date_approx || '',
        birth_place: individual.birth_place || '',
      });
    }
  }, [open, individual, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      individualsApi.update(individual.id, {
        birth_date: clean(data.birth_date) || undefined,
        birth_date_approx: clean(data.birth_date_approx),
        birth_place: clean(data.birth_place),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] });
      toast.success('Birth information updated');
      onClose();
      onSaved?.();
    },
    onError: () => toast.error('Failed to update'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Birth">
      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
        <Input label="Birth Date" type="date" {...register('birth_date')} />
        <Controller
          control={control}
          name="birth_date_approx"
          render={({ field }) => (
            <ApproxDateInput label="Approximate Date" value={field.value} onChange={field.onChange} options={approxDateTypes} />
          )}
        />
        <Input label="Birth Place" {...register('birth_place')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

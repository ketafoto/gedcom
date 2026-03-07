import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { familiesApi } from '../../api/families';
import { typesApi } from '../../api/types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ApproxDateInput } from '../common/ApproxDateInput';
import { Modal } from '../common/Modal';
import toast from 'react-hot-toast';
import type { Family } from '../../types/models';

interface ModalMarriageProps {
  open: boolean;
  onClose: () => void;
  family: Family;
  onSaved?: () => void;
}

type FormData = { marriage_date?: string; marriage_date_approx?: string; marriage_place?: string };

const clean = (s: string | undefined) => (s?.trim() || undefined);

export function ModalMarriage({ open, onClose, family, onSaved }: ModalMarriageProps) {
  const queryClient = useQueryClient();
  const { data: approxDateTypes } = useQuery({
    queryKey: ['types', 'date-approx'],
    queryFn: typesApi.getDateApproxTypes,
  });
  const { register, control, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { marriage_date: '', marriage_date_approx: '', marriage_place: '' },
  });

  useEffect(() => {
    if (open && family) {
      reset({
        marriage_date: family.marriage_date || '',
        marriage_date_approx: family.marriage_date_approx || '',
        marriage_place: family.marriage_place || '',
      });
    }
  }, [open, family, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      familiesApi.update(family.id, {
        marriage_date: clean(data.marriage_date) || undefined,
        marriage_date_approx: clean(data.marriage_date_approx),
        marriage_place: clean(data.marriage_place),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      toast.success('Marriage information updated');
      onClose();
      onSaved?.();
    },
    onError: () => toast.error('Failed to update'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Marriage">
      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
        <Input label="Marriage Date" type="date" {...register('marriage_date')} />
        <Controller
          control={control}
          name="marriage_date_approx"
          render={({ field }) => (
            <ApproxDateInput label="Approximate Date" value={field.value} onChange={field.onChange} options={approxDateTypes} />
          )}
        />
        <Input label="Marriage Place" {...register('marriage_place')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

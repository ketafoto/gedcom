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

interface ModalDeathProps {
  open: boolean;
  onClose: () => void;
  individual: Individual;
  onSaved?: () => void;
}

type FormData = { death_date?: string; death_date_approx?: string; death_place?: string };

const clean = (s: string | undefined) => (s?.trim() || undefined);

export function ModalDeath({ open, onClose, individual, onSaved }: ModalDeathProps) {
  const queryClient = useQueryClient();
  const { data: approxDateTypes } = useQuery({
    queryKey: ['types', 'date-approx'],
    queryFn: typesApi.getDateApproxTypes,
  });
  const { register, control, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { death_date: '', death_date_approx: '', death_place: '' },
  });

  useEffect(() => {
    if (open && individual) {
      reset({
        death_date: individual.death_date || '',
        death_date_approx: individual.death_date_approx || '',
        death_place: individual.death_place || '',
      });
    }
  }, [open, individual, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      individualsApi.update(individual.id, {
        death_date: clean(data.death_date) || undefined,
        death_date_approx: clean(data.death_date_approx),
        death_place: clean(data.death_place),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] });
      toast.success('Death information updated');
      onClose();
      onSaved?.();
    },
    onError: () => toast.error('Failed to update'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Death">
      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
        <Input label="Death Date" type="date" {...register('death_date')} />
        <Controller
          control={control}
          name="death_date_approx"
          render={({ field }) => (
            <ApproxDateInput label="Approximate Date" value={field.value} onChange={field.onChange} options={approxDateTypes} />
          )}
        />
        <Input label="Death Place" {...register('death_place')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

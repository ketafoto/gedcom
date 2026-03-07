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

interface ModalDivorceProps {
  open: boolean;
  onClose: () => void;
  family: Family;
  onSaved?: () => void;
}

type FormData = { divorce_date?: string; divorce_date_approx?: string };

const clean = (s: string | undefined) => (s?.trim() || undefined);

export function ModalDivorce({ open, onClose, family, onSaved }: ModalDivorceProps) {
  const queryClient = useQueryClient();
  const { data: approxDateTypes } = useQuery({
    queryKey: ['types', 'date-approx'],
    queryFn: typesApi.getDateApproxTypes,
  });
  const { register, control, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { divorce_date: '', divorce_date_approx: '' },
  });

  useEffect(() => {
    if (open && family) {
      reset({
        divorce_date: family.divorce_date || '',
        divorce_date_approx: family.divorce_date_approx || '',
      });
    }
  }, [open, family, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      familiesApi.update(family.id, {
        divorce_date: clean(data.divorce_date) || undefined,
        divorce_date_approx: clean(data.divorce_date_approx),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      toast.success('Divorce information updated');
      onClose();
      onSaved?.();
    },
    onError: () => toast.error('Failed to update'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Divorce">
      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
        <Input label="Divorce Date" type="date" {...register('divorce_date')} />
        <Controller
          control={control}
          name="divorce_date_approx"
          render={({ field }) => (
            <ApproxDateInput label="Approximate Date" value={field.value} onChange={field.onChange} options={approxDateTypes} />
          )}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

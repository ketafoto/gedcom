import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { individualsApi } from '../../api/individuals';
import { typesApi } from '../../api/types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import toast from 'react-hot-toast';
import type { Individual } from '../../types/models';

interface ModalBasicInfoProps {
  open: boolean;
  onClose: () => void;
  individual: Individual;
  onSaved?: () => void;
}

type FormData = { gedcom_id?: string; sex_code?: string };

export function ModalBasicInfo({ open, onClose, individual, onSaved }: ModalBasicInfoProps) {
  const queryClient = useQueryClient();
  const { data: sexTypes } = useQuery({
    queryKey: ['types', 'sex'],
    queryFn: typesApi.getSexTypes,
  });
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { gedcom_id: '', sex_code: '' },
  });

  useEffect(() => {
    if (open && individual) {
      reset({
        gedcom_id: individual.gedcom_id || '',
        sex_code: individual.sex_code || '',
      });
    }
  }, [open, individual, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      individualsApi.update(individual.id, { gedcom_id: data.gedcom_id?.trim() || undefined, sex_code: data.sex_code || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] });
      toast.success('Basic information updated');
      onClose();
      onSaved?.();
    },
    onError: () => toast.error('Failed to update'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Basic Information">
      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
        <Input label="GEDCOM ID" {...register('gedcom_id')} helperText="Leave blank to auto-generate" />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Sex</label>
          <select
            {...register('sex_code')}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select...</option>
            {sexTypes?.map((t) => (
              <option key={t.code} value={t.code}>{t.description} ({t.code})</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

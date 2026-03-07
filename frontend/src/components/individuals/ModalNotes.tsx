import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { individualsApi } from '../../api/individuals';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import toast from 'react-hot-toast';
import type { Individual } from '../../types/models';

interface ModalNotesProps {
  open: boolean;
  onClose: () => void;
  individual: Individual;
  onSaved?: () => void;
}

type FormData = { notes?: string };

export function ModalNotes({ open, onClose, individual, onSaved }: ModalNotesProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { notes: '' },
  });

  useEffect(() => {
    if (open && individual) {
      reset({ notes: individual.notes || '' });
    }
  }, [open, individual, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      individualsApi.update(individual.id, { notes: data.notes?.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] });
      toast.success('Notes updated');
      onClose();
      onSaved?.();
    },
    onError: () => toast.error('Failed to update'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Notes">
      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            {...register('notes')}
            rows={6}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Additional notes..."
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

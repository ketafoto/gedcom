import { useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { familiesApi } from '../../api/families';
import { individualsApi } from '../../api/individuals';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import toast from 'react-hot-toast';
import { formatIndividualName, getLatestName } from '../../utils/nameUtils';
import type { Family } from '../../types/models';

type FormData = { children: Array<{ child_id: number }> };

interface ModalChildrenProps {
  open: boolean;
  onClose: () => void;
  family: Family;
  onSaved?: () => void;
}

export function ModalChildren({ open, onClose, family, onSaved }: ModalChildrenProps) {
  const queryClient = useQueryClient();
  const { data: individuals } = useQuery({
    queryKey: ['individuals'],
    queryFn: () => individualsApi.list(),
  });
  const sortedIndividuals = useMemo(
    () =>
      individuals
        ?.slice()
        .sort((a, b) => formatIndividualName(getLatestName(a.names)).localeCompare(formatIndividualName(getLatestName(b.names)))) ?? [],
    [individuals]
  );
  const getIndividualName = (individualId: number) => {
    const ind = individuals?.find((i) => i.id === individualId);
    return ind ? formatIndividualName(getLatestName(ind.names)) : `ID: ${individualId}`;
  };

  const { register, control, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { children: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'children' });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => {
      const children = data.children.filter((c) => c.child_id && Number(c.child_id) !== 0);
      return familiesApi.update(family.id, {
        children: children.map((c) => ({ child_id: Number(c.child_id) })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      toast.success('Children updated');
      onClose();
      onSaved?.();
    },
    onError: () => toast.error('Failed to update'),
  });

  useEffect(() => {
    if (open && family) {
      reset({
        children: family.children.length > 0
          ? family.children.map((c) => ({ child_id: c.child_id }))
          : [{ child_id: 0 }],
      });
    }
  }, [open, family, reset]);

  return (
    <Modal open={open} onClose={onClose} title="Children" wide>
      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
              <div className="flex-1 space-y-1">
                <label className="block text-sm font-medium text-gray-700">Child</label>
                <select
                  {...register(`children.${index}.child_id`)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={0}>Select individual...</option>
                  {sortedIndividuals.map((ind) => (
                    <option key={ind.id} value={ind.id}>
                      {getIndividualName(ind.id)} ({ind.gedcom_id})
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={() => remove(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => append({ child_id: 0 })}>
            <Plus className="w-4 h-4 mr-2" />
            Add Child
          </Button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

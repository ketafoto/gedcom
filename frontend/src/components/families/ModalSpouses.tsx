import { useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { familiesApi } from '../../api/families';
import { individualsApi } from '../../api/individuals';
import { typesApi } from '../../api/types';
import { Button } from '../common/Button';
import { ComboSelect } from '../common/ComboSelect';
import { Modal } from '../common/Modal';
import toast from 'react-hot-toast';
import { formatIndividualName, getLatestName } from '../../utils/nameUtils';
import type { Family } from '../../types/models';

type FormData = { members: Array<{ individual_id: number; role?: string }> };

interface ModalSpousesProps {
  open: boolean;
  onClose: () => void;
  family: Family;
  onSaved?: () => void;
}

export function ModalSpouses({ open, onClose, family, onSaved }: ModalSpousesProps) {
  const queryClient = useQueryClient();
  const { data: individuals } = useQuery({
    queryKey: ['individuals'],
    queryFn: () => individualsApi.list(),
  });
  const { data: familyRoles } = useQuery({
    queryKey: ['types', 'family-roles'],
    queryFn: typesApi.getFamilyRoles,
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
    defaultValues: { members: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'members' });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => {
      const members = data.members.filter((m) => m.individual_id && Number(m.individual_id) !== 0);
      return familiesApi.update(family.id, {
        members: members.map((m) => ({ individual_id: Number(m.individual_id), role: m.role })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      toast.success('Spouses / partners updated');
      onClose();
      onSaved?.();
    },
    onError: () => toast.error('Failed to update'),
  });

  useEffect(() => {
    if (open && family) {
      reset({
        members: family.members.length > 0
          ? family.members.map((m) => ({ individual_id: m.individual_id, role: m.role || '' }))
          : [{ individual_id: 0, role: '' }],
      });
    }
  }, [open, family, reset]);

  return (
    <Modal open={open} onClose={onClose} title="Spouses / Partners" wide>
      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Individual</label>
                  <select
                    {...register(`members.${index}.individual_id`)}
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
                <ComboSelect
                  label="Role"
                  {...register(`members.${index}.role`)}
                  options={familyRoles}
                  placeholder="Select or type..."
                />
              </div>
              <button type="button" onClick={() => remove(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg mt-6">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => append({ individual_id: 0, role: '' })}>
            <Plus className="w-4 h-4 mr-2" />
            Add Spouse / Partner
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

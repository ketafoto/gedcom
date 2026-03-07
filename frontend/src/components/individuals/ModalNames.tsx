import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { individualsApi } from '../../api/individuals';
import { typesApi } from '../../api/types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import toast from 'react-hot-toast';
import type { Individual } from '../../types/models';

const nameSchema = z.object({
  name_type: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});
const formSchema = z.object({
  names: z.array(nameSchema).min(1, 'At least one name is required'),
});
type FormData = z.infer<typeof formSchema>;

interface ModalNamesProps {
  open: boolean;
  onClose: () => void;
  individual: Individual;
  onSaved?: () => void;
}

export function ModalNames({ open, onClose, individual, onSaved }: ModalNamesProps) {
  const queryClient = useQueryClient();
  const { data: nameTypes } = useQuery({
    queryKey: ['types', 'name-types'],
    queryFn: typesApi.getNameTypes,
  });
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { names: [{ given_name: '', family_name: '' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'names' });

  useEffect(() => {
    if (open && individual) {
      reset({
        names: individual.names.length > 0
          ? individual.names.map((n) => ({
              name_type: n.name_type || '',
              given_name: n.given_name || '',
              family_name: n.family_name || '',
              prefix: n.prefix || '',
              suffix: n.suffix || '',
            }))
          : [{ given_name: '', family_name: '' }],
      });
    }
  }, [open, individual, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      individualsApi.update(individual.id, {
        names: data.names.map((n, i) => ({ ...n, name_order: i })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] });
      toast.success('Names updated');
      onClose();
      onSaved?.();
    },
    onError: () => toast.error('Failed to update'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Names" wide>
      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="p-4 border border-gray-200 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {index === 0 ? 'Primary Name' : `Alternative Name ${index}`}
                </span>
                {index > 0 && (
                  <button type="button" onClick={() => remove(index)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex gap-4 min-w-0">
                  <div className="space-y-1 w-40 shrink-0">
                    <label className="block text-sm font-medium text-gray-700">Name Type</label>
                    <select
                      {...register(`names.${index}.name_type`)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select...</option>
                      {nameTypes?.map((t) => (
                        <option key={t.code} value={t.code}>{t.description}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Input label="Given Name" {...register(`names.${index}.given_name`)} error={errors.names?.[index]?.given_name?.message} />
                  </div>
                </div>
                <Input label="Family Name" {...register(`names.${index}.family_name`)} error={errors.names?.[index]?.family_name?.message} />
              </div>
            </div>
          ))}
          {errors.names?.message && <p className="text-sm text-red-600">{errors.names.message}</p>}
          <Button type="button" variant="secondary" onClick={() => append({ given_name: '', family_name: '' })}>
            <Plus className="w-4 h-4 mr-2" />
            Add Alternative Name
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

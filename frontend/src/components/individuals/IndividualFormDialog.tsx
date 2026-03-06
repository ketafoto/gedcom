import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { individualsApi } from '../../api/individuals';
import { typesApi } from '../../api/types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card } from '../common/Card';
import { Modal } from '../common/Modal';
import { ApproxDateInput } from '../common/ApproxDateInput';
import toast from 'react-hot-toast';
import type { Individual } from '../../types/models';

const nameSchema = z.object({
  name_type: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

const individualSchema = z.object({
  gedcom_id: z.string().optional(),
  sex_code: z.string().optional(),
  birth_date: z.string().optional(),
  birth_date_approx: z.string().optional(),
  birth_place: z.string().optional(),
  death_date: z.string().optional(),
  death_date_approx: z.string().optional(),
  death_place: z.string().optional(),
  notes: z.string().optional(),
  names: z.array(nameSchema).min(1, 'At least one name is required'),
});

type IndividualFormData = z.infer<typeof individualSchema>;

interface IndividualFormDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (individual: Individual) => void;
}

export function IndividualFormDialog({
  open,
  onClose,
  onCreated,
}: IndividualFormDialogProps) {
  const queryClient = useQueryClient();

  const { data: sexTypes } = useQuery({
    queryKey: ['types', 'sex'],
    queryFn: typesApi.getSexTypes,
  });

  const { data: nameTypes } = useQuery({
    queryKey: ['types', 'name-types'],
    queryFn: typesApi.getNameTypes,
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
    formState: { errors, isSubmitting },
  } = useForm<IndividualFormData>({
    resolver: zodResolver(individualSchema),
    defaultValues: {
      names: [{ given_name: '', family_name: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'names',
  });

  const createMutation = useMutation({
    mutationFn: individualsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] });
      toast.success('Individual created successfully');
      reset({ names: [{ given_name: '', family_name: '' }] });
      onCreated(data);
    },
    onError: () => {
      toast.error('Failed to create individual');
    },
  });

  const onSubmit = (data: IndividualFormData) => {
    const sanitized: IndividualFormData = {
      ...data,
      birth_date: data.birth_date?.trim() ? data.birth_date : undefined,
      death_date: data.death_date?.trim() ? data.death_date : undefined,
      birth_date_approx: data.birth_date_approx?.trim()
        ? data.birth_date_approx
        : undefined,
      death_date_approx: data.death_date_approx?.trim()
        ? data.death_date_approx
        : undefined,
    };

    createMutation.mutate({
      ...sanitized,
      names: sanitized.names.map((n, index) => ({ ...n, name_order: index })),
    });
  };

  const handleClose = () => {
    reset({ names: [{ given_name: '', family_name: '' }] });
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="New Individual" wide>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Names */}
        <Card title="Names">
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="p-4 border border-gray-200 rounded-lg space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {index === 0
                      ? 'Primary Name'
                      : `Alternative Name ${index}`}
                  </span>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex gap-4 min-w-0">
                    <div className="space-y-1 w-40 shrink-0">
                      <label className="block text-sm font-medium text-gray-700">
                        Name Type
                      </label>
                      <select
                        {...register(`names.${index}.name_type`)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="">Select...</option>
                        {nameTypes?.map((type) => (
                          <option key={type.code} value={type.code}>
                            {type.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input
                        label="Given Name"
                        {...register(`names.${index}.given_name`)}
                        error={errors.names?.[index]?.given_name?.message}
                      />
                    </div>
                  </div>
                  <Input
                    label="Family Name"
                    {...register(`names.${index}.family_name`)}
                    error={errors.names?.[index]?.family_name?.message}
                  />
                </div>
              </div>
            ))}
            {errors.names?.message && (
              <p className="text-sm text-red-600">{errors.names.message}</p>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => append({ given_name: '', family_name: '' })}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Alternative Name
            </Button>
          </div>
        </Card>

        {/* Basic Information */}
        <Card title="Basic Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="GEDCOM ID"
              {...register('gedcom_id')}
              helperText="Leave blank to auto-generate"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Sex
              </label>
              <select
                {...register('sex_code')}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select...</option>
                {sexTypes?.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.description} ({type.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Birth */}
        <Card title="Birth">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Birth Date"
              type="date"
              {...register('birth_date')}
            />
            <Controller
              control={control}
              name="birth_date_approx"
              render={({ field }) => (
                <ApproxDateInput
                  label="Approximate Date"
                  value={field.value}
                  onChange={field.onChange}
                  options={approxDateTypes}
                />
              )}
            />
            <div className="md:col-span-2">
              <Input label="Birth Place" {...register('birth_place')} />
            </div>
          </div>
        </Card>

        {/* Death */}
        <Card title="Death">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Death Date"
              type="date"
              {...register('death_date')}
            />
            <Controller
              control={control}
              name="death_date_approx"
              render={({ field }) => (
                <ApproxDateInput
                  label="Approximate Date"
                  value={field.value}
                  onChange={field.onChange}
                  options={approxDateTypes}
                />
              )}
            />
            <div className="md:col-span-2">
              <Input label="Death Place" {...register('death_place')} />
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card title="Notes">
          <textarea
            {...register('notes')}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Additional notes about this person..."
          />
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Individual
          </Button>
        </div>
      </form>
    </Modal>
  );
}

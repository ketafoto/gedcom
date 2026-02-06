import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { individualsApi } from '../../api/individuals';
import { typesApi } from '../../api/types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import { ApproxDateInput } from '../../components/common/ApproxDateInput';
import toast from 'react-hot-toast';

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

export function IndividualFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  // Fetch sex types for dropdown
  const { data: sexTypes } = useQuery({
    queryKey: ['types', 'sex'],
    queryFn: typesApi.getSexTypes,
  });

  // Fetch name types for dropdown
  const { data: nameTypes } = useQuery({
    queryKey: ['types', 'name-types'],
    queryFn: typesApi.getNameTypes,
  });

  // Fetch approximate date types for dropdown
  const { data: approxDateTypes } = useQuery({
    queryKey: ['types', 'date-approx'],
    queryFn: typesApi.getDateApproxTypes,
  });

  // Fetch existing individual if editing
  const { data: individual, isLoading: loadingIndividual } = useQuery({
    queryKey: ['individuals', id],
    queryFn: () => individualsApi.get(Number(id)),
    enabled: isEditing,
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

  // Populate form when editing
  useEffect(() => {
    if (individual) {
      reset({
        gedcom_id: individual.gedcom_id || '',
        sex_code: individual.sex_code || '',
        birth_date: individual.birth_date || '',
        birth_date_approx: individual.birth_date_approx || '',
        birth_place: individual.birth_place || '',
        death_date: individual.death_date || '',
        death_date_approx: individual.death_date_approx || '',
        death_place: individual.death_place || '',
        notes: individual.notes || '',
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
  }, [individual, reset]);

  const createMutation = useMutation({
    mutationFn: individualsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] });
      toast.success('Individual created successfully');
      navigate(`/individuals/${data.id}`);
    },
    onError: () => {
      toast.error('Failed to create individual');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: IndividualFormData }) =>
      individualsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] });
      toast.success('Individual updated successfully');
      navigate(`/individuals/${id}`);
    },
    onError: () => {
      toast.error('Failed to update individual');
    },
  });

  const onSubmit = async (data: IndividualFormData) => {
    if (isEditing) {
      updateMutation.mutate({ id: Number(id), data });
    } else {
      createMutation.mutate({
        ...data,
        names: data.names.map((n, index) => ({ ...n, name_order: index })),
      });
    }
  };

  if (isEditing && loadingIndividual) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Individual' : 'New Individual'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isEditing ? 'Update individual information' : 'Add a new person to your family tree'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Names Section */}
        <Card title="Names">
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border border-gray-200 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {index === 0 ? 'Primary Name' : `Alternative Name ${index}`}
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
                  <Input
                    label="Given Name"
                    {...register(`names.${index}.given_name`)}
                    error={errors.names?.[index]?.given_name?.message}
                  />
                  <Input
                    label="Family Name"
                    {...register(`names.${index}.family_name`)}
                    error={errors.names?.[index]?.family_name?.message}
                  />
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Name Type</label>
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
                  <Input
                    label="Prefix (e.g., Dr.)"
                    {...register(`names.${index}.prefix`)}
                  />
                  <Input
                    label="Suffix (e.g., Jr.)"
                    {...register(`names.${index}.suffix`)}
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
              <label className="block text-sm font-medium text-gray-700">Sex</label>
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

        {/* Birth Information */}
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
              <Input
                label="Birth Place"
                {...register('birth_place')}
              />
            </div>
          </div>
        </Card>

        {/* Death Information */}
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
              <Input
                label="Death Place"
                {...register('death_place')}
              />
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card title="Notes">
          <textarea
            {...register('notes')}
            rows={4}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Additional notes about this person..."
          />
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Individual'}
          </Button>
        </div>
      </form>
    </div>
  );
}


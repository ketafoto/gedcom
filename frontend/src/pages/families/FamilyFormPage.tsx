import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { familiesApi } from '../../api/families';
import { individualsApi } from '../../api/individuals';
import { typesApi } from '../../api/types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import { ApproxDateInput } from '../../components/common/ApproxDateInput';
import toast from 'react-hot-toast';

// Form data type - using simple types for form fields
interface FamilyFormData {
  gedcom_id?: string;
  marriage_date?: string;
  marriage_date_approx?: string;
  marriage_place?: string;
  divorce_date?: string;
  divorce_date_approx?: string;
  family_type?: string;
  notes?: string;
  members: Array<{ individual_id: number; role?: string }>;
  children: Array<{ child_id: number }>;
}

export function FamilyFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  // Get pre-selected members from URL (for "Create Family" from bulk select)
  const preSelectedMembers = searchParams.get('members')?.split(',').map(Number).filter(Boolean) || [];

  // Fetch individuals for dropdowns
  const { data: individuals } = useQuery({
    queryKey: ['individuals'],
    queryFn: () => individualsApi.list(),
  });

  // Fetch family roles for dropdown
  const { data: familyRoles } = useQuery({
    queryKey: ['types', 'family-roles'],
    queryFn: typesApi.getFamilyRoles,
  });

  // Fetch existing family if editing
  const { data: family, isLoading: loadingFamily } = useQuery({
    queryKey: ['families', id],
    queryFn: () => familiesApi.get(Number(id)),
    enabled: isEditing,
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
    formState: { isSubmitting },
  } = useForm<FamilyFormData>({
    defaultValues: {
      members: preSelectedMembers.map((memberId) => ({ individual_id: memberId, role: '' })),
      children: [],
    },
  });

  const {
    fields: memberFields,
    append: appendMember,
    remove: removeMember,
  } = useFieldArray({
    control,
    name: 'members',
  });

  const {
    fields: childFields,
    append: appendChild,
    remove: removeChild,
  } = useFieldArray({
    control,
    name: 'children',
  });

  // Populate form when editing
  useEffect(() => {
    if (family) {
      reset({
        gedcom_id: family.gedcom_id || '',
        marriage_date: family.marriage_date || '',
        marriage_date_approx: family.marriage_date_approx || '',
        marriage_place: family.marriage_place || '',
        divorce_date: family.divorce_date || '',
        divorce_date_approx: family.divorce_date_approx || '',
        family_type: family.family_type || '',
        notes: family.notes || '',
        members: family.members.map((m) => ({
          individual_id: m.individual_id,
          role: m.role || '',
        })),
        children: family.children.map((c) => ({
          child_id: c.child_id,
        })),
      });
    }
  }, [family, reset]);

  const createMutation = useMutation({
    mutationFn: familiesApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      toast.success('Family created successfully');
      navigate(`/families/${data.id}`);
    },
    onError: () => {
      toast.error('Failed to create family');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FamilyFormData }) =>
      familiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      toast.success('Family updated successfully');
      navigate(`/families/${id}`);
    },
    onError: () => {
      toast.error('Failed to update family');
    },
  });

  const onSubmit = async (data: FamilyFormData) => {
    if (isEditing) {
      updateMutation.mutate({ id: Number(id), data });
    } else {
      createMutation.mutate({
        ...data,
        members: data.members.map((m) => ({
          individual_id: Number(m.individual_id),
          role: m.role,
        })),
        children: data.children.map((c) => ({
          child_id: Number(c.child_id),
        })),
      });
    }
  };

  // Helper to get individual name
  const getIndividualName = (individualId: number) => {
    const individual = individuals?.find((i) => i.id === individualId);
    if (!individual) return `ID: ${individualId}`;
    const name = individual.names[0];
    return name
      ? `${name.given_name || ''} ${name.family_name || ''}`.trim() || 'Unnamed'
      : 'Unnamed';
  };

  if (isEditing && loadingFamily) {
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
            {isEditing ? 'Edit Family' : 'New Family'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isEditing ? 'Update family information' : 'Create a new family unit'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card title="Basic Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="GEDCOM ID"
              {...register('gedcom_id')}
              helperText="Leave blank to auto-generate"
            />
            <Input
              label="Family Type"
              {...register('family_type')}
              helperText="e.g., married, civil union"
            />
          </div>
        </Card>

        {/* Members Section */}
        <Card title="Spouses / Partners">
          <div className="space-y-4">
            {memberFields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Individual
                    </label>
                    <select
                      {...register(`members.${index}.individual_id`)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Select individual...</option>
                      {individuals?.map((ind) => (
                        <option key={ind.id} value={ind.id}>
                          {getIndividualName(ind.id)} ({ind.gedcom_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <select
                      {...register(`members.${index}.role`)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Select role...</option>
                      {familyRoles?.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.description} ({role.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeMember(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => appendMember({ individual_id: 0, role: '' })}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Spouse / Partner
            </Button>
          </div>
        </Card>

        {/* Children Section */}
        <Card title="Children">
          <div className="space-y-4">
            {childFields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex-1 space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Child
                  </label>
                  <select
                    {...register(`children.${index}.child_id`)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Select individual...</option>
                    {individuals?.map((ind) => (
                      <option key={ind.id} value={ind.id}>
                        {getIndividualName(ind.id)} ({ind.gedcom_id})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeChild(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => appendChild({ child_id: 0 })}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Child
            </Button>
          </div>
        </Card>

        {/* Marriage Information */}
        <Card title="Marriage">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Marriage Date"
              type="date"
              {...register('marriage_date')}
            />
            <Controller
              control={control}
              name="marriage_date_approx"
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
                label="Marriage Place"
                {...register('marriage_place')}
              />
            </div>
          </div>
        </Card>

        {/* Divorce Information */}
        <Card title="Divorce (if applicable)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Divorce Date"
              type="date"
              {...register('divorce_date')}
            />
            <Controller
              control={control}
              name="divorce_date_approx"
              render={({ field }) => (
                <ApproxDateInput
                  label="Approximate Date"
                  value={field.value}
                  onChange={field.onChange}
                  options={approxDateTypes}
                />
              )}
            />
          </div>
        </Card>

        {/* Notes */}
        <Card title="Notes">
          <textarea
            {...register('notes')}
            rows={4}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Additional notes about this family..."
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
            {isEditing ? 'Save Changes' : 'Create Family'}
          </Button>
        </div>
      </form>
    </div>
  );
}


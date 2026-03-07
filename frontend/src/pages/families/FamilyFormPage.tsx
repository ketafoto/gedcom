import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { ArrowLeft, Plus, Trash2, UserPlus } from 'lucide-react';
import { familiesApi } from '../../api/families';
import { individualsApi } from '../../api/individuals';
import { typesApi } from '../../api/types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import { ApproxDateInput } from '../../components/common/ApproxDateInput';
import { ComboSelect } from '../../components/common/ComboSelect';
import { IndividualFormDialog } from '../../components/individuals/IndividualFormDialog';
import toast from 'react-hot-toast';
import type { Individual } from '../../types/models';

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

type CreateTarget = 'member' | 'child';

export function FamilyFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const preSelectedMembers =
    searchParams
      .get('members')
      ?.split(',')
      .map(Number)
      .filter(Boolean) || [];

  // --- state for "create individual" dialog ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const createTargetRef = useRef<CreateTarget>('member');
  const [createdIndividualIds, setCreatedIndividualIds] = useState<number[]>(
    []
  );
  const [focusMemberIndex, setFocusMemberIndex] = useState<number | null>(null);
  const [focusChildIndex, setFocusChildIndex] = useState<number | null>(null);

  // --- data queries ---
  const { data: individuals } = useQuery({
    queryKey: ['individuals'],
    queryFn: () => individualsApi.list(),
  });

  const { data: familyRoles } = useQuery({
    queryKey: ['types', 'family-roles'],
    queryFn: typesApi.getFamilyRoles,
  });

  const { data: familyTypes } = useQuery({
    queryKey: ['types', 'family-types'],
    queryFn: typesApi.getFamilyTypes,
  });

  const { data: family, isLoading: loadingFamily } = useQuery({
    queryKey: ['families', id],
    queryFn: () => familiesApi.get(Number(id)),
    enabled: isEditing,
  });

  const { data: approxDateTypes } = useQuery({
    queryKey: ['types', 'date-approx'],
    queryFn: typesApi.getDateApproxTypes,
  });

  // --- form setup ---
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FamilyFormData>({
    defaultValues: {
      members: preSelectedMembers.map((memberId) => ({
        individual_id: memberId,
        role: '',
      })),
      children: [],
    },
  });

  const {
    fields: memberFields,
    append: appendMember,
    remove: removeMember,
  } = useFieldArray({ control, name: 'members' });

  const {
    fields: childFields,
    append: appendChild,
    remove: removeChild,
  } = useFieldArray({ control, name: 'children' });

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
        children: family.children.map((c) => ({ child_id: c.child_id })),
      });
    }
  }, [family, reset]);

  // --- mutations ---
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
    mutationFn: ({ fid, data }: { fid: number; data: FamilyFormData }) =>
      familiesApi.update(fid, data),
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
    const members = data.members.filter((m) => m.individual_id && Number(m.individual_id) !== 0);
    const children = data.children.filter((c) => c.child_id && Number(c.child_id) !== 0);

    if (isEditing) {
      updateMutation.mutate({ fid: Number(id), data: { ...data, members, children } });
    } else {
      createMutation.mutate({
        ...data,
        members: members.map((m) => ({
          individual_id: Number(m.individual_id),
          role: m.role,
        })),
        children: children.map((c) => ({
          child_id: Number(c.child_id),
        })),
      });
    }
  };

  // --- helpers ---
  const getIndividualName = (individualId: number) => {
    const individual = individuals?.find((i) => i.id === individualId);
    if (!individual) return `ID: ${individualId}`;
    const name = individual.names[0];
    return name
      ? `${name.given_name || ''} ${name.family_name || ''}`.trim() ||
          'Unnamed'
      : 'Unnamed';
  };

  const sortedIndividuals = useMemo(
    () =>
      individuals
        ?.slice()
        .sort((a, b) => getIndividualName(a.id).localeCompare(getIndividualName(b.id))) ?? [],
    [individuals]
  );

  // --- auto-focus newly added selects ---
  useEffect(() => {
    if (focusMemberIndex !== null) {
      requestAnimationFrame(() => {
        const sel = document.querySelector<HTMLSelectElement>(
          `select[name="members.${focusMemberIndex}.individual_id"]`
        );
        sel?.focus();
        sel?.showPicker?.();
      });
      setFocusMemberIndex(null);
    }
  }, [focusMemberIndex]);

  useEffect(() => {
    if (focusChildIndex !== null) {
      requestAnimationFrame(() => {
        const sel = document.querySelector<HTMLSelectElement>(
          `select[name="children.${focusChildIndex}.child_id"]`
        );
        sel?.focus();
        sel?.showPicker?.();
      });
      setFocusChildIndex(null);
    }
  }, [focusChildIndex]);

  // --- "create individual" dialog handlers ---
  const openCreateDialog = useCallback((target: CreateTarget) => {
    createTargetRef.current = target;
    setDialogOpen(true);
  }, []);

  const handleIndividualCreated = useCallback(
    (individual: Individual) => {
      setCreatedIndividualIds((prev) => [...prev, individual.id]);
      setDialogOpen(false);

      queryClient.setQueryData<Individual[]>(['individuals'], (old) =>
        old ? [...old, individual] : [individual]
      );

      if (createTargetRef.current === 'member') {
        appendMember({ individual_id: individual.id, role: '' });
      } else {
        appendChild({ child_id: individual.id });
      }
    },
    [appendMember, appendChild, queryClient]
  );

  // --- cancel with cleanup ---
  const handleCancel = useCallback(async () => {
    if (createdIndividualIds.length > 0) {
      const doDelete = window.confirm(
        `You created ${createdIndividualIds.length} individual(s) during this session.\n\nDo you want to delete them as well?`
      );
      if (doDelete) {
        try {
          await Promise.all(
            createdIndividualIds.map((iid) => individualsApi.delete(iid))
          );
          queryClient.invalidateQueries({ queryKey: ['individuals'] });
          toast.success('Created individuals deleted');
        } catch {
          toast.error('Some individuals could not be deleted');
        }
      }
    }
    navigate(-1);
  }, [createdIndividualIds, navigate, queryClient]);

  // --- render ---
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
            {isEditing
              ? 'Update family information'
              : 'Create a new family unit'}
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
            <ComboSelect
              label="Family Type"
              {...register('family_type')}
              options={familyTypes}
              placeholder="Select or type..."
              helperText="e.g., marriage, civil_union, or custom value"
            />
          </div>
        </Card>

        {/* Spouses / Partners */}
        <Card title="Spouses / Partners">
          <div className="space-y-4">
            {memberFields.map((field, index) => {
              const memberIdReg = register(`members.${index}.individual_id`);
              return (
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
                      {...memberIdReg}
                      onBlur={(e) => {
                        memberIdReg.onBlur(e);
                        if (!e.target.value) removeMember(index);
                      }}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Select individual...</option>
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
                <button
                  type="button"
                  onClick={() => removeMember(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-6"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              );
            })}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  appendMember({ individual_id: 0, role: '' });
                  setFocusMemberIndex(memberFields.length);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Spouse / Partner
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => openCreateDialog('member')}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Create Spouse / Partner
              </Button>
            </div>
          </div>
        </Card>

        {/* Children */}
        <Card title="Children">
          <div className="space-y-4">
            {childFields.map((field, index) => {
              const childIdReg = register(`children.${index}.child_id`);
              return (
              <div
                key={field.id}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex-1 space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Child
                  </label>
                  <select
                    {...childIdReg}
                    onBlur={(e) => {
                      childIdReg.onBlur(e);
                      if (!e.target.value) removeChild(index);
                    }}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Select individual...</option>
                    {sortedIndividuals.map((ind) => (
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
              );
            })}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  appendChild({ child_id: 0 });
                  setFocusChildIndex(childFields.length);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Child
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => openCreateDialog('child')}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Create Child
              </Button>
            </div>
          </div>
        </Card>

        {/* Marriage */}
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

        {/* Divorce */}
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
          <Button type="button" variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Family'}
          </Button>
        </div>
      </form>

      {/* Create Individual Dialog */}
      <IndividualFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleIndividualCreated}
      />
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Edit2, Trash2, Save, X, Users } from 'lucide-react';
import { individualsApi } from '../../api/individuals';
import { typesApi } from '../../api/types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import toast from 'react-hot-toast';
import type { Individual } from '../../types/models';
import { getLatestName, formatIndividualName } from '../../utils/nameUtils';

export function BulkEditIndividualsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Individual>>({});

  const { data: individuals, isLoading } = useQuery({
    queryKey: ['individuals'],
    queryFn: () => individualsApi.list(),
  });

  const { data: sexTypes } = useQuery({
    queryKey: ['types', 'sex'],
    queryFn: typesApi.getSexTypes,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Individual> }) =>
      individualsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] });
      setEditingId(null);
      toast.success('Individual updated');
    },
    onError: () => {
      toast.error('Failed to update individual');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: individualsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] });
      toast.success('Individual deleted');
    },
    onError: () => {
      toast.error('Failed to delete individual');
    },
  });

  // Filter individuals based on search
  const filteredIndividuals = useMemo(() => {
    if (!individuals) return [];
    if (!searchQuery) return individuals;

    const query = searchQuery.toLowerCase();
    return individuals.filter((ind) => {
      const name = getLatestName(ind.names);
      const fullName = formatIndividualName(name, '').toLowerCase();
      return (
        fullName.includes(query) ||
        ind.gedcom_id?.toLowerCase().includes(query) ||
        ind.birth_place?.toLowerCase().includes(query) ||
        ind.death_place?.toLowerCase().includes(query)
      );
    });
  }, [individuals, searchQuery]);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredIndividuals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIndividuals.map((i) => i.id)));
    }
  };

  const handleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Normalize API date to yyyy-mm-dd for <input type="date">
  const toDateInputValue = (v: string | undefined): string => {
    if (!v) return '';
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return s;
  };

  const handleEdit = (individual: Individual) => {
    setEditData({
      sex_code: individual.sex_code ?? '',
      birth_date: toDateInputValue(individual.birth_date),
      birth_date_approx: individual.birth_date_approx ?? '',
      birth_place: individual.birth_place ?? '',
      death_date: toDateInputValue(individual.death_date),
      death_date_approx: individual.death_date_approx ?? '',
      death_place: individual.death_place ?? '',
    });
    setEditingId(individual.id);
  };

  const handleSave = () => {
    if (!editingId) return;
    // Backend expects date or null; empty string "" fails validation for date fields
    const payload: Partial<Individual> = {
      ...editData,
      birth_date: editData.birth_date || undefined,
      death_date: editData.death_date || undefined,
    };
    updateMutation.mutate({ id: editingId, data: payload });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleCreateFamily = () => {
    const memberIds = Array.from(selectedIds).join(',');
    navigate(`/families/new?members=${memberIds}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Edit - Individuals</h1>
        <p className="text-gray-600 mt-1">
          Edit multiple individuals in table format
        </p>
      </div>

      {/* Toolbar */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, GEDCOM ID, or place..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          {selectedIds.size > 0 && (
            <Button onClick={handleCreateFamily}>
              <Users className="w-4 h-4 mr-2" />
              Create Family ({selectedIds.size} selected)
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        {filteredIndividuals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            {searchQuery ? (
              <p>No individuals match your search</p>
            ) : (
              <p>No individuals in the database</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredIndividuals.length && filteredIndividuals.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">ID</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Given Name</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Family Name</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Sex</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Birth Date</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Birth Place</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Death Date</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Death Place</th>
                  <th className="py-3 px-2 text-right font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredIndividuals.map((individual) => {
                  const isEditing = editingId === individual.id;
                  const name = getLatestName(individual.names);

                  return (
                    <tr
                      key={individual.id}
                      className={`hover:bg-gray-50 ${isEditing ? 'bg-emerald-50' : ''}`}
                    >
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(individual.id)}
                          onChange={() => handleSelect(individual.id)}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-2 text-gray-500 font-mono text-xs">
                        {individual.gedcom_id}
                      </td>
                      <td className="py-2 px-2">{name?.given_name || '-'}</td>
                      <td className="py-2 px-2">{name?.family_name || '-'}</td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <select
                            value={editData.sex_code ?? ''}
                            onChange={(e) =>
                              setEditData({ ...editData, sex_code: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="">-</option>
                            <option value="M">M</option>
                            <option value="F">F</option>
                            {sexTypes?.filter((t) => t.code !== 'M' && t.code !== 'F').map((t) => (
                              <option key={t.code} value={t.code}>
                                {t.code}
                              </option>
                            ))}
                          </select>
                        ) : (
                          individual.sex_code || '-'
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editData.birth_date || ''}
                            onChange={(e) =>
                              setEditData({ ...editData, birth_date: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          individual.birth_date || individual.birth_date_approx || '-'
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.birth_place || ''}
                            onChange={(e) =>
                              setEditData({ ...editData, birth_place: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          individual.birth_place || '-'
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editData.death_date || ''}
                            onChange={(e) =>
                              setEditData({ ...editData, death_date: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          individual.death_date || individual.death_date_approx || '-'
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.death_place || ''}
                            onChange={(e) =>
                              setEditData({ ...editData, death_place: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          individual.death_place || '-'
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={handleSave}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded transition-colors"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEdit(individual)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Delete this individual?')) {
                                  deleteMutation.mutate(individual.id);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Count */}
      <p className="text-sm text-gray-500">
        Showing {filteredIndividuals.length} of {individuals?.length || 0} individuals
      </p>
    </div>
  );
}


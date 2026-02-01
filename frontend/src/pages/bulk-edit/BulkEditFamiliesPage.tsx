import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Edit2, Trash2, Save, X, Heart } from 'lucide-react';
import { familiesApi } from '../../api/families';
import { individualsApi } from '../../api/individuals';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import toast from 'react-hot-toast';
import type { Family } from '../../types/models';

export function BulkEditFamiliesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Family>>({});

  const { data: families, isLoading: loadingFamilies } = useQuery({
    queryKey: ['families'],
    queryFn: () => familiesApi.list(),
  });

  const { data: individuals } = useQuery({
    queryKey: ['individuals'],
    queryFn: () => individualsApi.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Family> }) =>
      familiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      setEditingId(null);
      toast.success('Family updated');
    },
    onError: () => {
      toast.error('Failed to update family');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: familiesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      toast.success('Family deleted');
    },
    onError: () => {
      toast.error('Failed to delete family');
    },
  });

  // Helper to get individual name
  const getIndividualName = (id: number) => {
    const ind = individuals?.find((i) => i.id === id);
    if (!ind) return `ID:${id}`;
    const name = ind.names[0];
    return name
      ? `${name.given_name || ''} ${name.family_name || ''}`.trim() || 'Unnamed'
      : 'Unnamed';
  };

  // Filter families based on search
  const filteredFamilies = useMemo(() => {
    if (!families) return [];
    if (!searchQuery) return families;

    const query = searchQuery.toLowerCase();
    return families.filter((fam) => {
      // Search by GEDCOM ID
      if (fam.gedcom_id?.toLowerCase().includes(query)) return true;
      
      // Search by marriage place
      if (fam.marriage_place?.toLowerCase().includes(query)) return true;
      
      // Search by member names
      for (const member of fam.members) {
        const name = getIndividualName(member.individual_id);
        if (name.toLowerCase().includes(query)) return true;
      }
      
      return false;
    });
  }, [families, searchQuery, individuals]);

  const handleEdit = (family: Family) => {
    setEditingId(family.id);
    setEditData({
      marriage_date: family.marriage_date || '',
      marriage_place: family.marriage_place || '',
      divorce_date: family.divorce_date || '',
      family_type: family.family_type || '',
    });
  };

  const handleSave = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: editData });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  if (loadingFamilies) {
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
        <h1 className="text-2xl font-bold text-gray-900">Bulk Edit - Families</h1>
        <p className="text-gray-600 mt-1">
          Edit multiple families in table format
        </p>
      </div>

      {/* Toolbar */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by GEDCOM ID, place, or member name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {filteredFamilies.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            {searchQuery ? (
              <p>No families match your search</p>
            ) : (
              <p>No families in the database</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">ID</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Members</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Children</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Marriage Date</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Marriage Place</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Divorce Date</th>
                  <th className="py-3 px-2 text-left font-semibold text-gray-600">Type</th>
                  <th className="py-3 px-2 text-right font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFamilies.map((family) => {
                  const isEditing = editingId === family.id;

                  return (
                    <tr
                      key={family.id}
                      className={`hover:bg-gray-50 ${isEditing ? 'bg-emerald-50' : ''}`}
                    >
                      <td className="py-2 px-2 text-gray-500 font-mono text-xs">
                        {family.gedcom_id}
                      </td>
                      <td className="py-2 px-2">
                        <div className="max-w-48">
                          {family.members.map((m, i) => (
                            <span key={m.individual_id}>
                              {i > 0 && ' & '}
                              <span className="text-gray-900">
                                {getIndividualName(m.individual_id)}
                              </span>
                              {m.role && (
                                <span className="text-gray-400 text-xs ml-1">
                                  ({m.role})
                                </span>
                              )}
                            </span>
                          ))}
                          {family.members.length === 0 && '-'}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {family.children.length || '-'}
                      </td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editData.marriage_date || ''}
                            onChange={(e) =>
                              setEditData({ ...editData, marriage_date: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          family.marriage_date || family.marriage_date_approx || '-'
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.marriage_place || ''}
                            onChange={(e) =>
                              setEditData({ ...editData, marriage_place: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          family.marriage_place || '-'
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editData.divorce_date || ''}
                            onChange={(e) =>
                              setEditData({ ...editData, divorce_date: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          family.divorce_date || family.divorce_date_approx || '-'
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.family_type || ''}
                            onChange={(e) =>
                              setEditData({ ...editData, family_type: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="e.g., married"
                          />
                        ) : (
                          family.family_type || '-'
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
                              onClick={() => handleEdit(family)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Delete this family?')) {
                                  deleteMutation.mutate(family.id);
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
        Showing {filteredFamilies.length} of {families?.length || 0} families
      </p>
    </div>
  );
}


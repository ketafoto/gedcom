import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Heart, Users } from 'lucide-react';
import { familiesApi } from '../../api/families';
import { individualsApi } from '../../api/individuals';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import toast from 'react-hot-toast';

export function FamiliesListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: families, isLoading: loadingFamilies } = useQuery({
    queryKey: ['families'],
    queryFn: () => familiesApi.list(),
  });

  const { data: individuals } = useQuery({
    queryKey: ['individuals'],
    queryFn: () => individualsApi.list(),
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

  const handleDelete = (id: number, gedcomId: string) => {
    if (window.confirm(`Are you sure you want to delete family "${gedcomId}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Helper to get individual name by ID
  const getIndividualName = (individualId: number) => {
    const individual = individuals?.find((i) => i.id === individualId);
    if (!individual) return 'Unknown';
    const name = individual.names[0];
    return name
      ? `${name.given_name || ''} ${name.family_name || ''}`.trim() || 'Unnamed'
      : 'Unnamed';
  };

  // Filter families by search query
  const filteredFamilies = (families || []).filter((family) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    
    // Search by GEDCOM ID
    if (family.gedcom_id?.toLowerCase().includes(searchLower)) return true;
    
    // Search by member names
    for (const member of family.members) {
      const name = getIndividualName(member.individual_id);
      if (name.toLowerCase().includes(searchLower)) return true;
    }
    
    return false;
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Families</h1>
          <p className="text-gray-600 mt-1">
            {families?.length || 0} families in your database
          </p>
        </div>
        <Link to="/families/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Family
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Card>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by GEDCOM ID or member name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </Card>

      {/* Families List */}
      <Card>
        {filteredFamilies.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            {searchQuery ? (
              <>
                <p className="text-lg font-medium">No families found</p>
                <p className="text-sm">Try adjusting your search query</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">No families yet</p>
                <p className="text-sm mb-4">Create family connections</p>
                <Link to="/families/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Family
                  </Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFamilies.map((family) => {
              const spouses = family.members.map((m) => ({
                name: getIndividualName(m.individual_id),
                role: m.role,
              }));
              const childrenCount = family.children.length;

              return (
                <div
                  key={family.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/families/${family.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                        <Heart className="w-5 h-5 text-rose-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{family.gedcom_id}</p>
                        {family.marriage_date && (
                          <p className="text-sm text-gray-500">
                            Married: {family.marriage_date}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/families/${family.id}/edit`);
                        }}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(family.id, family.gedcom_id || `#${family.id}`);
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Spouses */}
                  {spouses.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {spouses.map((spouse, index) => (
                        <p key={index} className="text-sm text-gray-600">
                          <span className="text-gray-400">{spouse.role}:</span> {spouse.name}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Children */}
                  {childrenCount > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <Users className="w-4 h-4" />
                      <span>{childrenCount} {childrenCount === 1 ? 'child' : 'children'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}


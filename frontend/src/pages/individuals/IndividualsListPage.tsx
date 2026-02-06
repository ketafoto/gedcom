import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, User, ChevronUp, ChevronDown } from 'lucide-react';
import { individualsApi } from '../../api/individuals';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Spinner } from '../../components/common/Spinner';
import toast from 'react-hot-toast';
import { formatIndividualName, getLatestName } from '../../utils/nameUtils';

export function IndividualsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  type SortKey = 'name' | 'gedcom_id' | 'sex' | 'birth' | 'death';
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const { data: individuals, isLoading } = useQuery({
    queryKey: ['individuals'],
    queryFn: () => individualsApi.list(),
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

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Filter individuals by search query
  const filteredIndividuals = (individuals || []).filter((individual) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const latestName = getLatestName(individual.names);
    const fullName = formatIndividualName(latestName, '').toLowerCase();
    return (
      fullName.includes(searchLower) ||
      individual.gedcom_id?.toLowerCase().includes(searchLower) ||
      individual.birth_place?.toLowerCase().includes(searchLower)
    );
  });

  // Sort filtered list
  const getSortValue = (ind: (typeof filteredIndividuals)[0], key: SortKey): string => {
    const latestName = getLatestName(ind.names);
    const displayName = formatIndividualName(latestName, '');
    switch (key) {
      case 'name':
        return displayName.toLowerCase();
      case 'gedcom_id':
        return (ind.gedcom_id ?? '').toLowerCase();
      case 'sex':
        return (ind.sex_code ?? '').toLowerCase();
      case 'birth':
        return (ind.birth_date ?? ind.birth_date_approx ?? '').toLowerCase();
      case 'death':
        return (ind.death_date ?? ind.death_date_approx ?? '').toLowerCase();
      default:
        return '';
    }
  };
  const sortedIndividuals = [...filteredIndividuals].sort((a, b) => {
    const va = getSortValue(a, sortBy);
    const vb = getSortValue(b, sortBy);
    const cmp = va.localeCompare(vb, undefined, { sensitivity: 'base' });
    return sortDir === 'asc' ? cmp : -cmp;
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Individuals</h1>
          <p className="text-gray-600 mt-1">
            {individuals?.length || 0} individuals in your database
          </p>
        </div>
        <Link to="/individuals/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Individual
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Card>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, GEDCOM ID, or birthplace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </Card>

      {/* Individuals List */}
      <Card>
        {filteredIndividuals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            {searchQuery ? (
              <>
                <p className="text-lg font-medium">No individuals found</p>
                <p className="text-sm">Try adjusting your search query</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">No individuals yet</p>
                <p className="text-sm mb-4">Start building your family tree</p>
                <Link to="/individuals/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Individual
                  </Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th
                    className="text-left py-3 px-4 font-semibold text-gray-600 text-sm cursor-pointer select-none hover:bg-gray-100 rounded-tl-lg"
                    onClick={() => handleSort('name')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Name
                      {sortBy === 'name' && (sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </span>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-semibold text-gray-600 text-sm cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => handleSort('gedcom_id')}
                  >
                    <span className="inline-flex items-center gap-1">
                      GEDCOM ID
                      {sortBy === 'gedcom_id' && (sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </span>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-semibold text-gray-600 text-sm cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => handleSort('sex')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Sex
                      {sortBy === 'sex' && (sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </span>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-semibold text-gray-600 text-sm cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => handleSort('birth')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Birth
                      {sortBy === 'birth' && (sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </span>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-semibold text-gray-600 text-sm cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => handleSort('death')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Death
                      {sortBy === 'death' && (sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                    </span>
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600 text-sm">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedIndividuals.map((individual) => {
                  const latestName = getLatestName(individual.names);
                  const displayName = formatIndividualName(latestName);

                  return (
                    <tr
                      key={individual.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/individuals/${individual.id}`)}
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">{displayName}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {individual.gedcom_id || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {individual.sex_code || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {individual.birth_date || individual.birth_date_approx || '-'}
                        {individual.birth_place && (
                          <span className="text-gray-400 ml-1">({individual.birth_place})</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {individual.death_date || individual.death_date_approx || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/individuals/${individual.id}/edit`);
                            }}
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(individual.id, displayName);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}


import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Heart, Calendar, Image, ArrowRight, Plus } from 'lucide-react';
import { individualsApi } from '../../api/individuals';
import { familiesApi } from '../../api/families';
import { eventsApi } from '../../api/events';
import { mediaApi } from '../../api/media';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Spinner } from '../../components/common/Spinner';
import { formatIndividualName, getLatestName } from '../../utils/nameUtils';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  linkTo: string;
  color: string;
}

function StatCard({ title, value, icon, linkTo, color }: StatCardProps) {
  return (
    <Link to={linkTo}>
      <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
            {icon}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const { data: individuals, isLoading: loadingIndividuals } = useQuery({
    queryKey: ['individuals'],
    queryFn: () => individualsApi.list(),
  });

  const { data: families, isLoading: loadingFamilies } = useQuery({
    queryKey: ['families'],
    queryFn: () => familiesApi.list(),
  });

  const { data: events, isLoading: loadingEvents } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.list(),
  });

  const { data: media, isLoading: loadingMedia } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.list(),
  });

  const isLoading = loadingIndividuals || loadingFamilies || loadingEvents || loadingMedia;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const stats = {
    individuals: individuals?.length || 0,
    families: families?.length || 0,
    events: events?.length || 0,
    media: media?.length || 0,
  };

  // Get recent individuals (last 5)
  const recentIndividuals = (individuals || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your genealogy database</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Individuals"
          value={stats.individuals}
          icon={<Users className="w-6 h-6 text-white" />}
          linkTo="/individuals"
          color="bg-emerald-600"
        />
        <StatCard
          title="Families"
          value={stats.families}
          icon={<Heart className="w-6 h-6 text-white" />}
          linkTo="/families"
          color="bg-rose-500"
        />
        <StatCard
          title="Events"
          value={stats.events}
          icon={<Calendar className="w-6 h-6 text-white" />}
          linkTo="/individuals"
          color="bg-blue-500"
        />
        <StatCard
          title="Media"
          value={stats.media}
          icon={<Image className="w-6 h-6 text-white" />}
          linkTo="/individuals"
          color="bg-amber-500"
        />
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="flex flex-wrap gap-3">
          <Link to="/individuals/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Individual
            </Button>
          </Link>
          <Link to="/families/new">
            <Button variant="secondary">
              <Plus className="w-4 h-4 mr-2" />
              Add Family
            </Button>
          </Link>
          <Link to="/export">
            <Button variant="secondary">
              Export GEDCOM
            </Button>
          </Link>
        </div>
      </Card>

      {/* Recent Individuals */}
      <Card
        title="Recent Individuals"
        actions={
          <Link to="/individuals">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        }
      >
        {recentIndividuals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No individuals yet</p>
            <Link to="/individuals/new" className="text-emerald-600 hover:underline text-sm">
              Add your first individual
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentIndividuals.map((individual) => {
              const latestName = getLatestName(individual.names);
              const displayName = formatIndividualName(latestName);

              return (
                <Link
                  key={individual.id}
                  to={`/individuals/${individual.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{displayName}</p>
                    <p className="text-sm text-gray-500">
                      {individual.birth_date || 'Birth unknown'}
                      {individual.death_date && ` – ${individual.death_date}`}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400">{individual.gedcom_id}</span>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}


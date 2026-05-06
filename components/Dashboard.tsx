import React, { useMemo } from 'react';
import { ContentProject, BusinessUnitFilter, BusinessUnit } from '../types';
import { CheckCircle2, ChevronDown, BarChart3, Zap } from 'lucide-react';
import DistributionTable from './DistributionTable';

interface DashboardProps {
  projects: ContentProject[];
  businessUnits?: BusinessUnit[];
  currentBusinessUnitFilter: BusinessUnitFilter;
  onSelectProject: (project: ContentProject) => void;
  onDeleteProject?: (project: ContentProject) => void;
  onNavigateToDistributionHistory: (filter?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  projects, 
  businessUnits,
  currentBusinessUnitFilter,
  onSelectProject,
  onDeleteProject,
  onNavigateToDistributionHistory 
}) => {
  // Calculate statistics for this week
  const stats = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const thisWeekProjects = projects.filter(p => {
      const uploadDate = new Date(p.uploadDate);
      return uploadDate >= startOfWeek;
    });

    const total = thisWeekProjects.length;
    const ready = projects.filter(p => p.status === 'ready').length;
    const failed = projects.filter(p => p.status === 'failed').length;
    const published = projects.filter(p => p.status === 'published').length;

    return { total, ready, failed, published };
  }, [projects]);

  // Action required projects: ready, failed, processing (sorted: failed > ready > processing)
  const actionRequiredProjects = useMemo(() => {
    const filtered = projects.filter(
      p => p.status === 'ready' || p.status === 'failed' || p.status === 'processing'
    );
    const priority = { failed: 0, ready: 1, processing: 2 };
    return [...filtered].sort((a, b) => priority[a.status] - priority[b.status]);
  }, [projects]);

  const handleStatClick = (type: 'total' | 'ready' | 'failed' | 'published') => {
    onNavigateToDistributionHistory(type);
  };

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          {currentBusinessUnitFilter === 'all' 
            ? 'Overview of all business units' 
            : `Overview for ${currentBusinessUnitFilter}`}
        </p>
      </div>

      {/* Overview Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-slate-600" />
            Overview
          </h2>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>This Week</span>
            <ChevronDown size={16} />
          </div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Card */}
          <div 
            onClick={() => handleStatClick('total')}
            className="bg-white rounded-lg border border-slate-200 p-6 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Total</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">Published this week</div>
          </div>

          {/* Ready Card */}
          <div 
            onClick={() => handleStatClick('ready')}
            className="bg-white rounded-lg border border-slate-200 p-6 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Ready</span>
            </div>
            <div className="text-3xl font-bold text-yellow-600">{stats.ready}</div>
            <div className="text-xs text-slate-500 mt-1">Ready to publish</div>
          </div>

          {/* Failed Card */}
          <div 
            onClick={() => handleStatClick('failed')}
            className="bg-white rounded-lg border border-slate-200 p-6 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Failed</span>
            </div>
            <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-xs text-slate-500 mt-1">Need attention</div>
          </div>

          {/* Published Card */}
          <div 
            onClick={() => handleStatClick('published')}
            className="bg-white rounded-lg border border-slate-200 p-6 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Published</span>
            </div>
            <div className="text-3xl font-bold text-green-600">{stats.published}</div>
            <div className="text-xs text-slate-500 mt-1">Successfully published</div>
          </div>
        </div>
      </div>

      {/* Action Required Section */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Zap size={20} className="text-amber-500" />
          Action Required
        </h2>

        <DistributionTable
          projects={actionRequiredProjects}
          businessUnits={businessUnits}
          onSelectProject={onSelectProject}
          onDeleteProject={onDeleteProject}
          emptyConfig={{
            icon: <CheckCircle2 size={48} className="mx-auto text-green-500" />,
            title: 'All caught up!',
            description: 'No actions required at this time.',
          }}
          showActionsColumn={true}
        />
      </div>
    </div>
  );
};

export default Dashboard;

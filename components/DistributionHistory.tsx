import React from 'react';
import { ContentProject, BusinessUnit } from '../types';
import { Calendar } from 'lucide-react';
import DistributionTable from './DistributionTable';

interface DistributionHistoryProps {
  projects: ContentProject[];
  businessUnits?: BusinessUnit[];
  onSelectProject: (project: ContentProject) => void;
  onDeleteProject?: (project: ContentProject) => void;
  statusFilter?: 'total' | 'ready' | 'failed' | 'published';
}

const DistributionHistory: React.FC<DistributionHistoryProps> = ({ projects, businessUnits, onSelectProject, onDeleteProject, statusFilter }) => {
  const filteredProjects = React.useMemo(() => {
    if (!statusFilter || statusFilter === 'total') {
      return projects;
    }
    return projects.filter(p => {
      if (statusFilter === 'ready') return p.status === 'ready';
      if (statusFilter === 'failed') return p.status === 'failed';
      if (statusFilter === 'published') return p.status === 'published';
      return true;
    });
  }, [projects, statusFilter]);

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Distribution History</h1>
          <p className="text-slate-500 mt-1">Manage and track your distributed content assets.</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search content..."
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 bg-white"
          />
        </div>
      </div>

      <DistributionTable
        projects={filteredProjects}
        businessUnits={businessUnits}
        onSelectProject={onSelectProject}
        onDeleteProject={onDeleteProject}
        emptyConfig={{
          icon: <Calendar size={32} />,
          title: 'No content yet',
          description: 'Upload a video to start generating your social media matrix.',
        }}
        showActionsColumn={true}
      />
    </div>
  );
};

export default DistributionHistory;

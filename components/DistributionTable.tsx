import React, { useState, useEffect, useRef } from 'react';
import { ContentProject, BusinessUnit } from '../types';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import PlatformStatusCell from './PlatformStatusCell';

export interface DistributionTableEmptyConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface DistributionTableProps {
  projects: ContentProject[];
  /** Used to resolve project.businessUnit (id) to BU label for display. */
  businessUnits?: BusinessUnit[];
  onSelectProject: (project: ContentProject) => void;
  /** When provided, the row actions menu will include Delete with a confirmation dialog. */
  onDeleteProject?: (project: ContentProject) => void;
  emptyConfig: DistributionTableEmptyConfig;
  showActionsColumn?: boolean;
}

const isNew = (project: ContentProject): boolean => {
  if (!project.createdAt) return false;
  const createdAt = new Date(project.createdAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return hoursDiff < 6;
};

const STATUS_LABELS: Record<ContentProject['status'], string> = {
  processing: 'Draft',
  ready: 'Saved',
  published: 'Published',
  failed: 'Failed',
};

const getStatusBadgeClass = (status: ContentProject['status']): string => {
  switch (status) {
    case 'processing':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'ready':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'published':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'failed':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const formatStatusTime = (project: ContentProject): string => {
  const ts = project.updatedAt ?? project.createdAt ?? project.uploadDate;
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const DistributionTable: React.FC<DistributionTableProps> = ({
  projects,
  businessUnits,
  onSelectProject,
  onDeleteProject,
  emptyConfig,
  showActionsColumn = true,
}) => {
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<ContentProject | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenuProjectId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuProjectId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuProjectId]);

  const getBusinessUnitLabel = (buId: string): string =>
    businessUnits?.find((bu) => bu.id === buId)?.label ?? buId;
  if (projects.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-slate-200 border-dashed">
        <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
          {emptyConfig.icon}
        </div>
        <h3 className="text-lg font-medium text-slate-900">{emptyConfig.title}</h3>
        <p className="text-slate-500 mt-2 max-w-sm mx-auto">{emptyConfig.description}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Content Assets</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Platform Status</th>
            {showActionsColumn && (
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {projects.map((project) => (
            <tr
              key={project.id}
              className="hover:bg-slate-50 transition-colors cursor-pointer group"
              onClick={() => onSelectProject(project)}
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-10 rounded-md overflow-hidden bg-slate-200 flex-shrink-0">
                    <img
                      src={project.sourceCoverUrl || project.thumbnailUrl}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                        {project.videoName}
                      </span>
                      {isNew(project) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-500 text-white">
                          new
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{getBusinessUnitLabel(project.businessUnit)}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {project.uploadDate}
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-0.5">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getStatusBadgeClass(project.status)}`}>
                    {STATUS_LABELS[project.status]}
                  </span>
                  {formatStatusTime(project) && (
                    <span className="text-xs text-slate-500">{formatStatusTime(project)}</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <PlatformStatusCell
                  generatedContent={project.generatedContent}
                  projectStatus={project.status}
                />
              </td>
              {showActionsColumn && (
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="relative inline-block" ref={openMenuProjectId === project.id ? menuRef : undefined}>
                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuProjectId((id) => (id === project.id ? null : project.id));
                      }}
                      aria-haspopup="true"
                      aria-expanded={openMenuProjectId === project.id}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {openMenuProjectId === project.id && (
                      <div
                        className="absolute right-0 top-full mt-1 py-1 w-40 bg-white rounded-lg border border-slate-200 shadow-lg z-10"
                        role="menu"
                      >
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuProjectId(null);
                            onSelectProject(project);
                          }}
                        >
                          <Pencil size={14} />
                          Open
                        </button>
                        {onDeleteProject && (
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuProjectId(null);
                              setDeleteConfirmProject(project);
                            }}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {deleteConfirmProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-slate-900">
              Delete content asset?
            </h2>
            <p className="mt-2 text-slate-600">
              Are you sure you want to delete &quot;{deleteConfirmProject.videoName}&quot;? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                onClick={() => setDeleteConfirmProject(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                onClick={() => {
                  onDeleteProject?.(deleteConfirmProject);
                  setDeleteConfirmProject(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributionTable;

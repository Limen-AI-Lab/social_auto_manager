import React from 'react';

export interface PlatformColumn {
  platform: string;
  label: string;
  icon: React.ReactNode;
}

export interface MatrixRow {
  id: string;
  label: string;
  sublabel?: string;
  /** Optional extra class for the row stub (first column) cell, e.g. pt-8 for taller rows */
  stubClassName?: string;
  renderCell: (platformIndex: number, platformId: string) => React.ReactNode;
}

interface PlatformMatrixGridProps {
  /** First column header text (e.g. "Content Element") */
  firstColumnHeader?: string;
  /** Platform columns: order and display info */
  columns: PlatformColumn[];
  /** Optional custom header content per platform column (e.g. checkbox + icon + name). If not provided, uses column.label + column.icon */
  renderHeaderCell?: (platformIndex: number, platformId: string) => React.ReactNode;
  /** Row definitions: label + sublabel for stub column, renderCell for each platform cell */
  rows: MatrixRow[];
  /** Optional extra CSS class for the grid container */
  className?: string;
}

const PlatformMatrixGrid: React.FC<PlatformMatrixGridProps> = ({
  firstColumnHeader = 'Content Element',
  columns,
  renderHeaderCell,
  rows,
  className = '',
}) => {
  const colCount = columns.length;
  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `220px repeat(${colCount}, minmax(320px, 1fr))`,
  };

  return (
    <div
      className={`inline-grid bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden ${className}`}
      style={gridStyle}
    >
      {/* Header row: first cell + one per platform */}
      <div className="sticky top-0 left-0 z-10 bg-white border-b border-r border-slate-200 p-4">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{firstColumnHeader}</span>
      </div>
      {columns.map((col, i) => (
        <div
          key={`head-${col.platform}`}
          className={`sticky top-0 z-10 bg-white border-b border-slate-200 p-4 flex items-center gap-3 ${i < colCount - 1 ? 'border-r' : ''}`}
        >
          {renderHeaderCell ? (
            renderHeaderCell(i, col.platform)
          ) : (
            <>
              {col.icon}
              <span className="font-bold text-slate-800">{col.label}</span>
            </>
          )}
        </div>
      ))}

      {/* Data rows */}
      {rows.map((row, rowIdx) => {
        const isLastRow = rowIdx === rows.length - 1;
        const borderBottom = isLastRow ? '' : ' border-b border-slate-200';
        return (
          <React.Fragment key={row.id}>
            <div
              className={`sticky left-0 bg-white border-r border-slate-200 p-6 flex flex-col justify-center ${row.stubClassName ?? ''}${borderBottom}`.trim()}
            >
              <div className="font-bold text-slate-800 text-sm">{row.label}</div>
              {row.sublabel && <div className="text-xs text-slate-400 mt-1">{row.sublabel}</div>}
            </div>
            {columns.map((col, i) => (
              <div
                key={`${row.id}-${col.platform}`}
                className={`bg-white p-4${borderBottom} ${i < colCount - 1 ? 'border-r border-slate-200' : ''}`}
              >
                {row.renderCell(i, col.platform)}
              </div>
            ))}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default PlatformMatrixGrid;

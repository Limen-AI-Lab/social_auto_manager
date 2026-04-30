// ============================================================
// SAMA - Client Report (Stub)
// Weekly/Monthly views are the proper client-ready reports
// ============================================================

import React from 'react';

interface ClientReportProps {
  dateRange: { start: string; end: string };
  overallMetrics: unknown | null;
  platformMetrics: unknown;
  topics: unknown[];
  periodSummary: unknown | null;
  insights: unknown | null;
  clientName: string;
  printMode: boolean;
}

export default function ClientReport(props: ClientReportProps) {
  return (
    <div style={{ padding: 24, background: '#fff' }}>
      <p style={{ color: '#64748b', fontSize: 14 }}>
        Use the <strong>Weekly</strong> or <strong>Monthly</strong> tabs for structured client reports.
      </p>
    </div>
  );
}

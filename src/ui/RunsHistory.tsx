import { useCallback, useEffect, useMemo, useState } from 'react';
import { db, type RunMeta } from '../db';

const PAGE_SIZE = 10;

type Row = RunMeta;

type Props = {
  onReplay?: (run: RunMeta) => void;
};

export default function RunsHistory({ onReplay }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const replay = onReplay ?? (() => {});
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const list = await db.runs.orderBy('timestamp').reverse().toArray();
    setRows(list as Row[]);
    setPage(1);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);

  async function clearAll() {
    await db.runs.clear();
    await load();
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    download(url, `aware-runs-${Date.now()}.json`);
  }

  function exportCSV() {
    const header = [
      'id',
      'timestamp',
      'scenario',
      'policy',
      'seed',
      'seedMode',
      'replicateIndex',
      'replicates',
      'batchId',
      'samplesCount',
      'cacheHitRate',
      'deliveryRate',
      'avgFreshness',
      'staleAccessRate',
      'redundancyIndex',
      'actionabilityFirstRatio',
      'timelinessConsistency',
      'pushesSent',
      'pushSuppressRate',
      'pushDuplicateRate',
      'pushTimelyFirstRatio'
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      const m = r.metrics || {};
      lines.push([
        r.id,
        r.timestamp,
        r.scenario,
        r.policy,
        r.seed,
        r.seedMode ?? '',
        r.replicateIndex ?? '',
        r.replicates ?? '',
        r.batchId ?? '',
        r.samplesCount,
        m.cacheHitRate ?? '',
        m.deliveryRate ?? '',
        m.avgFreshness ?? '',
        m.staleAccessRate ?? '',
        m.redundancyIndex ?? '',
        m.actionabilityFirstRatio ?? '',
        m.timelinessConsistency ?? '',
        m.pushesSent ?? '',
        m.pushSuppressRate ?? '',
        m.pushDuplicateRate ?? '',
        m.pushTimelyFirstRatio ?? ''
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    download(url, `aware-runs-${Date.now()}.csv`);
  }

  function exportAlertsCSV() {
    const header = [
      'runId', 'timestamp', 'scenario', 'policy', 'seed',
      'alertId', 'eventType', 'severity', 'urgency', 'issuedAt', 'ttlSec', 'regionId', 'geokey', 'threadKey', 'updateNo', 'sizeBytes', 'delivered'
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      const full = r.fullResults;
      if (!full) continue;
      const issued = full.issuedAlerts ?? [];
      const deliveredSet = new Set((full.deliveredAlerts ?? []).map((x) => x.id));
      for (const a of issued) {
        const delivered = deliveredSet.has(a.id) ? 'true' : 'false';
        lines.push([
          r.id,
          r.timestamp,
          r.scenario,
          r.policy,
          r.seed,
          a.id,
          a.eventType,
          a.severity,
          a.urgency,
          a.issuedAt,
          a.ttlSec,
          a.regionId ?? '',
          a.geokey ?? '',
          a.threadKey ?? '',
          a.updateNo ?? '',
          a.sizeBytes ?? '',
          delivered
        ].join(','));
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    download(url, `aware-alerts-${Date.now()}.csv`);
  }

  function exportDeliveredAlertsCSV() {
    const header = [
      'runId', 'timestamp', 'scenario', 'policy', 'seed',
      'alertId', 'eventType', 'severity', 'urgency', 'issuedAt', 'ttlSec', 'regionId', 'geokey', 'threadKey', 'updateNo', 'sizeBytes'
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      const full = r.fullResults;
      if (!full) continue;
      const delivered = full.deliveredAlerts ?? [];
      for (const a of delivered) {
        lines.push([
          r.id,
          r.timestamp,
          r.scenario,
          r.policy,
          r.seed,
          a.id,
          a.eventType,
          a.severity,
          a.urgency,
          a.issuedAt,
          a.ttlSec,
          a.regionId ?? '',
          a.geokey ?? '',
          a.threadKey ?? '',
          a.updateNo ?? '',
          a.sizeBytes ?? ''
        ].join(','));
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    download(url, `aware-delivered-alerts-${Date.now()}.csv`);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Runs History</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportJSON}>Export JSON</button>
          <button onClick={exportCSV}>Export CSV</button>
          <button onClick={exportAlertsCSV} disabled={rows.length === 0}>Export Alerts CSV</button>
          <button onClick={exportDeliveredAlertsCSV} disabled={rows.length === 0}>Export Delivered Alerts CSV</button>
          <button onClick={clearAll} disabled={rows.length === 0}>Clear runs</button>
        </div>
      </div>
      <div style={{ overflow: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Time</Th>
              <Th>Scenario</Th>
              <Th>Policy</Th>
              <Th>Seed</Th>
              <Th>Mode</Th>
              <Th>Rep</Th>
              <Th>Hit%</Th>
              <Th>Delivery%</Th>
              <Th>Fresh</Th>
              <Th>Stale%</Th>
              <Th>Redund%</Th>
              <Th>ActFirst%</Th>
              <Th>TimeCons%</Th>
              <Th>Env</Th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #314462' }}>
                <Td mono>{r.id}</Td>
                <Td>{new Date(r.timestamp).toLocaleString()}</Td>
                <Td>{r.scenario}</Td>
                <Td>{r.policy}</Td>
                <Td mono>{r.seed}</Td>
                <Td>{r.seedMode ?? ''}</Td>
                <Td>
                  {typeof r.replicateIndex === 'number' && typeof r.replicates === 'number'
                    ? `${r.replicateIndex}/${r.replicates}`
                    : ''}
                </Td>
                <Td>{pct(r.metrics?.cacheHitRate)}</Td>
                <Td>{pct(r.metrics?.deliveryRate)}</Td>
                <Td>{num(r.metrics?.avgFreshness)}</Td>
                <Td>{pct(r.metrics?.staleAccessRate)}</Td>
                <Td>{pct(r.metrics?.redundancyIndex)}</Td>
                <Td>{pct(r.metrics?.actionabilityFirstRatio)}</Td>
                <Td>{pct(r.metrics?.timelinessConsistency)}</Td>
                <Td>
                  <button onClick={() => replay(r)} disabled={!r.fullResults}>Show</button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginator page={currentPage} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

function download(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pct(x?: number) {
  if (typeof x !== 'number') return '';
  return `${(x * 100).toFixed(1)}%`;
}
function num(x?: number) {
  if (typeof x !== 'number') return '';
  return x.toFixed(2);
}

function Th({ children }: { children: any }) {
  return (
    <th style={{ textAlign: 'left', padding: '6px 8px', color: '#9fb3d9' }}>{children}</th>
  );
}
function Td({ children, mono }: { children: any; mono?: boolean }) {
  return (
    <td style={{ padding: '6px 8px', fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : undefined }}>
      {children}
    </td>
  );
}

function Paginator({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (page: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
      <span className="muted">
        Page {page} / {pageCount}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
          Previous
        </button>
        <button onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>
          Next
        </button>
      </div>
    </div>
  );
}

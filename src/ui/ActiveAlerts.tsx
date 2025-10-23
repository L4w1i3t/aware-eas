import { useEffect, useMemo, useState } from 'react';
import { db, type Report } from '../db';

const PAGE_SIZE = 10;

export default function ActiveAlerts() {
  const [rows, setRows] = useState<Report[]>([]);
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);

  async function refresh(resetPage = false) {
    const now = Math.floor(Date.now() / 1000);
    const list = await db.reports
      .filter((r) => r.issuedAt <= now && now < r.expiresAt)
      .toArray();
    list.sort((a, b) => rank(b) - rank(a) || b.issuedAt - a.issuedAt);
    setRows(list);
    if (resetPage) setPage(1);
  }

  async function clearAll() {
    await db.reports.clear();
    await refresh(true);
  }

  useEffect(() => {
    void refresh(true);
  }, []);

  useEffect(() => {
    setPage((prev) => Math.max(1, Math.min(prev, pageCount)));
  }, [pageCount]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Active Alerts</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => refresh(false)}>Refresh</button>
          <button onClick={clearAll} disabled={rows.length === 0}>Clear alerts</button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="muted" style={{ marginTop: 8 }}>No active alerts currently.</div>
      ) : (
        <>
          <ul style={{ listStyle: 'none', margin: 12, marginLeft: 0, padding: 0 }}>
            {pagedRows.map((r) => (
              <li key={r.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{r.headline ?? `${r.severity} ${r.eventType}`}</strong>
                  <span className="muted">{r.geokey}</span>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {r.instruction}
                </div>
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  Severity: {r.severity} | Urgency: {r.urgency} | Issued: {r.issuedAt}s | Expires: {r.expiresAt}s
                </div>
              </li>
            ))}
          </ul>
          <Paginator page={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function rank(r: Report) {
  const sev = r.severity === 'Extreme' ? 4 : r.severity === 'Severe' ? 3 : r.severity === 'Moderate' ? 2 : r.severity === 'Minor' ? 1 : 2;
  const urg = r.urgency === 'Immediate' ? 3 : r.urgency === 'Expected' ? 2 : r.urgency === 'Future' ? 1.5 : r.urgency === 'Past' ? 0.5 : 1.5;
  return sev * 3 + urg * 2;
}

function Paginator({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (page: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
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

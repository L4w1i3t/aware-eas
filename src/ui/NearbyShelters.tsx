import { useEffect, useMemo, useState } from 'react';
import { db, type Shelter, putShelters } from '../db';

const PAGE_SIZE = 10;

export default function NearbyShelters() {
  const [rows, setRows] = useState<Shelter[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);

  async function ensureSeed() {
    const count = await db.shelters.count();
    if (count > 0) return;
    try {
      const res = await fetch('/api/shelters/index.json');
      const data = (await res.json()) as Shelter[];
      await putShelters(data);
    } catch {
      // ignore offline fetch errors
    }
  }

  async function refresh(resetPage = false) {
    await ensureSeed();
    const list = await db.shelters.orderBy('name').toArray();
    setRows(list);
    if (resetPage) setPage(1);
    setLoaded(true);
  }

  useEffect(() => {
    void refresh(true);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Nearby Shelters</h3>
        <button onClick={() => refresh(false)}>Refresh</button>
      </div>
      {!loaded ? (
        <div className="muted" style={{ marginTop: 8 }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div className="muted" style={{ marginTop: 8 }}>No shelters available.</div>
      ) : (
        <>
          <ul style={{ listStyle: 'none', margin: 12, marginLeft: 0, padding: 0 }}>
            {pagedRows.map((s) => (
              <li key={s.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{s.name}</strong>
                  <span className="muted">{s.status.toUpperCase()}</span>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {s.address ?? `${s.coordinates[1].toFixed(4)}, ${s.coordinates[0].toFixed(4)}`}
                </div>
                {s.capacity !== undefined && (
                  <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                    Capacity: {s.capacity}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Paginator page={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
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

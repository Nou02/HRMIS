import React, { useState } from 'react';
import './compensation.css';
import { API_BASE } from '../../lib/api';

export default function Payslips() {
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortNameAZ, setSortNameAZ] = useState(false);
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    uid: '',
    name: '',
    gross: '',
    bonus: '',
    deductions: '',
    period: '',
  });

  const loadSummary = () => {
    fetch(`${API_BASE}/api/payroll/summary`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  };
  const loadList = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (sortNameAZ) params.set('sort', 'name_asc');
    fetch(`${API_BASE}/api/payslips${params.toString() ? `?${params.toString()}` : ''}`)
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setList(list);
        } else {
          fetch(`${API_BASE}/api/employees`)
            .then((r) => r.json())
            .then((emps) => {
              const rows = (emps || []).map((e) => ({
                id: e.uid,
                uid: e.uid,
                name: e.name,
                role: '',
                gross: '—',
                bonus: '—',
                deductions: '—',
                netPay: '—',
                period: '—',
                status: 'Draft',
              }));
              setList(rows);
            })
            .catch(() => setList([]));
        }
      })
      .catch(() => {});
  };
  React.useEffect(() => {
    loadSummary();
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sortNameAZ]);

  function openProceed(p) {
    setForm({
      uid: p.uid,
      name: p.name,
      gross: p.gross === '—' ? '' : String(p.gross).replace(/[^\d.-]/g, ''),
      bonus: p.bonus === '—' ? '' : String(p.bonus).replace(/[^\d.-]/g, ''),
      deductions: p.deductions === '—' ? '' : String(p.deductions).replace(/[^\d.-]/g, ''),
      period: p.period || '',
    });
    setModalOpen(true);
  }
  function confirmPayslip(e) {
    e.preventDefault();
    fetch(`${API_BASE}/api/payslips/${encodeURIComponent(form.uid)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        gross: form.gross,
        bonus: form.bonus,
        deductions: form.deductions,
        period: form.period,
        confirm: true,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setModalOpen(false);
        loadList();
      })
      .catch(() => {});
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="title">Payslips</div>
        <div className="actions">
          <div className="btn light">{summary?.period || '—'}</div>
          <div className="avatar" />
        </div>
      </div>

      <div className="grid-3">
        <Metric label="Total Net Payroll" value={summary?.basePayroll ?? '—'} />
        <Metric label="Total Employees Paid" value={summary?.totalEmployees ?? '—'} />
        <Metric label="Period" value={summary?.period ?? '—'} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Payslip List</div>
          <div className="card-actions">
            <div className="search">
              <span>🔍</span>
              <input
                placeholder="Search employee"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="btn light" onClick={() => setFiltersOpen((v) => !v)}>Filters</button>
          </div>
        </div>
        {filtersOpen && (
          <div className="dropdown-menu">
            <div className="form-col">
              <label>Name (Sort A–Z)</label>
              <select className="select" value={sortNameAZ ? 'az' : 'none'} onChange={(e) => setSortNameAZ(e.target.value === 'az')}>
                <option value="none">None</option>
                <option value="az">A–Z</option>
              </select>
            </div>
          </div>
        )}
        <div className="list" style={{ padding: 16 }}>
          {(list.length ? list : Array.from({ length: 3 }, (_, i) => ({ key: i }))).map((item) => {
            if (!list.length) {
              return (
                <div className="list-item" key={item.key}>
                  <div className="left">
                    <div className="avatar" />
                    <div>
                      <div>-</div>
                      <div className="details">EMP-— · —</div>
                      <div className="details">Gross: — · Bonus: — · Deductions: —</div>
                    </div>
                  </div>
                  <div className="right">
                    <div className="amount">—</div>
                    <div className="details">Period: — · Status: —</div>
                  </div>
                </div>
              );
            }
            const p = item;
            return (
              <div className="list-item" key={p.id || p.uid}>
                <div className="left">
                  <div className="avatar" />
                  <div>
                    <div>{p.name}</div>
                    <div className="details">{p.uid} · {p.role || ''}</div>
                    <div className="details">Gross: {p.gross} · Bonus: {p.bonus} · Deductions: {p.deductions}</div>
                  </div>
                </div>
                <div className="right">
                  <div className="amount">{p.netPay}</div>
                  <div className="details">Period: {p.period || ''} · Status: {p.status || ''}</div>
                  <button className="btn primary" onClick={() => openProceed(p)}>Proceed</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="card-title">Payslip · {form.name}</div>
              <button className="btn light" onClick={() => setModalOpen(false)}>Close</button>
            </div>
            <form onSubmit={confirmPayslip}>
              <div className="form-row">
                <div className="form-col">
                  <label>Gross</label>
                  <input className="input" value={form.gross} onChange={(e) => setForm({ ...form, gross: e.target.value })} />
                </div>
                <div className="form-col">
                  <label>Bonus</label>
                  <input className="input" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label>Deductions</label>
                  <input className="input" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} />
                </div>
                <div className="form-col">
                  <label>Period</label>
                  <input className="input" type="date" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn primary">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

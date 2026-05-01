import React, { useState, useEffect, useRef } from 'react';
import './Payslips.css';
import { API_BASE } from '../../lib/api';
import { Search, X, Filter } from 'lucide-react';

function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      <div className="metric-content">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
      </div>
      <div className="metric-icon">{icon}</div>
    </div>
  );
}

export default function Payslips({ localPhotos }) {
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nameSort, setNameSort] = useState('none');
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [fullImageView, setFullImageView] = useState(null);

  const [form, setForm] = useState({
    uid: '',
    name: '',
    gross: '',
    bonus: '',
    deductions: '',
    period: '',
  });

  const filterRef = useRef(null);
  const searchInputRef = useRef(null);

  const displayCellValue = (val) => {
    const s = String(val ?? '').trim();
    if (s === '0' || s === '0.00' || s === '₱0' || s === '₱0.00' || s === '') return '-';
    return val;
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setFiltersOpen(false);
      }
    }
    if (filtersOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filtersOpen]);

  const loadSummary = () => {
    fetch(`${API_BASE}/api/payroll/summary`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  };

  const loadList = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);

    fetch(`${API_BASE}/api/payslips${params.toString() ? `?${params.toString()}` : ''}`)
      .then((r) => r.json())
      .then((data) => {
        let items = Array.isArray(data) ? data : [];
        
        if (items.length === 0 && !query) {
          fetch(`${API_BASE}/api/employees`)
            .then((r) => r.json())
            .then((emps) => {
              const rows = (emps || []).map((e) => ({
                id: e.uid,
                uid: e.uid,
                name: e.name,
                avatarUrl: e.avatarUrl,
                role: e.employmentCategory || 'Staff',
                gross: '-',
                bonus: '-',
                deductions: '-',
                netPay: '-',
                period: '-',
                status: 'Draft',
                statusClass: 'draft'
              }));
              applySort(rows);
            })
            .catch(() => setList([]));
        } else {
          applySort(items);
        }
      })
      .catch(() => {});
  };

  const applySort = (items) => {
    const sorted = [...items].sort((a, b) => {
      if (nameSort !== 'none') {
        if (nameSort === 'asc') return (a.name || '').localeCompare(b.name || '');
        if (nameSort === 'desc') return (b.name || '').localeCompare(a.name || '');
      }

      const netA = String(a.netPay).replace(/[^\d.-]/g, '');
      const netB = String(b.netPay).replace(/[^\d.-]/g, '');
      const valA = parseFloat(netA) || 0;
      const valB = parseFloat(netB) || 0;

      if (valA > 0 && valB <= 0) return -1;
      if (valA <= 0 && valB > 0) return 1;

      return 0;
    });
    setList(sorted);
  };

  useEffect(() => {
    loadSummary();
    loadList();
  }, [query, nameSort]);

  const handleClearSearch = () => {
    setQuery('');
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  function openProceed(p) {
    setForm({
      uid: p.uid,
      name: p.name,
      gross: p.gross === '-' || p.gross === '—' ? '' : String(p.gross).replace(/[^\d.-]/g, ''),
      bonus: p.bonus === '-' || p.bonus === '—' ? '' : String(p.bonus).replace(/[^\d.-]/g, ''),
      deductions: p.deductions === '-' || p.deductions === '—' ? '' : String(p.deductions).replace(/[^\d.-]/g, ''),
      period: p.period || '',
    });
    setModalOpen(true);
  }

  function confirmPayslip(e) {
    e.preventDefault();
    fetch(`${API_BASE}/api/payslips/${encodeURIComponent(form.uid)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, confirm: true }),
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
      {fullImageView && (
        <div className="image-viewer-overlay" onClick={() => setFullImageView(null)}>
          <button className="viewer-close">✕</button>
          <img src={fullImageView} alt="Full View" />
        </div>
      )}

      <div className="screen-header">
        <div className="header-text">
          <div className="title">Payslips</div>
          <div className="page-description">Manage and issue employee payslips for the current period</div>
        </div>
        <div className="actions">
          {summary?.period && summary.period !== '-' && summary.period !== '—' && (
          <div className="btn light period-display">{summary.period}</div>
          )}
          <div className="avatar" />
        </div>
      </div>

      <div className="grid-3">
        <Metric label="Total Net Payroll" value={summary?.basePayroll ?? '0.00'} icon="💵" />
        <Metric label="Total Employees Paid" value={summary?.totalEmployees ?? '0'} icon="👥" />
        <Metric label="Period" value={displayCellValue(summary?.period)} icon="📅" />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Payslip List</div>
          <div className="card-actions">
            <div className="search">
              <Search size={18} className="search-icon" />
              <input
                ref={searchInputRef}
                placeholder="Search UID, Name, ..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="search-clear-btn" onClick={handleClearSearch}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="dropdown" ref={filterRef}>
              <button className="btn light filter-btn" onClick={() => setFiltersOpen((v) => !v)}>
                <Filter size={18} />
              </button>
              {filtersOpen && (
                <div className="dropdown-menu">
                  <div className="form-col">
                    <label className="field-label">Name</label>
                    <select
                      className="select"
                      value={nameSort}
                      onChange={(e) => setNameSort(e.target.value)}
                    >
                      <option value="none">None</option>
                      <option value="asc">Ascending (A–Z)</option>
                      <option value="desc">Descending (Z–A)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="list-container" style={{ padding: 24 }}>
          {list.length > 0 ? (
            <div className="list">
              {list.map((p) => (
                <div className="list-item" key={p.id || p.uid}>
                  <div className="left">
                    <div
                      className="employee-avatar clickable-avatar avatar-border"
                      onClick={() => {
                        const imgUrl = p.avatarUrl ? `${API_BASE}${p.avatarUrl}` : localPhotos[p.uid];
                        if (imgUrl) setFullImageView(imgUrl);
                      }}
                    >
                      {p.avatarUrl ? (
                        <img src={`${API_BASE}${p.avatarUrl}`} alt="" />
                      ) : localPhotos[p.uid] ? (
                        <img src={localPhotos[p.uid]} alt="" />
                      ) : (
                        <span className="employee-avatar-initials">{(p.name || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="info-block">
                      <div className="employee-name-text">{p.name}</div>
                      <div className="details">
                        UID: <span className="uid-text">{p.uid}</span> · {p.role || 'Staff'}
                      </div>
                      <div className="details-row">
                        <span>Gross: <b>{displayCellValue(p.gross)}</b></span>
                        <span className="dot">·</span>
                        <span>Bonus: <b>{displayCellValue(p.bonus)}</b></span>
                        <span className="dot">·</span>
                        <span>Deductions: <b>{displayCellValue(p.deductions)}</b></span>
                      </div>
                    </div>
                  </div>
                  <div className="right">
                    <div className="amount">{displayCellValue(p.netPay)}</div>
                    <div className="details" style={{ marginBottom: '8px' }}>
                      Period: {p.period || '-'} · <span className={`status-text ${String(p.status).toLowerCase()}`}>{p.status}</span>
                    </div>
                    <button className="btn primary small" onClick={() => openProceed(p)}>Proceed</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-records-row">No record(s) found/added</div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="card-title">Edit Payslip · {form.name}</div>
              <button className="modal-close-x" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={confirmPayslip}>
              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Gross Salary</label>
                  <input
                    className="input"
                    placeholder="e.g. 25000"
                    value={form.gross}
                    onChange={(e) => setForm({ ...form, gross: e.target.value })}
                  />
                </div>
                <div className="form-col">
                  <label className="field-label">Bonus / Incentives</label>
                  <input
                    className="input"
                    placeholder="e.g. 1000"
                    value={form.bonus}
                    onChange={(e) => setForm({ ...form, bonus: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Total Deductions</label>
                  <input
                    className="input"
                    placeholder="e.g. 500"
                    value={form.deductions}
                    onChange={(e) => setForm({ ...form, deductions: e.target.value })}
                  />
                </div>
                <div className="form-col">
                  <label className="field-label">Pay Period Date</label>
                  <input
                    className="input"
                    type="date"
                    value={form.period}
                    onChange={(e) => setForm({ ...form, period: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn primary submit-btn">Confirm & Issue</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
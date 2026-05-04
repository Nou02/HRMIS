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
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const periodNum = now.getDate() <= 15 ? 1 : 2;
    return `P${periodNum}-${year}-${month}`;
  });
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
    if (s === '0' || s === '0.00' || s === '₱0' || s === '₱0.00' || s === '' || s === '-' || s === '—') return '₱0.00';
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

  const loadSummary = (p = period) => {
    fetch(`${API_BASE}/api/payroll/summary?period=${encodeURIComponent(p)}`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  };

  const loadList = (p = period) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('period', p);

    fetch(`${API_BASE}/api/payslips?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        // Backend now handles the employee list join, so we just apply sort and set data
        applySort(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('[Payslips] loadList error:', err);
        setList([]);
      });
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
    loadSummary(period);
    loadList(period);
  }, [query, nameSort, period]);

  const handleClearSearch = () => {
    setQuery('');
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const handleGetFromPayroll = () => {
    if (!form.uid || !form.period) return;
    fetch(`${API_BASE}/api/payroll/records/${encodeURIComponent(form.uid)}?period=${form.period}`)
      .then(res => {
        if (!res.ok) throw new Error('No payroll record found for this period');
        return res.json();
      })
      .then(data => {
        setForm(prev => ({
          ...prev,
          gross: String(data.baseSalary || '0').replace(/[^\d.-]/g, ''),
          bonus: String(data.overtimeAmount || '0').replace(/[^\d.-]/g, ''),
          deductions: String(data.deduction || '0').replace(/[^\d.-]/g, ''),
        }));
      })
      .catch(err => {
        console.error('Sync error:', err);
        alert(err.message);
      });
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

  function handleSavePayslip(e, isConfirm = false) {
    if (e) e.preventDefault();
    fetch(`${API_BASE}/api/payslips/${encodeURIComponent(form.uid)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, confirm: isConfirm }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then(err => { throw new Error(err.error || 'Failed to save payslip'); });
        return r.json();
      })
      .then(() => {
        alert(isConfirm ? 'Payslip confirmed and issued successfully!' : 'Payslip saved as draft.');
        setModalOpen(false);
        loadList(period);
        loadSummary(period);
      })
      .catch(err => {
        console.error('Save error:', err);
        alert(err.message);
      });
  }

  function formatPeriodReadable(p) {
    if (!p || p === '-' || p === '—') return p;
    const match = String(p).match(/^P(\d)-(\d{4})-(\d{2})$/);
    if (!match) return p;
    const [_, num, year, month] = match;
    const d = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    if (num === '1') {
      return `${monthName} 1-15, ${year}`;
    } else {
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      return `${monthName} 16-${lastDay}, ${year}`;
    }
  }

  const periodOptions = [];
  const now = new Date();
  for (let m = 0; m < 6; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const mm = String(month).padStart(2, '0');
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    periodOptions.push({ value: `P1-${year}-${mm}`, label: `${monthName} 1-15, ${year}` });
    const lastDay = new Date(year, month, 0).getDate();
    periodOptions.push({ value: `P2-${year}-${mm}`, label: `${monthName} 16-${lastDay}, ${year}` });
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
          <div className="btn light period-display">{formatPeriodReadable(summary.period)}</div>
          )}
          <div className="avatar" />
        </div>
      </div>

      <div className="grid-3">
        <Metric label="Total Net Payroll" value={summary?.basePayroll ?? '0.00'} icon="💵" />
        <Metric label="Total Employees Paid" value={summary?.totalEmployees ?? '0'} icon="👥" />
        <Metric label="Period" value={formatPeriodReadable(summary?.period)} icon="📅" />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Payslip Processing Setup</div>
        </div>
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          <div className="form-col">
            <label className="field-label">Pay Period</label>
            <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periodOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-col" style={{ opacity: 0.5 }}>
            <label className="field-label">Department</label>
            <select className="select" disabled>
              <option>All Departments</option>
            </select>
          </div>
          <div className="form-col" style={{ opacity: 0.5 }}>
            <label className="field-label">Processing Date</label>
            <input className="input" type="date" disabled value={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
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
                      Period: {formatPeriodReadable(p.period) || '-'} · <span className={`status-text ${String(p.status).toLowerCase()}`}>{p.status}</span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  type="button" 
                  className="btn light small" 
                  onClick={handleGetFromPayroll}
                  title="Pull values from this employee's payroll record for the current period"
                >
                  🔄 Get from Payroll
                </button>
                <button className="modal-close-x" onClick={() => setModalOpen(false)}>✕</button>
              </div>
            </div>
            <form onSubmit={(e) => handleSavePayslip(e, true)}>
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
                  <label className="field-label">Pay Period</label>
                  <select
                    className="select"
                    value={form.period}
                    onChange={(e) => setForm({ ...form, period: e.target.value })}
                  >
                    <option value="">Select Period</option>
                    {periodOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button 
                  type="button" 
                  className="btn light" 
                  style={{ flex: 1 }} 
                  onClick={(e) => handleSavePayslip(e, false)}
                >
                  Save as Draft
                </button>
                <button 
                  type="submit" 
                  className="btn primary submit-btn" 
                  style={{ flex: 1 }}
                >
                  Confirm & Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
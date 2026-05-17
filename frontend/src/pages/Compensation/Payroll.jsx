import React, { useState, useEffect, useRef } from 'react';
import './Payroll.css';
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

function getPeriodFromDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const mm = String(month).padStart(2, '0');
  if (day >= 1 && day <= 15) {
    return `P1-${year}-${mm}`;
  } else {
    return `P2-${year}-${mm}`;
  }
}

export default function GeneralPayroll({ localPhotos }) {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return getPeriodFromDate(now.toISOString().split('T')[0]);
  });
  const [department, setDepartment] = useState('All Departments');
  const [processingDate, setProcessingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nameSort, setNameSort] = useState('none');
  const [statusFilter, setStatusFilter] = useState('All');
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [fullImageView, setFullImageView] = useState(null);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    employeeId: '',
    employeeName: '',
    baseSalary: '',
    overtime: '',
    overtimeHours: 0,
    deduction: '',
    netPay: '',
    status: '',
  });

  const filterRef = useRef(null);
  const searchInputRef = useRef(null);

  const formatPeso = (value, showZero = false) => {
    if (typeof value === 'string') {
      value = value.replace(/[^\d.-]/g, '');
    }
    const num = parseFloat(value) || 0;
    if (num === 0 && !showZero) return '';
    return `₱${num.toLocaleString('en-PH', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const displayCellValue = (val) => {
    const s = String(val ?? '').trim();
    if (s === '-' || s === '') return '';
    return val;
  };

  const handleProcessingDateChange = (e) => {
    const newDate = e.target.value;
    setProcessingDate(newDate);
    const newPeriod = getPeriodFromDate(newDate);
    setPeriod(newPeriod);
  };

  const periodOptions = [];
  const now = new Date();
  for (let m = 0; m < 12; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const mm = String(month).padStart(2, '0');
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    
    periodOptions.push({
      value: `P1-${year}-${mm}`,
      label: `${monthName} 1-15, ${year}`
    });
    
    const lastDay = new Date(year, month, 0).getDate();
    periodOptions.push({
      value: `P2-${year}-${mm}`,
      label: `${monthName} 16-${lastDay}, ${year}`
    });
  }

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

  useEffect(() => {
    loadSummary();
  }, [period]);

  const loadRecords = (q = query, s = nameSort, p = period, d = department, st = statusFilter) => {
    const params = `q=${encodeURIComponent(q)}&sort=${s}&period=${encodeURIComponent(p)}&department=${encodeURIComponent(d)}&status=${encodeURIComponent(st)}`;
    
    fetch(`${API_BASE}/api/payroll/records?${params}`)
      .then((r) => r.json())
      .then(data => {
        const enhanced = data.map(r => {
          if (r.employmentCategory && r.employmentCategory !== 'Job Order') {
            const raw = parseFloat(String(r.baseSalary).replace(/[^\d.-]/g, '')) || 0;
            return {
              ...r,
              displaySalary: `₱${(raw * 1.2).toLocaleString()}`
            };
          }
          return { ...r, displaySalary: r.baseSalary };
        });
        setRecords(enhanced);
      });

    fetch(`${API_BASE}/api/payroll/summary?${params}`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  };

  useEffect(() => {
    loadRecords(query, nameSort, period, department, statusFilter);
  }, [period, department, nameSort, statusFilter]);

  const handleSearch = (e) => {
    const val = e.target.value;
    setQuery(val);
    loadRecords(val, nameSort, period, department, statusFilter);
  };

  const handleClearSearch = () => {
    setQuery('');
    loadRecords('', nameSort, period, department, statusFilter);
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => {
      const updated = { ...prev, [name]: value };
      if (['baseSalary', 'overtime', 'overtimeHours', 'deduction'].includes(name)) {
        const base = parseFloat(updated.baseSalary) || 0;
        const rate = parseFloat(updated.overtime) || 0;
        const hours = parseFloat(updated.overtimeHours) || 0;
        const ded = parseFloat(updated.deduction) || 0;
        
        const calculatedOTAmount = rate * hours;

        let currentBase = base;
        if (updated.employmentCategory && updated.employmentCategory !== 'Job Order') {
          currentBase = base * 1.2;
        }

        updated.netPay = ((currentBase / 2) + calculatedOTAmount - ded).toFixed(2);
      }
      return updated;
    });
  };

  const handleGetFromPayslip = () => {
    if (!editForm.employeeId) return;
    fetch(`${API_BASE}/api/payslips/${editForm.employeeId}?period=${period}`)
      .then(res => {
        if (!res.ok) throw new Error('No payslip found for this period');
        return res.json();
      })
      .then(data => {
        setEditForm(prev => ({
          ...prev,
          baseSalary: String(data.gross || '0').replace(/[^\d.-]/g, ''),
          deduction: String(data.deductions || '0').replace(/[^\d.-]/g, ''),
        }));
        // Note: bonus from payslip isn't directly mapped to overtime rate, 
        // but base salary and deductions are usually what users want to sync.
      })
      .catch(err => {
        console.error('Sync error:', err);
        alert(err.message);
      });
  };

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
          <div className="title">General Payrolls</div>
          <div className="page-description">Monitor and manage employee compensation and payroll records</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => {
            fetch(`${API_BASE}/api/payroll/generate`, { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ period })
            })
              .then((r) => r.json())
              .then(() => {
                loadSummary(period);
                loadRecords(query, nameSort, period, department, statusFilter);
              });
          }}>Process Payroll</button>
          <div className="avatar" />
        </div>
      </div>

      <div className="grid-3">
        <Metric label="Total No. of Employees" value={summary?.totalEmployees ?? '0'} icon="👥" />
        <Metric label="Base Payroll" value={summary?.basePayroll ?? '0'} icon="💰" />
        <Metric label="Total Overtime" value={summary?.totalOvertime ?? '0'} icon="⌛" />
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">Payroll Processing Setup</div>
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
          <div className="form-col">
            <label className="field-label">Department</label>
            <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option>All Departments</option>
              <option>Admin of Finance</option>
              <option>Office of the Regional Director</option>
            </select>
          </div>
          <div className="form-col">
            <label className="field-label">Processing Date</label>
            <input className="input" type="date" value={processingDate} onChange={handleProcessingDateChange} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Employee Payroll Records</div>
          <div className="card-actions">
            <div className="search">
              <Search size={18} className="search-icon" />
              <input
                ref={searchInputRef}
                placeholder="Search UID, Name, ..."
                value={query}
                onChange={handleSearch}
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
                  <div className="form-col" style={{ marginBottom: '12px' }}>
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
                  <div className="form-col">
                    <label className="field-label">Status Type</label>
                    <select
                      className="select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="All">All Statuses</option>
                      <option value="Generated">Generated</option>
                      <option value="Updated">Updated</option>
                      <option value="Draft">Draft</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="table-container">
          <div className="table payroll-table">
            <div className="thead">
              <div className="text-center">UID</div>
              <div className="text-center">Name</div>
              <div className="text-center">Base Salary</div>
              <div className="text-center">OT Rate/Hrs</div>
              <div className="text-center">OT Amount</div>
              <div className="text-center">Deduction</div>
              <div className="text-center">Net Pay</div>
              <div className="text-center">Status</div>
              <div className="text-center">Action</div>
            </div>

            {records.length > 0 ? (
              records.map((row, idx) => (
                <div className="trow" key={row.employeeId || idx}>
                  <div className="text-center uid-text">{row.employeeId || '-'}</div>
                  <div className="namecell">
                    <div
                      className="employee-avatar clickable-avatar avatar-border"
                      onClick={() => {
                        const imgUrl = row.avatarUrl ? `${API_BASE}${row.avatarUrl}` : localPhotos[row.employeeId];
                        if (imgUrl) setFullImageView(imgUrl);
                      }}
                    >
                      {row.avatarUrl ? (
                        <img src={`${API_BASE}${row.avatarUrl}`} alt="" />
                      ) : localPhotos[row.employeeId] ? (
                        <img src={localPhotos[row.employeeId]} alt="" />
                      ) : (
                        <span className="employee-avatar-initials">
                          {(row.employeeName || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="employee-name-text">{row.employeeName || '-'}</span>
                  </div>
                  <div className="text-center">{displayCellValue(formatPeso(row.displaySalary, !row.statusClass?.includes('preview')))}</div>
                  <div className="text-center">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{displayCellValue(formatPeso(row.overtime, !row.statusClass?.includes('preview')))}</span>
                      <span style={{ fontWeight: 600 }}>{row.overtimeHours || 0} hrs</span>
                    </div>
                  </div>
                  <div className="text-center" style={{ color: '#2ecc71', fontWeight: 600 }}>
                    {displayCellValue(formatPeso(row.overtimeAmount, !row.statusClass?.includes('preview')))}
                  </div>
                  <div className="text-center">{displayCellValue(formatPeso(row.deduction, !row.statusClass?.includes('preview')))}</div>
                  <div className="text-center" style={{ fontWeight: 600 }}>
                    {formatPeso(row.netPay)}
                  </div>
                  <div className="status-cell">
                    <span className={`status ${(row.status || 'Draft').toLowerCase()}`}>
                      {row.status}
                    </span>
                  </div>
                  <div className="activity-cell">
                    <button className="btn small edit-btn" onClick={() => {
                      // Clean values for the numeric inputs
                      const cleanBase = String(row.baseSalary || '').replace(/[^\d.-]/g, '');
                      const cleanOT = String(row.overtime || '').replace(/[^\d.-]/g, '');
                      const cleanDed = String(row.deduction || '').replace(/[^\d.-]/g, '');
                      const cleanNet = String(row.netPay || '').replace(/[^\d.-]/g, '');

                      // Determine initial status for the edit form
                      let initialStatus = row.status || 'Draft';
                      if (initialStatus.includes('Preview')) {
                        initialStatus = 'Draft';
                      }

                      setEditForm({
                        employeeId: row.employeeId || '',
                        employeeName: row.employeeName || '',
                        employmentCategory: row.employmentCategory || '',
                        baseSalary: cleanBase || '0',
                        overtime: cleanOT || '0',
                        overtimeHours: row.overtimeHours || 0,
                        deduction: cleanDed || '0',
                        netPay: cleanNet || '0',
                        status: initialStatus,
                      });
                      setEditOpen(true);
                    }}>Edit</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-records-row">No record(s) found/added</div>
            )}
          </div>
        </div>
      </div>

      {editOpen && (
        <div className="modal-backdrop" onClick={() => setEditOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="card-title">Edit Payroll Info</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn light small" 
                  onClick={handleGetFromPayslip}
                  title="Pull values from this employee's payslip for the current period"
                >
                  🔄 Get from Payslip
                </button>
                <button className="modal-close-x" onClick={() => setEditOpen(false)}>✕</button>
              </div>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              setSaving(true);
              fetch(`${API_BASE}/api/payroll/records/${encodeURIComponent(editForm.employeeId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...editForm, period }),
              })
                .then(async (res) => {
                  if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Failed to save changes');
                  }
                  return res.json();
                })
                .then(() => {
                  setEditOpen(false);
                  loadRecords();
                })
                .catch(err => {
                  console.error('Save error:', err);
                  alert(`Error: ${err.message}`);
                })
                .finally(() => {
                  setSaving(false);
                });
            }}>
              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">UID</label>
                  <input className="input" style={{backgroundColor: '#f5f5f5'}} value={editForm.employeeId} readOnly />
                </div>
                <div className="form-col">
                  <label className="field-label">Name</label>
                  <input
                    name="employeeName"
                    className="input"
                    placeholder="Enter Name"
                    value={editForm.employeeName}
                    onChange={handleEditChange}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Base Salary</label>
                  <input
                    name="baseSalary"
                    type="number"
                    step="any"
                    className="input"
                    placeholder="e.g. 25000"
                    value={editForm.baseSalary}
                    onChange={handleEditChange}
                    disabled={saving}
                  />
                </div>
                <div className="form-col">
                  <label className="field-label">Overtime (Rate/hr)</label>
                  <input
                    name="overtime"
                    type="number"
                    step="any"
                    className="input"
                    placeholder="e.g. 0"
                    value={editForm.overtime}
                    onChange={handleEditChange}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Overtime Hours (Actual)</label>
                  <input
                    name="overtimeHours"
                    type="number"
                    step="any"
                    className="input"
                    placeholder="e.g. 10"
                    value={editForm.overtimeHours}
                    onChange={handleEditChange}
                    disabled={saving}
                  />
                </div>
                <div className="form-col">
                  <label className="field-label">Deduction</label>
                  <input
                    name="deduction"
                    type="number"
                    step="any"
                    className="input"
                    placeholder="e.g. 500"
                    value={editForm.deduction}
                    onChange={handleEditChange}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Net Pay (Calculated)</label>
                  <input
                    name="netPay"
                    type="text"
                    className="input"
                    style={{fontWeight: 'bold', color: '#2ecc71'}}
                    value={formatPeso(editForm.netPay, true)}
                    readOnly
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Status</label>
                  <select
                    name="status"
                    className="select"
                    value={editForm.status}
                    onChange={handleEditChange}
                    disabled={saving}
                  >
                    <option value="Generated">Generated</option>
                    <option value="Updated">Updated</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn primary submit-btn" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
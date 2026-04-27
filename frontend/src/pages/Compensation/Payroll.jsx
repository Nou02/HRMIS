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

export default function GeneralPayroll({ localPhotos }) {
  const [period, setPeriod] = useState('');
  const [department, setDepartment] = useState('All Departments');
  const [processingDate, setProcessingDate] = useState('');
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nameSort, setNameSort] = useState('none');
  const [statusFilter, setStatusFilter] = useState('All');
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [fullImageView, setFullImageView] = useState(null);

  const [editForm, setEditForm] = useState({
    employeeId: '',
    employeeName: '',
    baseSalary: '',
    overtime: '',
    deduction: '',
    netPay: '',
    status: '',
  });

  const filterRef = useRef(null);
  const searchInputRef = useRef(null);

  const formatPeso = (value) => {
    if (typeof value === 'string') {
      value = value.replace(/[^\d.-]/g, '');
    }
    const num = parseFloat(value) || 0;
    if (num === 0) return '';
    return `₱${num % 1 === 0
      ? num.toLocaleString('en-PH', { minimumFractionDigits: 0 })
      : num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }`;
  };

  const displayCellValue = (val) => {
    const s = String(val ?? '').trim();
    if (s === '0' || s === '0.00' || s === '-' || s === '') return '';
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

  useEffect(() => {
    fetch(`${API_BASE}/api/payroll/summary`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  }, []);

  const loadRecords = (q = query, s = nameSort, p = period, d = department, st = statusFilter) => {
    const params = `q=${encodeURIComponent(q)}&sort=${s}&period=${encodeURIComponent(p)}&department=${encodeURIComponent(d)}&status=${encodeURIComponent(st)}`;
    
    fetch(`${API_BASE}/api/payroll/records?${params}`)
      .then((r) => r.json())
      .then(setRecords);

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
      if (['baseSalary', 'overtime', 'deduction'].includes(name)) {
        const base = parseFloat(updated.baseSalary) || 0;
        const ot = parseFloat(updated.overtime) || 0;
        const ded = parseFloat(updated.deduction) || 0;
        updated.netPay = (base - ded).toFixed(2);
      }
      return updated;
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
                fetch(`${API_BASE}/api/payroll/summary`).then((r) => r.json()).then(setSummary);
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
            <input className="input" placeholder="e.g. Oct 1-15, 2023" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="form-col">
            <label className="field-label">Department</label>
            <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option>All Departments</option>
              <option>Technical Operations Divisions</option>
              <option>Admin of Finance</option>
              <option>Office of the Regional Director</option>
            </select>
          </div>
          <div className="form-col">
            <label className="field-label">Processing Date</label>
            <input className="input" type="date" value={processingDate} onChange={(e) => setProcessingDate(e.target.value)} />
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
              <div className="text-center">Overtime</div>
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
                  <div className="text-center">{displayCellValue(row.baseSalary)}</div>
                  <div className="text-center">{displayCellValue(row.overtime)}</div>
                  <div className="text-center">{displayCellValue(row.deduction)}</div>
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
                      setEditForm({
                        employeeId: row.employeeId || '',
                        employeeName: row.employeeName || '',
                        baseSalary: String(row.baseSalary || '').replace(/[^\d.-]/g, '') || '0',
                        overtime: String(row.overtime || '').replace(/[^\d.-]/g, '') || '0',
                        deduction: String(row.deduction || '').replace(/[^\d.-]/g, '') || '0',
                        netPay: String(row.netPay || '').replace(/[^\d.-]/g, '') || '0',
                        status: row.status || 'Draft',
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
              <button className="modal-close-x" onClick={() => setEditOpen(false)}>✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              fetch(`${API_BASE}/api/payroll/records/${encodeURIComponent(editForm.employeeId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...editForm, period }),
              }).then(() => {
                setEditOpen(false);
                loadRecords();
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
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Base Salary</label>
                  <input
                    name="baseSalary"
                    type="number"
                    className="input"
                    placeholder="e.g. 25000"
                    value={editForm.baseSalary}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="form-col">
                  <label className="field-label">Overtime</label>
                  <input
                    name="overtime"
                    type="number"
                    className="input"
                    placeholder="e.g. 1000"
                    value={editForm.overtime}
                    onChange={handleEditChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Deduction</label>
                  <input
                    name="deduction"
                    type="number"
                    className="input"
                    placeholder="e.g. 500"
                    value={editForm.deduction}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="form-col">
                  <label className="field-label">Net Pay (Calculated)</label>
                  <input
                    name="netPay"
                    type="text"
                    className="input"
                    style={{fontWeight: 'bold', color: '#2ecc71'}}
                    value={formatPeso(editForm.netPay)}
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
                  >
                    <option value="Generated">Generated</option>
                    <option value="Updated">Updated</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn primary submit-btn">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import './compensation.css';

export default function GeneralPayroll() {
  const [period, setPeriod] = useState('');
  const [department, setDepartment] = useState('All Departments');
  const [processingDate, setProcessingDate] = useState('');
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nameSortAZ, setNameSortAZ] = useState(false);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    employeeId: '',
    employeeName: '',
    baseSalary: '',
    overtime: '',
    deduction: '',
    netPay: '',
    status: '',
  });

  React.useEffect(() => {
    fetch('http://localhost:5174/api/payroll/summary')
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  }, []);
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (nameSortAZ) params.set('sort', 'name_asc');
    fetch(`http://localhost:5174/api/payroll/records${params.toString() ? `?${params.toString()}` : ''}`)
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setRecords(list);
        } else {
          fetch('http://localhost:5174/api/employees')
            .then((r) => r.json())
            .then((emps) => {
              const rows = (emps || []).map((e) => ({
                employeeId: e.uid,
                employeeName: e.name,
                baseSalary: '-',
                overtime: '-',
                deduction: '-',
                netPay: '-',
                status: 'Draft',
                statusClass: 'draft',
              }));
              setRecords(rows);
            })
            .catch(() => setRecords([]));
        }
      })
      .catch(() => {});
  }, [query, nameSortAZ]);

 

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="title">Compensation · General Payroll</div>
        <div className="actions">
          <div className="avatar" />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Payroll Processing Setup</div>
          <div className="card-actions">
            <button className="btn primary" onClick={() => {
              fetch('http://localhost:5174/api/payroll/generate', { method: 'POST' })
                .then((r) => r.json())
                .then(() => {
                  fetch('http://localhost:5174/api/payroll/summary')
                    .then((r) => r.json())
                    .then(setSummary)
                    .catch(() => {});
                  const params = new URLSearchParams();
                  if (query) params.set('q', query);
                  if (nameSortAZ) params.set('sort', 'name_asc');
                  fetch(`http://localhost:5174/api/payroll/records${params.toString() ? `?${params.toString()}` : ''}`)
                    .then((r) => r.json())
                    .then(setRecords)
                    .catch(() => {});
                })
                .catch(() => {});
            }}>Process Payroll</button>
          </div>
        </div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="form-col">
            <label>Pay Period</label>
            <input className="input" placeholder="Select period" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="form-col">
            <label>Department</label>
            <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option>All Departments</option>
              <option>Technical Operations Divisions</option>
              <option>Admin of Finance</option>
              <option>Office of the Regional Director</option>
            </select>
          </div>
          <div className="form-col">
            <label>Processing Date</label>
            <input className="input" type="date" value={processingDate} onChange={(e) => setProcessingDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid-3">
        <Metric label="Total No. Employees" value={summary?.totalEmployees ?? '—'} />
        <Metric label="Base Payroll" value={summary?.basePayroll ?? '—'} />
        <Metric label="Total Overtime" value={summary?.totalOvertime ?? '—'} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Employee Payroll Records</div>
          <div className="card-actions">
            <div className="search">
              <span>🔍</span>
              <input placeholder="Search employee name or ID..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button className="btn light" onClick={() => setFiltersOpen((v) => !v)}>Filters</button>
          </div>
        </div>
        {filtersOpen && (
          <div className="dropdown-menu">
            <div className="form-col">
              <label>Name (Sort A–Z)</label>
              <select className="select" value={nameSortAZ ? 'az' : 'none'} onChange={(e) => setNameSortAZ(e.target.value === 'az')}>
                <option value="none">None</option>
                <option value="az">A–Z</option>
              </select>
            </div>
          </div>
        )}
        
        <div className="table">
          <div className="thead" style={{ gridTemplateColumns: '160px 220px 140px 140px 140px 160px 120px 120px' }}>
            <div>Employee ID</div>
            <div>Employee Name</div>
            <div>Base Salary</div>
            <div>Overtime</div>
            <div>Deduction</div>
            <div>Net Pay</div>
            <div>Status</div>
            <div>Activity</div>
          </div>
          {(records.length ? records : Array.from({ length: 4 }, (_, i) => ({ key: i }))).map((row) => {
            if (!records.length) {
              return (
                <div className="trow" key={row.key} style={{ gridTemplateColumns: '160px 220px 140px 140px 140px 160px 120px 120px' }}>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div><span className="status draft">Draft</span></div>
                  <div><button className="btn small" onClick={() => {
                    setEditForm({
                      employeeId: '',
                      employeeName: '',
                      baseSalary: '',
                      overtime: '',
                      deduction: '',
                      netPay: '',
                      status: 'Draft',
                    });
                    setEditOpen(true);
                  }}>Edit</button></div>
                </div>
              );
            }
            return (
              <div className="trow" key={row.employeeId} style={{ gridTemplateColumns: '160px 220px 140px 140px 140px 160px 120px 120px' }}>
                <div>{row.employeeId}</div>
                <div>{row.employeeName}</div>
                <div>{row.baseSalary}</div>
                <div>{row.overtime}</div>
                <div>{row.deduction}</div>
                <div>{row.netPay}</div>
                <div><span className={`status ${row.statusClass}`}>{row.status}</span></div>
                <div><button className="btn small" onClick={() => {
                  setEditForm({
                    employeeId: row.employeeId,
                    employeeName: row.employeeName,
                    baseSalary: String(row.baseSalary || '').replace(/[^\d.-]/g, ''),
                    overtime: String(row.overtime || '').replace(/[^\d.-]/g, ''),
                    deduction: String(row.deduction || '').replace(/[^\d.-]/g, ''),
                    netPay: String(row.netPay || '').replace(/[^\d.-]/g, ''),
                    status: row.status || 'Generated',
                  });
                  setEditOpen(true);
                }}>Edit</button></div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12, gap: 8 }}>
          <button className="btn light">Previous</button>
          <button className="btn light">Next</button>
        </div>
      </div>
      
      {editOpen && (
        <div className="modal-backdrop" onClick={() => setEditOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="card-title">Edit Payroll · {editForm.employeeName || '—'}</div>
              <button className="btn light" onClick={() => setEditOpen(false)}>Close</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              fetch(`http://localhost:5174/api/payroll/records/${encodeURIComponent(editForm.employeeId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  employeeName: editForm.employeeName,
                  baseSalary: editForm.baseSalary,
                  overtime: editForm.overtime,
                  deduction: editForm.deduction,
                  netPay: editForm.netPay,
                  status: editForm.status,
                }),
              })
                .then((r) => r.json())
                .then(() => {
                  setEditOpen(false);
                  const params = new URLSearchParams();
                  if (query) params.set('q', query);
                  if (nameSortAZ) params.set('sort', 'name_asc');
                  fetch(`http://localhost:5174/api/payroll/records${params.toString() ? `?${params.toString()}` : ''}`)
                    .then((r) => r.json())
                    .then(setRecords)
                    .catch(() => {});
                })
                .catch(() => {});
            }}>
              <div className="form-row">
                <div className="form-col">
                  <label>Employee ID</label>
                  <input className="input" value={editForm.employeeId} onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })} />
                </div>
                <div className="form-col">
                  <label>Employee Name</label>
                  <input className="input" value={editForm.employeeName} onChange={(e) => setEditForm({ ...editForm, employeeName: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label>Base Salary</label>
                  <input className="input" value={editForm.baseSalary} onChange={(e) => setEditForm({ ...editForm, baseSalary: e.target.value })} />
                </div>
                <div className="form-col">
                  <label>Overtime</label>
                  <input className="input" value={editForm.overtime} onChange={(e) => setEditForm({ ...editForm, overtime: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label>Deduction</label>
                  <input className="input" value={editForm.deduction} onChange={(e) => setEditForm({ ...editForm, deduction: e.target.value })} />
                </div>
                <div className="form-col">
                  <label>Net Pay</label>
                  <input className="input" value={editForm.netPay} onChange={(e) => setEditForm({ ...editForm, netPay: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label>Status</label>
                  <select className="select" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    <option>Generated</option>
                    <option>Updated</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn primary">Save</button>
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

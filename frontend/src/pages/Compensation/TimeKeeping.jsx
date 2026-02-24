import React, { useState } from 'react';
import './compensation.css';

export default function TimeKeeping() {
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortNameAZ, setSortNameAZ] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    uid: '',
    name: '',
    clockIn: '',
    clockOut: '',
    status: 'Present',
  });

  React.useEffect(() => {
    fetch('http://localhost:5174/api/timekeeping/summary')
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  }, []);

  const loadRecords = React.useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (sortNameAZ) params.set('sort', 'name_asc');
    if (statusFilter) params.set('status', statusFilter);
    fetch(`http://localhost:5174/api/timekeeping${params.toString() ? `?${params.toString()}` : ''}`)
      .then((r) => r.json())
      .then(setRecords)
      .catch(() => setRecords([]));
  }, [query, sortNameAZ, statusFilter]);

  React.useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  

  function submitForm(e) {
    e.preventDefault();
    fetch('http://localhost:5174/api/timekeeping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then((r) => r.json())
      .then(() => {
        setModalOpen(false);
        setForm({ uid: '', name: '', clockIn: '', clockOut: '', status: 'Present' });
        loadRecords();
        fetch('http://localhost:5174/api/timekeeping/summary')
          .then((r) => r.json())
          .then(setSummary)
          .catch(() => {});
      })
      .catch(() => {});
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="title">Compensation · Time Keeping</div>
        <div className="actions">
          <input className="input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          <div className="avatar" />
        </div>
      </div>

      <div className="grid-3">
        <Metric label="Total Late" value={summary?.totalLate ?? '—'} />
        <Metric label="Total Attendance" value={summary?.totalAttendance ?? '—'} />
        <Metric label="Total Absent" value={summary?.totalAbsent ?? '—'} />
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: 16 }}>
          <Metric label="Total Overtime" value={summary?.totalOvertime ?? '—'} />
          <Metric label="Calendar" value={selectedDate} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Time Keeping</div>
          <div className="card-actions">
            <div className="search">
              <span>🔍</span>
              <input
                placeholder="Search by UID or name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="btn light" onClick={() => setFiltersOpen((v) => !v)}>Filters</button>
            <button className="btn primary" onClick={() => setModalOpen(true)}>Add Record</button>
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
            <div className="form-col">
              <label>Status</label>
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="Absent">Absent</option>
                <option value="Travel">Travel</option>
                <option value="Present">Present</option>
                <option value="HalfDay">HalfDay</option>
              </select>
            </div>
          </div>
        )}
        
        <div className="table">
          <div className="thead" style={{ gridTemplateColumns: '140px 200px 120px 120px 120px 120px 120px 120px 100px' }}>
            <div>UID</div>
            <div>Name</div>
            <div>Clock In</div>
            <div>Clock Out</div>
            <div>Total Time</div>
            <div>Total Time Late</div>
            <div>Total Overtime</div>
            <div>Status</div>
            <div>Action</div>
          </div>
          {(records.length ? records : Array.from({ length: 4 }, (_, i) => ({ key: i }))).map((row) => {
            if (!records.length) {
              return (
                <div className="trow" key={row.key} style={{ gridTemplateColumns: '140px 200px 120px 120px 120px 120px 120px 120px 100px' }}>
                  <div>-</div>
                  <div className="namecell"><span>-</span></div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div><span className="status draft">Absent</span></div>
                  <div>-</div>
                </div>
              );
            }
            return (
              <div className="trow" key={row.uid} style={{ gridTemplateColumns: '140px 200px 120px 120px 120px 120px 120px 120px 100px' }}>
                <div>{row.uid}</div>
                <div className="namecell"><span>{row.name}</span></div>
                <div>{row.clockIn}</div>
                <div>{row.clockOut}</div>
                <div>{row.totalTime}</div>
                <div>{row.totalLate}</div>
                <div>{row.totalOvertime}</div>
                <div><span className={`status ${row.statusClass}`}>{row.status}</span></div>
                <div><button className="btn small">Edit</button></div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12, gap: 8 }}>
          <button className="btn light">Previous</button>
          <button className="btn light">Next</button>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="card-title">Add Record</div>
              <button className="btn light" onClick={() => setModalOpen(false)}>Close</button>
            </div>
            <form onSubmit={submitForm}>
              <div className="form-row">
                <div className="form-col">
                  <label>UID</label>
                  <input className="input" value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} required />
                </div>
                <div className="form-col">
                  <label>Name</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label>Clock In</label>
                  <input className="input" type="time" value={form.clockIn} onChange={(e) => setForm({ ...form, clockIn: e.target.value })} />
                </div>
                <div className="form-col">
                  <label>Clock Out</label>
                  <input className="input" type="time" value={form.clockOut} onChange={(e) => setForm({ ...form, clockOut: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label>Status</label>
                  <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option>Absent</option>
                    <option>Travel</option>
                    <option>Present</option>
                    <option>HalfDay</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn primary">Add</button>
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

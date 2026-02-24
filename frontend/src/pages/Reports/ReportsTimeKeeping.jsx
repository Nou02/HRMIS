import React, { useState } from 'react';
import '../Compensation/compensation.css';

export default function ReportsTimeKeeping() {
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
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

  function downloadCSV(rows) {
    if (!rows || !rows.length) return;
    const headers = ['UID','Name','Clock In','Clock Out','Total Time','Total Late','Total Overtime','Status'];
    const csv = [headers.join(',')].concat(
      rows.map(r => [
        r.uid, r.name, r.clockIn, r.clockOut, r.totalTime, r.totalLate, r.totalOvertime, r.status
      ].map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timekeeping_report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function downloadExcel(rows) {
    if (!rows || !rows.length) return;
    const header = ['UID','Name','Clock In','Clock Out','Total Time','Total Late','Total Overtime','Status'];
    const tableRows = rows.map(r => `<tr><td>${r.uid}</td><td>${r.name}</td><td>${r.clockIn}</td><td>${r.clockOut}</td><td>${r.totalTime}</td><td>${r.totalLate}</td><td>${r.totalOvertime}</td><td>${r.status}</td></tr>`).join('');
    const html = `<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${header.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timekeeping_report.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function downloadPDF() {
    alert('PDF export will be added. For now, use CSV or Excel.');
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="title">Reports · Time Keeping</div>
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
            <button className="btn primary" onClick={() => setExportOpen((v) => !v)}>Export ▾</button>
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
        {exportOpen && (
          <div className="dropdown-menu">
            <div className="form-col">
              <label>Select export format</label>
              <button className="btn primary" onClick={() => downloadCSV(records)}>CSV</button>
              <button className="btn primary" onClick={() => downloadExcel(records)}>Excel</button>
              <button className="btn primary" onClick={downloadPDF}>PDF</button>
            </div>
          </div>
        )}
        <div className="table">
          <div className="thead" style={{ gridTemplateColumns: '140px 200px 120px 120px 120px 120px 120px 120px' }}>
            <div>UID</div>
            <div>Name</div>
            <div>Clock In</div>
            <div>Clock Out</div>
            <div>Total Time</div>
            <div>Total Time Late</div>
            <div>Total Overtime</div>
            <div>Status</div>
          </div>
          {(records.length ? records : Array.from({ length: 4 }, (_, i) => ({ key: i }))).map((row) => {
            if (!records.length) {
              return (
                <div className="trow" key={row.key} style={{ gridTemplateColumns: '140px 200px 120px 120px 120px 120px 120px 120px' }}>
                  <div>-</div>
                  <div className="namecell"><span>-</span></div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div><span className="status draft">Absent</span></div>
                </div>
              );
            }
            return (
              <div className="trow" key={row.uid} style={{ gridTemplateColumns: '140px 200px 120px 120px 120px 120px 120px 120px' }}>
                <div>{row.uid}</div>
                <div className="namecell"><span>{row.name}</span></div>
                <div>{row.clockIn}</div>
                <div>{row.clockOut}</div>
                <div>{row.totalTime}</div>
                <div>{row.totalLate}</div>
                <div>{row.totalOvertime}</div>
                <div><span className={`status ${row.statusClass}`}>{row.status}</span></div>
              </div>
            );
          })}
        </div>
      </div>
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

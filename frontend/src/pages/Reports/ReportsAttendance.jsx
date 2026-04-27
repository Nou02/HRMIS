import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './Attendance.css';
import { API_BASE } from '../../lib/api';
import { Search, X, Filter, ChevronDown, FileDown, FileText, Table, Printer, Users, Clock, Calendar } from 'lucide-react';
import dictLogo from '../../assets/Header1.jpg';

const formatTo12Hr = (timeString) => {
  if (!timeString || timeString === '-' || timeString === '00:00') return '-';
  const [hours, minutes] = timeString.split(':');
  let hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${hour}:${minutes || '00'} ${ampm}`;
};

const formatDurationClean = (totalMinutes) => {
  if (totalMinutes <= 0 || isNaN(totalMinutes)) return '-';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  const hPart = h > 0 ? `${h}h` : '';
  const mPart = m > 0 ? `${m}m` : '';
  const result = `${hPart} ${mPart}`.trim();
  return result || '-';
};

const calculateAttendanceRaw = (clockIn, clockOut, status) => {
  if (status === 'Absent' || status === 'On Leave' || !clockIn || !clockOut || clockIn === '-' || clockOut === '-') {
    return { totalMin: 0, lateMin: 0, otMin: 0 };
  }

  const [inH, inM] = clockIn.split(':').map(Number);
  const [outH, outM] = clockOut.split(':').map(Number);
  const inDate = new Date(2026, 0, 1, inH, inM);
  const outDate = new Date(2026, 0, 1, outH, outM);
  
  let diffMin = (outDate - inDate) / (1000 * 60);
  if (diffMin < 0) return { totalMin: 0, lateMin: 0, otMin: 0 };

  // 1-hour lunch deduction
  const netMin = Math.max(0, diffMin - 60);

  // STRICT SHIFT LOGIC
  const isSevenAmShift = (inH < 7) || (inH === 7 && inM <= 30);
  const scheduledInH = isSevenAmShift ? 7 : 8;
  const scheduledOutH = isSevenAmShift ? 18 : 17;

  let lateMin = 0;
  if (inH > scheduledInH || (inH === scheduledInH && inM > 0)) {
    lateMin = (inH - scheduledInH) * 60 + inM;
  }

  let otMin = 0;
  if (outH > scheduledOutH || (outH === scheduledOutH && outM > 0)) {
    otMin = (outH - scheduledOutH) * 60 + outM;
  }

  return { totalMin: netMin, lateMin, otMin };
};

export default function ReportsTimeKeeping({ localPhotos }) {
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [nameSort, setNameSort] = useState('none');
  const [statusFilter, setStatusFilter] = useState('All');
  const [records, setRecords] = useState([]);
  const [fullImageView, setFullImageView] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const filterRef = useRef(null);
  const exportRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) setFiltersOpen(false);
      if (exportRef.current && !exportRef.current.contains(event.target)) setExportOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadRecords = useCallback(() => {
    fetch(`${API_BASE}/api/timekeeping`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        if (list.length === 0 && !query) {
          fetch(`${API_BASE}/api/employees`)
            .then(r => r.json())
            .then(emps => {
              const rows = (emps || []).map(e => ({
                uid: e.uid,
                name: e.name,
                avatarUrl: e.avatarUrl,
                clockIn: '',
                clockOut: '',
                status: 'Present'
              }));
              setRecords(rows);
            });
        } else {
          setRecords(list);
        }
      })
      .catch(() => setRecords([]));
  }, [query]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const processedRecords = useMemo(() => {
    let result = records.map(r => {
      const raw = calculateAttendanceRaw(r.clockIn, r.clockOut, r.status || 'Present');
      return {
        ...r,
        totalTime: formatDurationClean(raw.totalMin),
        late: raw.lateMin > 0 ? formatDurationClean(raw.lateMin) : '-',
        overtime: raw.otMin > 0 ? formatDurationClean(raw.otMin) : '-',
        rawTime: raw.totalMin,
        rawLate: raw.lateMin,
        rawOT: raw.otMin
      };
    });

    if (query) {
      const q = query.toLowerCase();
      result = result.filter(r => r.uid.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    }
    if (statusFilter !== 'All') result = result.filter(r => r.status === statusFilter);

    const statusPriority = { 'Present': 1, 'Travel': 2, 'HalfDay': 3, 'On Leave': 4, 'Absent': 5 };
    result.sort((a, b) => {
      const priorityA = statusPriority[a.status] || 99;
      const priorityB = statusPriority[b.status] || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      if (nameSort === 'asc') return (a.name || '').localeCompare(b.name || '');
      if (nameSort === 'desc') return (b.name || '').localeCompare(a.name || '');
      const timeA = a.clockIn && a.clockIn !== '-' ? a.clockIn : '23:59';
      const timeB = b.clockIn && b.clockIn !== '-' ? b.clockIn : '23:59';
      return timeA.localeCompare(timeB);
    });

    return result;
  }, [records, query, statusFilter, nameSort]);

  const stats = useMemo(() => {
    return {
      present: records.filter(r => r.status === 'Present').length,
      travel: records.filter(r => r.status === 'Travel').length,
      halfDay: records.filter(r => r.status === 'HalfDay').length,
      leave: records.filter(r => r.status === 'On Leave').length,
      absent: records.filter(r => r.status === 'Absent').length,
    };
  }, [records]);

  const getExportFileName = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `DICT_Attendance (${mm}-${dd}-${yyyy})`;
  };

  const getStatusStyle = (status) => {
    const s = String(status).toLowerCase();
    if (s === 'present') return 'background-color: #dcfce7; color: #166534;';
    if (s === 'absent') return 'background-color: #fee2e2; color: #fd0202;';
    if (s === 'travel') return 'background-color: #a3fcfc; color: #0e8185;';
    if (s === 'halfday') return 'background-color: #ffedd5; color: #ff5607;';
    if (s === 'on leave') return 'background-color: #e0e7ff; color: #3730a3;';
    return '';
  };

  const downloadCSV = () => {
    const headers = ['UID', 'Name', 'Clock In', 'Clock Out', 'Total Time', 'Late', 'Overtime', 'Status'];
    const csv = [headers.join(',')].concat(
      processedRecords.map(r => [
        r.uid, r.name, formatTo12Hr(r.clockIn), formatTo12Hr(r.clockOut), r.totalTime, r.late, r.overtime, r.status
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${getExportFileName()}.csv`;
    link.click();
  };

  const downloadExcel = () => {
    const tableRows = processedRecords.map(r => `
      <tr>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px;">${r.uid}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px;">${r.name}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px;">${formatTo12Hr(r.clockIn)}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px;">${formatTo12Hr(r.clockOut)}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px;">${r.totalTime}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px;">${r.late}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px;">${r.overtime}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px; font-weight: bold; ${getStatusStyle(r.status)}">${r.status}</td>
      </tr>`).join('');

    const html = `<html><head><meta charset="UTF-8"></head><body>
      <table style="border-collapse: collapse; width: 100%;">
        <thead><tr style="background-color: #f1f5f9;">
          <th style="border: 1px solid #e5e7eb; border-bottom: 2.5pt solid #000000; padding: 12px; text-align: center;">UID</th>
          <th style="border: 1px solid #e5e7eb; border-bottom: 2.5pt solid #000000; padding: 12px; text-align: center;">Name</th>
          <th style="border: 1px solid #e5e7eb; border-bottom: 2.5pt solid #000000; padding: 12px; text-align: center;">Clock In</th>
          <th style="border: 1px solid #e5e7eb; border-bottom: 2.5pt solid #000000; padding: 12px; text-align: center;">Clock Out</th>
          <th style="border: 1px solid #e5e7eb; border-bottom: 2.5pt solid #000000; padding: 12px; text-align: center;">Total Time</th>
          <th style="border: 1px solid #e5e7eb; border-bottom: 2.5pt solid #000000; padding: 12px; text-align: center;">Late</th>
          <th style="border: 1px solid #e5e7eb; border-bottom: 2.5pt solid #000000; padding: 12px; text-align: center;">Overtime</th>
          <th style="border: 1px solid #e5e7eb; border-bottom: 2.5pt solid #000000; padding: 12px; text-align: center;">Status</th>
        </tr></thead><tbody>${tableRows}</tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${getExportFileName()}.xls`;
    link.click();
  };

  const downloadPDF = async () => {
    const getBase64Image = (url) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = url;
      });
    };

    let logoBase64 = "";
    try { logoBase64 = await getBase64Image(dictLogo); } catch (e) { console.error(e); }

    const getPdfStatusStyle = (status) => {
      const s = String(status).toLowerCase();
      if (s === 'present') return 'background-color: #dcfce7; color: #166534;';
      if (s === 'absent') return 'background-color: #fee2e2; color: #fd0202;';
      if (s === 'travel') return 'background-color: #a3fcfc; color: #0e8185;';
      if (s === 'halfday') return 'background-color: #ffedd5; color: #ff5607;';
      if (s === 'on leave') return 'background-color: #e0e7ff; color: #3730a3;';
    return 'background-color: #f1f5f9; color: #0f172a;';
    };

    const tableRows = processedRecords.map(r => `
      <tr>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 10px;">${r.uid}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 10px;">${r.name}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 10px;">${formatTo12Hr(r.clockIn)}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 10px;">${formatTo12Hr(r.clockOut)}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 10px;">${r.totalTime}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 10px;">${r.late}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 10px;">${r.overtime}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px;">
          <div style="padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 10px; ${getPdfStatusStyle(r.status)}">
            ${r.status.toUpperCase()}
          </div>
        </td>
      </tr>`).join('');

    const htmlContent = `<html><head><style>
      @page { margin: 0; }
      body { 
        font-family: sans-serif; 
        padding: 50px; 
        text-align: center; 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
      }
      .logo-container { width: 100%; margin-bottom: 10px; }
      .logo-container img { width: 100%; height: auto; display: block; }
      h2 { margin: 15px 0 5px 0; color: #0f172a; font-size: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { background-color: #f1f5f9; border: 1px solid #e5e7eb; border-bottom: 3px solid #000000; padding: 12px; font-size: 12px; text-align: center; }
      td { font-size: 11px; border: 1px solid #e5e7eb; }
    </style></head><body>
      <div class="logo-container">${logoBase64 ? `<img src="${logoBase64}" />` : ''}</div>
      <h2>DICT Attendance Logs</h2>
      <p style="color: #64748b; font-size: 12px;">Date: ${new Date().toLocaleDateString()}</p>
      <table>
        <thead><tr><th>UID</th><th>Name</th><th>Clock In</th><th>Clock Out</th><th>Total Time</th><th>Late</th><th>Overtime</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body></html>`;

    const oldTitle = document.title;
    document.title = getExportFileName();
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(htmlContent);
    iframe.contentWindow.document.close();
    setTimeout(() => {
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
      document.title = oldTitle;
    }, 500);
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
          <div className="title">Attendance Logs</div>
          <div className="page-description">Generate and export official employee attendance documentation</div>
        </div>
      </div>

      <div className="attendance-dashboard-metrics">
        <div className="mega-metric">
          <div className="mega-metric-header">
            <Users size={20} />
            <span>Attendance Status Summary</span>
          </div>
          <div className="mega-metric-content">
            <div className="status-item present">
              <div className="status-dot"></div>
              <span className="label">Present</span>
              <span className="count">{stats.present}</span>
            </div>
            <div className="status-item travel">
              <div className="status-dot"></div>
              <span className="label">Travel</span>
              <span className="count">{stats.travel}</span>
            </div>
            <div className="status-item halfday">
              <div className="status-dot"></div>
              <span className="label">Half Day</span>
              <span className="count">{stats.halfDay}</span>
            </div>
            <div className="status-item leave">
              <div className="status-dot"></div>
              <span className="label">Leave</span>
              <span className="count">{stats.leave}</span>
            </div>
            <div className="status-item absent">
              <div className="status-dot"></div>
              <span className="label">Absent</span>
              <span className="count">{stats.absent}</span>
            </div>
          </div>
        </div>

        <div className="calendar-metric">
          <div className="calendar-left">
            <div className="cal-month">{currentTime.toLocaleString('default', { month: 'short' }).toUpperCase()}</div>
            <div className="cal-day">{currentTime.getDate()}</div>
            <div className="cal-year">{currentTime.getFullYear()}</div>
          </div>
          <div className="calendar-right">
            <div className="cal-weekday">{currentTime.toLocaleString('default', { weekday: 'long' })}</div>
            <div className="cal-time">
                <Clock size={14} style={{ marginRight: '6px' }} />
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header overflow-visible">
          <div className="card-title">Documented Attendance Logs</div>
          <div className="card-actions">
            <div className="search">
              <Search size={18} className="search-icon" />
              <input placeholder="Search UID, Name, ..." value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && <X size={14} className="search-clear" onClick={() => setQuery('')} />}
            </div>

            <div className="dropdown" ref={filterRef}>
              <button className="btn light filter-btn" onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={18} /></button>
              {filtersOpen && (
                <div className="dropdown-menu">
                  <div className="form-col" style={{ marginBottom: '16px' }}>
                    <label className="field-label">Name</label>
                    <select className="select" value={nameSort} onChange={(e) => setNameSort(e.target.value)}>
                      <option value="none">None</option>
                      <option value="asc">Ascending (A–Z)</option>
                      <option value="desc">Descending (Z–A)</option>
                    </select>
                  </div>
                  <div className="form-col">
                    <label className="field-label">Status</label>
                    <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="All">All Statuses</option>
                      <option value="Present">Present</option>
                      <option value="HalfDay">Half Day</option>
                      <option value="Travel">Travel</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="dropdown" ref={exportRef}>
              <button className="btn primary export-btn" onClick={() => setExportOpen(!exportOpen)}>
                <FileDown size={18} style={{ marginRight: '8px' }} /> Export <ChevronDown size={16} style={{ marginLeft: '8px' }} />
              </button>
              {exportOpen && (
                <div className="dropdown-menu export-dropdown">
                  <button className="export-item" onClick={downloadCSV}><FileText size={16} style={{ marginRight: '10px' }} /> Download CSV</button>
                  <button className="export-item" onClick={downloadExcel}><Table size={16} style={{ marginRight: '10px' }} /> Download Excel</button>
                  <button className="export-item" onClick={downloadPDF}><Printer size={16} style={{ marginRight: '10px' }} /> Download PDF</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="table-container">
          <div className="table reports-attendance-table">
            <div className="thead">
              <div className="text-center">UID</div>
              <div className="text-center">NAME</div>
              <div className="text-center">CLOCK IN</div>
              <div className="text-center">CLOCK OUT</div>
              <div className="text-center">TOTAL TIME</div>
              <div className="text-center">LATE</div>
              <div className="text-center">OVERTIME</div>
              <div className="text-center">STATUS</div>
            </div>

            {processedRecords.length === 0 ? (
              <div className="no-records-row">No record(s) found/added</div>
            ) : (
              processedRecords.map((row) => (
                <div className="trow" key={row.uid}>
                  <div className="text-center uid-text">{row.uid}</div>
                  <div className="namecell">
                    <div className="employee-avatar clickable-avatar avatar-border" onClick={() => {
                        const imgUrl = row.avatarUrl ? `${API_BASE}${row.avatarUrl}` : localPhotos[row.uid];
                        if (imgUrl) setFullImageView(imgUrl);
                      }}>
                      {row.avatarUrl ? (
                        <img src={`${API_BASE}${row.avatarUrl}`} alt="" />
                      ) : localPhotos[row.uid] ? (
                        <img src={localPhotos[row.uid]} alt="" />
                      ) : (
                        <span>{row.name?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="employee-name-text">{row.name}</span>
                  </div>
                  <div className="text-center">{formatTo12Hr(row.clockIn)}</div>
                  <div className="text-center">{formatTo12Hr(row.clockOut)}</div>
                  <div className="text-center">{row.totalTime}</div>
                  <div className="text-center">{row.late}</div>
                  <div className="text-center">{row.overtime}</div>
                  <div className="text-center status-cell">
                    <span className={`status ${(row.status || 'present').replace(/\s+/g, '').toLowerCase()}`}>{row.status || 'Present'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
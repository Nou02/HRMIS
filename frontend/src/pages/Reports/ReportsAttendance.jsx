import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './Attendance.css';
import { API_BASE } from '../../lib/api';
import { Search, X, Filter, ChevronDown, FileDown, FileText, Table, Printer, Users, Clock, Calendar, AlertCircle } from 'lucide-react';
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

const calculateAttendanceRaw = (clockIn, clockOut, status, dateStr) => {
  if (status === 'Absent' || status === 'On Leave' || !clockIn || !clockOut || clockIn === '-' || clockOut === '-') {
    return { totalMin: 0, lateMin: 0, otMin: 0 };
  }

  const isOvertimeDay = (ds) => {
    if (!ds) return false;
    const [y, m, d] = ds.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay(); // 0 = Sun, 6 = Sat
    if (day === 0 || day === 6) return true;
    const holidays = [
      '2026-01-01', '2026-01-02', '2026-02-25', '2026-04-02', '2026-04-03', 
      '2026-04-04', '2026-04-09', '2026-05-01', '2026-06-12', '2026-08-21', 
      '2026-08-31', '2026-11-01', '2026-11-02', '2026-11-30', '2026-12-08', 
      '2026-12-24', '2026-12-25', '2026-12-30', '2026-12-31'
    ];
    return holidays.includes(ds);
  };

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
  const scheduledInM = isSevenAmShift ? 0 : 30; // Late after 8:30 AM (or 7:00 AM)
  // Overtime starts after 6:00 PM for everyone
  const scheduledOutH = 18;

  let lateMin = 0;
  if (!isOvertimeDay(dateStr)) {
    const totalInMins = inH * 60 + inM;
    const totalScheduledMins = scheduledInH * 60 + scheduledInM;
    const lateThresholdMins = totalScheduledMins + 61; // 1 hour and 1 min grace period

    if (totalInMins >= lateThresholdMins) {
      lateMin = totalInMins - (totalScheduledMins + 60); // Late duration starts after 60 mins
    }
  }

  let otMin = 0;
  if (isOvertimeDay(dateStr)) {
    otMin = netMin;
  } // No overtime for regular weekdays per user request

  return { totalMin: netMin, lateMin, otMin };
};

export default function ReportsTimeKeeping({ localPhotos }) {
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [nameSort, setNameSort] = useState('none');
  const [statusFilter, setStatusFilter] = useState('All');
  const [rangeFilter, setRangeFilter] = useState('daily');
  const [selectedMonth, setSelectedMonth] = useState(() => (new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const dateInputRef = useRef(null);
  const filterRef = useRef(null);
  const exportRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fullImageView, setFullImageView] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

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
    setLoading(true);
    const params = new URLSearchParams({
      date: selectedDate,
      range: rangeFilter,
      month: selectedMonth,
      year: selectedYear,
      _t: Date.now()
    });
    
    console.log('[ReportsAttendance] Fetching:', params.toString());
    
    fetch(`${API_BASE}/api/timekeeping?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        console.log('[ReportsAttendance] Received data:', data);
        setRecords(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error('[ReportsAttendance] Fetch error:', err);
        setRecords([]);
      })
      .finally(() => setLoading(false));
  }, [selectedDate, rangeFilter, selectedMonth, selectedYear]);

  // Use a simple mount-only effect to initialize the data.
  // The user will then use the "Apply Filters" button to update the view.
  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Add a listener to auto-refresh when the main date picker changes
  useEffect(() => {
    loadRecords();
  }, [selectedDate]);

  const processedRecords = useMemo(() => {
    // 1. Map API records to table format and calculate stats
    let result = records.map(r => {
      // Use the raw metrics from the API if available, otherwise calculate
      const raw = calculateAttendanceRaw(r.clockIn, r.clockOut, r.status || 'Present', r.date);
      
      return {
        ...r,
        totalTime: r.totalTime !== '-' ? r.totalTime : formatDurationClean(raw.totalMin),
        late: (r.totalLate && r.totalLate !== '-') ? formatDurationClean(parseInt(r.totalLate)) : (raw.lateMin > 0 ? formatDurationClean(raw.lateMin) : '-'),
        overtime: r.totalOvertime !== '-' ? r.totalOvertime : (raw.otMin > 0 ? formatDurationClean(raw.otMin) : '-'),
        rawTime: raw.totalMin,
        rawLate: raw.lateMin,
        rawOT: raw.otMin
      };
    });

    // 2. Apply search and status filters (Backend already handled range filtering)
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(r => 
        (r.uid || '').toLowerCase().includes(q) || 
        (r.name || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter && statusFilter !== 'All') {
      result = result.filter(r => r.status === statusFilter);
    }

    // 3. Sorting
    const statusPriority = { 'Present': 1, 'Travel': 2, 'HalfDay': 3, 'On Leave': 4, 'Absent': 5 };
    result.sort((a, b) => {
      // First priority: Status
      const priorityA = statusPriority[a.status] || 99;
      const priorityB = statusPriority[b.status] || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      // Second priority: Date (Newest first)
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);

      // Third priority: Name
      if (nameSort === 'asc') return (a.name || '').localeCompare(b.name || '');
      if (nameSort === 'desc') return (b.name || '').localeCompare(a.name || '');

      return 0;
    });

    return result;
  }, [records, query, statusFilter, nameSort]);

  const stats = useMemo(() => {
    return {
      present: processedRecords.filter(r => r.status === 'Present').length,
      travel: processedRecords.filter(r => r.status === 'Travel').length,
      halfDay: processedRecords.filter(r => r.status === 'HalfDay').length,
      leave: processedRecords.filter(r => r.status === 'On Leave').length,
      absent: processedRecords.filter(r => r.status === 'Absent').length,
    };
  }, [processedRecords]);

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
    const headers = ['Date', 'UID', 'Name', 'Clock In', 'Clock Out', 'Total Time', 'Late', 'Overtime', 'Status'];
    const csv = [headers.join(',')].concat(
      processedRecords.map(r => [
        r.date, r.uid, r.name, formatTo12Hr(r.clockIn), formatTo12Hr(r.clockOut), r.totalTime, r.late, r.overtime, r.status
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
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px;">${r.date || '-'}</td>
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
      <h2 style="text-align: center;">Attendance Logs (${rangeFilter.toUpperCase()})</h2>
      <p style="text-align: center;">Reference Date: ${new Date(selectedDate).toLocaleDateString()}</p>
      <table style="border-collapse: collapse; width: 100%;">
        <thead><tr style="background-color: #f1f5f9;">
          <th style="border: 1px solid #e5e7eb; padding: 12px;">Date</th>
          <th style="border: 1px solid #e5e7eb; padding: 12px;">UID</th>
          <th style="border: 1px solid #e5e7eb; padding: 12px;">Name</th>
          <th style="border: 1px solid #e5e7eb; padding: 12px;">Clock In</th>
          <th style="border: 1px solid #e5e7eb; padding: 12px;">Clock Out</th>
          <th style="border: 1px solid #e5e7eb; padding: 12px;">Total Time</th>
          <th style="border: 1px solid #e5e7eb; padding: 12px;">Late</th>
          <th style="border: 1px solid #e5e7eb; padding: 12px;">Overtime</th>
          <th style="border: 1px solid #e5e7eb; padding: 12px;">Status</th>
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

  const displayDate = useMemo(() => {
    if (!selectedDate) return new Date();
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  return (
    <div className="screen reports-attendance-table">
      {fullImageView && (
        <div className="image-viewer-overlay" onClick={() => setFullImageView(null)}>
          <button className="viewer-close">✕</button>
          <img src={fullImageView} alt="Full View" />
        </div>
      )}

      <div className="screen-header">
        <div className="header-text">
          <div className="title">
            Attendance Logs 
            <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal', marginLeft: '12px' }}>
              ({rangeFilter.charAt(0).toUpperCase() + rangeFilter.slice(1)} View 
              {rangeFilter === 'monthly' ? `: ${new Date(2000, parseInt(selectedMonth)-1).toLocaleString('default', { month: 'long' })} ${selectedYear}` : 
               rangeFilter === 'yearly' ? `: ${selectedYear}` : 
               rangeFilter === 'daily' ? `: ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''})
            </span>
          </div>
          <div className="page-description">Detailed history of employee daily attendance and shifts</div>
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

        <div className="calendar-metric clickable-metric" onClick={() => dateInputRef.current?.showPicker()}>
          <input 
            type="date" 
            ref={dateInputRef} 
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0 }} 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <div className="calendar-left">
            <div className="cal-month">{displayDate.toLocaleString('default', { month: 'short' }).toUpperCase()}</div>
            <div className="cal-day">{displayDate.getDate()}</div>
            <div className="cal-year">{displayDate.getFullYear()}</div>
          </div>
          <div className="calendar-right">
            <div className="cal-weekday">{displayDate.toLocaleString('default', { weekday: 'long' })}</div>
            <div className="cal-time">
                <Clock size={14} style={{ marginRight: '6px' }} />
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header overflow-visible">
          <div className="card-title">Attendance History</div>
          <div className="card-actions">
            <div className="search">
              <Search size={18} className="search-icon" />
              <input placeholder="Search UID, Name, ..." value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && <button className="search-clear-btn" onClick={() => setQuery('')}><X size={14} /></button>}
            </div>

            <div className="dropdown" ref={filterRef}>
              <button className="btn light filter-btn" onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={18} /></button>
              {filtersOpen && (
                <div className="dropdown-menu">
                  <div className="form-col" style={{ marginBottom: '16px' }}>
                    <label className="field-label">Time Range</label>
                    <select className="select" value={rangeFilter} onChange={(e) => setRangeFilter(e.target.value)}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  
                  {rangeFilter === 'monthly' && (
                    <div className="form-row" style={{ gap: '8px', marginBottom: '16px' }}>
                      <div className="form-col" style={{ flex: 1 }}>
                        <label className="field-label">Month</label>
                        <select className="select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                          {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                            <option key={m} value={m}>{new Date(2000, parseInt(m)-1).toLocaleString('default', { month: 'long' })}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-col" style={{ flex: 1 }}>
                        <label className="field-label">Year</label>
                        <select className="select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                          {[2024, 2025, 2026, 2027, 2028].map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {rangeFilter === 'yearly' && (
                    <div className="form-col" style={{ marginBottom: '16px' }}>
                      <label className="field-label">Year</label>
                      <select className="select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-col" style={{ marginBottom: '16px' }}>
                    <label className="field-label">Name Sort</label>
                    <select className="select" value={nameSort} onChange={(e) => setNameSort(e.target.value)}>
                      <option value="none">None</option>
                      <option value="asc">Ascending (A–Z)</option>
                      <option value="desc">Descending (Z–A)</option>
                    </select>
                  </div>
                  <div className="form-col">
                    <label className="field-label">Status</label>
                    <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="All">All Status</option>
                      <option value="Present">Present</option>
                      <option value="Travel">Travel</option>
                      <option value="HalfDay">HalfDay</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button 
                      className="btn primary" 
                      style={{ flex: 1, padding: '8px' }} 
                      onClick={() => {
                        loadRecords();
                        setFiltersOpen(false);
                      }}
                      disabled={loading}
                    >
                      {loading ? 'Applying...' : 'Apply Filters'}
                    </button>
                    <button className="btn light" style={{ flex: 1, padding: '8px' }} onClick={() => setFiltersOpen(false)}>Close</button>
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
              <div className="text-center">DATE</div>
              <div className="text-center">UID</div>
              <div className="text-center">NAME</div>
              <div className="text-center">CLOCK IN</div>
              <div className="text-center">CLOCK OUT</div>
              <div className="text-center">TOTAL TIME</div>
              <div className="text-center">LATE</div>
              <div className="text-center">OVERTIME</div>
              <div className="text-center">STATUS</div>
            </div>

            {loading ? (
              <div className="no-records-row" style={{ padding: '40px' }}>
                <div className="loading-spinner">Loading logs...</div>
              </div>
            ) : processedRecords.length === 0 ? (
              <div className="no-records-row" style={{ padding: '40px', color: '#64748b' }}>
                No records found for {rangeFilter} view 
                {rangeFilter === 'monthly' ? ` (${new Date(2000, parseInt(selectedMonth)-1).toLocaleString('default', { month: 'long' })} ${selectedYear})` : 
                 rangeFilter === 'yearly' ? ` (${selectedYear})` : 
                 rangeFilter === 'daily' ? ` (${new Date(selectedDate).toLocaleDateString()})` : ''}
              </div>
            ) : (
              processedRecords.map((row, idx) => (
                <div className="trow" key={row.id || `${row.uid}-${row.date}-${idx}`}>
                  <div className="text-center" style={{ fontSize: '12px', color: '#64748b' }}>
                    {(() => {
                      if (!row.date) return '-';
                      // If row.date is already YYYY-MM-DD, parse it carefully to avoid timezone shifts
                      const parts = row.date.split('-');
                      if (parts.length === 3) {
                        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }
                      return new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    })()}
                  </div>
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
                    {row.late !== '-' && <span className="late-badge">LATE</span>}
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
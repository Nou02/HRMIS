import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './TimeKeeping.css';
import { API_BASE } from '../../lib/api';
import { Search, X, Filter, Trash2, Camera, Users, Clock, AlertCircle, Calendar } from 'lucide-react';

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

const getCurrentTimeStr = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const calculateAttendanceRaw = (clockIn, clockOut, status, dateStr) => {
  if (status === 'Absent' || status === 'On Leave' || !clockIn || !clockOut || clockIn === '-' || clockOut === '-') {
    return { totalMin: 0, lateMin: 0, otMin: 0 };
  }

  const [inH, inM] = clockIn.split(':').map(Number);
  const [outH, outM] = clockOut.split(':').map(Number);
  
  let year, month, day;
  if (dateStr) {
    const parts = dateStr.split('-').map(Number);
    year = parts[0];
    month = parts[1] - 1; // JS months are 0-indexed
    day = parts[2];
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
    day = now.getDate();
  }

  const inDate = new Date(year, month, day, inH, inM);
  const outDate = new Date(year, month, day, outH, outM);
  
  let diffMin = (outDate - inDate) / (1000 * 60);
  if (diffMin < 0) return { totalMin: 0, lateMin: 0, otMin: 0 };

  const netMin = Math.max(0, diffMin - 60);
  const isSevenAmShift = (inH < 7) || (inH === 7 && inM <= 30);
  const scheduledInH = isSevenAmShift ? 7 : 8;
  const scheduledInM = isSevenAmShift ? 0 : 30; // Late after 8:30 AM (or 7:00 AM)
  const scheduledOutH = 18; // Overtime starts after 6:00 PM

  let lateMin = 0;
  const totalInMins = inH * 60 + inM;
  const totalScheduledMins = scheduledInH * 60 + scheduledInM;
  
  if (totalInMins > totalScheduledMins) {
    lateMin = totalInMins - totalScheduledMins;
  }

  let otMin = 0;
  if (outH > scheduledOutH || (outH === scheduledOutH && outM > 0)) {
    otMin = (outH - scheduledOutH) * 60 + outM;
  }

  return { totalMin: netMin, lateMin, otMin };
};

export default function TimeKeeping({ localPhotos, setLocalPhotos }) {
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nameSort, setNameSort] = useState('none');
  const [statusFilter, setStatusFilter] = useState('All');
  const [records, setRecords] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUid, setEditingUid] = useState(null);
  const [fullImageView, setFullImageView] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());

  const [employees, setEmployees] = useState([]);

  const [form, setForm] = useState({
    uid: '',
    name: '',
    clockIn: '',
    clockOut: '',
    status: 'Present',
    tempPreview: null
  });

  const filterRef = useRef(null);
  const searchInputRef = useRef(null);
  const dateInputRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) setFiltersOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadRecords = useCallback((targetDate) => {
    const activeDate = targetDate || selectedDate;
    fetch(`${API_BASE}/api/timekeeping?date=${activeDate}&_t=${Date.now()}`)
      .then(r => r.json())
      .then(data => {
        // Only update if the date we fetched for is still the selected date
        if (activeDate === selectedDate) {
          setRecords(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        console.error("Error loading records:", err);
        if (activeDate === selectedDate) {
          setRecords([]);
        }
      });
  }, [selectedDate]);

  useEffect(() => {
    let isMounted = true;
    const currentSelectedDate = selectedDate;
    
    setRecords([]); // Clear records when date changes to avoid showing stale data
    
    fetch(`${API_BASE}/api/timekeeping?date=${currentSelectedDate}&_t=${Date.now()}`)
      .then(r => r.json())
      .then(data => {
        if (isMounted && currentSelectedDate === selectedDate) {
          setRecords(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        console.error("Error fetching records in useEffect:", err);
        if (isMounted && currentSelectedDate === selectedDate) {
          setRecords([]);
        }
      });

    return () => { isMounted = false; };
  }, [selectedDate]);

  const deleteRecord = (uid) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    fetch(`${API_BASE}/api/timekeeping/${encodeURIComponent(uid)}?date=${selectedDate}`, {
      method: 'DELETE',
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to delete");
        loadRecords();
      })
      .catch((err) => alert(err.message));
  };

  const processedRecords = useMemo(() => {
    let result = records.map(r => {
      // If the record has no clockIn/clockOut and status is Absent, don't show stale values
      const hasRecord = r.clockIn && r.clockIn !== '-' || r.clockOut && r.clockOut !== '-' || r.status !== 'Absent';
      
      const raw = hasRecord 
        ? calculateAttendanceRaw(r.clockIn, r.clockOut, r.status || 'Present', selectedDate)
        : { totalMin: 0, lateMin: 0, otMin: 0 };

      return {
        ...r,
        totalTime: hasRecord ? formatDurationClean(raw.totalMin) : '-',
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

    if (statusFilter !== 'All') {
      result = result.filter(r => r.status === statusFilter);
    }

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
  }, [records, query, statusFilter, nameSort, selectedDate]);

  const stats = useMemo(() => {
    const presentCount = records.filter(r => r.status === 'Present').length;
    const absentCount = records.filter(r => r.status === 'Absent').length;
    const totalWorkMin = processedRecords.reduce((acc, r) => acc + (r.rawTime || 0), 0);
    const totalLateMin = processedRecords.reduce((acc, r) => acc + (r.rawLate || 0), 0);
    const totalOTMin = processedRecords.reduce((acc, r) => acc + (r.rawOT || 0), 0);

    return {
      presentCount,
      absentCount,
      totalTime: formatDurationClean(totalWorkMin),
      totalLate: formatDurationClean(totalLateMin),
      totalOT: formatDurationClean(totalOTMin)
    };
  }, [records, processedRecords]);

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    if (newStatus === 'Absent' || newStatus === 'On Leave') {
      setForm(prev => ({ ...prev, status: newStatus, clockIn: '', clockOut: '' }));
    } else {
      setForm(prev => ({ ...prev, status: newStatus, clockIn: prev.clockIn || getCurrentTimeStr() }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, tempPreview: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
    setEditingUid(null);
    setForm({ uid: '', name: '', clockIn: getCurrentTimeStr(), clockOut: '', status: 'Present', tempPreview: null });
    setModalOpen(true);
  };

  function submitForm(e) {
    e.preventDefault();
    const payload = {
      uid: form.uid.trim(),
      name: form.name.trim(),
      clockIn: form.clockIn,
      clockOut: form.clockOut,
      status: form.status,
      date: selectedDate
    };

    const method = editingUid ? 'PUT' : 'POST';
    const url = editingUid
      ? `${API_BASE}/api/timekeeping/${encodeURIComponent(editingUid)}`
      : `${API_BASE}/api/timekeeping`;
   
    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    .then(r => {
      if (!r.ok) throw new Error("Failed to save entry");
      return r.json();
    })
    .then(() => {
      if (form.tempPreview) {
        setLocalPhotos(prev => ({ ...prev, [payload.uid]: form.tempPreview }));
      }
      setModalOpen(false);
      setEditingUid(null);
      loadRecords();
    })
    .catch(err => {
      alert("Error saving record: " + err.message);
    });
  }

  const displayDate = useMemo(() => {
    if (!selectedDate) return new Date();
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

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
          <div className="title">Time Keeping</div>
          <div className="page-description">Monitor and manage daily employee attendance and shift records</div>
        </div>
      </div>

      <div className="attendance-dashboard-metrics">
        <div className="mega-metric">
          <div className="mega-metric-header">
            <Users size={20} />
            <span>Time Keeping Summary</span>
          </div>
          <div className="mega-metric-content">
            <div className="status-item present">
              <span className="label">Total Attendance</span>
              <span className="count">{stats.presentCount}</span>
            </div>
            <div className="status-item travel">
              <span className="label">Total Time</span>
              <span className="count">{stats.totalTime}</span>
            </div>
            <div className="status-item leave">
              <span className="label">Late</span>
              <span className="count">{stats.totalLate}</span>
            </div>
            <div className="status-item halfday">
              <span className="label">Overtime</span>
              <span className="count">{stats.totalOT}</span>
            </div>
            <div className="status-item absent">
              <span className="label">Absent</span>
              <span className="count">{stats.absentCount}</span>
            </div>
          </div>
        </div>

        <div className="calendar-metric clickable-metric" onClick={() => dateInputRef.current?.showPicker()}>
          <input 
            type="date" 
            ref={dateInputRef} 
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} 
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
          <div className="card-title">Time Keeping Records</div>
          <div className="card-actions">
            <div className="search">
              <Search size={18} className="search-icon" />
              <input ref={searchInputRef} placeholder="Search UID, Name, ..." value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && <X size={14} className="search-clear" onClick={() => setQuery('')} />}
            </div>

            <div className="dropdown" ref={filterRef}>
              <button className="btn light filter-btn" onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={18} /></button>
              {filtersOpen && (
                <div className="dropdown-menu">
                  <div className="form-col" style={{ marginBottom: '16px' }}>
                    <label className="field-label">Name Sort</label>
                    <select className="select" value={nameSort} onChange={(e) => setNameSort(e.target.value)}>
                      <option value="none">None</option>
                      <option value="asc">Ascending (A–Z)</option>
                      <option value="desc">Descending (Z–A)</option>
                    </select>
                  </div>
                  <div className="form-col">
                    <label className="field-label">Status Filter</label>
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

            <button className="btn primary" onClick={openAddModal}>+ Add Record</button>
          </div>
        </div>

        <div className="table-container">
          <div className="table timekeeping-table">
            <div className="thead">
              <div className="text-center">UID</div>
              <div className="text-center">NAME</div>
              <div className="text-center">CLOCK IN</div>
              <div className="text-center">CLOCK OUT</div>
              <div className="text-center">TOTAL TIME</div>
              <div className="text-center">LATE</div>
              <div className="text-center">OVERTIME</div>
              <div className="text-center">STATUS</div>
              <div className="text-center">ACTION</div>
            </div>

            {processedRecords.length === 0 ? (
              <div className="no-records-row">No record(s) found/added</div>
            ) : (
              processedRecords.map((row) => (
                <div className="trow" key={`${row.uid}-${selectedDate}`}>
                  <div className="text-center uid-text" title={row.uid}>{row.uid}</div>
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
                    <span className="employee-name-text" title={row.name}>{row.name}</span>
                  </div>
                  <div className="text-center">{formatTo12Hr(row.clockIn)}</div>
                  <div className="text-center">{formatTo12Hr(row.clockOut)}</div>
                  <div className="text-center">{row.totalTime}</div>
                  <div className="text-center">{row.late}</div>
                  <div className="text-center">{row.overtime}</div>
                  <div className="text-center status-cell">
                    <span className={`status ${(row.status || 'present').replace(/\s+/g, '').toLowerCase()}`}>{row.status || 'Present'}</span>
                  </div>
                  <div className="text-center action-cell">
                    <button className="btn small edit-btn-table" onClick={() => {
                      const cleanTime = (t) => (!t || t === '-') ? '' : t;
                      setEditingUid(row.uid);
                      setForm({ 
                        uid: row.uid, 
                        name: row.name, 
                        clockIn: cleanTime(row.clockIn), 
                        clockOut: cleanTime(row.clockOut), 
                        status: row.status || 'Present', 
                        tempPreview: localPhotos[row.uid] || null 
                      });
                      setModalOpen(true);
                    }}>Edit</button>
                    <button className="btn small delete-btn-table" onClick={() => deleteRecord(row.uid)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="card-title">{editingUid ? 'Edit Record' : 'Add New Record'}</div>
              <button className="modal-close-x" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={submitForm}>
              <div className="form-row">
                <div className="form-col" style={{ flex: '0 0 120px', alignItems: 'center' }}>
                  <label className="field-label">Photo</label>
                  <div className="profile-upload-circle avatar-border" onClick={() => document.getElementById('pic-input').click()}>
                    {form.tempPreview ? <img src={form.tempPreview} alt="Preview" /> : <Camera size={24} color="#64748b" />}
                    <input id="pic-input" type="file" hidden accept="image/*" onChange={handleFileChange} />
                  </div>
                </div>
                <div className="form-col" style={{ flex: 1 }}>
                  <label className="field-label">UID</label>
                  <input className="input" placeholder="Enter UID" value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} required readOnly={!!editingUid} />
                  <label className="field-label" style={{ marginTop: '10px' }}>Name</label>
                  <input className="input" placeholder="Enter Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Clock In</label>
                  <input 
                    className="input" 
                    type="time" 
                    value={form.clockIn} 
                    onChange={(e) => {
                      const newTime = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        clockIn: newTime,
                        status: (prev.status === 'Absent' || prev.status === 'On Leave') && newTime ? 'Present' : prev.status
                      }));
                    }} 
                  />
                </div>
                <div className="form-col">
                  <label className="field-label">Clock Out</label>
                  <input 
                    className="input" 
                    type="time" 
                    value={form.clockOut} 
                    onChange={(e) => {
                      const newTime = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        clockOut: newTime,
                        status: (prev.status === 'Absent' || prev.status === 'On Leave') && newTime ? 'Present' : prev.status
                      }));
                    }} 
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Status</label>
                  <select className="select" value={form.status} onChange={handleStatusChange}>
                    <option value="Present">Present</option>
                    <option value="HalfDay">Half Day</option>
                    <option value="Travel">Travel</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions"><button type="submit" className="btn primary submit-btn">{editingUid ? 'Save Changes' : 'Create Record'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
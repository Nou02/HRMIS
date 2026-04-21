import React from 'react';
import './GatePass.css';
import { API_BASE } from '../../lib/api';
import { Search, X, ClipboardList, Clock, CheckCircle, Filter, Trash2, Camera } from 'lucide-react';

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

export default function GatePass() {
  const [query, setQuery] = React.useState('');
  const [nameSort, setNameSort] = React.useState('none');
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [list, setList] = React.useState([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [fullImageView, setFullImageView] = React.useState(null);

  const [localPhotos, setLocalPhotos] = React.useState(() => {
    const saved = localStorage.getItem('hrmis_employee_photos');
    return saved ? JSON.parse(saved) : {};
  });

  const [form, setForm] = React.useState({
    uid: '',
    name: '',
    destination: '',
    purpose: '',
    date: '',
    timeOut: '',
    timeIn: '',
    status: 'Pending',
    profilePicFile: null,
    tempPreview: null
  });

  const filterRef = React.useRef(null);
  const searchInputRef = React.useRef(null);

  React.useEffect(() => {
    localStorage.setItem('hrmis_employee_photos', JSON.stringify(localPhotos));
  }, [localPhotos]);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setFiltersOpen(false);
      }
    }
    if (filtersOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filtersOpen]);

  const formatTime12h = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${month}/${day}/${year}`;
  };

  const loadList = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    const url = `${API_BASE}/api/gatepasses${params.toString() ? `?${params.toString()}` : ''}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          if (nameSort === 'asc') {
            return (a.name || '').localeCompare(b.name || '');
          } else if (nameSort === 'desc') {
            return (b.name || '').localeCompare(a.name || '');
          } else {
            const dateA = new Date(`${a.date || ''}T${a.timeIn || '00:00'}`);
            const dateB = new Date(`${b.date || ''}T${b.timeIn || '00:00'}`);
            return dateB - dateA;
          }
        });
        setList(sorted);
      })
      .catch(() => {});
  };

  React.useEffect(() => {
    loadList();
  }, [query, nameSort]);

  const deletePass = (id) => {
    if (!window.confirm("Are you sure you want to delete this gate pass record?")) return;
    fetch(`${API_BASE}/api/gatepasses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to delete");
        loadList();
      })
      .catch((err) => alert(err.message));
  };

  const handleClearSearch = () => {
    setQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, profilePicFile: file, tempPreview: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const openAdd = () => {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTimeStr = now.toTimeString().split(' ')[0].slice(0, 5);

    setEditingId(null);
    setForm({
      uid: '',
      name: '',
      destination: '',
      purpose: '',
      date: currentDate,
      timeOut: '',
      timeIn: currentTimeStr,
      status: 'Pending',
      profilePicFile: null,
      tempPreview: null
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      uid: row.uid || '',
      name: row.name || '',
      destination: row.destination || '',
      purpose: row.purpose || '',
      date: row.date || '',
      timeOut: row.timeOut || '',
      timeIn: row.timeIn || '',
      status: row.status || 'Pending',
      profilePicFile: null,
      tempPreview: localPhotos[row.uid] || null
    });
    setModalOpen(true);
  };

  const submitForm = (e) => {
    e.preventDefault();
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId
      ? `${API_BASE}/api/gatepasses/${encodeURIComponent(editingId)}`
      : `${API_BASE}/api/gatepasses`;

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then((r) => r.json())
      .then(() => {
        if (form.tempPreview) {
          setLocalPhotos(prev => ({ ...prev, [form.uid.trim()]: form.tempPreview }));
        }
        setModalOpen(false);
        loadList();
      })
      .catch(() => {});
  };

  const approve = (row) => {
    fetch(`${API_BASE}/api/gatepasses/${encodeURIComponent(row.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Approved' }),
    })
      .then((r) => r.json())
      .then(loadList)
      .catch(() => {});
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
          <div className="title">Gate Passes</div>
          <div className="page-description">Monitor and manage employee entry and exit requests</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={openAdd}>+ Add Gate Pass</button>
          <div className="avatar" />
        </div>
      </div>

      <div className="grid-3">
        <Metric label="Total Requests" value={list.length || '0'} icon="📑" />
        <Metric label="Pending" value={list.filter((g) => g.status === 'Pending').length || '0'} icon="⏳" />
        <Metric label="Approved" value={list.filter((g) => g.status === 'Approved').length || '0'} icon="✅" />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Gate Pass Records</div>
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

        <div className="gatepass-table-wrapper">
          <div className="gatepass-table">
            <div className="gatepass-thead">
              <div>UID</div>
              <div>Name</div>
              <div>Destination</div>
              <div>Purpose</div>
              <div>Date</div>
              <div>Clock In</div>
              <div>Clock Out</div>
              <div>Status</div>
              <div>Action</div>
            </div>

            {list.map((row) => (
              <div className="gatepass-trow" key={row.id}>
                <div className="uid-text">{row.uid}</div>
                <div className="namecell">
                  <div 
                    className="employee-avatar clickable-avatar avatar-border"
                    onClick={() => localPhotos[row.uid] && setFullImageView(localPhotos[row.uid])}
                  >
                    {localPhotos[row.uid] ? (
                      <img src={localPhotos[row.uid]} alt="" />
                    ) : (
                      <span className="employee-avatar-initials">{(row.name || '?').trim().charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span className="employee-name-text">{row.name}</span>
                </div>
                <div>{row.destination}</div>
                <div>{row.purpose}</div>
                <div>{formatDate(row.date)}</div>
                <div>{formatTime12h(row.timeIn)}</div>
                <div>{formatTime12h(row.timeOut)}</div>
                <div className="status-cell">
                  <span className={`status ${row.status.toLowerCase()}`}>
                    {row.status}
                  </span>
                </div>
                <div className="activity-cell">
                  <button className="btn small edit-btn" onClick={() => openEdit(row)}>Edit</button>
                  {row.status !== 'Approved' && (
                    <button className="btn small approve-btn" onClick={() => approve(row)}>Approve</button>
                  )}
                  <button className="btn small delete-btn" onClick={() => deletePass(row.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {!list.length && (
              <div className="no-records-row">
                No record(s) found/added
              </div>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="card-title">
                {editingId ? 'Edit Gate Pass Info' : 'Add Gate Pass'}
              </div>
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
                  <input className="input" placeholder="Enter UID" value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} required />
                  <label className="field-label" style={{ marginTop: '10px' }}>Name</label>
                  <input className="input" placeholder="Enter Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Destination</label>
                  <input className="input" placeholder="Enter Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
                </div>
                <div className="form-col">
                  <label className="field-label">Purpose</label>
                  <input className="input" placeholder="Enter Purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Date</label>
                  <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="form-col">
                  <label className="field-label">Clock In</label>
                  <input className="input" type="time" value={form.timeIn} onChange={(e) => setForm({ ...form, timeIn: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Clock Out</label>
                  <input className="input" type="time" value={form.timeOut} onChange={(e) => setForm({ ...form, timeOut: e.target.value })} />
                </div>
                <div className="form-col">
                  <label className="field-label">Status</label>
                  <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn primary submit-btn" type="submit">
                  {editingId ? 'Save Changes' : 'Create Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import './Requests.css';
import { API_BASE } from '../../lib/api';
import { Search, X, Filter, Trash2, Camera, Check } from 'lucide-react';

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

export default function Application({ localPhotos, setLocalPhotos }) {
  const [query, setQuery] = useState('');
  const [nameSort, setNameSort] = useState('none');
  const [leaveFilter, setLeaveFilter] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [applications, setApplications] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [fullImageView, setFullImageView] = useState(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const [year, month, day] = dateStr.split('-');
      if (!year || !month || !day) return dateStr;
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const [form, setForm] = useState({
    uid: '',
    name: '',
    typeOfLeave: '',
    leaveStatus: 'Pending',
    offsetHours: '',
    offsetStatus: 'Pending',
    requestDate: new Date().toISOString().split('T')[0],
    profilePicFile: null,
    tempPreview: null
  });

  const [availableOffset, setAvailableOffset] = useState(null);

  const loadAvailableOffset = (uid) => {
    if (!uid) {
      setAvailableOffset(null);
      return;
    }
    fetch(`${API_BASE}/api/applications/available-offset/${uid}`)
      .then(r => r.json())
      .then(data => {
        setAvailableOffset(data);
      })
      .catch(err => console.error("Error loading available offset:", err));
  };

  const filterRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setFiltersOpen(false);
      }
    }
    if (filtersOpen) document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filtersOpen]);

  const loadEmployees = () => {
    fetch(`${API_BASE}/api/employees`)
      .then(r => r.json())
      .then(data => {
        setEmployees(data);
      })
      .catch(err => console.error("Error loading employees:", err));
  };

  const loadApplications = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    const url = `${API_BASE}/api/applications${params.toString() ? `?${params.toString()}` : ''}`;
   
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        let processed = [...data];
       
        if (leaveFilter !== 'All') {
          processed = processed.filter(a => a.typeOfLeave === leaveFilter);
        }

        if (nameSort === 'none') {
          processed.reverse();
        } else if (nameSort === 'asc') {
          processed.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else if (nameSort === 'desc') {
          processed.sort((b, a) => (b.name || '').localeCompare(a.name || ''));
        }
       
        setApplications(processed);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadApplications();
  }, [query, nameSort, leaveFilter]);

  useEffect(() => {
    loadEmployees();
  }, []);

  const approveRequest = (id, field) => {
    const target = applications.find(a => a.id === id);
    if (!target) return;

    const updatedData = {
      ...target,
      [field]: 'Approved'
    };

    fetch(`${API_BASE}/api/applications/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    })
    .then(r => {
      if (r.ok) loadApplications();
    })
    .catch(err => console.error("Error approving:", err));
  };

  const metricsData = {
    sick: applications.filter(a => a.typeOfLeave === 'Sick Leave').length,
    vacation: applications.filter(a => a.typeOfLeave === 'Vacation Leave').length,
    emergency: applications.filter(a => a.typeOfLeave === 'Emergency Leave').length,
    maternity: applications.filter(a => a.typeOfLeave === 'Maternity Leave').length,
    total: applications.length
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
    setEditingId(null);
    setForm({
      uid: '',
      name: '',
      typeOfLeave: '',
      leaveStatus: 'Pending',
      offsetHours: '',
      offsetStatus: 'Pending',
      requestDate: new Date().toISOString().split('T')[0],
      profilePicFile: null,
      tempPreview: null
    });
    setAvailableOffset(null);
    setModalOpen(true);
  };

  const openEdit = (a) => {
    setEditingId(a.id || null);
    setForm({
      uid: a.uid,
      name: a.name,
      typeOfLeave: a.typeOfLeave || '',
      leaveStatus: a.leaveStatus || 'Pending',
      offsetHours: a.offsetHours ?? '',
      offsetStatus: a.offsetStatus || 'Pending',
      requestDate: a.requestDate || new Date().toISOString().split('T')[0],
      profilePicFile: null,
      tempPreview: localPhotos[a.uid] || null
    });
    loadAvailableOffset(a.uid);
    setModalOpen(true);
  };

  const deleteApplication = (id) => {
    if (!window.confirm("Delete this application record?")) return;
    fetch(`${API_BASE}/api/applications/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then((r) => { if (r.ok) loadApplications(); });
  };

  const handleEmployeeSelect = (e) => {
    const selectedUid = e.target.value;
    const emp = employees.find(emp => emp.uid === selectedUid);
    if (emp) {
      setForm({ 
        ...form, 
        uid: emp.uid, 
        name: emp.name,
        tempPreview: emp.avatarUrl ? `${API_BASE}${emp.avatarUrl}` : (localPhotos[emp.uid] || null)
      });
      loadAvailableOffset(emp.uid);
    } else {
      setForm({ ...form, uid: '', name: '', tempPreview: null });
      setAvailableOffset(null);
    }
  };

  const submitForm = (e) => {
    e.preventDefault();
    const url = editingId
      ? `${API_BASE}/api/applications/${encodeURIComponent(editingId)}`
      : `${API_BASE}/api/applications`;
   
    // Create a copy of form data and remove large image data before sending to backend
    // because the backend handles time off requests separately from employee photos.
    const { profilePicFile, tempPreview, ...submitData } = form;

    if (availableOffset && parseFloat(form.offsetHours || 0) > availableOffset.availableHours) {
      if (!window.confirm(`Requested offset hours (${form.offsetHours}) exceed available OT balance (${availableOffset.availableHours.toFixed(2)}). Continue anyway?`)) {
        return;
      }
    }

    fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitData),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMsg = errorData.details || errorData.error || "Failed to save application";
          throw new Error(errorMsg);
        }
        if (form.tempPreview) {
          setLocalPhotos(prev => ({ ...prev, [form.uid.trim()]: form.tempPreview }));
        }
        setModalOpen(false);
        loadApplications();
      })
      .catch((err) => {
        console.error("Submit error:", err);
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
          <div className="title">Time Off Requests</div>
          <div className="page-description">Manage employee leave and off-set requests</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={openAdd}>+ Add Time Off Request</button>
          <div className="avatar" />
        </div>
      </div>

      <div className="metrics">
        <Metric label="Total Requests" value={metricsData.total} icon="📑" />
        <Metric label="Sick Leave" value={metricsData.sick} icon="🤒" />
        <Metric label="Vacation Leave" value={metricsData.vacation} icon="✈️" />
        <Metric label="Emergency Leave" value={metricsData.emergency} icon="🚨" />
        <Metric label="Maternity Leave" value={metricsData.maternity} icon="👶" />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Leave & Off-set Requests</div>
          <div className="card-actions">
            <div className="search">
              <Search size={18} className="search-icon" />
              <input
                ref={searchInputRef}
                placeholder="Search UID, Name, ..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && <X size={14} className="search-clear" onClick={() => setQuery('')} />}
            </div>
           
            <div className="dropdown" ref={filterRef}>
              <button className="btn light filter-btn" onClick={() => setFiltersOpen(!filtersOpen)}>
                <Filter size={18} />
              </button>
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
                    <label className="field-label">Leave Type</label>
                    <select className="select" value={leaveFilter} onChange={(e) => setLeaveFilter(e.target.value)}>
                      <option value="All">All Types</option>
                      <option value="Sick Leave">Sick Leave</option>
                      <option value="Vacation Leave">Vacation Leave</option>
                      <option value="Emergency Leave">Emergency Leave</option>
                      <option value="Maternity Leave">Maternity Leave</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="table-container">
          <div className="table applications-table">
            <div className="thead">
              <div className="text-center">UID</div>
              <div className="text-center">Name</div>
              <div className="text-center">Date</div>
              <div className="text-center">Type of Leave</div>
              <div className="text-center">Leave Status</div>
              <div className="text-center">Off-set</div>
              <div className="text-center">Off-set Status</div>
              <div className="text-center">Action</div>
            </div>

            {applications.length === 0 ? (
              <div className="no-records-row">No record(s) found/added</div>
            ) : (
              applications.map((a) => (
                <div className="trow" key={a.id || a.uid}>
                  <div className="text-center uid-text">{a.uid}</div>
                  <div className="namecell">
                    <div
                      className="employee-avatar clickable-avatar avatar-border"
                      onClick={() => {
                        const emp = employees.find(e => e.uid === a.uid);
                        const imgUrl = emp?.avatarUrl ? `${API_BASE}${emp.avatarUrl}` : localPhotos[a.uid];
                        if (imgUrl) setFullImageView(imgUrl);
                      }}
                    >
                      {(() => {
                        const emp = employees.find(e => e.uid === a.uid);
                        if (emp?.avatarUrl) return <img src={`${API_BASE}${emp.avatarUrl}`} alt="" />;
                        if (localPhotos[a.uid]) return <img src={localPhotos[a.uid]} alt="" />;
                        return <span className="employee-avatar-initials">{(a.name || '?').charAt(0).toUpperCase()}</span>;
                      })()}
                    </div>
                    <span className="employee-name-text">{a.name}</span>
                  </div>
                  <div className="text-center">{formatDate(a.requestDate)}</div>
                  <div className="text-center">{a.typeOfLeave || '-'}</div>
                  
                  <div className="status-cell">
                    <div className="status-container">
                        <span className={`status ${a.leaveStatus?.toLowerCase()}`}>{a.leaveStatus}</span>
                        {(a.leaveStatus === 'Pending' || a.leaveStatus === 'Rejected') && (
                            <button className="approve-small-btn" title="Approve Leave" onClick={() => approveRequest(a.id, 'leaveStatus')}>
                                <Check size={14} />
                            </button>
                        )}
                    </div>
                  </div>

                  <div className="text-center">{a.offsetHours ? `${a.offsetHours} hrs` : '-'}</div>
                  
                  <div className="status-cell">
                    <div className="status-container">
                        <span className={`status ${a.offsetStatus?.toLowerCase()}`}>{a.offsetStatus}</span>
                        {(a.offsetStatus === 'Pending' || a.offsetStatus === 'Rejected') && (
                            <button className="approve-small-btn" title="Approve Offset" onClick={() => approveRequest(a.id, 'offsetStatus')}>
                                <Check size={14} />
                            </button>
                        )}
                    </div>
                  </div>

                  <div className="activity-cell">
                    <button className="btn small edit-btn" onClick={() => openEdit(a)}>Edit</button>
                    <button className="btn small delete-btn" onClick={() => deleteApplication(a.id)}>
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
              <div className="card-title">{editingId ? 'Edit Time Off Request Info' : 'Add Time Off Request'}</div>
              <button className="modal-close-x" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={submitForm}>
              <div className="form-row">
                <div className="form-col" style={{ flex: '0 0 120px', alignItems: 'center' }}>
                  <label className="field-label">Photo</label>
                  <div className="profile-upload-circle avatar-border">
                    {form.tempPreview ? <img src={form.tempPreview} alt="Preview" /> : <Camera size={24} color="#64748b" />}
                  </div>
                </div>
                <div className="form-col" style={{ flex: 1 }}>
                  <label className="field-label">Select Employee</label>
                  <select 
                    className="select" 
                    value={form.uid} 
                    onChange={handleEmployeeSelect} 
                    required
                    disabled={!!editingId}
                  >
                    <option value="">-- Select Employee --</option>
                    {employees.length > 0 ? (
                      employees.map(emp => (
                        <option key={emp.uid} value={emp.uid}>
                          {emp.uid} - {emp.name}
                        </option>
                      ))
                    ) : (
                      <option disabled>Loading employees...</option>
                    )}
                  </select>
                  {form.uid && (
                    <div style={{ marginTop: '10px' }}>
                      <div className="field-label">Selected UID</div>
                      <div className="input" style={{ background: '#f8fafc', color: '#64748b' }}>{form.uid}</div>
                      <div className="field-label" style={{ marginTop: '10px' }}>Selected Name</div>
                      <div className="input" style={{ background: '#f8fafc', color: '#64748b' }}>{form.name}</div>
                    </div>
                  )}
                </div>
              </div>
             
              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Type of Leave</label>
                  <select className="select" value={form.typeOfLeave} onChange={(e) => setForm({ ...form, typeOfLeave: e.target.value })} required>
                    <option value="">Select Type</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Vacation Leave">Vacation Leave</option>
                    <option value="Emergency Leave">Emergency Leave</option>
                    <option value="Maternity Leave">Maternity Leave</option>
                  </select>
                </div>
                <div className="form-col">
                  <label className="field-label">Request Date</label>
                  <input 
                    type="date" 
                    className="input" 
                    value={form.requestDate} 
                    onChange={(e) => setForm({ ...form, requestDate: e.target.value })} 
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Leave Status</label>
                  <select className="select" value={form.leaveStatus} onChange={(e) => setForm({ ...form, leaveStatus: e.target.value })}>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div className="form-col">
                  <label className="field-label">Off-set Status</label>
                  <select className="select" value={form.offsetStatus} onChange={(e) => setForm({ ...form, offsetStatus: e.target.value })}>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Off-set Hours</label>
                  <select 
                    className="select" 
                    value={form.offsetHours} 
                    onChange={(e) => setForm({ ...form, offsetHours: e.target.value })}
                  >
                    <option value="0">0 hrs</option>
                    <option value="4">4 hrs</option>
                    <option value="8">8 hrs</option>
                  </select>
                  {availableOffset && (
                    <div style={{ fontSize: '12px', marginTop: '4px', color: '#0ea5e9', fontWeight: '500' }}>
                      Available OT: {availableOffset.availableHours.toFixed(2)} hrs ({availableOffset.period})
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn primary submit-btn">{editingId ? 'Save Changes' : 'Create Request'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
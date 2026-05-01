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

export default function GatePass({ localPhotos, setLocalPhotos }) {
  const [query, setQuery] = React.useState('');
  const [nameSort, setNameSort] = React.useState('none');
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [list, setList] = React.useState([]);
  const [employees, setEmployees] = React.useState([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [fullImageView, setFullImageView] = React.useState(null);

  const [form, setForm] = React.useState({
    uid: '',
    name: '',
    officialType: '',
    officialPurpose: '',
    personalType: '',
    personalPurpose: '',
    date: '',
    estStartTime: '',
    estEndTime: '',
    actStartTime: '',
    actEndTime: '',
    venue: '',
    approvedBy: '',
    status: 'Pending',
    profilePicFile: null,
    tempPreview: null
  });

  const filterRef = React.useRef(null);
  const searchInputRef = React.useRef(null);

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

  const loadEmployees = () => {
    fetch(`${API_BASE}/api/employees`)
      .then(r => r.json())
      .then(data => {
        setEmployees(data);
      })
      .catch(err => console.error("Error loading employees:", err));
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
            const dateA = new Date(`${a.date || ''}T${a.endTime || '00:00'}`);
            const dateB = new Date(`${b.date || ''}T${b.endTime || '00:00'}`);
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

  React.useEffect(() => {
    loadEmployees();
  }, []);

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
    } else {
      setForm({ ...form, uid: '', name: '', tempPreview: null });
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
      officialType: '',
      officialPurpose: '',
      personalType: '',
      personalPurpose: '',
      date: currentDate,
      estStartTime: currentTimeStr,
      estEndTime: '',
      actStartTime: '',
      actEndTime: '',
      venue: '',
      approvedBy: '',
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
      officialType: row.officialType || '',
      officialPurpose: row.officialPurpose || '',
      personalType: row.personalType || '',
      personalPurpose: row.personalPurpose || '',
      date: row.date || '',
      estStartTime: row.estStartTime || '',
      estEndTime: row.estEndTime || '',
      actStartTime: row.actStartTime || '',
      actEndTime: row.actEndTime || '',
      venue: row.venue || '',
      approvedBy: row.approvedBy || '',
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

    const { profilePicFile, tempPreview, ...submitData } = form;

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitData),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorMsg = await res.text();
          throw new Error(errorMsg || 'Failed to save gate pass');
        }
        return res.json();
      })
      .then(() => {
        if (form.tempPreview) {
          setLocalPhotos(prev => ({ ...prev, [form.uid.trim()]: form.tempPreview }));
        }
        setModalOpen(false);
        loadList();
      })
      .catch((err) => {
        console.error('Submit error:', err);
        alert(err.message);
      });
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
              <div>Official / Personal</div>
              <div>Venue</div>
              <div>Date</div>
              <div>Estimate (Start-End)</div>
              <div>Actual (Start-End)</div>
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
                <div>
                  {row.officialType && row.officialType !== 'None' ? (
                    <div style={{ fontSize: '12px' }}>
                      <strong>Official:</strong> {row.officialType} 
                      {(row.officialType === 'Travel' || row.officialType === 'Others') && row.officialPurpose && ` (${row.officialPurpose})`}
                    </div>
                  ) : null}
                  {row.personalType && row.personalType !== 'None' ? (
                    <div style={{ fontSize: '12px', marginTop: row.officialType && row.officialType !== 'None' ? '4px' : '0' }}>
                      <strong>Personal:</strong> {row.personalType}
                      {row.personalType === 'Others' && row.personalPurpose && ` (${row.personalPurpose})`}
                    </div>
                  ) : null}
                  {!row.officialType && !row.personalType && '-'}
                </div>
                <div>{row.venue || '-'}</div>
                <div>{formatDate(row.date)}</div>
                <div>
                  {row.estStartTime ? formatTime12h(row.estStartTime) : '—'} 
                  {row.estEndTime ? ` to ${formatTime12h(row.estEndTime)}` : ''}
                </div>
                <div>
                  {row.actStartTime ? formatTime12h(row.actStartTime) : '—'} 
                  {row.actEndTime ? ` to ${formatTime12h(row.actEndTime)}` : ''}
                </div>
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
                  <label className="field-label">Official</label>
                  <select className="select" value={form.officialType} onChange={(e) => setForm({ ...form, officialType: e.target.value })}>
                    <option value="">None</option>
                    <option value="Travel">Travel</option>
                    <option value="Seminar/Training/Conference/Meeting">Seminar/Training/Conference/Meeting</option>
                    <option value="Pick-up of Documents">Pick-up of Documents</option>
                    <option value="Others">Others</option>
                  </select>
                  {(form.officialType === 'Travel' || form.officialType === 'Others') && (
                    <input 
                      className="input" 
                      style={{ marginTop: '8px' }}
                      placeholder="Enter purpose" 
                      value={form.officialPurpose} 
                      onChange={(e) => setForm({ ...form, officialPurpose: e.target.value })} 
                    />
                  )}
                </div>
                <div className="form-col">
                  <label className="field-label">Personal</label>
                  <select className="select" value={form.personalType} onChange={(e) => setForm({ ...form, personalType: e.target.value })}>
                    <option value="">None</option>
                    <option value="Medication/ Physical Check-up (subject to presentation of Doctor's Certification)">Medication/ Physical Check-up (subject to presentation of Doctor's Certification)</option>
                    <option value="Medical Attention to Family Member/ Relative">Medical Attention to Family Member/ Relative</option>
                    <option value="Others">Others</option>
                  </select>
                  {form.personalType === 'Others' && (
                    <input 
                      className="input" 
                      style={{ marginTop: '8px' }}
                      placeholder="Enter purpose" 
                      value={form.personalPurpose} 
                      onChange={(e) => setForm({ ...form, personalPurpose: e.target.value })} 
                    />
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Date</label>
                  <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="form-col">
                  <label className="field-label">Venue</label>
                  <input className="input" placeholder="Enter Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Start Time (Estimate)</label>
                  <input className="input" type="time" value={form.estStartTime} onChange={(e) => setForm({ ...form, estStartTime: e.target.value })} />
                </div>
                <div className="form-col">
                  <label className="field-label">End Time (Estimate)</label>
                  <input className="input" type="time" value={form.estEndTime} onChange={(e) => setForm({ ...form, estEndTime: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Actual Start Time (Guard-on-Duty)</label>
                  <input className="input" type="time" value={form.actStartTime} onChange={(e) => setForm({ ...form, actStartTime: e.target.value })} />
                </div>
                <div className="form-col">
                  <label className="field-label">Actual End Time (Guard-on-Duty)</label>
                  <input className="input" type="time" value={form.actEndTime} onChange={(e) => setForm({ ...form, actEndTime: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Approved By</label>
                  <select className="select" value={form.approvedBy} onChange={(e) => setForm({ ...form, approvedBy: e.target.value })}>
                    <option value="">Select Approver</option>
                    <option value="Maria Graciela R. Bucad">Maria Graciela R. Bucad</option>
                    <option value="Rex D. Aguila">Rex D. Aguila</option>
                    <option value="Kenneth A. Benedicto">Kenneth A. Benedicto</option>
                    <option value="Mary Ann O. Lacson">Mary Ann O. Lacson</option>
                    <option value="April Rose H. Clemenco">April Rose H. Clemenco</option>
                    <option value="Hazel D. Pagao">Hazel D. Pagao</option>
                    <option value="Dennis L. Yapbuan">Dennis L. Yapbuan</option>
                    <option value="Carlo Paolo P. Murcia">Carlo Paolo P. Murcia</option>
                  </select>
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
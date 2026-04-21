import React, { useState, useEffect, useRef } from 'react';
import './Directory.css';
import { API_BASE } from '../../lib/api';
import { Trash2, Search, X, Filter, Camera } from 'lucide-react';

export default function EmployeesList() {
  const [query, setQuery] = useState('');
  const [employees, setEmployees] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
 
  const [nameSort, setNameSort] = useState('none');
  const [deptFilter, setDeptFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUid, setEditingUid] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [fullImageView, setFullImageView] = useState(null);

  const [localPhotos, setLocalPhotos] = useState(() => {
    const saved = localStorage.getItem('hrmis_employee_photos');
    return saved ? JSON.parse(saved) : {};
  });

  const [form, setForm] = useState({
    uid: '',
    name: '',
    departmentProject: '',
    employmentCategory: '', 
    certifications: '',
    pdsAvailable: false,
    idViewAvailable: false,
    profilePicFile: null,
    tempPreview: null,
    pdsFile: null,
    idFile: null
  });

  const filterRef = useRef(null);
  const searchInputRef = useRef(null);

  const loadEmployees = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (nameSort !== 'none') params.set('sortName', nameSort);
    const url = `${API_BASE}/api/employees${params.toString() ? `?${params.toString()}` : ''}`;
    fetch(url).then((r) => r.json()).then(setEmployees).catch(() => {});
  };

  const [stats, setStats] = useState(null);
  const loadStats = () => {
    fetch(`${API_BASE}/api/stats`).then((r) => r.json()).then(setStats).catch(() => {});
  };

  useEffect(() => {
    localStorage.setItem('hrmis_employee_photos', JSON.stringify(localPhotos));
  }, [localPhotos]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) setFiltersOpen(false);
    }
    if (filtersOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filtersOpen]);

  useEffect(() => { loadEmployees(); }, [query, nameSort]);
  useEffect(() => { loadStats(); }, []);

  const getSortedEmployees = () => {
    let processed = [...employees];
   
    if (deptFilter !== 'all') {
      processed = processed.filter(e => e.departmentProject === deptFilter);
    }

    if (categoryFilter !== 'all') {
      processed = processed.filter(e => e.employmentCategory === categoryFilter);
    }

    if (nameSort !== 'none') {
      processed.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        if (nameSort === 'asc') return nameA.localeCompare(nameB);
        return nameB.localeCompare(nameA);
      });
    } else if (deptFilter === 'all' && categoryFilter === 'all') {
      processed.reverse();
    }
    return processed;
  };

  const deleteEmployee = (uid) => {
    if (!window.confirm("Are you sure?")) return;
    fetch(`${API_BASE}/api/employees/${encodeURIComponent(uid)}`, { method: 'DELETE' })
      .then((r) => {
        if (r.ok) {
          const newPhotos = { ...localPhotos };
          delete newPhotos[uid];
          setLocalPhotos(newPhotos);
          loadEmployees();
          loadStats();
        }
      });
  };

  const handleClearSearch = () => {
    setQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const openAdd = () => {
    setEditingUid(null);
    setErrorMsg('');
    setForm({ uid: '', name: '', departmentProject: '', employmentCategory: '', certifications: '', pdsAvailable: false, idViewAvailable: false, profilePicFile: null, tempPreview: null, pdsFile: null, idFile: null });
    setModalOpen(true);
  };

  const openEdit = (emp) => {
    setEditingUid(emp.uid);
    setForm({
      uid: emp.uid,
      name: emp.name,
      departmentProject: emp.departmentProject,
      employmentCategory: emp.employmentCategory || '',
      certifications: Array.isArray(emp.certifications) ? emp.certifications.join(', ') : emp.certifications || '',
      pdsAvailable: !!emp.pdsAvailable,
      idViewAvailable: !!emp.idViewAvailable,
      profilePicFile: null,
      tempPreview: localPhotos[emp.uid] || null,
      pdsFile: null,
      idFile: null
    });
    setModalOpen(true);
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

  const submitForm = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const fd = new FormData();
    fd.append('uid', form.uid.trim());
    fd.append('name', form.name.trim());
    fd.append('departmentProject', form.departmentProject.trim());
    fd.append('employmentCategory', form.employmentCategory.trim());
    fd.append('certifications', form.certifications);
    if (form.pdsFile) fd.append('pdsFile', form.pdsFile);
    if (form.idFile) fd.append('idFile', form.idFile);

    const url = editingUid ? `${API_BASE}/api/employees/${encodeURIComponent(editingUid)}` : `${API_BASE}/api/employees`;

    try {
      const res = await fetch(url, { method: editingUid ? 'PUT' : 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());

      if (form.tempPreview) {
        setLocalPhotos(prev => ({ ...prev, [form.uid.trim()]: form.tempPreview }));
      }

      setModalOpen(false);
      setEditingUid(null);
      loadEmployees();
      loadStats();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const sortedList = getSortedEmployees();

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
          <div className="title">Employee Directory</div>
          <div className="page-description">Manage records and local profile pictures</div>
        </div>
        <button className="btn primary" onClick={openAdd}>+ Add Employee</button>
      </div>

      <div className="metrics">
        <Metric label="Total Employees" value={stats?.totalEmployees ?? '-'} icon="👥" />
        <Metric label="Job Order" value={stats?.jobOrderCount ?? '-'} icon="📋" />
        <Metric label="Regular" value={stats?.regularEmployeeCount ?? '-'} icon="👤" />
        <Metric label="Technical Ops" value={stats?.technicalOpsDivisions ?? '-'} icon="🛠️" />
        <Metric label="Admin" value={stats?.adminCount ?? '-'} icon="🏢" />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Employee Records</div>
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
                    <select className="select" value={nameSort} onChange={(e) => setNameSort(e.target.value)}>
                      <option value="none">None</option>
                      <option value="asc">Ascending (A–Z)</option>
                      <option value="desc">Descending (Z–A)</option>
                    </select>
                  </div>
                  <div className="form-col" style={{ marginTop: '12px' }}>
                    <label className="field-label">Department Project</label>
                    <select className="select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                      <option value="all">All Departments</option>
                      <option value="Technical Operations Divisions">Technical Operations Divisions</option>
                      <option value="Admin of Finance">Admin of Finance</option>
                      <option value="Office of the Regional Director">Office of the Regional Director</option>
                    </select>
                  </div>
                  <div className="form-col" style={{ marginTop: '12px' }}>
                    <label className="field-label">Employment Category</label>
                    <select className="select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                      <option value="all">All Categories</option>
                      <option value="Job Order">Job Order</option>
                      <option value="Regular Employees">Regular Employees</option>
                      <option value="Technical Operations Divisions">Technical Operations Divisions</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="table-container">
          <div className="table employees-table">
            <div className="thead">
              <div className="text-center">UID</div>
              <div className="text-center">Name</div>
              <div className="text-center">Department Project</div>
              <div className="text-center">Employment Category</div>
              <div className="text-center">Certifications</div>
              <div className="text-center">PDS</div>
              <div className="text-center">ID</div>
              <div className="text-center">Action</div>
            </div>

            {sortedList.length === 0 ? (
              <div className="no-records-row">No record(s) found/added</div>
            ) : (
              sortedList.map((e) => (
                <div className="trow" key={e.uid}>
                  <div className="text-center uid-text">{e.uid}</div>
                  <div className="namecell">
                    <div className="employee-avatar clickable-avatar avatar-border" onClick={() => localPhotos[e.uid] && setFullImageView(localPhotos[e.uid])}>
                      {localPhotos[e.uid] ? <img src={localPhotos[e.uid]} alt="" /> : <span>{e.name?.charAt(0).toUpperCase()}</span>}
                    </div>
                    <span className="employee-name-text">{e.name}</span>
                  </div>
                  <div className="text-center">{e.departmentProject}</div>
                  <div className="text-center">{e.employmentCategory}</div>
                  <div className="text-center">{e.certifications}</div>
                  <div className="text-center">{e.pdsFilePath ? <a href={`${API_BASE}${e.pdsFilePath}`} target="_blank" className="btn small light view-btn">View</a> : '-'}</div>
                  <div className="text-center">{e.idFilePath ? <a href={`${API_BASE}${e.idFilePath}`} target="_blank" className="btn small light view-btn">View</a> : '-'}</div>
                  <div className="activity-cell">
                    <button className="btn small edit-btn" onClick={() => openEdit(e)}>Edit</button>
                    <button className="btn small delete-btn" onClick={() => deleteEmployee(e.uid)}><Trash2 size={16}/></button>
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
              <div className="card-title">{editingUid ? 'Edit Employee Info' : 'Add Employee'}</div>
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
                  <input className="input" placeholder="Enter UID" value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} required disabled={!!editingUid}/>
                  <label className="field-label" style={{ marginTop: '10px' }}>Name</label>
                  <input className="input" placeholder="Enter Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Department Project</label>
                  <select className="select" value={form.departmentProject} onChange={(e) => setForm({ ...form, departmentProject: e.target.value })}>
                    <option value="">Select Department</option>
                    <option value="Technical Operations Divisions">Technical Operations Divisions</option>
                    <option value="Admin of Finance">Admin of Finance</option>
                    <option value="Office of the Regional Director">Office of the Regional Director</option>
                  </select>
                </div>
                <div className="form-col">
                  <label className="field-label">Employment Category</label>
                  <select className="select" value={form.employmentCategory} onChange={(e) => setForm({ ...form, employmentCategory: e.target.value })}>
                    <option value="">Select Category</option>
                    <option value="Job Order">Job Order</option>
                    <option value="Regular Employees">Regular Employees</option>
                    <option value="Technical Operations Divisions">Technical Operations Divisions</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">Certifications</label>
                  <input className="input" placeholder="e.g. CCNA, CISSP" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label className="field-label">PDS (upload)</label>
                  <input className="input" type="file" onChange={(e) => setForm({ ...form, pdsFile: e.target.files[0] })} />
                </div>
                <div className="form-col">
                  <label className="field-label">ID (upload)</label>
                  <input className="input" type="file" onChange={(e) => setForm({ ...form, idFile: e.target.files[0] })} />
                </div>
              </div>

              <div className="modal-actions">
                {errorMsg && <p className="error-text">{errorMsg}</p>}
                <button type="submit" className="btn primary submit-btn">{editingUid ? 'Save Changes' : 'Add Employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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
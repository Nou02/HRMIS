import React, { useState } from 'react';
import './module201.css';
import { API_BASE } from '../../lib/api';

export default function Application() {
  const [query, setQuery] = useState('');
  const [applications, setApplications] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nameSortAZ, setNameSortAZ] = useState(false);
  const [typeSortAZ, setTypeSortAZ] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    uid: '',
    name: '',
    typeOfLeave: '',
    leaveStatus: '',
    offsetHours: '',
    offsetStatus: '',
  });

  const loadApplications = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (nameSortAZ) params.set('sort', 'name_asc');
    if (typeSortAZ) params.set('sort', 'type_asc');
    const url = `${API_BASE}/api/applications${params.toString() ? `?${params.toString()}` : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then(setApplications)
      .catch(() => {});
  };

  React.useEffect(() => {
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, nameSortAZ, typeSortAZ]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      uid: '',
      name: '',
      typeOfLeave: '',
      leaveStatus: '',
      offsetHours: '',
      offsetStatus: '',
    });
    setModalOpen(true);
  };

  const openEdit = (a) => {
    setEditingId(a.id || null);
    setForm({
      uid: a.uid,
      name: a.name,
      typeOfLeave: a.typeOfLeave || '',
      leaveStatus: a.leaveStatus || '',
      offsetHours: a.offsetHours ?? '',
      offsetStatus: a.offsetStatus || '',
    });
    setModalOpen(true);
  };

  const submitForm = (e) => {
    e.preventDefault();
    const hoursNum = Number(form.offsetHours || 0);
    if (hoursNum && hoursNum < 2) return;
    const payload = {
      uid: form.uid.trim(),
      name: form.name.trim(),
      typeOfLeave: form.typeOfLeave.trim(),
      leaveStatus: form.leaveStatus.trim(),
      offsetHours: hoursNum || 0,
      offsetStatus: form.offsetStatus.trim(),
    };
    const url = editingId
      ? `${API_BASE}/api/applications/${encodeURIComponent(editingId)}`
      : `${API_BASE}/api/applications`;
    fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(() => {
        setModalOpen(false);
        loadApplications();
      })
      .catch(() => {});
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="title">201 • Application</div>
        <div className="actions">
          <button className="btn primary" onClick={openAdd}>+ New Application</button>
          <div className="avatar" />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Leave & Off-set Applications</div>
          <div className="card-actions">
            <div className="search">
              <span>🔍</span>
              <input
                placeholder="Search employee"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="btn light" onClick={() => setFiltersOpen((v) => !v)}>Advanced filters</button>
          </div>
        </div>
        {filtersOpen && (
          <div className="dropdown-menu" style={{ position: 'absolute', right: 24 }}>
            <div className="form-col">
              <label>Name (Sort A–Z)</label>
              <select className="select" value={nameSortAZ ? 'az' : 'none'} onChange={(e) => setNameSortAZ(e.target.value === 'az')}>
                <option value="none">None</option>
                <option value="az">A–Z</option>
              </select>
            </div>
            <div className="form-col">
              <label>Type of Leave (Sort A–Z)</label>
              <select className="select" value={typeSortAZ ? 'az' : 'none'} onChange={(e) => setTypeSortAZ(e.target.value === 'az')}>
                <option value="none">None</option>
                <option value="az">A–Z</option>
              </select>
            </div>
          </div>
        )}
        <div className="table applications-table">
          <div className="thead">
            <div>UID</div>
            <div>Name</div>
            <div>Type of Leave</div>
            <div>Leave Application Status</div>
            <div>Off-set</div>
            <div>Off-set Application Status</div>
            <div>Activity</div>
          </div>
          {(applications.length ? applications : Array.from({ length: 5 }, (_, i) => ({ key: i }))).map((item) => {
            if (!applications.length) {
              return (
                <div className="trow" key={item.key}>
                  <div>-</div>
                  <div className="namecell"><span>-</span></div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                  <div>-</div>
                </div>
              );
            }
            const a = item;
            return (
              <div className="trow" key={(a.id || '') + a.uid}>
                <div>{a.uid}</div>
                <div className="namecell"><span>{a.name}</span></div>
                <div>{a.typeOfLeave}</div>
                <div>{a.leaveStatus}</div>
                <div>{typeof a.offsetHours === 'number' && a.offsetHours > 0 ? `${a.offsetHours} hrs` : (a.offset || '-')}</div>
                <div>{a.offsetStatus}</div>
                <div><button className="btn small" onClick={() => openEdit(a)}>Edit</button></div>
              </div>
            );
          })}
        </div>
      </div>
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="card-title">{editingId ? 'Edit Application' : 'New Application'}</div>
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
                  <label>Type of Leave</label>
                  <select className="select" value={form.typeOfLeave} onChange={(e) => setForm({ ...form, typeOfLeave: e.target.value })} required>
                    <option value="">Select Type</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Vacation Leave">Vacation Leave</option>
                    <option value="Emergency Leave">Emergency Leave</option>
                    <option value="Maternity Leave">Maternity Leave</option>
                  </select>
                </div>
                <div className="form-col">
                  <label>Leave Application Status</label>
                  <select className="select" value={form.leaveStatus} onChange={(e) => setForm({ ...form, leaveStatus: e.target.value })} required>
                    <option value="">Select Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label>Off-set (min 2 hrs)</label>
                  <input className="input" type="number" min="2" value={form.offsetHours} onChange={(e) => setForm({ ...form, offsetHours: e.target.value })} />
                </div>
                <div className="form-col">
                  <label>Off-set Application Status</label>
                  <select className="select" value={form.offsetStatus} onChange={(e) => setForm({ ...form, offsetStatus: e.target.value })}>
                    <option value="">Select Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn primary">{editingId ? 'Save' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import './module201.css';
import { API_BASE } from '../../lib/api';

function Metric({ label, value }) {
  return (
    <div className="metric">
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function GatePass() {
  const [query, setQuery] = React.useState('');
  const [sortNameAZ, setSortNameAZ] = React.useState(false);
  const [list, setList] = React.useState([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [form, setForm] = React.useState({
    uid: '',
    name: '',
    destination: '',
    purpose: '',
    date: '',
    timeOut: '',
    timeIn: '',
    status: 'Pending',
  });

  const loadList = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (sortNameAZ) params.set('sort', 'name_asc');
    params.set('sort', 'date_desc');
    const url = `${API_BASE}/api/gatepasses${params.toString() ? `?${params.toString()}` : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then(setList)
      .catch(() => {});
  };

  React.useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sortNameAZ]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      uid: '',
      name: '',
      destination: '',
      purpose: '',
      date: '',
      timeOut: '',
      timeIn: '',
      status: 'Pending',
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
    });
    setModalOpen(true);
  };

  const submitForm = (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (!editingId) {
      fetch(`${API_BASE}/api/gatepasses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then(() => {
          setModalOpen(false);
          loadList();
        })
        .catch(() => {});
    } else {
      fetch(`${API_BASE}/api/gatepasses/${encodeURIComponent(editingId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then(() => {
          setModalOpen(false);
          loadList();
        })
        .catch(() => {});
    }
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
      <div className="screen-header">
        <div className="title">201 • Gate Pass</div>
        <div className="actions">
          <button className="btn primary" onClick={openAdd}>+ New Gate Pass</button>
          <div className="avatar" />
        </div>
      </div>

      <div className="grid-3">
        <Metric label="Total Requests" value={list.length || '—'} />
        <Metric label="Pending" value={list.filter((g) => (g.status || '').toLowerCase() === 'pending').length || '—'} />
        <Metric label="Approved" value={list.filter((g) => (g.status || '').toLowerCase() === 'approved').length || '—'} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Gate Pass Records</div>
          <div className="card-actions">
            <div className="search">
              <span>🔍</span>
              <input
                placeholder="Search uid, name, destination, purpose"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="btn light" onClick={() => setSortNameAZ((v) => !v)}>{sortNameAZ ? 'Sort: Name A–Z' : 'Sort: None'}</button>
          </div>
        </div>
        <div className="table">
          <div className="thead" style={{ gridTemplateColumns: '120px 220px 1fr 1fr 120px 120px 120px 120px 140px' }}>
            <div>UID</div>
            <div>Name</div>
            <div>Destination</div>
            <div>Purpose</div>
            <div>Date</div>
            <div>Time Out</div>
            <div>Time In</div>
            <div>Status</div>
            <div>Action</div>
          </div>
          {(list.length ? list : []).map((row) => (
            <div className="trow" key={row.id} style={{ gridTemplateColumns: '120px 220px 1fr 1fr 120px 120px 120px 120px 140px' }}>
              <div>{row.uid}</div>
              <div className="namecell"><span>{row.name}</span></div>
              <div>{row.destination}</div>
              <div>{row.purpose}</div>
              <div>{row.date}</div>
              <div>{row.timeOut}</div>
              <div>{row.timeIn}</div>
              <div><span className={`status ${row.statusClass || 'draft'}`}>{row.status}</span></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn light" onClick={() => openEdit(row)}>Edit</button>
                <button className="btn primary" onClick={() => approve(row)}>Approve</button>
              </div>
            </div>
          ))}
          {!list.length && (
            <div style={{ padding: 16 }}>No records found.</div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title">{editingId ? 'Edit Gate Pass' : 'New Gate Pass'}</div>
              <div className="modal-actions">
                <button className="btn light" onClick={() => setModalOpen(false)}>Close</button>
              </div>
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
                  <label>Destination</label>
                  <input className="input" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
                </div>
                <div className="form-col">
                  <label>Purpose</label>
                  <input className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label>Date</label>
                  <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="form-col">
                  <label>Time Out</label>
                  <input className="input" type="time" value={form.timeOut} onChange={(e) => setForm({ ...form, timeOut: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label>Time In</label>
                  <input className="input" type="time" value={form.timeIn} onChange={(e) => setForm({ ...form, timeIn: e.target.value })} />
                </div>
                <div className="form-col">
                  <label>Status</label>
                  <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option>Pending</option>
                    <option>Approved</option>
                    <option>Rejected</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn primary" type="submit">{editingId ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

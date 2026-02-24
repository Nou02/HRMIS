import React, { useState } from 'react';
import './module201.css';

export default function EmployeesList() {
  const [query, setQuery] = useState('');
  const placeholders = Array.from({ length: 5 }, (_, i) => ({ key: i }));
  const [employees, setEmployees] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nameSortAZ, setNameSortAZ] = useState(false);
  const [sortDeptAZ, setSortDeptAZ] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUid, setEditingUid] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    uid: '',
    name: '',
    departmentProject: '',
    employmentCategory: '',
    certifications: '',
    pdsAvailable: false,
    idViewAvailable: false,
  });

  const loadEmployees = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (nameSortAZ) params.set('sort', 'name_asc');
    if (sortDeptAZ) params.set('sort', 'department_asc');
    const url = `http://localhost:5174/api/employees${params.toString() ? `?${params.toString()}` : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then(setEmployees)
      .catch(() => {});
  };

  const [stats, setStats] = useState(null);
  const loadStats = () => {
    fetch('http://localhost:5174/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  };
  React.useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, nameSortAZ, sortDeptAZ]);
  React.useEffect(() => {
    loadStats();
  }, []);

  const openAdd = () => {
    setEditingUid(null);
    setErrorMsg('');
    setForm({
      uid: '',
      name: '',
      departmentProject: '',
      certifications: '',
      pdsAvailable: false,
      idViewAvailable: false,
    });
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
    });
    setModalOpen(true);
  };

  const submitForm = (e) => {
    e.preventDefault();
    setErrorMsg('');
    const fd = new FormData();
    fd.append('uid', form.uid.trim());
    fd.append('name', form.name.trim());
    fd.append('departmentProject', form.departmentProject.trim());
    fd.append('employmentCategory', form.employmentCategory.trim());
    fd.append('certifications', form.certifications);
    fd.append('pdsAvailable', form.pdsAvailable ? 'true' : 'false');
    fd.append('idViewAvailable', form.idViewAvailable ? 'true' : 'false');
    if (form.pdsFile) fd.append('pdsFile', form.pdsFile);
    if (form.idFile) fd.append('idFile', form.idFile);
    const url = editingUid
      ? `http://localhost:5174/api/employees/${encodeURIComponent(editingUid)}`
      : 'http://localhost:5174/api/employees';
    fetch(url, {
      method: editingUid ? 'PUT' : 'POST',
      body: fd,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(() => {
        setModalOpen(false);
        loadEmployees();
      }).then(() => loadStats())
      .catch((e) => {
        const msg = (e && e.message) ? String(e.message) : '';
        setErrorMsg(msg ? `Failed to save: ${msg}` : 'Failed to save. Please check network/server and required fields.');
      });
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="title">201 · Employee's List</div>
        <div className="actions">
          <button className="btn primary" onClick={openAdd}>+ Add Employee</button>
          <div className="avatar" />
        </div>
      </div>

      <div className="metrics">
        <Metric label="No. of Job Order" value={stats?.jobOrderCount ?? '-'} />
        <Metric label="No. of Regular Employees" value={stats?.regularEmployeeCount ?? '-'} />
        <Metric label="No. of Technical Operations Divisions" value={stats?.technicalOpsDivisions ?? '-'} />
        <Metric label="No. of Admin" value={stats?.adminCount ?? '-'} />
        <Metric label="Total Employees" value={stats?.totalEmployees ?? '-'} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Employee Records</div>
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
        <div className="table">
          <div className="thead">
            <div>UID</div>
            <div>Name</div>
            <div>Department Project</div>
            <div>Certifications</div>
            <div>PDS</div>
            <div>View ID</div>
            <div>Activity</div>
          </div>
          {(employees.length ? employees : placeholders).map((item) => {
            if (!employees.length) {
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
            const e = item;
            return (
              <div className="trow" key={e.uid}>
                <div>{e.uid}</div>
                <div className="namecell">
                  {e.avatarUrl ? <img src={e.avatarUrl} alt="" /> : null}
                  <span>{e.name}</span>
                </div>
                <div>{e.departmentProject}</div>
                <div>{Array.isArray(e.certifications) ? e.certifications.join(', ') : e.certifications}</div>
                <div>{e.pdsFilePath ? <a href={`http://localhost:5174${e.pdsFilePath}`} target="_blank" rel="noreferrer">View</a> : '-'}</div>
                <div>{e.idFilePath ? <a href={`http://localhost:5174${e.idFilePath}`} target="_blank" rel="noreferrer">View</a> : '-'}</div>
                <div><button className="btn small" onClick={() => openEdit(e)}>Edit</button></div>
              </div>
            );
          })}
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
            <label>Department (Sort A–Z)</label>
            <select className="select" value={sortDeptAZ ? 'az' : 'none'} onChange={(e) => setSortDeptAZ(e.target.value === 'az')}>
              <option value="none">None</option>
              <option value="az">A–Z</option>
            </select>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="card-title">{editingUid ? 'Edit Employee' : 'Add Employee'}</div>
              <button className="btn light" onClick={() => setModalOpen(false)}>Close</button>
            </div>
            <form onSubmit={submitForm}>
              <div className="form-row">
                <div className="form-col">
                  <label>UID</label>
                  <input className="input" value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} required disabled={!!editingUid} />
                </div>
                <div className="form-col">
                  <label>Name</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label>Department Project</label>
                  <select className="select" value={form.departmentProject} onChange={(e) => setForm({ ...form, departmentProject: e.target.value })}>
                    <option value="">Select Department</option>
                    <option value="Technical Operations Divisions">Technical Operations Divisions</option>
                    <option value="Admin of Finance">Admin of Finance</option>
                    <option value="Office of the Regional Director">Office of the Regional Director</option>
                  </select>
                </div>
                <div className="form-col">
                  <label>Certifications (comma separated)</label>
                  <input className="input" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-col">
                  <label>Employment Category</label>
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
                  <label>PDS (upload)</label>
                  <input className="input" type="file" onChange={(e) => setForm({ ...form, pdsFile: e.target.files?.[0] })} />
                </div>
                <div className="form-col">
                  <label>ID (upload)</label>
                  <input className="input" type="file" onChange={(e) => setForm({ ...form, idFile: e.target.files?.[0] })} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn primary">{editingUid ? 'Save' : 'Add'}</button>
              </div>
              {errorMsg && <div style={{ color: '#dc2626', padding: '8px 0' }}>{errorMsg}</div>}
            </form>
          </div>
        </div>
      )}
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

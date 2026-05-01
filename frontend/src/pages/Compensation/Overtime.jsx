import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../lib/api';
import { Clock, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import './Overtime.css';

function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if (day >= 1 && day <= 15) {
    return { period: `P1-${year}-${String(month).padStart(2, '0')}`, label: `Period 1 (1st-15th)` };
  } else {
    return { period: `P2-${year}-${String(month).padStart(2, '0')}`, label: `Period 2 (16th-end)` };
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Overtime() {
  const [currentPeriod] = useState(getCurrentPeriod);
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod.period);
  const [selectedUid, setSelectedUid] = useState('');
  const [employees, setEmployees] = useState([]);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [hourlyRate, setHourlyRate] = useState(200);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [formData, setFormData] = useState({ uid: '', date: '', hours: '', description: '' });

  useEffect(() => {
    fetch(`${API_BASE}/api/employees?q=&department=All`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmployees(data);
          if (data.length > 0 && !selectedUid) {
            setSelectedUid(data[0].uid);
          }
        }
      })
      .catch(() => console.error('Failed to load employees'));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/overtime/rate`)
      .then(r => r.json())
      .then(data => setHourlyRate(data.hourlyRate))
      .catch(() => console.error('Failed to load overtime rate'));
  }, []);

  const loadEntries = React.useCallback(() => {
    if (!selectedUid) return;
    fetch(`${API_BASE}/api/overtime?uid=${encodeURIComponent(selectedUid)}&period=${encodeURIComponent(selectedPeriod)}`)
      .then(r => r.json())
      .then(data => {
        setEntries(data.entries || []);
        setSummary(data.summary);
      })
      .catch(() => console.error('Failed to load overtime entries'));
  }, [selectedUid, selectedPeriod]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handlePeriodChange = (e) => {
    setSelectedPeriod(e.target.value);
  };

  const handleUidChange = (e) => {
    setSelectedUid(e.target.value);
  };

  const handleRateSave = async () => {
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate < 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/overtime/rate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hourlyRate: rate })
      });
      const data = await res.json();
      setHourlyRate(data.hourlyRate);
      setEditingRate(false);
      if (selectedUid) loadEntries();
    } catch {
      console.error('Failed to update rate');
    }
  };

  const openModal = (entry = null) => {
    if (entry) {
      setEditEntry(entry);
      setFormData({ uid: entry.uid, date: entry.date, hours: entry.hours.toString(), description: entry.description });
    } else {
      setEditEntry(null);
      setFormData({ uid: selectedUid, date: new Date().toISOString().split('T')[0], hours: '', description: '' });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditEntry(null);
    setFormData({ uid: '', date: '', hours: '', description: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hours = parseFloat(formData.hours);
    if (!formData.uid || !formData.date || isNaN(hours) || hours < 0) return;

    try {
      const res = await fetch(`${API_BASE}/api/overtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: formData.uid,
          date: formData.date,
          hours: hours,
          description: formData.description
        })
      });
      const data = await res.json();
      if (res.ok) {
        loadEntries();
        closeModal();
      } else {
        alert(data.error || 'Failed to add entry');
      }
    } catch {
      console.error('Failed to add entry');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this overtime entry?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/overtime/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        loadEntries();
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch {
      console.error('Failed to delete entry');
    }
  };

  const periodOptions = [];
  const now = new Date();
  for (let m = 0; m < 12; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    periodOptions.push({
      period: `P1-${year}-${String(month).padStart(2, '0')}`,
      label: `P1 ${year}-${String(month).padStart(2, '0')} (1st-15th)`
    });
    periodOptions.push({
      period: `P2-${year}-${String(month).padStart(2, '0')}`,
      label: `P2 ${year}-${String(month).padStart(2, '0')} (16th-end)`
    });
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1 className="title">Overtime Management</h1>
          <p className="page-description">Track and manage employee overtime hours and pay</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="period-selector">
            <select className="period-select" value={selectedPeriod} onChange={handlePeriodChange}>
              {periodOptions.map(opt => (
                <option key={opt.period} value={opt.period}>{opt.label}</option>
              ))}
            </select>
            <span className="period-badge">{selectedPeriod}</span>
          </div>
          <button className="btn primary" onClick={() => openModal()}>
            <Plus size={16} style={{ marginRight: 6 }} />
            Add Overtime
          </button>
        </div>
      </div>

      <div className="employee-select-container">
        <select className="employee-select" value={selectedUid} onChange={handleUidChange}>
          <option value="">Select Employee</option>
          {employees.map(emp => (
            <option key={emp.uid} value={emp.uid}>{emp.name} ({emp.uid})</option>
          ))}
        </select>
      </div>

      {selectedUid && summary && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-card-label">Total Overtime Hours</div>
            <div className="metric-card-value highlight">{summary.totalHours.toFixed(2)} hrs</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Hourly Rate</div>
            <div className="metric-card-value">₱{hourlyRate.toFixed(2)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Total Overtime Pay</div>
            <div className="metric-card-value highlight">₱{summary.totalPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-label">Period</div>
            <div className="metric-card-value" style={{ fontSize: '14px' }}>{summary.periodStart} to {summary.periodEnd}</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px', color: 'var(--muted)' }}>Overtime Rate:</span>
        {editingRate ? (
          <div className="rate-input-group">
            <span>₱</span>
            <input
              type="number"
              value={rateInput}
              onChange={e => setRateInput(e.target.value)}
              min="0"
              step="0.01"
              style={{ width: '100px' }}
            />
            <button className="btn small" onClick={handleRateSave}><Check size={14} /></button>
            <button className="btn small" onClick={() => setEditingRate(false)}><X size={14} /></button>
          </div>
        ) : (
          <span
            className="rate-badge"
            onClick={() => { setEditingRate(true); setRateInput(hourlyRate.toString()); }}
          >
            ₱{hourlyRate.toFixed(2)}/hour
          </span>
        )}
      </div>

      <div className="table-container">
        <div className="table-header-row">
          <div>Date</div>
          <div>Employee</div>
          <div>Hours</div>
          <div>Description</div>
          <div className="text-right">Actions</div>
        </div>

        {entries.length === 0 ? (
          <div className="empty-row">
            {selectedUid ? 'No overtime entries for this period' : 'Select an employee to view overtime'}
          </div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="table-row">
              <div>{formatDate(entry.date)}</div>
              <div>{entry.name}</div>
              <div>{entry.hours.toFixed(2)} hrs</div>
              <div>{entry.description || '-'}</div>
              <div className="text-right">
                <button className="delete-btn" onClick={() => handleDelete(entry.id)} title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editEntry ? 'Edit Overtime Entry' : 'Add Overtime Entry'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Employee</label>
                <select
                  value={formData.uid}
                  onChange={e => setFormData({ ...formData, uid: e.target.value })}
                  required
                  disabled={!!editEntry}
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.uid} value={emp.uid}>{emp.name} ({emp.uid})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                  disabled={!!editEntry}
                />
              </div>
              <div className="form-group">
                <label>Hours</label>
                <input
                  type="number"
                  value={formData.hours}
                  onChange={e => setFormData({ ...formData, hours: e.target.value })}
                  min="0"
                  step="0.01"
                  placeholder="e.g. 2.5"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Extended shift"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn primary">{editEntry ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
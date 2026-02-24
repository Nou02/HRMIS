import React from 'react';
import './dashboard.css';

export default function Dashboard() {
  const modules = [
    { key: '201', label: '201', icon: '📁' },
    { key: 'compensation', label: 'Compensation', icon: '💳' },
    { key: 'reports', label: 'Reports', icon: '📊' },
  ];
  return (
    <div className="screen">
      <div className="screen-header">
        <div className="title">Dashboard</div>
      </div>
      <div className="grid">
        {modules.map((m) => (
          <div className="module-card" key={m.key}>
            <div className="module-icon">{m.icon}</div>
            <div className="module-title">{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import employeeFilesImg from '../assets/employfiles.jpg';
import compensationImg from '../assets/compensation.jpg';
import reportsImg from '../assets/report.jpg';

export default function Dashboard({ onNavigate }) {
  const [selectedModule, setSelectedModule] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const modules = [
    {
      id: '201',
      label: '201 (Employee Files)',
      icon: '📁',
      image: employeeFilesImg,
      description: 'Access the complete Employee Directory, manage Gate Pass requests, and track staff Time Off Requests.',
      subModules: [
        { label: "Employee Directory", id: 'employees' },
        { label: "Gate Passes", id: 'gatepass' },
        { label: "Time Off Requests", id: 'application' }
      ]
    },
    {
      id: 'comp',
      label: 'Compensation',
      icon: '💳',
      image: compensationImg,
      description: 'Manage General Payrolls, view individual Payslips, and monitor daily Time Keeping records.',
      subModules: [
        { label: "General Payrolls", id: 'payroll' },
        { label: "Payslips", id: 'payslips' },
        { label: "Time Keeping", id: 'timekeeping' }
      ]
    },
    {
      id: 'rep',
      label: 'Reports',
      icon: '📊',
      image: reportsImg,
      description: 'Generate detailed analytics for Attendance Logs and overall Compensation summaries.',
      subModules: [
        { label: "Attendance Logs", id: 'reports-time' },
        { label: "Compensation", id: 'reports-comp' }
      ]
    },
  ];

  return (
    <div className="screen page-fade-in">
      <div className="screen-header dashboard-header">
        <div className="header-text">
          <h1 className="title">Dashboard</h1>
          <p className="subtitle">Welcome HR Manager! Please select a module to proceed.</p>
        </div>
        
        <div className="digital-clock">
          <div className="clock-time">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="clock-date">
            ({currentTime.toLocaleDateString([], { weekday: 'long' })}) {currentTime.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>
      
      <div className="grid">
        {modules.map((m) => (
          <div
            className="module-card"
            key={m.id}
            onClick={() => setSelectedModule(m)}
            style={{
              '--bg-image': `url(${m.image})`
            }}
          >
            <div className="card-image-bg"></div>

            <div className="card-inner-content">
              <div className="module-icon">{m.icon}</div>
              <div className="module-text-container">
                <h3 className="module-title">{m.label}</h3>
                <p className="module-desc">{m.description}</p>
              </div>
              <div className="module-click-hint">Open Module →</div>
            </div>
          </div>
        ))}
      </div>

      {selectedModule && (
        <div className="modal-overlay" onClick={() => setSelectedModule(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-info">
                <div className="modal-title-group">
                  <span className="modal-header-icon">{selectedModule.icon}</span>
                  <h2 className="modal-display-title">{selectedModule.label}</h2>
                </div>
                <p className="modal-subtitle">Select a specific tab to enter:</p>
              </div>
            </div>
            
            <div className="sub-module-list">
              {selectedModule.subModules.map(sub => (
                <button
                  key={sub.id}
                  className="sub-opt-btn"
                  onClick={() => {
                    onNavigate(sub.id);
                    setSelectedModule(null);
                  }}
                >
                  <span className="btn-label">{sub.label}</span>
                  <span className="btn-arrow">→</span>
                </button>
              ))}
            </div>
            
            <button className="close-modal" onClick={() => setSelectedModule(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
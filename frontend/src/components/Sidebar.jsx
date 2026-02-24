import React, { useState } from 'react';
import './sidebar.css';

function Item({ label, id, level = 0, active, onNavigate }) {
  return (
    <div
      onClick={() => onNavigate(id)}
      className={`nav-item level-${level} ${active === id ? 'active' : ''}`}
    >
      {label}
    </div>
  );
}

export default function Sidebar({ active, onNavigate }) {
  const [open201, setOpen201] = useState(true);
  const [openComp, setOpenComp] = useState(false);
  const [openReports, setOpenReports] = useState(false);

  return (
    <aside className="sidebar">
      <div className="brand">HRMIS</div>
      <div className="nav-group">
        <Item label="Dashboard" id="dashboard" active={active} onNavigate={onNavigate} />
      </div>
      <div className="group-header" onClick={() => setOpen201(!open201)}>
        <span className="caret">{open201 ? '▾' : '▸'}</span>
        <span>201</span>
      </div>
      {open201 && (
        <div className="nav-group">
          <Item label="Employee's List" id="employees" level={1} active={active} onNavigate={onNavigate} />
          <Item label="Gate Pass" id="gatepass" level={1} active={active} onNavigate={onNavigate} />
          <Item label="Application" id="application" level={1} active={active} onNavigate={onNavigate} />
        </div>
      )}
      <div className="group-header" onClick={() => setOpenComp(!openComp)}>
        <span className="caret">{openComp ? '▾' : '▸'}</span>
        <span>Compensation</span>
      </div>
      {openComp && (
        <div className="nav-group">
          <Item label="General Payroll" id="payroll" level={1} active={active} onNavigate={onNavigate} />
          <Item label="Pay slips" id="payslips" level={1} active={active} onNavigate={onNavigate} />
          <Item label="Time Keeping" id="timekeeping" level={1} active={active} onNavigate={onNavigate} />
        </div>
      )}
      <div className="group-header" onClick={() => setOpenReports(!openReports)}>
        <span className="caret">{openReports ? '▾' : '▸'}</span>
        <span>Reports</span>
      </div>
      {openReports && (
        <div className="nav-group">
          <Item label="Time Keeping" id="reports-time" level={1} active={active} onNavigate={onNavigate} />
          <Item label="Compensation" id="reports-comp" level={1} active={active} onNavigate={onNavigate} />
        </div>
      )}
    </aside>
  );
}

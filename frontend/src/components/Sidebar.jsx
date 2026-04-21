import React from 'react';
import { LayoutDashboard, Users, DoorOpen, AlarmClockOff, Wallet, Receipt, Clock, LogOut, HandCoins, CalendarClock } from 'lucide-react';
import './sidebar.css';

function Item({ label, id, active, onNavigate, icon: Icon }) {
  return (
    <div
      onClick={() => onNavigate(id)}
      className={`nav-item ${active === id ? 'active' : ''}`}
    >
      {Icon && <Icon size={18} className="nav-icon" />}
      <span className="nav-label">{label}</span>
    </div>
  );
}

export default function Sidebar({ active, onNavigate, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img
          className="brand-logo"
          src="https://commons.wikimedia.org/wiki/Special:FilePath/Department_of_Information_and_Communications_Technology_(DICT)_-_Seal_only.svg"
          alt="DICT Seal"
        />
        <span className="brand-text">HRMIS</span>
      </div>

      <div className="nav-container">
        <Item
          label="Dashboard"
          id="dashboard"
          active={active}
          onNavigate={onNavigate}
          icon={LayoutDashboard}
        />

        {/* 201 Employee Files Group */}
        <div className="group-wrapper">
          <div className="group-header">
            <span>201 (Employee Files)</span>
          </div>
          <div className="nav-group">
            <Item label="Employee Directory" id="employees" active={active} onNavigate={onNavigate} icon={Users} />
            <Item label="Gate Passes" id="gatepass" active={active} onNavigate={onNavigate} icon={DoorOpen} />
            <Item label="Time Off Requests" id="application" active={active} onNavigate={onNavigate} icon={AlarmClockOff} />
          </div>
        </div>

        {/* Compensation Group */}
        <div className="group-wrapper">
          <div className="group-header">
            <span>Compensation</span>
          </div>
          <div className="nav-group">
            <Item label="General Payrolls" id="payroll" active={active} onNavigate={onNavigate} icon={Wallet} />
            <Item label="Payslips" id="payslips" active={active} onNavigate={onNavigate} icon={Receipt} />
            <Item label="Time Keeping" id="timekeeping" active={active} onNavigate={onNavigate} icon={Clock} />
          </div>
        </div>

        {/* Reports Group */}
        <div className="group-wrapper">
          <div className="group-header">
            <span>Reports</span>
          </div>
          <div className="nav-group">
            <Item label="Attendance Logs" id="reports-time" active={active} onNavigate={onNavigate} icon={CalendarClock} />
            <Item label="Compensation" id="reports-comp" active={active} onNavigate={onNavigate} icon={HandCoins} />
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <button className="logout-button" onClick={onLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

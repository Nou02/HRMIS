import { useState } from 'react';
import Sidebar from './components/Sidebar';
import EmployeesList from './pages/Module201/EmployeesList';
import Application from './pages/Module201/Application';
import GatePass from './pages/Module201/GatePass';
import Dashboard from './pages/Dashboard';
import GeneralPayroll from './pages/Compensation/GeneralPayroll';
import Payslips from './pages/Compensation/Payslips';
import TimeKeeping from './pages/Compensation/TimeKeeping';
import ReportsTimeKeeping from './pages/Reports/ReportsTimeKeeping';
import ReportsCompensation from './pages/Reports/ReportsCompensation';
import Landing from './pages/Landing';
import Login from './pages/Login';
import PasswordRecovery from './pages/PasswordRecovery';
import './index.css';

function App() {
  const [active, setActive] = useState('employees');
  const [showLanding, setShowLanding] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  if (showLanding) {
    return (
      <Landing
        onEnter={() => {
          setShowLanding(false);
          setShowLogin(true);
        }}
      />
    );
  }

  if (showLogin) {
    return (
      <Login
        onLogin={() => setShowLogin(false)}
        onForgot={() => {
          setShowLogin(false);
          setShowRecovery(true);
        }}
      />
    );
  }

  if (showRecovery) {
    return (
      <PasswordRecovery
        onBack={() => {
          setShowRecovery(false);
          setShowLogin(true);
        }}
      />
    );
  }

  return (
    <div>
      <Sidebar
        active={active}
        onNavigate={setActive}
        onLogout={() => {
          setShowLogin(true);
        }}
      />
      {active === 'dashboard' && <Dashboard />}
      {active === 'employees' && <EmployeesList />}
      {active === 'gatepass' && <GatePass />}
      {active === 'application' && <Application />}
      {active === 'payroll' && <GeneralPayroll />}
      {active === 'payslips' && <Payslips />}
      {active === 'timekeeping' && <TimeKeeping />}
      {active === 'reports-comp' && <ReportsCompensation />}
      {active === 'reports-time' && <ReportsTimeKeeping />}
      {active !== 'employees' && active !== 'gatepass' && active !== 'application' && active !== 'dashboard' && active !== 'payroll' && active !== 'payslips' && active !== 'timekeeping' && active !== 'reports-time' && active !== 'reports-comp' && (
        <div style={{ marginLeft: 240, padding: 24 }}>
          Select a page from the sidebar
        </div>
      )}
    </div>
  );
}

export default App

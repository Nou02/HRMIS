import { useState } from 'react';
import Sidebar from './components/Sidebar';
import EmployeesList from './pages/Module201/Directory';
import Application from './pages/Module201/Requests';
import GatePass from './pages/Module201/GatePass';
import Dashboard from './pages/Dashboard';
import GeneralPayroll from './pages/Compensation/Payroll';
import Payslips from './pages/Compensation/Payslips';
import TimeKeeping from './pages/Compensation/TimeKeeping';
import ReportsTimeKeeping from './pages/Reports/ReportsAttendance';
import ReportsCompensation from './pages/Reports/ReportsCompensation';
import Landing from './pages/Landing';
import Login from './pages/Login';
import PasswordRecovery from './pages/PasswordRecovery';
import './index.css';

function App() {
  const [active, setActive] = useState('dashboard');
  const [showLanding, setShowLanding] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  const handleLogout = () => {
    setShowLogin(true);
    setActive('dashboard');
  };

  if (showLanding) return <Landing onEnter={() => { setShowLanding(false); setShowLogin(true); }} />;
  
  if (showLogin) return (
    <Login 
      onLogin={() => setShowLogin(false)} 
      onForgot={() => { setShowLogin(false); setShowRecovery(true); }} 
    />
  );

  if (showRecovery) return <PasswordRecovery onBack={() => { setShowRecovery(false); setShowLogin(true); }} />;

  const renderPage = () => {
    switch (active) {
      case 'dashboard': return <Dashboard onNavigate={setActive} />;
      case 'employees': return <EmployeesList />;
      case 'gatepass':  return <GatePass />;
      case 'application': return <Application />;
      case 'payroll':   return <GeneralPayroll />;
      case 'payslips':  return <Payslips />;
      case 'timekeeping': return <TimeKeeping />;
      case 'reports-time': return <ReportsTimeKeeping />;
      case 'reports-comp': return <ReportsCompensation />;
      default: return <Dashboard onNavigate={setActive} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar 
        active={active} 
        onNavigate={setActive} 
        onLogout={handleLogout} 
      />
      <main className="main-viewport">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
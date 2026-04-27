import { useState, useEffect } from 'react';
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
  const [localPhotos, setLocalPhotos] = useState(() => {
    const saved = localStorage.getItem('hrmis_employee_photos');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('hrmis_employee_photos', JSON.stringify(localPhotos));
  }, [localPhotos]);

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
      case 'employees': return <EmployeesList localPhotos={localPhotos} setLocalPhotos={setLocalPhotos} />;
      case 'gatepass':  return <GatePass localPhotos={localPhotos} setLocalPhotos={setLocalPhotos} />;
      case 'application': return <Application localPhotos={localPhotos} setLocalPhotos={setLocalPhotos} />;
      case 'payroll':   return <GeneralPayroll localPhotos={localPhotos} />;
      case 'payslips':  return <Payslips localPhotos={localPhotos} />;
      case 'timekeeping': return <TimeKeeping localPhotos={localPhotos} setLocalPhotos={setLocalPhotos} />;
      case 'reports-time': return <ReportsTimeKeeping localPhotos={localPhotos} />;
      case 'reports-comp': return <ReportsCompensation localPhotos={localPhotos} />;
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
import React from 'react';
import '../Compensation/compensation.css';
import { API_BASE } from '../../lib/api';

export default function ReportsCompensation() {
  const [view, setView] = React.useState(null);
  const [payroll, setPayroll] = React.useState([]);
  const [payslips, setPayslips] = React.useState([]);

  React.useEffect(() => {
    if (view === 'payroll') {
      fetch(`${API_BASE}/api/payroll/records?only_generated=true`)
        .then((r) => r.json())
        .then(setPayroll)
        .catch(() => setPayroll([]));
    }
    if (view === 'payslips') {
      fetch(`${API_BASE}/api/payslips?only_confirmed=true`)
        .then((r) => r.json())
        .then(setPayslips)
        .catch(() => setPayslips([]));
    }
  }, [view]);

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="title">Reports · Compensation</div>
        <div className="actions">
          <div className="avatar" />
        </div>
      </div>

      {!view && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="module-card" onClick={() => setView('payroll')}>
            <div className="module-icon">💳</div>
            <div className="module-title">General Payroll</div>
          </div>
          <div className="module-card" onClick={() => setView('payslips')}>
            <div className="module-icon">📄</div>
            <div className="module-title">Payslip</div>
          </div>
        </div>
      )}

      {view === 'payroll' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Preview · General Payroll</div>
            <div className="card-actions">
              <button className="btn light" onClick={() => setView(null)}>Back</button>
            </div>
          </div>
          <div className="table">
            <div className="thead">
              <div>Employee ID</div>
              <div>Employee Name</div>
              <div>Base Salary</div>
              <div>Overtime</div>
              <div>Deduction</div>
              <div>Net Pay</div>
              <div>Status</div>
            </div>
            {(payroll.length ? payroll : []).map((row) => (
              <div className="trow" key={row.employeeId}>
                <div>{row.employeeId}</div>
                <div>{row.employeeName}</div>
                <div>{row.baseSalary}</div>
                <div>{row.overtime}</div>
                <div>{row.deduction}</div>
                <div>{row.netPay}</div>
                <div><span className={`status ${row.statusClass}`}>{row.status}</span></div>
              </div>
            ))}
            {!payroll.length && (
              <div style={{ padding: 16 }}>No generated payroll found. Use Compensation → General Payroll to Process Payroll.</div>
            )}
          </div>
        </div>
      )}

      {view === 'payslips' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Preview · Payslip</div>
            <div className="card-actions">
              <button className="btn light" onClick={() => setView(null)}>Back</button>
            </div>
          </div>
          <div className="table">
            <div className="thead">
              <div>UID</div>
              <div>Name</div>
              <div>Gross</div>
              <div>Bonus</div>
              <div>Deductions</div>
              <div>Net Pay</div>
              <div>Period</div>
              <div>Status</div>
            </div>
            {(payslips.length ? payslips : []).map((p) => (
              <div className="trow" key={p.uid}>
                <div>{p.uid}</div>
                <div className="namecell"><span>{p.name}</span></div>
                <div>{p.gross}</div>
                <div>{p.bonus}</div>
                <div>{p.deductions}</div>
                <div>{p.netPay}</div>
                <div>{p.period}</div>
                <div><span className={`status ${p.statusClass || 'draft'}`}>{p.status}</span></div>
              </div>
            ))}
            {!payslips.length && (
              <div style={{ padding: 16 }}>No generated payslips found. Use Compensation → General Payroll to Process Payroll.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

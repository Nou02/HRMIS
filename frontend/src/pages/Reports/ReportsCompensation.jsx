import React, { useState, useEffect, useRef, useMemo } from 'react';
import './Compensation.css';
import { API_BASE } from '../../lib/api';
import payrollImg from '../../assets/payroll.jpg';
import payslipImg from '../../assets/payslip.jpg';
import dictLogo from '../../assets/Header1.jpg';
import { 
  ArrowLeft, 
  FileDown, 
  FileText, 
  Table, 
  Printer, 
  ChevronDown,
  Settings,
  Plus,
  Trash2,
  X
} from 'lucide-react';

export default function ReportsCompensation({ localPhotos }) {
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const periodNum = now.getDate() <= 15 ? 1 : 2;
    return `P${periodNum}-${year}-${month}`;
  });
  const [view, setView] = React.useState(null);
  const [payroll, setPayroll] = React.useState([]);
  const [payslips, setPayslips] = React.useState([]);
  const [summary, setSummary] = React.useState({
    totalEmployees: 0,
    basePayroll: '₱0.00',
    totalOvertime: '₱0.00',
    period: '-'
  });
  const [fullImageView, setFullImageView] = React.useState(null);
  
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const exportRef = useRef(null);

  // Signatories state
  const [signatoriesOpen, setSignatoriesOpen] = useState(false);
  const [signatoryPool, setSignatoryPool] = useState([]);
  const [signatoryRoles, setSignatoryRoles] = useState([]);
  const [newSignatoryName, setNewSignatoryName] = useState('');

  useEffect(() => {
    if (signatoriesOpen) {
      fetchSignatories();
    }
  }, [signatoriesOpen]);

  const fetchSignatories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/signatories`);
      const data = await res.json();
      setSignatoryPool(data.names || []);
      setSignatoryRoles(data.roles || []);
    } catch (err) {
      console.error('Failed to fetch signatories:', err);
    }
  };

  const addSignatoryToPool = async () => {
    if (!newSignatoryName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/signatories/pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSignatoryName.trim() })
      });
      if (res.ok) {
        setNewSignatoryName('');
        fetchSignatories();
      }
    } catch (err) {
      console.error('Failed to add signatory:', err);
    }
  };

  const deleteSignatoryFromPool = async (id) => {
    if (!window.confirm('Are you sure you want to delete this name?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/signatories/pool/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchSignatories();
    } catch (err) {
      console.error('Failed to delete signatory:', err);
    }
  };

  const updateAssignment = async (roleId, nameId) => {
    try {
      const res = await fetch(`${API_BASE}/api/signatories/assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId, nameId })
      });
      if (res.ok) fetchSignatories();
    } catch (err) {
      console.error('Failed to update assignment:', err);
    }
  };

  const periodOptions = [];
  const now = new Date();
  for (let m = 0; m < 12; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const mm = String(month).padStart(2, '0');
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    
    periodOptions.push({
      value: `P1-${year}-${mm}`,
      label: `${monthName} 1-15, ${year}`
    });
    
    const lastDay = new Date(year, month, 0).getDate();
    periodOptions.push({
      value: `P2-${year}-${mm}`,
      label: `${monthName} 16-${lastDay}, ${year}`
    });
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Load summary for the selected period, filtering by 'Generated' status only
    fetch(`${API_BASE}/api/payroll/summary?period=${encodeURIComponent(period)}&status=Generated`)
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {});

    if (view === 'payroll') {
      // Fetch only 'Generated' payroll records for the report
      fetch(`${API_BASE}/api/payroll/records?period=${encodeURIComponent(period)}&only_generated=true`)
        .then((r) => r.json())
        .then(setPayroll)
        .catch(() => setPayroll([]));
    }
    if (view === 'payslips') {
      // Payslips report already filters by 'only_confirmed=true'
      fetch(`${API_BASE}/api/payslips?only_confirmed=true&period=${encodeURIComponent(period)}`)
        .then((r) => r.json())
        .then((data) => {
          // Trim and compare periods to be robust against spacing issues
          const targetPeriod = String(period || '').trim();
          const filtered = (Array.isArray(data) ? data : []).filter(p => 
            String(p.period || '').trim() === targetPeriod
          );
          setPayslips(filtered);
        })
        .catch((err) => {
          console.error('Payslips report error:', err);
          setPayslips([]);
        });
    }
  }, [view, period]);

  const formatPeso = (value) => {
    const numStr = String(value).trim();
    if (numStr === '0' || numStr === '-' || numStr === '') return '';
    const num = Number(value);
    if (isNaN(num)) return value;
    return `₱${num.toLocaleString('en-PH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '-' || dateStr === '—') return '-';
    
    // Check if it's a period code like P1-2026-05
    const periodMatch = String(dateStr).match(/^P(\d)-(\d{4})-(\d{2})$/);
    if (periodMatch) {
      const [_, num, year, month] = periodMatch;
      const d = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthName = d.toLocaleString('en-US', { month: 'short' });
      if (num === '1') return `${monthName} 1-15, ${year}`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      return `${monthName} 16-${lastDay}, ${year}`;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const filteredAndSortedPayroll = useMemo(() => {
    const statusPriority = { 'generated': 1, 'updated': 2, 'draft': 3 };
    const filtered = payroll
      .filter(row => {
        // Correctly parse currency string like "₱144,000"
        const netStr = String(row.netPay || '0').replace(/[^\d.-]/g, '');
        const net = parseFloat(netStr);
        return !isNaN(net) && net > 0;
      })
      .sort((a, b) => {
        const priorityA = statusPriority[(a.status || 'draft').toLowerCase().replace(/\s*\(new\)\s*/i, '')] || 99;
        const priorityB = statusPriority[(b.status || 'draft').toLowerCase().replace(/\s*\(new\)\s*/i, '')] || 99;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return (a.employeeName || '').localeCompare(b.employeeName || '');
      });

    if (selectedDept) {
      return filtered.filter(r => r.departmentProject === selectedDept);
    }
    return filtered;
  }, [payroll, selectedDept]);

  const payrollByDept = useMemo(() => {
    const groups = {};
    payroll.forEach(row => {
      const netStr = String(row.netPay || '0').replace(/[^\d.-]/g, '');
      const net = parseFloat(netStr);
      if (isNaN(net) || net <= 0) return;

      const dept = row.departmentProject || 'Unassigned';
      if (!groups[dept]) groups[dept] = { employees: [], totalNet: 0 };
      groups[dept].employees.push(row);
      groups[dept].totalNet += net;
    });
    return groups;
  }, [payroll]);

  const getStatusColorStyle = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'generated' || s === 'approved') return 'background-color: #dcfce7; color: #166534;';
    if (s === 'updated' || s === 'review') return 'background-color: #fef9c3; color: #854d0e;';
    if (s === 'draft') return 'background-color: #e2e8f0; color: #475569;';
    return 'background-color: #f1f5f9; color: #0f172a;';
  };

  const getExportFileName = () => {
    const d = new Date();
    const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
    return view === 'payroll' 
      ? `DICT_Payrolls_Report (${dateStr})` 
      : `DICT_Payslips_Report (${dateStr})`;
  };

  const downloadCSV = () => {
    let headers, dataRows;
    if (view === 'payroll') {
      headers = ['UID', 'Name', 'Base Salary', 'Overtime', 'Deduction', 'Net Pay', 'Status'];
      dataRows = filteredAndSortedPayroll.map(r => [
        r.employeeId, 
        r.employeeName, 
        String(r.baseSalary) === '0' || r.baseSalary === '-' ? '' : r.baseSalary, 
        String(r.overtime) === '0' || r.overtime === '-' ? '' : r.overtime, 
        String(r.deduction) === '0' || r.deduction === '-' ? '' : r.deduction, 
        String(r.netPay) === '0' || r.netPay === '-' ? '' : r.netPay, 
        r.status
      ]);
    } else {
      headers = ['UID', 'Name', 'Gross', 'Bonus', 'Deductions', 'Net Pay', 'Period', 'Status'];
      dataRows = payslips.map(p => [
        p.uid, 
        p.name, 
        String(p.gross) === '0' || p.gross === '-' ? '' : p.gross, 
        String(p.bonus) === '0' || p.bonus === '-' ? '' : p.bonus, 
        String(p.deductions) === '0' || p.deductions === '-' ? '' : p.deductions, 
        String(p.netPay) === '0' || p.netPay === '-' ? '' : p.netPay, 
        formatDate(p.period), 
        p.status
      ]);
    }
    const csv = [headers.join(',')].concat(dataRows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${getExportFileName()}.csv`;
    link.click();
  };

  const downloadExcel = () => {
    if (view === 'payroll' && selectedDept) {
      // Use the template-based Excel export for department payroll
      const url = `${API_BASE}/api/payroll/export-xlsx?period=${encodeURIComponent(period)}&department=${encodeURIComponent(selectedDept)}`;
      window.open(url, '_blank');
      return;
    }

    if (view === 'payslips') {
      // For payslips report, if multiple are in view, we could offer a bulk download 
      // but for now, the user usually wants the template-based export per employee.
      // If the user clicks the GLOBAL Export button while in Payslips view, 
      // we'll offer a message or use the generic export.
      alert("To use the 'pay slip.xlsx' template, please use the download icon next to each employee in the table.");
    }

    const isPayroll = view === 'payroll';
    const data = isPayroll ? filteredAndSortedPayroll : payslips;
    const headers = isPayroll 
      ? ['UID', 'Name', 'Base Salary', 'Overtime', 'Deduction', 'Net Pay', 'Status']
      : ['UID', 'Name', 'Gross', 'Bonus', 'Deductions', 'Net Pay', 'Period', 'Status'];

    const tableRows = data.map(r => {
      const cells = isPayroll 
        ? [r.employeeId, r.employeeName, formatPeso(r.baseSalary), formatPeso(r.overtime), formatPeso(r.deduction), formatPeso(r.netPay)]
        : [r.uid, r.name, formatPeso(r.gross), formatPeso(r.bonus), formatPeso(r.deductions), formatPeso(r.netPay), formatDate(r.period)];
      
      const statusText = isPayroll ? r.status : r.status;
      const statusStyle = getStatusColorStyle(statusText);

      return `<tr>
        ${cells.map(c => `<td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px;">${c}</td>`).join('')}
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 8px; font-weight: bold; ${statusStyle}">${statusText}</td>
      </tr>`;
    }).join('');

    const html = `<html><head><meta charset="UTF-8"></head><body>
      <table style="border-collapse: collapse; width: 100%;">
        <thead><tr style="background-color: #f1f5f9;">
          ${headers.map(h => `<th style="border: 1px solid #e5e7eb; border-bottom: 2.5pt solid #000000; padding: 12px; text-align: center;">${h}</th>`).join('')}
        </tr></thead><tbody>${tableRows}</tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${getExportFileName()}.xls`;
    link.click();
  };

  const downloadPDF = async () => {
    const getBase64Image = (url) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = url;
      });
    };

    let logoBase64 = "";
    try { logoBase64 = await getBase64Image(dictLogo); } catch (e) { console.error(e); }

    const isPayroll = view === 'payroll';
    const data = isPayroll ? filteredAndSortedPayroll : payslips;
    const headers = isPayroll 
      ? ['UID', 'Name', 'Base Salary', 'Overtime', 'Deduction', 'Net Pay', 'Status']
      : ['UID', 'Name', 'Gross', 'Bonus', 'Deductions', 'Net Pay', 'Period', 'Status'];

    const tableRows = data.map(r => {
      const cells = isPayroll 
        ? [r.employeeId, r.employeeName, formatPeso(r.baseSalary), formatPeso(r.overtime), formatPeso(r.deduction), formatPeso(r.netPay)]
        : [r.uid, r.name, formatPeso(r.gross), formatPeso(r.bonus), formatPeso(r.deductions), formatPeso(r.netPay), formatDate(r.period)];
      
      const statusText = isPayroll ? r.status : r.status;
      const statusStyle = getStatusColorStyle(statusText);

      return `<tr>
        ${cells.map(c => `<td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">${c}</td>`).join('')}
        <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">
          <div style="padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 10px; ${statusStyle}">
            ${String(statusText).toUpperCase()}
          </div>
        </td>
      </tr>`;
    }).join('');

    const htmlContent = `<html><head><style>
      @page { margin: 0; }
      body { font-family: sans-serif; padding: 50px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .logo-container { width: 100%; margin-bottom: 10px; }
      .logo-container img { width: 100%; height: auto; display: block; }
      h2 { margin: 15px 0 5px 0; color: #0f172a; font-size: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { background-color: #f1f5f9; border: 1px solid #e5e7eb; border-bottom: 3px solid #000000; padding: 12px; font-size: 12px; }
      td { font-size: 11px; border: 1px solid #e5e7eb; }
    </style></head><body>
      <div class="logo-container">${logoBase64 ? `<img src="${logoBase64}" />` : ''}</div>
      <h2>${isPayroll ? 'General Payroll Report' : 'Employee Payslips Report'}</h2>
      <p style="color: #64748b; font-size: 12px;">Generated Date: ${new Date().toLocaleDateString()}</p>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body></html>`;

    const oldTitle = document.title;
    document.title = getExportFileName();
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(htmlContent);
    iframe.contentWindow.document.close();
    setTimeout(() => {
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
      document.title = oldTitle;
    }, 500);
  };

  return (
    <div className="screen">
      {fullImageView && (
        <div className="image-viewer-overlay" onClick={() => setFullImageView(null)}>
          <button className="viewer-close">✕</button>
          <img src={fullImageView} alt="Full View" />
        </div>
      )}

      <div className="screen-header">
        <div>
          <div className="title">Compensation</div>
          <div className="subtitle-text">View and export generated financial reports</div>
        </div>
        <div className="actions">
          <div className="period-selector-container" style={{ marginRight: '16px' }}>
            <select 
              className="select" 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
            >
              {periodOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {summary?.period && summary.period !== '-' && (
            <div className="period-badge">
              <span className="label">Period:</span>
              <span className="value">{formatDate(summary.period)}</span>
            </div>
          )}
          <div className="avatar" />
        </div>
      </div>

      {!view && (
        <>
          <div className="summary-metrics-row">
            <div className="metric-card">
              <div className="metric-icon blue">💰</div>
              <div className="metric-info">
                <div className="metric-label">Total Net Payroll</div>
                <div className="metric-value">{summary.basePayroll}</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon purple">👥</div>
              <div className="metric-info">
                <div className="metric-label">Employees Paid</div>
                <div className="metric-value">{summary.totalEmployees}</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon orange">⌛</div>
              <div className="metric-info">
                <div className="metric-label">Total Overtime</div>
                <div className="metric-value">{summary.totalOvertime}</div>
              </div>
            </div>
          </div>

          <div className="grid-selection">
            <div className="module-card" onClick={() => setView('payroll')}>
              <div className="module-bg" style={{ backgroundImage: `url(${payrollImg})` }} />
              <div className="module-overlay" />
              <div className="module-content-wrapper">
                <div className="module-icon">💳</div>
                <div className="module-content">
                  <div className="module-title">General Payrolls</div>
                  <div className="module-desc">Review total company payroll records for {formatDate(summary.period)}</div>
                </div>
                <div className="module-click-hint">Open Report →</div>
              </div>
            </div>

            <div className="module-card" onClick={() => setView('payslips')}>
              <div className="module-bg" style={{ backgroundImage: `url(${payslipImg})` }} />
              <div className="module-overlay" />
              <div className="module-content-wrapper">
                <div className="module-icon">📄</div>
                <div className="module-content">
                  <div className="module-title">Payslips</div>
                  <div className="module-desc">View confirmed individual employee payslips for {formatDate(summary.period)}</div>
                </div>
                <div className="module-click-hint">Open Report →</div>
              </div>
            </div>
          </div>
        </>
      )}

      {view === 'payroll' && (
        <div className="card">
          <div className="card-header overflow-visible">
            <div className="card-title">
              {selectedDept ? `General Payrolls · ${selectedDept}` : 'General Payrolls · Select Department'}
            </div>
            <div className="card-actions" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn light" onClick={() => setSignatoriesOpen(true)} title="Edit Report Signatories">
                <Settings size={18} style={{ marginRight: '8px' }} /> Signatories
              </button>
              <div className="dropdown" ref={exportRef}>
                <button className="btn primary export-btn" onClick={() => setExportOpen(!exportOpen)}>
                  <FileDown size={18} style={{ marginRight: '8px' }} /> Export <ChevronDown size={16} style={{ marginLeft: '8px' }} />
                </button>
                {exportOpen && (
                  <div className="dropdown-menu export-dropdown">
                    <button className="export-item" onClick={downloadCSV}><FileText size={16} style={{ marginRight: '10px' }} /> Download CSV</button>
                    <button className="export-item" onClick={downloadExcel}><Table size={16} style={{ marginRight: '10px' }} /> Download Excel</button>
                    <button className="export-item" onClick={downloadPDF}><Printer size={16} style={{ marginRight: '10px' }} /> Download PDF</button>
                  </div>
                )}
              </div>
              <button className="btn back-btn-red" onClick={() => {
                if (selectedDept) setSelectedDept(null);
                else setView(null);
              }}>
                <ArrowLeft size={18} />
                <span>Back</span>
              </button>
            </div>
          </div>

          {!selectedDept ? (
            <div className="grid-selection" style={{ padding: '24px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {Object.keys(payrollByDept).length > 0 ? (
                Object.entries(payrollByDept).map(([dept, data]) => (
                  <div key={dept} className="module-card" onClick={() => setSelectedDept(dept)} style={{ height: '200px' }}>
                    <div className="module-bg" style={{ backgroundColor: '#f8fafc', backgroundImage: 'none' }} />
                    <div className="module-overlay" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(0,0,0,0.05) 100%)' }} />
                    <div className="module-content-wrapper">
                      <div className="module-icon" style={{ fontSize: '32px' }}>🏢</div>
                      <div className="module-content">
                        <div className="module-title" style={{ color: '#1e293b' }}>{dept}</div>
                        <div className="module-desc" style={{ color: '#64748b' }}>
                          {data.employees.length} Employee{data.employees.length !== 1 ? 's' : ''} · Total: ₱{data.totalNet.toLocaleString()}
                        </div>
                      </div>
                      <div className="module-click-hint" style={{ color: '#3b82f6' }}>View Employees →</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-records-row" style={{ gridColumn: '1 / -1' }}>
                  No generated payroll records found for this period.
                </div>
              )}
            </div>
          ) : (
            <div className="table reports-payroll-table">
              <div className="thead">
                <div className="text-center">UID</div>
                <div className="text-center">Name</div>
                <div className="text-center">Base Salary</div>
                <div className="text-center">Overtime</div>
                <div className="text-center">Deduction</div>
                <div className="text-center">Net Pay</div>
                <div className="text-center">Status</div>
              </div>
              {filteredAndSortedPayroll.length > 0 ? (
                filteredAndSortedPayroll.map((row) => (
                  <div className="trow" key={row.employeeId}>
                    <div className="text-center uid-text">{row.employeeId}</div>
                    <div className="namecell-vertical">
                      <div
                        className="employee-avatar-small clickable-avatar-small"
                        onClick={() => {
                          const imgUrl = row.avatarUrl ? `${API_BASE}${row.avatarUrl}` : localPhotos[row.employeeId];
                          if (imgUrl) setFullImageView(imgUrl);
                        }}
                      >
                        {row.avatarUrl ? (
                          <img src={`${API_BASE}${row.avatarUrl}`} alt="" />
                        ) : localPhotos[row.employeeId] ? (
                          <img src={localPhotos[row.employeeId]} alt="" />
                        ) : (
                          <span className="avatar-initials-small">{(row.employeeName || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="employee-name-text">{row.employeeName}</span>
                    </div>
                    <div className="text-center">{formatPeso(row.baseSalary)}</div>
                    <div className="text-center">{formatPeso(row.overtime)}</div>
                    <div className="text-center">{formatPeso(row.deduction)}</div>
                    <div className="text-center" style={{ fontWeight: 600 }}>{formatPeso(row.netPay)}</div>
                    <div className="text-center">
                      <span className={`status ${(row.status || 'draft').toLowerCase()}`}>
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-records-row">
                  No payroll entries found for this department.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'payslips' && (
        <div className="card">
          <div className="card-header overflow-visible">
            <div className="card-title">Preview · Payslips</div>
            <div className="card-actions" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn light" onClick={() => setSignatoriesOpen(true)} title="Edit Report Signatories">
                <Settings size={18} style={{ marginRight: '8px' }} /> Signatories
              </button>
              <div className="dropdown" ref={exportRef}>
                <button className="btn primary export-btn" onClick={() => setExportOpen(!exportOpen)}>
                  <FileDown size={18} style={{ marginRight: '8px' }} /> Export <ChevronDown size={16} style={{ marginLeft: '8px' }} />
                </button>
                {exportOpen && (
                  <div className="dropdown-menu export-dropdown">
                    <button className="export-item" onClick={downloadCSV}><FileText size={16} style={{ marginRight: '10px' }} /> Download CSV</button>
                    <button className="export-item" onClick={downloadExcel}><Table size={16} style={{ marginRight: '10px' }} /> Download Excel</button>
                    <button className="export-item" onClick={downloadPDF}><Printer size={16} style={{ marginRight: '10px' }} /> Download PDF</button>
                  </div>
                )}
              </div>
              <button className="btn back-btn-red" onClick={() => setView(null)}>
                <ArrowLeft size={18} />
                <span>Back</span>
              </button>
            </div>
          </div>
          <div className="table reports-payslip-table">
            <div className="thead">
              <div className="text-center">UID</div>
              <div className="text-center">Name</div>
              <div className="text-center">Gross</div>
              <div className="text-center">Bonus</div>
              <div className="text-center">Deductions</div>
              <div className="text-center">Net Pay</div>
              <div className="text-center">Period</div>
              <div className="text-center">Status</div>
              <div className="text-center">Action</div>
            </div>
            {payslips.length > 0 ? (
              payslips.map((p, idx) => (
                <div className="trow" key={p.uid || idx}>
                  <div className="text-center uid-text">{p.uid}</div>
                  <div className="namecell-vertical">
                    <div
                      className="employee-avatar-small clickable-avatar-small"
                      onClick={() => {
                        const imgUrl = p.avatarUrl ? `${API_BASE}${p.avatarUrl}` : localPhotos[p.uid];
                        if (imgUrl) setFullImageView(imgUrl);
                      }}
                    >
                      {p.avatarUrl ? (
                        <img src={`${API_BASE}${p.avatarUrl}`} alt="" />
                      ) : localPhotos[p.uid] ? (
                        <img src={localPhotos[p.uid]} alt="" />
                      ) : (
                        <span className="avatar-initials-small">{(p.name || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="employee-name-text">{p.name}</span>
                  </div>
                  <div className="text-center">{formatPeso(p.gross)}</div>
                  <div className="text-center">{formatPeso(p.bonus)}</div>
                  <div className="text-center">{formatPeso(p.deductions)}</div>
                  <div className="text-center" style={{ fontWeight: 600 }}>{formatPeso(p.netPay)}</div>
                  <div className="text-center">{formatDate(p.period)}</div>
                  <div className="text-center">
                    <span className={`status ${p.statusClass || 'draft'}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="text-center">
                    <button 
                      className="btn light small"
                      onClick={() => window.open(`${API_BASE}/api/payslips/export-xlsx?uid=${p.uid}&period=${p.period}`, '_blank')}
                      title="Export to Excel Template"
                    >
                      <FileDown size={14} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-records-row">
                No generated payslips found. Use Compensation → General Payroll to Process Payroll.
              </div>
            )}
          </div>
        </div>
      )}

      {signatoriesOpen && (
        <div className="modal-overlay">
          <div className="modal-content signatories-modal">
            <div className="modal-header">
              <h3>Edit Report Signatories</h3>
              <button className="close-btn" onClick={() => setSignatoriesOpen(false)}><X size={20} /></button>
            </div>
            
            <div className="modal-body">
              <div className="signatories-section">
                <h4>Role Assignments</h4>
                <p className="section-desc">Assign names to specific roles for the Excel export.</p>
                <div className="roles-grid">
                  {signatoryRoles.map(role => (
                    <div key={role.id} className="role-item">
                      <label>{role.role_name}</label>
                      <select 
                        value={role.current_name_id || ''} 
                        onChange={(e) => updateAssignment(role.id, e.target.value || null)}
                      >
                        <option value="">-- Select Name --</option>
                        {signatoryPool.map(name => (
                          <option key={name.id} value={name.id}>{name.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="signatories-section">
                <h4>Manage Names Pool</h4>
                <p className="section-desc">Add or remove names available for assignment.</p>
                
                <div className="add-name-form">
                  <input 
                    type="text" 
                    placeholder="Enter full name..." 
                    value={newSignatoryName}
                    onChange={(e) => setNewSignatoryName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addSignatoryToPool()}
                  />
                  <button className="btn primary" onClick={addSignatoryToPool}>
                    <Plus size={18} /> Add
                  </button>
                </div>

                <div className="names-list">
                  {signatoryPool.map(name => (
                    <div key={name.id} className="name-tag">
                      <span>{name.name}</span>
                      <button className="delete-name-btn" onClick={() => deleteSignatoryFromPool(name.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn primary" onClick={() => setSignatoriesOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
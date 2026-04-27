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
  ChevronDown 
} from 'lucide-react';

export default function ReportsCompensation({ localPhotos }) {
  const [view, setView] = React.useState(null);
  const [payroll, setPayroll] = React.useState([]);
  const [payslips, setPayslips] = React.useState([]);
  const [fullImageView, setFullImageView] = React.useState(null);
  
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

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
    if (view === 'payroll') {
      fetch(`${API_BASE}/api/payroll/records`)
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
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const filteredAndSortedPayroll = useMemo(() => {
    const statusPriority = { 'generated': 1, 'updated': 2, 'draft': 3 };
    return payroll
      .filter(row => {
        const net = parseFloat(row.netPay);
        return !isNaN(net) && net > 0;
      })
      .sort((a, b) => {
        const priorityA = statusPriority[(a.status || 'draft').toLowerCase()] || 99;
        const priorityB = statusPriority[(b.status || 'draft').toLowerCase()] || 99;
        return priorityA - priorityB;
      });
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
    const isPayroll = view === 'payroll';
    const data = isPayroll ? filteredAndSortedPayroll : payslips;
    const headers = isPayroll 
      ? ['UID', 'Name', 'Base Salary', 'Overtime', 'Deduction', 'Net Pay', 'Status']
      : ['UID', 'Name', 'Gross', 'Bonus', 'Deductions', 'Net Pay', 'Period', 'Status'];

    const tableRows = data.map(r => {
      const cells = isPayroll 
        ? [r.employeeId, r.employeeName, formatPeso(r.baseSalary), formatPeso(r.overtime), formatPeso(r.deduction), formatPeso(r.netPay)]
        : [r.uid, r.name, formatPeso(r.gross), formatPeso(r.bonus), formatPeso(r.deductions), formatPeso(r.netPay), formatDate(p.period)];
      
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
          <div className="avatar" />
        </div>
      </div>

      {!view && (
        <div className="grid-selection">
          <div className="module-card" onClick={() => setView('payroll')}>
            <div className="module-bg" style={{ backgroundImage: `url(${payrollImg})` }} />
            <div className="module-overlay" />
            <div className="module-content-wrapper">
              <div className="module-icon">💳</div>
              <div className="module-content">
                <div className="module-title">General Payrolls</div>
                <div className="module-desc">Review total company payroll records</div>
              </div>
              <div className="module-click-hint">Open Module →</div>
            </div>
          </div>

          <div className="module-card" onClick={() => setView('payslips')}>
            <div className="module-bg" style={{ backgroundImage: `url(${payslipImg})` }} />
            <div className="module-overlay" />
            <div className="module-content-wrapper">
              <div className="module-icon">📄</div>
              <div className="module-content">
                <div className="module-title">Payslips</div>
                <div className="module-desc">View confirmed individual employee payslips</div>
              </div>
              <div className="module-click-hint">Open Module →</div>
            </div>
          </div>
        </div>
      )}

      {view === 'payroll' && (
        <div className="card">
          <div className="card-header overflow-visible">
            <div className="card-title">Preview · General Payrolls</div>
            <div className="card-actions" style={{ display: 'flex', gap: '8px' }}>
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
                      onClick={() => localPhotos[row.employeeId] && setFullImageView(localPhotos[row.employeeId])}
                    >
                      {localPhotos[row.employeeId] ? (
                        <img src={localPhotos[row.employeeId]} alt="" />
                      ) : (
                        <span className="avatar-initials-small">{(row.employeeName || '?').charAt(0)}</span>
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
                No payroll entries with net pay found.
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'payslips' && (
        <div className="card">
          <div className="card-header overflow-visible">
            <div className="card-title">Preview · Payslips</div>
            <div className="card-actions" style={{ display: 'flex', gap: '8px' }}>
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
            </div>
            {payslips.length > 0 ? (
              payslips.map((p) => (
                <div className="trow" key={p.uid}>
                  <div className="text-center uid-text">{p.uid}</div>
                  <div className="namecell-vertical">
                    <div
                      className="employee-avatar-small clickable-avatar-small"
                      onClick={() => localPhotos[p.uid] && setFullImageView(localPhotos[p.uid])}
                    >
                      {localPhotos[p.uid] ? (
                        <img src={localPhotos[p.uid]} alt="" />
                      ) : (
                        <span className="avatar-initials-small">{(p.name || '?').charAt(0)}</span>
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
    </div>
  );
}
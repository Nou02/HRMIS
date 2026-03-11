import React, { useEffect, useState } from 'react';
import './login.css';
import bgPassword from '../assets/bgforpassword.png';

export default function PasswordRecovery({ onBack }) {
  const [enter, setEnter] = useState(false);
  const [email, setEmail] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setEnter(true), 50);
    return () => clearTimeout(t);
  }, []);

  function submit(e) {
    e.preventDefault();
    if (!email) return;
    alert('If this email exists, a reset link has been sent.');
  }

  return (
    <div className={`recovery ${enter ? 'enter' : ''}`}>
      <div className="stage">
        <div
          className="recovery-bg"
          style={{ backgroundImage: `url(${bgPassword})` }}
          aria-hidden="true"
        />
        <div className="hero">
          <img
            className="seal"
            src="https://commons.wikimedia.org/wiki/Special:FilePath/Department_of_Information_and_Communications_Technology_(DICT)_-_Seal_only.svg"
            alt="DICT Seal"
            draggable="false"
          />
          <div className="title-block">
            <div className="brand">HRMIS</div>
          </div>
        </div>
        <div className="card">
          <div className="title">Enter your Email</div>
          <div className="subtitle">The one that you use to sign in with.</div>
          <form className="form" onSubmit={submit}>
            <label>
              <span>Email</span>
              <input
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="submit" aria-label="Send">→</button>
            <div className="forgot">
              <button type="button" className="link" onClick={onBack}>Back to Login</button>
            </div>
          </form>
        </div>
        <div className="forgot-banner">
          <div>Forgot</div>
          <div>Password</div>
        </div>
        <div className="divider" />
      </div>
    </div>
  );
}

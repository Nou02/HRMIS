import React, { useEffect, useState } from 'react';
import './Login_Password.css';
import DICTPeeps from '../assets/DICTPeeps.jpg';

export default function PasswordRecovery({ onBack }) {
  const [enter, setEnter] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setEnter(true), 50);
    return () => clearTimeout(t);
  }, []);

  function submit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    alert('If this email exists, a reset link has been sent.');
  }

  return (
    <div className={`recovery ${enter ? 'enter' : ''}`}>
      <div
        className="login-bg"
        style={{
          backgroundImage: `url(${DICTPeeps})`,
          opacity: 1,
          zIndex: 0
        }}
      />
      <div className="login-overlay" style={{ opacity: 1, zIndex: 0 }} />

      <div className="stage">
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
          <div className="title">Find your Email Account</div>
          <div className="subtitle">Enter your email that you use to sign in with.</div>
          <form className="form" onSubmit={submit}>
            <label>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="submit" aria-label="Send">
              Continue
            </button>
            <div className="forgot">
              <button type="button" className="link" onClick={onBack}>
                Back to Login
              </button>
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
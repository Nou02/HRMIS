import React, { useEffect, useState } from 'react';
import './login.css';
import { API_BASE } from '../lib/api';

export default function Login({ onLogin, onForgot }) {
  const [enter, setEnter] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setEnter(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`login ${enter ? 'enter' : ''}`}>
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
            <div className="sub top">DEPARTMENT OF INFORMATION AND</div>
            <div className="sub bottom">COMMUNICATIONS TECHNOLOGY</div>
          </div>
        </div>
        <div className="card">
          <div className="title">Login</div>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              try {
                const res = await fetch(`${API_BASE}/api/auth/login`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username, password }),
                });
                const acc = await res.json();
                if (!res.ok) {
                  setError(acc.error === 'auth_db_error' ? 'Database connection error' : 'Invalid username or password');
                  return;
                }
                localStorage.setItem('hrmisUser', JSON.stringify(acc));
                onLogin?.();
              } catch (e) {
                setError('Unable to contact server');
              }
            }}
          >
            <label>
              <span>Username or Email</span>
              <input
                type="text"
                placeholder="Enter username or email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button type="submit" className="submit" aria-label="Login">→</button>
            <div className="forgot">
              <button
                type="button"
                className="link"
                onClick={() => onForgot?.()}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

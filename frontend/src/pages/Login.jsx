import React, { useEffect, useState } from 'react';
import './Login_Password.css';
import { API_BASE } from '../lib/api';
import DICTPeeps from '../assets/DICTPeeps.jpg';
import dictLogo from '../assets/DICTLogo.png'; 

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
      <div
        className="login-bg"
        style={{
          backgroundImage: `url(${DICTPeeps})`,
          opacity: 1,
          transition: 'opacity 0.5s ease',
        }}
        aria-hidden="true"
      />
      <div
        className="login-overlay"
        style={{
          opacity: 1,
          transition: 'opacity 0.5s ease',
        }}
        aria-hidden="true"
      />
      <div className="stage">
        <div className="hero">
          <img
            className="seal"
            src={dictLogo}
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
             
              if (!username.trim() || !password.trim()) return;

              try {
                const res = await fetch(`${API_BASE}/api/auth/login`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username, password }),
                });
               
                const acc = await res.json();
               
                if (!res.ok) {
                  setError('Invalid username or password. Please try again.');
                  return;
                }
               
                localStorage.setItem('hrmisUser', JSON.stringify(acc));
                onLogin?.();
              } catch (err) {
                setError('Unable to connect to the server.');
              }
            }}
          >
            <label>
              <input
                type="text"
                placeholder="Username or Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="submit" aria-label="Login">
              Login
            </button>
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
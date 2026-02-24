import React, { useEffect, useState } from 'react';
import './login.css';

export default function Login() {
  const [enter, setEnter] = useState(false);
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
          <form className="form" onSubmit={(e) => e.preventDefault()}>
            <label>
              <span>Username</span>
              <input type="text" placeholder="Enter username" />
            </label>
            <label>
              <span>Password</span>
              <input type="password" placeholder="Enter password" />
            </label>
            <button type="submit">Login</button>
          </form>
        </div>
      </div>
    </div>
  );
}

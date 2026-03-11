import React, { useEffect, useState } from 'react';
import './landing.css';

export default function Landing({ onEnter }) {
  const [enter, setEnter] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEnter(true), 30);
    return () => clearTimeout(t);
  }, []);
  const onKeyDown = (e) => (e.key === 'Enter' ? onEnter?.() : null);
  return (
    <div
      className={`landing ${enter ? 'enter' : ''}`}
      onClick={onEnter}
      role="button"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="landing-content">
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
      <div className="hint">Click anywhere to continue</div>
    </div>
  );
}

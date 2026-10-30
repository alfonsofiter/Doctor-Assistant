import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      setCurrentTime(now.toLocaleDateString('id-ID', options));
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Brand */}
        <NavLink to="/" className="navbar-brand">
          <div className="brand-logo-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 2C6.02944 2 2 6.02944 2 11C2 15.9706 6.02944 20 11 20C15.5 20 18.5 16 20 11C21.5 6 24.5 2 29 2C33.9706 2 38 6.02944 38 11C38 15.9706 33.9706 20 29 20C24.5 20 21.5 16 20 11C18.5 6 15.5 2 11 2Z" />
            </svg>
          </div>
          <div className="brand-text-block">
            <span className="brand-name">Doctor Assistant</span>
            <span className="brand-subname">Rekam Medis Otomatis</span>
          </div>
        </NavLink>

        {/* Center Pill Navigation */}
        <nav className="navbar-pill-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-pill-item ${isActive ? 'active' : ''}`}
          >
            Beranda
          </NavLink>
          <NavLink
            to="/consultation"
            className={({ isActive }) => `nav-pill-item ${isActive ? 'active' : ''}`}
          >
            Konsultasi Baru
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) => `nav-pill-item ${isActive ? 'active' : ''}`}
          >
            Riwayat Pasien
          </NavLink>
        </nav>

        {/* Right Info Cluster */}
        <div className="navbar-right-cluster">
          <div className="time-display-pill">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{currentTime || 'Hari ini'}</span>
          </div>

          <div className="user-profile-badge">
            <div className="user-avatar-initials">DR</div>
            <div className="user-meta">
              <span className="user-name">dr. Pemeriksa</span>
              <span className="user-role">Klinik Umum</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

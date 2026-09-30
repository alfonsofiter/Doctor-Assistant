import { NavLink } from 'react-router-dom';
import './Navbar.css';

function navLinkClass({ isActive }) {
  return `navbar-link${isActive ? ' active' : ''}`;
}

function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand">
          Doctor Assistant
        </NavLink>
        <nav className="navbar-links">
          <NavLink to="/" end className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/history" className={navLinkClass}>
            Riwayat
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;

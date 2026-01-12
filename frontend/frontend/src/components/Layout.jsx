import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Fungsi helper untuk mengecek menu aktif
  const isActive = (path) => location.pathname === path ? 'active' : '';

  // Toggle sidebar
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="app-container">
      {/* Floating Orbs Background */}
      <div className="floating-orb floating-orb-1"></div>
      <div className="floating-orb floating-orb-2"></div>
      <div className="floating-orb floating-orb-3"></div>
      
      {/* --- SIDEBAR --- */}
      <nav className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          {isSidebarOpen && (
            <div className="brand">
              <i className="fa-solid fa-microchip"></i> EDGE AI 
            </div>
          )}
          <button className="toggle-btn" onClick={toggleSidebar} title={isSidebarOpen ? 'Tutup Sidebar' : 'Buka Sidebar'}>
            <i className={`fa-solid ${isSidebarOpen ? 'fa-angles-left' : 'fa-angles-right'}`}></i>
          </button>
        </div>
        
        <ul className="nav-links">
          <li>
            <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`} title="Dashboard">
              <i className="fa-solid fa-chart-line"></i>
              {isSidebarOpen && <span>Dashboard</span>}
            </Link>
          </li>
          <li>
            <Link to="/history" className={`nav-link ${isActive('/history')}`} title="Riwayat">
              <i className="fa-solid fa-clock-rotate-left"></i>
              {isSidebarOpen && <span>Riwayat</span>}
            </Link>
          </li>
          <li>
            <Link to="/settings" className={`nav-link ${isActive('/settings')}`} title="Konfigurasi">
              <i className="fa-solid fa-sliders"></i>
              {isSidebarOpen && <span>Konfigurasi</span>}
            </Link>
          </li>
        </ul>
        
        <div className="user-profile">
          <div className="avatar"><i className="fa-solid fa-user"></i></div>
          {isSidebarOpen && (
            <>
              <div className="user-info">
                <h4>Admin</h4>
                <span>Operator</span>
              </div>
              <Link to="/" className="logout-btn" title="Logout">
                <i className="fa-solid fa-right-from-bracket"></i>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* --- CONTENT AREA --- */}
      <main className="main-content">
        <div className="container">
          <Outlet /> 
        </div>
      </main>
    </div>
  );
}
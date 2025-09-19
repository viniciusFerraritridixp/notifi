import { Link, useLocation } from 'react-router-dom'

function Header() {
  const location = useLocation()

  return (
    <header className="header">
      <div className="header-content">
        <h1 className="app-title">
          <span className="notification-icon">🔔</span>
          Push PWA
        </h1>
        <nav className="nav">
          <Link 
            to="/" 
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Dashboard
          </Link>
          <Link 
            to="/notifications" 
            className={`nav-link ${location.pathname === '/notifications' ? 'active' : ''}`}
          >
            Notificações
          </Link>
          <Link 
            to="/settings" 
            className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}
          >
            Configurações
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default Header
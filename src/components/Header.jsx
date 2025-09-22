import { Link, useLocation } from 'react-router-dom'

function Header() {
  const location = useLocation()

  const unlockSound = async () => {
    try {
      const url = '/sounds/cash.mp3'
      const audio = new Audio(url)
      audio.volume = 0.9
      // Tentar tocar e imediatamente pausar para criar interação
      await audio.play()
      try { audio.pause(); audio.currentTime = 0 } catch (e) {}
      sessionStorage.setItem('soundUnlocked', '1')
      alert('Sons ativados. Notificações tocarão sons quando abrirmos a aba.')
    } catch (err) {
      console.warn('Não foi possível desbloquear som automaticamente:', err)
      alert('Não foi possível ativar o som automaticamente. Interaja com a página para permitir reprodução.')
    }
  }

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
          <button className="nav-link" onClick={unlockSound} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            Ativar Som
          </button>
        </nav>
      </div>
    </header>
  )
}

export default Header
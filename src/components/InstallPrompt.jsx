import { useState, useEffect } from 'react'

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Verificar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Listener para o evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      
      // Verificar configurações do usuário
      const settings = JSON.parse(localStorage.getItem('notification-settings') || '{}')
      if (settings.autoInstall !== false) {
        setShowPrompt(true)
      }
    }

    // Listener para quando o app é instalado
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
      console.log('PWA foi instalado')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('Usuário aceitou instalar o PWA')
    } else {
      console.log('Usuário recusou instalar o PWA')
    }
    
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Não mostrar novamente por 7 dias
    localStorage.setItem('install-prompt-dismissed', Date.now().toString())
  }

  // Não mostrar se já foi dispensado recentemente
  const dismissedTime = localStorage.getItem('install-prompt-dismissed')
  if (dismissedTime) {
    const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24)
    if (daysSinceDismissed < 7) {
      return null
    }
  }

  if (isInstalled || !showPrompt) {
    return null
  }

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <div className="install-icon">📱</div>
        <div className="install-text">
          <h3>Instalar App</h3>
          <p>Adicione este app à sua tela inicial para acesso rápido e melhor experiência!</p>
        </div>
        <div className="install-actions">
          <button 
            className="btn btn-primary"
            onClick={handleInstallClick}
          >
            Instalar
          </button>
          <button 
            className="btn btn-text"
            onClick={handleDismiss}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  )
}

export default InstallPrompt
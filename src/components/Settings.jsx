import { useState, useEffect } from 'react'

function Settings({ isSupported, permission, onPermissionChange }) {
  const [settings, setSettings] = useState({
    soundEnabled: true,
    vibrationEnabled: true,
    showBadge: true,
    autoInstall: true
  })

  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    // Carregar configurações salvas
    const savedSettings = localStorage.getItem('notification-settings')
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }

    // Monitorar status online/offline
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    localStorage.setItem('notification-settings', JSON.stringify(newSettings))
  }

  const resetPermissions = async () => {
    if (confirm('Isso irá recarregar a página para resetar as permissões. Continuar?')) {
      // Limpar dados do service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (let registration of registrations) {
          registration.unregister()
        }
      }
      
      // Recarregar página
      window.location.reload()
    }
  }

  const clearCache = async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      )
      alert('Cache limpo com sucesso!')
    }
  }

  // Exportar subscription atual para arquivo JSON
  const exportSubscription = async () => {
    if (!('serviceWorker' in navigator)) {
      alert('Service Worker não está disponível neste navegador')
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        alert('Nenhuma subscription encontrada. Primeiro, conceda permissão e inscreva-se para push.')
        return
      }

      const blob = new Blob([JSON.stringify(subscription)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'subscription.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao exportar subscription', err)
      alert('Falha ao exportar subscription. Veja o console para mais detalhes.')
    }
  }

  // Copiar subscription para o clipboard
  const copySubscriptionToClipboard = async () => {
    if (!('serviceWorker' in navigator)) {
      alert('Service Worker não está disponível neste navegador')
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        alert('Nenhuma subscription encontrada. Primeiro, conceda permissão e inscreva-se para push.')
        return
      }

      await navigator.clipboard.writeText(JSON.stringify(subscription))
      alert('Subscription copiada para o clipboard. Cole em um arquivo subscription.json no servidor.')
    } catch (err) {
      console.error('Erro ao copiar subscription', err)
      alert('Falha ao copiar subscription. Veja o console para mais detalhes.')
    }
  }

  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent
    let browserName = 'Desconhecido'
    
    if (userAgent.indexOf('Chrome') > -1) browserName = 'Chrome'
    else if (userAgent.indexOf('Firefox') > -1) browserName = 'Firefox'
    else if (userAgent.indexOf('Safari') > -1) browserName = 'Safari'
    else if (userAgent.indexOf('Edge') > -1) browserName = 'Edge'
    
    return {
      name: browserName,
      userAgent,
      platform: navigator.platform,
      language: navigator.language
    }
  }

  const browserInfo = getBrowserInfo()

  return (
    <div className="settings">
      <div className="settings-header">
        <h2>Configurações</h2>
        <p>Gerencie as configurações do app e notificações</p>
      </div>

      <div className="settings-section">
        <h3>Status do Sistema</h3>
        
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Conexão:</span>
            <span className={`status-value ${isOnline ? 'online' : 'offline'}`}>
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </span>
          </div>
          
          <div className="status-item">
            <span className="status-label">Notificações:</span>
            <span className={`status-value ${isSupported ? 'supported' : 'not-supported'}`}>
              {isSupported ? '✅ Suportadas' : '❌ Não Suportadas'}
            </span>
          </div>
          
          <div className="status-item">
            <span className="status-label">Permissão:</span>
            <span className={`status-value permission-${permission}`}>
              {permission === 'granted' ? '✅ Concedida' : 
               permission === 'denied' ? '❌ Negada' : 
               '⏳ Pendente'}
            </span>
          </div>
          
          <div className="status-item">
            <span className="status-label">Service Worker:</span>
            <span className="status-value">
              {'serviceWorker' in navigator ? '✅ Ativo' : '❌ Inativo'}
            </span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Preferências de Notificação</h3>
        
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
            />
            <span>Habilitar Som</span>
          </label>
        </div>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.vibrationEnabled}
              onChange={(e) => handleSettingChange('vibrationEnabled', e.target.checked)}
            />
            <span>Habilitar Vibração</span>
          </label>
        </div>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.showBadge}
              onChange={(e) => handleSettingChange('showBadge', e.target.checked)}
            />
            <span>Mostrar Badge no Ícone</span>
          </label>
        </div>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.autoInstall}
              onChange={(e) => handleSettingChange('autoInstall', e.target.checked)}
            />
            <span>Sugerir Instalação Automaticamente</span>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>Informações do Navegador</h3>
        
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Navegador:</span>
            <span className="info-value">{browserInfo.name}</span>
          </div>
          
          <div className="info-item">
            <span className="info-label">Plataforma:</span>
            <span className="info-value">{browserInfo.platform}</span>
          </div>
          
          <div className="info-item">
            <span className="info-label">Idioma:</span>
            <span className="info-value">{browserInfo.language}</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Ações Avançadas</h3>
        
        <div className="action-buttons">
          <button 
            className="btn btn-outline"
            onClick={clearCache}
          >
            Limpar Cache
          </button>
          
          <button 
            className="btn btn-outline"
            onClick={resetPermissions}
          >
            Resetar Permissões
          </button>
          
          <button
            className="btn btn-outline"
            onClick={exportSubscription}
          >
            Exportar Subscription
          </button>

          <button
            className="btn btn-outline"
            onClick={copySubscriptionToClipboard}
          >
            Copiar Subscription
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings
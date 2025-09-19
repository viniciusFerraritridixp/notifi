import { useState } from 'react'
import NotificationForm from './NotificationForm'
import NotificationStats from './NotificationStats'
import SalesTestComponent from './SalesTestComponent'

function Dashboard({ notifications, isSupported, permission, onPermissionChange, onAddNotification }) {
  const [showForm, setShowForm] = useState(false)

  const requestPermission = async () => {
    if (!isSupported) {
      alert('Notificações não são suportadas neste navegador')
      return
    }

    try {
      const permission = await Notification.requestPermission()
      onPermissionChange(permission)
      
      if (permission === 'granted') {
        // Registrar para push notifications
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array('BEl62iUYgUivxIkv69yViEuiBIa40HI8YN1YrY-YmhS4PQlEr0f5Z5Q8QjC0WQWEj1LYNmEelk7bkVA6qZLQnV8')
        })
        
        console.log('Subscription:', subscription)
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error)
    }
  }

  const sendTestNotification = () => {
    if (permission !== 'granted') {
      alert('Permissão para notificações não concedida')
      return
    }

    const notification = new Notification('Notificação de Teste', {
      body: 'Esta é uma notificação de teste do PWA!',
      icon: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      badge: '/pwa-192x192.png'
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    onAddNotification({
      title: 'Notificação de Teste',
      body: 'Esta é uma notificação de teste do PWA!',
      type: 'test'
    })
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard de Notificações</h2>
        <p>Gerencie e envie notificações push para seu dispositivo</p>
      </div>

      <div className="status-cards">
        <div className="status-card">
          <h3>Status do Navegador</h3>
          <div className={`status-indicator ${isSupported ? 'supported' : 'not-supported'}`}>
            {isSupported ? '✅ Suportado' : '❌ Não Suportado'}
          </div>
        </div>

        <div className="status-card">
          <h3>Permissão</h3>
          <div className={`status-indicator ${permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'default'}`}>
            {permission === 'granted' ? '✅ Concedida' : 
             permission === 'denied' ? '❌ Negada' : 
             '⏳ Pendente'}
          </div>
        </div>
      </div>

      <NotificationStats notifications={notifications} />

      <div className="action-buttons">
        {permission !== 'granted' && (
          <button 
            className="btn btn-primary"
            onClick={requestPermission}
            disabled={!isSupported}
          >
            Solicitar Permissão para Notificações
          </button>
        )}

        {permission === 'granted' && (
          <>
            <button 
              className="btn btn-secondary"
              onClick={sendTestNotification}
            >
              Enviar Notificação de Teste
            </button>

            <button 
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              Nova Notificação Personalizada
            </button>
          </>
        )}
      </div>

      {showForm && (
        <NotificationForm 
          onSubmit={(data) => {
            onAddNotification(data)
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Componente de teste para o sistema de vendas */}
      <SalesTestComponent />
    </div>
  )
}

// Função auxiliar para converter chave VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default Dashboard
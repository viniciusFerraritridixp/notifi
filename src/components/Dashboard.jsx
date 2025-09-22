import { useState } from 'react'
import NotificationForm from './NotificationForm'
import NotificationStats from './NotificationStats'
import SalesTestComponent from './SalesTestComponent'
import SubscriptionDebugger from './SubscriptionDebugger'
import { notificationManager } from '../utils/notificationManager'
import supabasePushService from '../services/supabasePushService'

function Dashboard({ notifications, isSupported, permission, onPermissionChange, onAddNotification }) {
  const [showForm, setShowForm] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  const requestPermission = async () => {
    if (!isSupported) {
      alert('Notificações não são suportadas neste navegador')
      return
    }

    setIsRegistering(true)
    try {
      console.log('🔔 [Dashboard] Solicitando permissão para notificações...')
      
      // Usar o notificationManager que já tem toda a lógica
      const permission = await notificationManager.requestPermission()
      onPermissionChange(permission)
      
      if (permission === 'granted') {
        console.log('✅ [Dashboard] Permissão concedida, registrando para push...')
        
        // Registrar para push notifications usando o manager
        await notificationManager.subscribeToPush()
        
        console.log('✅ [Dashboard] Subscription registrada com sucesso!')
        
        // Inicializar o serviço de vendas
        await supabasePushService.initialize()
        
        alert('✅ Notificações configuradas com sucesso! Você receberá alertas de vendas.')
      } else {
        console.warn('⚠️ [Dashboard] Permissão negada:', permission)
      }
    } catch (error) {
      console.error('❌ [Dashboard] Erro ao configurar notificações:', error)
      alert('❌ Erro ao configurar notificações: ' + error.message)
    } finally {
      setIsRegistering(false)
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

  const checkSubscriptionStatus = async () => {
    try {
      console.log('🔍 [Dashboard] Verificando status da subscription...')
      
      // Verificar service worker primeiro
      console.log('🔧 [Dashboard] Verificando service worker...')
      if (!('serviceWorker' in navigator)) {
        console.error('❌ [Dashboard] Service Worker não suportado')
        alert('❌ Service Worker não é suportado neste navegador')
        return
      }

      const registration = await navigator.serviceWorker.ready
      console.log('📋 [Dashboard] Service Worker registration:', {
        active: !!registration.active,
        installing: !!registration.installing,
        waiting: !!registration.waiting,
        scope: registration.scope
      })

      if (!registration.active) {
        console.error('❌ [Dashboard] Service Worker não está ativo')
        alert('❌ Service Worker não está ativo. Recarregue a página.')
        return
      }

      // Verificar PushManager
      if (!('pushManager' in registration)) {
        console.error('❌ [Dashboard] PushManager não disponível')
        alert('❌ Push notifications não são suportadas')
        return
      }

      console.log('🔍 [Dashboard] Verificando subscription existente...')
      const subscription = await registration.pushManager.getSubscription()
      
      console.log('📊 [Dashboard] Resultado da verificação:', {
        hasSubscription: !!subscription,
        subscription: subscription ? {
          endpoint: subscription.endpoint,
          keys: subscription.keys ? Object.keys(subscription.keys) : 'nenhuma'
        } : null
      })

      const isSubscribed = await notificationManager.isSubscribed()
      
      console.log('📊 Status completo:', {
        isSubscribed,
        subscription: subscription ? {
          endpoint: subscription.endpoint.substring(0, 50) + '...',
          keys: subscription.keys
        } : null
      })

      if (isSubscribed && subscription) {
        alert(`✅ Subscription ativa!\n\nEndpoint: ${subscription.endpoint.substring(0, 50)}...\n\nChaves configuradas: ✅\n\nService Worker: Ativo`)
      } else {
        alert('❌ Nenhuma subscription encontrada. Clique em "Solicitar Permissão" primeiro.\n\nDetalhes no console.')
      }
    } catch (error) {
      console.error('❌ [Dashboard] Erro ao verificar subscription:', error)
      alert('❌ Erro ao verificar subscription: ' + error.message + '\n\nVeja detalhes no console.')
    }
  }

  const debugServiceWorker = async () => {
    console.log('🔧 [Dashboard] === DEBUG SERVICE WORKER ===')
    
    try {
      // 1. Verificar suporte
      console.log('1️⃣ Verificando suporte...')
      const swSupported = 'serviceWorker' in navigator
      const notificationSupported = 'Notification' in window
      const pushSupported = 'PushManager' in window
      
      console.log('📋 Suporte:', {
        serviceWorker: swSupported,
        notifications: notificationSupported,
        pushManager: pushSupported
      })

      if (!swSupported) {
        alert('❌ Service Worker não suportado')
        return
      }

      // 2. Verificar registrations
      console.log('2️⃣ Verificando registrations...')
      const registrations = await navigator.serviceWorker.getRegistrations()
      console.log('📋 Registrations encontradas:', registrations.length)
      
      registrations.forEach((reg, index) => {
        console.log(`📋 Registration ${index + 1}:`, {
          scope: reg.scope,
          active: !!reg.active,
          installing: !!reg.installing,
          waiting: !!reg.waiting,
          updateViaCache: reg.updateViaCache
        })
      })

      // 3. Verificar registration principal
      console.log('3️⃣ Verificando registration principal...')
      const registration = await navigator.serviceWorker.ready
      console.log('📋 Registration principal:', {
        scope: registration.scope,
        active: !!registration.active,
        pushManager: 'pushManager' in registration
      })

      // 4. Verificar subscription atual
      console.log('4️⃣ Verificando subscription...')
      const subscription = await registration.pushManager.getSubscription()
      console.log('📋 Subscription atual:', subscription)

      // 5. Verificar permissões
      console.log('5️⃣ Verificando permissões...')
      console.log('📋 Notification.permission:', Notification.permission)

      // 6. Resumo
      const summary = {
        serviceWorkerSupported: swSupported,
        notificationSupported: notificationSupported,
        pushSupported: pushSupported,
        registrationsCount: registrations.length,
        hasActiveWorker: !!registration.active,
        hasSubscription: !!subscription,
        notificationPermission: Notification.permission
      }

      console.log('📊 === RESUMO DEBUG ===', summary)
      
      const summaryText = Object.entries(summary)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
      
      alert(`🔧 Debug Service Worker:\n\n${summaryText}\n\nVeja detalhes completos no console.`)
      
    } catch (error) {
      console.error('💥 [Dashboard] Erro no debug:', error)
      alert('❌ Erro no debug: ' + error.message)
    }
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
            disabled={!isSupported || isRegistering}
          >
            {isRegistering ? '⏳ Configurando...' : 'Solicitar Permissão para Notificações'}
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

            <button 
              className="btn btn-info"
              onClick={checkSubscriptionStatus}
            >
              Verificar Status da Subscription
            </button>

            <button 
              className="btn btn-warning"
              onClick={debugServiceWorker}
            >
              🔧 Debug Service Worker
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

      {/* Componente de debug para subscription */}
      <SubscriptionDebugger />

      {/* Componente de teste para o sistema de vendas */}
      <SalesTestComponent />
    </div>
  )
}

export default Dashboard
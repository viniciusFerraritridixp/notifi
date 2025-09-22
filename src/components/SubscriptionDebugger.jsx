import React, { useState } from 'react'
import { notificationManager } from '../utils/notificationManager.js'

const SubscriptionDebugger = () => {
  const [logs, setLogs] = useState([])
  const [isTestingEnvironment, setIsTestingEnvironment] = useState(false)
  const [isTestingSubscription, setIsTestingSubscription] = useState(false)
  const [isTestingDatabase, setIsTestingDatabase] = useState(false)

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { message, type, timestamp }])
  }

  const clearLogs = () => {
    setLogs([])
  }

  const testEnvironment = async () => {
    setIsTestingEnvironment(true)
    addLog('🔍 Iniciando teste de ambiente...')

    try {
      // Test 1: Service Worker
      if ('serviceWorker' in navigator) {
        addLog('✅ Service Worker suportado', 'success')
      } else {
        addLog('❌ Service Worker NÃO suportado', 'error')
      }

      // Test 2: Push API
      if ('PushManager' in window) {
        addLog('✅ Push API suportada', 'success')
      } else {
        addLog('❌ Push API NÃO suportada', 'error')
      }

      // Test 3: Notifications
      if ('Notification' in window) {
        addLog('✅ Notifications API suportada', 'success')
        addLog(`📱 Permissão atual: ${Notification.permission}`)
      } else {
        addLog('❌ Notifications API NÃO suportada', 'error')
      }

      // Test 4: HTTPS
      if (location.protocol === 'https:' || location.hostname === 'localhost') {
        addLog('✅ Protocolo seguro (HTTPS ou localhost)', 'success')
      } else {
        addLog('❌ Protocolo inseguro - Push não funcionará', 'error')
      }

      // Test 5: User Agent
      addLog(`🔍 User Agent: ${navigator.userAgent}`)

      // Test 6: VAPID Keys
      try {
        const vapidResponse = await fetch('/vapid-keys.json')
        if (vapidResponse.ok) {
          const vapidData = await vapidResponse.json()
          if (vapidData.publicKey) {
            addLog('✅ VAPID keys encontradas', 'success')
            addLog(`🔑 Public Key: ${vapidData.publicKey.substring(0, 50)}...`)
          } else {
            addLog('❌ VAPID public key não encontrada', 'error')
          }
        } else {
          addLog('❌ Arquivo vapid-keys.json não encontrado', 'error')
        }
      } catch (error) {
        addLog(`❌ Erro ao carregar VAPID keys: ${error.message}`, 'error')
      }

    } catch (error) {
      addLog(`❌ Erro no teste de ambiente: ${error.message}`, 'error')
    } finally {
      setIsTestingEnvironment(false)
    }
  }

  const testSubscription = async () => {
    setIsTestingSubscription(true)
    addLog('🔍 Iniciando teste de subscription...')

    try {
      // Test permission first
      const permission = await Notification.requestPermission()
      addLog(`📱 Permissão: ${permission}`)

      if (permission !== 'granted') {
        addLog('❌ Permissão de notificação negada', 'error')
        return
      }

      // Test service worker registration
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        addLog('❌ Service Worker não registrado', 'error')
        return
      }
      addLog('✅ Service Worker registrado', 'success')

      // Test VAPID key loading
      const vapidResponse = await fetch('/vapid-keys.json')
      const vapidData = await vapidResponse.json()
      const publicKey = vapidData.publicKey

      if (!publicKey) {
        addLog('❌ VAPID public key não encontrada', 'error')
        return
      }

      addLog('✅ VAPID key carregada', 'success')

      // Test subscription creation
      addLog('🔄 Criando subscription...')
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      })

      addLog('✅ Subscription criada com sucesso!', 'success')
      addLog(`📍 Endpoint: ${subscription.endpoint.substring(0, 50)}...`)

      // Test subscription keys
      if (subscription.keys) {
        addLog('✅ Subscription keys encontradas', 'success')
        if (subscription.keys.p256dh) {
          addLog(`🔑 p256dh: ${subscription.keys.p256dh.substring(0, 20)}...`, 'success')
        } else {
          addLog('❌ p256dh key NÃO encontrada', 'error')
        }
        if (subscription.keys.auth) {
          addLog(`🔐 auth: ${subscription.keys.auth.substring(0, 20)}...`, 'success')
        } else {
          addLog('❌ auth key NÃO encontrada', 'error')
        }
      } else {
        addLog('❌ Subscription keys são UNDEFINED!', 'error')
        addLog('🔍 Subscription object:', 'warning')
        addLog(JSON.stringify(subscription, null, 2), 'warning')
      }

      // Test using notification manager
      addLog('🔄 Testando com notificationManager...')
      const managerSubscription = await notificationManager.getCurrentSubscription()
      
      if (managerSubscription) {
        addLog('✅ NotificationManager retornou subscription', 'success')
        if (managerSubscription.keys) {
          addLog('✅ NotificationManager subscription tem keys', 'success')
        } else {
          addLog('❌ NotificationManager subscription SEM keys', 'error')
        }
      } else {
        addLog('❌ NotificationManager não retornou subscription', 'error')
      }

    } catch (error) {
      addLog(`❌ Erro no teste de subscription: ${error.message}`, 'error')
      addLog(`📝 Stack: ${error.stack}`, 'error')
    } finally {
      setIsTestingSubscription(false)
    }
  }

  const testDatabase = async () => {
    setIsTestingDatabase(true)
    addLog('🔍 Iniciando teste de database...')

    try {
      // Verificar subscription atual
      const subscription = await notificationManager.getCurrentSubscription()

      if (!subscription) {
        addLog('❌ Nenhuma subscription encontrada para salvar', 'error')
        return
      }

      // Importar o serviço
      const { default: supabasePushService } = await import('../services/supabasePushService.js')

      addLog('📡 Tentando salvar subscription no database...')

      const result = await supabasePushService.registerSubscription(subscription)

      if (result.success) {
        addLog('✅ Subscription salva com sucesso no database!', 'success')
        addLog(`🆔 ID: ${result.data?.id}`)
      } else {
        addLog(`❌ Erro ao salvar: ${result.error}`, 'error')
      }

    } catch (error) {
      addLog(`❌ Erro no teste de database: ${error.message}`, 'error')
    } finally {
      setIsTestingDatabase(false)
    }
  }

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: 'monospace'
    }}>
      <h2>🔧 Subscription Debugger</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testEnvironment}
          disabled={isTestingEnvironment}
          style={{ 
            marginRight: '10px', 
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isTestingEnvironment ? 'not-allowed' : 'pointer'
          }}
        >
          {isTestingEnvironment ? '🔄 Testando...' : '🔍 Testar Ambiente'}
        </button>

        <button 
          onClick={testSubscription}
          disabled={isTestingSubscription}
          style={{ 
            marginRight: '10px', 
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isTestingSubscription ? 'not-allowed' : 'pointer'
          }}
        >
          {isTestingSubscription ? '🔄 Testando...' : '📱 Testar Subscription'}
        </button>

        <button 
          onClick={testDatabase}
          disabled={isTestingDatabase}
          style={{ 
            marginRight: '10px', 
            padding: '10px 20px',
            backgroundColor: '#ffc107',
            color: 'black',
            border: 'none',
            borderRadius: '5px',
            cursor: isTestingDatabase ? 'not-allowed' : 'pointer'
          }}
        >
          {isTestingDatabase ? '🔄 Testando...' : '💾 Testar Database'}
        </button>

        <button 
          onClick={clearLogs}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🗑️ Limpar Logs
        </button>
      </div>

      <div style={{ 
        border: '1px solid #ccc', 
        borderRadius: '5px', 
        padding: '15px',
        backgroundColor: '#f8f9fa',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        <h3>📊 Logs de Debug</h3>
        {logs.length === 0 ? (
          <p>Nenhum log ainda. Clique em um dos botões acima para começar os testes.</p>
        ) : (
          logs.map((log, index) => (
            <div 
              key={index} 
              style={{ 
                marginBottom: '5px',
                padding: '5px',
                borderRadius: '3px',
                backgroundColor: log.type === 'error' ? '#ffe6e6' : 
                               log.type === 'success' ? '#e6ffe6' : 
                               log.type === 'warning' ? '#fff3cd' : 'transparent'
              }}
            >
              <span style={{ color: '#666', fontSize: '0.8em' }}>
                [{log.timestamp}]
              </span>{' '}
              <span style={{ 
                color: log.type === 'error' ? '#dc3545' : 
                       log.type === 'success' ? '#28a745' : 
                       log.type === 'warning' ? '#ffc107' : '#333'
              }}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default SubscriptionDebugger
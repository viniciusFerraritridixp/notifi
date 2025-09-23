import React, { useState } from 'react'
import { notificationManager } from '../utils/notificationManager.js'

const SubscriptionDebugger = () => {
  const [logs, setLogs] = useState([])
  const [isTestingEnvironment, setIsTestingEnvironment] = useState(false)
  const [isTestingSubscription, setIsTestingSubscription] = useState(false)
  const [isTestingDatabase, setIsTestingDatabase] = useState(false)
  const [isTestingHybrid, setIsTestingHybrid] = useState(false)

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
        addLog('🔄 Carregando VAPID keys...')
        
        // Tentar diferentes caminhos
        const possiblePaths = [
          '/vapid-keys.json',
          './vapid-keys.json', 
          'vapid-keys.json',
          '/public/vapid-keys.json'
        ]
        
        let vapidData = null
        let successPath = null
        
        for (const path of possiblePaths) {
          try {
            addLog(`🔄 Tentando path: ${path}`)
            const vapidResponse = await fetch(path)
            addLog(`📡 Response status para ${path}: ${vapidResponse.status}`)
            
            if (vapidResponse.ok) {
              const responseText = await vapidResponse.text()
              addLog(`📄 Response text preview: ${responseText.substring(0, 100)}...`)
              
              // Verificar se é JSON válido
              if (responseText.trim().startsWith('{')) {
                vapidData = JSON.parse(responseText)
                successPath = path
                break
              } else {
                addLog(`⚠️ ${path} retornou HTML em vez de JSON`, 'warning')
              }
            }
          } catch (pathError) {
            addLog(`❌ Erro no path ${path}: ${pathError.message}`, 'warning')
          }
        }
        
        if (vapidData && vapidData.publicKey) {
          addLog(`✅ VAPID keys encontradas em: ${successPath}`, 'success')
          addLog(`🔑 Public Key: ${vapidData.publicKey.substring(0, 50)}...`)
        } else {
          addLog('❌ VAPID keys não encontradas em nenhum path', 'error')
          
          // Fallback: usar chave hardcoded
          addLog('🔄 Usando chave VAPID hardcoded como fallback...', 'warning')
          const fallbackKey = 'BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o'
          addLog(`🔑 Fallback Key: ${fallbackKey.substring(0, 50)}...`, 'warning')
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
      addLog('🔄 Carregando VAPID keys para subscription...')
      
      // Tentar carregar VAPID keys
      let publicKey = null
      const possiblePaths = ['/vapid-keys.json', './vapid-keys.json', 'vapid-keys.json']
      
      for (const path of possiblePaths) {
        try {
          const vapidResponse = await fetch(path)
          
          if (vapidResponse.ok) {
            const responseText = await vapidResponse.text()
            
            if (responseText.trim().startsWith('{')) {
              const vapidData = JSON.parse(responseText)
              if (vapidData.publicKey) {
                publicKey = vapidData.publicKey
                addLog(`✅ VAPID key carregada de: ${path}`, 'success')
                break
              }
            }
          }
        } catch (error) {
          // Continuar tentando outros paths
        }
      }

      // Fallback para chave hardcoded
      if (!publicKey) {
        publicKey = 'BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o'
        addLog('⚠️ Usando chave VAPID hardcoded', 'warning')
      }

      // Test subscription creation
      addLog('🔄 Criando subscription...')

      // Converter a chave VAPID para Uint8Array se necessário
      let applicationServerKey = publicKey
      try {
        if (typeof publicKey === 'string') {
          applicationServerKey = notificationManager.urlBase64ToUint8Array(publicKey)
          addLog('🔑 VAPID convertida para Uint8Array', 'info')
        }
      } catch (e) {
        addLog('❌ Erro ao converter VAPID key: ' + e.message, 'error')
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
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
      let managerSubscription = await notificationManager.getCurrentSubscription()

      // Garantir que a subscription retornada pelo manager esteja normalizada
      if (notificationManager.normalizeSubscription) {
        managerSubscription = notificationManager.normalizeSubscription(managerSubscription)
      }
      
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

  const testHybridSystem = async () => {
    setIsTestingHybrid(true)
    addLog('🚀 Iniciando teste do sistema híbrido...')

    try {
      // Importar o sistema híbrido
      const { default: hybridNotificationManager } = await import('../utils/hybridNotificationManager.js')
      
      addLog('✅ Sistema híbrido carregado', 'success')

      // Obter informações do dispositivo
      const deviceInfo = hybridNotificationManager.getDeviceInfo()
      addLog(`📱 Device Token: ${deviceInfo.deviceToken || 'Não gerado'}`)
      addLog(`🍎 iOS: ${deviceInfo.isIOS ? 'Sim' : 'Não'}`)
      addLog(`📱 Mobile: ${deviceInfo.isMobile ? 'Sim' : 'Não'}`)
      addLog(`🔧 Estratégias: ${deviceInfo.strategies.join(', ')}`)

      // Inicializar o sistema
      addLog('🔄 Inicializando sistema híbrido...')
      const result = await hybridNotificationManager.initialize()

      if (result.deviceToken) {
        addLog(`✅ Device Token: ${result.deviceToken}`, 'success')
      }

      if (result.webPush) {
        addLog('✅ Web Push configurado', 'success')
      } else {
        addLog('⚠️ Web Push não disponível - usando fallback', 'warning')
      }

      addLog(`🎯 Estratégias ativas: ${result.strategies.join(', ')}`, 'success')

      if (result.errors.length > 0) {
        result.errors.forEach(error => {
          addLog(`❌ Erro em ${error.strategy}: ${error.error}`, 'error')
        })
      }

      addLog('✅ Sistema híbrido inicializado com sucesso!', 'success')

      // Testar envio de notificação
      addLog('🔄 Testando envio de notificação...')
      
      const testNotification = {
        title: 'Teste do Sistema Híbrido',
        body: 'Esta é uma notificação de teste do sistema híbrido',
        icon: '/icon.svg',
        badge: '/pwa-64x64.png',
        timestamp: new Date().toISOString()
      }

      // Simular envio para o próprio device token
      if (result.deviceToken) {
        const { default: supabasePushService } = await import('../services/supabasePushService.js')
        
        const sendResult = await supabasePushService.sendNotificationToDeviceTokens(
          [result.deviceToken], 
          testNotification
        )

        if (sendResult.success) {
          addLog('✅ Notificação enviada com sucesso!', 'success')
          sendResult.results.forEach(res => {
            if (res.success) {
              addLog(`✅ ${res.deviceToken}: OK`, 'success')
            } else {
              addLog(`❌ ${res.deviceToken}: ${res.error}`, 'error')
            }
          })
        } else {
          addLog(`❌ Erro ao enviar: ${sendResult.error}`, 'error')
        }
      }

    } catch (error) {
      addLog(`❌ Erro no teste híbrido: ${error.message}`, 'error')
      addLog(`📝 Stack: ${error.stack}`, 'error')
    } finally {
      setIsTestingHybrid(false)
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
          onClick={testHybridSystem}
          disabled={isTestingHybrid}
          style={{ 
            marginRight: '10px', 
            padding: '10px 20px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isTestingHybrid ? 'not-allowed' : 'pointer'
          }}
        >
          {isTestingHybrid ? '🔄 Testando...' : '🚀 Testar Sistema Híbrido'}
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
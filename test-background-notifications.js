// Teste de notificações em background
// Execute este arquivo no console do navegador para testar

class BackgroundNotificationTester {
  constructor() {
    this.testResults = []
  }

  async runAllTests() {
    console.log('🧪 Iniciando testes de notificação em background...')
    
    await this.testServiceWorkerRegistration()
    await this.testPushSubscription()
    await this.testBackgroundSync()
    await this.testManualPushNotification()
    
    this.displayResults()
  }

  async testServiceWorkerRegistration() {
    console.log('📝 Teste 1: Verificando registro do Service Worker...')
    
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker não suportado')
      }

      const registration = await navigator.serviceWorker.getRegistration()
      
      if (!registration) {
        throw new Error('Service Worker não está registrado')
      }

      if (registration.active) {
        this.testResults.push({
          test: 'Service Worker Registration',
          status: 'PASS',
          message: 'Service Worker ativo e funcionando'
        })
      } else {
        throw new Error('Service Worker registrado mas não ativo')
      }

    } catch (error) {
      this.testResults.push({
        test: 'Service Worker Registration',
        status: 'FAIL',
        message: error.message
      })
    }
  }

  async testPushSubscription() {
    console.log('📝 Teste 2: Verificando inscrição para push notifications...')
    
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      
      if (!registration) {
        throw new Error('Service Worker não registrado')
      }

      // Verificar se há inscrição existente
      let subscription = await registration.pushManager.getSubscription()
      
      if (!subscription) {
        // Tentar criar nova inscrição
        const vapidPublicKey = await this.getVapidKey()
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
        })
      }

      if (subscription) {
        this.testResults.push({
          test: 'Push Subscription',
          status: 'PASS',
          message: 'Inscrição para push notifications ativa'
        })
      } else {
        throw new Error('Não foi possível criar inscrição para push')
      }

    } catch (error) {
      this.testResults.push({
        test: 'Push Subscription',
        status: 'FAIL',
        message: error.message
      })
    }
  }

  async testBackgroundSync() {
    console.log('📝 Teste 3: Verificando suporte a Background Sync...')
    
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      
      if (!registration) {
        throw new Error('Service Worker não registrado')
      }

      if ('sync' in registration) {
        // Tentar registrar um background sync
        await registration.sync.register('test-background-sync')
        
        this.testResults.push({
          test: 'Background Sync',
          status: 'PASS',
          message: 'Background Sync suportado e registrado'
        })
      } else {
        throw new Error('Background Sync não suportado')
      }

    } catch (error) {
      this.testResults.push({
        test: 'Background Sync',
        status: 'FAIL',
        message: error.message
      })
    }
  }

  async testManualPushNotification() {
    console.log('📝 Teste 4: Enviando notificação de teste...')
    
    try {
      // Verificar permissão de notificação
      let permission = Notification.permission
      
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }
      
      if (permission !== 'granted') {
        throw new Error('Permissão para notificações negada')
      }

      // Enviar notificação de teste via Service Worker
      const registration = await navigator.serviceWorker.getRegistration()
      
      if (!registration) {
        throw new Error('Service Worker não registrado')
      }

      // Simular push event
      await registration.showNotification('Teste de Notificação em Background', {
        body: 'Esta é uma notificação de teste para verificar funcionamento em background',
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        tag: 'test-notification',
        requireInteraction: true,
        actions: [
          {
            action: 'test',
            title: 'Teste OK'
          }
        ]
      })

      this.testResults.push({
        test: 'Manual Push Notification',
        status: 'PASS',
        message: 'Notificação de teste enviada com sucesso'
      })

    } catch (error) {
      this.testResults.push({
        test: 'Manual Push Notification',
        status: 'FAIL',
        message: error.message
      })
    }
  }

  async getVapidKey() {
    try {
      const response = await fetch('/vapid-keys.json')
      if (!response.ok) throw new Error('Erro ao buscar chaves VAPID')
      
      const keys = await response.json()
      return keys.publicKey
    } catch (error) {
      console.warn('Usando chave VAPID padrão')
      return 'BM0lPTJoWYZGnDeJ-9PoRNGXGl8vP3kaTv0XSgE6fz8Y-6LI4ZVZPnHZVyIFd8YMjNdNFvwt4IQX8Mze5Vc_dz8'
    }
  }

  urlBase64ToUint8Array(base64String) {
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

  displayResults() {
    console.log('\n🎯 RESULTADOS DOS TESTES:')
    console.log('=' * 50)
    
    let passCount = 0
    let failCount = 0
    
    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌'
      console.log(`${status} ${result.test}: ${result.message}`)
      
      if (result.status === 'PASS') passCount++
      else failCount++
    })
    
    console.log('\n📊 RESUMO:')
    console.log(`✅ Testes passaram: ${passCount}`)
    console.log(`❌ Testes falharam: ${failCount}`)
    
    if (failCount === 0) {
      console.log('🎉 Todos os testes passaram! Notificações em background devem funcionar.')
    } else {
      console.log('⚠️  Alguns testes falharam. Verifique a configuração.')
    }

    return this.testResults
  }

  // Método para testar com app "fechado" (apenas oculto)
  async testWithHiddenApp() {
    console.log('🕶️  Simulando app em background...')
    
    // Esconder a janela (simular app fechado)
    document.hidden = true
    
    // Aguardar um momento
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Enviar notificação de teste
    await this.testManualPushNotification()
    
    // Restaurar visibilidade
    document.hidden = false
    
    console.log('✅ Teste com app em background concluído')
  }
}

// Como usar:
// const tester = new BackgroundNotificationTester()
// await tester.runAllTests()

// Para testar com app "fechado":
// await tester.testWithHiddenApp()

// Disponibilizar globalmente para facilitar uso no console
window.NotificationTester = BackgroundNotificationTester

console.log('🔧 BackgroundNotificationTester carregado!')
console.log('📝 Para executar os testes, use:')
console.log('   const tester = new NotificationTester()')
console.log('   await tester.runAllTests()')
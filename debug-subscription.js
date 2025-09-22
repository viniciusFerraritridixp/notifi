// Script para testar subscription diretamente no console
// Cole este código no DevTools para testar

async function testSubscriptionKeys() {
  console.log('🧪 === TESTE DIRETO DE SUBSCRIPTION ===')
  
  try {
    // 1. Verificar service worker
    console.log('1️⃣ Verificando Service Worker...')
    const registration = await navigator.serviceWorker.ready
    console.log('✅ SW pronto:', registration.scope)
    
    // 2. Remover subscription existente se houver
    console.log('2️⃣ Verificando subscription existente...')
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      console.log('🗑️ Removendo subscription existente...')
      await existing.unsubscribe()
      console.log('✅ Subscription existente removida')
    }
    
    // 3. Criar nova subscription com debugging
    console.log('3️⃣ Criando nova subscription...')
    
    const vapidKey = 'BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o'
    
    // Converter VAPID key
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
    
    const applicationServerKey = urlBase64ToUint8Array(vapidKey)
    console.log('🔑 Application server key:', applicationServerKey)
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    })
    
    console.log('✅ Subscription criada!')
    console.log('📊 Detalhes completos:', subscription)
    console.log('🔑 Keys:', subscription.keys)
    console.log('🔍 Keys detalhadas:', {
      hasKeys: !!subscription.keys,
      keysType: typeof subscription.keys,
      p256dh: subscription.keys?.p256dh,
      auth: subscription.keys?.auth
    })
    
    // 4. Verificar se as chaves são acessíveis
    if (subscription.keys) {
      console.log('✅ Chaves encontradas!')
      console.log('📝 p256dh:', subscription.keys.p256dh)
      console.log('📝 auth:', subscription.keys.auth)
    } else {
      console.error('❌ Chaves não encontradas!')
    }
    
    return subscription
    
  } catch (error) {
    console.error('💥 Erro no teste:', error)
    throw error
  }
}

// Executar o teste
testSubscriptionKeys().then(sub => {
  console.log('🎉 Teste concluído! Subscription:', sub)
}).catch(err => {
  console.error('🚨 Teste falhou:', err)
})
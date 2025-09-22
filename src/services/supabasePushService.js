import { supabase } from '../lib/supabase-safe.js'

class SupabasePushNotificationService {
  constructor() {
    this.subscription = null
    this.realtimeChannel = null
  }

  // Registrar device token no Supabase
  async registerDeviceToken(deviceInfo) {
    try {
      console.log('🔄 [SupabasePush] Registrando device token...')
      console.log('📝 [SupabasePush] Device info:', deviceInfo)

      // Preparar dados do dispositivo
      const deviceData = {
        device_token: deviceInfo.deviceToken,
        user_agent: deviceInfo.userAgent,
        platform: deviceInfo.platform,
        is_ios: deviceInfo.isIOS,
        is_mobile: deviceInfo.isMobile,
        language: deviceInfo.language,
        timezone: deviceInfo.timezone,
        screen_resolution: deviceInfo.screen,
        strategies: deviceInfo.strategies,
        web_push_endpoint: deviceInfo.webPushSubscription?.endpoint || null,
        web_push_p256dh: deviceInfo.webPushSubscription?.keys?.p256dh || null,
        web_push_auth: deviceInfo.webPushSubscription?.keys?.auth || null,
        registration_url: deviceInfo.url,
        is_active: true,
        last_seen: new Date().toISOString()
      }

      console.log('📦 [SupabasePush] Dados do device token:', deviceData)

      // Inserir ou atualizar no banco
      const { data, error } = await supabase
        .from('device_registrations')
        .upsert(deviceData, {
          onConflict: 'device_token'
        })
        .select()

      if (error) {
        console.error('❌ [SupabasePush] Erro ao registrar device token:', error)
        throw error
      }

      console.log('✅ [SupabasePush] Device token registrado:', data?.[0]?.id)

      return {
        success: true,
        data: data?.[0],
        message: 'Device token registrado com sucesso'
      }

    } catch (error) {
      console.error('❌ [SupabasePush] Erro no registro:', error)
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao registrar device token'
      }
    }
  }

  // Registrar subscription no Supabase
  async registerSubscription(subscription) {
    try {
      console.log('🔄 [SupabasePush] Iniciando registro da subscription...')
      console.log('📝 [SupabasePush] Dados da subscription:', {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      })

      // Função utilitária: ArrayBuffer -> base64
      const arrayBufferToBase64 = (buffer) => {
        try {
          const bytes = new Uint8Array(buffer)
          let binary = ''
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          return btoa(binary)
        } catch (e) {
          console.warn('[SupabasePush] Falha ao converter ArrayBuffer para base64', e)
          return null
        }
      }

      // Tentativa robusta de extrair chaves (alguns navegadores não expõem subscription.keys diretamente)
      let p256dh = null
      let auth = null

      if (subscription.keys && (subscription.keys.p256dh || subscription.keys.auth)) {
        p256dh = subscription.keys.p256dh
        auth = subscription.keys.auth
      } else if (subscription.getKey && typeof subscription.getKey === 'function') {
        try {
          const pKey = subscription.getKey('p256dh')
          const aKey = subscription.getKey('auth')
          if (pKey) p256dh = arrayBufferToBase64(pKey)
          if (aKey) auth = arrayBufferToBase64(aKey)
        } catch (e) {
          console.warn('[SupabasePush] Erro ao chamar getKey():', e)
        }
      } else if (subscription.p256dh && subscription.auth) {
        // Caso já venha num formato plano
        p256dh = subscription.p256dh
        auth = subscription.auth
      }

      // Verificar resultado final
      if (!p256dh || !auth) {
        console.error('❌ [SupabasePush] Subscription não tem chaves! Detalhes:', subscription)
        throw new Error('Subscription inválida: chaves de criptografia não encontradas')
      }

      const subscriptionData = {
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent
      }

      console.log('📦 [SupabasePush] Dados que serão salvos:', subscriptionData)

      // Garantir que a subscription seja marcada como ativa e não haja duplicatas
      const payload = { ...subscriptionData, is_active: true }

      console.log('🚀 [SupabasePush] Enviando para Supabase...')

      const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert(payload, {
          onConflict: 'endpoint'
        })
        .select()

      if (error) {
        console.error('❌ [SupabasePush] Erro ao registrar subscription:', error)
        console.error('❌ [SupabasePush] Detalhes do erro:', JSON.stringify(error, null, 2))
        throw error
      }

      console.log('✅ [SupabasePush] Subscription registrada com sucesso!')
      console.log('📊 [SupabasePush] Dados retornados:', data)
      
      this.subscription = subscription
      
      return {
        success: true,
        data: data?.[0],
        message: 'Subscription registrada com sucesso'
      }
    } catch (error) {
      console.error('💥 [SupabasePush] Erro geral ao registrar subscription:', error)
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao registrar subscription'
      }
    }
  }

  // Enviar notificação para device tokens específicos
  async sendNotificationToDeviceTokens(deviceTokens, notification) {
    try {
      console.log('📤 [SupabasePush] Enviando para device tokens:', deviceTokens.length)
      
      const results = []
      
      for (const deviceToken of deviceTokens) {
        try {
          // Buscar informações do dispositivo
          const { data: device, error } = await supabase
            .from('device_registrations')
            .select('*')
            .eq('device_token', deviceToken)
            .eq('is_active', true)
            .single()

          if (error || !device) {
            console.warn(`⚠️ Device token não encontrado: ${deviceToken}`)
            results.push({ deviceToken, success: false, error: 'Device not found' })
            continue
          }

          // Estratégia baseada no dispositivo
          let notificationResult = null

          if (device.web_push_endpoint && device.web_push_p256dh && device.web_push_auth) {
            // Usar Web Push se disponível
            console.log(`📲 [SupabasePush] Usando Web Push para ${deviceToken}`)
            notificationResult = await this.sendWebPushNotification(device, notification)
          } else if (device.is_ios) {
            // Estratégia específica para iOS
            console.log(`🍎 [SupabasePush] Estratégia iOS para ${deviceToken}`)
            notificationResult = await this.sendIOSFallbackNotification(device, notification)
          } else {
            // Fallback genérico
            console.log(`📱 [SupabasePush] Fallback genérico para ${deviceToken}`)
            notificationResult = await this.sendFallbackNotification(device, notification)
          }

          results.push({
            deviceToken,
            success: notificationResult.success,
            error: notificationResult.error
          })

        } catch (error) {
          console.error(`❌ Erro ao enviar para ${deviceToken}:`, error)
          results.push({ deviceToken, success: false, error: error.message })
        }
      }

      return {
        success: true,
        results,
        message: `Processados ${results.length} device tokens`
      }

    } catch (error) {
      console.error('❌ [SupabasePush] Erro ao enviar notificações:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Enviar Web Push para dispositivo
  async sendWebPushNotification(device, notification) {
    try {
      // Aqui você chamaria sua Edge Function ou serviço backend
      // que tem as chaves VAPID privadas para enviar o push
      
      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: device.web_push_endpoint,
          p256dh: device.web_push_p256dh,
          auth: device.web_push_auth,
          notification
        })
      })

      if (response.ok) {
        return { success: true }
      } else {
        return { success: false, error: 'Push server error' }
      }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Estratégia específica para iOS
  async sendIOSFallbackNotification(device, notification) {
    try {
      // Para iOS, podemos usar estratégias como:
      // 1. Server-Sent Events
      // 2. Polling em background
      // 3. Notificação local quando o app abrir
      
      // Salvar notificação para entrega quando o dispositivo conectar
      const { data, error } = await supabase
        .from('pending_notifications')
        .insert({
          device_token: device.device_token,
          notification_data: notification,
          created_at: new Date().toISOString(),
          delivery_method: 'ios_fallback'
        })

      if (error) {
        return { success: false, error: error.message }
      }

      // Tentar entrega imediata via SSE se o dispositivo estiver online
      // (implementar posteriormente)

      return { success: true, method: 'queued_for_ios' }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Fallback genérico
  async sendFallbackNotification(device, notification) {
    try {
      // Salvar para entrega posterior
      const { data, error } = await supabase
        .from('pending_notifications')
        .insert({
          device_token: device.device_token,
          notification_data: notification,
          created_at: new Date().toISOString(),
          delivery_method: 'fallback'
        })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, method: 'queued' }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Remover subscription do Supabase
  async unregisterSubscription(subscription) {
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('endpoint', subscription.endpoint)

      if (error) {
        console.error('Erro ao desregistrar subscription:', error)
        throw error
      }

      // opcional: remover entradas antigas com o mesmo endpoint
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint)

      if (deleteError) {
        console.error('Erro ao deletar subscription:', deleteError)
        throw deleteError
      }

      console.log('Subscription desregistrada com sucesso')
      this.subscription = null
    } catch (error) {
      console.error('Erro ao desregistrar subscription:', error)
      throw error
    }
  }

  // Configurar listener para vendas em tempo real
  setupSalesListener() {
    console.log('🔧 Configurando listener de vendas...')
    
    // Evitar múltiplas tentativas de conexão
    if (this.realtimeChannel) {
      console.log('🔄 Canal Real-time já existe, removendo antes de recriar...')
      supabase.removeChannel(this.realtimeChannel)
      this.realtimeChannel = null
    }
    
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5
    
    // Configurar canal Real-time para monitorar eventos de vendas
    this.realtimeChannel = supabase
      .channel('sales-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales_events'
        },
        (payload) => {
          console.log('🔔 Novo evento de venda detectado:', payload.new)
          this.handleSaleEvent(payload.new)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vendas'
        },
        (payload) => {
          console.log('💰 Nova venda detectada (direto):', payload.new)
          this.handleNewSale(payload.new)
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do Real-time:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time conectado com sucesso!')
          reconnectAttempts = 0 // Reset contador em caso de sucesso
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro no canal Real-time')
          reconnectAttempts++
          
          if (reconnectAttempts >= maxReconnectAttempts) {
            console.error(`❌ Máximo de ${maxReconnectAttempts} tentativas de reconexão atingido. Parando tentativas.`)
            this.disconnect()
            return
          }
          
          // Tentar reconectar após um delay
          setTimeout(() => {
            console.log(`🔄 Tentativa de reconexão ${reconnectAttempts}/${maxReconnectAttempts}...`)
            this.setupSalesListener()
          }, Math.min(1000 * Math.pow(2, reconnectAttempts), 10000)) // Backoff exponencial com limite
        } else if (status === 'TIMED_OUT') {
          console.warn('⏰ Timeout na conexão Real-time')
        }
      })
  }

  // Processar evento de venda da tabela sales_events
  async handleSaleEvent(saleEvent) {
    try {
      console.log('🔔 Processando evento de venda:', saleEvent)
      
      // Se for um teste de Real-time
      if (saleEvent.event_type === 'teste_realtime') {
        console.log('📡 Teste de Real-time detectado!')
        alert('✅ Real-time funcionando! Evento detectado: ' + saleEvent.produto)
        return
      }
      
      // Buscar dados completos da venda
      const { data: venda, error: vendaError } = await supabase
        .from('vendas')
        .select('*')
        .eq('id', saleEvent.sale_id)
        .single()

      if (vendaError) {
        console.error('Erro ao buscar dados da venda:', vendaError)
        return
      }

      console.log('💰 Processando venda real:', venda)

      // Processar como uma venda normal
      await this.handleNewSale(venda)

      // Marcar evento como processado
      await supabase
        .from('sales_events')
        .update({ processed: true })
        .eq('id', saleEvent.id)
        .catch(err => console.log('Erro ao marcar evento como processado:', err))

    } catch (error) {
      console.error('Erro ao processar evento de venda:', error)
    }
  }

  // Processar nova venda e exibir notificação local
  async handleNewSale(venda) {
    try {
      console.log('🎯 Iniciando processamento de venda:', venda)
      
      // Buscar configurações de notificação
      const { data: settings, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('tipo_notificacao', 'venda_realizada')
        .eq('ativo', true)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar configurações:', error)
        return
      }

      console.log('📋 Configurações encontradas:', settings)

      // Usar configurações padrão se não encontrar
      const notificationConfig = settings || {
        titulo: 'Venda Realizada!',
        mensagem_template: 'Nova venda de R$ {valor} realizada!',
        icone: '/icon-192x192.png',
        badge: '/icon-64x64.png'
      }

      // Substituir variáveis na mensagem
      const mensagem = notificationConfig.mensagem_template
        .replace('{valor}', this.formatCurrency(venda.valor))
        .replace('{produto}', venda.produto || '')
        .replace('{cliente}', venda.cliente || '')

      console.log('💬 Mensagem da notificação:', mensagem)

      // Verificar se notificações estão permitidas
      if (Notification.permission !== 'granted') {
        console.warn('⚠️ Permissão de notificação não concedida')
        alert('⚠️ Permissão de notificação não concedida. Permita notificações para receber alertas de vendas.')
        return
      }

      // Exibir notificação local se o service worker estiver ativo
      if ('serviceWorker' in navigator && 'Notification' in window) {
        console.log('🔔 Tentando exibir notificação...')
        
        const registration = await navigator.serviceWorker.ready
        
        const tag = `sale-${venda.id}`

        // Deduplicação local: se já mostramos essa tag nos últimos 60s, não mostrar novamente
        try {
          const lastShown = localStorage.getItem(`notif_last_${tag}`)
          const now = Date.now()
          if (lastShown && (now - parseInt(lastShown, 10) < 60 * 1000)) {
            console.log('⏳ Notificação com essa tag já exibida recentemente, pulando...')
            return
          }
          localStorage.setItem(`notif_last_${tag}`, String(now))
        } catch (e) {
          // localStorage pode falhar em alguns contextos, ignorar
        }

        await registration.showNotification(notificationConfig.titulo, {
          body: mensagem,
          icon: notificationConfig.icone,
          badge: notificationConfig.badge,
          tag,
          data: {
            saleId: venda.id,
            valor: venda.valor,
            type: 'sale-notification'
          },
          actions: [
            {
              action: 'view',
              title: 'Ver Detalhes',
              icon: '/icon-64x64.png'
            }
          ],
          requireInteraction: true,
          vibrate: [200, 100, 200]
        })
        
        console.log('✅ Notificação exibida com sucesso!')
      } else {
        console.error('❌ Service Worker ou Notifications não disponíveis')
      }
    } catch (error) {
      console.error('Erro ao processar notificação de venda:', error)
    }
  }

  // Formatar valor monetário
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  // Inicializar serviço completo
  async initialize() {
    try {
      // Verificar se já existe uma subscription ativa
      const existingSubscription = await this.getExistingSubscription()
      
      if (existingSubscription) {
        this.subscription = existingSubscription
        console.log('Subscription existente encontrada')
      }

      // Configurar listener de vendas
      this.setupSalesListener()
      
      console.log('Serviço de notificações Supabase inicializado')
    } catch (error) {
      console.error('Erro ao inicializar serviço:', error)
    }
  }

  // Verificar subscription existente
  async getExistingSubscription() {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        return await registration.pushManager.getSubscription()
      }
      return null
    } catch (error) {
      console.error('Erro ao verificar subscription existente:', error)
      return null
    }
  }

  // Desconectar do Real-time
  disconnect() {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel)
      this.realtimeChannel = null
      console.log('Desconectado do Real-time')
    }
  }

  // Método para testar o sistema (para desenvolvimento)
  async testSaleNotification() {
    const testSale = {
      id: 'test-' + Date.now(),
      valor: 150.99,
      produto: 'Produto Teste',
      cliente: 'Cliente Teste'
    }
    
    await this.handleNewSale(testSale)
  }
}

export default new SupabasePushNotificationService()
import { supabase } from '../lib/supabase-safe.js'

class SupabasePushNotificationService {
  constructor() {
    this.subscription = null
    this.realtimeChannel = null
  }

  // Registrar subscription no Supabase
  async registerSubscription(subscription) {
    try {
      const subscriptionData = {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: navigator.userAgent
      }

      const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert(subscriptionData, { 
          onConflict: 'endpoint',
          ignoreDuplicates: false 
        })
        .select()

      if (error) {
        console.error('Erro ao registrar subscription:', error)
        throw error
      }

      console.log('Subscription registrada com sucesso:', data)
      this.subscription = subscription
      return data
    } catch (error) {
      console.error('Erro ao registrar subscription:', error)
      throw error
    }
  }

  // Remover subscription do Supabase
  async unregisterSubscription(subscription) {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('endpoint', subscription.endpoint)

      if (error) {
        console.error('Erro ao desregistrar subscription:', error)
        throw error
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
        
        await registration.showNotification(notificationConfig.titulo, {
          body: mensagem,
          icon: notificationConfig.icone,
          badge: notificationConfig.badge,
          tag: `sale-${venda.id}`,
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
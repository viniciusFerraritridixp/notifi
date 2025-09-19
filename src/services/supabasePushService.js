import { supabase } from '../lib/supabase.js'

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
          console.log('Novo evento de venda detectado:', payload.new)
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
          console.log('Nova venda detectada (direto):', payload.new)
          this.handleNewSale(payload.new)
        }
      )
      .subscribe((status) => {
        console.log('Status do Real-time:', status)
      })
  }

  // Processar evento de venda da tabela sales_events
  async handleSaleEvent(saleEvent) {
    try {
      console.log('Processando evento de venda:', saleEvent)
      
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

      // Exibir notificação local se o service worker estiver ativo
      if ('serviceWorker' in navigator && 'Notification' in window) {
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
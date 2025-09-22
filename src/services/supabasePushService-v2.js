// Atualização do serviço de notificações para funcionar com trigger SQL
// src/services/supabasePushService.js

import { supabase } from '../lib/supabase-safe.js'

class SupabasePushService {
  constructor() {
    this.isSubscribed = false
    this.subscription = null
    this.notificationQueue = new Set()
    this.lastNotificationTime = new Map()
    this.DEBOUNCE_TIME = 2000 // 2 segundos para evitar duplicatas
    
    this.init()
  }

  init() {
    this.setupRealtimeListeners()
    this.setupServiceWorker()
  }

  // Configurar Service Worker
  async setupServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker não suportado')
      return
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('✅ Service Worker registrado:', registration)
      
      // Escutar mensagens do service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CLICKED') {
          console.log('Notificação clicada:', event.data)
          // Abrir página específica se necessário
          if (event.data.url) {
            window.location.href = event.data.url
          }
        }
      })
      
    } catch (error) {
      console.error('❌ Erro ao registrar Service Worker:', error)
    }
  }

  // Configurar listeners Real-time para a FILA de notificações
  setupRealtimeListeners() {
    // Escutar inserções na fila de notificações
    const channel = supabase
      .channel('notifications-queue')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications_queue',
          filter: 'status=eq.pending'
        },
        (payload) => {
          console.log('📥 Nova notificação na fila:', payload)
          this.handleNotificationFromQueue(payload.new)
        }
      )
      .subscribe((status) => {
        console.log('🔄 Status do canal notifications-queue:', status)
      })

    // Também escutar vendas diretamente (backup)
    const salesChannel = supabase
      .channel('vendas-backup')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'vendas'
        },
        (payload) => {
          console.log('📥 Nova venda (backup):', payload)
          this.handleSaleNotification(payload.new)
        }
      )
      .subscribe()
  }

  // Processar notificação da fila
  async handleNotificationFromQueue(queueItem) {
    const notificationKey = `queue-${queueItem.id}`
    
    // Verificar duplicatas
    if (this.notificationQueue.has(notificationKey)) {
      console.log('⚠️ Notificação duplicada ignorada:', notificationKey)
      return
    }

    this.notificationQueue.add(notificationKey)

    try {
      // Mostrar notificação usando dados da fila
      await this.showNotification({
        title: queueItem.title,
        body: queueItem.body,
        icon: queueItem.icon || '/pwa-192x192.png',
        tag: queueItem.tag,
        data: queueItem.data_payload
      })

      // Marcar como processada na fila (opcional)
      await supabase
        .from('notifications_queue')
        .update({ 
          status: 'sent',
          processed_at: new Date().toISOString()
        })
        .eq('id', queueItem.id)

      console.log('✅ Notificação da fila processada:', queueItem.id)

    } catch (error) {
      console.error('❌ Erro ao processar notificação da fila:', error)
      
      // Marcar como falha na fila
      await supabase
        .from('notifications_queue')
        .update({ 
          status: 'failed',
          error_message: error.message
        })
        .eq('id', queueItem.id)
    }

    // Remover da fila local após 5 segundos
    setTimeout(() => {
      this.notificationQueue.delete(notificationKey)
    }, 5000)
  }

  // Processar venda diretamente (backup)
  async handleSaleNotification(sale) {
    const notificationKey = `sale-${sale.id}`
    const now = Date.now()
    
    // Verificar debounce
    const lastTime = this.lastNotificationTime.get(notificationKey)
    if (lastTime && (now - lastTime) < this.DEBOUNCE_TIME) {
      console.log('⚠️ Notificação ignorada por debounce:', notificationKey)
      return
    }

    this.lastNotificationTime.set(notificationKey, now)

    try {
      const valor = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(sale.valor || 0)

      await this.showNotification({
        title: 'Venda Realizada!',
        body: `Nova venda de ${valor} realizada!`,
        icon: '/pwa-192x192.png',
        tag: notificationKey,
        data: {
          saleId: sale.id,
          valor: sale.valor,
          type: 'sale-notification',
          url: '/'
        }
      })

      console.log('✅ Notificação de venda enviada:', sale.id)

    } catch (error) {
      console.error('❌ Erro ao enviar notificação de venda:', error)
    }
  }

  // Mostrar notificação
  async showNotification(options) {
    // Verificar permissões
    if (Notification.permission !== 'granted') {
      console.warn('⚠️ Permissão de notificação negada')
      return
    }

    try {
      // Tentar usar Service Worker primeiro (funciona quando PWA está fechado)
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        if (registration.showNotification) {
          await registration.showNotification(options.title, {
            body: options.body,
            icon: options.icon,
            badge: '/pwa-64x64.png',
            tag: options.tag,
            data: options.data,
            requireInteraction: true,
            vibrate: [200, 100, 200],
            actions: [
              {
                action: 'view',
                title: 'Ver Detalhes'
              },
              {
                action: 'close',
                title: 'Fechar'
              }
            ]
          })
          console.log('✅ Notificação via Service Worker enviada')
          return
        }
      }

      // Fallback para Web Notification API
      new Notification(options.title, {
        body: options.body,
        icon: options.icon,
        tag: options.tag,
        data: options.data
      })
      
      console.log('✅ Notificação via Web API enviada')

    } catch (error) {
      console.error('❌ Erro ao mostrar notificação:', error)
      throw error
    }
  }

  // Registrar push subscription
  async registerPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications não suportadas')
    }

    try {
      const registration = await navigator.serviceWorker.ready
      
      // Verificar se já existe subscription
      let subscription = await registration.pushManager.getSubscription()
      
      if (!subscription) {
        // Criar nova subscription
        const vapidPublicKey = 'BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o'
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
        })
      }

      // Salvar subscription no Supabase
      const subscriptionData = {
        endpoint: subscription.endpoint,
        p256dh: subscription.toJSON().keys.p256dh,
        auth: subscription.toJSON().keys.auth,
        user_agent: navigator.userAgent,
        is_active: true
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(subscriptionData, {
          onConflict: 'endpoint',
          ignoreDuplicates: false
        })

      if (error) throw error

      this.isSubscribed = true
      this.subscription = subscription
      
      console.log('✅ Push subscription registrada com sucesso')
      return subscription

    } catch (error) {
      console.error('❌ Erro ao registrar push subscription:', error)
      throw error
    }
  }

  // Solicitar permissão de notificação
  async requestPermission() {
    if (!('Notification' in window)) {
      throw new Error('Notificações não suportadas neste navegador')
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      throw new Error('Permissão de notificação foi negada')
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  // Utilitário para converter VAPID key
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

  // Inicializar sistema completo
  async initialize() {
    try {
      console.log('🚀 Inicializando sistema de notificações...')
      
      // 1. Solicitar permissão
      const hasPermission = await this.requestPermission()
      if (!hasPermission) {
        throw new Error('Permissão de notificação necessária')
      }

      // 2. Registrar push subscription
      await this.registerPushSubscription()

      console.log('✅ Sistema de notificações inicializado com sucesso')
      return true

    } catch (error) {
      console.error('❌ Erro ao inicializar notificações:', error)
      throw error
    }
  }
}

// Instância singleton
const pushService = new SupabasePushService()

export default pushService
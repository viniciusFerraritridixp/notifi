// Utilitários para gerenciamento de notificações

import supabasePushService from '../services/supabasePushService.js'

export class NotificationManager {
  constructor() {
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
    this.permission = this.isSupported ? Notification.permission : 'denied'
  }

  // Verificar se notificações são suportadas
  isNotificationSupported() {
    return this.isSupported
  }

  // Solicitar permissão para notificações
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Notificações não são suportadas neste navegador')
    }

    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      return permission
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error)
      throw error
    }
  }

  // Enviar notificação simples
  async sendNotification(title, options = {}) {
    if (this.permission !== 'granted') {
      throw new Error('Permissão para notificações não concedida')
    }

    const defaultOptions = {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      tag: `notification-${Date.now()}`
    }

    const notification = new Notification(title, { ...defaultOptions, ...options })
    
    // Auto-fechar após 5 segundos se não houver interação
    setTimeout(() => {
      notification.close()
    }, 5000)

    return notification
  }

  // Registrar para push notifications com Supabase
  async subscribeToPush() {
    if (!this.isSupported) {
      throw new Error('Push notifications não são suportadas')
    }

    try {
      const registration = await navigator.serviceWorker.ready
      
      // Usar chave VAPID do ambiente
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40HI8YN1YrY-YmhS4PQlEr0f5Z5Q8QjC0WQWEj1LYNmEelk7bkVA6qZLQnV8'
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      })

      console.log('Subscription criada:', subscription)
      
      // Registrar subscription no Supabase
      await supabasePushService.registerSubscription(subscription)
      
      return subscription
    } catch (error) {
      console.error('Erro ao se inscrever para push:', error)
      throw error
    }
  }

  // Obter subscription atual
  async getCurrentSubscription() {
    if (!this.isSupported) return null

    try {
      const registration = await navigator.serviceWorker.ready
      return await registration.pushManager.getSubscription()
    } catch (error) {
      console.error('Erro ao obter subscription:', error)
      return null
    }
  }

  // Cancelar subscription do Supabase
  async unsubscribeFromPush() {
    const subscription = await this.getCurrentSubscription()
    if (subscription) {
      // Remover do Supabase
      await supabasePushService.unregisterSubscription(subscription)
      
      // Cancelar localmente
      await subscription.unsubscribe()
      localStorage.removeItem('push-subscription')
      console.log('Subscription cancelada')
    }
  }

  // Converter chave VAPID
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

  // Verificar se já está inscrito
  async isSubscribed() {
    const subscription = await this.getCurrentSubscription()
    return !!subscription
  }

  // Configurações de notificação do usuário
  getUserSettings() {
    const defaultSettings = {
      soundEnabled: true,
      vibrationEnabled: true,
      showBadge: true,
      autoInstall: true
    }

    const saved = localStorage.getItem('notification-settings')
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings
  }

  saveUserSettings(settings) {
    localStorage.setItem('notification-settings', JSON.stringify(settings))
  }
}

// Instância singleton
export const notificationManager = new NotificationManager()

// Hook personalizado para React
export const useNotifications = () => {
  const manager = notificationManager
  
  return {
    isSupported: manager.isSupported,
    permission: manager.permission,
    requestPermission: () => manager.requestPermission(),
    sendNotification: (title, options) => manager.sendNotification(title, options),
    subscribeToPush: () => manager.subscribeToPush(),
    unsubscribeFromPush: () => manager.unsubscribeFromPush(),
    isSubscribed: () => manager.isSubscribed(),
    getUserSettings: () => manager.getUserSettings(),
    saveUserSettings: (settings) => manager.saveUserSettings(settings)
  }
}
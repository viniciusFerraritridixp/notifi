import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  const initHybrid = async () => {
    try {
      console.log('[AutoInit] Iniciando registro automático do dispositivo...')
      
      // 1. Inicializar hybridNotificationManager (gera device_token)
      const { default: hybridNotificationManager } = await import('./utils/hybridNotificationManager.js')
      const result = await hybridNotificationManager.initialize()

      // 2. Obter FCM token automaticamente
      let fcmToken = null
      try {
        const { default: FirebaseNotificationService } = await import('./lib/firebase.js')
        fcmToken = await FirebaseNotificationService.requestPermissionAndGetToken()
        console.log('[AutoInit] FCM token obtido:', fcmToken ? '✅' : '❌')
      } catch (fcmErr) {
        console.warn('[AutoInit] Erro ao obter FCM token:', fcmErr)
      }

      // 3. Registrar dispositivo com token FCM (se disponível)
      if (result && result.deviceToken) {
        try {
          const deviceData = {
            device_token: result.deviceToken,
            fcm_token: fcmToken,
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            is_ios: /iPad|iPhone|iPod/.test(navigator.userAgent),
            is_mobile: /Mobi|Android/i.test(navigator.userAgent),
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen_resolution: `${screen.width}x${screen.height}`,
            url: window.location.href
          }

          const response = await fetch('/api/register-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deviceData)
          })

          if (response.ok) {
            console.log('[AutoInit] ✅ Dispositivo registrado automaticamente com FCM token')
            
            // Opcional: enviar notificação de teste em mobile
            const isMobile = /Mobi|Android/i.test(navigator.userAgent)
            if (isMobile && fcmToken) {
              try {
                const { default: supabasePushService } = await import('./services/supabasePushService.js')
                const testNotification = {
                  title: 'Configuração de Notificações',
                  body: 'Seu dispositivo foi registrado para notificações',
                  icon: '/icon.svg',
                  badge: '/pwa-64x64.png',
                  timestamp: new Date().toISOString()
                }
                await supabasePushService.sendNotificationToDeviceTokens([result.deviceToken], testNotification)
                console.log('[AutoInit] Notificação de teste enviada')
              } catch (err) {
                console.warn('[AutoInit] Erro ao enviar notificação de teste:', err)
              }
            }
          } else {
            console.warn('[AutoInit] Erro ao registrar dispositivo:', response.status)
          }
        } catch (registerErr) {
          console.warn('[AutoInit] Erro ao registrar dispositivo:', registerErr)
        }
      }
    } catch (err) {
      console.warn('[AutoInit] Falha no registro automático:', err)
    }
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('SW registrado com sucesso:', registration);
    } catch (registrationError) {
      console.log('SW falhou ao registrar:', registrationError);
    } finally {
      // Inicializar independentemente do resultado do registro do SW
      initHybrid()
    }
  })
}

// Ouvir mensagens do Service Worker para tocar som personalizado
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async (event) => {
    try {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'play-sound' && msg.url) {
        // Tentar reproduzir o som; pode falhar devido a políticas de autoplay
        try {
          const audio = new Audio(msg.url);
          audio.volume = 0.95;
          await audio.play();
          console.log('[Client] Som reproduzido:', msg.url);
        } catch (err) {
          console.warn('[Client] Falha ao reproduzir som automaticamente:', err);
          // Opcional: guardar para reproduzir após interação do usuário
          sessionStorage.setItem('pendingNotificationSound', msg.url);
        }
      }
    } catch (e) {
      console.error('[Client] Erro ao processar mensagem do SW:', e);
    }
  });

  // Se houver som pendente (autoplay bloqueado), tocar após próxima interação
  window.addEventListener('click', async () => {
    const pending = sessionStorage.getItem('pendingNotificationSound');
    if (pending) {
      try {
        const audio = new Audio(pending);
        audio.volume = 0.95;
        await audio.play();
        sessionStorage.removeItem('pendingNotificationSound');
        console.log('[Client] Som pendente reproduzido após interação do usuário');
      } catch (err) {
        console.warn('[Client] Não foi possível reproduzir som pendente:', err);
      }
    }
  }, { once: false });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registrado com sucesso:', registration);
        // Após registrar o SW, inicializar o gerenciador híbrido para gerar/salvar device token
        (async () => {
          try {
            // Inicializar sempre (garante que device token seja salvo automaticamente quando possível)
            const { default: hybridNotificationManager } = await import('./utils/hybridNotificationManager.js')
            const result = await hybridNotificationManager.initialize()

            // Se tivermos um device token, opcionalmente enviar notificação de teste em mobile
            const isMobile = /Mobi|Android/i.test(navigator.userAgent)
            if (isMobile && result && result.deviceToken) {
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

          } catch (err) {
            console.warn('[AutoInit] Falha ao inicializar hybridNotificationManager:', err)
          }
        })()
      })
      .catch((registrationError) => {
        console.log('SW falhou ao registrar:', registrationError);
      });
  });
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
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
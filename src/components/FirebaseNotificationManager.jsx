// Componente React para gerenciar Firebase Cloud Messaging
import React, { useState, useEffect } from 'react';
import HybridFirebaseService from '../services/hybridFirebaseService.js';

const FirebaseNotificationManager = () => {
  const [fcmToken, setFcmToken] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Inicializar Firebase ao montar componente
  useEffect(() => {
    initializeFirebase();
    loadStats();
    
    // Listener para notificações em primeiro plano
    const handleFirebaseNotification = (event) => {
      const { notification, data } = event.detail;
      showLocalNotification(notification, data);
    };

    window.addEventListener('firebaseNotificationReceived', handleFirebaseNotification);
    
    return () => {
      window.removeEventListener('firebaseNotificationReceived', handleFirebaseNotification);
    };
  }, []);

  // Inicializar serviço Firebase
  const initializeFirebase = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const success = await HybridFirebaseService.initialize();
      
      if (success) {
        setIsInitialized(true);
        setFcmToken(HybridFirebaseService.currentFCMToken);
        console.log('✅ Firebase inicializado com sucesso');
      } else {
        setError('Não foi possível inicializar o Firebase');
      }
    } catch (err) {
      setError(`Erro na inicialização: ${err.message}`);
      console.error('❌ Erro ao inicializar Firebase:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar estatísticas
  const loadStats = async () => {
    try {
      const notificationStats = await HybridFirebaseService.getNotificationStats();
      setStats(notificationStats);
    } catch (err) {
      console.error('❌ Erro ao carregar estatísticas:', err);
    }
  };

  // Mostrar notificação local
  const showLocalNotification = (notification, data) => {
    // Criar elemento de notificação personalizada
    const notificationElement = document.createElement('div');
    notificationElement.className = 'firebase-notification-popup';
    notificationElement.innerHTML = `
      <div class="notification-content">
        <div class="notification-title">${notification.title}</div>
        <div class="notification-body">${notification.body}</div>
        <div class="notification-actions">
          <button onclick="this.parentElement.parentElement.parentElement.remove()">
            Fechar
          </button>
        </div>
      </div>
    `;

    // Adicionar estilos
    notificationElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      max-width: 300px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notificationElement);

    // Remover automaticamente após 5 segundos
    setTimeout(() => {
      notificationElement.remove();
    }, 5000);
  };

  // Testar envio de notificação
  const testNotification = async () => {
    if (!isInitialized) {
      setError('Firebase não inicializado');
      return;
    }

    try {
      setLoading(true);
      
      const testData = {
        title: 'Notificação de Teste',
        body: 'Esta é uma notificação de teste via Firebase',
        type: 'test',
        url: window.location.href,
        sound: 'cash'
      };

      // Assumindo que temos um deviceToken disponível
      const deviceToken = localStorage.getItem('deviceToken') || 'test-device';
      
      await HybridFirebaseService.sendNotification(deviceToken, testData);
      
      console.log('✅ Notificação de teste enviada');
      
      // Recarregar estatísticas
      setTimeout(loadStats, 1000);
      
    } catch (err) {
      setError(`Erro ao enviar notificação: ${err.message}`);
      console.error('❌ Erro ao enviar notificação:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="firebase-notification-manager">
      <h3>🔥 Firebase Cloud Messaging</h3>
      
      {/* Status de Inicialização */}
      <div className="firebase-status">
        <div className="status-item">
          <strong>Status:</strong>
          <span className={`status-badge ${isInitialized ? 'success' : 'error'}`}>
            {isInitialized ? '✅ Ativo' : '❌ Inativo'}
          </span>
        </div>
        
        {fcmToken && (
          <div className="status-item">
            <strong>Token FCM:</strong>
            <code className="token-display">
              {fcmToken.substring(0, 20)}...
            </code>
          </div>
        )}
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="firebase-stats">
          <h4>📊 Estatísticas</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Pendentes:</span>
              <span className="stat-value">{stats.total_pending}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Entregues:</span>
              <span className="stat-value">{stats.total_delivered}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Falharam:</span>
              <span className="stat-value">{stats.total_failed}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Com FCM:</span>
              <span className="stat-value">{stats.devices_with_fcm}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Sem FCM:</span>
              <span className="stat-value">{stats.devices_without_fcm}</span>
            </div>
          </div>
        </div>
      )}

      {/* Controles */}
      <div className="firebase-controls">
        <button 
          onClick={initializeFirebase}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Inicializando...' : '🔄 Reinicializar Firebase'}
        </button>
        
        <button 
          onClick={testNotification}
          disabled={!isInitialized || loading}
          className="btn btn-secondary"
        >
          {loading ? 'Enviando...' : '📱 Testar Notificação'}
        </button>
        
        <button 
          onClick={loadStats}
          disabled={loading}
          className="btn btn-secondary"
        >
          📊 Atualizar Estatísticas
        </button>
      </div>

      {/* Mensagem de Erro */}
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {/* Informações */}
      <div className="firebase-info">
        <h4>ℹ️ Informações</h4>
        <ul>
          <li>O Firebase envia notificações para dispositivos offline</li>
          <li>Notificações são processadas em background a cada 5 minutos</li>
          <li>Dispositivos devem ter token FCM válido para receber notificações</li>
          <li>Verifique os logs do console para debug</li>
        </ul>
      </div>

      <style jsx>{`
        .firebase-notification-manager {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .firebase-status {
          margin: 15px 0;
        }

        .status-item {
          display: flex;
          align-items: center;
          margin: 8px 0;
          gap: 10px;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .status-badge.success {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.error {
          background: #f8d7da;
          color: #721c24;
        }

        .token-display {
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
        }

        .firebase-stats {
          margin: 20px 0;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
          margin-top: 10px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          padding: 8px;
          background: white;
          border-radius: 4px;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
        }

        .stat-value {
          font-weight: bold;
          color: #333;
        }

        .firebase-controls {
          display: flex;
          gap: 10px;
          margin: 20px 0;
          flex-wrap: wrap;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #545b62;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
          border: 1px solid #f5c6cb;
        }

        .firebase-info {
          margin-top: 20px;
          padding: 15px;
          background: #e3f2fd;
          border-radius: 6px;
        }

        .firebase-info ul {
          margin: 10px 0;
          padding-left: 20px;
        }

        .firebase-info li {
          margin: 5px 0;
          font-size: 14px;
          color: #555;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default FirebaseNotificationManager;
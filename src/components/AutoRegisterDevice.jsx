import React, { useState, useEffect } from 'react';

const AutoRegisterDevice = () => {
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [deviceToken, setDeviceToken] = useState(null);
  const [fcmToken, setFcmToken] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const registerDevice = async () => {
    setStatus('loading');
    setLogs([]);
    addLog('Iniciando registro automático do dispositivo...');

    try {
      // 1. Obter device token
      addLog('Obtendo device token...');
      const { default: hybridNotificationManager } = await import('../utils/hybridNotificationManager.js');
      
      let storedToken = hybridNotificationManager.getStoredDeviceToken();
      if (!storedToken) {
        addLog('Gerando novo device token...');
        storedToken = await hybridNotificationManager.generateDeviceToken();
      }
      
      setDeviceToken(storedToken);
      addLog(`✅ Device token: ${storedToken}`);

      // 2. Obter FCM token
      addLog('Solicitando permissão e obtendo FCM token...');
      const { default: FirebaseNotificationService } = await import('../lib/firebase.js');
      const token = await FirebaseNotificationService.requestPermissionAndGetToken();
      
      setFcmToken(token);
      if (token) {
        addLog(`✅ FCM token obtido: ${token.substring(0, 20)}...`);
      } else {
        addLog('⚠️ FCM token não obtido (permissão negada ou não suportado)');
      }

      // 3. Registrar no backend
      addLog('Enviando dados para o backend...');
      const deviceData = {
        device_token: storedToken,
        fcm_token: token,
        user_agent: navigator.userAgent,
        platform: navigator.platform,
        is_ios: /iPad|iPhone|iPod/.test(navigator.userAgent),
        is_mobile: /Mobi|Android/i.test(navigator.userAgent),
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen_resolution: `${screen.width}x${screen.height}`,
        url: window.location.href
      };

      const response = await fetch('/api/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceData)
      });

      if (response.ok) {
        const result = await response.json();
        addLog('✅ Dispositivo registrado com sucesso no backend!');
        addLog(`📊 ${result.message}`);
        addLog(`🆔 Device ID: ${result.data?.id}`);
        addLog(`🔗 Device Token: ${result.data?.device_token}`);
        addLog(`📱 FCM Token: ${result.data?.fcm_token ? 'Presente' : 'Ausente'}`);
        addLog(`🆕 Status: ${result.data?.was_created ? 'Novo dispositivo' : 'Atualizado'}`);
        setStatus('success');
      } else {
        const errorText = await response.text();
        addLog(`❌ Erro do backend (${response.status}): ${errorText}`);
        setStatus('error');
      }

    } catch (error) {
      addLog(`❌ Erro: ${error.message}`);
      setStatus('error');
    }
  };

  // Registro automático na primeira carga
  useEffect(() => {
    const autoRegister = localStorage.getItem('auto_registered');
    if (!autoRegister) {
      setTimeout(() => {
        registerDevice();
        localStorage.setItem('auto_registered', 'true');
      }, 1000); // Delay de 1s para garantir que tudo carregou
    }
  }, []);

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '600px', 
      margin: '0 auto',
      fontFamily: 'monospace',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      marginTop: '20px'
    }}>
      <h3>🔧 Registro Automático de Dispositivo</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <strong>Status:</strong> 
        <span style={{ 
          color: status === 'success' ? 'green' : status === 'error' ? 'red' : 'orange',
          marginLeft: '10px'
        }}>
          {status === 'idle' && '⏳ Aguardando'}
          {status === 'loading' && '🔄 Processando...'}
          {status === 'success' && '✅ Concluído'}
          {status === 'error' && '❌ Erro'}
        </span>
      </div>

      {deviceToken && (
        <div style={{ marginBottom: '10px' }}>
          <strong>Device Token:</strong> <code>{deviceToken}</code>
        </div>
      )}

      {fcmToken && (
        <div style={{ marginBottom: '10px' }}>
          <strong>FCM Token:</strong> <code>{fcmToken.substring(0, 30)}...</code>
        </div>
      )}

      <button 
        onClick={registerDevice} 
        disabled={status === 'loading'}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          marginBottom: '15px'
        }}
      >
        {status === 'loading' ? 'Registrando...' : 'Registrar Dispositivo'}
      </button>

      <button 
        onClick={() => {
          localStorage.removeItem('auto_registered');
          setStatus('idle');
          setLogs([]);
          addLog('Cache limpo. Recarregue a página para registro automático.');
        }}
        style={{
          padding: '10px 20px',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginLeft: '10px',
          marginBottom: '15px'
        }}
      >
        Limpar Cache
      </button>

      {logs.length > 0 && (
        <div>
          <h4>📝 Log:</h4>
          <div style={{
            backgroundColor: '#000',
            color: '#00ff00',
            padding: '10px',
            borderRadius: '4px',
            maxHeight: '300px',
            overflowY: 'auto',
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}>
            {logs.join('\n')}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoRegisterDevice;
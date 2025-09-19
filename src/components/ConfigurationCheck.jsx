import { useState, useEffect } from 'react'

const ConfigurationCheck = () => {
  const [config, setConfig] = useState({
    supabaseUrl: false,
    supabaseAnonKey: false,
    vapidKey: false
  })

  useEffect(() => {
    setConfig({
      supabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
      supabaseAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      vapidKey: !!import.meta.env.VITE_VAPID_PUBLIC_KEY
    })
  }, [])

  const allConfigured = Object.values(config).every(Boolean)

  if (allConfigured) {
    return null // Não exibir se tudo estiver configurado
  }

  return (
    <div style={{
      padding: '20px',
      margin: '20px',
      backgroundColor: '#fff3cd',
      border: '1px solid #ffeaa7',
      borderRadius: '8px',
      color: '#856404'
    }}>
      <h3>⚠️ Configuração Incompleta</h3>
      <p>Algumas variáveis de ambiente não estão configuradas:</p>
      <ul>
        <li>
          VITE_SUPABASE_URL: {config.supabaseUrl ? '✅' : '❌ Não configurada'}
        </li>
        <li>
          VITE_SUPABASE_ANON_KEY: {config.supabaseAnonKey ? '✅' : '❌ Não configurada'}
        </li>
        <li>
          VITE_VAPID_PUBLIC_KEY: {config.vapidKey ? '✅' : '❌ Não configurada'}
        </li>
      </ul>
      
      <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <strong>Para configurar no Vercel:</strong>
        <ol style={{ marginTop: '10px' }}>
          <li>Vá em <strong>Settings</strong> → <strong>Environment Variables</strong></li>
          <li>Adicione as variáveis necessárias</li>
          <li>Faça redeploy da aplicação</li>
        </ol>
      </div>

      <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
        <strong>Valores para configurar:</strong>
        <pre style={{ fontSize: '12px', overflow: 'auto' }}>
{`VITE_SUPABASE_URL=https://qjrirsvrxlemamvjhdwz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_VAPID_PUBLIC_KEY=BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o`}
        </pre>
      </div>
    </div>
  )
}

export default ConfigurationCheck
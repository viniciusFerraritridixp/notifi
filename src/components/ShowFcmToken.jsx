import React, { useEffect, useState } from 'react'
import FirebaseNotificationService from '../lib/firebase.js'

// Componente para dispositivos onde não há console (PWA mobile)
// - Solicita permissão
// - Obtém token FCM
// - Permite copiar e enviar ao backend (/api/register-device)

function ensureDeviceToken() {
  try {
    let dt = localStorage.getItem('device_token')
    if (!dt) {
      // gerar um device token simples (não criptográfico, apenas identificador local)
      dt = 'dt_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('device_token', dt)
    }
    return dt
  } catch (e) {
    return null
  }
}

export default function ShowFcmToken() {
  const [status, setStatus] = useState('idle')
  const [token, setToken] = useState(null)
  const [error, setError] = useState(null)
  const [sentResult, setSentResult] = useState(null)

  useEffect(() => {
    // opcional: checar automaticamente se já existe token salvo
    // não pede permissão automaticamente para não surpreender o usuário
  }, [])

  async function handleGetToken() {
    setStatus('requesting')
    setError(null)
    try {
      const t = await FirebaseNotificationService.requestPermissionAndGetToken()
      if (t) {
        setToken(t)
        setStatus('got')
      } else {
        setStatus('no-token')
        setError('Não foi possível obter o token (permissão negada ou erro)')
      }
    } catch (e) {
      setStatus('error')
      setError(e?.message || String(e))
    }
  }

  async function handleCopy() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setSentResult('Token copiado para área de transferência')
    } catch (e) {
      setSentResult('Erro ao copiar: ' + (e?.message || String(e)))
    }
  }

  async function handleSend() {
    if (!token) return
    setSentResult(null)
    try {
      const device_token = ensureDeviceToken()
      const body = {
        device_token,
        fcm_token: token,
        platform: 'web'
      }

      const res = await fetch('/api/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setSentResult('Token enviado ao servidor com sucesso')
      } else {
        const txt = await res.text().catch(() => '')
        setSentResult('Erro no servidor: ' + (txt || res.status))
      }
    } catch (e) {
      setSentResult('Erro ao enviar: ' + (e?.message || String(e)))
    }
  }

  return (
    <div style={{padding: 16, maxWidth: 720}}>
      <h3>Obter FCM token (PWA)</h3>

      <p style={{color:'#444'}}>
        Use este botão no seu celular PWA para solicitar permissão e obter o token FCM. Caso já tenha sido concedida a permissão,
        o token será retornado imediatamente.
      </p>

      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        <button onClick={handleGetToken} disabled={status === 'requesting'}>
          {status === 'requesting' ? 'Pedindo permissão...' : 'Pedir permissão e obter token'}
        </button>
        <button onClick={handleCopy} disabled={!token}>Copiar token</button>
        <button onClick={handleSend} disabled={!token}>Enviar ao servidor</button>
      </div>

      <div style={{marginTop:12}}>
        <strong>Estado:</strong> {status}
      </div>

      {error && (
        <div style={{marginTop:8, color:'crimson'}}>
          <strong>Erro:</strong> {error}
        </div>
      )}

      {token && (
        <div style={{marginTop:12}}>
          <label style={{display:'block', fontSize:12, color:'#666'}}>FCM token (toque para selecionar)</label>
          <textarea readOnly value={token} rows={4} style={{width:'100%', fontSize:12}} />
        </div>
      )}

      {sentResult && (
        <div style={{marginTop:8, color:'#066'}}>{sentResult}</div>
      )}

      <div style={{marginTop:12, fontSize:12, color:'#666'}}>
        Observações: o token pode mudar com o tempo; guarde-o no servidor. Se o botão não solicitar permissão,
        cheque as configurações de notificações do navegador no dispositivo.
      </div>
    </div>
  )
}

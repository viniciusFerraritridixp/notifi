import { createClient } from '@supabase/supabase-js'

// Função para normalizar URL do Supabase
function normalizeSupabaseUrl(url) {
  if (!url) return null
  
  // Remover espaços e quebras de linha
  url = url.trim()
  
  // Adicionar https:// se não tiver protocolo
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }
  
  return url
}

// Verificar e normalizar variáveis de ambiente
let supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('🔧 Configuração Supabase:', {
  url: supabaseUrl ? `✅ Definida (${supabaseUrl})` : '❌ Não definida',
  anonKey: supabaseAnonKey ? '✅ Definida' : '❌ Não definida'
})

let supabase, supabaseAdmin

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas!')
  console.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
  
  // Criar cliente mock para evitar crash
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: { message: 'Supabase não configurado' } }),
      update: () => Promise.resolve({ data: null, error: { message: 'Supabase não configurado' } }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
    }),
  }
  
  supabaseAdmin = null
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
      // Configurações para evitar loops infinitos
      reconnectAfterMs: function (tries) {
        return [1000, 2000, 5000, 10000][tries - 1] || 10000
      },
      rejoinAfterMs: function (tries) {
        return [1000, 2000, 5000, 10000][tries - 1] || 10000
      },
      logger: (kind, msg, data) => {
        if (kind === 'error') {
          console.warn('Real-time error:', msg, data)
        }
      }
    },
  })

  // Cliente administrativo para operações privilegiadas
  const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  supabaseAdmin = supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        realtime: { params: { eventsPerSecond: 5 } }
      })
    : null
}

export { supabase, supabaseAdmin }
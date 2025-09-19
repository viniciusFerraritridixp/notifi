import { createClient } from '@supabase/supabase-js'

// Verificar se as variáveis de ambiente estão definidas
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('🔧 Configuração Supabase:', {
  url: supabaseUrl ? '✅ Definida' : '❌ Não definida',
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
    },
  })

  // Cliente administrativo para operações privilegiadas
  const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  supabaseAdmin = supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null
}

export { supabase, supabaseAdmin }
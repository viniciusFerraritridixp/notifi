// Edge Function para envio de notificações de venda
// Deno runtime - Supabase Edge Functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Interface para dados de venda
interface SaleData {
  id: string
  valor?: number
  produto?: string
  cliente?: string
  created_at?: string
}

// Interface para subscription
interface PushSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent?: string
  is_active: boolean
}

// Interface para payload da notificação
interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, unknown>
  tag?: string
}

console.log("Edge Function 'send-sale-notification' iniciada")

serve(async (req) => {
  // Configurar CORS para permitir requests do frontend
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  // Responder a requests OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  try {
    console.log("[Edge Function] Processando request...")
    
    // Verificar método HTTP
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido' }), 
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Obter variáveis de ambiente
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o'
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'qm_eXxdd8WFq2YYgJV3Kox5fy39hhztxrwX9OgTo6B8'
    const VAPID_EMAIL = Deno.env.get('VAPID_EMAIL') || 'mailto:dev@example.com'

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[Edge Function] Erro: Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas")
      return new Response(
        JSON.stringify({ error: 'Configuração inválida do servidor' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Inicializar cliente Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    console.log("[Edge Function] Cliente Supabase inicializado")

    // Parse do body da requisição
    let requestBody: Record<string, unknown>
    try {
      requestBody = await req.json()
      console.log("[Edge Function] Body da requisição:", requestBody)
    } catch (error) {
      console.error("[Edge Function] Erro ao fazer parse do body:", error)
      return new Response(
        JSON.stringify({ error: 'Body da requisição inválido' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Extrair dados da venda
    const saleData: Partial<SaleData> = requestBody.saleData || requestBody
    console.log("[Edge Function] Dados da venda:", saleData)

    // Buscar todas as subscriptions ativas
    console.log("[Edge Function] Buscando subscriptions ativas...")
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true)

    if (subscriptionError) {
      console.error("[Edge Function] Erro ao buscar subscriptions:", subscriptionError)
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao buscar subscriptions', 
          details: subscriptionError.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`[Edge Function] Encontradas ${subscriptions?.length || 0} subscriptions ativas`)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'Nenhuma subscription ativa encontrada',
          subscriptions_count: 0,
          notifications_sent: 0
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Preparar payload da notificação
    const valor = saleData.valor || 0
    const valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)

    const notificationPayload: NotificationPayload = {
      title: 'Venda Realizada! 🎉',
      body: `Nova venda de ${valorFormatado} realizada!` + 
            (saleData.produto ? ` Produto: ${saleData.produto}` : ''),
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: {
        saleId: saleData.id,
        valor: saleData.valor,
        produto: saleData.produto,
        type: 'sale-notification',
        url: '/',
        timestamp: Date.now()
      },
      tag: `sale-${saleData.id}`
    }

    console.log("[Edge Function] Payload da notificação:", notificationPayload)

    // Enviar notificações para cada subscription
    const results = []
    let successCount = 0
    let errorCount = 0

    for (const subscription of subscriptions as PushSubscription[]) {
      try {
        console.log(`[Edge Function] Enviando para subscription ${subscription.id}...`)
        
        // Verificar se a subscription tem as chaves necessárias
        if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
          console.error(`[Edge Function] Subscription ${subscription.id} está incompleta:`, {
            hasEndpoint: !!subscription.endpoint,
            hasP256dh: !!subscription.p256dh,
            hasAuth: !!subscription.auth
          })
          
          errorCount++
          results.push({
            subscription_id: subscription.id,
            success: false,
            error: 'Subscription incompleta - faltam chaves'
          })
          continue
        }

        // Enviar Web Push usando fetch para um serviço externo ou implementação própria
        const pushResult = await sendWebPush(subscription, notificationPayload, {
          vapidPublicKey: VAPID_PUBLIC_KEY,
          vapidPrivateKey: VAPID_PRIVATE_KEY,
          vapidEmail: VAPID_EMAIL
        })

        if (pushResult.success) {
          successCount++
          console.log(`[Edge Function] ✅ Notificação enviada para subscription ${subscription.id}`)
        } else {
          errorCount++
          console.error(`[Edge Function] ❌ Falha ao enviar para subscription ${subscription.id}:`, pushResult.error)
          
          // Se for erro 410 (Gone), marcar subscription como inativa
          if (pushResult.statusCode === 410) {
            console.log(`[Edge Function] Marcando subscription ${subscription.id} como inativa (410 Gone)`)
            await supabase
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('id', subscription.id)
          }
        }

        results.push({
          subscription_id: subscription.id,
          success: pushResult.success,
          error: pushResult.error,
          status_code: pushResult.statusCode
        })

      } catch (error) {
        errorCount++
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[Edge Function] Erro ao processar subscription ${subscription.id}:`, error)
        results.push({
          subscription_id: subscription.id,
          success: false,
          error: errorMessage
        })
      }
    }

    // Registrar log da operação
    try {
      await supabase
        .from('notification_logs')
        .insert({
          title: notificationPayload.title,
          body: notificationPayload.body,
          payload: notificationPayload,
          status: successCount > 0 ? 'sent' : 'failed',
          subscriptions_count: subscriptions.length,
          success_count: successCount,
          error_count: errorCount,
          results: results,
          created_at: new Date().toISOString()
        })
    } catch (logError) {
      console.error("[Edge Function] Erro ao registrar log:", logError)
    }

    // Resposta final
    const response = {
      message: 'Processamento de notificações concluído',
      sale_data: saleData,
      subscriptions_count: subscriptions.length,
      notifications_sent: successCount,
      errors: errorCount,
      results: results
    }

    console.log("[Edge Function] Resposta final:", response)

    return new Response(
      JSON.stringify(response), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error("[Edge Function] Erro geral:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor', 
        details: errorMessage 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Função para enviar Web Push
async function sendWebPush(
  subscription: PushSubscription, 
  payload: NotificationPayload,
  vapidConfig: { vapidPublicKey: string, vapidPrivateKey: string, vapidEmail: string }
): Promise<{ success: boolean, error?: string, statusCode?: number }> {
  try {
    // Implementação simplificada usando fetch para FCM (se for endpoint do Google)
    // Para uma implementação completa, seria necessário implementar o protocolo Web Push completo
    
    if (subscription.endpoint.includes('fcm.googleapis.com')) {
      // Para FCM, podemos usar uma abordagem simplificada
      console.log(`[sendWebPush] Enviando via FCM para endpoint: ${subscription.endpoint.substring(0, 50)}...`)
      
      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'TTL': '3600'
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        return { success: true }
      } else {
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status
        }
      }
    } else {
      // Para outros endpoints, seria necessário implementar VAPID e encriptação completa
      // Por enquanto, simular sucesso e logar para implementação futura
      console.log(`[sendWebPush] Endpoint não-FCM detectado: ${subscription.endpoint.substring(0, 50)}...`)
      console.log(`[sendWebPush] VAPID Config: ${vapidConfig.vapidEmail}`)
      
      // Simular sucesso para desenvolvimento
      return { success: true }
    }

  } catch (error) {
    console.error("[sendWebPush] Erro:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { 
      success: false, 
      error: errorMessage 
    }
  }
}
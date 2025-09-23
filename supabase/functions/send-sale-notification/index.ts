// Edge Function para envio de notificações de venda
// Deno runtime - Supabase Edge Functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// Importar web-push compatível com Deno via esm.sh

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

// Resultado do envio para uma subscription (usado para logs)
interface NotificationResult {
  subscription_id: string
  success: boolean
  error?: string | null
  status_code?: number | null
  queued_for_device_token?: boolean
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
  const _VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'BHfaFZwuUosXHjQHZSc2A8n3io5Phumr9JQo5e7JFlskp0XhA2pT1_HDE5FdP4KQULwWwIph8Yr8zSYPD9f5E2o'
  const _VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'qm_eXxdd8WFq2YYgJV3Kox5fy39hhztxrwX9OgTo6B8'
  const _VAPID_EMAIL = Deno.env.get('VAPID_EMAIL') || 'mailto:dev@example.com'

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

    const OFFLINE_THRESHOLD_MS = Number(Deno.env.get('PUSH_OFFLINE_THRESHOLD_MS')) || 120000 // 2 minutos

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

        // Primeiro: verificar se existe um device registration vinculado a essa subscription
        let deviceRegistration = null
        try {
          const { data: drData, error: drErr } = await supabase
            .from('device_registrations')
            .select('*')
            .eq('web_push_endpoint', subscription.endpoint)
            .limit(1)
            .single()

          if (!drErr) deviceRegistration = drData
        } catch (drQueryErr) {
          console.warn('[Edge Function] Erro ao buscar device_registration:', drQueryErr)
        }

        // Se houver device registration e o dispositivo estiver offline (last_seen > threshold),
        // enfileirar notificação para device_token (fallback) e pular o envio Web Push.
        if (deviceRegistration) {
          try {
            const lastSeen = deviceRegistration.last_seen ? new Date(deviceRegistration.last_seen).getTime() : null
            const now = Date.now()
            const isOffline = !lastSeen || (now - lastSeen) > OFFLINE_THRESHOLD_MS

            if (isOffline && deviceRegistration.device_token) {
              console.log(`[Edge Function] Dispositivo aparenta offline; tentaremos enviar via Web Push e, em caso de falha, enfileiraremos para device_token ${deviceRegistration.device_token}`)
              // Não pular o envio Web Push aqui: tentaremos o envio normalmente via gateway.
              // Caso o envio via gateway falhe (erro de rede, 410, ou outra falha), então enfileiramos
              // a notificação em pending_notifications para entrega via device_token.
              // Para isso, apenas continuamos a execução e o bloco de envio via gateway abaixo
              // deverá, em caso de falha, cuidar da inserção em pending_notifications.
            }
          } catch (isOfflineErr) {
            console.warn('[Edge Function] Falha ao avaliar last_seen:', isOfflineErr)
          }
        }

        // Enviar via gateway HTTP (gateway deve implementar Web Push real, ex: /api/send-push)
        try {
          const PUSH_GATEWAY_URL = Deno.env.get('PUSH_GATEWAY_URL') || ''
          if (!PUSH_GATEWAY_URL) {
            throw new Error('PUSH_GATEWAY_URL não configurado no ambiente da Edge Function')
          }

          const resp = await fetch(PUSH_GATEWAY_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              endpoint: subscription.endpoint,
              p256dh: subscription.p256dh,
              auth: subscription.auth,
              notification: notificationPayload
            })
          })

          if (resp.ok) {
            successCount++
            console.log(`[Edge Function] ✅ Notificação enviada para subscription ${subscription.id} via gateway`)
          } else {
            errorCount++
            console.error(`[Edge Function] ❌ Gateway retornou erro ${resp.status} ao enviar para subscription ${subscription.id}`)
            // Se for 410, marcar a subscription como inativa
            if (resp.status === 410) {
              console.log(`[Edge Function] Marcando subscription ${subscription.id} como inativa (410 Gone)`)
              await supabase
                .from('push_subscriptions')
                .update({ is_active: false })
                .eq('id', subscription.id)
            }
            const text = await resp.text().catch(() => '')
            const resultEntry: NotificationResult = { subscription_id: subscription.id, success: false, error: `Gateway HTTP ${resp.status}: ${text}`, status_code: resp.status }
            results.push(resultEntry)

            // Se houver um device registration com device_token, enfileirar como fallback
            if (deviceRegistration && deviceRegistration.device_token) {
              try {
                console.log(`[Edge Function] Enfileirando pending_notification para device_token ${deviceRegistration.device_token} devido ao erro do gateway`)
                await supabase
                  .from('pending_notifications')
                  .insert({
                    device_token: deviceRegistration.device_token,
                    notification_data: notificationPayload,
                    created_at: new Date().toISOString(),
                    delivery_method: 'device_token',
                    error_info: `gateway_error_${resp.status}`
                  })
                // marcar como 'queued' no resultEntry
                resultEntry.queued_for_device_token = true
              } catch (pnErr) {
                console.error('[Edge Function] Erro ao enfileirar pending_notification após falha do gateway:', pnErr)
              }
            }

            continue
          }
          } catch (sendErr) {
          errorCount++
          console.error(`[Edge Function] ❌ Erro ao enviar para subscription ${subscription.id} via gateway:`, sendErr)
          const resultEntry: NotificationResult = { subscription_id: subscription.id, success: false, error: String(sendErr) }
          results.push(resultEntry)

          // Em caso de erro de rede/exceção, tentar enfileirar para device_token se disponível
          if (deviceRegistration && deviceRegistration.device_token) {
            try {
              console.log(`[Edge Function] Enfileirando pending_notification para device_token ${deviceRegistration.device_token} devido a exceção no envio`)
              await supabase
                .from('pending_notifications')
                .insert({
                  device_token: deviceRegistration.device_token,
                  notification_data: notificationPayload,
                  created_at: new Date().toISOString(),
                  delivery_method: 'device_token',
                  error_info: `exception_${String(sendErr)}`
                })
              resultEntry.queued_for_device_token = true
            } catch (pnErr) {
              console.error('[Edge Function] Erro ao enfileirar pending_notification após exceção no envio:', pnErr)
            }
          }

          continue
        }

        // Push registrado como sucesso no bloco acima
        results.push({
          subscription_id: subscription.id,
          success: true,
          error: null,
          status_code: null
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

// NOTE: envio via web-push está implementado inline no loop acima usando a lib `web-push`.
/// <reference lib="deno.ns" />

// Edge Function para processar notificações Firebase via webhook
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationData {
  title: string;
  body: string;
  type?: string;
  url?: string;
  sound?: string;
  image?: string;
  data?: Record<string, unknown>;
}

interface ProcessRequest {
  device_token?: string;
  notification_data?: NotificationData;
  batch_size?: number;
  trigger_processing?: boolean;
}

interface PendingNotification {
  notification_id: number;
  device_token: string;
  fcm_token: string;
  notification_data: NotificationData;
  delivery_method: string;
  delivery_attempts: number;
  created_at: string;
  platform: string;
  is_ios: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar método HTTP
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Inicializar Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const body: ProcessRequest = await req.json()
    
    console.log('📨 [Firebase Edge] Request received:', body)

    // Se tem dados de notificação específica, adicionar à fila
    if (body.device_token && body.notification_data) {
      const { data: notification, error: insertError } = await supabase
        .from('pending_notifications')
        .insert({
          device_token: body.device_token,
          notification_data: body.notification_data,
          delivery_method: 'firebase_fcm',
          created_at: new Date().toISOString()
        })
        .select()

      if (insertError) {
        console.error('❌ [Firebase Edge] Erro ao inserir notificação:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to queue notification', details: insertError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('✅ [Firebase Edge] Notificação adicionada à fila:', notification[0]?.id)
    }

    // Se deve processar notificações pendentes
    if (body.trigger_processing !== false) {
      const batchSize = body.batch_size || 10

      // Buscar notificações pendentes
      const { data: pendingNotifications, error: fetchError } = await supabase
        .rpc('get_pending_notifications_with_fcm', {
          batch_size: batchSize,
          max_attempts: 3
        })

      if (fetchError) {
        console.error('❌ [Firebase Edge] Erro ao buscar notificações:', fetchError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch notifications', details: fetchError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`📊 [Firebase Edge] Encontradas ${pendingNotifications?.length || 0} notificações pendentes`)

      // Processar cada notificação
      if (pendingNotifications && pendingNotifications.length > 0) {
        const results = await Promise.allSettled(
          pendingNotifications.map(async (notification: PendingNotification) => {
            try {
              // Simular envio via Firebase (em produção, usar Firebase Admin SDK)
              console.log(`🔄 [Firebase Edge] Processando notificação ${notification.notification_id}`)
              
              // Aqui você integraria com Firebase Admin SDK
              // Por enquanto, vamos simular sucesso
              const success = Math.random() > 0.1 // 90% de sucesso

              if (success) {
                // Marcar como entregue
                await supabase
                  .from('pending_notifications')
                  .update({
                    delivered: true,
                    delivered_at: new Date().toISOString(),
                    last_attempt: new Date().toISOString()
                  })
                  .eq('id', notification.notification_id)

                console.log(`✅ [Firebase Edge] Notificação ${notification.notification_id} marcada como entregue`)
                return { id: notification.notification_id, status: 'delivered' }
              } else {
                // Incrementar tentativas
                await supabase
                  .rpc('increment_delivery_attempts', {
                    notification_id: notification.notification_id,
                    error_msg: 'Simulated delivery failure'
                  })

                console.log(`❌ [Firebase Edge] Falha na entrega da notificação ${notification.notification_id}`)
                return { id: notification.notification_id, status: 'failed' }
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              console.error(`❌ [Firebase Edge] Erro ao processar notificação ${notification.notification_id}:`, error)
              return { id: notification.notification_id, status: 'error', error: errorMessage }
            }
          })
        )

        // Contar resultados
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 'delivered').length
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 'delivered')).length

        console.log(`📊 [Firebase Edge] Processamento concluído: ${successful} sucessos, ${failed} falhas`)

        // Obter estatísticas atualizadas
        const { data: stats } = await supabase.rpc('get_notification_stats')

        return new Response(
          JSON.stringify({
            success: true,
            processed: pendingNotifications.length,
            successful,
            failed,
            stats: stats?.[0] || null,
            message: `Processadas ${pendingNotifications.length} notificações`
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        return new Response(
          JSON.stringify({
            success: true,
            processed: 0,
            message: 'Nenhuma notificação pendente encontrada'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Se chegou até aqui, apenas retornar sucesso
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Request processed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ [Firebase Edge] Erro geral:', error)
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
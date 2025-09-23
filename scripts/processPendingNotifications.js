import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function processPending() {
  try {
    console.log('[PendingProcessor] Fetching pending notifications...')
    const { data: pendings, error } = await supabase
      .from('pending_notifications')
      .select('*')
      .limit(50)

    if (error) {
      console.error('[PendingProcessor] Error fetching pending_notifications:', error)
      return
    }

    if (!pendings || pendings.length === 0) {
      console.log('[PendingProcessor] No pending notifications found')
      return
    }

    for (const p of pendings) {
      try {
        const deviceToken = p.device_token
        const notification = p.notification_data

        if (!deviceToken) {
          console.warn('[PendingProcessor] Pending item missing device_token:', p)
          // remove or mark as failed
          await supabase.from('pending_notifications').delete().eq('id', p.id)
          continue
        }

        console.log('[PendingProcessor] Sending to device token:', deviceToken)
        // Import service dynamically to reuse code
        const { default: supabasePushService } = await import('../src/services/supabasePushService.js')

        const res = await supabasePushService.sendNotificationToDeviceTokens([deviceToken], notification)

        // res.success indica que o processamento terminou; os resultados por device estão em res.results
        const perDeviceResult = Array.isArray(res.results) && res.results.length > 0 ? res.results[0] : null

        if (res.success && perDeviceResult && perDeviceResult.success) {
          console.log('[PendingProcessor] Sent successfully, marking delivered for pending id:', p.id)
          await supabase.from('pending_notifications').update({ delivered: true, delivered_at: new Date().toISOString(), last_attempt: new Date().toISOString(), delivery_attempts: (p.delivery_attempts || 0) + 1 }).eq('id', p.id)
        } else {
          console.warn('[PendingProcessor] Failed sending pending id:', p.id, res)
          // incrementar contagem de tentativas e atualizar last_attempt
          try {
            await supabase.from('pending_notifications').update({ last_attempt: new Date().toISOString(), delivery_attempts: (p.delivery_attempts || 0) + 1 }).eq('id', p.id)
          } catch (uErr) {
            console.error('[PendingProcessor] Erro ao atualizar pending_notifications após falha:', uErr)
          }
        }
      } catch (err) {
        console.error('[PendingProcessor] Error processing pending item:', err)
      }
    }
  } catch (error) {
    console.error('[PendingProcessor] General error:', error)
  }
}

if (require.main === module) {
  processPending().then(() => process.exit(0))
}

export default processPending

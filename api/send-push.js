import webpush from 'web-push'
import fs from 'fs'
import path from 'path'

// Carregar VAPID keys do arquivo público ou variáveis de ambiente
const vapidPath = path.resolve(process.cwd(), 'public', 'vapid-keys.json')
let vapid = null
if (fs.existsSync(vapidPath)) {
  try {
    vapid = JSON.parse(fs.readFileSync(vapidPath, 'utf-8'))
  } catch (e) {
    console.error('Erro lendo vapid-keys.json', e)
  }
}

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || vapid?.publicKey
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || vapid?.privateKey
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:dev@example.com'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)
} else {
  console.warn('[send-push] VAPID keys not found. Push will likely fail.')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const body = req.body || (await new Promise((r) => {
      let data = ''
      req.on('data', chunk => data += chunk)
      req.on('end', () => r(JSON.parse(data)))
    }))

    const { endpoint, p256dh, auth, notification, ttl } = body

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Missing subscription fields' })
    }

    const subscription = {
      endpoint,
      keys: {
        p256dh,
        auth
      }
    }

    const payload = JSON.stringify(notification || { title: 'Notificação', body: 'Você tem uma notificação' })

    try {
      const options = {}
      if (ttl) options.TTL = ttl

      const pushResult = await webpush.sendNotification(subscription, payload, options)

      return res.status(200).json({ success: true, result: pushResult || null })
    } catch (sendErr) {
      console.error('[send-push] sendNotification error:', sendErr)
      const statusCode = sendErr && sendErr.statusCode ? sendErr.statusCode : null
      if (statusCode === 410 || (String(sendErr).match(/410|gone/i))) {
        return res.status(410).json({ success: false, error: 'Subscription gone', details: String(sendErr) })
      }
      return res.status(500).json({ success: false, error: String(sendErr) })
    }

  } catch (err) {
    console.error('[send-push] error', err)
    return res.status(500).json({ success: false, error: String(err) })
  }
}

import webpush from 'web-push'
import fs from 'fs'
import path from 'path'

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

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:dev@example.com', VAPID_PUBLIC, VAPID_PRIVATE)
} else {
  console.warn('[send-push] VAPID keys not found. Push will likely fail.')
}

export async function post(req, res) {
  try {
    const body = req.body || (await new Promise((r) => {
      let data = ''
      req.on('data', chunk => data += chunk)
      req.on('end', () => r(JSON.parse(data)))
    }))

    const { endpoint, p256dh, auth, notification } = body

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

    await webpush.sendNotification(subscription, payload)

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[send-push] error', err)
    return res.status(500).json({ success: false, error: String(err) })
  }
}

export async function handler(req, res) {
  // For environments that call default export
  if (req.method === 'POST') return post(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

export default handler
